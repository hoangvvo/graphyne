const fastify = require('fastify')({
  logger: true,
});
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
  context: (request, reply) => ({ world: 'world' }),
  onResponse: ({ status, body, headers }, request, reply) => {
    reply.code(status).headers(headers).send(body);
  },
});

fastify.decorateRequest('method', {
  getter() {
    return this.raw.method;
  },
});

fastify.get('/graphql', graphyne.createHandler());

fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
