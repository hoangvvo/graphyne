const express = require('express');
const { GraphQL, httpHandler } = require('graphyne-server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const DataLoader = require('dataloader');
const { getBatchUsers } = require('./users');

function createLoaders() {
  return {
    users: new DataLoader(getBatchUsers),
    // Add more models here
  };
}

const typeDefs = `
  type User {
    id: ID!
    name: String!
    age: Int!
    friends: [User!]
  }
  type Query {
    user(id: ID!): User
  }
`;

const resolvers = {
  User: {
    friends: (parent) => {
      return context.loaders.users.loadMany(parent.friends);
    },
  },
  Query: {
    user: (obj, variables, context) => {
      return context.loaders.users.load(variables.id);
    },
  },
};

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const GQL = new GraphQL({ schema });

const app = express();

app.all(
  '/graphql',
  httpHandler(GQL, {
    context: (req) => ({
      // other contexts
      loaders: createLoaders(),
    }),
  })
);

app.listen(4000, () => {
  console.log('Running a GraphQL API server at http://localhost:4000/graphql');
});
