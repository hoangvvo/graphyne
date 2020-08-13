const http = require('http');
const { GraphQL, httpHandler } = require('graphyne-server');
const { schema } = require('./schema');

const GQL = new GraphQL({
  schema: schema(),
});

const server = http.createServer(httpHandler(GQL));

server.listen(4001);
