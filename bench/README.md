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
- __Run:__ Fri Apr 17 00:10:29 UTC 2020

| Server                                                           | Requests/s | Latency | Throughput/Mb |
| :--------------------------------------------------------------- | :--------: | :-----: | :-----------: |
| [graphyne-server-micro](benchmarks/graphyne-server-micro.js)     |   4653.4   |  21.21  |     28.92     |
| [graphyne-server-fastify](benchmarks/graphyne-server-fastify.js) |   4601.7   |  21.45  |     28.60     |
| [graphyne-server](benchmarks/graphyne-server.js)                 |   4592.7   |  21.49  |     28.55     |
| [graphyne-server-express](benchmarks/graphyne-server-express.js) |   4537.5   |  21.75  |     28.30     |
| [express-graphql](benchmarks/express-graphql.js)                 |   1518.5   |  64.80  |      9.56     |
| [graphql-yoga](benchmarks/graphql-yoga.js)                       |   1412.3   |  69.66  |      8.85     |
| [apollo-server-fastify](benchmarks/apollo-server-fastify.js)     |   1397.5   |  70.52  |      8.73     |
| [apollo-server-micro](benchmarks/apollo-server-micro.js)         |   1307.6   |  75.21  |      8.13     |
| [apollo-server-express](benchmarks/apollo-server-express.js)     |   1206.1   |  81.51  |      7.63     |
