const fastify = require('fastify')();
const { ApolloServer } = require('apollo-server-fastify');
const { schema } = require('../buildSchema');

const server = new ApolloServer({
  schema,
  uploads: false,
});

(async function () {
  fastify.register(server.createHandler());
  await fastify.listen(4001);
})();
