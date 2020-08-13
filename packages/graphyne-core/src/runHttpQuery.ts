import { Graphyne } from './core';
import { ValueOrPromise, HttpQueryRequest, HttpQueryResponse } from './types';
import flatstr from 'flatstr';
import { ExecutionResult } from 'graphql';

function createResponse(
  graphyne: Graphyne,
  code: number,
  obj: ExecutionResult | string,
  stringify = JSON.stringify,
  headers: Record<string, string> = typeof obj === 'string'
    ? { 'content-type': 'text/plain' }
    : { 'content-type': 'application/json' }
): HttpQueryResponse {
  return {
    body:
      typeof obj === 'string'
        ? obj
        : flatstr(stringify(graphyne.formatExecutionResult(obj))),
    status: code,
    headers,
  };
}

export function runHttpQuery(
  graphyne: Graphyne,
  { query, variables, operationName, context, httpMethod }: HttpQueryRequest
): ValueOrPromise<HttpQueryResponse> {
  if (!query) {
    return createResponse(graphyne, 400, 'Must provide query string.');
  }

  const cachedOrResult = graphyne.getCachedGQL(query, operationName);

  if (!('document' in cachedOrResult)) {
    return createResponse(graphyne, 400, cachedOrResult);
  }

  const { document, operation, jit } = cachedOrResult;

  if (httpMethod !== 'POST' && httpMethod !== 'GET')
    return createResponse(
      graphyne,
      405,
      `GraphQL only supports GET and POST requests.`
    );
  if (httpMethod === 'GET' && operation !== 'query')
    return createResponse(
      graphyne,
      405,
      `Operation ${operation} cannot be performed via a GET request.`
    );

  const result = graphyne.execute({
    jit,
    document: document,
    contextValue: context,
    variableValues: variables,
  });

  return 'then' in result
    ? result.then((resolvedResult) =>
        createResponse(graphyne, 200, resolvedResult, jit.stringify)
      )
    : createResponse(graphyne, 200, result, jit.stringify);
}
