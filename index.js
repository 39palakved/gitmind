#!/usr/bin/env node

const command = process.argv[2];

async function main() {
  if (command === "help" || command === "-h" || command === "--help") {
    const handleHelp = require("./commands/help");

    handleHelp(process.argv[3]);
    return;
  }

  if (command === "config") {
    const handleConfig = require("./commands/config");

    await handleConfig();
    return;
  }
//run on commit 
  if (command === "commit") {
    const handleCommit = require("./commands/commit");

    await handleCommit();
    return;
  }

  if (!command) {
    const handleHelp = require("./commands/help");

    handleHelp();
    return;
  }

  console.log(`Unknown command: ${command}`);
  console.log("Run `gitmind help` to see available commands.");
}

main().catch((error) => {
  console.error(`\n${error.message || error}`);
  process.exitCode = 1;
});
