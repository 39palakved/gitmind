const { execFileSync } = require("child_process");
const askQuestion = require("../utils/askQuestion");
const { getStagedDiff } = require("../services/history");
const { generateCommitMessage } = require("../services/gemini");

async function handleCommit() {
  const diff = getStagedDiff();
  const commitMessage = await generateCommitMessage(diff);

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
