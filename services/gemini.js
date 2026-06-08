require("dotenv").config();

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function generateCommitMessage(diff) {
  if (!diff || !diff.trim()) {
    throw new Error(
      "No staged changes found. Stage your files before generating a commit message."
    );
  }

  const prompt = `
You are an expert software engineer.

Generate ONE conventional commit message.

Rules:
- Return ONLY the commit message
- No explanation
- No markdown
- No options

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
