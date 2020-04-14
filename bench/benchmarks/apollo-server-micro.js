const micro = require('micro');
const { ApolloServer } = require('apollo-server-micro');
const { schema } = require('../buildSchema');

const apolloServer = new ApolloServer({
  schema,
  uploads: false,
});

const server = micro(apolloServer.createHandler());

server.listen(4001);
