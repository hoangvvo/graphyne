import { GraphQL } from './core';
import { ValueOrPromise, HttpQueryRequest, HttpQueryResponse } from './types';
import flatstr from 'flatstr';
import { ExecutionResult } from 'graphql';

function createResponse(
  gql: GraphQL,
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
        : flatstr(stringify(gql.formatExecutionResult(obj))),
    status: code,
    headers,
  };
}

export function runHttpQuery(
  gql: GraphQL,
  { query, variables, operationName, context, httpMethod }: HttpQueryRequest
): ValueOrPromise<HttpQueryResponse> {
  if (!query) {
    return createResponse(gql, 400, 'Must provide query string.');
  }

  const cachedOrResult = gql.getCachedGQL(query, operationName);

  if (!('document' in cachedOrResult)) {
    return createResponse(gql, 400, cachedOrResult);
  }

  const { document, operation, jit } = cachedOrResult;

  if (httpMethod !== 'POST' && httpMethod !== 'GET')
    return createResponse(
      gql,
      405,
      `GraphQL only supports GET and POST requests.`
    );
  if (httpMethod === 'GET' && operation !== 'query')
    return createResponse(
      gql,
      405,
      `Operation ${operation} cannot be performed via a GET request.`
    );

  const result = gql.execute({
    jit,
    document: document,
    contextValue: context,
    variableValues: variables,
  });

  return 'then' in result
    ? result.then((resolvedResult) =>
        createResponse(gql, 200, resolvedResult, jit.stringify)
      )
    : createResponse(gql, 200, result, jit.stringify);
}
