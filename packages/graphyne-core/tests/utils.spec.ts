import { parseNodeRequest, getGraphQLParams } from '../src/utils';
import { strict as assert } from 'assert';
import { createServer } from 'http';
import request from 'supertest';

describe('core utils', () => {
  describe('parseNodeRequest', () => {
    it('not parse if req.body has been parsed', (done) => {
      const req = { body: { query: 1 } };
      // @ts-ignore
      parseNodeRequest(req, (err, parsedBody) => {
        done(assert.deepStrictEqual(parsedBody, req.body));
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
    describe('do not parse POST body', () => {
      it('with empty content type', async () => {
        const server = createServer((req, res) => {
          parseNodeRequest(req, (err, parsedBody) => {
            res.end(JSON.stringify(parsedBody));
          });
        });
        await request(server)
          .post('/graphql')
          .send(`query { helloWorld }`)
          .set('content-type', '')
          .expect('{}');
      });
      it('with invalid content-type', async () => {
        const server = createServer((req, res) => {
          parseNodeRequest(req, (err, parsedBody) => {
            res.end(JSON.stringify(parsedBody));
          });
        });
        await request(server)
          .post('/graphql')
          .send(`query { helloWorld }`)
          .set('content-type', 'wat')
          .expect('{}');
      });
    });
  });
  describe('getGraphQLParams', () => {
    it('works with queryParams', () => {
      const { query, variables } = getGraphQLParams({
        queryParams: { query: 'ok', variables: `{ "ok": "no" }` },
        body: {},
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
    it('see body as query if is string', () => {
      const { query } = getGraphQLParams({
        queryParams: {},
        body: `query { hello }`,
      });
      assert.deepStrictEqual(query, 'query { hello }');
    });
  });
});
