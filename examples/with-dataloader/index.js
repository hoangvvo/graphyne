const http = require('http');
const { GraphyneServer } = require('graphyne-server');
const { makeExecutableSchema } = require('graphql-tools');
const DataLoader = require('dataloader');
const { getUsers } = require('./users');

function createLoaders() {
  return {
    users: new DataLoader(getUsers),
    // Add more models here
  };
}

const typeDefs = `
  type User {
    id: ID
    name: String
    age: Int
  }
  type Query {
    user(id: ID!): User
  }
`;
const resolvers = {
  User: {
    // https://medium.com/paypal-engineering/graphql-resolvers-best-practices-cd36fdbcef55#5284
    id: ({ id }, variables, { loaders }) =>
      loaders.users.load(id).then((user) => user && user.id),
    name: ({ id }, variables, { loaders }) =>
      loaders.users.load(id).then((user) => user && user.name),
    age: ({ id }, variables, { loaders }) =>
      loaders.users.load(id).then((user) => user && user.age),
  },
  Query: {
    user: (obj, variables) => ({ id: variables.id }),
  },
};

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const graphyne = new GraphyneServer({
  schema,
  context: () => ({
    // other contexts
    loaders: createLoaders(),
  }),
});

const server = http.createServer(graphyne.createHandler());

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
