const core = require('@actions/core');
const { context, GitHub } = require("@actions/github");
const { runBench, allPackages } = require('../../bench/bench');

async function run() {
  const results = await runBench({ packages: allPackages, duration, connections });
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

  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN')
  const octokit = new GitHub(GITHUB_TOKEN)

  await octokit.issues.createComment({
    owner: context.issue.repo.owner,
    repo: context.issue.repo,
    issue_number: context.issue.number,
    body: `Compare everything
    ${tableMd}
    `
  });
}

run().catch(err => {
  core.setFailed(err.message);
});
