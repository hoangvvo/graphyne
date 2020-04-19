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
  context: () => ({ world: 'world' }),
});

const app = new Koa();

app.use(
  graphyne.createHandler({
    path: '/graphql',
    playground: {
      path: '/playground',
    },
    integrationFn: (ctx) => {
      return {
        request: ctx.req,
        response: ctx.res,
        sendResponse: ({ headers, body, status }) => {
          ctx.status = status;
          ctx.set(headers);
          ctx.body = body;
        },
      };
    },
    onNoMatch: (ctx) => {
      ctx.status = 404;
      ctx.body = 'not found';
    },
  })
);

app.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
