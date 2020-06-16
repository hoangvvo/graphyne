import {
  GraphyneCore,
  Config,
  QueryResponse,
  TContext,
  QueryRequest,
  getGraphQLParams,
} from 'graphyne-core';
import { parseNodeRequest } from './utils';
import parseUrl from '@polka/url';
import { HandlerConfig, ExpectedRequest, TArgs } from './types';

export class GraphyneServer extends GraphyneCore {
  private onRequest: HandlerConfig['onRequest'];
  private onResponse: HandlerConfig['onResponse'];

  constructor(options: Config & HandlerConfig) {
    super(options);
    this.onRequest = options.onRequest;
    this.onResponse = options.onResponse;
  }

  createHandler(depreOptions?: HandlerConfig): (...args: TArgs) => void {
    if (depreOptions) {
      throw new Error(
        'Adding options to createHandler is deprecated. Please merge them into options in new GraphyneServer(options).'
      );
    }

    const that = this;
    const contextFn = (typeof this.options.context === 'function'
      ? this.options.context
      : () => this.options.context || {}) as (
      ...args: TArgs
    ) => TContext | Promise<TContext>;

    function onRequestResolve(request: ExpectedRequest, args: TArgs) {
      if (
        that.options.path &&
        (request.path || parseUrl(request, true).pathname) !== that.options.path
      ) {
        // Explicitly run on a specific path

        return sendResponse(
          { status: 404, body: 'not found', headers: {} },
          args
        );
      }
      parseNodeRequest(request, (err, body) => {
        if (err) return sendError(err, args);
        const params = getGraphQLParams({
          queryParams: request.query || parseUrl(request, true).query || {},
          body,
        }) as QueryRequest;
        params.httpMethod = request.method as string;
        onParamsParsed(params, args);
      });
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
        : args[1].writeHead(result.status, result.headers).end(result.body);
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
