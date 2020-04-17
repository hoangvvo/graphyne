import { makeExecutableSchema } from 'graphql-tools';
import request from 'supertest';
import { strict as assert } from 'assert';
import { Config } from '../../graphyne-core/src';
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
      helloMe: String
    }
  `,
  resolvers: {
    Query: {
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
  it('maps req and res using integrationFn', () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    const ctx = {
      req: {
        method: 'POST',
        query: '{ hello }',
        path: '/graphql',
        headers: { 'content-type': 'application/json' },
        on: () => null,
      },
      res: {
        setHeader: () => null,
        end: () => null,
      },
    };
    const handler = graphyne.createHandler({
      integrationFn: ({ req, res }) => ({ request: req, response: res }),
    });
    // @ts-ignore
    assert.doesNotThrow(() => handler(ctx));
  });
  describe('renders GraphiQL', () => {
    const graphyne = new GraphyneServer({
      schema: schemaHello,
    });
    it('when graphiql is true', async () => {
      const server = createServer(
        graphyne.createHandler({
          graphiql: true,
        })
      );
      const { text } = await request(server).get('/___graphql');
      // .expect('content-type', 'text/html; charset=utf-8');
      assert(text.includes('GraphiQL'));
    });
    it('when graphiql.path and graphiql.defaultQuery is set', async () => {
      const server = createServer(
        graphyne.createHandler({
          graphiql: {
            path: '/graphiql',
            defaultQuery: '{ hello }',
          },
        })
      );
      const { text } = await request(server).get('/graphiql');
      // .expect('content-type', 'text/html; charset=utf-8');
      assert(text.includes('GraphiQL'));
      assert(text.includes('{ hello }'));
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
