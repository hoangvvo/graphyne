import { RequestListener, ServerResponse } from 'http';
import {
  GraphyneCore,
  Config,
  QueryResponse,
  renderPlayground,
  fastStringify,
  TContext,
  QueryRequest,
} from 'graphyne-core';
import { parseNodeRequest, getGraphQLParams } from './utils';
// @ts-ignore
import parseUrl from '@polka/url';
import { HandlerConfig, ExtendedRequest } from './types';

export class GraphyneServer extends GraphyneCore {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options: HandlerConfig = {}): RequestListener | any {
    const path = options.path || '/graphql';
    const playgroundPath = options.playground
      ? (typeof options.playground === 'object' && options.playground.path) ||
        '/playground'
      : null;
    const that = this;
    const contextFn = this.options.context || {};

    type TArgs = any[];

    function onRequestResolve(request: ExtendedRequest, args: TArgs) {
      switch (request.path || parseUrl(request, true).pathname) {
        case path:
          return parseNodeRequest(request, (err, body) => {
            if (err) return sendError(err, args);
            const params = getGraphQLParams({
              queryParams: request.query || parseUrl(request, true).query || {},
              body,
            }) as QueryRequest;
            params.httpMethod = request.method as string;
            return onParamParsed(params, args);
          });
        case playgroundPath:
          return sendResponse(
            {
              status: 200,
              body: renderPlayground({
                endpoint: path,
                subscriptionEndpoint: that.subscriptionPath,
              }),
              headers: { 'content-type': 'text/html; charset=utf-8' },
            },
            args
          );
        default:
          return options.onNoMatch
            ? options.onNoMatch(...args)
            : sendResponse(
                { body: 'not found', status: 404, headers: {} },
                args
              );
      }
    }

    function onParamParsed(params: QueryRequest, args: TArgs) {
      try {
        const context: TContext | Promise<TContext> =
          typeof contextFn === 'function' ? contextFn(...args) : contextFn;
        return 'then' in context
          ? context.then(
              (resolvedCtx: TContext) =>
                onContextResolved(resolvedCtx, params, args),
              (error: any) => {
                error.message = `Context creation failed: ${error.message}`;
                return sendError(error, args);
              }
            )
          : onContextResolved(context, params, args);
      } catch (error) {
        error.message = `Context creation failed: ${error.message}`;
        return sendError(error, args);
      }
    }

    function onContextResolved(
      context: Record<string, any>,
      params: QueryRequest,
      args: TArgs
    ) {
      that.runQuery(
        {
          query: params.query,
          context,
          variables: params.variables,
          operationName: params.operationName,
          httpMethod: params.httpMethod,
        },
        (result) => sendResponse(result, args)
      );
    }

    function sendResponse(result: QueryResponse, args: TArgs) {
      if (options.onResponse) return options.onResponse(result, ...args);
      else
        return (args[1] as ServerResponse)
          .writeHead(result.status, result.headers)
          .end(result.body);
    }

    function sendError(error: any, args: TArgs) {
      return sendResponse(
        {
          status: error.status || 500,
          body: fastStringify({ errors: [error] }),
          headers: { 'content-type': 'application/json' },
        },
        args
      );
    }

    return (...args: TArgs) =>
      options.onRequest
        ? options.onRequest(args, (req) => onRequestResolve(req, args))
        : onRequestResolve(args[0], args);
  }
}
