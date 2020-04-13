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
  if (opts.cache) {
    if (typeof opts.cache === 'number') return lru(opts.cache);
    else if (typeof opts.cache === 'boolean')
      return opts.cache ? lru(1024) : null;
    else throw new TypeError('opts.cache must either be a number or boolean');
  }
  // Default
  return lru(1024);
}

function resolveMaybePromise<T>(
  value: T | Promise<T>,
  cb: (err: any, result: T) => void
): void {
  // @ts-ignore
  if (value && typeof value.then === 'function') {
    (value as Promise<T>).then(
      (resolve: any) => cb(null, resolve),
      (reject: any) => cb(reject, reject)
    );
  } else cb(null, value as T);
}

export abstract class GraphyneServerBase {
  private lru: Lru<
    Pick<QueryCache, 'document' | 'operation' | 'compiledQuery'>
  > | null;
  private lruErrors: Lru<Pick<QueryCache, 'document' | 'errors'>> | null;
  private schema: GraphQLSchema;
  protected options: Config;
  protected DEFAULT_PATH = '/graphql';
  protected DEFAULT_GRAPHIQL_PATH = '/___graphql';
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
      throw new TypeError('opts.context must be an object or function');
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

  protected runHTTPQuery(
    requestCtx: HttpQueryRequest,
    cb: (err: any, result: HttpQueryResponse) => void
  ): void {
    let compiledQuery: CompiledQuery | ExecutionResult;
    const headers: HTTPHeaders = { 'content-type': 'application/json' };

    function createResponse(code: number, obj: ExecutionResult): void {
      const stringify = isCompiledQuery(compiledQuery)
        ? compiledQuery.stringify
        : JSON.stringify;
      cb(null, {
        status: code,
        body: stringify(obj),
        headers,
      });
    }

    let context: Record<string, any>;
    let rootValue = {};
    let document;
    let operation;

    const {
      query,
      variables,
      operationName,
      context: integrationContext,
      http: { request },
    } = requestCtx;

    if (!query) {
      return createResponse(400, {
        errors: [new GraphQLError('request does not contain query')],
      });
    }

    const { context: contextFn, rootValue: rootValueFn } = this.options;

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

    if (request.method === 'GET' && operation !== 'query') {
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

    if (contextFn) {
      if (typeof contextFn === 'function') {
        context = contextFn(integrationContext);
      } else context = contextFn;
    } else {
      context = integrationContext;
    }

    return resolveMaybePromise(context, (err, contextVal) => {
      if (err) {
        err.message = `Error creating context: ${err.message}`;
        return createResponse(err.status || 500, { errors: [err] });
      }
      return resolveMaybePromise(
        (compiledQuery as CompiledQuery).query(
          rootValue,
          contextVal,
          variables
        ),
        (err, result) => createResponse(200, result)
      );
    });
  }

  abstract createHandler(...args: any[]): any;
}
