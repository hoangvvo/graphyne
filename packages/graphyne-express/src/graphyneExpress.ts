import {
  GraphyneServerBase,
  Config,
  getGraphQLParams,
  renderGraphiQL,
  parseNodeRequest,
} from 'graphyne-core';
import { Request, Response, NextFunction, RequestHandler } from 'express';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(handlerOpts?: { graphiql?: boolean }): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction) => {
      const path = this.options.path;

      // serve GraphiQL
      const graphiql = this.options.graphiql;
      const graphiqlPath = typeof graphiql === 'object' ? graphiql.path : null;
      if (
        handlerOpts?.graphiql &&
        (!graphiqlPath || req.path === graphiqlPath)
      ) {
        if (!path || !graphiql) {
          return res.send(
            'To use GraphiQL, both options.path and options.graphiql must be set when initializing GraphyneServer'
          );
        }
        const defaultQuery =
          typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderGraphiQL({ path, defaultQuery }));
      }

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

      // For connect, if path not matched
      next();
    };
  }
}
