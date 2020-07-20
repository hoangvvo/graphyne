import { Graphyne, handleRequest } from 'graphyne-worker';
import { typeDefs, resolvers } from 'pokemon-graphql-schema';
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({ typeDefs, resolvers });
const graphyne = new Graphyne({ schema });

addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim()); // Become available to all pages
});

// Execution via network
addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/graphql')
    return event.respondWith(
      handleRequest(graphyne, event.request, {
        context: () => ({ hello: 'world' }),
      })
    );
});

// Execution via postMessage
addEventListener('message', (ev) => {
  graphyne
    .graphql({
      source: ev.data.query,
      variableValues: ev.data.variables,
      contextValue: { hello: 'world' },
    })
    .then((result) => {
      ev.source.postMessage(result);
    });
});
