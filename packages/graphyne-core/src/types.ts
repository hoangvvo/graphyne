import {
  GraphQLError,
  GraphQLSchema,
  DocumentNode,
  GraphQLFormattedError,
} from 'graphql';
import { CompiledQuery } from 'graphql-jit';

export interface Config {
  schema: GraphQLSchema;
  rootValue?: ((parsedQuery: DocumentNode) => any) | any;
  formatError?: (error: GraphQLError) => GraphQLFormattedError;
}

export interface QueryBody {
  query?: string | null;
  variables?: Record<string, any> | null;
  operationName?: string | null;
}

export interface HttpQueryRequest extends QueryBody {
  context: Record<string, any>;
  httpMethod: string;
}

export interface HttpQueryResponse {
  status: number;
  body: string;
  headers: Record<string, string>;
}

export interface QueryCache {
  operation: string;
  document: DocumentNode;
  compiledQuery: CompiledQuery;
}

export interface GraphQLArgs {
  source: string;
  contextValue?: any;
  variableValues?: Record<string, any> | null;
  operationName?: string | null;
}

// Can be replaced with `FormattedExecutionResult` from 5.3.0
export interface FormattedExecutionResult<
  TData = { [key: string]: any },
  TExtensions = { [key: string]: any }
> {
  errors?: ReadonlyArray<GraphQLFormattedError>;
  data?: TData | null;
  extensions?: TExtensions;
}
