import { ExecutionResult } from 'graphql';
import { QueryBody } from '.';

export function parseBodyByContentType(rawBody: string, oCtype: string) {
  const semiIndex = oCtype.indexOf(';');
  const ctype = (semiIndex !== -1
    ? oCtype.substring(0, semiIndex)
    : oCtype
  ).trim();

  // Parse body
  switch (ctype) {
    case 'application/graphql':
      return { query: rawBody };
    case 'application/json':
      return JSON.parse(rawBody);
    default:
      // If no Content-Type header matches, parse nothing.
      return null;
  }
}

export function getGraphQLParams({
  queryParams,
  body,
}: {
  queryParams: Record<string, string | string[] | null | undefined>;
  body: Record<string, any> | null;
}): QueryBody {
  return {
    query: (body?.query || queryParams.query) as string | undefined | null,
    variables:
      body?.variables ||
      (queryParams.variables && JSON.parse(queryParams.variables as string)),
    operationName: (body?.operationName || queryParams.operationName) as
      | string
      | undefined
      | null,
  };
}

export function isAsyncIterable<
  C extends AsyncIterable<any>,
  E extends ExecutionResult
>(maybeAsyncIterable: C | E): maybeAsyncIterable is C {
  return Symbol.asyncIterator in maybeAsyncIterable;
}
