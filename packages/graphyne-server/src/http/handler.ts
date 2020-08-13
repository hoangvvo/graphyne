import {
  GraphQL,
  getGraphQLParams,
  HttpQueryResponse,
  HttpQueryRequest,
  TContext,
  runHttpQuery,
} from 'graphyne-core';
import { parseBody } from './parseBody';
import parseUrl from '@polka/url';
import { HandlerConfig } from './types';
import { IncomingMessage, ServerResponse } from 'http';

export function createHandler(gql: GraphQL, options: HandlerConfig = {}) {
  function sendResponse(res: ServerResponse, result: HttpQueryResponse) {
    res.writeHead(result.status, result.headers).end(result.body);
  }
  function sendErrorResponse(res: ServerResponse, error: any) {
    sendResponse(res, {
      status: error.status || 500,
      body: JSON.stringify(gql.formatExecutionResult({ errors: [error] })),
      headers: { 'content-type': 'application/json' },
    });
  }
  return function graphyneHandler(
    req: IncomingMessage & { path?: string },
    res: ServerResponse
  ) {
    if (
      options.path &&
      (req.path || parseUrl(req, true).pathname) !== options.path
    )
      return sendResponse(res, { status: 404, body: 'not found', headers: {} });
    const runWithParams = (params: HttpQueryRequest) => {
      const result = runHttpQuery(gql, params);
      'then' in result
        ? result.then((resolved) => sendResponse(res, resolved))
        : sendResponse(res, result);
    };
    parseBody(req, (err, body) => {
      if (err) return sendErrorResponse(res, err);
      const params = getGraphQLParams({
        queryParams: parseUrl(req, true).query || {},
        body,
      }) as HttpQueryRequest;
      params.httpMethod = req.method as string;
      try {
        params.context =
          typeof options.context === 'function'
            ? options.context(req)
            : options.context || {};
        // If performance gain is little, consider doing `await`
        typeof params.context.then === 'function'
          ? (params.context as Promise<TContext>).then(
              (resolvedCtx) => {
                params.context = resolvedCtx;
                runWithParams(params);
              },
              (error) => {
                error.message = `Context creation failed: ${error.message}`;
                sendErrorResponse(res, error);
              }
            )
          : runWithParams(params);
      } catch (error) {
        error.message = `Context creation failed: ${error.message}`;
        sendErrorResponse(res, error);
      }
    });
  };
}
