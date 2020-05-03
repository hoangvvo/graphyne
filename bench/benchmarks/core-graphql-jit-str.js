const { createServer } = require('http');
const { parse } = require('graphql');
const { compileQuery } = require('graphql-jit');
const { schema } = require('../buildSchema');

const cache = {};

createServer(function (req, res) {
  let payload = '';

  req.on('data', (chunk) => {
    payload += chunk.toString();
  });

  req.on('end', async () => {
    const { query } = JSON.parse(payload);
    cache[query] = cache[query] || compileQuery(schema, parse(query));
    const result = await cache[query].query();
    res.end(JSON.stringify(result));
  });
}).listen(4001);
