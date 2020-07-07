# GraphQL Subscriptions over WebSocket for Graphyne

[![npm](https://badgen.net/npm/v/graphyne-ws)](https://www.npmjs.com/package/graphyne-ws)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

WebSocket support for [`graphyne-server`](/packages/graphyne-server) implementing [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md). A package of [Graphyne](/).

## Install

Install `graphyne-ws` to use `Graphyne` with WebSocket and [`graphql-subscriptions`](https://github.com/apollographql/graphql-subscriptions) to implement PubSub Subcriptions system.

```shell
npm i graphyne-ws graphql-subscriptions graphql
// or
yarn add graphyne-ws graphql-subscriptions graphql
```

## Usage

[Example](/examples/with-graphql-subscriptions)

Creating an instance of `GraphyneWebSocketServer` using `startSubscriptionServer` function.

```javascript
const http = require('http');
const { GraphyneServer } = require('graphyne-server');
const { startSubscriptionServer } = require('graphyne-ws');

// Create a GraphyneServer instance
const graphyne = new GraphyneServer(options);

const server = http.createServer(graphyne.createHandler());

// Hook it with graphyne-ws
const wss = startSubscriptionServer({
  graphyne: graphyne, // Require an instance of Graphyne Server
  server: server, // Require an instance of HTTP Server
  path: '/graphql', // The ws path to listen to
});

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
```

To learn how to create a subscription as well as using different pubsub implementations (like Redis), see [graphql-subscriptions documentation](https://github.com/apollographql/graphql-subscriptions#getting-started-with-your-first-subscription).

## API

`GraphyneWebSocketServer` extends `WebSocket.Server`from [`ws`](https://www.npmjs.com/package/ws) and thus inherits its [API](https://github.com/websockets/ws/blob/HEAD/doc/ws.md).

### startSubscriptionServer(options)

Create an instance of `GraphyneWebSocketServer` **and** listen to incoming connections automatically. The accepted options are the same as [`ws` options](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#new-websocketserveroptions-callback), with the additions of:

- `graphyne`: (required) The instance of Graphyne Server to hook into.
- `server`: (required) The Node.js HTTP/S server to listen to. No server mode is not suppported. (This is part of [`ws` options](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#new-websocketserveroptions-callback))
- `context`: An object or function called to creates a context shared across resolvers per connection. The function receives an object with the following:
  - `connectionParams`: Object that is sent from the client. See an example in [`apollo-link-ws`](https://www.apollographql.com/docs/react/data/subscriptions/#authentication-over-websocket)
  - `socket`: The [WebSocket connection](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#event-connection).
  - `request`: The incoming request.
- `onGraphyneWebSocketConnection`: A function to call whenever a `GraphyneWebSocketConnection` is created. The only argument is the `GraphyneWebSocketConnection` instance.

### `GraphyneWebSocketConnection`

An instance of `GraphyneWebSocketConnection` extends `EventEmitter`.

**WARNING: The following events are still experimental and may be changed at any time in the future!**

It emits on every message with the event being one of the [Client -> Server message types](src/messageTypes.ts) **after finished proccessing (connection acknowledge/subscription started or stopped/connection terminated)**. Below are expected events:

```javascript
import {
  startSubscriptionServer,
  GQL_CONNECTION_INIT,
  GQL_START,
  GQL_STOP,
  GQL_CONNECTION_TERMINATE,
} from "graphyne-ws";

startSubscriptionServer({
  onGraphyneWebSocketConnection: (connection) => {
    // The following are emitted by GraphyneWebSocketConnection
    connection.on(GQL_CONNECTION_INIT, (connectionParams) => {
      // optional parameters that the client specifies in connectionParams
    });
    connection.on(GQL_START, (id, payload) => {
      // id is the GraphQL operation ID
      // payload is the GQL payload with `query`, `variables`, and `operationName`.
    });
    connection.on(GQL_STOP, (id) => {
      // id is the GraphQL operation ID that was stopped
    });
    connection.on(GQL_CONNECTION_TERMINATE, () => {
      // This event has no argument, signifying that the client requests the connection to be terminated
    });
  },
});
```

`GraphyneWebSocketConnection` also exposes `socket` which is a `WebSocket`. This may be helpful if you want to implement a ping-pong according to [RFC 6455](https://tools.ietf.org/html/rfc6455) to detect broken connections using "heartbeat":

```javascript
const PING_PONG_INTERVAL = 10000; // 10 sec

const wss = startSubscriptionServer({
  onGraphyneWebSocketConnection: (connection) => {
    connection.socket.on('pong', () => {
      socket.isAlive = true;
    });
  }
})

const wssPingPong = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }]
    ws.isAlive = false;
    ws.ping();
  });
}, PING_PONG_INTERVAL);

wss.on('close', function close() {
  clearInterval(wssPingPong);
});
```

## Framework integration

### [Express](https://github.com/expressjs/express)

The HTTP Server instance is returned after `app.listen` is called.

```javascript
app.post('/graphql', graphyne.createHandler());

const server = app.listen(PORT);

const wss = startSubscriptionServer({
  server: server,
  graphyne: graphyne,
  // other options
});
```

### [Micro](https://github.com/zeit/micro)

You need to [use Micro programmatically](https://www.npmjs.com/package/micro#programmatic-use) for WebSocket support. `micro()` returns the HTTP Server instance.

```javascript
const server = micro(graphyne.createHandler());

const wss = startSubscriptionServer({
  server: server,
  graphyne: graphyne,
  // other options
});
```

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
