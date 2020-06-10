import { parseNodeRequest, getGraphQLParams } from '../src/utils';
import { strict as assert } from 'assert';
import { createServer } from 'http';
import request from 'supertest';

describe('core utils', () => {
  describe('parseNodeRequest', () => {
    it('parse application/json properly', async () => {
      const server = createServer((req, res) => {
        parseNodeRequest(req, (err, parsedBody) => {
          res.end(JSON.stringify(parsedBody));
        });
      });
      await request(server)
        .post('/graphql')
        .send(JSON.stringify({ query: 'query { helloWorld }' }))
        .set('content-type', 'application/json ')
        .expect(JSON.stringify({ query: 'query { helloWorld }' }));
    });
    it('parse application/graphql properly', async () => {
      const server = createServer((req, res) => {
        parseNodeRequest(req, (err, parsedBody) => {
          res.end(JSON.stringify(parsedBody));
        });
      });
      await request(server)
        .post('/graphql')
        .send(`query { helloWorld }`)
        .set('content-type', 'application/graphql ')
        .expect('{"query":"query { helloWorld }"}');
    });
    it('returns if req.body has been parsed', (done) => {
      const req = { body: { query: 1 } };
      // @ts-ignore
      parseNodeRequest(req, (err, parsedBody) => {
        done(assert.deepStrictEqual(parsedBody, req.body));
      });
    });
    it('treat req.body as rawBody if it is string (and skip reading)', (done) => {
      const req = {
        body: '{ "query": 1 }',
        headers: { 'content-type': 'application/json' },
        on: () => {
          throw new Error('Do not call me!');
        },
      };
      // @ts-ignore
      parseNodeRequest(req, (err, parsedBody) => {
        done(assert.deepStrictEqual(parsedBody, JSON.parse(req.body)));
      });
    });
    it('skip reading from req if it is not IncomingMessage', (done) => {
      const req = { headers: { 'content-type': 'meh' } };
      // @ts-ignore
      parseNodeRequest(req, (err, parsedBody) => {
        done(assert.deepStrictEqual(parsedBody, null));
      });
    });
    it('errors body is malformed', async () => {
      const server = createServer((req, res) => {
        parseNodeRequest(req, (err, parsedBody) => {
          if (err) res.statusCode = err.status;
          res.end(JSON.stringify(parsedBody));
        });
      });
      await request(server)
        .post('/graphql')
        .send(`query { helloWorld`)
        .set('content-type', 'application/json; t')
        .expect(400);
    });
    describe('do not parse body', () => {
      it('with empty content type', async () => {
        const server = createServer((req, res) => {
          parseNodeRequest(req, (err, parsedBody) => {
            res.end(String(parsedBody === null));
          });
        });
        await request(server)
          .post('/graphql')
          .send(`query { helloWorld }`)
          .set('content-type', '')
          .expect('true');
      });
      it('with invalid content-type', async () => {
        const server = createServer((req, res) => {
          parseNodeRequest(req, (err, parsedBody) => {
            res.end(String(parsedBody === null));
          });
        });
        await request(server)
          .post('/graphql')
          .send(`query { helloWorld }`)
          .set('content-type', 'wat')
          .expect('true');
      });
    });
  });

  describe('getGraphQLParams', () => {
    it('works with queryParams', () => {
      const { query, variables } = getGraphQLParams({
        queryParams: { query: 'ok', variables: `{ "ok": "no" }` },
        body: null,
      });
      assert.deepStrictEqual(query, 'ok');
      assert.deepStrictEqual(variables?.ok, 'no');
    });
    it('works with body', () => {
      const { query, variables } = getGraphQLParams({
        queryParams: {},
        body: { query: 'ok', variables: { ok: 'no' } },
      });
      assert.deepStrictEqual(query, 'ok');
      assert.deepStrictEqual(variables?.ok, 'no');
    });
    it('works retrieving from both queryParams and body', () => {
      const { query, variables } = getGraphQLParams({
        queryParams: { query: 'ok' },
        body: { variables: { ok: 'no' } },
      });
      assert.deepStrictEqual(query, 'ok');
      assert.deepStrictEqual(variables?.ok, 'no');
    });
  });
});
