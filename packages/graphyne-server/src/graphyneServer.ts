import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  parseNodeRequest,
  getGraphQLParams,
  QueryResponse,
  renderPlayground,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';
import { GraphQLError } from 'graphql';
import { HandlerConfig } from './types';

const DEFAULT_PATH = '/graphql';
const DEFAULT_PLAYGROUND_PATH = '/playground';

const sendresponse = (
  result: QueryResponse,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const { status, body, headers } = result;
  for (const key in headers) {
    res.setHeader(key, headers[key] as string);
  }
  res.statusCode = status;
  res.end(body);
};

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener | any {
    return (...args: any[]) => {
      // Integration mapping

      let req: IncomingMessage & {
        path?: string;
        query?: Record<string, string>;
      };
      let res: ServerResponse;

      if (options?.integrationFn) {
        const {
          request: mappedRequest,
          response: mappedResponse,
        } = options.integrationFn(...args);
        req = mappedRequest;
        res = mappedResponse;
      } else [req, res] = args;

      const sendResponse = (result: QueryResponse) =>
        options?.onResponse
          ? options.onResponse(result, ...args)
          : sendresponse(result, req, res);

      // Parse req.url
      const pathname = req.path || parseUrl(req, true).pathname;
      const path = options?.path ?? DEFAULT_PATH;

      const playground = options?.playground;
      const playgroundPath =
        (typeof playground === 'object' && playground.path) ||
        DEFAULT_PLAYGROUND_PATH;

      if (pathname === path) {
        // serve GraphQL
        parseNodeRequest(req, async (err, parsedBody) => {
          if (err)
            return sendResponse({
              status: err.status || 500,
              body: JSON.stringify(err),
              headers: {},
            });

          let context;

          const contextFn = this.options.context;
          if (contextFn) {
            try {
              context =
                typeof contextFn === 'function'
                  ? await contextFn(...args)
                  : contextFn;
            } catch (err) {
              return sendResponse({
                status: err.status || 400,
                body: JSON.stringify({
                  errors: [
                    // TODO: More context
                    new GraphQLError(`Context creation failed: ${err.message}`),
                  ],
                }),
                headers: { 'content-type': 'application/json' },
              });
            }
          }
          const queryParams = req.query || parseUrl(req, true).query;
          const { query, variables, operationName } = getGraphQLParams({
            queryParams: queryParams || {},
            body: parsedBody,
          });
          this.runQuery(
            {
              query,
              context,
              variables,
              operationName,
              http: { request: req, response: res },
            },
            (err, result) => sendResponse(result)
          );
        });
      } else if (playground && pathname === playgroundPath) {
        sendResponse({
          status: 200,
          body: renderPlayground({
            endpoint: path,
            subscriptionEndpoint: this.subscriptionPath,
          }),
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      } else {
        if (options?.onNoMatch) options.onNoMatch(...args);
        else
          sendResponse({
            status: 404,
            body: 'not found',
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
      }
    };
  }
}
