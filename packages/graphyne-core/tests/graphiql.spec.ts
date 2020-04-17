import { renderGraphiQL } from '../src';
import { strict as assert } from 'assert';

describe('graphiql', () => {
  it('renders GraphiQL using renderGraphiQL', () => {
    const html = renderGraphiQL({ path: '/graphql' });
    assert.deepStrictEqual(typeof html, 'string');
  });
  it('escape HTML in GraphiQL default query', () => {
    const html = renderGraphiQL({
      path: '/',
      defaultQuery: `</script><script>alert(1)</script>`,
    });
    assert(!html.includes('</script><script>alert(1)</script>'));
  });
});
