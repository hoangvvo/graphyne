const fastify = require('fastify')();
const { GraphyneServer } = require('graphyne-server');
const { schema } = require('../buildSchema');

const graphyne = new GraphyneServer({
  schema,
});

fastify.use(
  graphyne.createHandler({
    onNoMatch: (req, res, next) => {
      next();
    },
  })
);

fastify.listen(4001);
