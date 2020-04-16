import {
  validateSchema,
  validate,
  parse,
  getOperationAST,
  GraphQLError,
  GraphQLSchema,
  ExecutionResult,
  DocumentNode,
} from 'graphql';
import { compileQuery, isCompiledQuery, CompiledQuery } from 'graphql-jit';
import lru, { Lru } from 'tiny-lru';
import {
  Config,
  QueryCache,
  QueryRequest,
  HTTPHeaders,
  QueryResponse,
} from './types';
import { resolveMaybePromise } from './utils';

function buildCache(opts: Config) {
  if (opts.cache) {
    if (typeof opts.cache === 'number') return lru(opts.cache);
    else if (typeof opts.cache === 'boolean')
      return opts.cache ? lru(1024) : null;
    else throw new TypeError('opts.cache must either be a number or boolean');
  }
  // Default
  return lru(1024);
}

type GraphyneError = Error & {
  status?: number;
  errors?: readonly GraphQLError[];
};

function createGraphyneError({
  errors,
  status,
}: Pick<GraphyneError, 'status' | 'errors'>): GraphyneError {
  const error = new GraphQLError('Error');
  Object.assign(error, { errors, status });
  return error;
}

export abstract class GraphyneServerBase {
  private lru: Lru<
    Pick<QueryCache, 'document' | 'operation' | 'compiledQuery'>
  > | null;
  private lruErrors: Lru<Pick<QueryCache, 'document' | 'errors'>> | null;
  public schema: GraphQLSchema;
  protected options: Config;
  constructor(options: Config) {
    // validate options
    if (!options) {
      throw new TypeError('Graphyne server must be initialized with options');
    }
    if (
      options.context &&
      typeof options.context !== 'function' &&
      typeof options.context !== 'object'
    ) {
      throw new TypeError('options.context must be an object or function');
    }
    this.options = options;
    // build cache
    this.lru = buildCache(this.options);
    this.lruErrors = buildCache(this.options);
    // construct schema and validate
    this.schema = this.options.schema;
    const schemaValidationErrors = validateSchema(this.schema);
    if (schemaValidationErrors.length > 0) {
      throw schemaValidationErrors;
    }
  }

  public getCompiledQuery(
    query: string,
    operationName?: string
  ): {
    document: DocumentNode;
    compiledQuery: CompiledQuery | ExecutionResult;
    operation: string;
  } {
    let cached = this.lru !== null && this.lru.get(query);
    let document;
    if (cached) {
      return cached;
    } else {
      const errCached = this.lruErrors !== null && this.lruErrors.get(query);
      if (errCached) {
        throw createGraphyneError({
          errors: errCached.errors,
          status: 400,
        });
      }

      try {
        document = parse(query);
      } catch (syntaxErr) {
        throw createGraphyneError({
          errors: [syntaxErr],
          status: 400,
        });
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
        throw createGraphyneError({
          errors: validationErrors,
          status: 400,
        });
      }

      const operation = getOperationAST(document, operationName)?.operation;
      if (!operation)
        throw createGraphyneError({
          errors: [
            new GraphQLError(
              'Must provide operation name if query contains multiple operations.'
            ),
          ],
          status: 400,
        });

      const compiledQuery = compileQuery(this.schema, document, operationName, {
        customJSONSerializer: true,
      });

      // Cache the compiled query
      if (this.lru && !operationName && isCompiledQuery(compiledQuery)) {
        this.lru.set(query, {
          document,
          compiledQuery,
          operation,
        });
      }

      return {
        operation,
        compiledQuery,
        document,
      };
    }
  }

  public runQuery(
    requestCtx: QueryRequest,
    cb: (err: any, result: QueryResponse) => void
  ): void {
    let compiledQuery: CompiledQuery | ExecutionResult;
    const headers: HTTPHeaders = { 'content-type': 'application/json' };

    function createResponse(code: number, obj: ExecutionResult): void {
      const stringify =
        compiledQuery && isCompiledQuery(compiledQuery)
          ? compiledQuery.stringify
          : JSON.stringify;
      cb(null, {
        status: code,
        body: stringify(obj),
        headers,
      });
    }

    const {
      query,
      variables,
      operationName,
      context,
      http: { request } = {},
    } = requestCtx;

    if (!query) {
      return createResponse(400, {
        errors: [new GraphQLError('Must provide query string.')],
      });
    }

    const { rootValue: rootValueFn } = this.options;

    // Get graphql-jit compiled query and parsed document
    try {
      const { compiledQuery, document, operation } = this.getCompiledQuery(
        query,
        operationName
      );
      // http.request is not available in ws
      if (request && request.method === 'GET' && operation !== 'query') {
        // Mutation is not allowed with GET request
        throw createGraphyneError({
          status: 405,
          errors: [
            new GraphQLError(
              `Operation ${operation} cannot be performed via a GET request`
            ),
          ],
        });
      }

      let rootValue = {};
      if (rootValueFn) {
        if (typeof rootValueFn === 'function') {
          rootValue = rootValueFn(document);
        } else rootValue = rootValueFn;
      }

      return resolveMaybePromise(
        (compiledQuery as CompiledQuery).query(rootValue, context, variables),
        (err, result) => createResponse(200, result)
      );
    } catch (err) {
      createResponse(err.status ?? 500, {
        errors: err.errors,
      });
    }
  }

  abstract createHandler(...args: any[]): any;
}
