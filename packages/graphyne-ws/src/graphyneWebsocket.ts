import { GraphQLError, ExecutionResult } from 'graphql';
import {
  QueryBody,
  GraphyneCore,
  FormattedExecutionResult,
} from 'graphyne-core';
import { isCompiledQuery } from 'graphql-jit';
import * as WebSocket from 'ws';
import { isAsyncIterable, forAwaitEach, createAsyncIterator } from 'iterall';
import { IncomingMessage } from 'http';
import { EventEmitter } from 'events';
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

type ConnectionParams = Record<string, any>;

interface OperationMessage {
  id?: string;
  payload?: QueryBody | ConnectionParams;
  type: string;
}

interface GraphyneWebSocketConnectionConstruct {
  socket: WebSocket;
  request: IncomingMessage;
  wss: GraphyneWebSocketServer;
}

interface InitContext {
  connectionParams: ConnectionParams;
  socket: WebSocket;
  request: IncomingMessage;
}

export interface GraphyneWSOptions extends WebSocket.ServerOptions {
  context?: ContextFn;
  graphyne: GraphyneCore;
  onGraphyneWebSocketConnection?: (
    connection: GraphyneWebSocketConnection
  ) => void;
}

type ContextFn =
  | Record<string, any>
  | ((initContext: InitContext) => Record<string, any>);

export interface GraphyneWebSocketConnection {
  on(
    event: 'connection_init',
    listener: (connectionParams: ConnectionParams) => void
  ): this;
  emit(event: 'connection_init', payload: ConnectionParams): boolean;
  on(
    event: 'subscription_start',
    listener: (
      id: string,
      payload: QueryBody,
      context: Record<string, any>
    ) => void
  ): this;
  emit(
    event: 'subscription_start',
    id: string,
    payload: QueryBody,
    context: Record<string, any>
  ): boolean;
  on(event: 'subscription_stop', listener: (id: string) => void): this;
  emit(event: 'subscription_stop', id: string): boolean;
  on(event: 'connection_terminate', listener: () => void): this;
  emit(event: 'connection_terminate'): boolean;
}

export class GraphyneWebSocketConnection extends EventEmitter {
  private graphyne: GraphyneCore;
  public socket: WebSocket;
  private request: IncomingMessage;
  private wss: GraphyneWebSocketServer;
  private operations: Map<string, AsyncIterator<ExecutionResult>> = new Map();
  contextPromise?: Promise<Record<string, any>>;
  constructor(options: GraphyneWebSocketConnectionConstruct) {
    super();
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
      connectionParams: data.payload as ConnectionParams,
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
      // Emit
      this.emit('connection_init', data.payload as ConnectionParams);
    } catch (err) {
      this.sendMessage(GQL_CONNECTION_ERROR, data.id, {
        errors: [err],
      });
      this.handleConnectionClose();
    }
  }

  async handleGQLStart(
    data: OperationMessage & { id: string; payload: QueryBody }
  ) {
    // https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md#gql_start
    const { query, variables, operationName } = data.payload;

    if (!query) {
      return this.sendMessage(GQL_ERROR, data.id, {
        errors: [new GraphQLError('Must provide query string.')],
      });
    }

    const context = (await this.contextPromise) || {};

    const executionResult = await this.graphyne
      .subscribe({
        source: query,
        contextValue: context,
        variableValues: variables,
        operationName,
      })
      .catch((errorOrResult: Error | ExecutionResult) => {
        if ('errors' in errorOrResult || 'data' in errorOrResult) {
          this.sendMessage(GQL_ERROR, data.id, errorOrResult);
        }
        return null;
      });

    if (!executionResult) return this.handleGQLStop(data.id);

    const executionIterable = isAsyncIterable(executionResult)
      ? (executionResult as AsyncIterator<ExecutionResult>)
      : createAsyncIterator<ExecutionResult>([
          executionResult as ExecutionResult,
        ]);

    this.operations.set(data.id, executionIterable);

    // Emit
    this.emit('subscription_start', data.id, data.payload, context);

    // @ts-ignore
    await forAwaitEach(executionIterable, (result: ExecutionResult) => {
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
    // Emit
    this.emit('subscription_stop', opId);
    this.operations.delete(opId);
  }

  handleConnectionClose() {
    setTimeout(() => {
      // Unsubscribe from the whole socket
      Object.keys(this.operations).forEach((opId) => this.handleGQLStop(opId));
      // Close connection after sending error message
      this.socket.close(1011);
      // Emit
      this.emit('connection_terminate');
    }, 10);
  }

  sendMessage(type: string, id?: string | null, result?: ExecutionResult) {
    const payload: FormattedExecutionResult | null = result
      ? this.graphyne.formatExecutionResult(result)
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

    if (options.onGraphyneWebSocketConnection)
      options.onGraphyneWebSocketConnection(connection);

    socket.on('message', (message) => {
      connection.handleMessage(message.toString());
    });
    socket.on('error', () => connection.handleConnectionClose());
    socket.on('close', () => connection.handleConnectionClose());
  });
  return wss;
}
