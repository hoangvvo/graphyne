import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLSchema } from 'graphql';
import { strict as assert, deepStrictEqual } from 'assert';
import {
  GraphyneServerBase,
  QueryRequest,
  QueryResponse,
  Config,
} from '../src';

const schema = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello(who: String!): String
      helloWorld: String
      helloRoot: String
      throwMe: String
    }
    type Mutation {
      sayHello(who: String!): String
    }
  `,
  resolvers: {
    Query: {
      hello: (obj, args) => args.who,
      helloWorld: () => 'world',
      helloRoot: ({ name }) => name,
      throwMe: async () => {
        throw new Error('weeeeee');
      },
    },
    Mutation: {
      sayHello: (obj, args) => 'Hello ' + args.who,
    },
  },
});

function testCase(
  queryRequest: QueryRequest,
  expected: Partial<QueryResponse> | { body: (b: string) => boolean },
  options?: Partial<Config>
) {
  return new Promise((resolve, reject) => {
    new GraphyneServerBase({
      schema,
      ...options,
    }).runQuery(queryRequest, (err, result) => {
      if (typeof expected.body === 'function') {
        return expected.body(result.body) ? resolve() : reject('no match');
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

describe('graphyne-core', () => {
  it('throws if initializing instance with no option', () => {
    assert.throws(() => {
      // @ts-ignore
      new GraphyneServerBase();
    });
  });
  it('throws if options.context is not a function or object', () => {
    assert.throws(() => {
      new GraphyneServerBase({
        // @ts-ignore
        context: 1,
        schema,
      });
    });
  });
  it('throws if schema is invalid', () => {
    assert.throws(() => {
      new GraphyneServerBase({
        // @ts-ignore
        schema: new GraphQLSchema({ directives: [null] }),
      });
    });
  });
  describe('options.cache', () => {
    it('throws if options.cache is not a number or boolean', () => {
      assert.doesNotThrow(() => {
        // TODO: Need test for actual behavior
        new GraphyneServerBase({
          // @ts-ignore
          cache: true,
          schema,
        });
        new GraphyneServerBase({
          // @ts-ignore
          cache: 12,
          schema,
        });
      });
      assert.throws(() => {
        new GraphyneServerBase({
          // @ts-ignore
          cache: {},
        });
      });
    });
  });
});

describe('Operations', () => {});

describe('HTTP Operations', () => {
  it('allows regular request', () => {
    return testCase(
      {
        query: 'query { helloWorld }',
        context: {},
      },
      { body: `{"data":{"helloWorld":"world"}}` }
    );
  });
  it('allows request with variables', () => {
    return testCase(
      {
        query: 'query helloWho($who: String!) { hello(who: $who) }',
        variables: { who: 'John' },
        context: {},
      },
      { body: `{"data":{"hello":"John"}}` }
    );
  });
  it('errors when missing operation name request', async () => {
    return testCase(
      {
        query: `query helloJohn { hello(who: "John") }
      query helloJane { hello(who: "Jane") }
      `,
        context: {},
      },
      {
        status: 400,
        body:
          '{"errors":[{"message":"Must provide operation name if query contains multiple operations."}]}',
      }
    );
  });
  it('allows request with operation name', () => {
    return testCase(
      {
        query: `query helloJohn { hello(who: "John") }
        query helloJane { hello(who: "Jane") }
        `,
        operationName: 'helloJane',
        context: {},
      },
      { body: '{"data":{"hello":"Jane"}}' }
    );
  });
  it('errors when missing query', async () => {
    return testCase(
      { context: {} },
      {
        status: 400,
        body: '{"errors":[{"message":"Must provide query string."}]}',
      }
    );
  });
  it('errors when sending a mutation via GET request', () => {
    return testCase(
      {
        query: `mutation sayHelloWho { sayHello(who: "Jane") }`,
        httpRequest: {
          method: 'GET',
        },
        context: {},
      },
      {
        status: 405,
        body:
          '{"errors":[{"message":"Operation mutation cannot be performed via a GET request"}]}',
      }
    );
  });
  it('allows sending a mutation via POST request', () => {
    return testCase(
      {
        query: `mutation sayHelloWho { sayHello(who: "Jane") }`,
        context: {},
      },
      {
        body: '{"data":{"sayHello":"Hello Jane"}}',
      }
    );
  });
  describe('allows defining options.rootValue', () => {
    const rootValue = {
      name: 'Luke',
    };
    // FIXME: need better test
    it('with an object', () => {
      return testCase(
        {
          query: 'query { helloRoot }',
          httpRequest: {
            method: 'GET',
          },
          context: {},
        },
        {
          body: '{"data":{"helloRoot":"Luke"}}',
        },
        { rootValue }
      );
    });
    it('with a function', () => {
      return testCase(
        {
          query: 'query { helloRoot }',
          httpRequest: {
            method: 'GET',
          },
          context: {},
        },
        {
          body: '{"data":{"helloRoot":"Luke"}}',
        },
        { rootValue: () => rootValue }
      );
    });
  });
  describe('errors on validation errors', () => {
    it('when there are unknown fields', () => {
      return testCase(
        {
          query: `query { xinchao, hola, hello }`,
          context: {},
        },
        {
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
      return testCase(
        {
          query: `query { hello }`,
          context: {},
        },
        {
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
      return testCase(
        {
          query: 'query helloWho($who: String!) { hello(who: $who) }',
          variables: {
            who: 12,
          },
          context: {},
        },
        {
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
      return testCase(
        {
          query: 'query { helloWorld ',
          context: {},
        },
        {
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
  it('catches error thrown in resolver function', async () => {
    return testCase(
      {
        query: 'query { throwMe }',
        context: {},
      },
      {
        body: (str) => {
          const {
            errors: [err],
          } = JSON.parse(str);
          assert.deepStrictEqual(err.message, 'weeeeee');
          return true;
        },
      }
    );
  });
});
