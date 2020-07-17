import { ValueOrPromise } from 'graphyne-core';

export type TContext = any;

export interface HandlerConfig {
  context?: TContext | ((request: Request) => ValueOrPromise<TContext>);
}
