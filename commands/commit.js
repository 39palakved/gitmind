const { execFileSync } = require("child_process");
const askYesNo = require("../utils/askYesNo");
const {
  getCurrentBranch,
  getRepositoryStatus,
  getStagedDiff,
  getPushRemoteName,
  pushCurrentBranch,
} = require("../services/git");
const { generateCommitMessage } = require("../services/gemini");

async function handleCommit() {
  const diff = getStagedDiff();
  if (!diff) {
    const status = getRepositoryStatus();

    if (!status.hasAnyChanges) {
      console.log("\nNo changes detected in this repository.");
    } else if (status.hasUnstagedChanges) {
      console.log(
        "\nYou have unstaged changes. Run `git add` first, then `gitmind commit`."
      );
    } else {
      console.log(
        "\nNo staged changes found. Stage files with `git add` first, then run `gitmind commit`."
      );
    }

    return;
  }

  const branch = getCurrentBranch();
  const commitMessage = await generateCommitMessage(diff, branch);

  console.log("\nSuggested Commit:");
  console.log(commitMessage);

  const shouldCommit = await askYesNo("\nAccept? (Y/N): ");

  if (shouldCommit) {
    execFileSync("git", ["commit", "-m", commitMessage], {
      stdio: "inherit",
    });
    console.log("\nCommit created successfully!");

    const remoteName = getPushRemoteName();

    if (!remoteName) {
      console.log(
        "No git remote is configured, so GitMind could not push this commit to GitHub."
      );
      return;
    }

    const shouldPush = await askYesNo(
      `Push this commit to ${remoteName} now? (Y/N): `
    );

    if (shouldPush) {
      try {
        const pushed = pushCurrentBranch();
        console.log(
          `\nPushed to ${pushed.remote || remoteName} successfully!`
        );
      } catch (error) {
        console.log(
          `\nCommit was created locally, but push failed: ${
            error.message || error
          }`
        );
      }
    } else {
      console.log("\nPush cancelled.");
    }
  } else {
    console.log("\nCommit cancelled.");
  }
}

module.exports = handleCommit;
