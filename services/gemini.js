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

function normalizeGeminiError(error) {
  const message = String(error?.message || error).toLowerCase();

  if (
    message.includes("quota") ||
    message.includes("resource_exhausted") ||
    message.includes("429")
  ) {
    return new Error(
      "Gemini quota reached or the API key is no longer usable. Run `gitmind config reset`, then run `gitmind config` to save a new key."
    );
  }

  if (
    message.includes("api key") ||
    message.includes("unauthor") ||
    message.includes("invalid") ||
    message.includes("forbidden")
  ) {
    return new Error(
      "The saved Gemini API key is invalid. Run `gitmind config reset`, then run `gitmind config` to save a new key."
    );
  }

  return error;
}

async function runGeminiPrompt(prompt) {
  const ai = await createAiClient();

  try {
    return await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
    });
  } catch (error) {
    throw normalizeGeminiError(error);
  }
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

  const response = await runGeminiPrompt(prompt);

  const commitMessage = (response.text || "").trim();

  if (!commitMessage) {
    throw new Error("Gemini returned an empty commit message.");
  }

  return commitMessage;
}

function extractJsonPayload(text) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const genericMatch = text.match(/```\s*([\s\S]*?)```/i);
  const raw = (fencedMatch?.[1] || genericMatch?.[1] || text).trim();

  return JSON.parse(raw);
}

async function generateTimesheetSummaries(commitGroups, context = {}) {
  if (!Array.isArray(commitGroups) || commitGroups.length === 0) {
    return [];
  }

  const repoName = String(context.repoName || "").trim();
  const branch = String(context.branch || "").trim();

  const prompt = `
You are helping fill a timesheet.

For each date, summarize the commit activity into one concise, professional work description.

Rules:
- Return only valid JSON.
- Return an array of objects.
- Each object must have "date" and "description".
- Keep descriptions short and professional.
- Do not invent hours.

Repository:
${repoName || "unknown"}

Current Branch:
${branch || "unknown"}

Input commit groups:
${JSON.stringify(commitGroups, null, 2)}
`;

  const response = await runGeminiPrompt(prompt);
  const rawText = (response.text || "").trim();

  if (!rawText) {
    throw new Error("Gemini returned an empty timesheet summary.");
  }

  const parsed = extractJsonPayload(rawText);

  if (!Array.isArray(parsed)) {
    throw new Error("Gemini did not return a JSON array for the timesheet summary.");
  }

  return parsed
    .map((item) => ({
      date: String(item?.date || "").trim(),
      description: String(item?.description || "").trim(),
    }))
    .filter((item) => item.date && item.description);
}

module.exports = {
  generateCommitMessage,
  generateTimesheetSummaries,
};
