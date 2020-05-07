# Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

Fast and low overhead GraphQL Server for any Node.js framework. A package of [Graphyne](/).

## Install

Install `Graphyne Server` and `graphql` dependencies using:

```shell
npm i graphyne-server graphql
// or
yarn add graphyne-server graphql
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
| context | An object or function called to creates a context shared across resolvers per request. The function accepts the framework's [signature function](#framework-specific-integration). | `{}` |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| cache | `GraphyneServer` creates **two** in-memory LRU cache: One for compiled queries and another for invalid queries. This value defines max items to hold in **each** cache. Pass `false` to disable cache. | `1024` |

### `GraphyneServer#createHandler(options)`

Create a handler for HTTP server, `options` accepts the following:

| options | description | default |
|---------|-------------|---------|
| path | Specify a path for the GraphQL endpoint. | `/graphql` |
| playground | Pass in `true` to present [Playground](https://github.com/prisma-labs/graphql-playground) when being loaded from a browser. Alternatively, you can also pass in an object with `path` that specify a custom path to present `Playground` | `false`, `{ path: '/playground' }` if `true` |
| onRequest | A function to resolve frameworks with non-standard signature function. It accepts an array of *arguments* from a framework's [signature function](#framework-specific-integration) and a function `done` to be called with `request` (`IncomingMessage` from Node.js request listener) | `([req], done) => { done(req) }` (node signature) |
| onResponse | A handler function to send response. It accepts as the first arguments an object of `status` (the status code that should be set), `headers` (the headers that should be set), and `body` (the stringified response body). The rest of the arguments are those of the framework's [signature function] | A function calling `response.writeHead` and `response.end`, where `response` are assumed to be the second argument from a framework's [signature function](#framework-specific-integration) |
| onNoMatch | A handler function when `request.url` does not match `options.path`. Its *arguments* depend on a framework's [signature function](#framework-specific-integration) | `onResponse` with `body = "not found"` |

For examples on using `onRequest`, `onResponse`, and `onNoMatch`, see [Framework-specific integration](https://github.com/hoangvvo/graphyne#framework-specific-integration)

## Additional features

### Subscriptions

GraphQL subscriptions support is provided by [graphyne-ws](https://www.npmjs.com/package/graphyne-ws) package. Check out the documentation [here](/packages/graphyne-ws).

### File uploads

To enable file upload, use [graphql-upload](https://github.com/jaydenseric/graphql-upload) and add the `Upload` scaler. See [#10](https://github.com/hoangvvo/graphyne/issues/10).

### Dataloader and N+1 Problem

A guide on how to integrate [dataloader](https://github.com/graphql/dataloader) to solve GraphQL N+1 Problem is covered in [#23](https://github.com/hoangvvo/graphyne/issues/23). Also check out an [example](/examples/with-dataloader).

## Framework-specific integration

**Signature function** refers to framework-specific's handler function. For example, in `Express.js`, it is `(req, res, next)`. In `Hapi`, it is `(request, h)`. In `Micro` or `Node HTTP Server`, it is simply `(req, res)` just like `Node HTTP Server`.

By default, `graphyne-server` expects the `Node HTTP Server` listener signature of `(req, res)`. However, this can be configured using `onRequest`, `onResponse`, and `onNoMatch` to work with any Node.js frameworks or even serverless environment.

### [Express](https://github.com/expressjs/express)

[Example](/examples/with-express)

```javascript
app.use(
  graphyne.createHandler({
    onNoMatch: (req, res, next) => {
      // Continue to next handler in middleware chain
      next();
    }
  })
);
```

### [Micro](https://github.com/zeit/micro)

[Example](/examples/with-micro)

*This is not actually required since `micro` function signature is the same as `Node HTTP Server`. `module.exports = graphyne.createHandler()` would work.*

```javascript
const { send } = require('micro');

module.exports = graphyne.createHandler({
  onResponse: async ({ headers, body, status }, req, res) => {
    for (const key in headers) {
      res.setHeader(key, headers[key]);
    }
    send(res, status, body);
  },
  onNoMatch: async (req, res) => {
    send(res, 404, 'not found');
  },
});
```

### [Fastify](https://github.com/fastify/fastify)

**Note:** This is an unofficial integration. For a solution in the ecosystem, check out [fastify-gql](https://github.com/mcollina/fastify-gql).

[Example](/examples/with-fastify)

```javascript
fastify.use(
  graphyne.createHandler({
    onNoMatch: (req, res, next) => {
      next();
    }
  })
);
```

### [Koa](https://github.com/koajs/koa)

[Example](/examples/with-koa)

```javascript
app.use(
  graphyne.createHandler({
    onRequest: ([ctx, next], done) => {
      // ctx is the first argument in koa's signature function
      done(ctx.req);
    },
    onResponse: ({ headers, body, status }, ctx) => {
      ctx.status = status;
      ctx.set(headers);
      ctx.body = body;
    },
    onNoMatch: (ctx) => {
      ctx.status = 404;
      ctx.body = 'not found';
    },
  })
);
```

### Other frameworks

As long as the framework exposes Node.js `IncomingMessage`, `graphyne-server` will work by configuring using `onRequest`, `onResponse`, and `onNoMatch`.

My plan is to provide prepared config/presets within this package (perhaps by importing from `graphyne-server/integrations`). Yet, since Node.js ecosystem has a wide range of frameworks, it will be impossible to add one for each of them. If there is any framework you fail to integrate, feel free to create an issue.

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
