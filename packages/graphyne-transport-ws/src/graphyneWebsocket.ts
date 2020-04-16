import { GraphQLError, ExecutionResult, subscribe } from 'graphql';
import { QueryBody } from 'graphyne-core';
import { GraphyneServer } from 'graphyne-server';
import * as WebSocket from 'ws';
import { isAsyncIterable, forAwaitEach, createAsyncIterator } from 'iterall';
import { IncomingMessage } from 'http';
import { isCompiledQuery } from 'graphql-jit';

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
  graphyne: GraphyneServer;
}

type ContextFn =
  | Record<string, any>
  | ((initContext: InitContext) => Record<string, any>);

export class GraphyneWebSocketConnection {
  private graphyne: GraphyneServer;
  public socket: WebSocket;
  private request: IncomingMessage;
  private wss: GraphyneWebSocketServer;
  private operations: Map<
    string,
    AsyncIterator<ExecutionResult, any, undefined>
  > = new Map();
  context: Record<string, any>;
  constructor(options: GraphyneWebSocketConnectionConstruct) {
    this.context = {};
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
        this.handleGQLStart(data);
        break;
      case GQL_STOP:
        this.handleGQLStop(data.id as string);
        break;
      case GQL_CONNECTION_TERMINATE:
        this.handleConnectionClose();
        break;
      default:
        this.sendMessage(GQL_ERROR, data.id, {
          errors: [new GraphQLError('Invalid payload type')],
        });
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
        this.context =
          typeof contextFn === 'function'
            ? await contextFn(initContext)
            : contextFn;
      } else this.context = initContext;
      if (!this.context) throw new Error('Prohibited connection!');
      this.sendMessage(GQL_CONNECTION_ACK);
    } catch (e) {
      this.sendMessage(GQL_CONNECTION_ERROR, data.id, {
        errors: [e],
      });
      this.handleConnectionClose();
    }
  }

  async handleGQLStart(data: OperationMessage) {
    // https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md#gql_start
    const id = data.id as string;
    const payload = data.payload;
    try {
      if (!payload) throw new Error('Missing payload');
      const { query, variables, operationName } = payload;
      if (!query) throw new Error('Missing query');

      const { document, operation } = this.graphyne.getCompiledQuery(query);

      if (operation !== 'subscription')
        throw new GraphQLError('Not a subscription operation');

      const executionResult = await subscribe({
        schema: this.graphyne.schema,
        document,
        contextValue: this.context,
        variableValues: variables,
        operationName,
      });

      const executionIterable = isAsyncIterable(executionResult)
        ? executionResult
        : createAsyncIterator([executionResult]);

      this.operations.set(id, executionIterable);

      await forAwaitEach(
        executionIterable as any,
        (result: ExecutionResult) => {
          this.sendMessage(GQL_DATA, id, result);
        }
      ).then(
        () => {
          // Subscription is finished
          this.sendMessage(GQL_COMPLETE, id);
        },
        (e) => {
          this.sendMessage(GQL_ERROR, id, {
            errors: [e],
          });
        }
      );
    } catch (err) {
      // Unsubscribe from this operation due to errors
      this.sendMessage(GQL_DATA, id, { errors: err.errors });
      this.handleGQLStop(id);
    }
  }

  handleGQLStop(opId: string) {
    // Unsubscribe from specific operation
    const removingOperation = this.operations.get(opId);
    if (!removingOperation) return;
    removingOperation.return?.();
    this.operations.delete(opId);
  }

  handleConnectionClose(error?: any) {
    if (error) {
      this.sendMessage(GQL_CONNECTION_ERROR, null, {
        errors: [error],
      });
    }

    setTimeout(() => {
      // Unsubscribe from the whole socket
      Object.keys(this.operations).forEach((opId) => this.handleGQLStop(opId));
      // Close connection after sending error message
      this.socket.close(1011);
    }, 10);
  }

  sendMessage(type: string, id?: string | null, payload?: ExecutionResult) {
    try {
      this.socket.send(JSON.stringify({ type, id, payload }));
    } catch (e) {
      this.handleConnectionClose(e);
    }
  }
}

export class GraphyneWebSocketServer extends WebSocket.Server {
  public graphyne: GraphyneServer;
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
      connection.handleMessage(message.toString()).catch((e) => {
        connection.handleConnectionClose();
      });
    });
    socket.on('error', connection.handleConnectionClose.bind(connection));
    socket.on('close', connection.handleConnectionClose.bind(connection));
  });
  return wss;
}