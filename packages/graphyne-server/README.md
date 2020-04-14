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

## Usage

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
- `onNoMatch`: A handler when `req.url` does not match `options.path` nor `options.graphiql.path`. Its arguments depend on a framework's *signature function*. By default, `graphyne` tries to call `req.statusCode = 404` and `res.end('not found')`.

#### Framework integration

`Graphyne` works out-of-the-box for frameworks that resolve Node.js signature function `(req, res)`. **Signature function** refers to framework-specific's handler function. For example in `Express.js`, it is `(req, res, next)`. In `Hapi`, it is `(request, h)`. In `Micro` on `Node HTTP Server`, it is simply `(req, res)`.

##### options.onNoMatch

This is what you may do in `Express.js`.

```javascript
createHandler({
  //...
  onNoMatch: (req, res, next) => {
    next();
  }
}
```

In frameworks like `Micro` or bare `Node HTTP Server`, you usually do:

```javascript
createHandler({
  //...
  onNoMatch: (req, res) => {
    res.statusCode = 404;
    res.end('meh');
  }
}
```

##### Frameworks with non-standard signature function

For frameworks that require different set of handler, define `options.handlerMapping`. **WIP**
