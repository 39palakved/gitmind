const { execFileSync, execSync } = require("child_process");

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

function getRemoteNames() {
  try {
    const remoteOutput = execSync("git remote", {
      encoding: "utf8",
    }).trim();

    if (!remoteOutput) {
      return [];
    }

    return remoteOutput.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function getDefaultRemoteName() {
  const remotes = getRemoteNames();

  if (remotes.includes("origin")) {
    return "origin";
  }

  return remotes[0] || null;
}

function getCurrentUpstreamBranch() {
  try {
    const upstream = execSync(
      "git rev-parse --abbrev-ref --symbolic-full-name @{u}",
      {
        encoding: "utf8",
      }
    ).trim();

    return upstream || null;
  } catch {
    return null;
  }
}

function getPushRemoteName() {
  const upstreamBranch = getCurrentUpstreamBranch();

  if (upstreamBranch) {
    return upstreamBranch.split("/")[0] || null;
  }

  return getDefaultRemoteName();
}

function pushCurrentBranch() {
  const branch = getCurrentBranch();

  if (!branch || branch === "unknown") {
    throw new Error(
      "GitMind could not determine the current branch, so it cannot push this commit."
    );
  }

  const upstreamBranch = getCurrentUpstreamBranch();

  if (upstreamBranch) {
    execFileSync("git", ["push"], {
      stdio: "inherit",
    });

    return {
      branch,
      remote: upstreamBranch.split("/")[0] || null,
    };
  }

  const remote = getDefaultRemoteName();

  if (!remote) {
    throw new Error(
      "No git remote is configured. Add a remote such as origin before pushing to GitHub."
    );
  }

  execFileSync("git", ["push", "-u", remote, branch], {
    stdio: "inherit",
  });

  return {
    branch,
    remote,
  };
}

module.exports = {
  getCurrentBranch,
  getCurrentUpstreamBranch,
  getDefaultRemoteName,
  getRepositoryStatus,
  getStagedDiff,
  getPushRemoteName,
  getRemoteNames,
  pushCurrentBranch,
};
