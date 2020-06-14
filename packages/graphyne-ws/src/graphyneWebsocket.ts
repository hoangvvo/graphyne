import {
  GraphQLError,
  ExecutionResult,
  subscribe,
  DocumentNode,
  GraphQLFormattedError,
} from 'graphql';
import { QueryBody, GraphyneCore } from 'graphyne-core';
import * as WebSocket from 'ws';
import { isAsyncIterable, forAwaitEach, createAsyncIterator } from 'iterall';
import { IncomingMessage } from 'http';

import {
  GQL_CONNECTION_INIT,
  GQL_CONNECTION_ACK,
  GQL_CONNECTION_ERROR,
  GQL_CONNECTION_TERMINATE,
  GQL_START,
  GQL_DATA,
  GQL_ERROR,
  GQL_COMPLETE,
  GQL_STOP,
  GRAPHQL_WS,
} from './messageTypes';

interface OperationMessage {
  id?: string;
  payload?: QueryBody;
  type: string;
}

interface GraphyneWebSocketConnectionConstruct {
  socket: WebSocket;
  request: IncomingMessage;
  wss: GraphyneWebSocketServer;
}

interface InitContext {
  connectionParams?: Record<string, any>;
  socket: WebSocket;
  request: IncomingMessage;
}

interface GraphyneWSOptions extends WebSocket.ServerOptions {
  context?: ContextFn;
  graphyne: GraphyneCore;
}

type ContextFn =
  | Record<string, any>
  | ((initContext: InitContext) => Record<string, any>);

class GraphyneWebSocketConnection {
  private graphyne: GraphyneCore;
  public socket: WebSocket;
  private request: IncomingMessage;
  private wss: GraphyneWebSocketServer;
  private operations: Map<
    string,
    AsyncIterator<ExecutionResult, any, undefined>
  > = new Map();
  contextPromise?: Promise<Record<string, any>>;
  constructor(options: GraphyneWebSocketConnectionConstruct) {
    this.socket = options.socket;
    this.wss = options.wss;
    this.graphyne = options.wss.graphyne;
    this.request = options.request;
  }

  async handleMessage(message: string) {
    let data: OperationMessage;
    try {
      data = JSON.parse(message);
    } catch (err) {
      return this.sendMessage(GQL_ERROR, null, {
        errors: [new GraphQLError('Malformed message')],
      });
    }
    switch (data.type) {
      case GQL_CONNECTION_INIT:
        this.handleConnectionInit(data);
        break;
      case GQL_START:
        // @ts-ignore
        this.handleGQLStart(data);
        break;
      case GQL_STOP:
        this.handleGQLStop(data.id as string);
        break;
      case GQL_CONNECTION_TERMINATE:
        this.handleConnectionClose();
        break;
    }
  }

  async handleConnectionInit(data: OperationMessage) {
    // https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md#gql_connection_init
    const { contextFn } = this.wss;
    const initContext: InitContext = {
      request: this.request,
      socket: this.socket,
      connectionParams: data.payload,
    };
    try {
      // resolve context
      if (contextFn) {
        this.contextPromise = Promise.resolve(
          typeof contextFn === 'function' ? contextFn(initContext) : contextFn
        );
      } else this.contextPromise = Promise.resolve(initContext);
      if (!(await this.contextPromise))
        throw new GraphQLError('Prohibited connection!');
      this.sendMessage(GQL_CONNECTION_ACK);
    } catch (err) {
      this.sendMessage(GQL_CONNECTION_ERROR, data.id, {
        errors: [err],
      });
      this.handleConnectionClose();
    }
  }

  async handleGQLStart(data: OperationMessage & { id: string }) {
    // https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md#gql_start
    const payload = data.payload;
    const { query, variables, operationName } = payload || {};

    if (!query) {
      return this.sendMessage(GQL_ERROR, data.id, {
        errors: [new GraphQLError('Must provide query string.')],
      });
    }

    const {
      document,
      operation,
      compiledQuery,
    } = this.graphyne.getCompiledQuery(query);

    if ('errors' in compiledQuery) {
      this.sendMessage(GQL_ERROR, data.id, compiledQuery);
      this.handleGQLStop(data.id);
      return;
    }

    if (operation !== 'subscription') {
      return this.sendMessage(GQL_ERROR, data.id, {
        errors: [new GraphQLError('Not a subscription operation')],
      });
    }

    const context = (await this.contextPromise) || {};

    // FIXME: This may error on server error
    const executionResult = await subscribe({
      schema: this.graphyne.schema,
      document: document as DocumentNode,
      contextValue: Object.assign(
        Object.create(Object.getPrototypeOf(context)),
        context
      ),
      variableValues: variables,
      operationName,
    });

    const executionIterable = isAsyncIterable(executionResult)
      ? executionResult
      : createAsyncIterator([executionResult]);

    this.operations.set(data.id, executionIterable);

    await forAwaitEach(executionIterable as any, (result: ExecutionResult) => {
      this.sendMessage(GQL_DATA, data.id, result);
    }).then(
      () => {
        // Subscription is finished
        this.sendMessage(GQL_COMPLETE, data.id);
      },
      (err) => {
        this.sendMessage(GQL_ERROR, data.id, {
          errors: [err],
        });
      }
    );
  }

  handleGQLStop(opId: string) {
    // Unsubscribe from specific operation
    const removingOperation = this.operations.get(opId);
    if (!removingOperation) return;
    removingOperation.return?.();
    this.operations.delete(opId);
  }

  handleConnectionClose() {
    setTimeout(() => {
      // Unsubscribe from the whole socket
      Object.keys(this.operations).forEach((opId) => this.handleGQLStop(opId));
      // Close connection after sending error message
      this.socket.close(1011);
    }, 10);
  }

  sendMessage(type: string, id?: string | null, result?: ExecutionResult) {
    const payload: {
      data?: ExecutionResult['data'];
      errors?: GraphQLFormattedError[];
    } | null = result
      ? {
          ...(result.data && { data: result.data }),
          ...(result.errors && {
            errors: result.errors.map(this.graphyne.formatErrorFn),
          }),
        }
      : null;
    this.socket.send(
      JSON.stringify({ type, ...(id && { id }), ...(payload && { payload }) })
    );
  }
}

class GraphyneWebSocketServer extends WebSocket.Server {
  public graphyne: GraphyneCore;
  public contextFn?: ContextFn;
  constructor(options: GraphyneWSOptions) {
    super(options);
    this.contextFn = options.context;
    this.graphyne = options.graphyne;
  }
}

export function startSubscriptionServer(
  options: GraphyneWSOptions
): GraphyneWebSocketServer {
  const wss = new GraphyneWebSocketServer(options);
  wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
    // Check that socket.protocol is GRAPHQL_WS
    if (
      socket.protocol === undefined ||
      socket.protocol.indexOf(GRAPHQL_WS) === -1
    )
      return socket.close(1002);
    const connection = new GraphyneWebSocketConnection({
      socket,
      request,
      wss: wss,
    });
    socket.on('message', (message) => {
      connection.handleMessage(message.toString());
    });
    socket.on('error', connection.handleConnectionClose.bind(connection));
    socket.on('close', connection.handleConnectionClose.bind(connection));
  });
  return wss;
}
