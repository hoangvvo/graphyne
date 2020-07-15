import {
  GraphyneCore,
  Config,
  QueryBody,
  parseBodyByContentType,
  getGraphQLParams,
  HttpQueryRequest,
} from 'graphyne-core';

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
        JSON.stringify(this.formatExecutionResult({ errors: [err] })),
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
            JSON.stringify(this.formatExecutionResult({ errors: [err] })),
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

  createHandler(depreOptions?: any): (event: FetchEvent) => void {
    if (depreOptions) {
      throw new Error(
        'Adding options to createHandler is deprecated. Please merge them into options in new GraphyneWorker(options).'
      );
    }

    return (event) => {
      const url = new URL(event.request.url);
      if (url.pathname === (this.options.path || '/graphql'))
        return event.respondWith(this.handleRequest(event.request, url));
    };
  }
}
