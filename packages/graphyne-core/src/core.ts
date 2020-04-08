import {
  validateSchema,
  validate,
  parse,
  getOperationAST,
  GraphQLError,
  GraphQLSchema,
  ExecutionResult,
} from 'graphql';
import { compileQuery, isCompiledQuery, CompiledQuery } from 'graphql-jit';
import lru, { Lru } from 'tiny-lru';
import {
  Config,
  QueryCache,
  HttpQueryRequest,
  HTTPHeaders,
  HttpQueryResponse,
} from './types';

function buildCache(opts: Config) {
  if (typeof opts.cache === 'number' || typeof opts.cache === 'boolean')
    throw new TypeError('opts.cache must either be a number or boolean');
  if (typeof opts.cache === 'number') return lru(opts.cache);
  else if (opts.cache === false) return null;
  else return lru(1024);
}

function createResponse(
  code: number,
  body: ExecutionResult,
  headers: HTTPHeaders
): HttpQueryResponse {
  return {
    status: code,
    body,
    headers,
  };
}

export abstract class GraphyneServerBase {
  private lru: Lru<Pick<QueryCache, 'document' | 'compiledQuery'>> | null;
  private lruErrors: Lru<Pick<QueryCache, 'document' | 'errors'>> | null;
  private schema: GraphQLSchema;
  protected options: Config;
  constructor(options: Config) {
    this.options = options;
    this.lru = buildCache(this.options);
    this.lruErrors = buildCache(this.options);
    // construct schema and validate
    this.schema = this.options.schema;
    const schemaValidationErrors = validateSchema(this.schema);
    if (schemaValidationErrors.length > 0) {
      throw schemaValidationErrors;
    }
  }

  protected async runHTTPQuery(
    requestCtx: HttpQueryRequest
  ): Promise<HttpQueryResponse> {
    let context;
    let rootValue = {};
    let document;
    let compiledQuery: CompiledQuery | ExecutionResult;

    let headers: HTTPHeaders = { 'Content-Type': 'application/json' };

    const {
      query,
      variables,
      operationName,
      context: integrationContext,
      http: { method },
    } = requestCtx;

    if (!query) {
      return createResponse(
        400,
        { errors: [new GraphQLError('request does not contain query')] },
        headers
      );
    }

    const { context: contextFn, rootValue: rootValueFn } = this.options;

    // Get graphql-jit compiled query and parsed document
    let cached = this.lru !== null && this.lru.get(query);

    if (cached) {
      compiledQuery = cached.compiledQuery;
      document = cached.document;
    } else {
      const errCached = this.lruErrors !== null && this.lruErrors.get(query);
      if (errCached) {
        return createResponse(400, { errors: errCached.errors }, headers);
      }

      try {
        document = parse(query);
      } catch (syntaxErr) {
        return createResponse(
          400,
          {
            errors: [syntaxErr],
          },
          headers
        );
      }

      const validationErrors = validate(this.schema, document);
      if (validationErrors.length > 0) {
        if (this.lruErrors) {
          // cache the error here
          this.lruErrors.set(query, {
            document,
            errors: validationErrors,
          });
        }
        return createResponse(
          400,
          {
            errors: validationErrors,
          },
          headers
        );
      }

      compiledQuery = compileQuery(this.schema, document, operationName);
    }

    if (!isCompiledQuery(compiledQuery)) {
      return createResponse(500, compiledQuery, headers);
    }

    // TODO: Add support for caching multi-operation document
    if (!cached && this.lru && !operationName) {
      // save compiled query to cache
      this.lru.set(query, {
        document,
        compiledQuery,
      });
    }

    // Mutation is not allowed with GET request
    if (method === 'GET') {
      const operation = getOperationAST(document, operationName)?.operation;
      if (operation !== 'query') {
        return createResponse(
          405,
          {
            errors: [
              new GraphQLError(
                `Operation ${operation} cannot be performed via a GET request`
              ),
            ],
          },
          headers
        );
      }
    }

    if (contextFn) {
      try {
        if (typeof contextFn === 'function') {
          context = await contextFn(integrationContext);
        } else if (typeof contextFn === 'object') {
          context = contextFn;
        } else {
          throw new TypeError('opts.context must be an object or function');
        }
      } catch (err) {
        // send statusCode attached to err if exists
        return createResponse(
          err.status || 500,
          {
            errors: [err],
          },
          headers
        );
      }
    } else {
      context = integrationContext;
    }

    if (rootValueFn) {
      if (typeof rootValueFn === 'function') {
        rootValue = await rootValueFn(document);
      } else {
        rootValue = rootValueFn;
      }
    }

    return createResponse(
      200,
      await compiledQuery.query(rootValue, context, variables),
      headers
    );
  }

  abstract createHandler(...args: any[]): any;
}
