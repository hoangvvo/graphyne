# Graphyne Worker

[![npm](https://badgen.net/npm/v/graphyne-worker)](https://www.npmjs.com/package/graphyne-worker)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

This is a **WIP**.

**lightning-fast** JavaScript GraphQL execution in browser and at the edge.

- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit)
- Works in the browser with [Web Workers support](https://caniuse.com/#feat=webworkers) or on [Cloudflare Workers®](https://workers.cloudflare.com/).

## Why GraphQL in the browser

Depending on the requirement, you can lighten the load of your server by moving GraphQL execution layer to the browsers' [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API).

- Not only that you can query your backend, you can also query 3rd parties' APIs without making a redundant round to and from the backend.
- It enables query deduplication so that you do not waste server resources for identical 3rd parties' requests, while improving speed/performance.

## Install

Install `Graphyne Worker` and `graphql` dependencies using:

```shell
npm i graphyne-worker graphql
// or
yarn add graphyne-worker graphql
```

## Usage (in browser w/ bundler)

Create `worker.js`.

```javascript
const { GraphyneWorker } = require('graphyne-worker');

const graphyne = new GraphyneServer(options);

addEventListener('fetch', graphyne.createHandler(options));

// OR: instead of using createHandler, you can call GraphyneWorker#handleRequest manually.

addEventListener('fetch', (event) => {
  const url = new URL();
  if (url.pathname === '/graphql')
    event.respondWith(graphyne.handleRequest(event.request))
  // if requesting something else, let the browser handles it
});

```

Use it to create a worker.

```javascript
const graphyneWorker = new Worker('worker.js');
```

See [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) for more info.

## API

### `new GraphyneWorker(options)`

Constructing a Graphyne GraphQL worker. It accepts the following options:

| options | description | default |
|---------|-------------|---------|
| schema | A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools). | (required) |
| context | An object or function called to creates a context shared across resolvers per request. The function accepts the framework's [signature function](#framework-specific-integration). | `{}` |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| cache | `GraphyneServer` creates **two** in-memory LRU cache: One for compiled queries and another for invalid queries. This value defines max items to hold in **each** cache. Pass `false` to disable cache. | `1024` |

### `GraphyneWorker#createHandler(options)`

Create a handler for [fetchEvents](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent), `options` accepts the following:

| options | description | default |
|---------|-------------|---------|
| path | Specify a path for the GraphQL endpoint. | `/graphql` |
| playground | Pass in `true` to present [Playground](https://github.com/prisma-labs/graphql-playground) when being loaded from a browser. Alternatively, you can also pass in an object with `path` that specify a custom path to present `Playground` | `false`, `{ path: '/playground' }` if `true` |

### `GraphyneWorker#handleRequest(request)`

Instead of using `GraphyneWorker#createHandler`, you can handle a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) (`fetchEvent.request`) of a `fetchEvent` manually.

Returns a promise of [`Resposne`](https://developer.mozilla.org/en-US/docs/Web/API/Response)

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
