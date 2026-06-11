const askSecret = require("../utils/askSecret");
const askYesNo = require("../utils/askYesNo");
const showHelp = require("./help");
const {
  DEFAULT_MODEL,
  deleteGeminiApiKey,
  getConfigStatus,
  saveGeminiApiKey,
} = require("../services/config");

function getConfigAction() {
  return (process.argv[3] || "").trim().toLowerCase();
}

async function showConfigStatus() {
  const status = await getConfigStatus();

  console.log("\nGitMind config");
  console.log(`Status: ${status.configured ? "configured" : "not configured"}`);
  console.log(`Storage: ${status.storage}`);
  console.log(`Model: ${status.model || DEFAULT_MODEL}`);

  if (status.configured) {
    console.log(`API key: saved (${status.fingerprint})`);
    console.log("Run `gitmind commit` to generate a commit message.");
  } else {
    console.log("API key: not saved");
    console.log("Run `gitmind config` to save your Gemini API key.");
  }
}

async function resetConfig() {
  const status = await getConfigStatus();

  if (!status.configured) {
    console.log("\nNo API key is currently saved.");
    console.log("Run `gitmind config` to add one.");
    return;
  }

  const shouldReset = await askYesNo(
    "Remove the saved Gemini API key from the OS keychain? (Y/N): "
  );

  if (!shouldReset) {
    console.log("\nReset cancelled.");
    return;
  }

  const deleted = await deleteGeminiApiKey();

  if (!deleted) {
    console.log("\nNo API key was found in the OS keychain.");
    return;
  }

  console.log("\nGitMind API key removed from the OS keychain.");
  console.log("Run `gitmind config` to save a new key when ready.");
}

async function setupConfig() {
  console.log("\nGitMind setup");
  console.log(
    "GitMind does not read API keys from .env. Paste your Gemini API key here once and we will store it in your OS keychain."
  );
  console.log(
    "If you do not have a key yet, create one in Google AI Studio first.\n"
  );

  const status = await getConfigStatus();

  if (status.configured) {
    const shouldReplace = await askYesNo(
      "A Gemini API key is already saved. Replace it? (Y/N): "
    );

    if (!shouldReplace) {
      console.log("\nKeeping the existing API key.");
      console.log(`API key: saved (${status.fingerprint})`);
      console.log(`Storage: ${status.storage}`);
      console.log(`Model: ${status.model}`);
      console.log("Next: run `gitmind commit`.");
      return;
    }
  }

  const apiKey = (await askSecret("Enter your Gemini API key: ")).trim();

  if (!apiKey) {
    console.log("\nNo API key entered. Setup cancelled.");
    return;
  }

  const fingerprint = await saveGeminiApiKey(apiKey);

  console.log("\nGitMind is configured.");
  console.log("The API key was saved securely in the OS keychain.");
  console.log(`API key: saved (${fingerprint})`);
  console.log(`Storage: OS keychain`);
  console.log(`Model: ${DEFAULT_MODEL}`);
  console.log("Next: run `gitmind commit`.");
}

async function handleConfig() {
  const action = getConfigAction();

  if (action === "help" || action === "-h" || action === "--help") {
    showHelp("config");
    return;
  }

  if (action === "status") {
    await showConfigStatus();
    return;
  }

  if (action === "reset") {
    await resetConfig();
    return;
  }

  await setupConfig();
}

module.exports = handleConfig;
