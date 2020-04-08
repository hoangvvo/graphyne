# Graphyne Server

**This is a work in progress.**

A lightning-fast JavaScript GraphQL Server, featuring:

- Caching of query validation and compilation
- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit)

## Why

[Apollo Server](https://github.com/apollographql/apollo-server) is a popular GraphQL Server for Node.js. While being robust, it contains overhead that make it [significantly slow compared to others](https://github.com/benawad/node-graphql-benchmarks). `Graphyne` uses `graphql-jit` under the hood to compile queries into optimized functions that significantly improve performance ([> 10 times better than `graphql-js`](https://github.com/zalando-incubator/graphql-jit#benchmarks)). By furthur caching the compiled queries in memory using a LRU strategy, `Graphyne` manages to become lightning-fast.

## Install

Install `Graphyne Server` and `graphql` dependencies using:

```shell
npm i graphyne-server graphql
// or
yarn add graphyne-server graphql
```

In addition, Graphyne Server integration packages can also be used with specific frameworks and runtimes:

```shell
yarn add graphyne-{integration} graphql
```

Available packages are:

- [Node.js HTTP](/packages/graphyne-server)
- [Express](/packages/graphyne-express)

## Usage

You can quick start a GraphQL server with `graphyne-server`:

```javascript
const { GraphyneServer } = require('graphyne-server');

const graphyne = new GraphyneServer(options);
graphyne.listen(3000).then(() => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
```

If you want more control over the server, use Node.js `http` module:

```javascript
const http = require('http');
const { GraphyneServer } = require('graphyne-server');

const graphyne = new GraphyneServer(options);

const server = http.createServer(
  graphyne.createHandler()
);

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/api`);
});
```

Check out [examples](examples) to learn how to use `graphyne`.

### Integration

Check out the respective packages above for their usage.

## API

### `new GraphyneServer(options)`

Constructing a Graphyne GraphQL server. It accepts the following options:

- `schema`: (required) A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools).
- `context`: An object or function called to creates a context shared accross resolvers per request. The function accepts an integration context signature depends on which integration packages is used. If not provided, the context will be the one provided by integration packages
- `rootValue`: A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor.
- `cache`: `GraphyneServer` creates **two** in-memory LRU cache: One for compiled queries and another for invalid queries. This value defines max items to hold in **each** cache. Pass `false` to disable cache.
- `path`: Specify a custom path for the GraphQL endpoint. It defaults to `/graphql` if no path is specified.
- `graphiql`: Present [GraphiQL](https://github.com/graphql/graphiql) when being loaded in a browser. Alterntive, you can also pass in an options object:
  - `path`: Specify a custom path for `GraphiQL`. It defaults to `/___graphql` if no path is specified.
  - `defaultQuery`: An optional GraphQL string to use when no query is provided and no stored query exists from a previous session.

### `GraphyneServer.createHandler(options)`

Create a handler for incoming requests using respective integration packages. The accepted `options` depends on the integration package used. Refer to respective documentations for more information.

### `GraphyneServer.listen(port)`

*This applies to `graphyne-server` only*

Start a configless GraphQL server in specified `port` at `/graphql`. Returns a promise when the server is ready.
