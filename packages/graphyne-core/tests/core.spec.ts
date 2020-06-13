import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLSchema } from 'graphql';
import { strict as assert, deepStrictEqual } from 'assert';
import { GraphyneCore, Config, QueryBody, QueryCache } from '../src';
import { Lru } from 'tiny-lru';

const schema = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello(who: String!): String
      helloWorld: String
      asyncHelloWorld: String
      helloRoot: String
      throwMe: String
      asyncThrowMe: String
      dangerousThrow: String
      helloContext: String
    }
    type Mutation {
      sayHello(who: String!): String
    }
  `,
  resolvers: {
    Query: {
      hello: (obj, args) => args.who,
      asyncHelloWorld: async (obj, args) => 'world',
      helloWorld: () => 'world',
      helloRoot: ({ name }) => name,
      throwMe: () => {
        throw new Error('im thrown');
      },
      asyncThrowMe: async () => {
        throw new Error('im thrown');
      },
      dangerousThrow: () => {
        const err = new Error('oh no');
        (err as any).systemSecret = '123';
        throw err;
      },
      helloContext: (obj, args, context) => 'Hello ' + context.robot,
    },
    Mutation: {
      sayHello: (obj, args) => 'Hello ' + args.who,
    },
  },
});

describe('graphyne-core', () => {
  it('throws if initializing instance with no option', () => {
    assert.throws(() => {
      // @ts-ignore
      new GraphyneCore();
    });
  });
  it('throws if schema is invalid', () => {
    assert.throws(() => {
      new GraphyneCore({
        // @ts-ignore
        schema: new GraphQLSchema({ directives: [null] }),
      });
    });
  });
});

describe('HTTP Operations', () => {
  type ExpectedBodyFn = (str: string) => boolean;

  function testHttp(
    queryRequest: QueryBody & {
      context?: Record<string, any>;
      httpMethod?: string;
    },
    expected: {
      status?: number;
      body: string | ExpectedBodyFn;
      headers?: Record<string, string>;
    },
    options?: Partial<Config>
  ) {
    if (!queryRequest.context) queryRequest.context = {};
    if (!queryRequest.httpMethod) queryRequest.httpMethod = 'POST';
    return new Promise((resolve, reject) => {
      new GraphyneCore({
        schema,
        ...options,
        // @ts-ignore
      }).runHttpQuery(queryRequest, (result) => {
        if (typeof expected.body === 'function') {
          // check using custom function
          if (!expected.body(result.body))
            throw new Error('actual body does not match body check function');
          // already check body, no longer need
          delete expected.body;
          delete result.body;
        }
        try {
          deepStrictEqual(
            {
              headers: { 'content-type': 'application/json' },
              status: 200,
              ...expected,
            },
            result
          );
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  it('allows simple request', () => {
    return testHttp(
      { query: 'query { helloWorld }' },
      { body: `{"data":{"helloWorld":"world"}}` }
    );
  });
  it('allows simple request with async resolver', () => {
    return testHttp(
      { query: 'query { asyncHelloWorld }' },
      { body: `{"data":{"asyncHelloWorld":"world"}}` }
    );
  });
  it('allows request with variables', () => {
    return testHttp(
      {
        query: 'query helloWho($who: String!) { hello(who: $who) }',
        variables: { who: 'John' },
      },
      { body: `{"data":{"hello":"John"}}` }
    );
  });
  it('errors when missing operation name', async () => {
    return testHttp(
      {
        query: `query helloJohn { hello(who: "John") }
      query helloJane { hello(who: "Jane") }
      `,
      },
      {
        status: 400,
        body:
          '{"errors":[{"message":"Must provide operation name if query contains multiple operations."}]}',
      }
    );
  });
  it('allows request with operation name', () => {
    return testHttp(
      {
        query: `query helloJohn { hello(who: "John") }
        query helloJane { hello(who: "Jane") }
        `,
        operationName: 'helloJane',
      },
      { body: '{"data":{"hello":"Jane"}}' }
    );
  });
  it('errors when missing query', () => {
    return testHttp(
      { context: {} },
      {
        status: 400,
        body: '{"errors":[{"message":"Must provide query string."}]}',
      }
    );
  });
  it('errors when sending a mutation via GET request', () => {
    return testHttp(
      {
        query: `mutation sayHelloWho { sayHello(who: "Jane") }`,
        httpMethod: 'GET',
      },
      {
        status: 405,
        body:
          '{"errors":[{"message":"Operation mutation cannot be performed via a GET request"}]}',
      }
    );
  });
  it('errors when sending via neither GET nor POST request', () => {
    return testHttp(
      {
        query: `mutation sayHelloWho { sayHello(who: "Jane") }`,
        httpMethod: 'PUT',
      },
      {
        status: 405,
        body:
          '{"errors":[{"message":"GraphQL only supports GET and POST requests."}]}',
      }
    );
  });
  it('allows context value', () => {
    return testHttp(
      {
        query: `{ helloContext }`,
        context: {
          robot: 'R2-D2',
        },
      },
      { body: '{"data":{"helloContext":"Hello R2-D2"}}' }
    );
  });
  describe('allows options.rootValue', () => {
    const rootValue = {
      name: 'Luke',
    };
    // FIXME: need better test
    it('as an object', () => {
      return testHttp(
        { query: 'query { helloRoot }', httpMethod: 'GET' },
        { body: '{"data":{"helloRoot":"Luke"}}' },
        { rootValue }
      );
    });
    it('as a function', () => {
      return testHttp(
        { query: 'query { helloRoot }', httpMethod: 'GET' },
        { body: '{"data":{"helloRoot":"Luke"}}' },
        { rootValue: () => rootValue }
      );
    });
  });
  describe('errors on validation errors', () => {
    it('when there are unknown fields', () => {
      return testHttp(
        { query: `query { xinchao, hola, hello }` },
        {
          status: 400,
          body: (str) => {
            const {
              errors: [err1, err2],
            } = JSON.parse(str);
            assert.deepStrictEqual(
              err1.message,
              `Cannot query field "xinchao" on type "Query".`
            );
            assert.deepStrictEqual(
              err2.message,
              `Cannot query field "hola" on type "Query".`
            );
            return true;
          },
        }
      );
    });
    it('when missing required arguments', () => {
      return testHttp(
        { query: `query { hello }` },
        {
          status: 400,
          body: (str) => {
            const {
              errors: [err],
            } = JSON.parse(str);
            assert.deepStrictEqual(
              err.message,
              `Field "hello" argument "who" of type "String!" is required, but it was not provided.`
            );
            return true;
          },
        }
      );
    });
    it('when arguments have incorrect types', async () => {
      return testHttp(
        {
          query: 'query helloWho($who: String!) { hello(who: $who) }',
          variables: { who: 12 },
        },
        {
          status: 200,
          body: (str) => {
            const {
              errors: [err],
            } = JSON.parse(str);
            assert.deepStrictEqual(
              err.message,
              `Variable "$who" got invalid value 12; Expected type String; String cannot represent a non string value: 12`
            );
            return true;
          },
        }
      );
    });
    it('when query is malformed', () => {
      return testHttp(
        { query: 'query { helloWorld ' },
        {
          status: 400,
          body: (str) => {
            const {
              errors: [err],
            } = JSON.parse(str);
            assert.deepStrictEqual(
              err.message,
              `Syntax Error: Expected Name, found <EOF>.`
            );
            return true;
          },
        }
      );
    });
  });
  it('catches error in resolver function', () => {
    return testHttp(
      { query: 'query { throwMe }' },
      {
        body: (str) => {
          const {
            errors: [err],
          } = JSON.parse(str);
          assert.deepStrictEqual(err.message, 'im thrown');
          return true;
        },
      }
    );
  });
  it('catches error in async resolver function', () => {
    return testHttp(
      { query: 'query { asyncThrowMe }' },
      {
        body: (str) => {
          const {
            errors: [err],
          } = JSON.parse(str);
          assert.deepStrictEqual(err.message, 'im thrown');
          return true;
        },
      }
    );
  });
  describe('allows format errors', () => {
    it('using default formatError', () => {
      return testHttp(
        { query: 'query { dangerousThrow }' },
        {
          body: (str) => {
            const {
              errors: [err],
            } = JSON.parse(str);
            assert.deepStrictEqual(err.message, 'oh no');
            // formatError will filter trivial prop
            assert.deepStrictEqual(err.systemSecret, undefined);
            return true;
          },
        }
      );
    });
    it('using custom formatError', () => {
      return testHttp(
        { query: 'query { dangerousThrow }' },
        {
          body: (str) => {
            const {
              errors: [err],
            } = JSON.parse(str);
            assert.deepStrictEqual(err.message, 'Internal server error');
            return true;
          },
        },
        {
          formatError: (err) => {
            return new Error('Internal server error');
          },
        }
      );
    });
  });
  it('saves compiled query to cache', async () => {
    const graphyne = new GraphyneCore({
      schema,
    });
    const lru: Lru<QueryCache> = (graphyne as any).lru;
    await new Promise((resolve) => {
      graphyne.runHttpQuery(
        {
          query: '{ helloWorld }',
          httpMethod: 'GET',
          context: {},
        },
        resolve
      );
    });
    assert(lru.has('{ helloWorld }'));
  });
  it('uses compiled query from cache', async () => {
    const graphyne = new GraphyneCore({
      schema,
    });
    const lru: Lru<QueryCache> = (graphyne as any).lru;
    lru.set('{ helloWorld }', {
      compiledQuery: {
        query: () => ({ data: { cached: true } }),
        stringify: JSON.stringify,
      },
      operation: 'query',
      document: '' as any,
    });
    const { body } = await new Promise((resolve) => {
      graphyne.runHttpQuery(
        {
          query: '{ helloWorld }',
          httpMethod: 'GET',
          context: {},
        },
        resolve
      );
    });
    assert.deepStrictEqual(body, JSON.stringify({ data: { cached: true } }));
  });
  it('does not cache bad query', async () => {
    const graphyne = new GraphyneCore({
      schema,
    });
    const lru: Lru<QueryCache> = (graphyne as any).lru;
    await new Promise((resolve) => {
      graphyne.runHttpQuery(
        {
          query: '{ watt }',
          httpMethod: 'GET',
          context: {},
        },
        resolve
      );
    });
    assert(lru.has('{ watt }') !== true);
  });
});
