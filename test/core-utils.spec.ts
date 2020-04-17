import { parseNodeRequest } from '../packages/graphyne-core/src/utils';
import { strict as assert } from 'assert';

describe('core utils', () => {
  it('parseNodeRequest should not parse if req.body has been parsed', (done) => {
    const req = { body: { query: 1 } };
    // @ts-ignore
    parseNodeRequest(req, (err, parsedBody) => {
      done(assert.deepStrictEqual(parsedBody, req.body));
    });
  });
});
