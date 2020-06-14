import { makeExecutableSchema } from 'graphql-tools';
import { strict as assert } from 'assert';
import { QueryResponse } from '../../graphyne-core/src';
import { GraphyneWorker } from '../src';
import { EventEmitter } from 'events';
import * as fetch from 'node-fetch';

const schema = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello: String
      helloMe: String
      helloWho(who: String!): String
    }
  `,
  resolvers: {
    Query: {
      hello: () => 'world',
      helloMe: (obj, args, context) => context.me,
      helloWho: (obj, args) => args.who,
    },
  },
});

async function testRequest(
  input: string,
  init: fetch.RequestInit,
  expected: Partial<QueryResponse> | null,
  graphyneOpts = {}
) {
  const handle = new GraphyneWorker({
    schema,
    ...graphyneOpts,
  }).createHandler();
  return new Promise((resolve, reject) => {
    function respondWith(responsePromise: Promise<Response>) {
      if (!expected) throw new Error('Should not call me');
      responsePromise
        .then(async (response) => {
          if (expected.body)
            assert.strictEqual(expected.body, await response.text());
          assert.strictEqual(expected.status || 200, response.status);
          resolve();
        })
        .catch(reject);
    }
    const myEmitter = new EventEmitter();
    const fetchEvent = {
      respondWith,
      request: new fetch.Request(
        input.startsWith('/') ? `http://localhost:0${input}` : input,
        init
      ),
    };
    myEmitter.on('fetch', handle).emit('fetch', fetchEvent);
  });
}

before(() => {
  // @ts-ignore
  global.Request = fetch.Request;
  // @ts-ignore
  global.Response = fetch.Response;
});

describe('Event handler', () => {
  it('works with queryParams', async () => {
    await testRequest(
      '/graphql?query={ hello }',
      {},
      { status: 200, body: `{"data":{"hello":"world"}}` }
    );
  });

  it('works with application/json body', async () => {
    await testRequest(
      '/graphql',
      {
        body: JSON.stringify({
          query: `query helloWho($who: String!) { helloWho(who: $who) }`,
          variables: { who: 'John' },
          headers: { 'content-type': 'application/json' },
        }),
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      },
      { status: 200, body: `{"data":{"helloWho":"John"}}` }
    );
  });

  it('works with application/graphql', async () => {
    await testRequest(
      '/graphql',
      {
        body: `{ hello }`,
        method: 'POST',
        headers: { 'content-type': 'application/graphql' },
      },
      { status: 200, body: `{"data":{"hello":"world"}}` }
    );
  });

  describe('do not parse body', () => {
    it('with empty content-type', async () => {
      await testRequest(
        '/graphql',
        {
          body: JSON.stringify({
            query: `query helloWho($who: String!) { helloWho(who: $who) }`,
            variables: { who: 'John' },
          }),
          method: 'POST',
        },
        {
          status: 400,
          body: `{"errors":[{"message":"Must provide query string."}]}`,
        }
      );
    });
  });

  it('errors if query is not defined', async () => {
    await testRequest(
      '/graphql',
      {},
      {
        body: `{"errors":[{"message":"Must provide query string."}]}`,
        status: 400,
      }
    );
  });

  it('errors if body is malformed', async () => {
    await testRequest(
      '/graphql',
      {
        body: `query { helloWorld`,
        method: 'POST',
        headers: { 'content-type': 'application/json; t' },
      },
      { status: 400 }
    );
  });

  it('catches error thrown in context function', async () => {
    await testRequest(
      '/graphql?query={helloMe}',
      {},
      {
        status: 500,
        body: `{"errors":[{"message":"Context creation failed: uh oh"}]}`,
      },
      {
        context: async () => {
          throw new Error('uh oh');
        },
      }
    );
  });

  describe('response with GraphQL', () => {
    it('default to /graphql path', async () => {
      await testRequest(
        '/graphql?query={ hello }',
        {},
        { status: 200, body: `{"data":{"hello":"world"}}` }
      );
    });
    it('on custom path', async () => {
      await testRequest(
        '/api?query={ hello }',
        {},
        { status: 200, body: `{"data":{"hello":"world"}}` },
        { path: '/api' }
      );
    });
    it('pass through if not GraphQL path', (done) => {
      testRequest('/myApi', {}, null);
      // responseWith will not call
      setTimeout(done, 30);
    });
  });

  describe('renders GraphiQL', () => {
    it('not by default', (done) => {
      const graphyne = new GraphyneWorker({ schema });
      const fetchEvent = {
        respondWith: (promise: Promise<Response>) => {
          throw new Error('Should not call this');
        },
        request: new fetch.Request('http://localhost:0/playground'),
      };
      graphyne.createHandler()(fetchEvent);
      done();
    });
    it('when graphiql is true', (done) => {
      const graphyne = new GraphyneWorker({ schema, playground: true });
      const fetchEvent = {
        respondWith: (promise: Promise<Response>) => {
          promise
            .then((response) => response.text())
            .then((text) => assert(text.includes('GraphQL Playground')))
            .then(done);
        },
        request: new fetch.Request('http://localhost:0/playground'),
      };
      graphyne.createHandler()(fetchEvent);
    });
    it('when graphiql.path is set', (done) => {
      const graphyne = new GraphyneWorker({
        schema,
        playground: { path: '/___graphql' },
      });
      const fetchEvent = {
        respondWith: (promise: Promise<Response>) => {
          promise
            .then((response) => response.text())
            .then((text) => assert(text.includes('GraphQL Playground')))
            .then(done);
        },
        request: new fetch.Request('http://localhost:0/___graphql'),
      };
      graphyne.createHandler()(fetchEvent);
    });
  });
});

describe('handleRequest', () => {
  it('can be used to execute query programmatically', async () => {
    const response = await new GraphyneWorker({ schema }).handleRequest(
      new Request('http://localhost:0/graphql?query={hello}')
    );
    assert.strictEqual(await response.text(), `{"data":{"hello":"world"}}`);
  });
});

describe('deprecated createHandler(options)', () => {
  assert.throws(() => new GraphyneWorker({ schema }).createHandler({}));
});
