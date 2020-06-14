import { IncomingMessage, IncomingHttpHeaders } from 'http';
import { QueryResponse } from 'graphyne-core';

export interface HandlerConfig {
  onResponse?: (
    { status, body, headers }: QueryResponse,
    ...args: any[]
  ) => void;
  onRequest?: (args: any[], done: (req: ExpectedRequest) => void) => void;
}

export type ExpectedRequest = {
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
