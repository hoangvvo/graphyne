# GraphQL Server Benchmarks

Benchmarks GraphQL Servers using [autocannon](https://github.com/mcollina/autocannon). Each run includes two rounds: one 5-second round to warm up and one to measure.

The benchmark is run once a day using Github Actions. The latest version of each library is used.

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
