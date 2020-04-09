import { IncomingMessage, IncomingHttpHeaders } from 'http';
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

export async function parseNodeRequest(
  req: IncomingMessage & {
    body?: any;
  }
): Promise<HTTPQueryBody> {
  // If body has been parsed as a keyed object, use it.
  if (typeof req.body === 'object' && !(req.body instanceof Buffer)) {
    return req.body;
  }

  // Skip requests without content types.
  if (!req.headers['content-type']) {
    return {};
  }

  // Parse content type
  const oCtype = req.headers['content-type'];
  const semiIndex = oCtype.indexOf(';');
  const ctype = (semiIndex !== -1
    ? oCtype.substring(0, semiIndex)
    : oCtype
  ).trim();

  const rawBody: string = await new Promise((resolve) => {
    let bits = '';
    req
      .on('data', (x) => {
        bits += x;
      })
      .on('end', () => {
        resolve(bits);
      });
  });

  switch (ctype) {
    case 'application/graphql':
      return { query: rawBody };
    case 'application/json':
      try {
        return JSON.parse(rawBody);
      } catch (error) {
        // Do nothing
      }
      // TODO: It might be better to throw an error
      return {};
    default:
      // If no Content-Type header matches, parse nothing.
      return {};
  }
}

export function safeSerialize(data?: string) {
  return data ? JSON.stringify(data).replace(/\//g, '\\/') : '';
}
