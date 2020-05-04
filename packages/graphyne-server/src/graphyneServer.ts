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

      const result: QueryResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: '',
      };

      const sendResponse = () =>
        onResponse
          ? onResponse(result, ...args)
          : sendresponse(result, request, response);

      // Parse req.url
      switch (request.path || parseUrl(request, true).pathname) {
        case path:
          parseNodeRequest(request, async (err, parsedBody) => {
            if (err) {
              result.status = err.status || 500;
              result.body = JSON.stringify(new GraphQLError(err.message));
              return sendResponse();
            }

            let context;
            try {
              context =
                typeof contextFn === 'function'
                  ? await contextFn(...args)
                  : contextFn;
            } catch (err) {
              result.status = err.status || 400;
              result.body = JSON.stringify({
                errors: [
                  // TODO: More context
                  new GraphQLError(`Context creation failed: ${err.message}`),
                ],
              });
              return sendResponse();
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
              (err, queryResult) =>
                Object.assign(result, queryResult) && sendResponse()
            );
          });
          break;
        case playgroundPath:
          result.body = renderPlayground({
            endpoint: path,
            subscriptionEndpoint: this.subscriptionPath,
          });
          result.headers['content-type'] = 'text/html; charset=utf-8';
          sendResponse();
          break;
        default:
          if (onNoMatch) {
            onNoMatch(...args);
          } else {
            result.headers['content-type'] = 'text/html; charset=utf-8';
            result.status = 404;
            sendResponse();
          }
      }
    };
  }
}
