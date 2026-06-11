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

function getRepositoryStatus() {
  const statusOutput = execSync("git status --porcelain=v1", {
    encoding: "utf8",
  });

  const entries = statusOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => ({
      code: line.slice(0, 2),
      path: line.slice(3).trim(),
      raw: line,
    }));

  return {
    entries,
    hasAnyChanges: entries.length > 0,
    hasUnstagedChanges: entries.some((entry) => {
      return entry.code === "??" || entry.code[1] !== " ";
    }),
  };
}

module.exports = {
  getCurrentBranch,
  getRepositoryStatus,
  getStagedDiff,
};
