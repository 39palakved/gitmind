const { execFileSync } = require("child_process");
const askQuestion = require("../utils/askQuestion");
const {
  getCurrentBranch,
  getRepositoryStatus,
  getStagedDiff,
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

  const answer = await askQuestion("\nAccept? (Y/N): ");

  if (answer.toLowerCase() === "y") {
    execFileSync("git", ["commit", "-m", commitMessage], {
      stdio: "inherit",
    });
    console.log("\nCommit created successfully!");
  } else {
    console.log("\nCommit cancelled.");
  }
}

module.exports = handleCommit;
