import { IncomingMessage } from 'http';
import { QueryBody, QueryRequest } from 'graphyne-core';

type GraphQLParams = Partial<QueryRequest>;
type GraphQLParamsInput = {
  queryParams: Record<string, string>;
  body: QueryBody | string | undefined;
};

export const getGraphQLParams = ({
  queryParams,
  body,
}: GraphQLParamsInput): GraphQLParams => ({
  query: queryParams.query || (typeof body === 'object' ? body.query : body),
  variables:
    (typeof body === 'object' && body.variables) ||
    (queryParams.variables && JSON.parse(queryParams.variables)),
  operationName:
    (typeof body === 'object' && body.operationName) ||
    queryParams.operationName,
});

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

  const oCtype = req.headers['content-type'];
  // Skip requests without content types.
  if (!oCtype) {
    return cb(null, {});
  }

  // Parse content type
  const semiIndex = oCtype.indexOf(';');
  const ctype = (semiIndex !== -1
    ? oCtype.substring(0, semiIndex)
    : oCtype
  ).trim();

  let rawBody = '';
  req.on('data', (chunk) => {
    rawBody += chunk;
  });
  req.on('error', (err) => cb(err));
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
