import { RequestListener } from 'http';
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
import { ExecutionResult } from 'graphql';

export class GraphyneServer extends GraphyneCore {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener | any {
    const path = options?.path || '/graphql';
    const playgroundPath = options?.playground
      ? (typeof options.playground === 'object' && options.playground.path) ||
        '/playground'
      : null;

    return (...args: any[]) => {
      const that = this;

      if (options?.onRequest) options.onRequest(args, onRequestResolve);
      else onRequestResolve(args[0]);

      function onRequestResolve(request: ExtendedRequest) {
        switch (request.path || parseUrl(request, true).pathname) {
          case path:
            return parseNodeRequest(request, (err, body) => {
              if (err) return sendError(err);
              const params = getGraphQLParams({
                queryParams:
                  request.query || parseUrl(request, true).query || {},
                body,
              }) as QueryRequest;
              params.httpMethod = request.method as string;
              return onParamParsed(params);
            });
          case playgroundPath:
            return sendResponse({
              status: 200,
              body: renderPlayground({
                endpoint: path,
                subscriptionEndpoint: that.subscriptionPath,
              }),
              headers: { 'content-type': 'text/html; charset=utf-8' },
            });
          default:
            return options?.onNoMatch
              ? options.onNoMatch(...args)
              : sendResponse({ body: 'not found', status: 404, headers: {} });
        }
      }

      function onParamParsed(params: QueryRequest) {
        try {
          const contextFn = that.options.context;
          const context: TContext | Promise<TContext> =
            typeof contextFn === 'function'
              ? contextFn(...args)
              : contextFn || {};
          // FIXME: Types error
          return 'then' in context
            ? context.then(
                (resolvedCtx: TContext) =>
                  onContextResolved(resolvedCtx, params),
                (error: any) => {
                  error.message = `Context creation failed: ${error.message}`;
                  return sendError(error);
                }
              )
            : onContextResolved(context, params);
        } catch (error) {
          error.message = `Context creation failed: ${error.message}`;
          return sendError(error);
        }
      }

      function onContextResolved(
        context: Record<string, any>,
        params: QueryRequest
      ) {
        that.runQuery(
          {
            query: params.query,
            context,
            variables: params.variables,
            operationName: params.operationName,
            httpMethod: params.httpMethod,
          },
          sendResponse
        );
      }

      function sendResponse(
        result: Omit<QueryResponse, 'rawBody'> & { rawBody?: ExecutionResult }
      ) {
        if (options?.onResponse) return options.onResponse(result, ...args);
        else
          return args[1]
            .writeHead(result.status, result.headers)
            .end(result.body);
      }

      function sendError(error: any) {
        return sendResponse({
          status: error.status || 500,
          body: fastStringify({ errors: [error] }),
          headers: { 'content-type': 'application/json' },
        });
      }
    };
  }
}
