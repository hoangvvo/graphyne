const { join } = require('path');
const { readdirSync, readFileSync, existsSync } = require('fs');
const table = require('markdown-table');

exports.renderTable = function renderTable({ includeLinks } = {}) {
  const allResults =
    existsSync(__dirname, '..', 'results') &&
    readdirSync(join(__dirname, '..', 'results')).map((x) =>
      x.replace('.json', '')
    );
  let tableContent = [['Server', 'Requests/s', 'Latency', 'Throughput/Mb']];
  allResults
    .map((file) => {
      const content = readFileSync(
        join(__dirname, '..', 'results', `${file}.json`)
      );
      return JSON.parse(content.toString());
    })
    .sort((a, b) => {
      return parseFloat(b.requests.mean) - parseFloat(a.requests.mean);
    })
    .forEach((data) => {
      const {
        title,
        requests: { average: requests },
        latency: { average: latency },
        throughput: { average: throughput },
      } = data;

      tableContent.push([
        includeLinks ? `[${title}](benchmarks/${title}.js)` : title,
        requests ? requests.toFixed(1) : 'N/A',
        latency ? latency.toFixed(2) : 'N/A',
        throughput ? (throughput / 1024 / 1024).toFixed(2) : 'N/A',
      ]);
    });
  const mdTable = table(tableContent, { align: ['l', 'c', 'c', 'c'] });
  console.log(mdTable);
};
