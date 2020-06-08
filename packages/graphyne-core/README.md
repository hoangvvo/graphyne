# graphyne-core

[![npm](https://badgen.net/npm/v/graphyne-core)](https://www.npmjs.com/package/graphyne-core)
![ci](https://github.com/hoangvvo/graphyne/workflows/Test%20and%20coverage/badge.svg)
[![codecov](https://codecov.io/gh/hoangvvo/graphyne/branch/master/graph/badge.svg)](https://codecov.io/gh/hoangvvo/graphyne)
[![PRs Welcome](https://badgen.net/badge/PRs/welcome/ff5252)](/CONTRIBUTING.md)

The core module used by [Graphyne](https://www.npmjs.com/package/graphyne-server). This is not meant to be used directly but can be used to implement new module that extends Graphyne Server.

Graphyne is a **lightning-fast** JavaScript GraphQL Server. Check out its [documentation](/).

## API

### `new GraphyneCore(options)`

Constructing a Graphyne GraphQL server. It accepts the following options:

| options | description | default |
|---------|-------------|---------|
| schema | A `GraphQLSchema` instance. It can be created using `makeExecutableSchema` from [graphql-tools](https://github.com/apollographql/graphql-tools). | (required) |
| context | An object or function called to creates a context shared across resolvers per request. The function accepts the framework's [signature function](#framework-specific-integration). | `{}` |
| rootValue | A value or function called with the parsed `Document` that creates the root value passed to the GraphQL executor. | `{}` |
| cache | `GraphyneServer` creates **two** in-memory LRU cache: One for compiled queries and another for invalid queries. This value defines max items to hold in **each** cache. Pass `false` to disable cache. | `1024` |
| formatError | An optional function which will be used to format any errors from GraphQL execution result. | [`formatError`](https://github.com/graphql/graphql-js/blob/master/src/error/formatError.js) |

### `GraphyneCore#runQuery({ query, variables, operationName, context, httpMethod }, callback)`

Execute the GraphQL query:

- `query`: The GraphQL query.
- `variables`: An object of variables.
- `operationName`: The operation name for multi-document query.
- `context`: The context object to be used in resolvers.
- `httpMethod`: The HTTP method (`GET`, `POST`, etc.) of the request.

When the execution is done, the callback function will be called with an object of:

- `status`: The status number that should be set for the HTTP Response.
- `headers`: The headers that should be set for the HTTP Response.
- `body`: The stringified body of the HTTP Response.

### `GraphyneCore#getCompiledQuery(query, operationName)`

Find the `graphql-jit` [compiled query](https://github.com/zalando-incubator/graphql-jit#compiledquery--compilequeryschema-document-operationname-compileroptions) in the cache or create one if not existed.

- `query`: The GraphQL query.
- `operationName`: The operation name for multi-document query.

## Contributing

Please see my [contributing.md](/CONTRIBUTING.md).

## License

[MIT](/LICENSE)
