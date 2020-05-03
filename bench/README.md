# GraphQL Server Benchmarks

*Adapted from [benawad/node-graphql-benchmarks](https://github.com/benawad/node-graphql-benchmarks)*

Benchmarks GraphQL Servers using [autocannon](https://github.com/mcollina/autocannon). Each run includes two rounds: one 5-second round to warm up and one to measure.

The benchmark is run once a week using Github Actions. The latest version of each library is used.

## Usage

### Run benchmarks

[bench.js](bench.js) is the CLI used to benchmark the servers.

```shell
node bench [arguments]
```

The following optional arguments are accepted:

- `-d, --duration`: Number of seconds to run
- `-c, --connections`: Number of concurrent connections
- `-p, --pipelining`:  The number of pipelined requests to use
- `-pkgs, --packages`: Select the packages to be benchmarked. Use `--all-packages` to select all.
- `--silent`: Disable logging. May improve test results.

### Compare benchmarks

[compare.js](compare.js) is the CLI used to display result.

```shell
node compare [arguments]
```

The following optional arguments are accepted:

- `--table`: Display a table of the results
- `--includeLinks`: (for CI) Include markdown links for use in [README](README.md)

## Add a server

Add a server simply by creating a file in [benchmarks](benchmarks). The server should listen to port `4001`.\n\n## Results

- __Machine:__ Linux HP-Spectre 5.4.0-28-generic #32-Ubuntu SMP Wed Apr 22 17:40:10 UTC 2020 x86_64 x86_64 x86_64 GNU/Linux | 4 vCPUs | 16GB.
- __Method:__ `autocannon -c 100 -d 40 -p 10 localhost:4001` (two rounds; one to warm-up, one to measure).
- __Node:__ `v12.16.3`
- __Run:__ Sun 03 May 2020 04:37:22 PM EDT

| Server                                                           | Requests/s | Latency | Throughput/Mb |
| :--------------------------------------------------------------- | :--------: | :-----: | :-----------: |
| [core-graphql-jit-str](benchmarks/core-graphql-jit-str.js)       |   5837.7   |  16.90  |     36.11     |
| [graphyne-server-fastify](benchmarks/graphyne-server-fastify.js) |   5498.2   |  17.95  |     34.18     |
| [fastify-gql+graphql-jit](benchmarks/fastify-gql+graphql-jit.js) |   5482.5   |  18.00  |     34.15     |
| [graphyne-server](benchmarks/graphyne-server.js)                 |   5444.7   |  18.13  |     33.96     |
| [graphyne-server-express](benchmarks/graphyne-server-express.js) |   5374.8   |  18.35  |     33.41     |
| [graphyne-server-micro](benchmarks/graphyne-server-micro.js)     |   5348.9   |  18.45  |     33.25     |
| [express-graphql](benchmarks/express-graphql.js)                 |   1988.7   |  49.54  |     12.52     |
| [graphql-yoga](benchmarks/graphql-yoga.js)                       |   1867.2   |  52.75  |     11.70     |
| [apollo-server-fastify](benchmarks/apollo-server-fastify.js)     |   1866.0   |  52.80  |     11.66     |
| [apollo-server-micro](benchmarks/apollo-server-micro.js)         |   1690.7   |  58.24  |     10.51     |
| [apollo-server-express](benchmarks/apollo-server-express.js)     |   1662.9   |  59.21  |     10.52     |
