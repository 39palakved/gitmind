function printGeneralHelp() {
  console.log("\nGitMind");
  console.log("AI commit and timesheet assistant for developers.");
  console.log("");
  console.log("Usage:");
  console.log("  gitmind <command>");
  console.log("");
  console.log("Commands:");
  console.log("  gitmind config          Set up your Gemini API key");
  console.log("  gitmind config status   Show current config and masked key");
  console.log("  gitmind config reset    Remove the saved API key");
  console.log(
    "  gitmind commit          Generate an AI commit message, commit locally, and optionally push to GitHub"
  );
  console.log("");
  console.log("Flow:");
  console.log("  1. Run gitmind config once");
  console.log("  2. Stage your files with git add");
  console.log("  3. Run gitmind commit");
  console.log("  4. Review the suggested message and accept or cancel");
  console.log("  5. Optionally push the commit to your remote");
  console.log("");
  console.log("Examples:");
  console.log("  gitmind config");
  console.log("  gitmind config status");
  console.log("  gitmind commit");
  console.log("");
  console.log("Roadmap:");
  console.log("  Timesheet filling is coming next.");
  console.log("");
  console.log("Tip:");
  console.log("  Run `gitmind help config` or `gitmind help commit` for details.");
}

function printConfigHelp() {
  console.log("\nGitMind config");
  console.log("Set up and manage your Gemini API key.");
  console.log("");
  console.log("Commands:");
  console.log("  gitmind config          Save a new API key to the OS keychain");
  console.log("  gitmind config status   Show whether a key is saved");
  console.log("  gitmind config reset    Remove the saved API key");
  console.log("");
  console.log("What happens:");
  console.log("  - GitMind asks for the API key in the terminal");
  console.log("  - The key is stored in the OS keychain");
  console.log("  - gitmind commit reads only from the saved key");
  console.log("  - If no key exists, GitMind tells you to run gitmind config first");
}

function printCommitHelp() {
  console.log("\nGitMind commit");
  console.log(
    "Generate a Conventional Commit message from staged changes, then optionally push it to GitHub."
  );
  console.log("");
  console.log("What happens:");
  console.log("  - GitMind checks staged files first");
  console.log("  - If nothing is staged, it explains what to do");
  console.log("  - If changes are staged, Gemini suggests one commit message");
  console.log("  - You approve or cancel the commit");
  console.log("  - If approved, GitMind runs git commit");
  console.log("  - After that, GitMind can push the commit to your remote on GitHub");
  console.log("");
  console.log("Examples:");
  console.log("  git add .");
  console.log("  gitmind commit");
}

function handleHelp(topic = "") {
  const normalizedTopic = (topic || "").trim().toLowerCase();

  if (normalizedTopic === "config") {
    printConfigHelp();
    return;
  }

  if (normalizedTopic === "commit") {
    printCommitHelp();
    return;
  }

  printGeneralHelp();
}

module.exports = handleHelp;
