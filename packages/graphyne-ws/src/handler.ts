import { GraphyneCore } from 'graphyne-core';
import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import { GraphyneWebSocketConnection } from './connection';
import { GRAPHQL_WS } from './messageTypes';
import { ContextFn } from './types';

export interface GraphyneWSOptions {
  context?: ContextFn;
  onGraphyneWebSocketConnection?: (
    connection: GraphyneWebSocketConnection
  ) => void;
}

export function createHandler(
  graphyne: GraphyneCore,
  options?: GraphyneWSOptions
) {
  return function connection(socket: WebSocket, request: IncomingMessage) {
    // Check that socket.protocol is GRAPHQL_WS
    if (
      socket.protocol === undefined ||
      socket.protocol.indexOf(GRAPHQL_WS) === -1
    )
      return socket.close(1002);
    const connection = new GraphyneWebSocketConnection({
      socket,
      request,
      graphyne,
      contextFn: options?.context,
    });

    if (options?.onGraphyneWebSocketConnection)
      options.onGraphyneWebSocketConnection(connection);

    socket.on('message', (message) => {
      connection.handleMessage(message.toString());
    });
    socket.on('error', () => connection.handleConnectionClose());
    socket.on('close', () => connection.handleConnectionClose());
  };
}
