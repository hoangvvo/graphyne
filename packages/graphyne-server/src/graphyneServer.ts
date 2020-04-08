import {
  createServer,
  RequestListener,
  IncomingMessage,
  ServerResponse,
} from 'http';
import {
  GraphyneServerBase,
  Config,
  HandlerConfig,
  HTTPQueryBody,
  getGraphQLParams,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';

function parseBody(
  req: IncomingMessage,
  type: string,
  parser = (bit: any) => bit
): Promise<HTTPQueryBody | string | undefined> {
  return new Promise((resolve, reject) => {
    if (type !== req.headers['content-type']) resolve();
    let bits = '';
    req
      .on('data', (x) => {
        bits += x;
      })
      .on('end', () => {
        try {
          const parsed = parser(bits);
          resolve(parsed);
        } catch (err) {
          err.code = 422;
          err.details = err.message;
          err.message = 'Invalid content';
          reject(err);
        }
      });
  });
}

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener {
    return async (req: IncomingMessage, res: ServerResponse) => {
      const { pathname, query: queryObj } = parseUrl(req, true) || {};
      const queryParams: Record<string, string> = queryObj || {};
      let body: HTTPQueryBody | string | undefined;
      body = await parseBody(req, 'application/json', JSON.parse);
      body = (await parseBody(req, 'application/graphql')) || body;

      const context: Record<string, any> = { req, res };
      const { query, variables, operationName } = getGraphQLParams({
        queryParams,
        body,
      });

      const path = options?.path || '/graphql';
      if (pathname === path) {
        // serve GraphQL API
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
      } else {
        res.statusCode = 404;
        res.end('not found');
      }
    };
  }

  listen(...opts: any[]) {
    const httpServer = createServer(this.createHandler());
    httpServer.listen(...(opts.length ? opts : [{ port: 4000 }]));
  }
}
