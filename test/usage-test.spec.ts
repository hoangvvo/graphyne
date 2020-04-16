import { makeExecutableSchema } from 'graphql-tools';
import { GraphQLSchema } from 'graphql';
import { strict as assert } from 'assert';
import { GraphyneServer } from '../packages/graphyne-server/lib';

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
      new GraphyneServer({
        // @ts-ignore
        context: 1,
        schema: schemaHello,
      });
    });
  });
  it('throws if schema is invalid', () => {
    assert.throws(() => {
      new GraphyneServer({
        // @ts-ignore
        schema: new GraphQLSchema({ directives: [null] }),
      });
    });
  });
  describe('options.cache', () => {
    it('throws if options.cache is not a number or boolean', () => {
      assert.doesNotThrow(() => {
        // TODO: Need test for actual behavior
        new GraphyneServer({
          // @ts-ignore
          cache: true,
          schema: schemaHello,
        });
        new GraphyneServer({
          // @ts-ignore
          cache: 12,
          schema: schemaHello,
        });
      });
      assert.throws(() => {
        new GraphyneServer({
          // @ts-ignore
          cache: {},
        });
      });
    });
  });
});
