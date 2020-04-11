#!/usr/bin/env node
const prompts = require('prompts');
const { runBench, allPackages } = require('./bench');
const table = require('markdown-table');
const { argv } = require('yargs');

if (argv['all-packages']) {
  argv.packages = allPackages;
}

prompts.override(argv);

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
