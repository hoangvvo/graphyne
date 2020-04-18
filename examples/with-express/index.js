const express = require('express');
const { GraphyneServer } = require('graphyne-server');
const { makeExecutableSchema } = require('graphql-tools');

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

const graphyne = new GraphyneServer({
  schema,
  context: (req, res) => ({ world: 'world' }),
});

const app = express();

app.use(
  graphyne.createHandler({
    path: '/graphql',
    onNoMatch: (req, res, next) => next(),
  })
);

app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
