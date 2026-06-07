#!/usr/bin/env node
const { execSync } = require("child_process");
const command = process.argv[2];
function handleCommit() {
    const diff = execSync("git diff --cached",{
        encoding: "utf-8",
    }
);
console.log(diff);
}

if (command === "commit") {
    handleCommit();
} else if (command === "help") {
    console.log("Available Commands:");
    console.log("gitmind commit");
    console.log("gitmind config");
} else {
    console.log("Unknown command");
}