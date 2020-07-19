import { Graphyne, handleRequest } from 'graphyne-worker';
import { makeExecutableSchema } from '@graphql-tools/schema';

const typeDefs = `
  type Query {
    hello: String
  }
`;
const resolvers = {
  Query: {
    hello: (obj, variables, context) => `Hello ${context.world}!`,
  },
};

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const graphyne = new Graphyne({ schema });

// Execution via network
addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/graphql')
    return event.respondWith(
      handleRequest(graphyne, event.request, {
        context: () => ({ world: 'world' }),
      })
    );
});

// Execution via postMessage
addEventListener('message', ev => {
  graphyne
    .graphql({
      source: ev.data.query,
      contextValue: { world: "world" },
    })
    .then((result) => {
      ev.source.postMessage(result);
    });
})