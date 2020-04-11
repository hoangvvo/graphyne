const express = require('express');
const { schema } = require('../buildSchema');
const graphqlHTTP = require('express-graphql');

const app = express();

app.use(
  '/graphql',
  graphqlHTTP({
    schema,
  })
);

app.listen(4001);
