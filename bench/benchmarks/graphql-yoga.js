const { GraphQLServer } = require('graphql-yoga');
const { schema } = require('../buildSchema');

const server = new GraphQLServer({ schema });

server.start({ port: 4001, endpoint: '/graphql' });
