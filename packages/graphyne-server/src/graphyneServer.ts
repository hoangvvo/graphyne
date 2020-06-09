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
          parseNodeRequest(request, (err, body) => {
            if (err) return sendError(err, args);
            const params = getGraphQLParams({
              queryParams: request.query || parseUrl(request, true).query || {},
              body,
            }) as QueryRequest;
            params.httpMethod = request.method as string;
            try {
              const context: TContext | Promise<TContext> = (params.context =
                typeof contextFn === 'function'
                  ? contextFn(...args)
                  : contextFn);
              'then' in context
                ? context.then(
                    (resolvedCtx: TContext) => {
                      params.context = resolvedCtx;
                      that.runQuery(params, (result) =>
                        sendResponse(result, args)
                      );
                    },
                    (error: any) => {
                      error.message = `Context creation failed: ${error.message}`;
                      sendError(error, args);
                    }
                  )
                : that.runQuery(params, (result) => sendResponse(result, args));
            } catch (error) {
              error.message = `Context creation failed: ${error.message}`;
              sendError(error, args);
            }
          });
          break;
        case playgroundPath:
          sendResponse(
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
          break;
        default:
          options.onNoMatch
            ? options.onNoMatch(...args)
            : sendResponse(
                { body: 'not found', status: 404, headers: {} },
                args
              );
      }
    }

    function sendResponse(result: QueryResponse, args: TArgs) {
      options.onResponse
        ? options.onResponse(result, ...args)
        : (args[1] as ServerResponse)
            .writeHead(result.status, result.headers)
            .end(result.body);
    }

    function sendError(error: any, args: TArgs) {
      sendResponse(
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
