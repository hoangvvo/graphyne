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
import { HandlerConfig } from './types';

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
    const contextFn = this.options.context ?? {};
    const integrationFn = options?.integrationFn;
    const onResponse = options?.onResponse;
    const onNoMatch = options?.onNoMatch;
    return (...args: any[]) => {
      let request = args[0],
        response = args[1];

      if (integrationFn) {
        const integrate = integrationFn(...args);
        request = integrate.request;
        response = integrate.response;
      }

      const sendResponse = (result: QueryResponse) => {
        return onResponse
          ? onResponse(result, ...args)
          : sendresponse(result, request, response);
      };

      // Parse req.url
      switch (request.path || parseUrl(request, true).pathname) {
        case path:
          return parseNodeRequest(request, async (err, parsedBody) => {
            if (err) {
              return sendResponse({
                status: err.status || 500,
                body: JSON.stringify(new GraphQLError(err.message)),
                headers: { 'content-type': 'application/json' },
              });
            }

            let context;
            try {
              context =
                typeof contextFn === 'function'
                  ? await contextFn(...args)
                  : contextFn;
            } catch (err) {
              return sendResponse({
                status: err.status || 500,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  errors: [
                    // TODO: More context
                    new GraphQLError(`Context creation failed: ${err.message}`),
                  ],
                }),
              });
            }

            const params = getGraphQLParams({
              queryParams: request.query || parseUrl(request, true).query || {},
              body: parsedBody,
            });

            this.runQuery(
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
          });
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
          return onNoMatch
            ? onNoMatch(...args)
            : sendResponse({
                status: 404,
                body: 'not found',
                headers: { 'content-type': 'text/html; charset=utf-8' },
              });
      }
    };
  }
}
