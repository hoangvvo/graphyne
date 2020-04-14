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
  context: (req, res) => ({ world: 'world' }),
});

fastify.use(
  graphyne.createHandler({
    path: '/graphql',
    graphiql: {
      path: '/___graphql',
      defaultQuery: 'query { hello }',
    },
    onNoMatch: (req, res, next) => next(),
  })
);

fastify.listen(3000, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
