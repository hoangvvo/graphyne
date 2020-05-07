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
import fastJson from 'fast-json-stringify';
import { Config, QueryCache, QueryRequest, QueryResponse } from './types';
// @ts-ignore
import flatstr from 'flatstr';

// Default stringify fallback if no graphql-jit compiled query available.
export const fastStringify = fastJson({
  type: 'object',
  properties: {
    data: {
      type: 'object',
      additionalProperties: true,
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        required: ['message'],
        properties: {
          message: { type: 'string' },
          locations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                line: { type: 'integer' },
                column: { type: 'integer' },
              },
            },
          },
          path: {
            type: 'array',
            items: { type: 'string' },
          },
          extensions: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
  },
});

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

function createGraphyneError(status: number, errors: readonly GraphQLError[]) {
  const error = new GraphQLError('Error');
  Object.assign(error, { errors, status });
  return error;
}

export class GraphyneCore {
  private lru: Lru<
    Pick<QueryCache, 'document' | 'operation' | 'compiledQuery'>
  > | null;
  private lruErrors: Lru<Pick<QueryCache, 'document' | 'errors'>> | null;
  public schema: GraphQLSchema;
  protected options: Config;
  public subscriptionPath: string = '/';
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
      if (errCached) throw createGraphyneError(400, errCached.errors);

      try {
        document = parse(query);
      } catch (syntaxErr) {
        throw createGraphyneError(400, [syntaxErr]);
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
        throw createGraphyneError(400, validationErrors);
      }

      const operation = getOperationAST(document, operationName)?.operation;
      if (!operation)
        throw createGraphyneError(400, [
          new GraphQLError(
            'Must provide operation name if query contains multiple operations.'
          ),
        ]);

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

      return { operation, compiledQuery, document };
    }
  }

  public runQuery(
    { query, variables, operationName, context, httpRequest }: QueryRequest,
    cb: (result: QueryResponse) => void
  ): void | Promise<void> {
    let compiledQuery: CompiledQuery | ExecutionResult;

    const createResponse = (code: number, obj: ExecutionResult) => {
      const payload = (compiledQuery && isCompiledQuery(compiledQuery)
        ? compiledQuery.stringify
        : fastStringify)(obj);
      flatstr(payload);
      cb({
        body: payload,
        status: code,
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      if (!query)
        throw createGraphyneError(400, [
          new GraphQLError('Must provide query string.'),
        ]);

      // Get graphql-jit compiled query and parsed document
      const {
        document,
        operation,
        compiledQuery: compiled,
      } = this.getCompiledQuery(query, operationName);
      compiledQuery = compiled;
      // http.request is not available in ws
      if (
        httpRequest &&
        httpRequest.method === 'GET' &&
        operation !== 'query'
      ) {
        // Mutation is not allowed with GET request
        return createResponse(405, {
          errors: [
            new GraphQLError(
              `Operation ${operation} cannot be performed via a GET request`
            ),
          ],
        });
      }
      const result = (compiledQuery as CompiledQuery).query(
        typeof this.options.rootValue === 'function'
          ? this.options.rootValue(document)
          : this.options.rootValue || {},
        context,
        variables
      );
      return 'then' in result
        ? result.then((finished) => createResponse(200, finished))
        : createResponse(200, result);
    } catch (err) {
      return createResponse(err.status ?? 500, {
        errors: err.errors,
      });
    }
  }
}
