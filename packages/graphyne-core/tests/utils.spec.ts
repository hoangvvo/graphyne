import { getGraphQLParams, parseBodyByContentType } from '../src/utils';
import { strict as assert } from 'assert';

describe('utils', () => {
  describe('parseBodyByContentType', () => {
    it('parse application/json properly', () => {
      assert.deepStrictEqual(
        parseBodyByContentType(
          JSON.stringify({ query: 'query { helloWorld }' }),
          'application/json '
        ),
        { query: 'query { helloWorld }' }
      );
    });
    it('parse application/graphql properly', () => {
      assert.deepStrictEqual(
        parseBodyByContentType('query { helloWorld }', 'application/graphql; '),
        { query: 'query { helloWorld }' }
      );
    });
    it('do not parse other content types', () => {
      assert.deepStrictEqual(
        parseBodyByContentType('query { helloWorld }', '???'),
        null
      );
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
