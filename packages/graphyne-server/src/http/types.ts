import { IncomingMessage } from 'http';

export type TContext = object;

export interface HandlerConfig {
  path?: string;
  context?: TContext | ((req: IncomingMessage) => TContext | Promise<TContext>);
}
