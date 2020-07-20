import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs, resolvers } from '../../common/pokemon-graphql';

export default makeExecutableSchema({
  typeDefs,
  resolvers,
});
