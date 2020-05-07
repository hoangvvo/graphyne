# Graphyne

![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

A **lightning-fast** JavaScript GraphQL Server, featuring:

- Caching of query validation and compilation with LRU strategy.
- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit)
- Framework-agnostic: Works out-of-the-box with most JavaScript frameworks, such as Express, Micro.

## Why

`Graphyne` uses `graphql-jit` under the hood to compile queries into optimized functions that significantly improve performance ([more than 10 times better than `graphql-js`](https://github.com/zalando-incubator/graphql-jit#benchmarks)). By furthur caching the compiled queries in memory using a LRU strategy, `Graphyne` manages to become lightning-fast.

## Examples

See [examples](examples).

## Packages

### Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)

Fast and low overhead GraphQL Server for **any** [yes](packages/graphyne-server#framework-specific-integration) Node.js frameworks. Also works in Serverless environment.

[Documentation](packages/graphyne-server) [npm](https://www.npmjs.com/package/graphyne-server)

### Graphyne Worker

[![npm](https://badgen.net/npm/v/graphyne-worker)](https://www.npmjs.com/package/graphyne-server)

Run GraphQL execution layer in the browser ([Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)) and at the edge ([Cloudflare Workers®](https://workers.cloudflare.com/))

[Documentation](packages/graphyne-worker) [npm](https://www.npmjs.com/package/graphyne-worker)

### Graphyne WebSocket

[![npm](https://badgen.net/npm/v/graphyne-ws)](https://www.npmjs.com/package/graphyne-server)

Add WebSocket support to `graphyne-server`. Implements [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

[Documentation](packages/graphyne-ws) [npm](https://www.npmjs.com/package/graphyne-ws)

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](LICENSE)
