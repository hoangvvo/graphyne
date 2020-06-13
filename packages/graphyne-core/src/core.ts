import {
  validateSchema,
  validate,
  parse,
  getOperationAST,
  GraphQLError,
  GraphQLSchema,
  ExecutionResult,
  DocumentNode,
  formatError,
  GraphQLFormattedError,
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

export class GraphyneCore {
  private lru: Lru<QueryCache> | null;
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
    this.lru = lru(1024);
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
    document?: DocumentNode;
    compiledQuery: CompiledQuery | ExecutionResult;
    operation?: string;
  } {
    const cached = this.lru !== null && this.lru.get(query);

    if (cached) {
      return cached;
    } else {
      let document;
      try {
        document = parse(query);
      } catch (syntaxErr) {
        return {
          compiledQuery: {
            errors: [syntaxErr],
          },
        };
      }

      const validationErrors = validate(this.schema, document);
      if (validationErrors.length > 0) {
        return {
          document,
          compiledQuery: {
            errors: validationErrors,
          },
        };
      }

      const operation = getOperationAST(document, operationName)?.operation;
      if (!operation)
        return {
          document,
          compiledQuery: {
            errors: [
              new GraphQLError(
                'Must provide operation name if query contains multiple operations.'
              ),
            ],
          },
        };

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

  public runHttpQuery(
    { query, variables, operationName, context, httpMethod }: QueryRequest,
    cb: (result: QueryResponse) => void
  ): void | Promise<void> {
    let compiledQuery: CompiledQuery | undefined;

    const createResponse = (code: number, obj: ExecutionResult) => {
      const o: {
        data?: ExecutionResult['data'];
        errors?: GraphQLFormattedError[];
      } = {};
      if (obj.data) o.data = obj.data;
      if (obj.errors)
        o.errors = obj.errors.map(this.options.formatError || formatError);
      const payload = (compiledQuery && isCompiledQuery(compiledQuery)
        ? compiledQuery.stringify
        : fastStringify)(o);
      flatstr(payload);
      cb({
        body: payload,
        status: code,
        headers: { 'content-type': 'application/json' },
      });
    };

    if (!query) {
      return createResponse(400, {
        errors: [new GraphQLError('Must provide query string.')],
      });
    }

    try {
      // Get graphql-jit compiled query and parsed document
      const {
        document,
        operation,
        compiledQuery: compiled,
      } = this.getCompiledQuery(query, operationName);

      if (!isCompiledQuery(compiled)) {
        // Syntax errors or validation errors
        return createResponse(400, compiled);
      }

      compiledQuery = compiled;

      if (httpMethod !== 'POST' && httpMethod !== 'GET')
        return createResponse(405, {
          errors: [
            new GraphQLError(`GraphQL only supports GET and POST requests.`),
          ],
        });
      if (httpMethod === 'GET' && operation !== 'query')
        return createResponse(405, {
          errors: [
            new GraphQLError(
              `Operation ${operation} cannot be performed via a GET request`
            ),
          ],
        });

      const result = compiledQuery.query(
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
