# GraphQL Subscriptions over WebSocket for Graphyne

[![npm](https://badgen.net/npm/v/graphyne-ws)](https://www.npmjs.com/package/graphyne-ws)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

> This package is highly experimental and may be changed or removed at any time!

WebSocket support implementing [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

For now, this package is exclusively used with [Graphyne](https://github.com/hoangvvo/graphyne).

## Install

Since `graphyne-ws` uses [`ws`](https://github.com/websockets/ws) under the hood, you must also install it if you haven't already.

```shell
npm i graphyne-ws ws
// or
yarn add graphyne-ws ws
```

## Usage

[Example](/examples/with-graphql-subscriptions)

Create a [WebSocket.Server](https://github.com/websockets/ws/blob/master/doc/ws.md#class-websocketserver) instance and uses `wsHandler` to handle its `connection` event.

### With `graphyne-server`

```javascript
const http = require('http');
const { Graphyne, httpHandler } = require('graphyne-server');
const { wsHandler } = require('graphyne-ws');

// Create a Graphyne instance
const graphyne = new Graphyne(options);
const server = http.createServer(httpHandler(graphyne));

// Create a WebSocket.Server from the `ws` package
const wss = new WebSocket.Server({ path: '/graphql', server });

// Attach wsHandler to WebSocket.Server `connection` event
// See https://github.com/websockets/ws/blob/master/doc/ws.md#event-connection
wss.on('connection', wsHandler(graphyne, options));

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
```

### Without `graphyne-server`

`graphyne-ws` also exports `Graphyne` class to be used without `graphyne-server`.

```javascript
const { Graphyne, wsHandler } = require('graphyne-ws');

// Create a Graphyne instance
const graphyne = new Graphyne(options);

// Create a WebSocket.Server from the `ws` package (Use options.port to create a HTTP server internally)
const wss = new WebSocket.Server({ path: '/graphql', port: 3000 }, () => {
  console.log(`🚀  WebSocket Server ready at ws://localhost:3000/graphql`);
})

// Attach wsHandler to WebSocket.Server `connection` event
// See https://github.com/websockets/ws/blob/master/doc/ws.md#event-connection
wss.on('connection', wsHandler(graphyne, options));
```

See more examples [here](/examples/).

## API

### wsHandler(graphyne, options)

Create a handler for incoming WebSocket connection (from `wss.on('connection')`) and execute GraphQL based on [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

`graphyne` is an instance of [`Graphyne`](/packages/graphyne-server#new-graphyneoptions).

`options` accepts the following:

- `context`: An object or function called to creates a context shared across resolvers per connection. The function receives an object with the following:
  - `connectionParams`: Object that is sent from the client. See an example in [`apollo-link-ws`](https://www.apollographql.com/docs/react/data/subscriptions/#authentication-over-websocket)
  - `socket`: The [WebSocket connection](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#event-connection).
  - `request`: The incoming request.
- `onSubscriptionConnection`: (**Experimental**) A function to called with the `SubscriptionConnection` instance whenever one is created (on every websocket connection).

### `Class: SubscriptionConnection`

This class represents an *internal* subscription connection that handles incoming message (`ws.on('message')`) via `SubscriptionConnection#handleMessage`. See [/packages/graphyne-worker/src/handler.ts](handler.ts) for its usage.

> This class, along with `onSubscriptionConnection`, are experimental and may suffer breaking changes at any time.

#### SubscriptionConnection#socket

`SubscriptionConnection` exposes `socket` which is the same `WebSocket` from `wss.on('connection')`. 

This is helpful if you want to implement something like a "heartbeat" to detect broken connections according to [RFC 6455 Ping-Pong](https://tools.ietf.org/html/rfc6455#section-5.5):

```javascript
const HEARTBEAT_INTERVAL = 10000; // 10 sec

const wss = new WebSocket.Server({ path: '/graphql', server });

wss.on('connection', wsHandler(graphyne, {
  onSubscriptionConnection: (connection) => {
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

An instance of `SubscriptionConnection` extends `EventEmitter`.

It emits several events upon connection acknowledged, subscription started or stopped, and connection terminated.

```javascript
import { wsHandler } from "graphyne-ws";

wsHandler(graphyne, wss, {
  onSubscriptionConnection: (connection) => {
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

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
