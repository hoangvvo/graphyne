import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  parseNodeRequest,
  getGraphQLParams,
  renderGraphiQL,
  HandlerConfig,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener {
    return (req: IncomingMessage, res: ServerResponse) => {
      const path = options?.path;
      // TODO: Avoid unneccessary parsing
      const { pathname, query: queryParams } = parseUrl(req, true) || {};
      // serve GraphQL
      if (!path || pathname === path) {
        return parseNodeRequest(req, (err, parsedBody) => {
          if (err) {
            res.statusCode = err.status || 500;
            return res.end(Buffer.from(err));
          }
          const context: Record<string, any> = { req, res };
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
      }

      // serve GraphiQL
      if (options?.graphiql) {
        const graphiql = options.graphiql;
        const graphiqlPath =
          (typeof graphiql === 'object' ? graphiql.path : null) ||
          this.DEFAULT_GRAPHIQL_PATH;
        if (pathname === graphiqlPath) {
          const defaultQuery =
            typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(renderGraphiQL({ path, defaultQuery }));
        }
      }

      // serve 404
      res.statusCode = 404;
      res.end('not found');
    };
  }
}
