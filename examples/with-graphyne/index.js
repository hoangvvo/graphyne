const http = require('http');
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
});

const server = http.createServer(
  graphyne.createHandler({
    path: '/graphql',
    graphiql: {
      // path is not set, default to /___graphql
      defaultQuery: 'query { hello }',
    },
  })
);

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/api`);
});
