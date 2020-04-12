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

  async createHandler(options?: HandlerConfig): Promise<RequestHandler> {
    if (options?.graphiql && !options.path)
      throw new Error(
        'createHandler: options.path must be set to use options.graphiql'
      );

    return async (req: Request, res: Response, next: NextFunction) => {
      const path = options?.path;

      // serve GraphQL
      if (!path || path === req.path) {
        const context: Record<string, any> = { req, res };
        const { query, variables, operationName } = getGraphQLParams({
          body: await parseNodeRequest(req),
          queryParams: req.query as Record<string, string>,
        });

        const { status, body, headers } = await this.runHTTPQuery({
          query,
          context,
          variables,
          operationName,
          http: {
            request: req,
            response: res,
          },
        });

        for (const key in headers) {
          const headVal = headers[key];
          if (headVal) res.setHeader(key, headVal);
        }
        return res.status(status).end(body);
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
