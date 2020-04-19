import { renderPlayground } from '../src';
import { strict as assert } from 'assert';

describe('playground', () => {
  it('renders GraphQL Playground using renderPlayground', () => {
    const html = renderPlayground({
      endpoint: '/graphql',
      subscriptionEndpoint: '/',
    });
    assert.deepStrictEqual(typeof html, 'string');
  });
});
