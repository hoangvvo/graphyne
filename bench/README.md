# GraphQL Server Benchmarks

This benchmarks GraphQL Servers to compare it with [graphyne](/)

## Methodology

This benchmarks the servers using [autocannon](https://github.com/mcollina/autocannon). Each run includes two round: one 5-second round to warm up, one to measure.

## Usage

From this [repo root](/):

```javascript
yarn bench [arguments(optional)]
// OR
npm run bench [arguments(options)]
```

Arguments are:

- `--duration`: Number of seconds to run
- `--connections`: Number of concurrent connections

If an option is not supplied, you will be walked through prompts.

## Results
