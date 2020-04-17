import { renderGraphiQL } from '../src';
import { strict as assert } from 'assert';

describe('graphiql', () => {
  it('renders GraphiQL using renderGraphiQL', () => {
    const html = renderGraphiQL({ path: '/graphql' });
    assert.deepStrictEqual(typeof html, 'string');
  });
});
