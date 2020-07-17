import { IncomingMessage } from 'http';
import { ValueOrPromise, TContext } from 'graphyne-core';

export interface HandlerConfig {
  path?: string;
  context?: TContext | ((req: IncomingMessage) => ValueOrPromise<TContext>);
}
