const fs = require("fs");
const path = require("path");
const askChoice = require("../utils/askChoice");
const askQuestion = require("../utils/askQuestion");
const askYesNo = require("../utils/askYesNo");
const showHelp = require("./help");
const {
  getCurrentBranch,
  getRecentCommitActivity,
  getRepositoryName,
} = require("../services/git");
const { generateTimesheetSummaries } = require("../services/gemini");
const {
  buildFallbackTimesheetDescription,
  buildOutputPath,
  groupCommitActivityByDay,
  loadWorkbook,
  saveWorkbook,
  getWorksheetNames,
  writeTimesheetEntries,
  findHeaderRow,
  getExistingDates,
  calculateHoursFromCommits,
} = require("../services/timesheet");

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const C = {
  reset:   "\x1b[0m",
  bold:    "\x1b[1m",
  dim:     "\x1b[2m",
  cyan:    "\x1b[36m",
  green:   "\x1b[32m",
  yellow:  "\x1b[33m",
  blue:    "\x1b[34m",
  magenta: "\x1b[35m",
  red:     "\x1b[31m",
  white:   "\x1b[37m",
  gray:    "\x1b[90m",
};

function color(str, ...codes) {
  return codes.join("") + String(str) + C.reset;
}

function printBanner() {
  console.log("");
  console.log(color("  ╔════════════════════════════════════╗", C.cyan, C.bold));
  console.log(color("  ║    ", C.cyan, C.bold) + color("GitMind Timesheet", C.white, C.bold) + color("             ║", C.cyan, C.bold));
  console.log(color("  ╚════════════════════════════════════╝", C.cyan, C.bold));
  console.log("");
}

function printStep(icon, label, value) {
  const prefix = color(`  ${icon} `, C.cyan);
  const lbl    = color(label.padEnd(14), C.gray);
  const val    = color(value, C.white);
  console.log(prefix + lbl + val);
}

function printDivider() {
  console.log(color("  " + "─".repeat(54), C.gray));
}

function printSuccess(msg) {
  console.log("\n" + color("  ✔ ", C.green, C.bold) + color(msg, C.green));
}

function printWarning(msg) {
  console.log("\n" + color("  ⚠ ", C.yellow, C.bold) + color(msg, C.yellow));
}

function printError(msg) {
  console.log("\n" + color("  ✖ ", C.red, C.bold) + color(msg, C.red));
}

function printInfo(msg) {
  process.stdout.write(color("  → ", C.blue) + color(msg, C.dim) + " ");
}

