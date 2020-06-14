# Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

Lightning-fast GraphQL Server for any JavaScript frameworks or severless environments. A package of [Graphyne](/).

## Install

Install `Graphyne Server` and `graphql` dependencies using:

```shell
npm i graphyne-server graphql
// or
yarn add graphyne-server graphql
```

If you use `deno`, pull this package from [Pika](https://www.pika.dev/npm/graphyne-server).

```javascript
import { GraphyneServer } from 'https://cdn.pika.dev/graphyne-server';
```

## Usage (with bare Node HTTP Server)

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

If you do not use Node HTTP Server (which is likely), see [framework-specific integration](#framework-specific-integration).

## API

### `new GraphyneServer(options)`

Constructing a Graphyne GraphQL server. It accepts the following options:

| options | description | default |
|---------|-------------|---------|
| schema | A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools). | (required) |
| context | An object or function called to creates a context shared across resolvers per request. The function accepts the framework's [handler function](#framework-specific-integration). | `{}` |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| formatError | An optional function which will be used to format any errors from GraphQL execution result. | [`formatError`](https://github.com/graphql/graphql-js/blob/master/src/error/formatError.js) |
| path | Specify a path for the GraphQL endpoint. | `/graphql` |
| playground | Pass in `true` to present [Playground](https://github.com/prisma-labs/graphql-playground) when being loaded from a browser. Alternatively, you can also pass in an object with `path` that specify a custom path to present `Playground` | `false`, `{ path: '/playground' }` if `true` |
| onRequest | Used to integrate to frameworks other than Node.js HTTP. See [Framework-specific integration](https://github.com/hoangvvo/graphyne#framework-specific-integration). | `([req, res], done) => done(req)` |
| onResponse | Used to integrate to frameworks other than Node.js HTTP. See [Framework-specific integration](https://github.com/hoangvvo/graphyne#framework-specific-integration). | `(result, req, res) => res.writeHead(result.status, result.headers).end(result.body)` |
| onNoMatch | Used to integrate to frameworks other than Node.js HTTP. See [Framework-specific integration](https://github.com/hoangvvo/graphyne#framework-specific-integration). | `onResponse({status: 404, body: "not found", headers: {}})`

### `GraphyneServer#createHandler()`

Create a handler for HTTP server.

You must define `onRequest`, `onResponse`, and `onNoMatch` earlier for this to work with frameworks other than Node.js `http`. See [Framework-specific integration](https://github.com/hoangvvo/graphyne#framework-specific-integration).

## Framework-specific integration

**Handler function** refers to framework/runtimes-specific handler of incoming request. For example, in `Express.js`, it is [`(req, res, next)`](https://expressjs.com/en/guide/writing-middleware.html). In `Hapi`, it is [`(request, h)`](https://hapi.dev/tutorials/routing/?lang=en_US#-methods). In `AWS Lambda`, it is [`(event, context, callback)`](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-handler.html). In `Micro` or `Node HTTP Server`, it is simply `(req, res)`.

By default, `graphyne-server` expects the `Node HTTP Server` listener/handler function of `(req, res)`. However, as seen above, frameworks/runtimes like Hapi or AWS Lambda do not follow the convention. In such cases, `onRequest`, `onResponse`, and `onNoMatch` must be defined when calling `new GraphyneServer`.

See the [Integration examples](#integration-examples) section below to learn how `onRequest`, `onResponse`, and `onNoMatch` is used.

### `onRequest(args, done)`

This is the function to resolve frameworks with handler functions differing to `(req, res)`. It will be called with `args`, an array of *arguments* from a framework's handler function, and a callback function `done` to be called with one of the two:

- `req`: `IncomingMessage` from Node.js
- A compatible request object (See section below)

By default, `onRequest` assumes `request` is the fist argument of the handler function. In Node.js HTTP Server, `args` is `[req, res]`, and `onRequest` defaults to `([req, res], done) => done(req))`.

#### Compatible request object

Sometimes, `IncomingMessage` is not available, when used in a non-Node.js environments like [AWS](https://docs.aws.amazon.com/lambda/latest/dg/lambda-services.html) or [Deno](https://deno.land/), or when the framework does not expose it.

In such cases, you must create an object with the following properties:

- `headers`: **(Required)** A key-value object of the HTTP headers.
- `method`: **(Required)** The HTTP method verb (`GET`, `POST`, etc).
- `body`: The body of the request (object or string).

...with the additions of:

- `url`: The full url of the request (path + query strings).

and/or:

- `path`: The path of the request (before query strings).
- `query`: The key-value object of the query strings.

### `onResponse(result, ...args)`

This is the function called to send back the HTTP response. It will be called with `args`, spreaded arguments of the framework handler function, and `result`, an object of:

- `status` (the status code that should be set)
- `headers` (the headers that should be set)
- `body` (the **stringified** response body).

By default, `onResponse` assumes `response` is the second argument of the handler function. In Node.js HTTP Server, `...args` is `req, res`, and `onResponse` defaults to `(result, req, res) => res.writeHead(result.status, result.headers).end(result.body)`.

### `onNoMatch(result, ...args)`

By default, `onNoMatch` calls `onResponse` with `result = {status: 404, body: "not found", headers: {}}`. Thus, if you configurate `onResponse` correctly, this will just work.

However, sometimes you do not want `onNoMatch` to write `404` right away, such as when you used it as a middleware in frameworks like `Express`, in which case you want to [call `next` instead](/packages/graphyne-server/integrations.md#express).

### Integration examples

See [integrations.md](integrations.md).

## Additional features

Since some features are not used by everyone, they are not included by default to keep the package light-weight.

### Subscriptions

GraphQL subscriptions support is provided by [graphyne-ws](https://www.npmjs.com/package/graphyne-ws) package. Check out the documentation [here](/packages/graphyne-ws).

### File uploads

To enable file upload, use [graphql-upload](https://github.com/jaydenseric/graphql-upload) and add the `Upload` scaler. See [#10](https://github.com/hoangvvo/graphyne/issues/10).

### Dataloader and N+1 Problem

A guide on how to integrate [dataloader](https://github.com/graphql/dataloader) to solve GraphQL N+1 Problem is covered in [#23](https://github.com/hoangvvo/graphyne/issues/23). Also check out an [example](/examples/with-dataloader).

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
