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
app.all('/graphql', graphyne.createHandler());
app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
```

## API

### `new GraphyneServer(options)`

Constructing a Graphyne GraphQL server. `graphyne-express` extends [Graphyne](/), which means it shares the same [API](/#api).

In Express, you may not need to set `options.path` and `options.graphiql.path` because its router can match against exact URL. In Connect, however, you should set `options.path` and/or `options.graphiql.path` because its router only matches against the beginning of the URL.

Nevertheless, if you use `GraphiQL`, you **must** set `options.path`.

### `GraphyneServer.createHandler(handlerOpts)`

Create a handler for Express/Connect Router. `handlerOpts` accepts:

- `graphiql`: A boolean that determines if this handler is for GraphiQL. Make sure options.graphiql and options.path is set.

```javascript
// This serve GraphQL API
app.all('/graphql', graphyne.createHandler());
// This serve GraphiQL
app.get('/___graphql', graphyne.createHandler({
  graphiql: true,
}));
```

## License

[MIT](/LICENSE)
