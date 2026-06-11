const { GoogleGenAI } = require("@google/genai");
const { DEFAULT_MODEL, getConfiguredGeminiApiKey } = require("./config");

async function createAiClient() {
  const apiKey = await getConfiguredGeminiApiKey();

  if (!apiKey) {
    throw new Error(
      "GitMind is not configured yet. Run `gitmind config` first to save your Gemini API key."
    );
  }

  return new GoogleGenAI({
    apiKey,
  });
}

async function generateCommitMessage(diff, branch) {
  if (!diff || !diff.trim()) {
    throw new Error(
      "No staged changes found. Stage your files before generating a commit message."
    );
  }

  const prompt = `
You are a senior software engineer.

Current Branch:
${branch}

Analyze the git diff.

Generate ONE Conventional Commit message.

Rules:
- Return only the commit message.
- No explanations.
- No markdown.
- Max 72 chars.

Git Diff:

${diff}
`;

  const ai = await createAiClient();
  const model = DEFAULT_MODEL;

  let response;

  try {
    response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
  } catch (error) {
    const message = String(error?.message || error).toLowerCase();

    if (
      message.includes("quota") ||
      message.includes("resource_exhausted") ||
      message.includes("429")
    ) {
      throw new Error(
        "Gemini quota reached or the API key is no longer usable. Run `gitmind config reset`, then run `gitmind config` to save a new key."
      );
    }

    if (
      message.includes("api key") ||
      message.includes("unauthor") ||
      message.includes("invalid") ||
      message.includes("forbidden")
    ) {
      throw new Error(
        "The saved Gemini API key is invalid. Run `gitmind config reset`, then run `gitmind config` to save a new key."
      );
    }

    throw error;
  }

  const commitMessage = (response.text || "").trim();

  if (!commitMessage) {
    throw new Error("Gemini returned an empty commit message.");
  }

  return commitMessage;
}

module.exports = {
  generateCommitMessage,
};
