import { IncomingMessage, ServerResponse } from 'http';
import { QueryResponse, QueryRequest } from 'graphyne-core';
import { ExecutionResult } from 'graphql';

export type IntegrationFunction = (
  ...args: any[]
) => {
  request: IncomingMessage & {
    path?: string;
    query?: Record<string, string>;
  };
  response: ServerResponse;
};

export interface HandlerConfig {
  path?: string;
  playground?:
    | boolean
    | {
        path: string;
      };
  onNoMatch?: (...args: any[]) => void;
  onResponse?: (
    {
      status,
      body,
      headers,
      rawBody,
    }: Omit<QueryResponse, 'rawBody'> & { rawBody?: ExecutionResult },
    ...args: any[]
  ) => void;
  onRequest?: (args: any[], done: (req: IncomingMessage) => void) => void;
}

export type ExtendedRequest = IncomingMessage & {
  path?: string;
  query?: Record<string, string>;
};

export type HTTPQueryRequest = Partial<QueryRequest> & {
  httpRequest: {
    method: string;
  };
};
