# Graphyne Worker

[![npm](https://badgen.net/npm/v/graphyne-worker)](https://www.npmjs.com/package/graphyne-worker)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

GraphQL execution layer in the browser and at the edge. A package of [Graphyne](/).

[Example](/examples/graphyne-worker-simple)

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

addEventListener('fetch', graphyne.createHandler());

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

**Note:** `graphyne-worker` can be large in size for use in browser. Consider lazy loading it and implement [Offline/Progressive Web Apps](https://web.dev/progressive-web-apps/).

## API

### `new GraphyneWorker(options)`

Constructing a Graphyne GraphQL worker. It accepts the following options:

| options | description | default |
|---------|-------------|---------|
| schema | A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools). | (required) |
| context | An object or function called to creates a context shared across resolvers per request. The function accepts [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) as the only argument. | `{}` |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| formatError | An optional function which will be used to format any errors from GraphQL execution result. | [`formatError`](https://github.com/graphql/graphql-js/blob/master/src/error/formatError.js) |
| path | Specify a path for the GraphQL endpoint. | `/graphql` |
| playground | Pass in `true` to present [Playground](https://github.com/prisma-labs/graphql-playground) when being loaded from a browser. Alternatively, you can also pass in an object with `path` that specify a custom path to present `Playground` | `false`, `{ path: '/playground' }` if `true` |

### `GraphyneWorker#createHandler()`

Create a handler for [fetchEvents](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent).

### `GraphyneWorker#handleRequest(request)`

Instead of using `GraphyneWorker#createHandler`, you can handle a [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) (`fetchEvent.request`) of a `fetchEvent` manually.

Returns a promise of [`Resposne`](https://developer.mozilla.org/en-US/docs/Web/API/Response)

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
