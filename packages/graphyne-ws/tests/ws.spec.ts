import { wsHandler } from '../src';
import { GraphyneWSOptions } from '../src/types';
import { SubscriptionConnection } from '../src/connection';
import { Graphyne, Config as GraphyneConfig } from '../../graphyne-core/src';
import { parseBody } from '../../graphyne-server/src/http/parseBody';
import WebSocket from 'ws';
import { strict as assert } from 'assert';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PubSub } from 'graphql-subscriptions';
import { createServer } from 'http';
import fetch from 'node-fetch';
import { GraphQLError } from 'graphql';

const pubsub = new PubSub();

const typeDefs = `
  type Notification {
    message: String
    dummy: String
    DO_NOT_USE_THIS_FIELD: String
  }

  type Query {
    _: String
  }

  type Mutation {
    addNotification(message: String): Notification
  }

  type Subscription {
    notificationAdded: Notification
  }
`;

const resolvers = {
  Query: {
    _: () => '',
  },
  Mutation: {
    addNotification: async (_: any, { message }: { message: string }) => {
      const notification = { message };
      await pubsub.publish('NOTIFICATION_ADDED', {
        notificationAdded: notification,
      });
      return notification;
    },
  },
  Subscription: {
    notificationAdded: {
      subscribe: () => pubsub.asyncIterator('NOTIFICATION_ADDED'),
    },
  },
  Notification: {
    dummy: ({ message }) => message,
    DO_NOT_USE_THIS_FIELD: () => {
      throw new Error('I told you so');
    },
  },
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

let serverInit;

async function startServer(
  options: { ws?: WebSocket } = {},
  graphyneOpts: Omit<GraphyneConfig, 'schema'> = {},
  graphyneWsOptions: GraphyneWSOptions = {}
) {
  const ws = options.ws || new WebSocket('ws://localhost:4000', 'graphql-ws');
  const graphyne = new Graphyne({ schema, ...graphyneOpts });
  const server = createServer((req, res) => {
    parseBody(req, async (err, body) => {
      graphyne.runHttpQuery(
        {
          query: body.query,
          variables: body.variables,
          operationName: body.operationName,
          context: {},
          httpMethod: req.method as string,
        },
        (result) =>
          res.writeHead(result.status, result.headers).end(result.body)
      );
    });
  });
  const wss = new WebSocket.Server({ server });
  // We cross test different packages
  // @ts-ignore
  wss.on('connection', wsHandler(graphyne, graphyneWsOptions));
  const client = WebSocket.createWebSocketStream(ws, {
    encoding: 'utf8',
    objectMode: true,
  });
  await new Promise((resolve) => server.listen(4000, resolve));
  return (serverInit = { server, client, ws });
}

afterEach(function () {
  if (!serverInit) return;
  const { server, client } = serverInit;
  client.end();
  server.close();
});

function sendMessageMutation() {
  return fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation {
        addNotification(message: "Hello World") {
          message
        }
      }`,
    }),
  });
}

describe('graphyne-ws: wsHandler', () => {
  it('replies with connection_ack', async () => {
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    await new Promise((resolve) => {
      client.on('data', (chunk) => {
        const json = JSON.parse(chunk);
        assert.deepStrictEqual(json, { type: 'connection_ack' });
        resolve();
      });
    });
  });
  it('sends updates via subscription', async function () {
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query: `
          subscription {
            notificationAdded {
              message
              dummy
            }
          }
        `,
        },
      })
    );
    await new Promise((resolve, reject) => {
      client.on('data', (chunk) => {
        const data = JSON.parse(chunk);
        if (data.type === 'connection_ack') {
          return sendMessageMutation();
        }
        if (data.type === 'data') {
          assert.deepStrictEqual(data, {
            type: 'data',
            id: 1,
            payload: {
              data: {
                notificationAdded: {
                  message: 'Hello World',
                  dummy: 'Hello World',
                },
              },
            },
          });
          resolve();
        }
      });
    });
  });
  it('rejects socket protocol other than graphql-ws', async () => {
    const ws = new WebSocket('ws://localhost:4000', 'graphql-subscriptions');
    const { server, client } = await startServer({ ws });
    await new Promise((resolve) =>
      ws.on('close', () => {
        resolve();
      })
    );
  });
  it('errors on malformed message', (done) => {
    startServer().then(({ server, client, ws }) => {
      client.write(`{"type":"connection_init","payload":`);
      client.on('data', (chunk) => {
        const json = JSON.parse(chunk);
        if (json.type === 'error') {
          assert.deepStrictEqual(json, {
            type: 'error',
            payload: { message: 'Malformed message' },
          });
          done();
        }
      });
    });
  });
  it('format errors using formatError', (done) => {
    startServer(
      {},
      {
        formatError: () => {
          return new GraphQLError('Internal server error');
        },
      }
    ).then(({ server, client, ws }) => {
      client.write(
        JSON.stringify({
          type: 'connection_init',
        })
      );
      client.write(
        JSON.stringify({
          id: 1,
          type: 'start',
          payload: {
            query: `
            subscription {
              notificationAdded {
                message
                DO_NOT_USE_THIS_FIELD
              }
            }
          `,
          },
        })
      );
      client.on('data', (chunk) => {
        const json = JSON.parse(chunk);
        if (json.type === 'connection_ack') {
          sendMessageMutation();
        }
        if (json.type === 'data') {
          assert.deepStrictEqual(json, {
            id: 1,
            type: 'data',
            payload: {
              data: {
                notificationAdded: {
                  DO_NOT_USE_THIS_FIELD: null,
                  message: 'Hello World',
                },
              },
              // Override "I told you so" error
              errors: [{ message: 'Internal server error' }],
            },
          });
          done();
        }
      });
    });
  });
  it('errors on empty query', async function () {
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query: null,
        },
      })
    );
    await new Promise((resolve, reject) => {
      client.on('data', (chunk) => {
        const json = JSON.parse(chunk);
        if (json.type === 'error') {
          assert.deepStrictEqual(json, {
            type: 'error',
            id: 1,
            payload: { message: 'Must provide query string.' },
          });
          resolve();
        }
      });
    });
  });
  it('resolves also queries and mutations', async function () {
    // We can also add a Query test just to be sure but Mutation one only should be sufficient
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query: `
          mutation {
            addNotification(message: "Hello World") {
              message
            }
          }
        `,
        },
      })
    );
    await new Promise((resolve, reject) => {
      let resolved = false;
      client.on('data', (chunk) => {
        const json = JSON.parse(chunk);
        if (json.type === `data`) {
          assert.deepStrictEqual(json, {
            type: 'data',
            id: 1,
            payload: { data: { addNotification: { message: 'Hello World' } } },
          });
          resolved = true;
        }
        if (json.type === 'complete' && resolved === true) {
          // It should complete the subscription immediately since it is a mutations/queries
          resolve();
        }
        return;
      });
    });
  });
  it('errors on syntax error', async () => {
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query: `
            subscription {
              NNotificationAdded {
                message
              }
            }
          `,
        },
      })
    );
    await new Promise((resolve, reject) => {
      client.on('data', (chunk) => {
        const json = JSON.parse(chunk);
        if (json.type === 'data') {
          const {
            payload: {
              errors: [{ message }],
            },
          } = json;
          assert.deepEqual(
            message,
            `Cannot query field "NNotificationAdded" on type "Subscription". Did you mean "notificationAdded"?`
          );
          resolve();
          // FIXME: Add test for Subscription is stopped after this
        }
      });
    });
  });
  it('stops subscription upon GQL_STOP', async () => {
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    client.write(
      JSON.stringify({
        id: 1,
        type: 'start',
        payload: {
          query: `
          subscription {
            notificationAdded {
              message
            }
          }
        `,
        },
      })
    );
    await new Promise((resolve, reject) => {
      client.on('data', (chunk) => {
        const data = JSON.parse(chunk);
        let timer;
        if (data.type === 'connection_ack') {
          client.write(
            JSON.stringify({
              id: 1,
              type: 'stop',
            })
          );
          sendMessageMutation().then(() => {
            // Wait for little bit more to see if there is notification
            timer = setTimeout(resolve, 20);
          });
        }
        if (data.type === 'data') {
          // We have unsubscribed, there should not be data
          if (timer) clearTimeout(timer);
          reject();
        }
      });
    });
  });
  it('closes connection on error in context function', (done) => {
    const context = ({ connectionParams }) => {
      if (connectionParams?.unauthenticated)
        throw new Error('You must be authenticated!');
      return {};
    };
    startServer({}, {}, { context }).then(({ server, client }) => {
      client.write(
        JSON.stringify({
          type: 'connection_init',
          payload: {
            unauthenticated: true,
          },
        })
      );
      let isErrored = false;
      client.on('data', (chunk) => {
        isErrored =
          chunk ===
          `{"type":"connection_error","payload":{"errors":[{"message":"You must be authenticated!"}]}}`;
      });
      client.on('end', () => {
        done(assert(isErrored));
      });
    });
  });
  it('closes connection on connection_terminate', (done) => {
    startServer().then(({ server, client }) => {
      client.write(
        JSON.stringify({
          type: 'connection_init',
        })
      );
      client.on('data', () => {
        client.write(
          JSON.stringify({
            type: 'connection_terminate',
          })
        );
      });
      client.on('end', () => {
        done();
      });
    });
  });
});

describe('graphyne-ws: SubscriptionConnection', () => {
  it('emits connection_init', () => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const { client, server } = await startServer(
        {},
        {},
        {
          onSubscriptionConnection: (connection: SubscriptionConnection) => {
            connection.on('connection_init', (connectionParams) => {
              try {
                assert.deepStrictEqual(connectionParams, { test: 'ok' });
                resolve();
              } catch (e) {
                reject(e);
              }
            });
          },
        }
      );
      client.write(
        JSON.stringify({
          payload: { test: 'ok' },
          type: 'connection_init',
        })
      );
    });
  });
  it('emits subscription_start', () => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const body = {
        id: 1,
        type: 'start',
        payload: {
          query: `
        subscription {
          notificationAdded {
            message
          }
        }
      `,
        },
      };
      const { client, server } = await startServer(
        {},
        {},
        {
          onSubscriptionConnection,
          context: () => ({ test: true }),
        }
      );
      function onSubscriptionConnection(connection: SubscriptionConnection) {
        connection.on('subscription_start', (id, payload, context) => {
          try {
            assert.strictEqual(id, body.id);
            assert.strictEqual(context.test, true);
            assert.deepStrictEqual(payload, body.payload);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }
      client.write(
        JSON.stringify({
          payload: { test: 'ok' },
          type: 'connection_init',
        })
      );
      client.write(JSON.stringify(body));
    });
  });
  it('emits subscription_stop', () => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const { client, server } = await startServer(
        {},
        {},
        {
          onSubscriptionConnection,
        }
      );
      function onSubscriptionConnection(connection: SubscriptionConnection) {
        connection.on('subscription_stop', (id) => {
          try {
            assert.strictEqual(id, 1);
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      }
      client.write(
        JSON.stringify({
          type: 'connection_init',
        })
      );
      client.write(
        JSON.stringify({
          id: 1,
          type: 'start',
          payload: {
            query: `
            subscription {
              notificationAdded {
                message
              }
            }
          `,
          },
        })
      );
      client.on('data', (chunk) => {
        const data = JSON.parse(chunk);
        if (data.type === 'connection_ack') {
          client.write(
            JSON.stringify({
              id: 1,
              type: 'stop',
            })
          );
        }
      });
    });
  });
  it('emits connection_terminate', () => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const { client, server } = await startServer(
        {},
        {},
        {
          onSubscriptionConnection,
        }
      );
      function onSubscriptionConnection(connection: SubscriptionConnection) {
        connection.on('connection_terminate', () => {
          resolve();
        });
      }
      client.write(
        JSON.stringify({
          type: 'connection_init',
        })
      );
      client.on('data', () => {
        client.write(
          JSON.stringify({
            type: 'connection_terminate',
          })
        );
      });
    });
  });
});
