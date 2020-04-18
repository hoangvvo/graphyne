const Koa = require('koa');
const { GraphyneServer } = require('graphyne-server');
const { schema } = require('../buildSchema');

const graphyne = new GraphyneServer({
  schema,
});

const app = new Koa();

app.use(
  graphyne.createHandler({
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
  })
);

app.listen(4001);
