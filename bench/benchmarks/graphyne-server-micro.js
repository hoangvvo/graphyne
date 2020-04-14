const micro = require('micro');
const { GraphyneServer } = require('graphyne-server');
const { schema } = require('../buildSchema');

const graphyne = new GraphyneServer({
  schema,
});

const server = micro(graphyne.createHandler());

server.listen(4001);
