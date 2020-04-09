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
  context: () => ({ world: 'world' }),
  graphiql: {
    defaultQuery: 'query { hello }',
  },
});

graphyne.listen(4000, () => {
  console.log('Running a GraphQL API server at http://localhost:4000/graphql');
});
