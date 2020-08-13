import { GraphQL, handleRequest } from 'graphyne-worker';
import { typeDefs, resolvers } from 'pokemon-graphql-schema';
import { makeExecutableSchema } from '@graphql-tools/schema';

const schema = makeExecutableSchema({ typeDefs, resolvers });
const GQL = new GraphQL({ schema });

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
      handleRequest(GQL, event.request, {
        context: () => ({ hello: 'world' }),
      })
    );
});
