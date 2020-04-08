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
