const { execFileSync } = require("child_process");
const askQuestion = require("../utils/askQuestion");
const { getCurrentBranch, getStagedDiff } = require("../services/git");
const { generateCommitMessage } = require("../services/gemini");

async function handleCommit() {
  const diff = getStagedDiff();
  if (!diff) {
    console.log(
      "\nYou have not staged any changes yet. Use `git add <files>` first, then run `gitmind commit`."
    );
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
