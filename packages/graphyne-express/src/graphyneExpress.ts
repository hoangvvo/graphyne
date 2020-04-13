import {
  GraphyneServerBase,
  Config,
  getGraphQLParams,
  renderGraphiQL,
  parseNodeRequest,
  HandlerConfig,
} from 'graphyne-core';
import { Request, Response, NextFunction, RequestHandler } from 'express';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestHandler {
    if (options?.graphiql && !options.path)
      throw new Error(
        'createHandler: options.path must be set to use options.graphiql'
      );

    return (req: Request, res: Response, next: NextFunction) => {
      const path = options?.path;

      // serve GraphQL
      if (!path || path === req.path) {
        return parseNodeRequest(req, (err, parsedBody) => {
          const context: Record<string, any> = { req, res };
          const { query, variables, operationName } = getGraphQLParams({
            body: parsedBody,
            queryParams: req.query as Record<string, string>,
          });

          this.runHTTPQuery(
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
              res.status(status).end(body);
            }
          );
        });
      }

      // serve GraphiQL
      if (options?.graphiql) {
        const graphiql = options.graphiql;
        const graphiqlPath =
          typeof graphiql === 'object' ? graphiql.path : null;
        if (!graphiqlPath || req.path === graphiqlPath) {
          const defaultQuery =
            typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(renderGraphiQL({ path, defaultQuery }));
        }
      }

      // If path not matched
      next();
    };
  }
}
