const askQuestion = require("./askQuestion");

async function askYesNo(question) {
  while (true) {
    const answer = await askQuestion(question);
    const normalized = answer.trim().toLowerCase();

    if (normalized === "y" || normalized === "yes") {
      return true;
    }

    if (normalized === "n" || normalized === "no") {
      return false;
    }

    console.log("Please enter Y or N.");
  }
}

module.exports = askYesNo;
