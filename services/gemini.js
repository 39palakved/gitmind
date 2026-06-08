require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const commitMessage = (response.text || "").trim();

  if (!commitMessage) {
    throw new Error("Gemini returned an empty commit message.");
  }

  return commitMessage;
}

module.exports = {
  generateCommitMessage,
};
