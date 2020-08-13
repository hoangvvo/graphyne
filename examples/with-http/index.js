const http = require('http');
const { GraphQL, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { typeDefs, resolvers } = require('pokemon-graphql-schema');

global.fetch = require('node-fetch');

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const GQL = new GraphQL({ schema });

const server = http.createServer(
  httpHandler(GQL, {
    path: '/graphql',
    context: (req) => ({ hello: 'world' }),
  })
);

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
