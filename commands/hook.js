const fs = require("fs");
const { getStagedDiff, getCurrentBranch } = require("../services/git");
const { generateCommitMessage } = require("../services/gemini");

async function handleHook() {
  const hookType = process.argv[3];
  
  if (hookType === "prepare-commit-msg") {
    const file = process.argv[4];
    if (!file) return;

    const diff = getStagedDiff();
    if (!diff) return;

    try {
      const branch = getCurrentBranch();
      const commitMessage = await generateCommitMessage(diff, branch);
      
      const currentContent = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      
      // Inject the AI message at the top of the file
      fs.writeFileSync(file, commitMessage + "\n\n" + currentContent);
    } catch (error) {
      console.log("GitMind could not generate message: " + (error.message || error));
    }
  }
}

module.exports = handleHook;
