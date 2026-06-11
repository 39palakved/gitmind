const readline = require("readline");
const { Writable } = require("stream");

function askSecret(question) {
  return new Promise((resolve) => {
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!this.muted) {
          process.stdout.write(chunk, encoding);
        }

        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    process.stdout.write(question);
    mutableStdout.muted = true;

    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

module.exports = askSecret;
