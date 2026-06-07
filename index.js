#!/usr/bin/env node

const command = process.argv[2];

if (command === "commit") {
  const handleCommit = require("./commands/commit");

  handleCommit().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
