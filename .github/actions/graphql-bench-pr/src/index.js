const { promisify } = require('util');
const { exec: execSync } = require('child_process');
const exec = promisify(execSync);
const { join } = require('path');
const {
  promises: { readdir, writeFile },
  readFileSync,
} = require('fs');
const core = require('@actions/core');
const github = require('@actions/github');

const repoToken = core.getInput('repoToken');
const octokit = new github.GitHub(repoToken);

const {
  payload: { pull_request: pullRequest },
} = github.context;

const cwd = process.env.GITHUB_WORKSPACE;

const issueNumber = pullRequest.number;
const baseRef = pullRequest.base.repo.ref || 'master';
const baseRepo = pullRequest.base.repo.full_name;
const prRepo = pullRequest.head.repo.full_name;
const prRef = pullRequest.head.ref;

async function prepareRepo(repo, ref, outDir) {
  console.log(cwd);
  // Clone the repo and do yarn install
  const url = `https://github.com/${repo}`;
  await exec(`rm -rf ${outDir}`);
  await exec(`git clone ${url} ${outDir}`);
  await exec(`cd ${outDir} && git checkout ${ref}`);
  // Yarn link benchmark dependencies to packages
  const pkgPath = join(cwd, outDir, 'package.json');
  const package = JSON.parse(readFileSync(pkgPath).toString());
  package.workspaces.push('bench');
  await writeFile(pkgPath, JSON.stringify(package, null, '  '));
  // yarn/issues/5500
  await exec(`cd ${outDir} && rm yarn.lock && yarn install --silent`);
}

async function runManyBenches(dir, packages) {
  // Run benchmark
  let packagesArgs = packages.join(' ');
  const benchCmd = `node ${dir}/bench/bench -c 5 -d 5 -p 1 --packages ${packagesArgs} --silent`
  console.log(benchCmd)
  await exec(benchCmd);
}

async function getStats(repo, ref) {
  const dir = repo.replace('/', '-');
  await prepareRepo(repo, ref, dir);
  await runManyBenches(dir, ['graphyne-express', 'graphyne-server']);
  // Get the result
  const resultsPath = join(cwd, dir, 'bench', 'results');
  const resultObj = {};
  (await readdir(resultsPath)).map((file) => {
    const content = readFileSync(`${resultsPath}/${file}`);
    const data = JSON.parse(content.toString());
    const {
      title,
      requests: { average: requests },
      latency: { average: latency },
      throughput: { average: throughput },
    } = data;
    resultObj[title] = {
      requests: requests.toFixed(1),
      latency: latency.toFixed(2),
      throughput: (throughput / 1024 / 1024).toFixed(2),
    };
  });
  return resultObj;
}

(async () => {
  const statsBase = await getStats(baseRepo, baseRef);
  const statsPR = await getStats(prRepo, prRef);

  let message = `# Benchmarks from current PR

Hey, @${pullRequest.user.login}. I ran some benchmarks on this PR.
`;

  for (let key of Object.keys(statsBase)) {
    const { requests, latency, throughput } = statsBase[key];
    const {
      requests: prRequests,
      latency: prLatency,
      throughput: prThroughput,
    } = statsPR[key];
    message += `

**${key}**

| | ${baseRepo} ${baseRef} | ${prRepo} ${prRef} | Change |
| --- | --- | --- | --- |
| Requests/s | ${requests} | ${prRequests} | ${
      prRequests < requests ? '⚠️ ' : ' +'
    }${(prRequests - requests).toFixed(1)} |
| Latency | ${latency} | ${prLatency} | ${prLatency > latency ? '⚠️ +' : ' '}${
      (prLatency - latency).toFixed(2)
    } | 
| Throughput/Mb | ${throughput} | ${prThroughput} | ${
      prThroughput < throughput ? '⚠️ ' : ' +'
    }${(prThroughput - throughput).toFixed(2)} |
`;
  }

  message += `
  
Thanks for the contribution :+1:`

  const [owner, repo] = baseRepo.split('/');
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: message,
  });
})();
