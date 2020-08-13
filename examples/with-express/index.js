const express = require('express');
const { GraphQL, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const expressPlayground = require('graphql-playground-middleware-express')
  .default;
const { typeDefs, resolvers } = require('pokemon-graphql-schema');

// Polyfill fetch
global.fetch = require('node-fetch');

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const GQL = new GraphQL({ schema });

const app = express();

app.get('/playground', expressPlayground({ endpoint: '/graphql' }));
app.all(
  '/graphql',
  httpHandler(GQL, {
    context: (req) => ({ hello: 'world' }),
  })
);
app.use(express.static('public'));

app.listen(4000, () => {
  console.log('Running a GraphQL API server at http://localhost:4000/graphql');
});
