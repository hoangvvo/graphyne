import {
  createServer,
  RequestListener,
  IncomingMessage,
  ServerResponse,
} from 'http';
import {
  GraphyneServerBase,
  Config,
  parseNodeRequest,
  getGraphQLParams,
  renderGraphiQL,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(): RequestListener {
    return async (req: IncomingMessage, res: ServerResponse) => {
      const { pathname, query: queryObj } = parseUrl(req, true) || {};
      const path = this.options.path || this.DEFAULT_PATH;

      // serve GraphiQL
      const graphiql = this.options.graphiql;
      const graphiqlPath =
        graphiql &&
        ((typeof graphiql === 'object' ? graphiql.path : null) ||
          this.DEFAULT_GRAPHIQL_PATH);
      if (graphiql && req.method === 'GET' && pathname === graphiqlPath) {
        const defaultQuery =
          typeof graphiql === 'object' ? graphiql.defaultQuery : undefined;
        res.writeHead(200, { 'Content-Type': 'text/html' });
        return res.end(renderGraphiQL({ path, defaultQuery }));
      }

      // serve GraphQL
      if (pathname === path) {
        // query params
        const queryParams: Record<string, string> = queryObj || {};
        // parse body
        const body = await parseNodeRequest(req);

        const context: Record<string, any> = { req, res };
        const { query, variables, operationName } = getGraphQLParams({
          queryParams,
          body,
        });

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
            if (headVal) res.setHeader(key, headVal);
          }
          res.statusCode = status;
          res.end(JSON.stringify(body));
        });
      }

      // serve 404
      res.statusCode = 404;
      res.end('not found');
    };
  }

  listen(...opts: any[]) {
    const httpServer = createServer(this.createHandler());
    httpServer.listen(...(opts.length ? opts : [{ port: 4000 }]));
  }
}
