const http = require('http');
const { Graphyne, httpHandler } = require('graphyne-server');
const { schema } = require('./schema');

const graphyne = new Graphyne({
  schema: schema(),
});

const server = http.createServer(httpHandler(graphyne));

server.listen(4001);
