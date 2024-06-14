import simpleGit from "simple-git";
import readline from "readline";

const git = simpleGit();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function checkForUpdates() {
  try {
    // Fetch the latest commits from the remote repository
    await git.fetch();

    // Get the status of the current branch
    const status = await git.status();

    if (status.behind > 0) {
      console.log(
        `You are behind by ${status.behind} commits. Updates are available.`
      );
      rl.question(
        "Would you like to pull the latest updates? (yes/no): ",
        async (answer) => {
          if (answer.toLowerCase() === "yes") {
            try {
              await git.pull();
              console.log("Successfully pulled the latest updates.");
            } catch (pullError) {
              console.error("Error pulling updates:", pullError);
            }
          } else {
            console.log("Pull aborted by the user.");
          }
          rl.close();
        }
      );
    } else {
      console.log("Your local repository is up to date.");
      rl.close();
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    rl.close();
  }
}

export { checkForUpdates };
