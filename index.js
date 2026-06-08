#!/usr/bin/env node

const command = process.argv[2];

async function main() {
  if (command === "commit") {
    const handleCommit = require("./commands/commit");

    await handleCommit();
    return;
  }

  if (!command || command === "help") {
    console.log("Available Commands:");
    console.log("gitmind commit");
    return;
  }

  console.log(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
