import { GraphyneCore, Config, fastStringify, QueryBody } from 'graphyne-core';

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
    let context: any;
    try {
      const contextFn = this.options.context || {};
      context =
        typeof contextFn === 'function' ? await contextFn(request) : contextFn;
    } catch (err) {
      err.message = `Context creation failed: ${err.message}`;
      return new Response(fastStringify({ errors: [err] }), {
        status: err.status || 500,
        headers: { 'content-type': 'application/json' },
      });
    }
    let body: QueryBody | undefined;

    if (request.method === 'POST') {
      const oCtype = request.headers.get('content-type');
      if (oCtype) {
        const semiIndex = oCtype.indexOf(';');
        switch (semiIndex !== -1 ? oCtype.substring(0, semiIndex) : oCtype) {
          case 'application/graphql':
            body = { query: await request.text() };
            break;
          case 'application/json':
            try {
              body = await request.json();
            } catch (err) {
              err.status = 400;
              return new Response(fastStringify({ errors: [err] }), {
                status: 400,
                headers: { 'content-type': 'application/json' },
              });
            }
            break;
        }
      }
    }

    return new Promise((resolve) => {
      this.runQuery(
        {
          query: url.searchParams.get('query') || body?.query,
          context,
          variables:
            JSON.parse(url.searchParams.get('variables') || '') ||
            body?.variables,
          operationName:
            url.searchParams.get('operationName') || body?.operationName,
          httpRequest: {
            method: request.method,
          },
        },
        ({ status, body, headers }) => new Response(body, { status, headers })
      );
    });
  }

  createHandler(options: HandlerConfig) {
    return (event: FetchEvent) => {
      const url = new URL(event.request.url);
      event.respondWith(this.handleRequest(event.request, url));
    };
  }
}
