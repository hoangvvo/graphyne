# Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

> This package is highly experimental and may be changed or removed at any time!

Lightning-fast GraphQL Server for any JavaScript frameworks or severless environments. A package of [Graphyne](https://github.com/hoangvvo/graphyne).

## Install

Install `Graphyne Server` and `graphql` dependencies using:

```shell
npm i graphyne-server graphql
// or
yarn add graphyne-server graphql
```

## Usage

Start out by creating an instance of `Graphyne` and create a HTTP handler using that instance.

```javascript
const { Graphyne, httpHandler } = require("graphyne-server");

const graphyne = new Graphyne(options);

const gqlHandle = httpHandler(graphyne, handlerOptions);
// Define `handlerOptions.path` if you want `gqlHandle` to run on specific path and respond with 404 otherwise
```

### Node HTTP Server

```javascript
const http = require("http");
const server = http.createServer(gqlHandle);

server.listen(3000, () => {
  console.log(`🚀  Server ready at :3000`);
});
```

### [Express](https://github.com/expressjs/express)

[Example](/examples/with-express)

```javascript
const express = require('express')
const app = express()

app.all('/graphql', gqlHandle);

app.listen(3000, () => {
  console.log(`🚀  Server ready at :3000`);
});
```

### [Micro](https://github.com/zeit/micro)

[Example](/examples/with-micro)

```javascript
module.exports = gqlHandle;
```



## API

### `new Graphyne(options)`

Constructing a Graphyne instance. It accepts the following options:

| options | description | default |
|---------|-------------|---------|
| schema | A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools). | (required) |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| formatError | An optional function which will be used to format any errors from GraphQL execution result. | [`formatError`](https://github.com/graphql/graphql-js/blob/master/src/error/formatError.js) |

**Looking for `options.context`?** It is in `Graphyne#httpHandler` or `Graphyne#graphql`.

### `Graphyne#graphql({ source, contextValue, variableValues, operationName })`

Execute the GraphQL query with:

- `source` (string): The request query string to be executed.
- `contextValue` (object): the context value that will get passed to resolve functions.
- `variablesValues` (object): the variables object that will be used in the executor.
- `operationName` (string): The operation to be run if `source` contains multiple operations.

The function returns a never-rejected promise of the execution result, which is an object of `data` and `errors`.


### `httpHandler(graphyne, handlerOptions)`

Create a handling function for incoming HTTP requests. It accepts the following in `handlerOptions`:

| options | description | default |
|---------|-------------|---------|
| context | An object or function called to creates a context shared across resolvers per request. The function accepts [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage) as the only argument. | `{}` |
| path | Specify a path for the GraphQL endpoint, and `graphyne-server` will response with `404` elsewhere. You **should not** set this when using with frameworks with built-in routers (such as `express`). | `undefined` (run on all paths) |

*Note*: In frameworks like `express`, `context` function will accept [`express`'s Request](https://expressjs.com/en/4x/api.html#req) instead.

## Additional features

Since some features are not used by everyone, they are not included by default to keep the package light-weight.

### Subscriptions

GraphQL subscriptions support is provided by [graphyne-ws](https://www.npmjs.com/package/graphyne-ws) package. Check out the documentation [here](/packages/graphyne-ws).

### File uploads

To enable file upload, use [graphql-upload](https://github.com/jaydenseric/graphql-upload) and add the `Upload` scaler. See [#10](https://github.com/hoangvvo/graphyne/issues/10).

### GraphQL Playground

You can use the packages from [graphql-playground](https://github.com/prisma-labs/graphql-playground).

### Dataloader and N+1 Problem

A guide on how to integrate [dataloader](https://github.com/graphql/dataloader) to solve GraphQL N+1 Problem is covered in [#23](https://github.com/hoangvvo/graphyne/issues/23). Also check out an [example](/examples/with-dataloader).

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
