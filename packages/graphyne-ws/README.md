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
  path: '/graphql',
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

## Framework integration

### [Express](https://github.com/expressjs/express)

The HTTP Server instance is returned after `app.listen` is called.

```javascript
app.use(graphyne.createHandler());

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
