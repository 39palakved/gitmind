const crypto = require("crypto");
const keytar = require("keytar");

const APP_NAME = "gitmind";
const KEYCHAIN_ACCOUNT = "gemini-api-key";
const DEFAULT_MODEL = "gemini-2.5-flash";

function fingerprintApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 8);
}

async function getStoredGeminiApiKey() {
  try {
    return await keytar.getPassword(APP_NAME, KEYCHAIN_ACCOUNT);
  } catch {
    return null;
  }
}

async function getConfiguredGeminiApiKey() {
  const storedApiKey = await getStoredGeminiApiKey();

  if (storedApiKey && storedApiKey.trim()) {
    return storedApiKey.trim();
  }

  return null;
}

async function saveGeminiApiKey(apiKey) {
  const normalizedApiKey = apiKey.trim();

  if (!normalizedApiKey) {
    throw new Error("Gemini API key is required.");
  }

  try {
    await keytar.setPassword(APP_NAME, KEYCHAIN_ACCOUNT, normalizedApiKey);
  } catch {
    throw new Error(
      "GitMind could not save the API key to your OS keychain. Make sure your keychain is available, then run `gitmind config` again."
    );
  }

  return fingerprintApiKey(normalizedApiKey);
}

async function deleteGeminiApiKey() {
  try {
    return await keytar.deletePassword(APP_NAME, KEYCHAIN_ACCOUNT);
  } catch {
    throw new Error(
      "GitMind could not remove the API key from your OS keychain. Please try `gitmind config reset` again."
    );
  }
}

async function getConfigStatus() {
  const apiKey = await getStoredGeminiApiKey();

  if (!apiKey) {
    return {
      configured: false,
      storage: "OS keychain",
      model: DEFAULT_MODEL,
      fingerprint: null,
    };
  }

  return {
    configured: true,
    storage: "OS keychain",
    model: DEFAULT_MODEL,
    fingerprint: fingerprintApiKey(apiKey),
  };
}

module.exports = {
  DEFAULT_MODEL,
  deleteGeminiApiKey,
  getConfigStatus,
  getConfiguredGeminiApiKey,
  getStoredGeminiApiKey,
  saveGeminiApiKey,
};
