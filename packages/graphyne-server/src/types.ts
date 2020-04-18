import { IncomingMessage, ServerResponse } from 'http';

type IntegrationFunction = (
  ...args: any[]
) => {
  request: IncomingMessage;
  response: ServerResponse;
};

export interface HandlerConfig {
  path?: string;
  graphiql?:
    | boolean
    | {
        path?: string;
        defaultQuery?: string;
      };
  onNoMatch?: (...args: any[]) => void;
  integrationFn?: IntegrationFunction;
}
