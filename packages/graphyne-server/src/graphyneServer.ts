import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  QueryResponse,
  renderPlayground,
} from 'graphyne-core';
import { parseNodeRequest, getGraphQLParams } from './utils';
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
    const path = options?.path || DEFAULT_PATH;
    const playgroundPath = options?.playground
      ? (typeof options.playground === 'object' && options.playground.path) ||
        DEFAULT_PLAYGROUND_PATH
      : null;
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
      switch (pathname) {
        case path:
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
                      new GraphQLError(
                        `Context creation failed: ${err.message}`
                      ),
                    ],
                  }),
                  headers: { 'content-type': 'application/json' },
                });
              }
            }
            const { query, variables, operationName } = getGraphQLParams({
              queryParams: req.query || parseUrl(req, true).query || {},
              body: parsedBody,
            });
            this.runQuery(
              {
                query,
                context,
                variables,
                operationName,
                httpRequest: {
                  method: req.method as string,
                },
              },
              (err, result) => sendResponse(result)
            );
          });
          break;
        case playgroundPath:
          sendResponse({
            status: 200,
            body: renderPlayground({
              endpoint: path,
              subscriptionEndpoint: this.subscriptionPath,
            }),
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
          break;
        default:
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
