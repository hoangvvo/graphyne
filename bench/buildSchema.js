// Adapted from https://github.com/benawad/node-graphql-benchmarks
const { makeExecutableSchema } = require('graphql-tools');
const md5 = require('md5');
const { gql } = require('apollo-server-express');
const faker = require('faker');
faker.seed(4321);

function genData() {
  const authors = [];
  for (let i = 0; i < 20; i++) {
    const books = [];

    for (let k = 0; k < 3; k++) {
      books.push({
        id: faker.random.uuid(),
        name: faker.internet.domainName(),
        numPages: faker.random.number(),
      });
    }

    authors.push({
      id: faker.random.uuid(),
      name: faker.name.findName(),
      company: faker.company.bs(),
      books,
    });
  }

  return authors;
}

const typeDefs = gql`
  type Author {
    id: ID!
    name: String!
    md5: String!
    company: String!
    books: [Book!]!
  }
  type Book {
    id: ID!
    name: String!
    numPages: Int!
  }
  type Query {
    authors: [Author!]!
  }
`;

const data = genData();

const resolvers = {
  Author: {
    md5: (parent) => md5(parent.name),
  },
  Query: {
    authors: () => {
      return data;
    },
  },
};

module.exports.schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
