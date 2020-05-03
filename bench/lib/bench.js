const autocannon = require('autocannon');
const { fork } = require('child_process');
const { join } = require('path');
const ora = require('ora');
const { readdirSync, writeFileSync, existsSync, mkdirSync } = require('fs');

exports.allPackages = readdirSync(
  join(__dirname, '..', 'benchmarks')
).map((x) => x.replace('.js', ''));

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

async function doBench({
  package,
  duration,
  connections,
  pipelining,
  isSilent,
}) {
  const spinner = !isSilent
    ? ora({
        prefixText: package,
        text: 'Starting',
      }).start()
    : {
        succeed: () => null,
        fail: console.error,
      };
  forked = fork(join(__dirname, '..', 'benchmarks', package), [], {
    silent: false,
    env: {
      NODE_ENV: 'production',
    },
  });
  // warm up for 5 sec
  spinner.text = 'Warming';
  await autocannon({
    ...autocannonOpts,
    connections,
    duration: 5,
    pipelining,
  });

  // actual benchmark
  spinner.text = 'Working';
  const result = await autocannon({
    ...autocannonOpts,
    title: package,
    connections,
    duration,
    pipelining,
  });

  // done
  const {
    requests: { average: requests },
    latency: { average: latency },
    throughput: { average: throughput },
  } = result;
  spinner.succeed(
    `Done: ${requests || 'N/A'} requests/s, ${latency || 'N/A'} latency, ${
      throughput ? throughput / 1024 / 1024 : 'N/A'
    }`
  );
  forked.kill('SIGINT');
  forked = null;
  return result;
}

exports.runBench = async function run({
  packages,
  duration,
  connections,
  pipelining,
  isSilent,
}) {
  const results = [];
  for (let index = 0; index < packages.length; index++) {
    const package = packages[index];
    const result = await doBench({
      package,
      duration,
      connections,
      pipelining,
      isSilent,
    });
    results.push(result);
  }
  const spinner = !isSilent
    ? ora({
        text: 'Saving results',
      }).start()
    : { succeed: () => null };

  // Save results
  const resultsDirectory = join(__dirname, '..', 'results');
  if (!existsSync(resultsDirectory)) {
    mkdirSync(resultsDirectory);
  }
  for (const index in results) {
    const result = results[index];
    writeFileSync(
      join(resultsDirectory, `${result.title}.json`),
      JSON.stringify(result, null, '  ')
    );
  }
  spinner.succeed('Results saved');
  return results;
};

function cleanup() {
  if (forked) {
    forked.kill('SIGINT');
    console.log('Process killed');
  }
}

process.on('exit', cleanup);
process.on('disconnect', cleanup);
process.on('SIGINT', cleanup);
