import { GraphQLError, GraphQLSchema, DocumentNode } from 'graphql';
import { CompiledQuery } from 'graphql-jit';

export type TContext = Record<string, any>;

export interface Config {
  schema: GraphQLSchema;
  context?: TContext | ((...args: any[]) => TContext | Promise<TContext>);
  rootValue?: ((parsedQuery: DocumentNode) => any) | any;
  cache?: number | boolean;
}

export type HTTPHeaders = Record<string, string | string[] | undefined>;

export type VariableValues = { [name: string]: any };

export interface QueryBody {
  query?: string;
  variables?: VariableValues;
  operationName?: string;
}

export interface QueryRequest extends QueryBody {
  context: Record<string, any>;
  httpRequest?: {
    method: string;
  };
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
  errors: readonly GraphQLError[];
}
