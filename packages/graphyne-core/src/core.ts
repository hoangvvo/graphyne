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
import flatstr from 'flatstr';

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
  private lru: Lru<Pick<QueryCache, 'document' | 'compiledQuery'>> | null;
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
    cb: (err: Error | null, result: HttpQueryResponse) => void
  ): void {
    function createResponse(
      code: number,
      strResult: string,
      headers: HTTPHeaders
    ): void {
      cb(null, {
        status: code,
        body: flatstr(strResult),
        headers,
      });
    }

    let context: Record<string, any>;
    let rootValue = {};
    let document;
    let compiledQuery: CompiledQuery | ExecutionResult;

    let headers: HTTPHeaders = { 'Content-Type': 'application/json' };

    const {
      query,
      variables,
      operationName,
      context: integrationContext,
      http: { request },
    } = requestCtx;

    if (!query) {
      return createResponse(
        400,
        JSON.stringify({
          errors: [new GraphQLError('request does not contain query')],
        }),
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
        return createResponse(
          400,
          JSON.stringify({ errors: errCached.errors }),
          headers
        );
      }

      try {
        document = parse(query);
      } catch (syntaxErr) {
        return createResponse(
          400,
          JSON.stringify({ errors: [syntaxErr] }),
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
          JSON.stringify({ errors: validationErrors }),
          headers
        );
      }

      compiledQuery = compileQuery(this.schema, document, operationName, {
        customJSONSerializer: true,
      });
    }

    if (!isCompiledQuery(compiledQuery)) {
      // Query fail compiling
      return createResponse(500, JSON.stringify(compiledQuery), headers);
    }

    // TODO: Add support for caching multi-operation document
    if (!cached && this.lru && !operationName) {
      // save compiled query to cache
      this.lru.set(query, {
        document,
        compiledQuery,
      });
    }

    if (request.method === 'GET') {
      // Mutation is not allowed with GET request
      const operation = getOperationAST(document, operationName)?.operation;
      if (operation !== 'query') {
        return createResponse(
          405,
          JSON.stringify({
            errors: [
              new GraphQLError(
                `Operation ${operation} cannot be performed via a GET request`
              ),
            ],
          }),
          headers
        );
      }
    }

    if (rootValueFn) {
      if (typeof rootValueFn === 'function') {
        rootValue = rootValueFn(document);
      } else rootValue = rootValueFn;
    }

    (async () => {
      if (contextFn) {
        if (typeof contextFn === 'function') {
          try {
            context = await contextFn(integrationContext);
          } catch (err) {
            err.message = `Error creating context: ${err.message}`;
            return createResponse(
              err.status || 500,
              JSON.stringify({ errors: [err] }),
              headers
            );
          }
        } else context = contextFn;
      } else {
        context = integrationContext;
      }
      // create response
      createResponse(
        200,
        compiledQuery.stringify(
          await compiledQuery.query(rootValue, context, variables)
        ),
        headers
      );
    })();
  }

  abstract createHandler(...args: any[]): any;
}
