const { execSync } = require("child_process");

function getStagedDiff() {
  const diff = execSync("git diff --cached", {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  if (!diff.trim()) {
    throw new Error(
      "No staged changes found. Stage your files before running gitmind commit."
    );
  }

  return diff;
}

module.exports = {
  getStagedDiff,
};
