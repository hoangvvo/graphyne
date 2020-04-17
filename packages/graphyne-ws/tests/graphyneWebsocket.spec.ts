import { startSubscriptionServer } from '../src';
import { GraphyneServer } from '../../graphyne-server/src';
import WebSocket from 'ws';
import { strict as assert } from 'assert';
import { makeExecutableSchema } from 'graphql-tools';
import { PubSub } from 'graphql-subscriptions';
import { createServer } from 'http';
import request from 'supertest';

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
async function startServer(options = {}) {
  // @ts-ignore
  const ws = options.ws || new WebSocket('ws://localhost:4000', 'graphql-ws');
  const graphyne = new GraphyneServer({ schema });
  const server = createServer(graphyne.createHandler());
  startSubscriptionServer({
    server,
    graphyne,
    context: ({ connectionParams }) => {
      if (connectionParams?.unauthenticated) return false;
      return {};
    },
  });
  const client = WebSocket.createWebSocketStream(ws, {
    encoding: 'utf8',
    objectMode: true,
  });
  await new Promise((resolve) => server.listen(4000, resolve));
  return { server, client, ws };
}

describe('graphyne-ws', () => {
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
              JSON.stringify({
                type: 'data',
                id: 1,
                payload: {
                  data: {
                    notificationAdded: {
                      message: 'Hello World',
                    },
                  },
                },
              })
            )
          );
        }
      });
    });
  });
  it('rejects socket protocol other than graphql-ws', async () => {
    // @ts-ignore
    const ws = new WebSocket('ws://localhost:4000', 'graphql-subscriptions');
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
  it('errors on invalid type', (done) => {
    startServer().then(({ server, client }) => {
      client.write(
        JSON.stringify({
          type: 'connection_init_',
        })
      );
      client.on('data', (chunk) => {
        client.end();
        server.close();
        done(
          assert.deepStrictEqual(
            chunk,
            `{"type":"error","payload":{"errors":[{"message":"Invalid payload type"}]}}`
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
            `{"type":"data","id":1,"payload":{"errors":[{"message":"Must provide query string."}]}}`
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
            `{"type":"data","id":1,"payload":{"errors":[{"message":"Not a subscription operation"}]}}`
          )
        );
      });
    });
  });
  it('close connection on error in context function', (done) => {
    startServer().then(({ server, client }) => {
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
