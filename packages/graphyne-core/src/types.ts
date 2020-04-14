import { GraphQLError, GraphQLSchema, DocumentNode } from 'graphql';
import { CompiledQuery } from 'graphql-jit';
import { IncomingMessage, ServerResponse } from 'http';

export interface Config<TContext = Record<string, any>, TRootValue = any> {
  schema: GraphQLSchema;
  context?: TContext | ((...args: any[]) => TContext);
  rootValue?: (parsedQuery: DocumentNode) => TRootValue | TRootValue;
  cache?: number | boolean;
}

export interface HandlerConfig {
  path?: string;
  graphiql?:
    | boolean
    | {
        path?: string;
        defaultQuery?: string;
      };
  onNoMatch?: (...args: any[]) => void;
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
  http?: {
    request: Pick<IncomingMessage, 'method'>;
    response: ServerResponse;
  };
}

export interface QueryResponse {
  status: number;
  body: string;
  headers: HTTPHeaders;
}

export interface QueryCache {
  operation: string;
  document: DocumentNode;
  compiledQuery: CompiledQuery;
  errors: readonly GraphQLError[];
}
