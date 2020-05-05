import { IncomingMessage, ServerResponse } from 'http';
import { QueryResponse } from 'graphyne-core';

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
  integrationFn?: IntegrationFunction;
}
