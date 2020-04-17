import { parseNodeRequest, resolveMaybePromise } from '../src/utils';
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
        .set('content-type', 'application/json')
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
  describe('resolveMaybePromise', () => {
    it('work with non-promise value', (done) => {
      const val = 1;
      resolveMaybePromise(val, (err, result) =>
        done(assert.deepStrictEqual(result, 1))
      );
    });
    it('work with promise value', (done) => {
      const val = Promise.resolve(1);
      resolveMaybePromise(val, (err, result) =>
        done(assert.deepStrictEqual(result, 1))
      );
    });
    it('errors on error', (done) => {
      const fn = async () => {
        throw new Error();
      };
      resolveMaybePromise(fn(), (err) => {
        done(assert(err));
      });
    });
  });
});
