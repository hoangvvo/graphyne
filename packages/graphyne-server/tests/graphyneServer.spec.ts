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
  it('throws if onNoMatch is not a function', () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    // @ts-ignore
    assert.throws(() => graphyne.createHandler({ onNoMatch: 'boom' }));
  });
  it('maps req and res using integrationFn', async () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    const handler = graphyne.createHandler({
      integrationFn: ({ req, res }) => ({ request: req, response: res }),
    });
    const server = createServer((req, res) => {
      const ctx = { req, res };
      handler(ctx);
    });
    await request(server)
      .get('/graphql')
      .query({ query: 'query { hello }' })
      .expect('{"data":{"hello":"world"}}');
  });
  it('allow custom sendResponse using integrationFn', async () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    const server = createServer(
      graphyne.createHandler({
        integrationFn: (req, res) => ({
          request: req,
          response: res,
          sendResponse: () => {
            res.setHeader('test', 'ok');
            res.end('');
          },
        }),
      })
    );
    await request(server)
      .get('/graphql')
      .query({ query: 'query { hello }' })
      .expect('test', 'ok');
  });
  describe('renders GraphiQL', () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    it('when graphiql is true', async () => {
      const server = createServer(
        graphyne.createHandler({
          playground: true,
        })
      );
      const { text } = await request(server).get('/playground');
      assert(text.includes('GraphQL Playground'));
    });
    it('when graphiql.path is set', async () => {
      const server = createServer(
        graphyne.createHandler({
          playground: { path: '/___graphql' },
        })
      );
      const { text } = await request(server).get('/___graphql');
      assert(text.includes('GraphQL Playground'));
    });
    it('with correct graphql endpoint and subscription endpoint', async () => {
      const server = createServer(
        graphyne.createHandler({
          playground: true,
          path: '/thegraphqlendpoint',
        })
      );
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
  describe('when path no match ', () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    it('by default renders 404', async () => {
      const server = createServer(graphyne.createHandler());
      await request(server).get('/api').expect('not found');
    });
    it('renders custom behavior in onNoMatch', async () => {
      const server = createServer(
        graphyne.createHandler({
          onNoMatch: (req, res) => res.end('found'),
        })
      );
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
