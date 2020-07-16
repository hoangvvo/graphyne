import { GraphyneCore } from 'graphyne-core';
import { IncomingMessage } from 'http';
import * as WebSocket from 'ws';
import { GRAPHQL_WS } from './messageTypes';
import { GraphyneWSOptions } from './types';
import { SubscriptionConnection } from './connection';

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

    const connection = new SubscriptionConnection(
      socket,
      request,
      graphyne,
      options
    );

    if (options?.onSubscriptionConnection)
      options.onSubscriptionConnection(connection);

    socket.on('message', (message) => {
      connection.handleMessage(message.toString());
    });
    socket.on('error', () => connection.handleConnectionClose());
    socket.on('close', () => connection.handleConnectionClose());
  };
}
