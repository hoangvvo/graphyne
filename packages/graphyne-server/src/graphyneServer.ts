import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  parseNodeRequest,
  getGraphQLParams,
  HandlerConfig,
  renderGraphiQL,
  resolveMaybePromise,
  QueryResponse,
  QueryBody,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';
import { GraphQLError } from 'graphql';

const DEFAULT_PATH = '/graphql';
const DEFAULT_GRAPHIQL_PATH = '/___graphql';

function sendResponse(res: ServerResponse, result: QueryResponse) {
  const { status, body, headers } = result;
  for (const key in headers) {
    const headVal = headers[key];
    if (headVal) res.setHeader(key, headVal);
  }
  res.statusCode = status;
  res.end(body);
}

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener | any {
    // Validate options
    if (options?.onNoMatch && typeof options.onNoMatch !== 'function') {
      throw new Error('createHandler: options.onNoMatch must be a function');
    }

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
      } else {
        [req, res] = args;
      }

      // Parse req.url
      const pathname = req.path || parseUrl(req, true).pathname;
      const path = options?.path ?? DEFAULT_PATH;

      return new Promise((resolve) => {
        if (pathname === path) {
          // serve GraphQL
          const contextFn = this.options.context;
          const contextVal =
            (typeof contextFn === 'function'
              ? contextFn(...args)
              : contextFn) || {};
          parseNodeRequest(req, (err, parsedBody) => {
            if (err)
              return sendResponse(res, {
                status: err.status || 500,
                body: JSON.stringify(err),
                headers: {},
              });
            const queryParams = req.query || parseUrl(req, true).query;
            const { query, variables, operationName } = getGraphQLParams({
              queryParams: queryParams || {},
              body: parsedBody,
            });
            resolveMaybePromise(contextVal, (err, context) => {
              if (err)
                return sendResponse(res, {
                  status: err.status || 500,
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
              this.runQuery(
                {
                  query,
                  context,
                  variables,
                  operationName,
                  http: {
                    request: req,
                    response: res,
                  },
                },
                (err, result) => {
                  sendResponse(res, result);
                  resolve();
                }
              );
            });
          });
        } else if (options?.graphiql) {
          // serve GraphiQL
          const graphiql = options.graphiql;
          const graphiqlPath =
            (typeof graphiql === 'object' && graphiql.path) ||
            DEFAULT_GRAPHIQL_PATH;
          if (pathname === graphiqlPath) {
            const defaultQuery =
              typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
            sendResponse(res, {
              status: 200,
              body: renderGraphiQL({ path, defaultQuery }),
              headers: {
                'content-type': 'text/html; charset=utf-8',
              },
            });
            resolve();
          }
        } else {
          // onNoMatch
          if (options?.onNoMatch) options.onNoMatch(...args);
          else
            sendResponse(res, { status: 404, body: 'not found', headers: {} });
          resolve();
        }
      });
    };
  }
}
