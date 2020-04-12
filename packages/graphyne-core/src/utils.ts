import { IncomingMessage } from 'http';
import { VariableValues, HTTPQueryBody, HttpQueryRequest } from './types';

type GraphQLParams = Partial<HttpQueryRequest>;
type GraphQLParamsInput = {
  queryParams: Record<string, string>;
  body: HTTPQueryBody | string | undefined;
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
  }
): Promise<HTTPQueryBody> {
  return new Promise((resolve) => {
    // If body has been parsed as a keyed object, use it.
    if (typeof req.body === 'object' && !(req.body instanceof Buffer)) {
      return resolve(req.body);
    }

    // Skip requests without content types.
    if (!req.headers['content-type']) {
      return resolve({});
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
    req.on('end', () => {
      switch (ctype) {
        case 'application/graphql':
          return resolve({ query: rawBody });
        case 'application/json':
          return resolve(JSON.parse(rawBody));
        default:
          // If no Content-Type header matches, parse nothing.
          resolve({});
      }
    });
  });
}

export function safeSerialize(data?: string) {
  return data ? JSON.stringify(data).replace(/\//g, '\\/') : '';
}
