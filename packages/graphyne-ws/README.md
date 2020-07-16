# GraphQL Subscriptions over WebSocket for Graphyne

[![npm](https://badgen.net/npm/v/graphyne-ws)](https://www.npmjs.com/package/graphyne-ws)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

> This package is highly experimental and may be changed or removed at any time!

WebSocket support implementing [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

For now, this package is exclusively used with [Graphyne](https://github.com/hoangvvo/graphyne).

## Install

Since `graphyne-ws` uses [`ws`](https://github.com/websockets/ws) behind the hood, you must also install it if you haven't already.

```shell
npm i graphyne-ws ws
// or
yarn add graphyne-ws ws
```

## Usage

[Example](/examples/with-graphql-subscriptions)

Create a [WebSocket.Server](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocketserver) instance and uses `wsHandler` to handle its `connection` event.

```javascript
const http = require('http');
const { Graphyne, httpHandler } = require('graphyne-server');
const { wsHandler } = require('graphyne-ws');

// Create a Graphyne instance
const graphyne = new Graphyne(options);
const server = http.createServer(httpHandler(graphyne));

// Create a WebSocket.Server using the `ws` package
const wss = new WebSocket.Server({ path: '/graphql', server });

// Attach wsHandler to WebSocket.Server `connection` event
// See https://github.com/websockets/ws/blob/master/doc/ws.md#event-connection
wss.on('connection', wsHandler(graphyne, options));

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
```

To learn how to create a subscription as well as using different pubsub implementations (like Redis), see [graphql-subscriptions documentation](https://github.com/apollographql/graphql-subscriptions#getting-started-with-your-first-subscription).

## API

### wsHandler(graphyne, options)

Create a handler for incoming WebSocket connection (from `wss.on('connection')`) and execute GraphQL based on [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

`graphyne` is an instance of [`Graphyne`](/packages/graphyne-server#new-graphyneoptions).

`options` accepts the following:

- `context`: An object or function called to creates a context shared across resolvers per connection. The function receives an object with the following:
  - `connectionParams`: Object that is sent from the client. See an example in [`apollo-link-ws`](https://www.apollographql.com/docs/react/data/subscriptions/#authentication-over-websocket)
  - `socket`: The [WebSocket connection](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#event-connection).
  - `request`: The incoming request.
- `onGraphyneWebSocketConnection`: A function to called with the `GraphyneWebSocketConnection` instance whenever one is created (on every websocket connection).

### `GraphyneWebSocketConnection`

#### GraphyneWebSocketConnection#socket

`GraphyneWebSocketConnection` exposes `socket` which is a `WebSocket`. This is helpful if you want to implement something like a "heartbeat" to detect broken connections according to [RFC 6455 Ping-Pong](https://tools.ietf.org/html/rfc6455#section-5.5):

```javascript
const HEARTBEAT_INTERVAL = 10000; // 10 sec

const wss = new WebSocket.Server({ path: '/graphql', server });

wss.on('connection', wsHandler(graphyne, {
  onGraphyneWebSocketConnection: (connection) => {
    connection.socket.isAlive = true;
    connection.socket.on('pong', () => {
      connection.socket.isAlive = true;
    });
  }
}));

const wssPingPong = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }]
    ws.isAlive = false;
    ws.ping();
  });
}, HEARTBEAT_INTERVAL);

wss.on('close', function close() {
  clearInterval(wssPingPong);
});
```

#### Events

An instance of `GraphyneWebSocketConnection` extends `EventEmitter`.

It emits several events upon connection acknowledged, subscription started or stopped, and connection terminated.

```javascript
import { startSubscriptionServer } from "graphyne-ws";

startSubscriptionServer({
  onGraphyneWebSocketConnection: (connection) => {
    // called after the connection is initialized and acknowledged
    connection.on('connection_init', (connectionParams) => {
      // optional parameters that the client specifies in connectionParams
    });

    // called after a subscription operation has been started
    connection.on('subscription_start', (id, payload, context) => {
      // id is the GraphQL operation ID
      // payload is the GQL payload with `query`, `variables`, and `operationName`.
      // context is the resolved context from options.context
    });

    // called after the operation has been stopped
    connection.on('subscription_stop', (id) => {
      // id is the GraphQL operation ID that was stopped
    });

    // called after the connection is terminated
    connection.on('connection_terminate', () => {
      // This event has no argument
    });
  },
});
```

## Framework integration

Framework integration is not a concern of `graphyne-ws` but one of [`ws`](https://github.com/websockets/ws). As long as a [`WebSocket.Server`](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocketserver) is supplied, you're good to go.

For example, if you use [`fastify-websocket`](https://github.com/fastify/fastify-websocket) package, the [`WebSocket.Server`](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocketserver) instance can be found at `fastify.websocketServer`.

```javascript
// https://github.com/fastify/fastify-websocket#usage
const fastify = require('fastify')();

fastify.register(require('fastify-websocket'), { handle, options });
// The above "decorate" WebSocket.Server at fastify.
```

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
