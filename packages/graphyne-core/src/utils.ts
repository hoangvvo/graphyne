import { IncomingMessage } from 'http';
import { VariableValues, QueryBody, QueryRequest } from './types';

type GraphQLParams = Partial<QueryRequest>;
type GraphQLParamsInput = {
  queryParams: Record<string, string>;
  body: QueryBody | string | undefined;
};

export function getGraphQLParams({
  queryParams,
  body,
}: GraphQLParamsInput): GraphQLParams {
  let variables: VariableValues[] | undefined;
  const query =
    queryParams.query || (typeof body === 'object' ? body.query : body);
  const varr =
    (typeof body === 'object' && body.variables) || queryParams.variables;
  if (varr) {
    variables = typeof varr === 'string' ? JSON.parse(varr) : varr;
  }
  const operationName =
    (typeof body === 'object' && body.operationName) ||
    queryParams.operationName;
  return { query, variables, operationName };
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

export function safeSerialize(data?: string) {
  return data ? JSON.stringify(data).replace(/\//g, '\\/') : '';
}
