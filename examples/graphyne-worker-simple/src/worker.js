import { GraphyneWorker } from 'graphyne-worker';
import { makeExecutableSchema } from 'graphql-tools';

const typeDefs = `
  type Query {
    hello: String
  }
`;
const resolvers = {
  Query: {
    hello: (obj, variables, context) => `Hello ${context.world}!`,
  },
};

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const graphyne = new GraphyneWorker({
  schema,
  context: () => ({ world: 'world' }),
  path: '/graphql',
  playground: {
    path: '/playground',
  },
});

global.addEventListener('fetch', graphyne.createHandler());
