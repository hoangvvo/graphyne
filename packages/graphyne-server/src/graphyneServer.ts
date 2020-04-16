import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  parseNodeRequest,
  getGraphQLParams,
  HandlerConfig,
  renderGraphiQL,
  resolveMaybePromise,
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

      // serve GraphQL
      const path = options?.path ?? DEFAULT_PATH;
      if (pathname === path) {
        return parseNodeRequest(req, (err, parsedBody) => {
          if (err) {
            res.statusCode = err.status || 500;
            return res.end(JSON.stringify(err));
          }
          const queryParams = req.query || parseUrl(req, true).query;
          const { query, variables, operationName } = getGraphQLParams({
            queryParams: queryParams || {},
            body: parsedBody,
          });
          const contextFn = this.options.context;
          const contextVal =
            (typeof contextFn === 'function'
              ? contextFn(...args)
              : contextFn) || {};

          return resolveMaybePromise(contextVal, (err, context) => {
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
              (err, { status, body, headers }) => {
                for (const key in headers) {
                  const headVal = headers[key];
                  if (headVal) res.setHeader(key, headVal);
                }
                res.statusCode = status;
                return res.end(body);
              }
            );
          });
        });
      }

      // serve GraphiQL
      if (options?.graphiql) {
        const graphiql = options.graphiql;
        const graphiqlPath =
          (typeof graphiql === 'object' && graphiql.path) ||
          DEFAULT_GRAPHIQL_PATH;
        if (pathname === graphiqlPath) {
          const defaultQuery =
            typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          return res.end(renderGraphiQL({ path, defaultQuery }));
        }
      }

      // onNoMatch
      if (options?.onNoMatch) {
        return options.onNoMatch(...args);
      } else {
        res.statusCode = 404;
        res.end('not found');
      }
    };
  }
}
