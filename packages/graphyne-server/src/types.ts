import { QueryResponse } from 'graphyne-core';

export interface HandlerConfig {
  onResponse?: (
    { status, body, headers }: QueryResponse,
    ...args: any[]
  ) => void;
  onRequest?: (args: any[], done: (req: ExpectedRequest) => void) => void;
}

export type CompatibleRequest = {
  query?: Record<string, string>;
  body?: any;
  path?: string;
  url?: string;
  headers: {
    'content-type'?: string;
    [key: string]: string | string[] | undefined;
  };
  method?: string;
};

export type ExpectedRequest =
  | CompatibleRequest
  | (CompatibleRequest & {
      // Node.js ReadableStream
      on(event: 'data', listener: (chunk: any) => void): any;
      on(event: 'end', listener: () => void): any;
      on(event: 'error', listener: (err: Error) => void): any;
    });
