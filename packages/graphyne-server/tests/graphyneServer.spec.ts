import { makeExecutableSchema } from 'graphql-tools';
import request from 'supertest';
import { strict as assert } from 'assert';
import sinon from 'sinon';
import { Config } from '../../graphyne-core/src';
import { createServer } from 'http';
import { GraphyneServer } from '../src';
import { HandlerConfig } from '../src/types';

function createGQLServer({
  schema: schemaOpt,
  typeDefs,
  resolvers,
  ...options
}: Partial<Config & HandlerConfig> & {
  typeDefs?: string;
  resolvers?: any;
}) {
  const schema =
    schemaOpt ||
    makeExecutableSchema({
      typeDefs: typeDefs as string,
      resolvers,
    });
  const graphyne = new GraphyneServer({
    schema,
    ...options,
  });
  return createServer(graphyne.createHandler());
}

const schema = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello: String
      helloMe: String
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'world',
      helloMe: (obj, args, context) => context.me,
    },
  },
});

describe('createHandler', () => {
  describe('maps request using onRequest', () => {
    it('with IncomingMessage', async () => {
      const graphyne = new GraphyneServer({
        schema,
        onRequest: ([ctx], done) => done(ctx.req),
        onResponse: ({ status, body, headers }, ctx) =>
          ctx.res.writeHead(status, headers).end(body),
      });
      const handler = graphyne.createHandler();
      const server = createServer((req, res) => {
        const ctx = { req, res };
        handler(ctx);
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { hello }' })
        .expect('{"data":{"hello":"world"}}');
    });
    it('with constructed request object', async () => {
      const graphyne = new GraphyneServer({
        schema,
        onRequest: ([request], done) =>
          done({
            url: request.url,
            headers: request.httpHeaders,
            method: request.httpMethod,
          }),
        onResponse: ({ status, body, headers }, event, res) =>
          res.writeHead(status, headers).end(body),
      });
      const handler = graphyne.createHandler();
      const server = createServer((req, res) => {
        const request = {
          url: `/graphql?query={hello}`,
          httpHeaders: {},
          httpMethod: 'GET',
        };
        handler(request, res);
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { hello }' })
        .expect('{"data":{"hello":"world"}}');
    });
  });
  it('allow custom onResponse', async () => {
    const graphyne = new GraphyneServer({
      schema,
      onResponse: (result, req, res) => {
        res.setHeader('test', 'ok');
        res.end(result.body);
      },
    });
    const server = createServer(graphyne.createHandler());
    await request(server)
      .get('/graphql')
      .query({ query: 'query { hello }' })
      .expect('test', 'ok')
      .expect('{"data":{"hello":"world"}}');
  });
  it('returns 400 on body parsing error', async () => {
    const graphyne = new GraphyneServer({
      schema,
    });
    const server = createServer(graphyne.createHandler());
    await request(server)
      .post('/graphql')
      .set('content-type', 'application/json')
      .send('{ as')
      .expect(400);
  });
});

describe('HTTP handler', () => {
  it('catches error thrown in context function', async () => {
    const server = createGQLServer({
      schema,
      context: async () => {
        throw new Error('uh oh');
      },
    });
    await request(server)
      .get('/graphql')
      .query({ query: 'query { helloMe }' })
      .expect('{"errors":[{"message":"Context creation failed: uh oh"}]}');
    // Non promise function
    const server2 = createGQLServer({
      schema,
      context: () => {
        throw new Error('uh oh');
      },
    });
    await request(server2)
      .get('/graphql')
      .query({ query: 'query { helloMe }' })
      .expect('{"errors":[{"message":"Context creation failed: uh oh"}]}');
  });
  describe('resolves options.context that is', () => {
    it('an object', async () => {
      const server = createGQLServer({
        schema,
        context: { me: 'hoang' },
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
    it('a function', async () => {
      const server = createGQLServer({
        schema,
        context: async () => ({ me: 'hoang' }),
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
  });
  it('warns if method is not detected', async () => {
    // Mock console.warn
    const log = sinon.spy(console, 'warn');

    const server = createGQLServer({
      schema,
      context: { me: 'hoang' },
      onRequest: ([req], cb) => {
        delete req.method;
        cb(req);
      },
    });

    await request(server)
      .get('/graphql')
      .query({ query: 'query { helloMe }' })
      .expect('{"data":{"helloMe":"hoang"}}');

    if (
      !log.calledOnceWith(
        `graphyne-server cannot detect the HTTP method. This will lead to mutation being allowed to execute on GET request while it shouldn't be.`
      )
    ) {
      throw new Error('Console.warn was not called');
    }
  });
});

describe('deprecated createHandler(options)', () => {
  assert.throws(() => new GraphyneServer({ schema }).createHandler({}));
});
