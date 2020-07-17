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
  createSourceEventStream,
  SubscriptionArgs,
  GraphQLArgs,
  ExecutionArgs,
} from 'graphql';
// FIXME: Dangerous import
import mapAsyncIterator from 'graphql/subscription/mapAsyncIterator';
import { compileQuery, isCompiledQuery, CompiledQuery } from 'graphql-jit';
import lru, { Lru } from 'tiny-lru';
import {
  Config,
  QueryCache,
  HttpQueryRequest,
  HttpQueryResponse,
  FormattedExecutionResult,
  ValueOrPromise,
} from './types';
import flatstr from 'flatstr';
import { isAsyncIterable } from './utils';

export class Graphyne {
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
    const cacheKey = `${query}:${operationName || ''}`;

    const cached = this.lru.get(cacheKey);

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
      if (this.lru && isCompiledQuery(compiledQuery)) {
        this.lru.set(cacheKey, {
          document,
          compiledQuery,
          operation,
        });
      }

      return { operation, compiledQuery, document };
    }
  }

  public runHttpQuery(
    { query, variables, operationName, context, httpMethod }: HttpQueryRequest,
    cb: (result: HttpQueryResponse) => void
  ): void {
    const createResponse = (
      code: number,
      obj: ExecutionResult | string,
      stringify = JSON.stringify,
      headers: Record<string, string> = typeof obj === 'string'
        ? { 'content-type': 'text/plain' }
        : { 'content-type': 'application/json' }
    ) =>
      cb({
        body:
          typeof obj === 'string'
            ? obj
            : flatstr(stringify(this.formatExecutionResult(obj))),
        status: code,
        headers,
      });

    if (!query) {
      return createResponse(400, 'Must provide query string.');
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
      return createResponse(
        405,
        `GraphQL only supports GET and POST requests.`
      );
    if (httpMethod === 'GET' && operation !== 'query')
      return createResponse(
        405,
        `Operation ${operation} cannot be performed via a GET request.`
      );

    const result = this.execute({
      compiledQuery,
      document: document as DocumentNode,
      contextValue: context,
      variableValues: variables,
    });

    'then' in result
      ? result.then((resolvedResult) =>
          createResponse(200, resolvedResult, compiledQuery.stringify)
        )
      : createResponse(200, result, compiledQuery.stringify);
  }

  formatExecutionResult(result: ExecutionResult): FormattedExecutionResult {
    const o: FormattedExecutionResult = {};
    if (result.data) o.data = result.data;
    if (result.errors)
      o.errors = result.errors.map(this.options.formatError || formatError);
    return o;
  }

  public async graphql({
    source,
    contextValue,
    variableValues,
    operationName,
  }: Pick<GraphQLArgs, 'contextValue' | 'variableValues' | 'operationName'> & {
    source: string;
  }): Promise<FormattedExecutionResult> {
    const { document, compiledQuery } = this.getCompiledQuery(
      source,
      operationName
    );
    return this.formatExecutionResult(
      await this.execute({
        compiledQuery,
        document: document as DocumentNode,
        contextValue,
        variableValues,
      })
    );
  }

  // Reimplements graphql/execution/execute but using jit
  execute({
    compiledQuery,
    document,
    contextValue,
    variableValues,
  }: Pick<ExecutionArgs, 'document' | 'contextValue' | 'variableValues'> & {
    compiledQuery: CompiledQuery | ExecutionResult;
  }): ValueOrPromise<ExecutionResult> {
    if (!isCompiledQuery(compiledQuery)) return compiledQuery;
    return compiledQuery.query(
      typeof this.options.rootValue === 'function'
        ? this.options.rootValue(document as DocumentNode)
        : this.options.rootValue || {},
      contextValue,
      variableValues
    );
  }

  // Reimplements graphql/subscription/subscribe but using jit
  async subscribe({
    document,
    contextValue,
    variableValues,
    operationName,
    compiledQuery,
  }: Pick<
    SubscriptionArgs,
    'document' | 'contextValue' | 'variableValues' | 'operationName'
  > & {
    compiledQuery: CompiledQuery | ExecutionResult;
  }): Promise<AsyncIterator<ExecutionResult> | ExecutionResult> {
    if (!isCompiledQuery(compiledQuery)) return compiledQuery;
    const resultOrStream = await createSourceEventStream(
      this.schema,
      document as DocumentNode,
      // FIXME: Add rootValue
      {},
      contextValue,
      variableValues || undefined,
      operationName
      // subscribeFieldResolver
    );
    return isAsyncIterable(resultOrStream)
      ? mapAsyncIterator<any, ExecutionResult>(
          resultOrStream,
          (payload) =>
            compiledQuery.query(payload, contextValue, variableValues),
          (error) => {
            if (error instanceof GraphQLError) return { errors: [error] };
            throw error;
          }
        )
      : resultOrStream;
  }
}
