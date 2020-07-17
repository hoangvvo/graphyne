const express = require('express');
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

const app = express();

app.all(
  '/graphql',
  httpHandler(graphyne, {
    context: (req) => ({ world: 'world' }),
  })
);

app.listen(4000, () => {
  console.log('Running a GraphQL API server at http://localhost:4000/graphql');
});
