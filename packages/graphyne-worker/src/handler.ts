import {
  Graphyne,
  parseBodyByContentType,
  getGraphQLParams,
  HttpQueryRequest,
  TContext,
  runHttpQuery,
} from 'graphyne-core';
import { HandlerConfig } from './types';

export async function handleRequest(
  graphyne: Graphyne,
  request: Request,
  options: HandlerConfig = {}
): Promise<Response> {
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
  let requestBody: Record<string, any> | null = null;

  if (request.method === 'POST') {
    const oCtype = request.headers.get('content-type');
    if (oCtype) {
      try {
        requestBody = parseBodyByContentType(await request.text(), oCtype);
      } catch (err) {
        return new Response(err.message, {
          status: 400,
          headers: { 'content-type': 'text/plain' },
        });
      }
    }
  }

  const queryParams: { [key: string]: string } = {};
  new URLSearchParams(request.url.slice(request.url.indexOf('?'))).forEach(
    (value, key) => (queryParams[key] = value)
  );

  const params = getGraphQLParams({
    queryParams,
    body: requestBody,
  }) as HttpQueryRequest;
  params.httpMethod = request.method;
  params.context = context;

  const { status, body, headers } = await runHttpQuery(graphyne, params);

  return new Response(body, { status, headers });
}
