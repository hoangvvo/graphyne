import { IncomingMessage } from 'http';
import { QueryResponse } from 'graphyne-core';

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
