![Graphyne](https://github.com/hoangvvo/graphyne/blob/master/logo.png)

# Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

A **lightning-fast** JavaScript GraphQL Server, featuring:

- Caching of query validation and compilation with LRU strategy.
- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit)
- Framework-agnostic: Works out-of-the-box with most JavaScript frameworks, such as Express, Micro.

## Why

`Graphyne` uses `graphql-jit` under the hood to compile queries into optimized functions that significantly improve performance ([more than 10 times better than `graphql-js`](https://github.com/zalando-incubator/graphql-jit#benchmarks)). By furthur caching the compiled queries in memory using a LRU strategy, `Graphyne` manages to become lightning-fast.

Check out the [benchmarks](/bench).

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

- `schema`: (required) A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools).
- `context`: An object or function called to creates a context shared across resolvers per request. The function accepts the framework's [signature function](#framework-specific-integration).
- `rootValue`: A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor.
- `cache`: `GraphyneServer` creates **two** in-memory LRU cache: One for compiled queries and another for invalid queries. This value defines max items to hold in **each** cache. Pass `false` to disable cache.

### `GraphyneServer#createHandler(options)`

Create a handler for HTTP server, `options` accepts the following:

- `path`: Specify a path for the GraphQL endpoint. It default to `/graphql` if no path is specified.
- `playground`: Pass in `true` to present [Playground](https://github.com/prisma-labs/graphql-playground) when being loaded from a browser. Alternatively, you can also pass in an options object:
  - `path`: Specify a custom path to present `Playground`. It defaults to `/playground` if not specified.
- `onNoMatch`: A handler function when `req.url` does not match `options.path`. Its *arguments* depend on a framework's [signature function](#framework-specific-integration). By default, `graphyne` tries to call `req.statusCode = 404` and `res.end('not found')`. See examples in [framework-specific integration](#framework-specific-integration).
- `integrationFn`: ([Example](#koa)) A function to resolve frameworks with non-standard signature function. Its *arguments* depend on the framework's [signature function](#framework-specific-integration). It should return an object with:
  - `request`: `IncomingMessage` from Node.js request listener
  - `response`: `ServerResponse` from Node.js request listener
  - `sendResponse`: (optional) A function to override how response is sent. It accepts an object of `status` (the status code that should be set), `headers` (the headers that should be set), and `body` (the stringified response body).

## Additional features

### Subscriptions

GraphQL subscriptions support is provided by [graphyne-ws](https://www.npmjs.com/package/graphyne-ws) package. Check out the documentation [here](/packages/graphyne-ws).

### File uploads

To enable file upload, use [graphql-upload](https://github.com/jaydenseric/graphql-upload) and add the `Upload` scaler. See [#10](https://github.com/hoangvvo/graphyne/issues/10).

## Framework-specific integration

**Signature function** refers to framework-specific's handler function. For example in `Express.js`, it is `(req, res, next)`. In `Hapi`, it is `(request, h)`. In `Micro` or `Node HTTP Server`, it is simply `(req, res)`.

### [Express](https://github.com/expressjs/express)

[Example](/examples/with-express)

```javascript
app.use(
  graphyne.createHandler({
    // other options
    onNoMatch: (req, res, next) => {
      // Continue to next handler in middleware chain
      next();
    }
  })
);
```

### [Micro](https://github.com/zeit/micro)

[Example](/examples/with-micro)

```javascript
const { send } = require('micro');

module.exports = graphyne.createHandler({
  // other options
  onNoMatch: async (req, res) => {
    const statusCode = 400;
    send(res, statusCode, 'not found');
  },
});
```

### [Fastify](https://github.com/fastify/fastify)

**Note:** This is an unofficial integration. For a solution in the ecosystem, check out [fastify-gql](https://github.com/mcollina/fastify-gql).

[Example](/examples/with-fastify)

```javascript
fastify.use(
  graphyne.createHandler({
    // other options
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
    integrationFn: (ctx) => {
      return {
        request: ctx.req,
        response: ctx.res,
        sendResponse: ({ headers, body, status }) => {
          ctx.status = status;
          ctx.set(headers);
          ctx.body = body;
        },
      };
    },
    onNoMatch: (ctx) => {
      ctx.status = 404;
      ctx.body = 'not found';
    },
  })
);
```

(If there is any framework you fail to integrate, feel free to create an issue)
