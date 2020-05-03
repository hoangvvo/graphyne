import { IncomingMessage, ServerResponse } from 'http';
import { QueryResponse } from 'graphyne-core';
type IntegrationFunction = (
  ...args: any[]
) => {
  request: IncomingMessage;
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
