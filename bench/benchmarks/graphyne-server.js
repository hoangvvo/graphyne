const http = require('http');
const { GraphyneServer } = require('graphyne-server');
const { schema } = require('../buildSchema');

const graphyne = new GraphyneServer({
  schema,
});

const server = http.createServer(graphyne.createHandler());

server.listen(4001);
