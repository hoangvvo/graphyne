import { makeExecutableSchema } from 'graphql-tools';
import { strict as assert } from 'assert';
import request from 'supertest';
import { createServer } from 'http';
import { GraphyneServer } from '../packages/graphyne-server/src';

const schemaHello = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello(who: String!): String
    }
  `,
  resolvers: {
    Query: {
      hello: (obj, args) => args.who,
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
