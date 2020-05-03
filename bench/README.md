# GraphQL Server Benchmarks

*Adapted from [fastify/benchmarks](https://github.com/fastify/benchmarks)*

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

- __Machine:__ Linux fv-az54 5.0.0-1035-azure #37-Ubuntu SMP Wed Mar 18 11:21:35 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux | 2 vCPUs | 7GB.
- __Method:__ `autocannon -c 100 -d 40 -p 10 localhost:4001` (two rounds; one to warm-up, one to measure).
- __Node:__ `v12.16.3`
- __Run:__ Fri May  1 00:10:50 UTC 2020

| Server                                                           | Requests/s | Latency | Throughput/Mb |
| :--------------------------------------------------------------- | :--------: | :-----: | :-----------: |
| [graphyne-server-micro](benchmarks/graphyne-server-micro.js)     |   4673.4   |  21.13  |     29.04     |
| [graphyne-server](benchmarks/graphyne-server.js)                 |   4644.0   |  21.26  |     28.86     |
| [graphyne-server-fastify](benchmarks/graphyne-server-fastify.js) |   4507.4   |  21.90  |     28.01     |
| [graphyne-server-express](benchmarks/graphyne-server-express.js) |   4381.1   |  22.53  |     27.33     |
| [express-graphql](benchmarks/express-graphql.js)                 |   1529.3   |  64.34  |      9.63     |
| [graphql-yoga](benchmarks/graphql-yoga.js)                       |   1362.5   |  72.25  |      8.54     |
| [apollo-server-fastify](benchmarks/apollo-server-fastify.js)     |   1353.8   |  72.71  |      8.46     |
| [apollo-server-micro](benchmarks/apollo-server-micro.js)         |   1271.3   |  77.35  |      7.90     |
| [apollo-server-express](benchmarks/apollo-server-express.js)     |   1187.7   |  82.75  |      7.51     |
