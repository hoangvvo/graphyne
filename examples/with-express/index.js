const express = require('express');
const { GraphyneServer } = require('graphyne-express');
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
  context: () => ({ world: 'world' }),
});

const app = express();
app.all('/graphql', graphyne.createHandler());
// Use GraphiQL
app.get(
  '/___graphql',
  graphyne.createHandler({
    path: '/graphql', // This must be set for graphiql to work
    graphiql: {
      defaultQuery: 'query { hello }',
    },
  })
);
app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
