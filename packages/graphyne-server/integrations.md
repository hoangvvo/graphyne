# Integration examples of `graphyne-server` in different frameworks and runtimes/environments

This document gives the code snippets on how to integrate `graphyne-server`. If the one you use is not on the list, or you wish to learn more, refer to [Framework-specific integration](/packages/graphyne-server#framework-specific-integration).

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
      body: event.body ? JSON.parse(event.body) : null,
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
