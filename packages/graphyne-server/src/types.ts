import { IncomingMessage } from 'http';

export type TContext = Record<string, any>;

export interface HandlerConfig {
  path?: string;
  context?: TContext | ((req: IncomingMessage) => TContext | Promise<TContext>);
}
