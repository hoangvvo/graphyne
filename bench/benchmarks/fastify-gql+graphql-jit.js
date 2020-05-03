const Fastify = require('fastify');
const GQL = require('fastify-gql');
const { schema } = require('../buildSchema');

const app = Fastify();

app.register(GQL, {
  schema,
  jit: 1,
});

app.listen(4001);
