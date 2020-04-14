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

export abstract class GraphyneServerBase {
  private lru: Lru<
    Pick<QueryCache, 'document' | 'operation' | 'compiledQuery'>
  > | null;
  private lruErrors: Lru<Pick<QueryCache, 'document' | 'errors'>> | null;
  private schema: GraphQLSchema;
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

  protected runQuery(
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

    let rootValue = {};
    let document;
    let operation;

    const {
      query,
      variables,
      operationName,
      context,
      http: { request } = {},
    } = requestCtx;

    if (!query) {
      return createResponse(400, {
        errors: [new GraphQLError('request does not contain query')],
      });
    }

    const { rootValue: rootValueFn } = this.options;

    // Get graphql-jit compiled query and parsed document
    let cached = this.lru !== null && this.lru.get(query);

    if (cached) {
      compiledQuery = cached.compiledQuery;
      document = cached.document;
      operation = cached.operation;
    } else {
      const errCached = this.lruErrors !== null && this.lruErrors.get(query);
      if (errCached) {
        return createResponse(400, { errors: errCached.errors });
      }

      try {
        document = parse(query);
      } catch (syntaxErr) {
        return createResponse(400, { errors: [syntaxErr] });
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
        return createResponse(400, { errors: validationErrors });
      }
      operation = getOperationAST(document, operationName)?.operation;
      compiledQuery = compileQuery(this.schema, document, operationName, {
        customJSONSerializer: true,
      });
    }

    if (!isCompiledQuery(compiledQuery)) {
      // Query fail compiling
      return createResponse(500, compiledQuery);
    }

    // TODO: Add support for caching multi-operation document
    if (!cached && this.lru && operation && !operationName) {
      // save compiled query to cache
      this.lru.set(query, {
        document,
        compiledQuery,
        operation,
      });
    }

    // http.request is not available in ws
    if (request && request.method === 'GET' && operation !== 'query') {
      // Mutation is not allowed with GET request
      return createResponse(405, {
        errors: [
          new GraphQLError(
            `Operation ${operation} cannot be performed via a GET request`
          ),
        ],
      });
    }

    if (rootValueFn) {
      if (typeof rootValueFn === 'function') {
        rootValue = rootValueFn(document);
      } else rootValue = rootValueFn;
    }

    return resolveMaybePromise(
      (compiledQuery as CompiledQuery).query(rootValue, context, variables),
      (err, result) => createResponse(200, result)
    );
  }

  abstract createHandler(...args: any[]): any;
}
