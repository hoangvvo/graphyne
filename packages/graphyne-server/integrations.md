# Integration of `graphyne-server` in frameworks and runtimes/environments

This document gives the code snippets on how to integrate `graphyne-server`. If the one you use is not on the list, or you wish to learn more, refer to [Framework-specific integration](/packages/graphyne-server#framework-specific-integration). Also feel free to create an issue if you need help with one.

Check out [examples](/examples) for integrations with many others.

## Node.js frameworks

### [Express](https://github.com/expressjs/express)

[Example](/examples/with-express)

*Work out of the box!*

```javascript
const graphyne = new GraphyneServer();

app.all('/graphql', graphyne.createHandler());
```

### [Micro](https://github.com/zeit/micro)

[Example](/examples/with-micro)

*Work out of the box!*

```javascript
const graphyne = new GraphyneServer();

module.exports = graphyne.createHandler();
```

### [Fastify](https://github.com/fastify/fastify)

**Note:** For a more optimized solution in the ecosystem, check out [fastify-gql](https://github.com/mcollina/fastify-gql).

[Example](/examples/with-fastify)

```javascript
const graphyne = new GraphyneServer({
  onResponse: ({ status, body, headers }, request, reply) => {
    reply.code(status).headers(headers).send(body);
  },
})

// Because fastify does not expose HTTP method via `request.method` by default, we need to attach it there since `graphyne-server` needs it.
fastify.decorateRequest('method', {
  getter() {
    return this.raw.method;
  },
});

fastify.post('/graphql', graphyne.createHandler());
```

## Runtimes/Environments

### [AWS Lambda](https://aws.amazon.com/lambda/)

Lambda will not have Node.js `IncomingMessage`, so you need to create a compatible request object:

```javascript
const graphyne = new GraphyneServer({
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
      body,
      headers,
      statusCode: status,
    });
  },
});

exports.handler = graphyne.createHandler();
```
