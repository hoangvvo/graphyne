# Graphyne Server

A lightning-fast JavaScript GraphQL Server, featuring:

- Caching of query validation and compilation
- Highly performant Just-In-Time compiler via [graphql-jit](https://github.com/zalando-incubator/graphql-jit)

## Why

[Apollo Server](https://github.com/apollographql/apollo-server) is a popular GraphQL Server for Node.js. While being robust, it contains overhead that make it [significantly slow compared to others](https://github.com/benawad/node-graphql-benchmarks). `Graphyne` uses `graphql-jit` under the hood to compile queries into optimized functions that significantly improve performance ([> 10 times better than `graphql-js`](https://github.com/zalando-incubator/graphql-jit#benchmarks)). By furthur caching the compiled queries in memory using a LRU strategy, `Graphyne` manages to become lightning-fast.

## Install

Install `Graphyne Server` and `graphql` dependencies using:

```bash
npm i graphyne-server graphql
// or
yarn add graphyne-server graphql
```

In addition, Graphyne Server integration packages can also be used with specific frameworks and runtimes:

```bash
yarn add graphyne-{integration} graphql
```

Available packages are:

- [Node.js HTTP](packages/graphyne-server)
- [Express](packages/graphyne-express)

## API

### `new GraphyneServer(options)`

Constructing a Graphyne GraphQL server. It accepts the following options:

- `schema`: (required) A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools).
- `context`: An object or function called to creates a context shared accross resolvers per request. The function accepts an integration context signature depends on which integration packages is used. If not provided, the context will be the one provided by integration packages
- `rootValue`: A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor.
- `cache`: `GraphyneServer` creates two in-memory LRU cache. This value defines max items to hold in *each* cache. Pass `false` to disable cache.

This is a work in progress.
