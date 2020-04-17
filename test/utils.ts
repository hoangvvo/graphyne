import { Config } from 'graphyne-core';
import { createServer } from 'http';
import { makeExecutableSchema } from 'graphql-tools';
import { GraphyneServer } from '../packages/graphyne-server/src';

export function createGQLServer({
  schema: schemaOpt,
  typeDefs,
  resolvers,
  ...options
}: Partial<Config> & {
  typeDefs?: string;
  resolvers?: any;
}) {
  const schema =
    schemaOpt ||
    makeExecutableSchema({
      typeDefs: typeDefs as string,
      resolvers,
    });
  const graphyne = new GraphyneServer({
    schema,
    ...options,
  });
  return createServer(graphyne.createHandler());
}
