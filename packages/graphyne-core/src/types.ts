import {
  GraphQLError,
  GraphQLSchema,
  DocumentNode,
  GraphQLFormattedError,
} from 'graphql';
import { CompiledQuery } from 'graphql-jit';

export type TContext = Record<string, any>;

export interface Config {
  schema: GraphQLSchema;
  context?: TContext | ((...args: any[]) => TContext | Promise<TContext>);
  rootValue?: ((parsedQuery: DocumentNode) => any) | any;
  formatError?: (error: GraphQLError) => GraphQLFormattedError;
  path?: string;
  playground?:
    | boolean
    | {
        path: string;
      };
}

export interface QueryBody {
  query?: string | null;
  variables?: Record<string, any> | null;
  operationName?: string | null;
}

export interface QueryRequest extends QueryBody {
  context: Record<string, any>;
  httpMethod: string;
}

export interface QueryResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export interface QueryCache {
  operation: string;
  document: DocumentNode;
  compiledQuery: CompiledQuery;
}
