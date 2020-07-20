import { Graphyne, handleRequest } from 'graphyne-worker';
import schema from './schema';

const graphyne = new Graphyne({ schema });

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
