import {
  GraphyneServerBase,
  Config,
  getGraphQLParams,
  HandlerConfig,
} from 'graphyne-core';
import { Request, Response, RequestHandler } from 'express';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestHandler {
    return (req: Request, res: Response) => {
      const context: Record<string, any> = { req, res };
      const { query, variables, operationName } =
        getGraphQLParams({ body: req.body, queryParams: req.query }) || {};
      return this.runHTTPQuery({
        query,
        context,
        variables,
        operationName,
        http: {
          headers: req.headers,
          method: req.method,
        },
      }).then(({ status, body, headers }) => {
        // set headers
        for (const key in headers) {
          const headVal = headers[key];
          if (headVal) res.append(key, headers[key]);
        }
        res.status(status).json(body);
      });
    };
  }
}
