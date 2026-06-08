const { execSync } = require("child_process");

function getStagedDiff() {
  const diff = execSync("git diff --cached", {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });

  return diff.trim() ? diff : null;
}

function getCurrentBranch() {
  const branch = execSync("git branch --show-current", {
    encoding: "utf8",
  }).trim();

  return branch || "unknown";
}

module.exports = {
  getCurrentBranch,
  getStagedDiff,
};
