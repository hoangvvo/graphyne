import {
  Graphyne,
  parseBodyByContentType,
  getGraphQLParams,
  HttpQueryRequest,
  TContext,
} from 'graphyne-core';
import { HandlerConfig } from './types';

export async function handleRequest(
  graphyne: Graphyne,
  request: Request,
  options: HandlerConfig = {}
): Promise<Response> {
  const url = new URL(request.url);
  let context: TContext;
  try {
    const contextFn = options.context || {};
    context =
      typeof contextFn === 'function' ? await contextFn(request) : contextFn;
  } catch (err) {
    err.message = `Context creation failed: ${err.message}`;
    return new Response(
      JSON.stringify(graphyne.formatExecutionResult({ errors: [err] })),
      {
        status: err.status || 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
  let body: Record<string, any> | null = null;

  if (request.method === 'POST') {
    const oCtype = request.headers.get('content-type');
    if (oCtype) {
      try {
        body = parseBodyByContentType(await request.text(), oCtype);
      } catch (err) {
        return new Response(err.message, {
          status: 400,
          headers: { 'content-type': 'text/plain' },
        });
      }
    }
  }

  const queryParams: { [key: string]: string } = {};
  url.searchParams.forEach((value, key) => (queryParams[key] = value));

  const params = getGraphQLParams({
    queryParams,
    body,
  }) as HttpQueryRequest;
  params.httpMethod = request.method;
  params.context = context;

  return new Promise((resolve) => {
    graphyne.runHttpQuery(params, ({ status, body, headers }) =>
      resolve(new Response(body, { status, headers }))
    );
  });
}
