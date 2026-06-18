const askQuestion = require("./askQuestion");

async function askChoice(question, options, defaultIndex = 0) {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error("askChoice requires at least one option.");
  }

  while (true) {
    console.log(question);

    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option}`);
    });

    const answer = await askQuestion(
      `Choose 1-${options.length} [${defaultIndex + 1}]: `
    );
    const normalized = answer.trim();

    if (!normalized) {
      return defaultIndex;
    }

    const selected = Number.parseInt(normalized, 10);

    if (
      Number.isInteger(selected) &&
      selected >= 1 &&
      selected <= options.length
    ) {
      return selected - 1;
    }

    console.log("Please enter a valid number.");
  }
}

module.exports = askChoice;
