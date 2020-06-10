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

const graphyne = new GraphyneServer({
  schema,
  context: () => ({ world: 'world' }),
});

function testSupertest(app) {
  return {
    graphql: () =>
      request(app)
        .post('/graphql')
        .set('content-type', 'application/json')
        .send({ query: '{hello}' })
        .expect(`{"data":{"hello":"Hello world!"}}`),
    playground: () =>
      request(app)
        .post('/playground')
        .then((res) => assert(res.text.includes('GraphQL Playground'))),
    route: () => request(app).get('/route').expect('ok'),
    fourOhFour: () => request(app).get('/404').expect(404).expect('not found'),
  };
}

describe('Integrations', () => {
  describe('express', () => {
    const app = require('express')();
    app
      .use(
        graphyne.createHandler({
          playground: true,
          onNoMatch: (req, res, next) => {
            next();
          },
        })
      )
      .get('/route', (req, res) => res.send('ok'));
    it('executes graphql', () => {
      return testSupertest(app).graphql();
    });
    it('renders playground', () => {
      return testSupertest(app).playground();
    });
    it('works with other routes', () => {
      return testSupertest(app).route();
    });
  });
  describe('micro', () => {
    const micro = require('micro');
    const server = micro(
      graphyne.createHandler({
        path: '/graphql',
        playground: {
          path: '/playground',
        },
        onResponse: ({ headers, body, status }, req, res) => {
          for (const key in headers) res.setHeader(key, headers[key]);
          micro.send(res, status, body);
        },
        onNoMatch: (req, res) => {
          micro.send(res, 404, 'not found');
        },
      })
    );
    it('executes graphql', () => {
      return testSupertest(server).graphql();
    });
    it('renders playground', () => {
      return testSupertest(server).playground();
    });
    it('works with onNoMatch', () => {
      return testSupertest(server).fourOhFour();
    });
  });
  describe('fastify', () => {
    const fastify = require('fastify')();
    fastify.use(
      graphyne.createHandler({
        playground: true,
        onNoMatch: (req, res, next) => {
          next();
        },
      })
    );
    fastify.get('/route', (request, reply) => {
      reply.send('ok');
    });
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
    it('renders playground', (done) => {
      fastify
        .inject()
        .get('/playground')
        .end((err, res) => {
          assert(res.payload.includes('GraphQL Playground'));
          done();
        });
    });
    it('works with other routes', (done) => {
      fastify
        .inject({
          payload: { query: '{hello}' },
        })
        .get('/route')
        .end((err, res) => {
          assert.strictEqual(res.payload, 'ok');
          done();
        });
    });
  });
  describe('koa', () => {
    const Koa = require('koa');
    const app = new Koa();
    app.use(
      graphyne.createHandler({
        playground: true,
        onRequest: ([ctx], done) => {
          done(ctx.req);
        },
        onResponse: ({ headers, body, status }, ctx) => {
          ctx.status = status;
          ctx.set(headers);
          ctx.body = body;
        },
        onNoMatch: (ctx) => {
          ctx.status = 404;
          ctx.body = 'not found';
        },
      })
    );
    let server;
    beforeEach(() => {
      server = app.listen();
    });
    afterEach(() => {
      server.close();
    });
    xit('executes graphql', () => {
      return testSupertest(server).graphql();
    });
    it('renders playground', () => {
      return testSupertest(server).playground();
    });
    it('works with other routes', () => {
      return testSupertest(server).fourOhFour();
    });
  });
  describe('aws lambda', () => {
    const handler = graphyne.createHandler({
      playground: true,
      onRequest: ([event, context, callback], done) => {
        const request = {
          path: event.path,
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
    const server = createServer((req, res) => {
      // We mock AWS Lambda-like environment
      const idx = req.url.indexOf('?');
      const pathname = idx !== -1 ? req.url.substring(0, idx) : req.url;
      const event = {
        path: pathname,
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
      return testSupertest(server).graphql();
    });
    it('renders playground', () => {
      return testSupertest(server).playground();
    });
  });
});
