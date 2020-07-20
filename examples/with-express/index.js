const express = require('express');
const { Graphyne, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const expressPlayground = require('graphql-playground-middleware-express')
  .default;
const { typeDefs, resolvers } = require('../common/pokemon-graphql');

// Polyfill fetch
global.fetch = require('node-fetch');

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const graphyne = new Graphyne({ schema });

const app = express();

app.get('/playground', expressPlayground({ endpoint: '/graphql' }));
app.all(
  '/graphql',
  httpHandler(graphyne, {
    context: (req) => ({ hello: 'world' }),
  })
);

app.listen(4000, () => {
  console.log('Running a GraphQL API server at http://localhost:4000/graphql');
});
