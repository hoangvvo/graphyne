import { QueryBody } from 'graphyne-core';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { SubscriptionConnection } from './connection';

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

export interface GraphyneWSOptions {
  context?:
    | Record<string, any>
    | ((initContext: InitContext) => Record<string, any>);
  onSubscriptionConnection?: (connection: SubscriptionConnection) => void;
}