function printDone(status = "done") {
  console.log(color(status, C.green));
}

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function parseTimesheetArgs() {
  const tokens = process.argv.slice(3).map((token) => String(token || "").trim());
  const result = {
    inputPath:     null,
    sheetName:     null,
    days:          7,
    branch:        null,
    helpRequested: false,
  };

  for (const token of tokens) {
    const normalized = token.toLowerCase();
    if (!normalized) continue;

    if (normalized === "help" || normalized === "-h" || normalized === "--help") {
      result.helpRequested = true;
      continue;
    }

    // --today shortcut → days=0 means since today midnight only
    if (normalized === "today" || normalized === "--today" || normalized === "-t") {
      result.days = 0;
      continue;
    }

    // --week shortcut → same as --days=7
    if (normalized === "week" || normalized === "--week" || normalized === "-w") {
      result.days = 7;
      continue;
    }

    // --days=N
    const daysMatch = normalized.match(/^--days=(\d+)$/);
    if (daysMatch) {
      const parsed = parseInt(daysMatch[1], 10);
      if (parsed > 0) result.days = parsed;
      continue;
    }

    // --branch=name
    const branchMatch = token.match(/^--branch=(.+)$/);
    if (branchMatch) {
      result.branch = branchMatch[1].trim();
      continue;
    }

    if (!token.startsWith("-") && !result.inputPath) {
      result.inputPath = token;
      continue;
    }
    if (!token.startsWith("-") && !result.sheetName) {
      result.sheetName = token;
    }
  }

  return result;
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function normalizePathInput(answer) {
  return String(answer || "")
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

async function promptForWorkbookPath() {
  while (true) {
    const answer = normalizePathInput(
      await askQuestion(color("  Enter path to your .xlsx timesheet: ", C.cyan))
    );

    if (!answer) {
      printWarning("No path entered. Timesheet cancelled.");
      return null;
    }

    const absolutePath = path.resolve(answer);

    if (!fs.existsSync(absolutePath)) {
      printError(`File not found: ${absolutePath}`);
      continue;
    }

    if (path.extname(absolutePath).toLowerCase() !== ".xlsx") {
      printError("Only .xlsx workbooks are supported.");
      continue;
    }

    return absolutePath;
  }
}

async function resolveWorkbookPath(inputPath) {
  if (inputPath) {
    const absolutePath = path.resolve(normalizePathInput(inputPath));

    if (!fs.existsSync(absolutePath)) {
      printError(`File not found: ${absolutePath}`);
      return promptForWorkbookPath();
    }

    if (path.extname(absolutePath).toLowerCase() !== ".xlsx") {
      printError("Only .xlsx workbooks are supported.");
      return promptForWorkbookPath();
    }

    return absolutePath;
  }

  return promptForWorkbookPath();
}

// ─── Sheet selection ──────────────────────────────────────────────────────────

async function resolveWorksheet(workbook, sheetName) {
  const sheetNames = getWorksheetNames(workbook);

  if (sheetNames.length === 0) {
    throw new Error("The workbook does not contain any sheets.");
  }

  if (sheetName) {
    const exactSheet = workbook.getWorksheet(sheetName);
    if (exactSheet) return exactSheet;
    printWarning(`Sheet "${sheetName}" not found — please choose from the list below.`);
  }

  if (sheetNames.length === 1) {
    return workbook.getWorksheet(sheetNames[0]);
  }

  console.log("");
  const selectedIndex = await askChoice(
    color("  Choose the sheet/tab to fill:", C.cyan),
    sheetNames,
    0
  );

  return workbook.getWorksheet(sheetNames[selectedIndex]);
}

// ─── Hours prompt ─────────────────────────────────────────────────────────────

function parseHoursInput(answer, defaultHours) {
  const normalized = String(answer || "").trim();
  if (!normalized) return defaultHours;

  const hours = Number.parseFloat(normalized);
  if (!Number.isFinite(hours) || hours <= 0) return null;

  return hours;
}

async function promptForHours(entry) {
  const suggested = entry.suggestedHours;
  const promptLabel =
    color(`  ${entry.dayKey}`, C.white, C.bold) +
    color(` [suggested: ${suggested.toFixed(1)}h] → hours: `, C.gray);

  while (true) {
    const answer = await askQuestion(promptLabel);
    const hours = parseHoursInput(answer, suggested);

    if (hours != null) return hours;
    printError("Please enter a positive number.");
  }
}

// ─── Description helpers ──────────────────────────────────────────────────────

function truncateText(text, limit = 120) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}

function buildTimesheetEntries(groups, summaryMap) {
  return groups.map((group) => {
    const summary =
      summaryMap.get(group.dayKey) ||
      buildFallbackTimesheetDescription(group.commits);

    const suggestedHours = calculateHoursFromCommits(group.commits);

    return {
      dayKey:         group.dayKey,
      dateObject:     group.date,
      description:    truncateText(summary, 120),
      hours:          null,
      suggestedHours,
    };
  });
}

// ─── Preview table ────────────────────────────────────────────────────────────

function printPreviewTable(entries, repoName, branch, workbookPath, sheetName, period, aiStatus) {
  console.log("");
  printDivider();
  console.log(color("  TIMESHEET PREVIEW", C.bold, C.white));
  printDivider();
  printStep("📁", "Workbook", path.basename(workbookPath));
  printStep("📋", "Sheet",    sheetName);
  printStep("🌿", "Repo",     repoName);
  printStep("🔀", "Branch",   branch);
  printStep("📅", "Period",   period);
  printStep(aiStatus.ok ? "✨" : "⚠", "AI",       aiStatus.message);
  printDivider();

  // Column widths
  const dateW  = 12;
  const hoursW = 7;
  const descW  = 36;

  const header =
    color("  " + "DATE".padEnd(dateW), C.bold, C.cyan) +
    color("HOURS".padEnd(hoursW), C.bold, C.cyan) +
    color("DESCRIPTION", C.bold, C.cyan);
  console.log(header);
  console.log(color("  " + "─".repeat(dateW + hoursW + descW), C.gray));

  for (const [i, entry] of entries.entries()) {
    const idx  = color(`${i + 1}.`.padEnd(3), C.gray);
    const date = color(entry.dayKey.padEnd(dateW), C.white);
    const hrs  = color(`${entry.hours.toFixed(1)}h`.padEnd(hoursW), C.green);
    const desc = color(truncateText(entry.description, descW), C.dim);
    console.log(`  ${idx}${date}${hrs}${desc}`);
  }

  printDivider();
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handleTimesheet() {
  const args = parseTimesheetArgs();

  if (args.helpRequested) {
    showHelp("timesheet");
    return;
  }

  printBanner();

  // 1. Resolve workbook path
  const inputPath = await resolveWorkbookPath(args.inputPath);
  if (!inputPath) return;

  // 2. Load workbook
  printInfo("Loading workbook...");
  let workbook;
  try {
    workbook = await loadWorkbook(inputPath);
    printDone();
  } catch (error) {
    throw new Error(`GitMind could not read the workbook: ${error.message || error}`);
  }

  // 3. Select sheet
  const worksheet = await resolveWorksheet(workbook, args.sheetName);
  if (!worksheet) {
    printWarning("No worksheet selected. Cancelled.");
    return;
  }

  // 4. Read git history
  printInfo("Reading git history...");
  const sinceDays = args.days;
  let activity;

  try {
    activity = getRecentCommitActivity({ sinceDays, branch: args.branch || null });
    printDone();
  } catch {
    throw new Error(
      "GitMind could not read git history. Make sure you run `gitmind timesheet` inside a git repository."
    );
  }

  if (!activity.length) {
    printWarning("No commits found in the selected period. Nothing to write.");
    return;
  }

  // 5. Filter out already-logged dates
  const groupedActivityAll = groupCommitActivityByDay(activity);
  const layout = findHeaderRow(worksheet);
  const existingDates = getExistingDates(worksheet, layout);

  const groupedActivity = groupedActivityAll.filter(
    (group) => !existingDates.has(group.dayKey)
  );

  if (groupedActivity.length === 0) {
    printSuccess("All commits in this period are already logged. Nothing to write.");
    return;
  }

  // 6. Get repo context
  const repositoryName = getRepositoryName() || "unknown";
  let currentBranch = "unknown";
  try {
    currentBranch = getCurrentBranch() || "unknown";
  } catch {
    currentBranch = "unknown";
  }

  // 7. Generate AI summaries
  printInfo("Generating AI summaries with Gemini...");
  let summaryMap = new Map();
  let aiStatus = { ok: false, message: "Not used (no API key or error)" };

  try {
    const aiSummaries = await generateTimesheetSummaries(groupedActivity, {
      repoName: repositoryName,
      branch:   currentBranch,
    });
    summaryMap = new Map(
      aiSummaries.map((entry) => [String(entry.date || "").trim(), entry.description])
    );
    aiStatus = { ok: true, message: "Gemini generated descriptions" };
    printDone();
  } catch (error) {
    printDone(color("skipped", C.yellow));
    aiStatus = { ok: false, message: `Fallback used (${error.message || error})` };
  }

  // 8. Build entries with auto-suggested hours
  const entries = buildTimesheetEntries(groupedActivity, summaryMap);

  // 9. Prompt for hours (show suggestion per day)
  console.log("\n" + color("  Enter hours worked each day", C.bold, C.white));
  console.log(color("  (press Enter to accept the suggested value)\n", C.gray));

  for (const entry of entries) {
    entry.hours = await promptForHours(entry);
  }

  // 10. Show preview table
  printPreviewTable(
    entries,
    repositoryName,
    args.branch || currentBranch,
    inputPath,
    worksheet.name,
    args.days === 0 ? "today only" : (args.days === 1 ? "last 1 day" : `last ${args.days ?? 7} days`),
    aiStatus
  );

  // 11. Confirm write
  const shouldWrite = await askYesNo(
    color("\n  Write these rows into the workbook? (Y/N): ", C.cyan)
  );

  if (!shouldWrite) {
    printWarning("Cancelled. No changes were written.");
    return;
  }

  // 12. Write & save to the SAME file path
  const result = writeTimesheetEntries(worksheet, entries);
  const outputPath = buildOutputPath(inputPath);

  printInfo("Saving workbook...");
  let saved = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await saveWorkbook(workbook, outputPath);
      printDone();
      saved = true;
      break;
    } catch (error) {
      const isBusy = error.code === "EBUSY" || (error.message || "").includes("EBUSY");
      if (isBusy && attempt < 3) {
        console.log("");
        printWarning(`The file is open in another program (e.g. Excel). Please close it, then press Enter to retry... (attempt ${attempt}/3)`);
        await askQuestion("");
      } else {
        throw new Error(
          isBusy
            ? `Could not save — the file is still open in another program. Please close it and run gitmind timesheet again.`
            : `GitMind could not save the workbook: ${error.message || error}`
        );
      }
    }
  }

  printSuccess(`Timesheet updated → ${outputPath}`);

  if (result.mode === "fallback") {
    console.log(
      color(
        "  (No standard header found — a Date / Description / Hours block was added at the bottom.)",
        C.gray
      )
    );
  }

  console.log("");
}

module.exports = handleTimesheet;
