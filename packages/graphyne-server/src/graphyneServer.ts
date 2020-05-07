import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneCore,
  Config,
  QueryResponse,
  renderPlayground,
  fastStringify,
  QueryBody,
  TContext,
} from 'graphyne-core';
import { parseNodeRequest, getGraphQLParams } from './utils';
// @ts-ignore
import parseUrl from '@polka/url';
import { HandlerConfig } from './types';

const sendresponse = (
  result: QueryResponse,
  req: IncomingMessage,
  res: ServerResponse
) => res.writeHead(result.status, result.headers).end(result.body);

const onnomatch = (res: ServerResponse) => {
  res.writeHead(404).end('not found');
};

export class GraphyneServer extends GraphyneCore {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener | any {
    return (...args: any[]) => {
      const that = this;
      const path = options?.path || '/graphql';
      const playgroundPath = options?.playground
        ? (typeof options.playground === 'object' && options.playground.path) ||
          '/playground'
        : null;

      let request: IncomingMessage & {
          path?: string;
          query?: Record<string, string>;
        },
        response: ServerResponse;

      if (options?.integrationFn) {
        const integrate = options.integrationFn(...args);
        request = integrate.request;
        response = integrate.response;
      } else [request, response] = args;
      // Parse req.url
      switch (request.path || parseUrl(request, true).pathname) {
        case path:
          return parseNodeRequest(request, onBodyParsed);
        case playgroundPath:
          return sendResponse({
            status: 200,
            body: renderPlayground({
              endpoint: path,
              subscriptionEndpoint: this.subscriptionPath,
            }),
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
        default:
          return options?.onNoMatch
            ? options.onNoMatch(...args)
            : onnomatch(response);
      }

      function sendResponse(result: QueryResponse) {
        return options?.onResponse
          ? options.onResponse(result, ...args)
          : sendresponse(result, request, response);
      }

      function sendError(error: any) {
        return sendResponse({
          status: error.status || 500,
          body: fastStringify({ errors: [error] }),
          headers: { 'content-type': 'application/json' },
        });
      }

      function onBodyParsed(parseErr: any, parsedBody?: QueryBody) {
        if (parseErr) return sendError(parseErr);
        try {
          const contextFn = that.options.context;
          const context: TContext | Promise<TContext> =
            typeof contextFn === 'function'
              ? contextFn(...args)
              : contextFn || {};
          // FIXME: Types error
          return 'then' in context
            ? context.then(
                (ctx: TContext) =>
                  onContextResolved(ctx, parsedBody as QueryBody),
                (error: any) => {
                  error.message = `Context creation failed: ${error.message}`;
                  return sendError(error);
                }
              )
            : onContextResolved(context, parsedBody as QueryBody);
        } catch (error) {
          error.message = `Context creation failed: ${error.message}`;
          return sendError(error);
        }
      }

      function onContextResolved(
        context: Record<string, any>,
        parsedBody: QueryBody
      ) {
        const params = getGraphQLParams({
          queryParams: request.query || parseUrl(request, true).query || {},
          body: parsedBody,
        });

        that.runQuery(
          {
            query: params.query,
            context,
            variables: params.variables,
            operationName: params.operationName,
            httpRequest: {
              method: request.method as string,
            },
          },
          sendResponse
        );
      }
    };
  }
}
