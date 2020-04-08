const express = require('express');
const bodyParser = require('body-parser');
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
app.use(bodyParser.json());
app.use('/graphql', graphyne.createHandler());
app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
