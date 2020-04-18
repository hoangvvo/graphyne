import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  parseNodeRequest,
  getGraphQLParams,
  renderGraphiQL,
  QueryResponse,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';
import { GraphQLError } from 'graphql';
import { HandlerConfig } from './types';

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

      let sendResponse = (result: QueryResponse) => {
        const { status, body, headers } = result;
        for (const key in headers) {
          res.setHeader(key, headers[key] as string);
        }
        res.statusCode = status;
        res.end(body);
      };

      if (options?.integrationFn) {
        const {
          request: mappedRequest,
          response: mappedResponse,
          sendResponse: customSendResponse,
        } = options.integrationFn(...args);
        req = mappedRequest;
        res = mappedResponse;
        sendResponse = customSendResponse || sendResponse;
      } else [req, res] = args;

      // Parse req.url
      const pathname = req.path || parseUrl(req, true).pathname;
      const path = options?.path ?? DEFAULT_PATH;

      if (pathname === path) {
        // serve GraphQL
        parseNodeRequest(req, (err, parsedBody) => {
          if (err)
            return sendResponse({
              status: err.status || 500,
              body: JSON.stringify(err),
              headers: {},
            });
          (async () => {
            let context;
            try {
              const contextFn = this.options.context;
              if (contextFn)
                context =
                  typeof contextFn === 'function'
                    ? await contextFn(...args)
                    : contextFn;
            } catch (err) {
              return sendResponse({
                status: err.status || 500,
                body: JSON.stringify({
                  errors: [
                    // TODO: More context
                    new GraphQLError(`Context creation failed: ${err.message}`),
                  ],
                }),
                headers: { 'content-type': 'application/json' },
              });
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
                http: {
                  request: req,
                  response: res,
                },
              },
              (err, result) => sendResponse(result)
            );
          })();
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
          sendResponse({
            status: 200,
            body: renderGraphiQL({ path, defaultQuery }),
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          });
        }
      } else {
        // onNoMatch
        if (options?.onNoMatch) options.onNoMatch(...args);
        else
          sendResponse({
            status: 404,
            body: 'not found',
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          });
      }
    };
  }
}
