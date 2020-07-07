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
import {
  Config,
  QueryCache,
  QueryRequest,
  QueryResponse,
  GraphQLArgs,
  FormattedExecutionResult,
} from './types';
// @ts-ignore
import flatstr from 'flatstr';

export class GraphyneCore {
  private lru: Lru<QueryCache>;
  public schema: GraphQLSchema;
  protected options: Config;

  constructor(options: Config) {
    // validate options
    if (!options) {
      throw new TypeError('Graphyne server must be initialized with options');
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
    operationName?: string | null
  ): {
    document?: DocumentNode;
    compiledQuery: CompiledQuery | ExecutionResult;
    operation?: string;
  } {
    const cached = this.lru.get(query);

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

      const compiledQuery = compileQuery(
        this.schema,
        document,
        operationName || undefined,
        {
          customJSONSerializer: true,
        }
      );

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
    ) =>
      cb({
        body: flatstr(stringify(this.formatExecutionResult(obj))),
        status: code,
        headers: { 'content-type': 'application/json' },
      });

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

    this.getExecutionResult(
      compiledQuery,
      document,
      context,
      variables,
      (result) => createResponse(200, result, compiledQuery.stringify)
    );
  }

  formatExecutionResult(result: ExecutionResult): FormattedExecutionResult {
    const o: FormattedExecutionResult = {};
    if (result.data) o.data = result.data;
    if (result.errors)
      o.errors = result.errors.map(this.options.formatError || formatError);
    return o;
  }

  private getExecutionResult(
    compiledQuery: CompiledQuery | ExecutionResult,
    document: DocumentNode | undefined,
    contextValue: Record<string, any>,
    variableValues: Record<string, any> | null | undefined,
    callback: (this: void, result: ExecutionResult) => void
  ): void {
    if (!isCompiledQuery(compiledQuery)) return callback(compiledQuery);
    const maybePromiseResult = compiledQuery.query(
      typeof this.options.rootValue === 'function'
        ? this.options.rootValue(document as DocumentNode)
        : this.options.rootValue || {},
      contextValue,
      variableValues
    );
    'then' in maybePromiseResult
      ? maybePromiseResult.then(callback)
      : callback(maybePromiseResult);
  }

  public async graphql({
    source,
    contextValue,
    variableValues,
    operationName,
  }: GraphQLArgs): Promise<FormattedExecutionResult> {
    const { document, compiledQuery } = this.getCompiledQuery(
      source,
      operationName
    );
    return new Promise<FormattedExecutionResult>((resolve) => {
      this.getExecutionResult(
        compiledQuery,
        document,
        contextValue,
        variableValues,
        (result) => resolve(this.formatExecutionResult(result))
      );
    });
  }
}
