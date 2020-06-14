import { GraphyneServer } from '../src';
import { makeExecutableSchema } from 'graphql-tools';
import { strict as assert } from 'assert';
import request from 'supertest';
import { createServer } from 'http';

const typeDefs = `
  type Query {
    hello: String
  }
`;
const resolvers = {
  Query: {
    hello: (obj, variables, context) => `Hello ${context.world}!`,
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

function testSupertest(app) {
  return request(app)
    .post('/graphql')
    .set('content-type', 'application/json')
    .send({ query: '{hello}' })
    .expect(`{"data":{"hello":"Hello world!"}}`);
}

describe('Integrations', () => {
  describe('express', () => {
    const app = require('express')();
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
    });
    app.all('/graphql', graphyne.createHandler());
    it('executes graphql', () => {
      return testSupertest(app);
    });
  });
  describe('micro', () => {
    const micro = require('micro');
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
      onResponse: ({ headers, body, status }, req, res) => {
        for (const key in headers) res.setHeader(key, headers[key]);
        micro.send(res, status, body);
      },
    });
    const server = micro(graphyne.createHandler());
    it('executes graphql', () => {
      return testSupertest(server);
    });
  });
  describe('fastify', () => {
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
      onResponse: ({ status, body, headers }, request, reply) => {
        reply.code(status).headers(headers).send(body);
      },
    });
    const fastify = require('fastify')();
    fastify.decorateRequest('method', {
      getter() {
        return this.raw.method;
      },
    });
    fastify.post('/graphql', graphyne.createHandler());
    it('executes graphql', (done) => {
      fastify.inject(
        {
          url: '/graphql',
          payload: { query: '{hello}' },
          method: 'POST',
        },
        (err, res) => {
          assert.strictEqual(res.payload, `{"data":{"hello":"Hello world!"}}`);
          done();
        }
      );
    });
  });
  describe('aws lambda', () => {
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
      onRequest: ([event, context, callback], done) => {
        const request = {
          query: event.queryStringParameters,
          headers: event.headers,
          method: event.httpMethod,
          body: event.body ? JSON.parse(event.body) : null,
        };
        done(request);
      },
      onResponse: ({ status, body, headers }, event, context, callback) => {
        callback(null, {
          body,
          headers,
          statusCode: status,
        });
      },
    });
    const handler = graphyne.createHandler();
    const server = createServer((req, res) => {
      // We mock AWS Lambda-like environment
      const event = {
        // We force the followings
        queryStringParameters: {
          query: 'query { hello }',
        },
        headers: {},
        httpMethod: 'GET',
      };
      function callback(err, { body, headers, statusCode }) {
        res.writeHead(statusCode, headers).end(body);
      }
      handler(event, {}, callback);
    });
    it('executes graphql', () => {
      return testSupertest(server);
    });
  });
});
