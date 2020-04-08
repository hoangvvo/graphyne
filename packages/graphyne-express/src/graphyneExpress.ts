import {
  GraphyneServerBase,
  Config,
  getGraphQLParams,
  renderGraphiQL,
} from 'graphyne-core';
import { Request, Response, RequestHandler } from 'express';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(handlerOpts?: { graphiql?: boolean }): RequestHandler {
    return (req: Request, res: Response) => {
      const graphiql = this.options?.graphiql;

      if (handlerOpts?.graphiql) {
        if (req.method !== 'GET') {
          return res
            .status(405)
            .send('Only GET request is accepted for GraphiQL');
        }
        if (!this.options.path || !graphiql) {
          return res.end(
            'To use GraphiQL, both options.path and options.graphiql must be set when initializing GraphyneServer'
          );
        }
        const defaultQuery =
          typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(
          renderGraphiQL({ path: this.options.path, defaultQuery })
        );
      }

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
