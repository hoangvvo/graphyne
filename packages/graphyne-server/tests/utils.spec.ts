import { parseNodeRequest } from '../src/utils';
import { strict as assert } from 'assert';
import { createServer } from 'http';
import request from 'supertest';

describe('core utils', () => {
  describe('parseNodeRequest', () => {
    it('returns if req.body has been parsed', (done) => {
      const req = { body: { query: 1 }, headers: {}, method: '' };
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
        method: '',
      };
      parseNodeRequest(req, (err, parsedBody) => {
        done(assert.deepStrictEqual(parsedBody, JSON.parse(req.body)));
      });
    });
    it('skip reading from req if it is not IncomingMessage', (done) => {
      const req = { headers: { 'content-type': 'meh' }, method: '' };
      parseNodeRequest(req, (err, parsedBody) => {
        done(assert.deepStrictEqual(parsedBody, null));
      });
    });
    describe('errors body is malformed', async () => {
      await request(
        createServer((req, res) => {
          parseNodeRequest(req, (err, parsedBody) => {
            if (err) res.statusCode = err.status;
            res.end(JSON.stringify(parsedBody));
          });
        })
      )
        .post('/graphql')
        .send(`{"query":"{ helloWorld }`)
        .set('content-type', 'application/json')
        .expect(400);

      await request(
        createServer((req, res) => {
          (req as any).body = `{"query":"{ helloWorld }`;
          parseNodeRequest(req, (err, parsedBody) => {
            if (err) res.statusCode = err.status;
            res.end(JSON.stringify(parsedBody));
          });
        })
      )
        .post('/graphql')
        .send()
        .set('content-type', 'application/json')
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
    });
  });
});
