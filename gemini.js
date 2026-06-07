require("dotenv").config();
const readline = require("readline");
const { GoogleGenAI } = require("@google/genai");
const { execSync } = require("child_process");

const ai = new GoogleGenAI({
 apiKey: process.env.GEMINI_API_KEY,
})

async function test(){
    const diff = execSync(
  "git diff --cached",
  { encoding: "utf8" ,maxBuffer: 10 * 1024 * 1024 }
);
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
   })

   const commitMessage = response.text.trim();

console.log("\nSuggested Commit:");
console.log(commitMessage);

const answer = await askQuestion(
  "\nAccept? (Y/N): "
);
if (answer.toLowerCase() === "y") {
    execSync(`git commit -m "${commitMessage}"`, { stdio: "inherit" });
     console.log("\nCommit created successfully!");
}
 else {

  console.log("\nCommit cancelled.");

}

}
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

test();
