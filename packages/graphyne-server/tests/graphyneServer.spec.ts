import { makeExecutableSchema } from 'graphql-tools';
import request from 'supertest';
import { strict as assert } from 'assert';
import { Config } from '../../graphyne-core/src';
import { startSubscriptionServer } from '../../graphyne-ws/src';
import { createServer } from 'http';
import { GraphyneServer } from '../src';

function createGQLServer({
  schema: schemaOpt,
  typeDefs,
  resolvers,
  ...options
}: Partial<Config> & {
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

const schemaHello = makeExecutableSchema({
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
        schema: schemaHello,
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
        schema: schemaHello,
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
  describe('renders GraphiQL', () => {
    it('when graphiql is true', async () => {
      const graphyne = new GraphyneServer({
        schema: schemaHello,
        playground: true,
      });
      const server = createServer(graphyne.createHandler());
      const { text } = await request(server).get('/playground');
      assert(text.includes('GraphQL Playground'));
    });
    it('when graphiql.path is set', async () => {
      const graphyne = new GraphyneServer({
        schema: schemaHello,
        playground: { path: '/___graphql' },
      });
      const server = createServer(graphyne.createHandler());
      const { text } = await request(server).get('/___graphql');
      assert(text.includes('GraphQL Playground'));
    });
    it('with correct graphql endpoint and subscription endpoint', async () => {
      const graphyne = new GraphyneServer({
        schema: schemaHello,
        playground: true,
        path: '/thegraphqlendpoint',
      });
      const server = createServer(graphyne.createHandler());
      startSubscriptionServer({
        server,
        graphyne,
        path: '/thesubscriptionendpoint',
      });
      const { text } = await request(server).get('/playground');
      assert(
        text.includes(
          `"endpoint":"/thegraphqlendpoint","subscriptionEndpoint":"/thesubscriptionendpoint"`
        )
      );
    });
  });
  it('allow custom onResponse', async () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
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
  describe('when path is not match ', () => {
    it('by default calling `onResponse', async () => {
      const graphyne = new GraphyneServer({
        schema: schemaHello,
        onResponse: (result, req, res) => {
          res.setHeader('test', 'ok');
          res.writeHead(result.status, result.headers).end(result.body);
        },
      });
      const server = createServer(graphyne.createHandler());
      await request(server)
        .get('/api')
        .expect('not found')
        .expect(404)
        .expect('test', 'ok');
    });
    it('renders custom behavior in onNoMatch', async () => {
      const graphyne = new GraphyneServer({
        schema: schemaHello,
        onNoMatch: (req, res) => res.end('found'),
      });
      const server = createServer(graphyne.createHandler());
      await request(server).get('/api').expect('found');
    });
  });
  it('returns 400 on body parsing error', async () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
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
      schema: schemaHello,
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
      schema: schemaHello,
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
        schema: schemaHello,
        context: { me: 'hoang' },
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
    it('a function', async () => {
      const server = createGQLServer({
        schema: schemaHello,
        context: async () => ({ me: 'hoang' }),
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
  });
});
