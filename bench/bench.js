#!/usr/bin/env node
const prompts = require('prompts');
const { runBench, allPackages } = require('./lib/bench');
const { renderTable } = require('./lib/compare');
const { argv } = require('yargs')
  .alias('d', 'duration')
  .alias('c', 'connections')
  .alias('p', 'pipelining');

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
  {
    type: 'number',
    name: 'pipelining',
    initial: 1,
    message: 'The number of pipelined requests to use',
  },
];

(async () => {
  const { packages, duration, connections, pipelining } = await prompts(
    questions
  );
  if (!packages || !duration || !connections || !pipelining) return;
  await runBench({
    packages,
    duration,
    connections,
    pipelining,
    isSilent: argv.silent,
  });
  renderTable();
})();
