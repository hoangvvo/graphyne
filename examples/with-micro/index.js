const { GraphQL, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs, resolvers } = require('pokemon-graphql-schema');

// Polyfill fetch
global.fetch = require('node-fetch');

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const GQL = new GraphQL({ schema });

module.exports = httpHandler(GQL, {
  context: (req) => ({ hello: 'world' }),
  path: '/graphql',
});
