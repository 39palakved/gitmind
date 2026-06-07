const handleCommit = require("./commands/commit");

if (require.main === module) {
  handleCommit().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = handleCommit;
