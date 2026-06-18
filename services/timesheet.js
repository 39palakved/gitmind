const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const HEADER_PATTERNS = {
  date: ["date", "day"],
  description: [
    "description",
    "activity",
    "task",
    "work",
    "summary",
    "details",
    "project",
    "notes",
    "note",
    "remarks",
    "remark",
    "job",
  ],
  hours: ["hours", "hour", "hrs", "time", "duration"],
};

function isBlankValue(value) {
  if (value == null) {
    return true;
  }

  if (typeof value === "string") {
    return !value.trim();
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getCellText(cell) {
  return String(cell?.text || "").trim();
}

function matchesPattern(normalizedText, patterns) {
  return patterns.some((pattern) => normalizedText.includes(pattern));
}

function parseDayKey(dayKey) {
  const [year, month, day] = String(dayKey)
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function stripConventionalPrefix(subject) {
  return String(subject || "")
    .replace(/^[a-z]+(?:\([^)]+\))?:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFallbackTimesheetDescription(commits) {
  const subjects = commits
    .map((commit) => stripConventionalPrefix(commit.subject))
    .filter(Boolean);

  if (subjects.length === 0) {
    return "Worked on recent code changes and project updates.";
  }

  const preview = subjects.slice(0, 2).join("; ");

  if (preview.length <= 110) {
    return `Worked on ${preview}.`;
  }

  return `Worked on ${subjects[0]} and related updates.`;
}

function groupCommitActivityByDay(activity) {
  const buckets = new Map();

  for (const entry of Array.isArray(activity) ? activity : []) {
    if (!entry?.dayKey) {
      continue;
    }

    if (!buckets.has(entry.dayKey)) {
      buckets.set(entry.dayKey, []);
    }

    buckets.get(entry.dayKey).push(entry);
  }

  return Array.from(buckets.entries())
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([dayKey, commits]) => ({
      dayKey,
      date: parseDayKey(dayKey),
      commits: commits
        .slice()
        .sort((left, right) =>
          String(left.date || "").localeCompare(String(right.date || ""))
        ),
    }))
    .filter((group) => group.date);
}

async function loadWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

async function saveWorkbook(workbook, outputPath) {
  await workbook.xlsx.writeFile(outputPath);
}

function getWorksheetNames(workbook) {
  return workbook.worksheets.map((worksheet) => worksheet.name);
}

function findHeaderRow(worksheet, maxRows = 30, maxCols = 20) {
  const lastRow = Math.max(worksheet.actualRowCount || 0, 1);
  const rowLimit = Math.min(Math.max(maxRows, 1), lastRow);
  const columnLimit = Math.min(
    Math.max(maxCols, 1),
    Math.max(worksheet.actualColumnCount || 0, 12)
  );

  let best = null;

  for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columns = {};
    let score = 0;

    for (let columnNumber = 1; columnNumber <= columnLimit; columnNumber += 1) {
      const normalizedText = normalizeText(getCellText(row.getCell(columnNumber)));

      if (!normalizedText) {
        continue;
      }

      if (!columns.date && matchesPattern(normalizedText, HEADER_PATTERNS.date)) {
        columns.date = columnNumber;
        score += 1;
        continue;
      }

      if (
        !columns.description &&
        matchesPattern(normalizedText, HEADER_PATTERNS.description)
      ) {
        columns.description = columnNumber;
        score += 1;
        continue;
      }

      if (!columns.hours && matchesPattern(normalizedText, HEADER_PATTERNS.hours)) {
        columns.hours = columnNumber;
        score += 1;
      }
    }

    if (!best || score > best.score) {
      best = {
        rowNumber,
        score,
        columns,
      };
    }
  }

  if (!best || best.score < 2) {
    return null;
  }

  if (!best.columns.date || !best.columns.description || !best.columns.hours) {
    return null;
  }

  return {
    headerRow: best.rowNumber,
    columns: best.columns,
  };
}

function getLastUsedRow(worksheet) {
  let lastUsedRow = 0;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowHasAnyValue(row)) {
      lastUsedRow = rowNumber;
    }
  });

  return lastUsedRow;
}

function rowHasAnyValue(row) {
  let hasValue = false;

  row.eachCell({ includeEmpty: false }, (cell) => {
    if (!hasValue && !isBlankValue(cell.value)) {
      hasValue = true;
    }
  });

  return hasValue;
}

