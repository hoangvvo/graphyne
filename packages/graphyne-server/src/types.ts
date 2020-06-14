import { IncomingMessage, IncomingHttpHeaders } from 'http';
import { QueryResponse } from 'graphyne-core';

export interface HandlerConfig {
  onNoMatch?: (...args: any[]) => void;
  onResponse?: (
    { status, body, headers }: QueryResponse,
    ...args: any[]
  ) => void;
  onRequest?: (args: any[], done: (req: ExpectedRequest) => void) => void;
}

export type ExpectedRequest = {
  path?: string;
  query?: Record<string, string>;
  body?: any;
} & (
  | IncomingMessage
  | {
      url?: string;
      headers: IncomingHttpHeaders;
      method: string;
    }
);
