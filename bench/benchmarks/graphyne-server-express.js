const express = require('express');
const { GraphyneServer } = require('graphyne-server');
const { schema } = require('../buildSchema');

const graphyne = new GraphyneServer({
  schema,
});

const app = express();
app.post(
  '/graphql',
  graphyne.createHandler({
    onNoMatch: (req, res, next) => {
      next();
    },
  })
);

app.listen(4001);
