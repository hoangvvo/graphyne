import { makeExecutableSchema } from '@graphql-tools/schema';
import request from 'supertest';
import { Config } from '../../graphyne-core/src';
import { createServer } from 'http';
import { Graphyne, createHandler } from '../src';
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
  const graphyne = new Graphyne({
    schema,
    ...options,
  });
  return createServer(createHandler(graphyne, options));
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
  it('returns 400 on body parsing error', async () => {
    const graphyne = new Graphyne({
      schema,
    });
    const server = createServer(createHandler(graphyne));
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
    const graphyne = new Graphyne({ schema });
    it('by checking against req.url', async () => {
      const server = createServer(createHandler(graphyne, { path: '/api' }));
      await request(server).get('/api?query={hello}').expect(200);
      await request(server).get('/graphql?query={hello}').expect(404);
    });
    it('by checking against req.path when available', async () => {
      const server = createServer((req, res) => {
        (req as any).path = req.url.substring(0, req.url.indexOf('?'));
        createHandler(graphyne, { path: '/api' })(req, res);
      });
      await request(server).get('/api?query={hello}').expect(200);
      await request(server).get('/graphql?query={hello}').expect(404);
    });
  });
});
