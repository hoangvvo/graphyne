import { RequestListener } from 'http';
import {
  GraphyneCore,
  Config,
  renderPlayground,
  fastStringify,
  TContext,
} from 'graphyne-core';
// @ts-ignore
import parseUrl from '@polka/url';
// @ts-ignore
import reusify from 'reusify';
import { parseNodeRequest, getGraphQLParams } from './utils';
import { HandlerConfig, HandlerInstance } from './types';

var handlerInstance = reusify(Handler);

function Handler(this: HandlerInstance) {
  this.next = null;
  this.args = [];

  var that = this;

  this.onRequestResolve = function (request) {
    const path = that.options?.path || '/graphql';
    const playgroundPath = that.options?.playground
      ? (typeof that.options.playground === 'object' &&
          that.options.playground.path) ||
        '/playground'
      : null;
    switch (request.path || parseUrl(request, true).pathname) {
      case path:
        return parseNodeRequest(request, that.onBodyParsed);
      case playgroundPath:
        return that.sendResponse({
          status: 200,
          body: renderPlayground({
            endpoint: path,
            subscriptionEndpoint: that.subscriptionPath,
          }),
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      default:
        return that.options?.onNoMatch
          ? that.options.onNoMatch(...that.args)
          : that.sendResponse({ body: 'not found', status: 404, headers: {} });
    }
  };

  this.onBodyParsed = function (parseErr, request, parsedBody) {
    if (parseErr) return that.sendError(parseErr);
    const params = getGraphQLParams({
      queryParams: request.query || parseUrl(request, true).query || {},
      body: parsedBody,
    });
    params.httpRequest = { method: request.method as string };
    return that.onParamParsed(params);
  };

  this.onParamParsed = function (params) {
    try {
      const contextFn = that.graphyneOpt.context;
      const context: TContext | Promise<TContext> =
        typeof contextFn === 'function'
          ? contextFn(...that.args)
          : contextFn || {};
      // FIXME: Types error
      return 'then' in context
        ? context.then(
            (resolvedCtx: TContext) =>
              that.onContextResolved(resolvedCtx, params),
            (error: any) => {
              error.message = `Context creation failed: ${error.message}`;
              return that.sendError(error);
            }
          )
        : that.onContextResolved(context, params);
    } catch (error) {
      error.message = `Context creation failed: ${error.message}`;
      return that.sendError(error);
    }
  };

  this.onContextResolved = function (context, params) {
    that.runQuery(
      {
        query: params.query,
        context,
        variables: params.variables,
        operationName: params.operationName,
        httpRequest: {
          method: params.httpRequest?.method as string,
        },
      },
      that.sendResponse
    );
  };

  this.sendResponse = function (result) {
    if (that.options?.onResponse) that.options.onResponse(result, ...that.args);
    else that.args[1].writeHead(result.status, result.headers).end(result.body);
    handlerInstance.release(that);
  };

  this.sendError = function (error: any) {
    return that.sendResponse({
      status: error.status || 500,
      body: fastStringify({ errors: [error] }),
      headers: { 'content-type': 'application/json' },
    });
  };
}

export class GraphyneServer extends GraphyneCore {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener | any {
    return (...args: any[]) => {
      const obj: HandlerInstance = handlerInstance.get();
      obj.args = args;
      obj.options = options;
      obj.graphyneOpt = this.options;
      obj.runQuery = this.runQuery.bind(this);
      obj.subscriptionPath = this.subscriptionPath;
      if (options?.onRequest) options.onRequest(args, obj.onRequestResolve);
      else obj.onRequestResolve(args[0]);
    };
  }
}
