import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLSchema } from 'graphql';
import { strict as assert } from 'assert';
import { GraphyneServerBase } from '../src';

const schemaHello = makeExecutableSchema({
  typeDefs: `
    type Query {
      hello(who: String!): String
    }
  `,
  resolvers: {
    Query: {
      hello: (obj, args) => args.who,
    },
  },
});

describe('graphyne-core', () => {
  it('throws if initializing instance with no option', () => {
    assert.throws(() => {
      // @ts-ignore
      new GraphyneServer();
    });
  });
  it('throws if options.context is not a function or object', () => {
    assert.throws(() => {
      new GraphyneServerBase({
        // @ts-ignore
        context: 1,
        schema: schemaHello,
      });
    });
  });
  it('throws if schema is invalid', () => {
    assert.throws(() => {
      new GraphyneServerBase({
        // @ts-ignore
        schema: new GraphQLSchema({ directives: [null] }),
      });
    });
  });
  describe('options.cache', () => {
    it('throws if options.cache is not a number or boolean', () => {
      assert.doesNotThrow(() => {
        // TODO: Need test for actual behavior
        new GraphyneServerBase({
          // @ts-ignore
          cache: true,
          schema: schemaHello,
        });
        new GraphyneServerBase({
          // @ts-ignore
          cache: 12,
          schema: schemaHello,
        });
      });
      assert.throws(() => {
        new GraphyneServerBase({
          // @ts-ignore
          cache: {},
        });
      });
    });
  });
});
