import { IncomingMessage } from 'http';
import { QueryBody, QueryRequest } from 'graphyne-core';
import { ExpectedRequest } from './types';

type GraphQLParams = Partial<QueryRequest>;
type GraphQLParamsInput = {
  queryParams: Record<string, string>;
  body: QueryBody | null;
};

export const getGraphQLParams = ({
  queryParams,
  body,
}: GraphQLParamsInput): GraphQLParams => ({
  query: body?.query || queryParams.query,
  variables:
    body?.variables ||
    (queryParams.variables && JSON.parse(queryParams.variables)),
  operationName: body?.operationName || queryParams.operationName,
});

export function parseNodeRequest(
  req: ExpectedRequest,
  cb: (err: any, body: QueryBody | null) => void
): void {
  // If body has been parsed as a keyed object, use it.
  if (typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    return cb(null, req.body);
  }

  // Not IncomingMessage, skip parsing
  if (!('on' in req)) return cb(null, null);

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
  req.on('error', (err) => cb(err, null));
  req.on('end', () => {
    switch (ctype) {
      case 'application/graphql':
        return cb(null, { query: rawBody });
      case 'application/json':
        try {
          cb(null, JSON.parse(rawBody));
        } catch (err) {
          err.status = 400;
          cb(err, null);
        }
        break;
      default:
        // If no Content-Type header matches, parse nothing.
        return cb(null, {});
    }
  });
}
