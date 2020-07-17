import { GraphQLParams, ValueOrPromise } from 'graphyne-core';
import * as WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { SubscriptionConnection } from './connection';

export type TContext = any;

export type ConnectionParams = Record<string, any>;

export interface OperationMessage {
  id?: string;
  payload?: GraphQLParams | ConnectionParams;
  type: string;
}

export interface InitContext {
  connectionParams: ConnectionParams;
  socket: WebSocket;
  request: IncomingMessage;
}

export interface GraphyneWSOptions {
  context?: TContext | ((initContext: InitContext) => ValueOrPromise<TContext>);
  onSubscriptionConnection?: (connection: SubscriptionConnection) => void;
}
