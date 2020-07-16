import {
  Graphyne,
  QueryBody,
  parseBodyByContentType,
  getGraphQLParams,
  HttpQueryRequest,
} from 'graphyne-core';
import { HandlerConfig } from './types';

export async function handleRequest(
  graphyne: Graphyne,
  request: Request,
  options?: HandlerConfig
): Promise<Response> {
  const url = new URL(request.url);
  let context: Record<string, any>;
  try {
    const contextFn = options?.context || {};
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
  let body: QueryBody | null = null;

  if (request.method === 'POST') {
    const oCtype = request.headers.get('content-type');
    if (oCtype) {
      try {
        body = parseBodyByContentType(await request.text(), oCtype);
      } catch (err) {
        err.status = 400;
        return new Response(
          JSON.stringify(graphyne.formatExecutionResult({ errors: [err] })),
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
  }) as HttpQueryRequest;
  params.httpMethod = request.method;
  params.context = context;

  return new Promise((resolve) => {
    graphyne.runHttpQuery(params, ({ status, body, headers }) =>
      resolve(new Response(body, { status, headers }))
    );
  });
}
