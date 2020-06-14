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
  onResponse: async ({ headers, body, status }, req, res) => {
    for (const key in headers) res.setHeader(key, headers[key]);
    send(res, status, body);
  },
});

/**
 * This still works without onResponse:
  const graphyne = new GraphyneServer({
    schema,
    context: (req, res) => ({ world: 'world' }),
  });
 */

module.exports = graphyne.createHandler();
