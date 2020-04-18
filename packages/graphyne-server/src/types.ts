import { IncomingMessage, ServerResponse } from 'http';
import { QueryResponse } from 'graphyne-core';
type IntegrationFunction = (
  ...args: any[]
) => {
  request: IncomingMessage;
  response: ServerResponse;
  sendResponse?: ({ status, body, headers }: QueryResponse) => void;
};

export interface HandlerConfig {
  path?: string;
  playground?:
    | boolean
    | {
        path: string;
      };
  onNoMatch?: (...args: any[]) => void;
  integrationFn?: IntegrationFunction;
}
