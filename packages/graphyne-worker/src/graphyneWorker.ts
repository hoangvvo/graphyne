import {
  GraphyneCore,
  Config,
  QueryBody,
  renderPlayground,
  parseBodyByContentType,
  getGraphQLParams,
  QueryRequest,
} from 'graphyne-core';

interface HandlerConfig {
  path?: string;
  playground?:
    | boolean
    | {
        path: string;
      };
}

export class GraphyneWorker extends GraphyneCore {
  constructor(options: Config) {
    super(options);
  }

  async handleRequest(
    request: Request,
    url = new URL(request.url)
  ): Promise<Response> {
    let context: Record<string, any>;
    try {
      const contextFn = this.options.context || {};
      context =
        typeof contextFn === 'function' ? await contextFn(request) : contextFn;
    } catch (err) {
      err.message = `Context creation failed: ${err.message}`;
      return new Response(
        JSON.stringify({ errors: [this.formatErrorFn(err)] }),
        {
          status: err.status || 500,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
    let body: QueryBody | null = null;

    if (request.method === 'POST') {
      const oCtype = request.headers.get('content-type');
      if (oCtype) {
        try {
          body = parseBodyByContentType(await request.text(), oCtype);
        } catch (err) {
          err.status = 400;
          return new Response(
            JSON.stringify({ errors: [this.formatErrorFn(err)] }),
            {
              status: 400,
              headers: { 'content-type': 'application/json' },
            }
          );
        }
      }
    }

    const params = getGraphQLParams({
      queryParams: {
        query: url.searchParams.get('query'),
        variables: url.searchParams.get('variables'),
        operationName: url.searchParams.get('operationName'),
      },
      body,
    });
    params.httpMethod = request.method;
    params.context = context;

    return new Promise((resolve) => {
      this.runHttpQuery(params as QueryRequest, ({ status, body, headers }) =>
        resolve(new Response(body, { status, headers }))
      );
    });
  }

  createHandler(options: HandlerConfig = {}): (event: FetchEvent) => void {
    return (event) => {
      const path = options.path || '/graphql';
      const playgroundPath = options?.playground
        ? (typeof options.playground === 'object' && options.playground.path) ||
          '/playground'
        : null;
      const url = new URL(event.request.url);
      switch (url.pathname) {
        case path:
          return event.respondWith(this.handleRequest(event.request, url));
        case playgroundPath:
          return event.respondWith(
            Promise.resolve(
              new Response(
                renderPlayground({
                  endpoint: path,
                  subscriptionEndpoint: this.subscriptionPath,
                }),
                { headers: { 'content-type': 'text/html; charset=utf-8' } }
              )
            )
          );
      }
    };
  }
}
