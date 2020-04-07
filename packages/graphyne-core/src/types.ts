import {
  GraphQLError,
  GraphQLSchema,
  DocumentNode,
  ExecutionResult,
} from 'graphql';
import { CompiledQuery } from 'graphql-jit';

type IntegrationContext = Record<string, any>;

export interface Config<TContext = Record<string, any>, TRootValue = any> {
  schema: GraphQLSchema;
  context?: TContext | ((intergrationContext: IntegrationContext) => TContext);
  rootValue?: (parsedQuery: DocumentNode) => TRootValue | TRootValue;
  cache?: number | boolean;
}

export type HTTPHeaders = Record<string, string | string[] | undefined>;

interface HTTPRequest {
  method?: string;
  headers?: HTTPHeaders;
}

export type VariableValues = { [name: string]: any };

export interface HttpQueryRequest {
  query: string;
  variables?: VariableValues;
  operationName?: string;
  context: IntegrationContext;
  http: HTTPRequest;
}

export interface HttpQueryResponse {
  status: number;
  body: ExecutionResult;
  headers: HTTPHeaders;
}

export interface QueryCache {
  document: DocumentNode;
  compiledQuery: CompiledQuery;
  errors: readonly GraphQLError[];
}
