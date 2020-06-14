# Integration of `graphyne-server` in frameworks and runtimes/environments

This document gives the code snippets on how to integrate `graphyne-server`. If the one you use is not on the list, or you wish to learn more, refer to [Framework-specific integration](/packages/graphyne-server#framework-specific-integration). Also feel free to create an issue if you need help with one.

**Warning:** Do not use any `body-parser` module before graphyne's handler.

Check out [examples](/examples) for integrations with many others.

## Node.js frameworks

### [Express](https://github.com/expressjs/express)

[Example](/examples/with-express)

```javascript
const graphyne = new GraphyneServer();

app.all('/graphql', graphyne.createHandler());
```

### [Micro](https://github.com/zeit/micro)

[Example](/examples/with-micro)

*`onResponse` is not actually required since `micro` handler function is the same as `Node HTTP Server`.*

```javascript
const { send } = require('micro');

const graphyne = new GraphyneServer({
  onResponse: async ({ headers, body, status }, req, res) => {
    for (const key in headers) {
      res.setHeader(key, headers[key]);
    }
    send(res, status, body);
  },
});

module.exports = graphyne.createHandler();
```

### [Fastify](https://github.com/fastify/fastify)

**Note:** This is an unofficial integration. For a solution in the ecosystem, check out [fastify-gql](https://github.com/mcollina/fastify-gql).

[Example](/examples/with-fastify)

```javascript
const graphyne = new GraphyneServer()

fastify.use(graphyne.createHandler());
```

## Runtimes/Environments

### [AWS Lambda](https://aws.amazon.com/lambda/)

Lambda will not have Node.js `IncomingMessage`, so you need to create a compatible request object:

```javascript
const graphyne = new GraphyneServer({
  onRequest: ([event, context, callback], done) => {
    // Construct a IncomingMessage compatible object
    const request = {
      query: event.queryStringParameters,
      headers: event.headers,
      method: event.httpMethod,
      body: event.body,
    };
    done(request);
  },
  onResponse: ({ headers, body, status }, event, context, callback) => {
    callback(null, {
      body,
      headers,
      statusCode: status,
    });
  },
});

exports.handler = graphyne.createHandler();
```

### [Deno](https://deno.land/)

In `Deno`, `req.body` is of type [Reader](https://deno.land/typedoc/interfaces/deno.reader.html) and must be converted to string using `Deno.readAll` and `TextDecoder` API.

```javascript
const decoder = new TextDecoder();

const graphyne = new GraphyneServer({
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
});

const gqlHandle = graphyne.createHandler();

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
