import { makeExecutableSchema } from 'graphql-tools';
import request from 'supertest';
import { strict as assert } from 'assert';
import { createGQLServer } from './utils';

const schemaHello = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello(who: String!): String
      helloWorld: String
      helloMe: String
      helloRoot: String
    }
    type Mutation {
      sayHello(who: String!): String
      sayByeAll: String
    }
  `,
  resolvers: {
    Query: {
      hello: (obj, args) => args.who,
      helloWorld: () => 'world',
      helloMe: (obj, args, context) => context.me,
      helloRoot: ({ name }) => name,
    },
    Mutation: {
      sayHello: (obj, args) => 'Hello ' + args.who,
      sayByeAll: () => 'Bye, all!',
    },
  },
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
  describe('allows defining options.context', () => {
    it('with an object', async () => {
      const server = createGQLServer({
        schema: schemaHello,
        context: { me: 'hoang' },
      });
      await request(server)
        .get('/graphql')
        .query({ query: 'query { helloMe }' })
        .expect('{"data":{"helloMe":"hoang"}}');
    });
    it('with a function', async () => {
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
  it('do not parse POST body with empty/unknown content-type', async () => {
    const server = createGQLServer({
      schema: schemaHello,
    });
    await request(server)
      .post('/graphql')
      .send(`query { helloWorld }`)
      .set('content-type', '')
      .expect('{"errors":[{"message":"Must provide query string."}]}');
    await request(server)
      .post('/graphql')
      .send(`query { helloWorld }`)
      .set('content-type', 'wat')
      .expect('{"errors":[{"message":"Must provide query string."}]}');
  });
});
