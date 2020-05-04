import { RequestListener, IncomingMessage, ServerResponse } from 'http';
import {
  GraphyneServerBase,
  Config,
  QueryResponse,
  renderPlayground,
} from 'graphyne-core';
import { parseNodeRequest, getGraphQLParams } from './utils';
// @ts-ignore
import parseUrl from '@polka/url';
import { GraphQLError } from 'graphql';
import { HandlerConfig, IntegrationFunction } from './types';

const DEFAULT_PATH = '/graphql';
const DEFAULT_PLAYGROUND_PATH = '/playground';

const sendresponse = (
  result: QueryResponse,
  req: IncomingMessage,
  res: ServerResponse
) => {
  const { status, body, headers } = result;
  for (const key in headers) {
    res.setHeader(key, headers[key] as string);
  }
  res.statusCode = status;
  res.end(body);
};

const integrationfn: IntegrationFunction = (request, response) => ({
  request,
  response,
});

export class GraphyneServer extends GraphyneServerBase {
  constructor(options: Config) {
    super(options);
  }

  createHandler(options?: HandlerConfig): RequestListener | any {
    const path = options?.path || DEFAULT_PATH;
    const playgroundPath = options?.playground
      ? (typeof options.playground === 'object' && options.playground.path) ||
        DEFAULT_PLAYGROUND_PATH
      : null;
    const integrationFn = options?.integrationFn || integrationfn;
    const contextFn = this.options.context ?? {};
    return (...args: any[]) => {
      const { request, response } = integrationFn(...args);

      const sendResponse = (err: any, result: QueryResponse) =>
        options?.onResponse
          ? options.onResponse(result, ...args)
          : sendresponse(result, request, response);

      // Parse req.url
      switch (request.path || parseUrl(request, true).pathname) {
        case path:
          parseNodeRequest(request, async (err, parsedBody) => {
            if (err)
              return sendResponse(null, {
                status: err.status || 500,
                body: JSON.stringify(err),
                headers: {},
              });

            let context;
            try {
              context =
                typeof contextFn === 'function'
                  ? await contextFn(...args)
                  : contextFn;
            } catch (err) {
              return sendResponse(null, {
                status: err.status || 400,
                body: JSON.stringify({
                  errors: [
                    // TODO: More context
                    new GraphQLError(`Context creation failed: ${err.message}`),
                  ],
                }),
                headers: { 'content-type': 'application/json' },
              });
            }

            const { query, variables, operationName } = getGraphQLParams({
              queryParams: request.query || parseUrl(request, true).query || {},
              body: parsedBody,
            });
            this.runQuery(
              {
                query,
                context,
                variables,
                operationName,
                httpRequest: {
                  method: request.method as string,
                },
              },
              sendResponse
            );
          });
          break;
        case playgroundPath:
          sendResponse(null, {
            status: 200,
            body: renderPlayground({
              endpoint: path,
              subscriptionEndpoint: this.subscriptionPath,
            }),
            headers: { 'content-type': 'text/html; charset=utf-8' },
          });
          break;
        default:
          if (options?.onNoMatch) options.onNoMatch(...args);
          else
            sendResponse(null, {
              status: 404,
              body: 'not found',
              headers: { 'content-type': 'text/html; charset=utf-8' },
            });
      }
    };
  }
}
