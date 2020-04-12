const { argv } = require('yargs');
const { renderTable } = require('./lib/compare');

(async () => {
  if (argv.table) {
    renderTable({
      includeLinks: Boolean(argv.includeLinks),
    });
  }
})();
