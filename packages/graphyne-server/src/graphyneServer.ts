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

const DEFAULT_PATH = '/graphql';
const DEFAULT_GRAPHIQL_PATH = '/___graphql';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener {
    return (...args: any[]) => {
      // Integration mapping
      const req: IncomingMessage & {
        path: string;
        query: Record<string, string>;
      } = args[0];
      const res: ServerResponse = args[1];

      // Parse req.url
      let pathname = req.path;
      let queryParams = req.query;
      if (!pathname || !queryParams) {
        const parsedUrl = parseUrl(req, true);
        pathname = parsedUrl.pathname;
        queryParams = parsedUrl.queryParams;
      }

      // serve GraphQL
      const path = options?.path ?? DEFAULT_PATH;
      if (pathname === path) {
        return parseNodeRequest(req, (err, parsedBody) => {
          if (err) {
            res.statusCode = err.status || 500;
            return res.end(Buffer.from(err));
          }
          const { query, variables, operationName } = getGraphQLParams({
            queryParams: queryParams || {},
            body: parsedBody,
          });
          const contextFn = this.options.context;
          const context = contextFn
            ? Promise.resolve(
                typeof contextFn === 'function' ? contextFn(...args) : contextFn
              )
            : {};

          return resolveMaybePromise(context, (err, contextVal) => {
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
      // server GraphiQL
      if (options?.graphiql) {
        const graphiql = options.graphiql;
        const graphiqlPath =
          (typeof graphiql === 'object' && graphiql.path) ||
          DEFAULT_GRAPHIQL_PATH;
        if (pathname === graphiqlPath) {
          const defaultQuery =
            typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(renderGraphiQL({ path, defaultQuery }));
        }
      }
      // onNoMatch
      // TODO: Allow user defined response
      res.statusCode = 404;
      res.end('not found');
    };
  }
}
