import { makeExecutableSchema } from 'graphql-tools';
import { createServer } from 'http';
import { GraphQLSchema } from 'graphql';
import { strict as assert } from 'assert';
import { GraphyneServerBase, Config } from '../src';
import { parseNodeRequest, getGraphQLParams } from '../src/utils';
import request from 'supertest';
import querystring from 'querystring';

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
  const graphyne = new GraphyneServerBase({
    schema,
    ...options,
  });
  // This is a mini version of graphyne-server
  return createServer((req, res) => {
    parseNodeRequest(req, (err, parsedBody) => {
      const queryParams = querystring.parse(
        new URL(req.url as string, 'https://localhost:4000/').search.slice(1)
      );
      const { query, variables, operationName } = getGraphQLParams({
        // @ts-ignore
        queryParams: queryParams || {},
        body: parsedBody,
      });
      graphyne.runQuery(
        {
          query,
          context: {},
          variables,
          operationName,
          http: { request: req, response: res },
        },
        (err, { body, headers }) => {
          for (const key in headers) {
            // @ts-ignore
            res.setHeader(key, headers[key]);
          }
          res.end(body);
        }
      );
    });
  });
}

const schemaHello = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello(who: String!): String
      helloWorld: String
      helloRoot: String
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
      new GraphyneServer();
    });
  });
  it('throws if options.context is not a function or object', () => {
    assert.throws(() => {
      new GraphyneServerBase({
        // @ts-ignore
        context: 1,
        schema: schemaHello,
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
          schema: schemaHello,
        });
        new GraphyneServerBase({
          // @ts-ignore
          cache: 12,
          schema: schemaHello,
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

describe('HTTP Operations', () => {
  it('allows GET request', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .get('/graphql')
      .query({ query: 'query { helloWorld }' })
      .expect('{"data":{"helloWorld":"world"}}');
  });
  it('allows GET request with variables', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    const query = 'query helloWho($who: String!) { hello(who: $who) }';
    await request(server)
      .get('/graphql')
      .query({
        query,
        variables: '{"who": "John"}',
      })
      .expect('{"data":{"hello":"John"}}');
  });
  it('allows GET request with operation name', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .get('/graphql')
      .query({
        query: `query helloJohn { hello(who: "John") }
        query helloJane { hello(who: "Jane") }
        `,
        operationName: 'helloJane',
      })
      .expect('{"data":{"hello":"Jane"}}');
  });
  it('errors when sending a mutation via GET request', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .get('/graphql')
      .query({
        query: 'mutation sayHelloWho { sayHello(who: "Jane") }',
      })
      .expect(
        '{"errors":[{"message":"Operation mutation cannot be performed via a GET request"}]}'
      );
  });
  describe('allows defining options.rootValue', () => {
    const rootValue = {
      name: 'Luke',
    };
    // FIXME: need better test
    it('with an object', async () => {
      const server = createGQLServer({
        schema: schemaHello,
        rootValue,
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloRoot }' })
        .expect('{"data":{"helloRoot":"Luke"}}');
    });
    it('with a function', async () => {
      const server = createGQLServer({
        schema: schemaHello,
        rootValue: () => rootValue,
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloRoot }' })
        .expect('{"data":{"helloRoot":"Luke"}}');
    });
  });
  it('allow POST request of application/json', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .post('/graphql')
      .send({ query: '{ helloWorld }' })
      .expect('{"data":{"helloWorld":"world"}}');
  });
  it('allows POST request of application/graphql', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    // I may be misunderstanding this spec
    await request(server)
      .post('/graphql')
      .send(`query { helloWorld }`)
      .set('content-type', 'application/graphql')
      .expect('{"data":{"helloWorld":"world"}}');
  });
  it('allows POST request with variables', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .post('/graphql')
      .send({
        query: 'query helloWho($who: String!) { hello(who: $who) }',
        variables: '{"who": "Jane"}',
      })
      .expect('{"data":{"hello":"Jane"}}');
  });
  it('allows POST request with operation name', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .post('/graphql')
      .send({
        query: `query helloJohn { hello(who: "John") }
        query helloJane { hello(who: "Jane") }
        `,
        operationName: 'helloJane',
      })
      .expect('{"data":{"hello":"Jane"}}');
  });
  it('errors when missing operation name request', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .get('/graphql')
      .query({
        query: `query helloJohn { hello(who: "John") }
        query helloJane { hello(who: "Jane") }
        `,
      })
      .expect(
        '{"errors":[{"message":"Must provide operation name if query contains multiple operations."}]}'
      );
  });
  describe('errors on validation errors', () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    it('when there are unknown fields', async () => {
      const {
        body: { errors },
      } = await request(server)
        .get('/graphql')
        .query({ query: `query { xinchao, hola, hello }` });
      const [err1, err2] = errors;
      assert.deepStrictEqual(
        err1.message,
        `Cannot query field "xinchao" on type "Query".`
      );
      assert.deepStrictEqual(
        err2.message,
        `Cannot query field "hola" on type "Query".`
      );
    });
    it('when missing required arguments', async () => {
      const {
        body: { errors },
      } = await request(server)
        .get('/graphql')
        .query({ query: `query { hello }` });
      const [err] = errors;
      assert.deepStrictEqual(
        err.message,
        `Field "hello" argument "who" of type "String!" is required, but it was not provided.`
      );
    });
    it('when arguments have incorrect types', async () => {
      const {
        body: {
          errors: [err],
        },
      } = await request(server).post('/graphql').send({
        query: 'query helloWho($who: String!) { hello(who: $who) }',
        variables: '{"who": 12 }',
      });
      assert.deepStrictEqual(
        err.message,
        `Variable "$who" got invalid value 12; Expected type String; String cannot represent a non string value: 12`
      );
    });
  });
  it('catches error thrown in resolver function', async () => {
    const server = createGQLServer({
      typeDefs: `
        type Query {
          throwMe: String
        }
      `,
      resolvers: {
        Query: {
          throwMe: async () => {
            throw new Error('weeeeee');
          },
        },
      },
    });
    const {
      body: {
        errors: [{ message }],
      },
    } = await request(server)
      .post('/graphql')
      .send({ query: 'query { throwMe }' });
    assert.deepStrictEqual(message, 'weeeeee');
  });
});
