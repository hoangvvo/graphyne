# Graphyne Server

**This is a work in progress.**

A lightning-fast JavaScript GraphQL Server, featuring:

- Caching of query validation and compilation
- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit)

## Why

`Graphyne` uses `graphql-jit` under the hood to compile queries into optimized functions that significantly improve performance ([> 10 times better than `graphql-js`](https://github.com/zalando-incubator/graphql-jit#benchmarks)). By furthur caching the compiled queries in memory using a LRU strategy, `Graphyne` manages to become lightning-fast.

Check out the [benchmarks](/bench).

## Install

Install `Graphyne Server` and `graphql` dependencies using:

```shell
npm i graphyne-server graphql
// or
yarn add graphyne-server graphql
```

In addition, instead of the above, Graphyne Server [integration packages](#integration) can also be used with specific frameworks and runtimes.

```shell
npm i graphyne-{integration} graphql
// or
yarn add graphyne-{integration} graphql
```

## Usage

You can create a HTTP GraphQL server with `graphyne-server`:

```javascript
const http = require('http');
const { GraphyneServer } = require('graphyne-server');

const graphyne = new GraphyneServer(options);

const server = http.createServer(
  graphyne.createHandler()
);

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
```

For integration packages, check out their respective document below:

## Integration

`graphyne` offers integration packages to use with specific frameworks and runtimes:

- [Express](/packages/graphyne-express)

## API

### `new GraphyneServer(options)`

Constructing a Graphyne GraphQL server. It accepts the following options:

- `schema`: (required) A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools).
- `context`: An object or function called to creates a context shared accross resolvers per request. The function accepts an integration context signature depends on which integration packages is used. If not provided, the context will be the one provided by integration packages
- `rootValue`: A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor.
- `cache`: `GraphyneServer` creates **two** in-memory LRU cache: One for compiled queries and another for invalid queries. This value defines max items to hold in **each** cache. Pass `false` to disable cache.

### `GraphyneServer#createHandler(options)`

Create a handler for HTTP server, `options` accepts the following:

- `path`: Specify a path for the GraphQL endpoint. It default to `/graphql` if no path is specified.
- `graphiql`: Pass in `true` to present [GraphiQL](https://github.com/graphql/graphiql) when being loaded in a browser. Alternatively, you can also pass in an options object:
  - `path`: Specify a custom path for `GraphiQL`. It defaults to `/___graphql` if no path is specified.
  - `defaultQuery`: An optional GraphQL string to use when no query is provided and no stored query exists from a previous session.

Respective integration packages may have different requirement for `options`. Please refer to their respective documentations.
