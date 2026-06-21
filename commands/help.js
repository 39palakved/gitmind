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
  console.log(
    "  gitmind timesheet       Fill an Excel timesheet from recent git commits"
  );
  console.log("");
  console.log("Flow:");
  console.log("  1. Run gitmind config once");
  console.log("  2. Run gitmind commit after staging your code");
  console.log("  3. Run gitmind timesheet with your Excel template");
  console.log("  4. Pick the sheet/tab to fill and confirm the preview");
  console.log("");
  console.log("Examples:");
  console.log("  gitmind config");
  console.log("  gitmind config status");
  console.log("  gitmind commit");
  console.log("  gitmind timesheet timesheet.xlsx");
  console.log("");
  console.log("Tip:");
  console.log(
    "  Run `gitmind help config`, `gitmind help commit`, or `gitmind help timesheet` for details."
  );
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

function printTimesheetHelp() {
  console.log("\nGitMind timesheet");
  console.log(
    "Fill an Excel timesheet from recent git commits and save it back to the same file."
  );
  console.log("");
  console.log("What happens:");
  console.log("  - GitMind asks for the workbook path if you do not pass one");
  console.log("  - If the workbook has multiple sheets, you pick which tab to fill");
  console.log("  - GitMind reads recent commits from the current git repository");
  console.log(
    "  - Gemini turns each day of work into a short professional description"
  );
  console.log("  - If Gemini is not configured, GitMind falls back to local summaries");
  console.log("  - Hours are auto-suggested from commit timestamps (you can override)");
  console.log("  - Dates already in the sheet are skipped automatically (no duplicates)");
  console.log("  - GitMind writes the new rows back into the SAME workbook file");
  console.log("");
  console.log("Usage:");
  console.log("  gitmind timesheet <path/to/timesheet.xlsx> [options]");
  console.log("");
  console.log("Options:");
  console.log("  --today          Only look at today's commits");
  console.log("  --week           Look back 7 days (this is the default)");
  console.log("  --days=N         Look back N days (e.g. --days=2, --days=30)");
  console.log("  --branch=NAME    Only read commits from a specific branch");
  console.log("                   (default: your currently checked-out branch)");
  console.log("");
  console.log("Examples:");
  console.log('  gitmind timesheet timesheet.xlsx                       # last 7 days, current branch');
  console.log('  gitmind timesheet timesheet.xlsx --today               # only today');
  console.log('  gitmind timesheet timesheet.xlsx --days=2              # last 2 days');
  console.log('  gitmind timesheet timesheet.xlsx --branch=feature/auth # specific branch');
  console.log('  gitmind timesheet timesheet.xlsx --days=5 --branch=main');
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

  if (normalizedTopic === "timesheet") {
    printTimesheetHelp();
    return;
  }

  printGeneralHelp();
}

module.exports = handleHelp;
