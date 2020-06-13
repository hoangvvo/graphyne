import { QueryBody, QueryRequest } from '.';

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
  queryParams: Record<string, string | null | undefined>;
  body: QueryBody | null;
}): Partial<QueryRequest> {
  return {
    query: body?.query || queryParams.query,
    variables:
      body?.variables ||
      (queryParams.variables && JSON.parse(queryParams.variables)),
    operationName: body?.operationName || queryParams.operationName,
  };
}
