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

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  sendResponse(res: ServerResponse, { status, body, headers }: QueryResponse) {
    for (const key in headers) {
      const headVal = headers[key];
      if (headVal) res.setHeader(key, headVal);
    }
    res.statusCode = status;
    res.end(body);
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
      const self = this;

      return new Promise((resolve) => {
        function sendResponse(
          err: any,
          { status, body, headers }: QueryResponse
        ) {
          for (const key in headers) {
            const headVal = headers[key];
            if (headVal) res.setHeader(key, headVal);
          }
          res.statusCode = status;
          res.end(body);
          resolve();
        }

        function handleRequest(err: any, parsedBody: QueryBody | undefined) {
          if (err) {
            res.statusCode = err.status || 500;
            return res.end(JSON.stringify(err));
          }
          const queryParams = req.query || parseUrl(req, true).query;
          const { query, variables, operationName } = getGraphQLParams({
            queryParams: queryParams || {},
            body: parsedBody,
          });
          const contextFn = self.options.context;
          const contextVal =
            (typeof contextFn === 'function'
              ? contextFn(...args)
              : contextFn) || {};
          resolveMaybePromise(contextVal, (err, context) => {
            if (err) {
              res.statusCode = err.status || 500;
              return res.end(
                JSON.stringify({
                  errors: [
                    new GraphQLError(`Context creation failed: ${err.message}`),
                  ],
                })
              );
            }
            self.runQuery(
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
              sendResponse
            );
          });
        }

        // serve GraphQL
        if (pathname === path) parseNodeRequest(req, handleRequest);
        // serve GraphiQL
        else if (options?.graphiql) {
          const graphiql = options.graphiql;
          const graphiqlPath =
            (typeof graphiql === 'object' && graphiql.path) ||
            DEFAULT_GRAPHIQL_PATH;
          if (pathname === graphiqlPath) {
            const defaultQuery =
              typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
            sendResponse(null, {
              status: 200,
              body: renderGraphiQL({ path, defaultQuery }),
              headers: {
                'content-type': 'text/html; charset=utf-8',
              },
            });
          }
        }
        // onNoMatch
        else {
          if (options?.onNoMatch) resolve(options.onNoMatch(...args));
          else
            sendResponse(null, { status: 404, body: 'not found', headers: {} });
        }
      });
    };
  }
}
