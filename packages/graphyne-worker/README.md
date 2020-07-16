# Graphyne Worker

[![npm](https://badgen.net/npm/v/graphyne-worker)](https://www.npmjs.com/package/graphyne-worker)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

> This package is highly experimental and may be changed or removed at any time!

GraphQL execution layer in the browser and at the edge.

[Service Worker Example](/examples/with-service-worker)

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

## Usage

This assumes basic understanding of service worker. If not, you can learn how to register the service worker [here](https://developers.google.com/web/fundamentals/primers/service-workers/registration).

```javascript
import { Graphyne, handleRequest } from 'graphyne-worker';

// Creating an instance of Graphyne
const graphyne = new Graphyne(options);

addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === '/graphql')
    return event.respondWith(
      handleRequest(graphyne, event.request, handlerOptions)
    );
});
```

Fetch requests to `/graphql` will now be intercepted by the registered worker.

See [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) for more info.

**Note:** `graphyne-worker` can be large in size for use in browser. Consider lazy loading it and implement [Offline/Progressive Web Apps](https://web.dev/progressive-web-apps/).

## API

### `new Graphyne(options)`

Constructing a Graphyne instance. It accepts the following options:

| options | description | default |
|---------|-------------|---------|
| schema | A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools). | (required) |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| formatError | An optional function which will be used to format any errors from GraphQL execution result. | [`formatError`](https://github.com/graphql/graphql-js/blob/master/src/error/formatError.js) |

**Looking for `options.context`?** It is in `handleRequest` or `Graphyne#graphql`.


### `Graphyne#graphql({ source, contextValue, variableValues, operationName })`

Execute the GraphQL query with:

- `source` (string): The request query string to be executed.
- `contextValue` (object): the context value that will get passed to resolve functions.
- `variablesValues` (object): the variables object that will be used in the executor.
- `operationName` (string): The operation to be run if `source` contains multiple operations.

The function returns a never-rejected promise of the execution result, which is an object of `data` and `errors`.

### `handleRequest(graphyne, request, handlerOptions)`

Handles the [FetchEvent.request](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/request) (`request`) and returns a promise of [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response) to be used in `event.respondWith`.

`handlerOptions` accepts the following:

| options | description | default |
|---------|-------------|---------|
| context | An object or function called to creates a context shared across resolvers per request. The function accepts [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) as the only argument. | `{}` |

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
