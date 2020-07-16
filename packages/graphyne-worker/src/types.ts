export type TContext = Record<string, any>;

export interface HandlerConfig {
  context?: TContext | ((request: Request) => TContext | Promise<TContext>);
}
