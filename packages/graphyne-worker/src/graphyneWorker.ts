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
      const variablesParam = url.searchParams.get('variables');
      this.runQuery(
        {
          query: body?.query || url.searchParams.get('query') || undefined,
          context,
          variables:
            body?.variables || (variablesParam && JSON.parse(variablesParam)),
          operationName:
            body?.operationName ||
            url.searchParams.get('operationName') ||
            undefined,
          httpRequest: {
            method: request.method,
          },
        },
        ({ status, body, headers }) =>
          resolve(new Response(body, { status, headers }))
      );
    });
  }

  // @ts-ignore
  createHandler(options: HandlerConfig): (event: FetchEvent) => void {
    // @ts-ignore
    return (event: FetchEvent) => {
      const url = new URL(event.request.url);
      event.respondWith(this.handleRequest(event.request, url));
    };
  }
}
