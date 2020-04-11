const express = require('express');
const { GraphyneServer } = require('graphyne-express');
const { schema } = require('../buildSchema');

const graphyne = new GraphyneServer({
  schema,
});

express().all('/graphql', graphyne.createHandler()).listen(4001);
