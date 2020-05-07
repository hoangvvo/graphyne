import { IncomingMessage, ServerResponse } from 'http';
import {
  QueryResponse,
  QueryBody,
  QueryRequest,
  Config,
  GraphyneCore,
} from 'graphyne-core';

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
    { status, body, headers }: QueryResponse,
    ...args: any[]
  ) => void;
  onRequest?: (args: any[], done: (req: IncomingMessage) => void) => void;
}

export type ExtendedRequest = IncomingMessage & {
  path?: string;
  query?: Record<string, string>;
};

export interface HandlerInstance {
  next: null;
  args: any[];
  options: HandlerConfig | undefined;
  onRequestResolve: (request: ExtendedRequest) => void;
  onBodyParsed: (
    parseErr: any,
    request: ExtendedRequest,
    parsedBody?: QueryBody
  ) => void;
  onParamParsed: (params: Partial<QueryRequest>) => void;
  onContextResolved: (
    context: Record<string, any>,
    params: Partial<QueryRequest>
  ) => void;
  sendResponse: (result: QueryResponse) => void;
  sendError: (error: any) => void;
  graphyneOpt: Config;
  runQuery: GraphyneCore['runQuery'];
  subscriptionPath: GraphyneCore['subscriptionPath'];
}
