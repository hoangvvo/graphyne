const http = require('http');
const { GraphyneServer } = require('graphyne-server');
const { makeExecutableSchema } = require('graphql-tools');
const { PubSub } = require('graphql-subscriptions');
const { startSubscriptionServer } = require('graphyne-ws');

const pubsub = new PubSub();

let idCount = 1;
const notifications = [
  {
    id: idCount,
    message: 'Notification message',
  },
];

const typeDefs = `
  type Notification {
    id: ID!
    message: String
  }

  type Query {
    notifications: [Notification]
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
    notifications: () => notifications,
  },
  Mutation: {
    addNotification: async (_, { message }) => {
      const id = idCount++;
      const notification = {
        id,
        message,
      };
      notifications.push(notification);
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

var schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const graphyne = new GraphyneServer({
  schema,
  path: '/graphql',
  playground: {
    path: '/playground',
  },
});

const server = http.createServer(graphyne.createHandler());

startSubscriptionServer({
  server,
  graphyne,
  context: ({
    connectionParams, // ConnectionParams such as in apollo-link-ws
    socket, // WebSocket
    request, // IncomingMessage
  }) => {
    // See connectionParams in https://www.apollographql.com/docs/react/data/subscriptions/#authentication-over-websocket
    // Return a context to be used in resolvers
    return {};
  },
  path: '/graphql',
});

server.listen(3000, () => {
  console.log(`🚀  Server ready at http://localhost:3000/graphql`);
});
