const autocannon = require('autocannon');
const { fork } = require('child_process');
const { join } = require('path');
const ora = require('ora');

const body = JSON.stringify({
  query: `{
    authors {
      id
      name
      md5
      books {
        id
        name
      }
    }
  }`,
});

let forked;

const autocannonOpts = {
  url: 'http://localhost:4001/graphql',
  method: 'POST',
  body,
  headers: {
    'content-type': 'application/json',
  },
};

async function doBench({ package, duration, connections }) {
  let result;
  const spinner = ora({
    prefixText: package,
    text: 'Starting',
  }).start();
  forked = fork(join(__dirname, 'benchmarks', package), [], {
    silent: false,
    env: {
      NODE_ENV: 'production',
    },
  });
  try {
    // warm up for 5 sec
    spinner.text = 'Warming';
    await autocannon({
      ...autocannonOpts,
      connections,
      duration: 5,
    });

    // actual benchmark
    spinner.text = 'Working';
    result = await autocannon({
      ...autocannonOpts,
      connections,
      duration,
    });
    const { requests, latency } = result;
    spinner.succeed(
      `Done: ${requests.average} requests/s, ${latency.average} latency`
    );
    return {
      package,
      requests: requests.average,
      latency: latency.average,
    };
  } catch (e) {
    spinner.fail(e.message);
  } finally {
    forked.kill('SIGINT');
    forked = null;
  }
}

exports.runBench = async function run({ packages, duration, connections }) {
  // warmup
  const results = [];
  for (const index in packages) {
    const package = packages[index];
    const result = await doBench({
      package,
      duration,
      connections,
    });
    results.push(result);
  }
  results.sort((a, b) => b.requests - a.requests);
  return results;
};

process.on('exit', () => {
  if (forked) forked.kill('SIGINT');
});
