import {
  validateSchema,
  validate,
  parse,
  getOperationAST,
  GraphQLError,
  GraphQLSchema,
  ExecutionResult,
  formatError,
  createSourceEventStream,
  SubscriptionArgs,
  GraphQLArgs,
  ExecutionArgs,
} from 'graphql';
// FIXME: Dangerous import
import mapAsyncIterator from 'graphql/subscription/mapAsyncIterator';
import {
  compileQuery,
  isCompiledQuery,
  CompiledQuery,
} from '@hoangvvo/graphql-jit';
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

  // This API is internal even if it is defined as public
  public getCachedGQL(
    query: string,
    operationName?: string | null
  ): QueryCache | ExecutionResult {
    const cached = this.lru.get(query);

    if (cached) {
      return cached;
    } else {
      let document;
      try {
        document = parse(query);
      } catch (syntaxErr) {
        return {
          errors: [syntaxErr],
        };
      }

      const validationErrors = validate(this.schema, document);
      if (validationErrors.length > 0) {
        return {
          errors: validationErrors,
        };
      }

      const operation = getOperationAST(document, operationName)?.operation;
      if (!operation)
        return {
          errors: [
            new GraphQLError(
              'Must provide operation name if query contains multiple operations.'
            ),
          ],
        };

      const jit = compileQuery(
        this.schema,
        document,
        operationName || undefined
      );

      if (!isCompiledQuery(jit)) return jit;

      // Cache the compiled query
      // TODO: We are not caching multi document query right now
      if (this.lru && !operationName) {
        this.lru.set(query, {
          document,
          jit,
          operation,
        });
      }

      return { operation, jit, document };
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

    const cachedOrResult = this.getCachedGQL(query, operationName);

    if (!('document' in cachedOrResult)) {
      return createResponse(400, cachedOrResult);
    }

    const { document, operation, jit } = cachedOrResult;

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
      jit,
      document: document,
      contextValue: context,
      variableValues: variables,
    });

    'then' in result
      ? result.then((resolvedResult) =>
          createResponse(200, resolvedResult, jit.stringify)
        )
      : createResponse(200, result, jit.stringify);
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
    const cachedOrResult = this.getCachedGQL(source, operationName);
    return this.formatExecutionResult(
      'document' in cachedOrResult
        ? await this.execute({
            jit: cachedOrResult.jit,
            document: cachedOrResult.document,
            contextValue,
            variableValues,
          })
        : cachedOrResult
    );
  }

  // Reimplements graphql/execution/execute but using jit
  execute({
    jit,
    document,
    contextValue,
    variableValues,
  }: Pick<ExecutionArgs, 'document' | 'contextValue' | 'variableValues'> & {
    jit: CompiledQuery;
  }): ValueOrPromise<ExecutionResult> {
    return jit.query(
      typeof this.options.rootValue === 'function'
        ? this.options.rootValue(document)
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
    jit,
  }: Pick<
    SubscriptionArgs,
    'document' | 'contextValue' | 'variableValues' | 'operationName'
  > & {
    jit: CompiledQuery;
  }): Promise<AsyncIterator<ExecutionResult> | ExecutionResult> {
    const resultOrStream = await createSourceEventStream(
      this.schema,
      document,
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
          (payload) => jit.query(payload, contextValue, variableValues),
          (error) => {
            if (error instanceof GraphQLError) return { errors: [error] };
            throw error;
          }
        )
      : resultOrStream;
  }
}
