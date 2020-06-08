import { RequestListener } from 'http';
import {
  GraphyneCore,
  Config,
  QueryResponse,
  renderPlayground,
  fastStringify,
  TContext,
} from 'graphyne-core';
import { parseNodeRequest, getGraphQLParams } from './utils';
// @ts-ignore
import parseUrl from '@polka/url';
import { HandlerConfig, ExtendedRequest, HTTPQueryRequest } from './types';
import { ExecutionResult } from 'graphql';

interface HandlerContext {
  graphyne: GraphyneCore;
  args: any[];
  onResponse: HandlerConfig['onResponse'];
  onNoMatch: HandlerConfig['onNoMatch'];
  path: string;
  playgroundPath: string | null;
  contextFn: GraphyneCore['options']['context'];
}

function onRequestResolve(
  handlerContext: HandlerContext,
  request: ExtendedRequest
) {
  switch (request.path || parseUrl(request, true).pathname) {
    case handlerContext.path:
      return parseNodeRequest(request, (parseErr, parsedBody) => {
        if (parseErr) return sendError(handlerContext, parseErr);
        const params = Object.assign(
          getGraphQLParams({
            queryParams: request.query || parseUrl(request, true).query || {},
            body: parsedBody,
          }),
          { httpRequest: { method: request.method as string } }
        );
        return onParamParsed(handlerContext, params);
      });
    case handlerContext.playgroundPath:
      return sendResponse(handlerContext, {
        status: 200,
        body: renderPlayground({
          endpoint: handlerContext.path,
          subscriptionEndpoint: handlerContext.graphyne.subscriptionPath,
        }),
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    default:
      return handlerContext.onNoMatch
        ? handlerContext.onNoMatch(...handlerContext.args)
        : sendResponse(handlerContext, {
            body: 'not found',
            status: 404,
            headers: {},
          });
  }
}

function onParamParsed(
  handlerContext: HandlerContext,
  params: HTTPQueryRequest
) {
  try {
    const contextFn = handlerContext.contextFn;
    const context: TContext | Promise<TContext> =
      typeof contextFn === 'function'
        ? contextFn(...handlerContext.args)
        : contextFn || {};
    // FIXME: Types error
    return 'then' in context
      ? context.then(
          (resolvedCtx: TContext) =>
            onContextResolved(handlerContext, resolvedCtx, params),
          (error: any) => {
            error.message = `Context creation failed: ${error.message}`;
            return sendError(handlerContext, error);
          }
        )
      : onContextResolved(handlerContext, context, params);
  } catch (error) {
    error.message = `Context creation failed: ${error.message}`;
    return sendError(handlerContext, error);
  }
}

function onContextResolved(
  handlerContext: HandlerContext,
  context: Record<string, any>,
  params: HTTPQueryRequest
) {
  handlerContext.graphyne.runQuery(
    {
      query: params.query,
      context,
      variables: params.variables,
      operationName: params.operationName,
      httpRequest: params.httpRequest,
    },
    (result) => sendResponse(handlerContext, result)
  );
}

function sendResponse(
  handlerContext: HandlerContext,
  result: Omit<QueryResponse, 'rawBody'> & { rawBody?: ExecutionResult }
) {
  if (handlerContext.onResponse)
    return handlerContext.onResponse(result, ...handlerContext.args);
  else
    return handlerContext.args[1]
      .writeHead(result.status, result.headers)
      .end(result.body);
}

function sendError(handlerContext: HandlerContext, error: any) {
  return sendResponse(handlerContext, {
    status: error.status || 500,
    body: fastStringify({ errors: [error] }),
    headers: { 'content-type': 'application/json' },
  });
}

export class GraphyneServer extends GraphyneCore {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options: HandlerConfig = {}): RequestListener | any {
    const path = options?.path || '/graphql';
    const playgroundPath = options?.playground
      ? (typeof options.playground === 'object' && options.playground.path) ||
        '/playground'
      : null;

    return (...args: any[]) => {
      const handlerContext: HandlerContext = {
        graphyne: this,
        args,
        path,
        playgroundPath,
        contextFn: this.options.context,
        onResponse: options.onResponse,
        onNoMatch: options.onNoMatch,
      };
      if (options?.onRequest)
        options.onRequest(args, (req) => onRequestResolve(handlerContext, req));
      else onRequestResolve(handlerContext, args[0]);
    };
  }
}
