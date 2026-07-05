# GitMind AI

**AI-powered CLI tool that writes your commit messages and fills your timesheets — automatically.**

GitMind reads your actual git repository (staged diffs, commit history, branch names) and uses **Google's Gemini AI** to generate context-aware commit messages and timesheet entries, so you spend less time on repetitive developer admin work.

```bash
npm install -g gitmind-ai
```

---

## Table of Contents

- [Why GitMind?](#why-gitmind)
- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
- [Commands](#commands)
  - [gitmind config](#gitmind-config)
  - [gitmind commit](#gitmind-commit)
  - [gitmind timesheet](#gitmind-timesheet)
  - [gitmind init](#gitmind-init)
  - [gitmind hook](#gitmind-hook)
  - [gitmind help](#gitmind-help)
- [How It Works](#how-it-works)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Security](#security)
- [Design Decisions](#design-decisions)
- [License](#license)

---

## Why GitMind?

Every developer runs into the same two time-wasters, every single day:

1. **Writing commit messages is tedious.** Most people either write vague messages like `fixed stuff`, or spend real time thinking about proper Conventional Commit wording (`feat:`, `fix:`, `chore:`, etc.).
2. **Filling timesheets is painful.** Many companies require daily or weekly timesheets in Excel. Developers forget what they worked on, guess the hours, or fill everything in at the end of the week from memory.

GitMind solves both problems by reading data you already have — your git history — and using AI to turn it into clean, professional output.

---

## Features

- 🤖 **AI-generated commit messages** — analyzes your staged diff and branch name, and produces a single, standards-compliant Conventional Commit message.
- 📊 **AI-powered Excel timesheet automation** — reads your git commit history, groups it by day, writes professional work descriptions and auto-calculated hours directly into your existing `.xlsx` file.
- 🪝 **Git hook integration** — auto-fills your commit message editor every time you run a plain `git commit`, no extra command needed.
- 🔒 **Secure credential storage** — your Gemini API key is stored in your OS's native keychain (macOS Keychain / Windows Credential Manager / Linux Secret Service), never in a `.env` file or source control.
- 🪶 **Zero framework overhead** — no Commander.js, no Inquirer.js. Built entirely on Node.js built-ins (`readline`, `process.argv`) to stay lightweight.
- 🔁 **Graceful AI fallback** — if Gemini isn't configured or the API call fails, GitMind falls back to local summaries built from your commit messages instead of crashing.

---

## Installation

Requires **Node.js ≥ 18.0.0**.

```bash
npm install -g gitmind-ai
```

This installs the `gitmind` command globally on your machine.

---

## Getting Started

1. **Get a Gemini API key** from [Google AI Studio](https://aistudio.google.com/).
2. **Configure GitMind:**
   ```bash
   gitmind config
   ```
   Paste your API key when prompted (input is hidden). GitMind stores it securely in your OS keychain.
3. **Generate a commit message:**
   ```bash
   git add .
   gitmind commit
   ```
4. **Fill a timesheet:**
   ```bash
   gitmind timesheet path/to/timesheet.xlsx
   ```

That's it — you're up and running.

---

## Commands

### `gitmind config`

Sets up the Gemini API key that powers all AI features.

- Prompts for your Gemini API key with masked (hidden) input.
- Saves the key to your OS's native keychain using `keytar` — never to a file.
- Generates a SHA-256 fingerprint (first 8 characters) for identification.
- Confirms setup with storage location, model name (`gemini-2.5-flash`), and fingerprint.

**Sub-commands:**

| Command | Description |
|---|---|
| `gitmind config status` | Shows whether a key is saved, the storage method, model, and masked fingerprint. |
| `gitmind config reset` | Removes the saved API key from the OS keychain (asks for confirmation). |

If a key already exists, running `gitmind config` again asks whether to replace it.

---

### `gitmind commit`

The core command. Run it after staging your changes with `git add`.

**Flow:**

1. Checks for staged changes via `git diff --cached`. If nothing is staged, explains what to do — and distinguishes between "no changes exist" vs. "changes exist but aren't staged."
2. Reads the current branch name for extra context (e.g. `feature/auth`, `main`).
3. Sends the diff + branch name to Gemini with a prompt instructing it to act as a senior engineer and return **one** Conventional Commit message (max 72 characters, no markdown, no explanation).
4. Displays the suggested message in the terminal.
5. Asks for approval (**Y** to accept, **N** to cancel).
6. Runs `git commit -m "<generated message>"` if approved.
7. Offers to push — automatically detects the correct remote (checks for an existing upstream branch, falls back to `origin`).
8. Pushes via `git push`, or `git push -u origin <branch>` if no upstream is set.

One command takes you from staged changes → AI-generated message → local commit → pushed to remote.

---

### `gitmind timesheet`

The most feature-rich command. Automates filling an existing Excel timesheet from your git history.

```bash
gitmind timesheet path/to/timesheet.xlsx
```

**Flow:**

1. Resolves the workbook path (as an argument, or prompts interactively). Validates the file exists and is `.xlsx`.
2. Loads the workbook using `ExcelJS`.
3. If the workbook has multiple sheets, lets you pick which one to fill (auto-selects if there's only one).
4. Reads `git log` for the configured time range and extracts commit hash, date, subject, and body.
5. Groups commits by day.
6. Scans the sheet for dates that already have entries and **skips them automatically** to prevent duplicates.
7. Sends the grouped commit data to Gemini, which returns a JSON array of `{ date, description }` pairs. Falls back to local summaries (built from commit subjects) if Gemini is unavailable.
8. **Auto-calculates hours per day** from commit timestamps:
   - A single commit in a day → assumes 2 hours.
   - Multiple commits → adds 1 hour before the first commit, then measures the gap between consecutive commits (capped at 2 hours per gap, to account for breaks).
   - Rounds to 1 decimal place.
9. Shows the auto-suggested hours per day and lets you accept (Enter) or override with a custom value.
10. Displays a preview table (workbook, sheet, repo, branch, time period, AI status, and every entry) before writing anything.
11. Asks for final confirmation.
12. Writes to the worksheet — finds the header row by scanning for columns like "Date", "Description", "Hours" (and common variants like "Activity", "Task", "Duration"). Inserts new rows after the last existing data row, or creates a styled Date/Description/Hours block if no header is found.
13. Saves back to the **same file**. Retries up to 3 times if the file is locked (e.g. open in Excel).

**Options:**

| Flag | Description |
|---|---|
| `--today` | Only look at today's commits. |
| `--week` | Look back 7 days (default). |
| `--days=N` | Look back N days. |
| `--branch=NAME` | Only read commits from a specific branch (default: current branch). |

**Examples:**

```bash
gitmind timesheet timesheet.xlsx                        # last 7 days, current branch
gitmind timesheet timesheet.xlsx --today                # only today
gitmind timesheet timesheet.xlsx --days=2               # last 2 days
gitmind timesheet timesheet.xlsx --branch=feature/auth  # specific branch
gitmind timesheet timesheet.xlsx --days=5 --branch=main # combined
```

---

### `gitmind init`

Installs a git hook so AI commit messages happen automatically — no need to run `gitmind commit` by hand.

**What it does:**

1. Finds the repository root (`.git` directory).
2. Creates a `prepare-commit-msg` hook script in `.git/hooks/`.
3. Makes the hook executable (`chmod 755`).

Once installed, just run `git commit` normally — GitMind's AI message will already be pre-filled in your editor for you to review or edit.

---

### `gitmind hook`

Internal command, not meant to be run directly. This is what the `prepare-commit-msg` hook (installed by `gitmind init`) calls behind the scenes:

- Reads the staged diff.
- Gets the current branch.
- Calls Gemini to generate a commit message.
- Writes the AI message at the top of the commit message file, preserving any existing content.

---

### `gitmind help`

Shows usage information.

```bash
gitmind help              # general overview
gitmind help config       # detailed help for config
gitmind help commit       # detailed help for commit
gitmind help timesheet    # detailed help for timesheet, including all flags
```

Also triggered by `gitmind -h`, `gitmind --help`, or running `gitmind` with no arguments.

---

## How It Works

At a high level, GitMind is a thin orchestration layer over three things you already have:

1. **Your git repository** — diffs, commit history, and branch names, read directly via `child_process` calls to the git CLI.
2. **Google's Gemini AI** (`gemini-2.5-flash`) — used to turn raw diffs and commit history into human-quality text (commit messages, work descriptions).
3. **Your existing Excel timesheet** — read and written in place using `ExcelJS`, so your formatting and existing structure are preserved.

Each command follows the same pattern: **gather context → send to Gemini (with fallback) → preview → confirm → apply.** Nothing is written to disk or committed to git without your explicit approval.

---

## Project Structure

```
gitmind/
├── index.js                  # Entry point — CLI router mapping commands to handlers
├── commands/
│   ├── config.js             # API key setup, status check, reset
│   ├── commit.js             # AI commit message generation + push flow
│   ├── timesheet.js          # Excel timesheet automation (490 lines)
│   ├── hook.js                # Git hook handler (prepare-commit-msg)
│   ├── init.js                # Git hook installer
│   └── help.js                # Help text for all commands
├── services/
│   ├── gemini.js              # Google Gemini AI client (commit + timesheet prompts)
│   ├── git.js                 # Git operations (diff, log, branch, push, status)
│   ├── config.js               # OS keychain storage (keytar) + SHA-256 fingerprinting
│   └── timesheet.js            # Excel workbook read/write (ExcelJS) + header detection
├── utils/
│   ├── askChoice.js            # Interactive numbered choice prompt
│   ├── askQuestion.js          # Simple text input prompt
│   ├── askSecret.js             # Hidden/masked input prompt (for API keys)
│   └── askYesNo.js              # Y/N confirmation prompt
├── package.json                # NPM package config (bin: gitmind → index.js)
└── .npmignore                  # Files excluded from NPM publish
```

**Design principles:**

- **Zero external CLI frameworks** — all CLI parsing, prompts, and interactive input are built from scratch using Node's built-in `readline` and `process.argv`, keeping the dependency footprint minimal.
- **Service-layer separation** — git operations, Gemini calls, config management, and timesheet logic each live in their own module. Commands only orchestrate the flow.
- **Graceful fallbacks** — if Gemini isn't configured or fails, the timesheet command falls back to local commit-based summaries instead of crashing.
- **Duplicate prevention** — the timesheet command always scans existing dates before writing, so re-running it never creates duplicate rows.

---

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js (≥ 18.0.0) |
| Language | JavaScript (CommonJS) |
| AI Engine | Google Gemini AI (`gemini-2.5-flash` via `@google/genai`) |
| Excel Processing | ExcelJS |
| Credential Storage | `keytar` (OS-native keychain) |
| Git Integration | Node's `child_process` (`execFileSync`, `execSync`) |
| CLI Interface | Custom-built — `process.argv` + `readline` |
| Publishing | NPM (`gitmind-ai`) |

---

## Security

- API keys are stored in your **OS-native keychain** (macOS Keychain, Windows Credential Manager, or Linux Secret Service) — never in `.env` files or plain text.
- A **SHA-256 fingerprint** of your key is used for identification/display, so the real key is never printed to the terminal.
- API key input is **masked** during entry.
- Since keys never touch a file in your project directory, they cannot be accidentally committed to git.

---

## Design Decisions

- **No CLI frameworks.** Commander.js and Inquirer.js are common choices for Node CLIs, but GitMind intentionally avoids them to stay lightweight — all argument parsing and interactive prompts are hand-built on top of Node's built-ins.
- **Write in place, not to a copy.** The timesheet command writes back to your existing `.xlsx` file rather than generating a new one, preserving your formatting and history.
- **AI is optional, not required.** Every AI-dependent feature has a non-AI fallback, so the tool remains usable even without a configured Gemini key.

---

## License

MIT © [Palak Ved](https://github.com/39palakved)
