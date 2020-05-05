const http = require('http');
const { GraphyneServer } = require('graphyne-server');
const { schema } = require('./schema');

const graphyne = new GraphyneServer({
  schema: schema(),
});

const server = http.createServer(graphyne.createHandler());

server.listen(4001);
