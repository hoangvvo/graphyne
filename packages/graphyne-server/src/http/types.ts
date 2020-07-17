import { IncomingMessage } from 'http';
import { ValueOrPromise } from 'graphyne-core';

export type TContext = any;

export interface HandlerConfig {
  path?: string;
  context?: TContext | ((req: IncomingMessage) => ValueOrPromise<TContext>);
}
