const { Graphyne, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');

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

const graphyne = new Graphyne({ schema });

module.exports = httpHandler(graphyne, {
  context: (req) => ({ world: 'world' }),
  path: '/graphql',
});