function findInsertionRow(worksheet, headerRow, columns) {
  const targetColumns = [columns.date, columns.description, columns.hours].filter(
    Boolean
  );
  let lastDataRow = headerRow;
  const lastRow = Math.max(worksheet.actualRowCount || 0, headerRow);

  for (let rowNumber = headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const hasTargetData = targetColumns.some((columnNumber) => {
      return !isBlankValue(row.getCell(columnNumber).value);
    });

    if (hasTargetData) {
      lastDataRow = rowNumber;
    }
  }

  return lastDataRow + 1;
}

function styleFallbackHeaderCell(cell) {
  cell.font = {
    bold: true,
    color: { argb: "FF0F172A" },
  };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };
}

function writeEntryCell(cell, value, type) {
  cell.value = value;

  if (type === "date") {
    cell.numFmt = "yyyy-mm-dd";
    return;
  }

  if (type === "hours") {
    cell.numFmt = "0.00";
    return;
  }

  if (type === "description") {
    cell.alignment = {
      wrapText: true,
      vertical: "top",
    };
  }
}

function writeTimesheetEntries(worksheet, entries) {
  const layout = findHeaderRow(worksheet);

  if (layout) {
    const startRow = findInsertionRow(
      worksheet,
      layout.headerRow,
      layout.columns
    );

    entries.forEach((entry, index) => {
      const rowNumber = startRow + index;
      writeEntryCell(
        worksheet.getCell(rowNumber, layout.columns.date),
        entry.dateObject,
        "date"
      );
      writeEntryCell(
        worksheet.getCell(rowNumber, layout.columns.description),
        entry.description,
        "description"
      );
      writeEntryCell(
        worksheet.getCell(rowNumber, layout.columns.hours),
        entry.hours,
        "hours"
      );
    });

    // Auto-adjust column width for date to avoid ########
    const dateCol = worksheet.getColumn(layout.columns.date);
    if (!dateCol.width || dateCol.width < 12) dateCol.width = 12;

    return {
      mode: "existing",
      startRow,
      endRow: startRow + entries.length - 1,
      layout,
    };
  }

  const lastUsedRow = getLastUsedRow(worksheet);
  const startRow = lastUsedRow > 0 ? lastUsedRow + 2 : 1;
  const headers = ["Date", "Description", "Hours"];

  headers.forEach((header, index) => {
    const cell = worksheet.getCell(startRow, index + 1);
    cell.value = header;
    styleFallbackHeaderCell(cell);
  });

  entries.forEach((entry, index) => {
    const rowNumber = startRow + 1 + index;
    writeEntryCell(worksheet.getCell(rowNumber, 1), entry.dateObject, "date");
    writeEntryCell(
      worksheet.getCell(rowNumber, 2),
      entry.description,
      "description"
    );
    writeEntryCell(worksheet.getCell(rowNumber, 3), entry.hours, "hours");
  });

  worksheet.getColumn(1).width = 12;
  worksheet.getColumn(2).width = 50;
  worksheet.getColumn(3).width = 10;

  return {
    mode: "fallback",
    startRow,
    endRow: startRow + entries.length,
    layout: {
      headerRow: startRow,
      columns: {
        date: 1,
        description: 2,
        hours: 3,
      },
    },
  };
}

function buildOutputPath(inputPath) {
  return path.resolve(inputPath);
}

function getExistingDates(worksheet, layout) {
  const existingDates = new Set();
  if (!layout || !layout.columns.date) {
    return existingDates;
  }

  const dateCol = layout.columns.date;
  const lastRow = Math.max(worksheet.actualRowCount || 0, layout.headerRow);

  for (let rowNumber = layout.headerRow + 1; rowNumber <= lastRow; rowNumber += 1) {
    const cellValue = worksheet.getCell(rowNumber, dateCol).value;
    if (!isBlankValue(cellValue)) {
      let dateObj;
      if (cellValue instanceof Date) {
        dateObj = cellValue;
      } else {
        dateObj = new Date(cellValue);
      }

      if (dateObj && !Number.isNaN(dateObj.getTime())) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const day = String(dateObj.getDate()).padStart(2, "0");
        existingDates.add(`${year}-${month}-${day}`);
      }
    }
  }

  return existingDates;
}

module.exports = {
  buildFallbackTimesheetDescription,
  buildOutputPath,
  groupCommitActivityByDay,
  loadWorkbook,
  saveWorkbook,
  getWorksheetNames,
  writeTimesheetEntries,
  findHeaderRow,
  getExistingDates,
};
