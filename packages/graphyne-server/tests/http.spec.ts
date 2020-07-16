import { makeExecutableSchema } from '@graphql-tools/schema';
import request from 'supertest';
import { Config } from 'graphyne-core/src/types';
import { strict as assert } from 'assert';
import { createServer } from 'http';
import { Graphyne, httpHandler } from '../src';
import { parseBody } from '../src/http/parseBody';
import { HandlerConfig } from '../src/types';

function createGQLServer(
  {
    schema: schemaOpt,
    typeDefs,
    resolvers,
    ...options
  }: Partial<Config> & {
    typeDefs?: string;
    resolvers?: any;
  },
  handlerOpts?: HandlerConfig
) {
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
  return createServer(httpHandler(graphyne, handlerOpts));
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

describe('graphyne-server/http: httpHandler', () => {
  it('returns 400 on body parsing error', async () => {
    const graphyne = new Graphyne({
      schema,
    });
    const server = createServer(httpHandler(graphyne));
    await request(server)
      .post('/graphql')
      .set('content-type', 'application/json')
      .send('{ as')
      .expect(400);
  });
  it('catches error thrown in context function', async () => {
    const server = createGQLServer(
      { schema },
      {
        context: async () => {
          throw new Error('uh oh');
        },
      }
    );
    await request(server)
      .get('/graphql')
      .query({ query: 'query { helloMe }' })
      .expect('{"errors":[{"message":"Context creation failed: uh oh"}]}');
    // Non promise function
    const server2 = createGQLServer(
      { schema },
      {
        context: () => {
          throw new Error('uh oh');
        },
      }
    );
    await request(server2)
      .get('/graphql')
      .query({ query: 'query { helloMe }' })
      .expect('{"errors":[{"message":"Context creation failed: uh oh"}]}');
  });
  describe('resolves options.context that is', () => {
    it('an object', async () => {
      const server = createGQLServer({ schema }, { context: { me: 'hoang' } });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
    it('a function', async () => {
      const server = createGQLServer(
        { schema },
        { context: async () => ({ me: 'hoang' }) }
      );
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
  });
  describe('sends 404 response accordingly if options.path is set', () => {
    const graphyne = new Graphyne({ schema });
    it('by checking against req.url', async () => {
      const server = createServer(httpHandler(graphyne, { path: '/api' }));
      await request(server).get('/api?query={hello}').expect(200);
      await request(server).get('/graphql?query={hello}').expect(404);
    });
    it('by checking against req.path when available', async () => {
      const server = createServer((req, res) => {
        (req as any).path = req.url.substring(0, req.url.indexOf('?'));
        httpHandler(graphyne, { path: '/api' })(req, res);
      });
      await request(server).get('/api?query={hello}').expect(200);
      await request(server).get('/graphql?query={hello}').expect(404);
    });
  });
});

describe('graphyne-server/http: parseBody', () => {
  it('returns if req.body has been parsed', (done) => {
    const req: any = { body: { query: 1 }, headers: {}, method: '' };
    parseBody(req, (err, parsedBody) => {
      done(assert.deepStrictEqual(parsedBody, req.body));
    });
  });
  describe('errors body is malformed', async () => {
    await request(
      createServer((req, res) => {
        parseBody(req, (err, parsedBody) => {
          if (err) res.statusCode = err.status;
          res.end(JSON.stringify(parsedBody));
        });
      })
    )
      .post('/graphql')
      .send(`{"query":"{ helloWorld }`)
      .set('content-type', 'application/json')
      .expect(400);

    await request(
      createServer((req, res) => {
        (req as any).body = `{"query":"{ helloWorld }`;
        parseBody(req, (err, parsedBody) => {
          if (err) res.statusCode = err.status;
          res.end(JSON.stringify(parsedBody));
        });
      })
    )
      .post('/graphql')
      .send()
      .set('content-type', 'application/json')
      .expect(400);
  });
  describe('do not parse body', () => {
    it('with empty content type', async () => {
      const server = createServer((req, res) => {
        parseBody(req, (err, parsedBody) => {
          res.end(String(parsedBody === null));
        });
      });
      await request(server)
        .post('/graphql')
        .send(`query { helloWorld }`)
        .set('content-type', '')
        .expect('true');
    });
  });
});
