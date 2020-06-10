# Graphyne

![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

A **lightning-fast** JavaScript GraphQL Server, featuring:

- Caching of query validation and compilation with LRU strategy.
- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit).
- Framework-agnostic: Works out-of-the-box with most Node.js frameworks, in the browser ([Web Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)), and in serverless environments.

## Why

`Graphyne` uses `graphql-jit` under the hood to compile queries into optimized functions that significantly improve performance ([more than 10 times better than `graphql-js`](https://github.com/zalando-incubator/graphql-jit#benchmarks)). By furthur caching the compiled queries in memory using a LRU strategy, `Graphyne` manages to become lightning-fast.

| Server | Requests/s | Latency | Throughput/Mb |
| ------ | ---------- | ------- | ------------- |
| graphyne-server | 5471.6 | 0.30 | 34.10 |
| express-graphql | 1609.4 | 2.73 | 10.13 |
| apollo-server-express | 1481.0 | 2.95 | 9.28 |
| graphql-yoga | 1240.2 | 3.46 | 7.84 |

<sup>Benchmarks with popular GraphQL Server libraries using [benawad/node-graphql-benchmarks](https://github.com/benawad/node-graphql-benchmarks).</sup>

## Examples

See [examples](examples).

## Packages

### Graphyne Server

[![npm](https://badgen.net/npm/v/graphyne-server)](https://www.npmjs.com/package/graphyne-server)

Agnostic and fast GraphQL Server for **any** ([yes](packages/graphyne-server#framework-specific-integration)) Node.js frameworks. Also works in Serverless environment.

[Documentation](packages/graphyne-server) [npm](https://www.npmjs.com/package/graphyne-server)

### Graphyne Worker

[![npm](https://badgen.net/npm/v/graphyne-worker)](https://www.npmjs.com/package/graphyne-worker)

Run GraphQL execution layer in the browser ([Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)) and at the edge ([Cloudflare Workers®](https://workers.cloudflare.com/)).

[Documentation](packages/graphyne-worker) [npm](https://www.npmjs.com/package/graphyne-worker)

### Graphyne WebSocket

[![npm](https://badgen.net/npm/v/graphyne-ws)](https://www.npmjs.com/package/graphyne-ws)

Add WebSocket support to `graphyne-server`. Implements [GraphQL over WebSocket Protocol](https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md).

[Documentation](packages/graphyne-ws) [npm](https://www.npmjs.com/package/graphyne-ws)

## Features / TODO

`Graphyne` is a work-in-progress. It is obviously not battle-tested and lack several features. My plan for now is to implement the following:

- [x] WebSocket/Subscriptions
- [ ] Persisted queries
- [ ] Federation
- [ ] Gateway

GraphQL execution layer is also bounded by the limitation of [graphql-jit](https://github.com/zalando-incubator/graphql-jit#differences-to-graphql-js). Yet, I have been using it in production and see no problems for my use-cases.

To keep the code light-weight, some features (such as File Upload) is intentionally left out but can be [easily implemented](packages/graphyne-server#file-uploads) if needed.

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](LICENSE)
