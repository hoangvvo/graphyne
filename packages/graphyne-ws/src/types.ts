import { QueryBody } from 'graphyne-core';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';

export type ConnectionParams = Record<string, any>;

export interface OperationMessage {
  id?: string;
  payload?: QueryBody | ConnectionParams;
  type: string;
}

export interface InitContext {
  connectionParams: ConnectionParams;
  socket: WebSocket;
  request: IncomingMessage;
}

export type ContextFn =
  | Record<string, any>
  | ((initContext: InitContext) => Record<string, any>);
