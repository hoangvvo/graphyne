import { RequestListener, ServerResponse } from 'http';
import {
  GraphyneCore,
  Config,
  QueryResponse,
  renderPlayground,
  TContext,
  QueryRequest,
  getGraphQLParams,
} from 'graphyne-core';
import { parseNodeRequest } from './utils';
import parseUrl from '@polka/url';
import { HandlerConfig, ExpectedRequest } from './types';

export class GraphyneServer extends GraphyneCore {
  private onRequest: HandlerConfig['onRequest'];
  private onNoMatch: HandlerConfig['onNoMatch'];
  private onResponse: HandlerConfig['onResponse'];

  constructor(options: Config & HandlerConfig) {
    super(options);
    this.onRequest = options.onRequest;
    this.onNoMatch = options.onNoMatch;
    this.onResponse = options.onResponse;
  }

  createHandler(depreOptions?: HandlerConfig): RequestListener | any {
    if (depreOptions) {
      throw new Error(
        'Adding options to createHandler is deprecated. Please merge them into options in new GraphyneServer(options).'
      );
    }

    const path = this.options.path || '/graphql';
    const playgroundPath = this.options.playground
      ? (typeof this.options.playground === 'object' &&
          this.options.playground.path) ||
        '/playground'
      : null;

    const that = this;
    const contextFn = (typeof this.options.context === 'function'
      ? this.options.context
      : () => this.options.context || {}) as (
      ...args: TArgs
    ) => TContext | Promise<TContext>;

    type TArgs = any[];

    function onRequestResolve(request: ExpectedRequest, args: TArgs) {
      switch (request.path || parseUrl(request, true).pathname) {
        case path:
          parseNodeRequest(request, (err, body) => {
            if (err) return sendError(err, args);
            const params = getGraphQLParams({
              queryParams: request.query || parseUrl(request, true).query || {},
              body,
            }) as QueryRequest;
            params.httpMethod = request.method as string;
            onParamsParsed(params, args);
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
          that.onNoMatch
            ? that.onNoMatch(...args)
            : sendResponse(
                { body: 'not found', status: 404, headers: {} },
                args
              );
      }
    }

    function onParamsParsed(params: QueryRequest, args: TArgs) {
      try {
        const context = (params.context = contextFn(...args));
        'then' in context
          ? context.then(
              (resolvedCtx: TContext) => {
                params.context = resolvedCtx;
                that.runHttpQuery(params, (result) =>
                  sendResponse(result, args)
                );
              },
              (error: any) => {
                error.message = `Context creation failed: ${error.message}`;
                sendError(error, args);
              }
            )
          : that.runHttpQuery(params, (result) => sendResponse(result, args));
      } catch (error) {
        error.message = `Context creation failed: ${error.message}`;
        sendError(error, args);
      }
    }

    function sendResponse(result: QueryResponse, args: TArgs) {
      that.onResponse
        ? that.onResponse(result, ...args)
        : (args[1] as ServerResponse)
            .writeHead(result.status, result.headers)
            .end(result.body);
    }

    function sendError(error: any, args: TArgs) {
      sendResponse(
        {
          status: error.status || 500,
          body: JSON.stringify({ errors: [that.formatErrorFn(error)] }),
          headers: { 'content-type': 'application/json' },
        },
        args
      );
    }

    return (...args: TArgs) =>
      this.onRequest
        ? this.onRequest(args, (req) => onRequestResolve(req, args))
        : onRequestResolve(args[0], args);
  }
}
