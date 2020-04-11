# Graphyne Server Express

The Express and Connect integration of [Graphyne](/).

## Install

```shell
npm i graphyne-express graphql
// or
yarn add graphyne-express graphql
```

## Usage

Check out the [example](/examples/with-express).

```javascript
const express = require('express');
const { GraphyneServer } = require('graphyne-express');

const graphyne = new GraphyneServer(options);

var app = express();

// GraphQL API
app.all('/graphql', graphyne.createHandler());
// GraphiQL
app.get('/___graphql', graphyle.createHandler({
  path: '/graphql' // Must be set: GraphQL's path, not GraphiQL
  graphiql: true
}))

app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
```

## API

### `new GraphyneServer(options)`

Refer to [API](/#new-graphyneserveroptions).

### `GraphyneServer#createHandler(options)`

Create a handler for Express/Connect Router. Refer to [API](/#graphyneservercreatehandleroptions).

When `options.path` and `options.graphiql.path` is not set, they do not default to `/graphql` and `/___graphql` respectively. Instead, `graphyne-express` wouuld response to all incoming requests. This is because routing is delegated to Express/Connect Router (see in [Usage](#usage)).

#### Using with GraphiQL

If `options.graphiql` is to be used, `options.path` **must** be set. This is because routing is delegated to Express/Connect Router, so `Graphyle` is not aware of where the GraphQL endpoint is exposed.

#### Using with Connect

Connect router only has `.use`, which matches only the beginning of the URL. Therefore, GraphQL endpoints will also be exposed in sub-directories if `path` is not set.

```javascript
connect.use('/graphql', graphyne.createHandler())
// `/graphql`, `/graphql/foo`, `/graphql/foo/bar` are all GraphQL endpoint.
// You should explicitly defining options.path
connect.use('/graphql', graphyne.createHandler({
  path: '/graphql'
}))
```

Same things applies to `options.graphiql.path`.

## License

[MIT](/LICENSE)
