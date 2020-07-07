import { GraphyneServer } from '../src';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { strict as assert } from 'assert';
import request from 'supertest';
import { createServer } from 'http';
// @ts-ignore
import express from 'express';
// @ts-ignore
import micro from 'micro';
import fastify from 'fastify';

const typeDefs = `
  type Query {
    hello: String
  }
`;
const resolvers = {
  Query: {
    // @ts-ignore
    hello: (obj, variables, context) => `Hello ${context.world}!`,
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

function testSupertest(app: any) {
  return request(app)
    .post('/graphql')
    .set('content-type', 'application/json')
    .send({ query: '{hello}' })
    .expect(`{"data":{"hello":"Hello world!"}}`);
}

describe('Integrations', () => {
  it('express', () => {
    const app = express();
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
    });
    app.all('/graphql', graphyne.createHandler());
    return testSupertest(app);
  });
  it('micro', () => {
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
      onResponse: ({ headers, body, status }, req, res) => {
        for (const key in headers) res.setHeader(key, headers[key]);
        micro.send(res, status, body);
      },
    });
    const server = micro(graphyne.createHandler());
    return testSupertest(server);
  });
  it('fastify', (done) => {
    const graphyne = new GraphyneServer({
      schema,
      context: () => ({ world: 'world' }),
      onResponse: ({ status, body, headers }, request, reply) => {
        reply.code(status).headers(headers).send(body);
      },
    });
    const app = fastify();
    app.decorateRequest('method', {
      getter() {
        return this.raw.method;
      },
    });
    app.post('/graphql', graphyne.createHandler());
    app.inject(
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
  it('aws lambda', () => {
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
      function callback(err: any, { body, headers, statusCode }: any) {
        res.writeHead(statusCode, headers).end(body);
      }
      handler(event, {}, callback);
    });
    return testSupertest(server);
  });
});
