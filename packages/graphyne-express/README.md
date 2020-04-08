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
app.use('/graphql', gqlServer.createHandler());
app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');
```

## API

`graphyne-express` extends `graphyne-core`, which means it shares the same [API](https://github.com/hoangvvo/graphyne#api).

One difference is that `graphyne-express` does not respect `options.path` and `options.graphiql.path` because it is handled by Express/Connect router.

## License

[MIT](https://github.com/hoangvvo/graphyne/blob/master/LICENSE)
