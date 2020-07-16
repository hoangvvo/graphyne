import { getGraphQLParams, parseBodyByContentType } from '../src/utils';
import { strict as assert } from 'assert';

describe('graphyne-core/utils: parseBodyByContentType', () => {
  it('parses application/json properly', () => {
    assert.deepStrictEqual(
      parseBodyByContentType(
        JSON.stringify({ query: 'query { helloWorld }' }),
        'application/json '
      ),
      { query: 'query { helloWorld }' }
    );
  });
  it('parses application/graphql properly', () => {
    assert.deepStrictEqual(
      parseBodyByContentType('query { helloWorld }', 'application/graphql; '),
      { query: 'query { helloWorld }' }
    );
  });
  it('does not parse other content types', () => {
    assert.deepStrictEqual(
      parseBodyByContentType('query { helloWorld }', '???'),
      null
    );
  });
});
describe('graphyne-core/utils: getGraphQLParams', () => {
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
