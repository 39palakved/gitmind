const path = require("path");
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

function getRepositoryRoot() {
  try {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
    }).trim();

    return root || null;
  } catch {
    return null;
  }
}

function getRepositoryName() {
  const root = getRepositoryRoot();

  if (!root) {
    return null;
  }

  return path.basename(root);
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

function toLocalDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toLocalGitDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day} 00:00:00`;
}

function getRecentCommitActivity({ sinceDays = 7, branch = null } = {}) {
  const days = Number.isFinite(sinceDays) ? Math.max(0, sinceDays) : 7;
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  sinceDate.setHours(0, 0, 0, 0);

  const since = toLocalGitDateTime(sinceDate);

  // If a specific branch is requested, use it; otherwise read from current branch
  const branchArgs = branch ? [branch] : [];

  const output = execFileSync(
    "git",
    [
      "log",
      "--no-merges",
      `--since=${since}`,
      "--date=iso-strict",
      "--pretty=format:%H%x1f%ad%x1f%s%x1f%b%x1e",
      ...branchArgs,
    ],
    {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash = "", dateText = "", subject = "", body = ""] = record.split(
        "\x1f"
      );
      const date = new Date(dateText);
      const cleanSubject = subject.trim();
      const cleanBody = body.trim();

      return {
        hash,
        date: dateText,
        dayKey: Number.isNaN(date.getTime()) ? null : toLocalDayKey(date),
        subject: cleanSubject,
        body: cleanBody,
        message: cleanBody ? `${cleanSubject} ${cleanBody}`.trim() : cleanSubject,
      };
    })
    .filter((entry) => entry.dayKey);
}

module.exports = {
  getCurrentBranch,
  getCurrentUpstreamBranch,
  getDefaultRemoteName,
  getRecentCommitActivity,
  getRepositoryName,
  getRepositoryRoot,
  getRepositoryStatus,
  getStagedDiff,
  getPushRemoteName,
  getRemoteNames,
  pushCurrentBranch,
};
