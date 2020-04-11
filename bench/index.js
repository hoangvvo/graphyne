const prompts = require('prompts');
const { readdirSync } = require('fs');
const { join } = require('path');
const { runBench } = require('./bench');
const table = require('markdown-table');

const allPackages = readdirSync(join(__dirname, 'benchmarks')).map((x) =>
  x.replace('.js', '')
);

const questions = [
  {
    type: 'multiselect',
    name: 'packages',
    message: 'Which packages to bench',
    choices: allPackages.map((pckName) => ({ title: pckName, value: pckName })),
    min: 1,
  },
  {
    type: 'number',
    name: 'duration',
    initial: 5,
    message: 'Number of seconds to run',
  },
  {
    type: 'number',
    name: 'connections',
    initial: 5,
    message: 'Number of concurrent connections',
  },
];

(async () => {
  const { packages, duration, connections } = await prompts(questions);
  if (!packages || !duration || !connections) return;
  const results = await runBench({ packages, duration, connections });
  results.sort((a, b) => b.requests - a.requests);
  const tableMd = table(
    [
      ['Library', 'Requests/s', 'Latency'],
      ...results.map(({ package, requests, latency }) => [
        package,
        requests,
        latency,
      ]),
    ],
    { align: ['l', 'c', 'c'] }
  );
  console.log(tableMd);
})();
