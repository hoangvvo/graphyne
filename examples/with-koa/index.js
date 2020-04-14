const Koa = require('koa');
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

const app = new Koa();

app.use(
  graphyne.createHandler({
    path: '/graphql',
    graphiql: {
      path: '/___graphql',
      defaultQuery: 'query { hello }',
    },
    integrationFn: (ctx, next) => {
      // https://github.com/koajs/koa/blob/master/lib/context.js#L54
      return {
        request: ctx.req,
        response: ctx.res,
      };
    },
  })
);

app.listen(3000);
console.log('Running a GraphQL API server at http://localhost:3000/graphql');
