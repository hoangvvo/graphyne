import {
  GraphyneCore,
  getGraphQLParams,
  HttpQueryResponse,
  HttpQueryRequest,
} from 'graphyne-core';
import { parseBody } from './parseBody';
import parseUrl from '@polka/url';
import { HandlerConfig, TContext } from '../types';
import { IncomingMessage, ServerResponse } from 'http';

export function createHandler(
  graphyne: GraphyneCore,
  options: HandlerConfig = {}
) {
  function sendResponse(res: ServerResponse, result: HttpQueryResponse) {
    res.writeHead(result.status, result.headers).end(result.body);
  }
  function sendErrorResponse(res: ServerResponse, error: any) {
    sendResponse(res, {
      status: error.status || 500,
      body: JSON.stringify(graphyne.formatExecutionResult({ errors: [error] })),
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
    parseBody(req, (err, body) => {
      if (err) return sendErrorResponse(res, err);
      const params = getGraphQLParams({
        queryParams: parseUrl(req, true).query,
        body,
      }) as HttpQueryRequest;
      params.httpMethod = req.method as string;
      try {
        params.context =
          typeof options.context === 'function'
            ? options.context(req, res)
            : options.context || {};
        'then' in params.context
          ? params.context.then(
              (resolvedCtx: TContext) => {
                params.context = resolvedCtx;
                graphyne.runHttpQuery(params, (result) =>
                  sendResponse(res, result)
                );
              },
              (error: any) => {
                error.message = `Context creation failed: ${error.message}`;
                sendErrorResponse(res, error);
              }
            )
          : graphyne.runHttpQuery(params, (result) =>
              sendResponse(res, result)
            );
      } catch (error) {
        error.message = `Context creation failed: ${error.message}`;
        sendErrorResponse(res, error);
      }
    });
  };
}
