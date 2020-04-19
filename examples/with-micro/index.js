const { send } = require('micro');
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

module.exports = graphyne.createHandler({
  path: '/graphql',
  playground: {
    path: '/playground',
  },
  onNoMatch: async (req, res) => {
    const statusCode = 400;
    send(res, statusCode, 'not found');
  },
});
