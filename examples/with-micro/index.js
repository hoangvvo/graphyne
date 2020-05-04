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
  onResponse: async ({ headers, body, status }, req, res) => {
    for (const key in headers) res.setHeader(key, headers[key]);
    send(res, status, body);
  },
  onNoMatch: async (req, res) => {
    send(res, 404, 'not found');
  },
});

/**
 * This still works:
 * module.exports = graphyne.createHandler({
    path: '/graphql',
    playground: {
      path: '/playground',
    },
  }
 */
