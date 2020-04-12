FROM node:latest

COPY . /graphql-bench-pr

RUN cd /graphql-bench-pr && yarn install --production

COPY entrypoint.sh /entrypoint.sh

ENTRYPOINT ["sh", "/entrypoint.sh"]