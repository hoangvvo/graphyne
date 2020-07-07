import { startSubscriptionServer } from '../src';
import {
  GraphyneWSOptions,
  GraphyneWebSocketConnection,
} from '../src/graphyneWebsocket';
import { GraphyneServer } from '../../graphyne-server/src';
import WebSocket from 'ws';
import { strict as assert } from 'assert';
import { makeExecutableSchema } from 'graphql-tools';
import { PubSub } from 'graphql-subscriptions';
import { createServer } from 'http';
import request from 'supertest';
import { GraphQLError } from 'graphql';

const pubsub = new PubSub();

const typeDefs = `
  type Notification {
    message: String
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
};

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// @ts-ignore
async function startServer(
  options: Omit<GraphyneWSOptions, 'server' | 'graphyne'> = {},
  graphyneOpts = {}
) {
  // @ts-ignore
  const ws = options.ws || new WebSocket('ws://localhost:4000', 'graphql-ws');
  const graphyne = new GraphyneServer({ schema, ...graphyneOpts });
  const server = createServer(graphyne.createHandler());
  startSubscriptionServer({
    server,
    graphyne,
    // @ts-ignore
    ...options,
  });
  const client = WebSocket.createWebSocketStream(ws, {
    encoding: 'utf8',
    objectMode: true,
  });
  await new Promise((resolve) => server.listen(4000, resolve));
  return { server, client, ws };
}

describe('graphyne-ws', () => {
  it('onGraphyneWebSocketConnection', () => {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      const { client, server } = await startServer({
        onGraphyneWebSocketConnection,
      });
      function onGraphyneWebSocketConnection(connection) {
        client.end();
        server.close();
        if (connection instanceof GraphyneWebSocketConnection) resolve();
        else
          reject(
            'onGraphyneWebSocketConnection is not called with GraphyneWebSocketConnection instance'
          );
      }
    });
  });

  it('replies with connection_ack', async () => {
    const { server, client } = await startServer();
    client.write(
      JSON.stringify({
        type: 'connection_init',
      })
    );
    await new Promise((resolve) => {
      client.on('data', (chunk) => {
        client.end();
        server.close();
        resolve(assert.deepStrictEqual(chunk, `{"type":"connection_ack"}`));
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
          return request('http://localhost:4000')
            .post('/graphql')
            .send({
              query: `
            mutation {
              addNotification(message: "Hello World") {
                message
              }
            }
          `,
            })
            .expect(`{"data":{"addNotification":{"message":"Hello World"}}}`)
            .catch(reject);
        }
        if (data.type === 'data') {
          client.end();
          server.close();
          resolve(
            assert.deepStrictEqual(
              chunk,
              `{"type":"data","id":1,"payload":{"data":{"notificationAdded":{"message":"Hello World"}}}}`
            )
          );
        }
      });
    });
  });
  it('rejects socket protocol other than graphql-ws', async () => {
    // @ts-ignore
    const ws = new WebSocket('ws://localhost:4000', 'graphql-subscriptions');
    // @ts-ignore
    const { server, client } = await startServer({ ws });
    await new Promise((resolve) =>
      ws.on('close', () => {
        client.end();
        server.close();
        resolve();
      })
    );
  });
  it('errors on malformed message', (done) => {
    startServer().then(({ server, client, ws }) => {
      client.write(`{"type":"connection_init","payload":`);
      client.on('data', (chunk) => {
        client.end();
        server.close();
        done(
          assert.deepStrictEqual(
            chunk,
            `{"type":"error","payload":{"errors":[{"message":"Malformed message"}]}}`
          )
        );
      });
    });
  });
  it('format errors using formatError', (done) => {
    startServer(
      {},
      {
        formatError: (err) => {
          return new GraphQLError('Internal server error');
        },
      }
    ).then(({ server, client, ws }) => {
      client.write(`{"type":"connection_init","payload":`);
      client.on('data', (chunk) => {
        client.end();
        server.close();
        // Override default error which is "Malformed message"
        done(
          assert.deepStrictEqual(
            chunk,
            `{"type":"error","payload":{"errors":[{"message":"Internal server error"}]}}`
          )
        );
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
        if (chunk === `{"type":"connection_ack"}`) return;
        server.close();
        client.end();
        resolve(
          assert.deepStrictEqual(
            chunk,
            `{"type":"error","id":1,"payload":{"errors":[{"message":"Must provide query string."}]}}`
          )
        );
      });
    });
  });
  it('errors on operation other than subscription', async function () {
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
      client.on('data', (chunk) => {
        if (chunk === `{"type":"connection_ack"}`) return;
        server.close();
        client.end();
        resolve(
          assert.deepStrictEqual(
            chunk,
            `{"type":"error","id":1,"payload":{"errors":[{"message":"Not a subscription operation"}]}}`
          )
        );
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
        if (chunk === `{"type":"connection_ack"}`) return;
        server.close();
        client.end();
        const {
          payload: {
            errors: [{ message }],
          },
        } = JSON.parse(chunk);

        resolve(
          assert.deepStrictEqual(
            message,
            `Cannot query field "NNotificationAdded" on type "Subscription". Did you mean "notificationAdded"?`
          )
        );
      });
    });
  });
  it('close connection upon GQL_STOP', async () => {
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
          request('http://localhost:4000')
            .post('/graphql')
            .send({
              query: `
            mutation {
              addNotification(message: "Hello World") {
                message
              }
            }
          `,
            })
            .then(() => {
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
    }).finally(() => {
      client.end();
      server.close();
    });
  });
  it('close connection on error in context function', (done) => {
    // @ts-ignore
    const context = ({ connectionParams }) => {
      if (connectionParams?.unauthenticated) return false;
      return {};
    };
    startServer({ context }).then(({ server, client }) => {
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
          `{"type":"connection_error","payload":{"errors":[{"message":"Prohibited connection!"}]}}`;
      });
      client.on('end', () => {
        client.end();
        server.close();
        done(assert(isErrored));
      });
    });
  });
  it('close connection on connection_terminate', (done) => {
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
        client.end();
        server.close();
        done();
      });
    });
  });
});
