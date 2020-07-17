import { ValueOrPromise, TContext } from 'graphyne-core';

export interface HandlerConfig {
  context?: TContext | ((request: Request) => ValueOrPromise<TContext>);
}
