import { IncomingMessage } from 'http';
import { QueryBody, QueryRequest } from 'graphyne-core';

type GraphQLParams = Partial<QueryRequest>;
type GraphQLParamsInput = {
  queryParams: Record<string, string>;
  body: QueryBody | string | undefined;
};

export function getGraphQLParams({
  queryParams,
  body,
}: GraphQLParamsInput): GraphQLParams {
  const varr =
    (typeof body === 'object' && body.variables) || queryParams.variables;
  return {
    query: queryParams.query || (typeof body === 'object' ? body.query : body),
    variables: typeof varr === 'string' ? JSON.parse(varr) : varr,
    operationName:
      (typeof body === 'object' && body.operationName) ||
      queryParams.operationName,
  };
}

export function parseNodeRequest(
  req: IncomingMessage & {
    body?: any;
  },
  cb: (err: any, parsedBody?: QueryBody) => void
): void {
  // If body has been parsed as a keyed object, use it.
  if (typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    return cb(null, req.body);
  }

  // Skip requests without content types.
  if (!req.headers['content-type']) {
    return cb(null, {});
  }

  // Parse content type
  const oCtype = req.headers['content-type'];
  const semiIndex = oCtype.indexOf(';');
  const ctype = (semiIndex !== -1
    ? oCtype.substring(0, semiIndex)
    : oCtype
  ).trim();

  let rawBody = '';
  req.on('data', (chunk) => {
    rawBody += chunk;
  });
  req.on('error', cb);
  req.on('end', () => {
    switch (ctype) {
      case 'application/graphql':
        return cb(null, { query: rawBody });
      case 'application/json':
        try {
          cb(null, JSON.parse(rawBody));
        } catch (err) {
          err.status = 400;
          cb(err);
        }
        break;
      default:
        // If no Content-Type header matches, parse nothing.
        return cb(null, {});
    }
  });
}
