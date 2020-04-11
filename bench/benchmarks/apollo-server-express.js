const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const { schema } = require('../buildSchema');

const server = new ApolloServer({
  schema,
  uploads: false,
});

const app = express();
server.applyMiddleware({ app });

app.listen(4001);
