const fs = require("fs");
const path = require("path");
const { getRepositoryRoot } = require("../services/git");

async function handleInit() {
  const repoRoot = getRepositoryRoot();
  if (!repoRoot) {
    console.log("Not a git repository. Run `gitmind init` inside a git project.");
    return;
  }

  const hooksDir = path.join(repoRoot, ".git", "hooks");
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookScript = `#!/bin/sh
# GitMind Auto-Commit Hook

FILE=$1
MESSAGE_SOURCE=$2
SHA1=$3

# Only intercept if there's no message provided via -m
if [ -z "$MESSAGE_SOURCE" ] || [ "$MESSAGE_SOURCE" = "message" ]; then
    echo "🤖 GitMind is analyzing your changes..."
    # Execute the gitmind hook command
    gitmind hook prepare-commit-msg "$FILE" < /dev/tty
fi
`;

  const prepareCommitMsgPath = path.join(hooksDir, "prepare-commit-msg");
  fs.writeFileSync(prepareCommitMsgPath, hookScript);
  
  try {
    fs.chmodSync(prepareCommitMsgPath, "755");
  } catch (e) {
    // Windows might throw on chmod, ignore
  }

  console.log("\n🚀 GitMind hooks installed successfully!");
  console.log("From now on, just type `git commit` without the -m flag.");
  console.log("GitMind will automatically generate the message in your editor.\n");
  console.log("Note: Make sure you have installed gitmind globally (e.g. `npm link` in your gitmind folder).");
}

module.exports = handleInit;
