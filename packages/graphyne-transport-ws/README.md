# subscriptions-transport-ws for Graphyne

The GraphQL WebSocket server to facilitate GraphQL queries, mutations and subscriptions over WebSocket. Implements [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

This library is meant to use exclusively with [Graphyne](/)

## Install

```shell
npm i graphyne-transport-ws graphql
// or
yarn add graphyne-transport-ws graphql
```

## Usage

```javascript
const http = require('http');
const { GraphyneServer } = require('graphyne-server');
const { startSubscriptionServer } = require('graphyne-transport-ws);

// Create a GraphyneServer instance

const graphyne = new GraphyneServer(options);

const server = http.createServer(
  graphyne.createHandler()
);

// Hook it with graphyne-transport-ws

const wss = startSubscriptionServer({
  graphyne: graphyne, // Require an instance of Graphyne Server
  server: server, // Require an instance of HTTP Server
  path: '/graphql',
});

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
```

## API

`GraphyneWebsocketServer` extends `WebSocket.Server`from [`ws`](https://www.npmjs.com/package/ws) and thus inherits its [API](https://github.com/websockets/ws/blob/HEAD/doc/ws.md).

### startSubscriptionServer(options)

Create and return a server instance of `GraphyneWebsocketServer` **and** listen to incoming connections automatically. The accepted options are the same as [`ws` options](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#new-websocketserveroptions-callback), with the addition of

- `graphyne`: (required) The instance of Graphyne Server to hook into.
- `context`: An object or function called to creates a context shared across resolvers per connection. The function receives an object with the following:
  - `connectionParams`: Object that is sent from the client. See an example in [`apollo-link-ws`](https://www.apollographql.com/docs/react/data/subscriptions/#authentication-over-websocket)
  - `socket`: The [WebSocket connection](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#event-connection).
  - `request`: The incoming request.

A Node HTTP Server instance must be supplied to `options.server`. (Except if you use `noSever` mode)

## Framework integration

### [Express](https://github.com/expressjs/express)

The HTTP Server instance is returned after `app.listen` is called.

```javascript
app.use(
  graphyne.createHandler({ /* ... */ })
);
const server = app.listen(PORT);

startSubscriptionServer({
  server: server,
  graphyne: graphyne,
  // other options
})
```

### [Micro](https://github.com/zeit/micro)

You need to [use Micro programmatically](https://www.npmjs.com/package/micro#programmatic-use) for WebSocket support. `micro()` returns a HTTP Server instance.

```javascript
const server = micro(
  graphyne.createHandler({ /* ... */ })
);

startSubscriptionServer({
  server: server,
  graphyne: graphyne,
  // other options
});
```
