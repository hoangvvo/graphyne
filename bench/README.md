# GraphQL Server Benchmarks

Benchmarks GraphQL Servers to compare it with [graphyne](/).

This benchmarks the servers using [autocannon](https://github.com/mcollina/autocannon). Each run includes two rounds: one 5-second round to warm up, one to measure. The benchmark is run once a day using Github Actions.

Current packages that are being benchmarked:

- `graphyne-server@latest`
- `graphyne-express@latest`
- `apollo-server-express@latest`
- `express-graphql@latest`

Also, a bare [`graphql-jit`](benchmarks/graphql-jit-str) with in-memory cache is benchmarked for personal references.

## Usage

[cli.js](cli.js) is a CLI that benchmarks the servers.

```shell
node cli [arguments(optional)]
```

The following arguments are accepted:

- `--duration`: Number of seconds to run
- `--connections`: Number of concurrent connections

If an option is not supplied, you will be walked through prompts.

## Add a server

Add a server simply by creating a file in [benchmarks](benchmarks). The server should listen to port `4001`.

## Results
