# GraphQL Server Benchmarks

Benchmarks GraphQL Servers using [autocannon](https://github.com/mcollina/autocannon). Each run includes two rounds: one 5-second round to warm up and one to measure.

The benchmark is run once a week using Github Actions. The latest version of each library is used.

## Usage

[bench.js](bench.js) is the CLI used to benchmark the servers.

```shell
node bench [arguments]
```

The following optional arguments are accepted:

- `-d, --duration`: Number of seconds to run
- `-c, --connections`: Number of concurrent connections
- `-p, --pipelining`:  The number of pipelined requests to use

[compare.js](compare.js) is the CLI used to display result.

```shell
node compare [arguments]
```

- `--table`: Display a table of the results

## Add a server

Add a server simply by creating a file in [benchmarks](benchmarks). The server should listen to port `4001`.

## Results

- __Machine:__ Linux fv-az17 5.0.0-1035-azure #37-Ubuntu SMP Wed Mar 18 11:21:35 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux | 2 vCPUs | 7GB.
- __Method:__ `autocannon -c 100 -d 40 -p 10 localhost:4001` (two rounds; one to warm-up, one to measure).
- __Node:__ `v12.16.2`
- __Run:__ Fri Apr 24 00:10:41 UTC 2020

| Server                                                           | Requests/s | Latency | Throughput/Mb |
| :--------------------------------------------------------------- | :--------: | :-----: | :-----------: |
| [graphyne-server](benchmarks/graphyne-server.js)                 |   4903.5   |  20.13  |     30.48     |
| [graphyne-server-micro](benchmarks/graphyne-server-micro.js)     |   4764.1   |  20.72  |     29.61     |
| [graphyne-server-fastify](benchmarks/graphyne-server-fastify.js) |   4704.2   |  20.98  |     29.24     |
| [graphyne-server-express](benchmarks/graphyne-server-express.js) |   4630.9   |  21.31  |     28.89     |
| [graphyne-server-koa](benchmarks/graphyne-server-koa.js)         |   4485.1   |  22.01  |      0.67     |
| [express-graphql](benchmarks/express-graphql.js)                 |   1541.5   |  63.82  |      9.70     |
| [graphql-yoga](benchmarks/graphql-yoga.js)                       |   1439.7   |  68.37  |      9.02     |
| [apollo-server-fastify](benchmarks/apollo-server-fastify.js)     |   1419.0   |  69.41  |      8.86     |
| [apollo-server-micro](benchmarks/apollo-server-micro.js)         |   1345.1   |  73.12  |      8.36     |
| [apollo-server-express](benchmarks/apollo-server-express.js)     |   1227.2   |  80.08  |      7.76     |
