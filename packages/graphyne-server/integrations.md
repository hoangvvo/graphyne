# Integration of `graphyne-server` in frameworks and runtimes/environments

This document gives the code snippets on how to integrate `graphyne-server`. If the one you use is not on the list, or you wish to learn more, refer to [Framework-specific integration](/packages/graphyne-server#framework-specific-integration). Also feel free to create an issue if you need help with one.

**Warning:** Do not use any `body-parser` module before graphyne's handler.

Check out [examples](/examples) for integrations with many others.

## Node.js frameworks

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
      done(ctx.req);
    },
    onResponse: ({ headers, body, status }, ctx) => {
      ctx.status = status;
      ctx.set(headers);
      ctx.body = body;
    },
    onNoMatch: (ctx, next) => next()
  })
);
```

## Runtimes/Environments

### [AWS Lambda](https://aws.amazon.com/lambda/)

Lambda will not have Node.js `IncomingMessage`, so you need to create a compatible request object:

```javascript
exports.handler = graphyne.createHandler({
  onRequest: ([event, context, callback], done) => {
    // Construct a IncomingMessage compatible object
    const request = {
      path: event.path,
      query: event.queryStringParameters,
      headers: event.headers,
      method: event.httpMethod,
      body: event.body,
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

### [Deno](https://deno.land/)

In `Deno`, `req.body` is of type [Reader](https://deno.land/typedoc/interfaces/deno.reader.html) and must be converted to string using `Deno.readAll` and `TextDecoder` API.

```javascript
const decoder = new TextDecoder();

const gqlHandle = graphyne.createHandler({
  onRequest: async ([req], done) => {
    const request = {
      url: req.url,
      headers: req.headers,
      method: req.method,
      body: decoder.decode(await Deno.readAll(req.body)),
    };
    done(request);
  },
  onResponse: ({ headers, body, status }, req) => {
    req.respond({ body, headers, status });
  },
})

// Usage

import { listenAndServe, server } from "https://deno.land/std/http/server.ts";

// Either
listenAndServe({ port: 8000 }, gqlHandle);
// OR
const server = serve({ port: 8000 });
for await (const req of server) {
  gqlHandle(req);
}
```
