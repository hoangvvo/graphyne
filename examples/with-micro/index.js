const { Graphyne, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs, resolvers } = require('pokemon-graphql-schema');

// Polyfill fetch
global.fetch = require('node-fetch');

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const graphyne = new Graphyne({ schema });

module.exports = httpHandler(graphyne, {
  context: (req) => ({ hello: 'world' }),
  path: '/graphql',
});
