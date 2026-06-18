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
} = require("../services/timesheet");

function parseTimesheetArgs() {
  const tokens = process.argv.slice(3).map((token) => String(token || "").trim());
  const result = {
    inputPath: null,
    sheetName: null,
    period: "week",
    helpRequested: false,
  };

  for (const token of tokens) {
    const normalized = token.toLowerCase();

    if (!normalized) {
      continue;
    }

    if (normalized === "help" || normalized === "-h" || normalized === "--help") {
      result.helpRequested = true;
      continue;
    }

    if (
      normalized === "today" ||
      normalized === "--today" ||
      normalized === "-t"
    ) {
      result.period = "today";
      continue;
    }

    if (normalized === "week" || normalized === "--week" || normalized === "-w") {
      result.period = "week";
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

function normalizePathInput(answer) {
  return String(answer || "")
    .trim()
    .replace(/^"(.*)"$/, "$1");
}

async function promptForWorkbookPath() {
  while (true) {
    const answer = normalizePathInput(
      await askQuestion("Enter the path to the timesheet workbook: ")
    );

    if (!answer) {
      console.log("No workbook path entered. Timesheet generation cancelled.");
      return null;
    }

    const absolutePath = path.resolve(answer);

    if (!fs.existsSync(absolutePath)) {
      console.log(`File not found: ${absolutePath}`);
      continue;
    }

    if (path.extname(absolutePath).toLowerCase() !== ".xlsx") {
      console.log("GitMind timesheet currently supports .xlsx workbooks only.");
      continue;
    }

    return absolutePath;
  }
}

async function resolveWorkbookPath(inputPath) {
  if (inputPath) {
    const absolutePath = path.resolve(normalizePathInput(inputPath));

    if (!fs.existsSync(absolutePath)) {
      console.log(`File not found: ${absolutePath}`);
      return promptForWorkbookPath();
    }

    if (path.extname(absolutePath).toLowerCase() !== ".xlsx") {
      console.log("GitMind timesheet currently supports .xlsx workbooks only.");
      return promptForWorkbookPath();
    }

    return absolutePath;
  }

  return promptForWorkbookPath();
}

async function resolveWorksheet(workbook, sheetName) {
  const sheetNames = getWorksheetNames(workbook);

  if (sheetNames.length === 0) {
    throw new Error("The workbook does not contain any sheets.");
  }

  if (sheetName) {
    const exactSheet = workbook.getWorksheet(sheetName);

    if (exactSheet) {
      return exactSheet;
    }

    console.log(`Sheet not found: ${sheetName}`);
  }

  if (sheetNames.length === 1) {
    return workbook.getWorksheet(sheetNames[0]);
  }

  const selectedIndex = await askChoice(
    "Choose the sheet/tab you want GitMind to fill:",
    sheetNames,
    0
  );

  return workbook.getWorksheet(sheetNames[selectedIndex]);
}

function parseHoursInput(answer, defaultHours = 8) {
  const normalized = String(answer || "").trim();

  if (!normalized) {
    return defaultHours;
  }

  const hours = Number.parseFloat(normalized);

  if (!Number.isFinite(hours) || hours <= 0) {
    return null;
  }

  return hours;
}

async function promptForHours(dayKey) {
  while (true) {
    const answer = await askQuestion(`Hours worked on ${dayKey} [8]: `);
    const hours = parseHoursInput(answer, 8);

    if (hours != null) {
      return hours;
    }

    console.log("Please enter a positive number of hours.");
  }
}

function buildTimesheetEntries(groups, summaryMap) {
  return groups.map((group) => {
    const summary =
      summaryMap.get(group.dayKey) ||
      buildFallbackTimesheetDescription(group.commits);

    return {
      dayKey: group.dayKey,
      dateObject: group.date,
      description: summary,
      hours: null,
    };
  });
}

function truncateText(text, limit = 110) {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3)}...`;
}

async function handleTimesheet() {
  const args = parseTimesheetArgs();

  if (args.helpRequested) {
    showHelp("timesheet");
    return;
  }

  const inputPath = await resolveWorkbookPath(args.inputPath);

  if (!inputPath) {
    return;
  }

  let workbook;

  try {
    workbook = await loadWorkbook(inputPath);
  } catch (error) {
    throw new Error(
      `GitMind could not read the workbook: ${error.message || error}`
    );
  }

  const worksheet = await resolveWorksheet(workbook, args.sheetName);

  if (!worksheet) {
    console.log("No worksheet was selected. Timesheet generation cancelled.");
    return;
  }

  const sinceDays = args.period === "today" ? 0 : 7;
  let activity;

  try {
    activity = getRecentCommitActivity({ sinceDays });
  } catch {
    throw new Error(
      "GitMind could not read git history. Make sure you run `gitmind timesheet` inside a git repository."
    );
  }

  if (!activity.length) {
    console.log("\nNo commits found in the selected period.");
    console.log("Nothing was written to the workbook.");
    return;
  }

  const groupedActivityAll = groupCommitActivityByDay(activity);
  
  const layout = findHeaderRow(worksheet);
  const existingDates = getExistingDates(worksheet, layout);
  
  const groupedActivity = groupedActivityAll.filter(
    (group) => !existingDates.has(group.dayKey)
  );

  if (groupedActivity.length === 0) {
    console.log("\nAll commits in the selected period are already logged in the timesheet.");
    console.log("Nothing was written to the workbook.");
    return;
  }

  const repositoryName = getRepositoryName() || "unknown";
  let currentBranch = "unknown";

  try {
    currentBranch = getCurrentBranch() || "unknown";
  } catch {
    currentBranch = "unknown";
  }

  let summaryMap = new Map();
  let aiStatusMessage = "AI summaries were not generated.";

  try {
    const aiSummaries = await generateTimesheetSummaries(groupedActivity, {
      repoName: repositoryName,
      branch: currentBranch,
    });

    summaryMap = new Map(
      aiSummaries.map((entry) => [String(entry.date || "").trim(), entry.description])
    );
    aiStatusMessage = "Gemini generated the daily descriptions.";
  } catch (error) {
    aiStatusMessage = `Gemini was not used: ${error.message || error}`;
  }

  const entries = buildTimesheetEntries(groupedActivity, summaryMap).map(
    (entry) => ({
      ...entry,
      description: truncateText(entry.description, 140),
    })
  );

  for (const entry of entries) {
    entry.hours = await promptForHours(entry.dayKey);
  }

  console.log("\nGitMind timesheet preview");
  console.log(`Repository: ${repositoryName}`);
  console.log(`Branch: ${currentBranch}`);
  console.log(`Workbook: ${path.basename(inputPath)}`);
  console.log(`Sheet: ${worksheet.name}`);
  console.log(`Period: ${args.period}`);
  console.log(aiStatusMessage);
  console.log("");

  entries.forEach((entry, index) => {
    console.log(
      `${index + 1}. ${entry.dayKey} | ${entry.hours.toFixed(2)}h | ${entry.description}`
    );
  });

  const shouldWrite = await askYesNo("\nWrite these rows into the workbook? (Y/N): ");

  if (!shouldWrite) {
    console.log("\nTimesheet generation cancelled.");
    return;
  }

  const result = writeTimesheetEntries(worksheet, entries);
  const outputPath = buildOutputPath(inputPath);

  try {
    await saveWorkbook(workbook, outputPath);
  } catch (error) {
    throw new Error(
      `GitMind could not save the workbook: ${error.message || error}`
    );
  }

  console.log("\nTimesheet filled successfully.");
  console.log(`Saved to: ${outputPath}`);

  if (result.mode === "fallback") {
    console.log(
      "GitMind did not find a standard timesheet header, so it added a simple Date / Description / Hours block at the bottom of the sheet."
    );
  }
}

module.exports = handleTimesheet;
