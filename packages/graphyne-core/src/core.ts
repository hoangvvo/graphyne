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
import { Config, QueryCache, QueryRequest, QueryResponse } from './types';
// @ts-ignore
import flatstr from 'flatstr';

export class GraphyneCore {
  private lru: Lru<QueryCache> | null;
  public schema: GraphQLSchema;
  protected options: Config;
  public subscriptionPath: string = '/';

  formatErrorFn: (error: GraphQLError) => GraphQLFormattedError;

  constructor(options: Config) {
    // validate options
    if (!options) {
      throw new TypeError('Graphyne server must be initialized with options');
    }
    this.options = options;
    this.formatErrorFn = options.formatError || formatError;
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
    const createResponse = (
      code: number,
      obj: ExecutionResult,
      stringify = JSON.stringify
    ) => {
      const o: {
        data?: ExecutionResult['data'];
        errors?: GraphQLFormattedError[];
      } = {};
      if (obj.data) o.data = obj.data;
      if (obj.errors) o.errors = obj.errors.map(this.formatErrorFn);
      const payload = stringify(o);
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

    const { document, operation, compiledQuery } = this.getCompiledQuery(
      query,
      operationName
    );

    if (!isCompiledQuery(compiledQuery)) {
      // Syntax errors or validation errors
      return createResponse(400, compiledQuery);
    }

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
      ? result.then((finished) =>
          createResponse(200, finished, compiledQuery.stringify)
        )
      : createResponse(200, result, compiledQuery.stringify);
  }
}
