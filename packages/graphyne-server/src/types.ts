import { IncomingMessage, ServerResponse } from 'http';

export type TContext = Record<string, any>;

export interface HandlerConfig {
  path?: string;
  context?:
    | TContext
    | ((
        req: IncomingMessage,
        res: ServerResponse
      ) => TContext | Promise<TContext>);
}
