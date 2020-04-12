import { GraphQLError, GraphQLSchema, DocumentNode } from 'graphql';
import { CompiledQuery } from 'graphql-jit';
import { IncomingMessage, ServerResponse } from 'http';

type IntegrationContext = Record<string, any>;

export interface Config<TContext = Record<string, any>, TRootValue = any> {
  schema: GraphQLSchema;
  context?: TContext | ((intergrationContext: IntegrationContext) => TContext);
  rootValue?: (parsedQuery: DocumentNode) => TRootValue | TRootValue;
  cache?: number | boolean;
}

export interface HandlerConfig {
  path?: string;
  graphiql?: boolean | GraphiQLConfig;
}

export type GraphiQLConfig =
  | boolean
  | {
      path?: string;
      defaultQuery?: string;
    };

export type HTTPHeaders = Record<string, string | string[] | undefined>;

export type VariableValues = { [name: string]: any };

export interface HTTPQueryBody {
  query?: string;
  variables?: VariableValues;
  operationName?: string;
}

export interface HttpQueryRequest extends HTTPQueryBody {
  context: IntegrationContext;
  http: {
    request: IncomingMessage;
    response: ServerResponse;
  };
}

export interface HttpQueryResponse {
  status: number;
  body: string;
  headers: HTTPHeaders;
}

export interface QueryCache {
  document: DocumentNode;
  compiledQuery: CompiledQuery;
  errors: readonly GraphQLError[];
}
