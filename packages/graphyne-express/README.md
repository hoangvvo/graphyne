# Graphyne Server Express

The Express and Connect integration of [Graphyne](https://github.com/hoangvvo/graphyne).

## Install

```shell
npm i graphyne-express graphql
// or
yarn add graphyne-express graphql
```

## Usage

Check out the [example](https://github.com/hoangvvo/graphyne/tree/master/examples/with-express).

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const { GraphyneServer } = require('graphyne-express');

const gqlServer = new GraphyneServer(options);

var app = express();
app.use(bodyParser.json()); // bodyParser is required to parse incoming request
app.all('/graphql', gqlServer.createHandler());
app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
```

## API

### `new GraphyneServer(options)`

Constructing a Graphyne GraphQL server. `graphyne-express` extends [Graphyne](https://github.com/hoangvvo/graphyne), which means it shares the same [API](https://github.com/hoangvvo/graphyne#api).

`graphyne-express` does not respect `options.path` and `options.graphiql.path` because it is handled by Express/Connect router. However, if you want to use GraphiQL, you must set `options.path`.

### `GraphyneServer.createHandler(handlerOpts)`

Create a handler for Express/Connect Router. `handlerOpts` accepts:

- `graphiql`: A boolean that determines if this handler is for GraphiQL. Make sure options.graphiql and options.path is set.`

```javascript
// Create a route for GraphiQL
app.get('/___graphql', gqlServer.createrHandler({
  graphiql: true,
}));
```

## License

[MIT](https://github.com/hoangvvo/graphyne/blob/master/LICENSE)
