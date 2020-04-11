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
    return async (req: Request, res: Response, next: NextFunction) => {
      const path = options?.path;

      // serve GraphQL
      if (!path || path === req.path) {
        const context: Record<string, any> = { req, res };
        const body = await parseNodeRequest(req);
        const { query, variables, operationName } = getGraphQLParams({
          body,
          queryParams: req.query as Record<string, string>,
        });

        return this.runHTTPQuery({
          query,
          context,
          variables,
          operationName,
          http: {
            request: req,
            response: res,
          },
        }).then(({ status, body, headers }) => {
          // set headers
          for (const key in headers) {
            const headVal = headers[key];
            if (headVal) res.append(key, headers[key]);
          }
          res.status(status).json(body);
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
