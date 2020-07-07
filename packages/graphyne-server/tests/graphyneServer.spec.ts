import { makeExecutableSchema } from '@graphql-tools/schema';
import request from 'supertest';
import { strict as assert } from 'assert';
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
  describe('explicitly run on specific path if options.path is set', () => {
    const graphyne = new GraphyneServer({
      schema,
      path: '/api',
    });
    it('by checking against req.url', async () => {
      const server = createServer(graphyne.createHandler());
      await request(server).get('/api?query={hello}').expect(200);
      await request(server).get('/graphql?query={hello}').expect(404);
    });
    it('by checking against req.path when available', async () => {
      const server = createServer((req, res) => {
        (req as any).path = req.url.substring(0, req.url.indexOf('?'));
        graphyne.createHandler()(req, res);
      });
      await request(server).get('/api?query={hello}').expect(200);
      await request(server).get('/graphql?query={hello}').expect(404);
    });
  });
});

describe('deprecated createHandler(options)', () => {
  assert.throws(() => new GraphyneServer({ schema }).createHandler({}));
});
