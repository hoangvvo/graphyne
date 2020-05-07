# Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

Fast and low overhead GraphQL Server for any Node.js frameworks or severless environments. A package of [Graphyne](/).

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

In addition, `options` also accepts `onRequest`, `onResponse`, and `onNoMatch`. See [Framework-specific integration](https://github.com/hoangvvo/graphyne#framework-specific-integration).

## Additional features

### Subscriptions

GraphQL subscriptions support is provided by [graphyne-ws](https://www.npmjs.com/package/graphyne-ws) package. Check out the documentation [here](/packages/graphyne-ws).

### File uploads

To enable file upload, use [graphql-upload](https://github.com/jaydenseric/graphql-upload) and add the `Upload` scaler. See [#10](https://github.com/hoangvvo/graphyne/issues/10).

### Dataloader and N+1 Problem

A guide on how to integrate [dataloader](https://github.com/graphql/dataloader) to solve GraphQL N+1 Problem is covered in [#23](https://github.com/hoangvvo/graphyne/issues/23). Also check out an [example](/examples/with-dataloader).

## Framework-specific integration

**Signature function** refers to framework-specific's handler function. For example, in `Express.js`, it is `(req, res, next)`. In `Hapi`, it is `(request, h)`. In `Micro` or `Node HTTP Server`, it is simply `(req, res)` just like `Node HTTP Server`.

### How to work with frameworks with non-standard signature

By default, `graphyne-server` expects the `Node HTTP Server` listener signature of `(req, res)`. However, as seen above, frameworks like Hapi or Koa does not follow the convention. In such cases `onRequest`, `onResponse`, and `onNoMatch` must be defined when calling `GraphyneServer#createHandler`.

Let's take a look at an example with `koa`.

`onRequest(args, done)`

This will be a function to resolve frameworks with non-standard signature function. It accepts an array of *arguments* from a framework's [signature function](#framework-specific-integration) and a function `done` to be called with `request` (`IncomingMessage` from Node.js request listener).

By default, `onRequest` assumes `request` is the fist argument of the signature function. In Node.js HTTP Server the array argument is `[req, res]`, and `onRequest` would be `([req, res], done) => done(req))`.

In `koa`, however, the handler function has a signature of `(ctx, next)`, and thus the array argument will be `[ctx, next]` and calling `done(ctx)` by default will result in error. We fix it like so:

```javascript
graphyne.createHandler({
    onRequest: ([ctx, next], done) => {
      // ctx is the first argument in koa's signature function
      // req is a property of ctx in koa (ctx.request is the flavored request object)
      done(ctx.req);
    },
})
```

`onResponse(result, ...args)`

This will be a function called to send back the HTTP response, where `args` are spreaded arguments of the framework signature function and `result` is always an object of:

- `status` (the status code that should be set)
- `headers` (the headers that should be set)
- `body` (the stringified response body).

By default, `onResponse` assumes `response` is the second argument of the signature function and call `response.writeHead` and `response.end` accordingly.

In `koa`, however, not only that `response` is not the second argument, it has a distinctive way to send response using `ctx.body`. We know that the arguments of `koa` is `(ctx, next)`. Thus, the arguments of `onResponse` will be `(result, ctx, next)`. We can integrate like so:

```javascript
graphyne.createHandler({
    onResponse: ({ headers, body, status }, ctx, next) => {
      ctx.status = status;
      ctx.set(headers);
      ctx.body = body;
    }
  })
```

`onNoMatch(result, ...args)`

By default, `onNoMatch` would call `onResponse` with the `result = {status: 404, body:"not found", headers:{}}`.

If you configurate `onResponse` correctly for `koa` earlier. This will work just fine. However, let's define this function anyway to see how it will work for other frameworks. Similarly, the arguments of `onNoMatch` will be `(ctx, next)` (like `onResponse` without the `result` argument) so we can integrate like so:

```javascript
graphyne.createHandler({
    onNoMatch: (ctx, next) => {
      ctx.status = 404;
      ctx.set(headers);
      ctx.body = body;
    }
  })
```

### Examples

#### [Express](https://github.com/expressjs/express)

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

#### [Micro](https://github.com/zeit/micro)

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

#### [Fastify](https://github.com/fastify/fastify)

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

#### [Koa](https://github.com/koajs/koa)

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

#### [AWS Lambda](https://aws.amazon.com/lambda/)

Lambda will not have Node.js `IncomingMessage`, but you can still transform it into a compatible `IncomingMessage` object. `graphyne-server` would need `request.path`, `request.body`, `request.headers` and `request.method`.

```javascript
exports.handler = graphyne.createHandler({
  onRequest: ([event, context, callback], done) => {
    // Construct a IncomingMessage compatible object
    const request = {
      url: event.path,
      body: event.body ? JSON.parse(event.body) : null,
      headers: event.headers,
      method: event.httpMethod
    };
    done(request);
  },
  onResponse: ({ headers, body, status }, event, context, callback) => {
    callback(null, {
      body, headers, statusCode: status
    });
  },
})
```

#### Other frameworks

As long as the framework exposes Node.js `IncomingMessage`, `graphyne-server` will work by configuring using `onRequest`, `onResponse`, and `onNoMatch`. If not, you can try to construct one by creating an object with `request.path`, `request.body`, `request.headers` and `request.method`.

My plan is to provide prepared config/presets within this package (perhaps by importing from `graphyne-server/integrations`). Yet, since Node.js ecosystem has a wide range of frameworks, it will be impossible to add one for each of them. If there is any framework you fail to integrate, feel free to create an issue.

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
