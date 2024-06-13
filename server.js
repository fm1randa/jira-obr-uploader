const express = require("express");
const multer = require("multer");
const { Builder, By, Key, until } = require("selenium-webdriver");
const path = require("path");
const fs = require("fs");

const app = express();
let port = 3000;

// Set up Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Serve the HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Helper function to handle WebSudo authentication
async function handleWebSudo(driver, jiraPassword) {
  console.log("Redirected to WebSudo page");
  await driver
    .findElement(By.id("login-form-authenticatePassword"))
    .sendKeys(jiraPassword);
  await driver.findElement(By.id("login-form-submit")).click();
  console.log("Submitted WebSudo form");
}

// Helper function to wait for navigation to the intended URL with retries
async function waitForNavigationToUrl(
  driver,
  url,
  waitTime = 3000,
  maxRetries = 10
) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      await driver.wait(until.urlIs(url), waitTime);
      return;
    } catch (error) {
      retries++;
      console.log(
        `Retrying to visit the intended URL (${retries}/${maxRetries})`
      );
      await driver.get(url);
    }
  }
  throw new Error(`Failed to visit URL: ${url} after ${maxRetries} retries`);
}

// Helper function to visit a URL and handle redirects
async function visitUrlWithRedirectHandling(
  driver,
  url,
  jiraUsername,
  jiraPassword
) {
  await driver.get(url);
  console.log(`Visiting URL: ${url}`);

  let currentUrl = await driver.getCurrentUrl();

  if (currentUrl.includes("/login.jsp")) {
    console.log("Redirected to login page");
    // Perform login
    await driver
      .findElement(By.id("login-form-username"))
      .sendKeys(jiraUsername);
    await driver
      .findElement(By.id("login-form-password"))
      .sendKeys(jiraPassword);
    await driver.findElement(By.id("login-form-submit")).click();
    console.log("Submitted login form");

    // Check if redirected to WebSudo page after login
    currentUrl = await driver.getCurrentUrl();
    if (currentUrl.includes("/secure/admin/WebSudoAuthenticate!default.jspa")) {
      await handleWebSudo(driver, jiraPassword);
      await waitForNavigationToUrl(driver, url);
    }
  } else if (
    currentUrl.includes("/secure/admin/WebSudoAuthenticate!default.jspa")
  ) {
    await handleWebSudo(driver, jiraPassword);
    await waitForNavigationToUrl(driver, url);
  } else {
    await waitForNavigationToUrl(driver, url);
  }

  currentUrl = await driver.getCurrentUrl();
  if (currentUrl === url) {
    console.log(`Successfully visited URL: ${url}`);
  } else {
    throw new Error(`Failed to visit URL: ${url}`);
  }
}

// Helper function to delete files
function deleteFiles(files) {
  for (const file of files) {
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error(`Error deleting file ${file.path}:`, err);
      } else {
        console.log(`Successfully deleted file ${file.path}`);
      }
    });
  }
}

// Helper function to wait for an element to be interactable
async function waitForElementToBeInteractable(
  driver,
  element,
  waitTime = 30000
) {
  try {
    await driver.wait(async function () {
      const isEnabled = await element.isEnabled();
      const isDisplayed = await element.isDisplayed();
      return isEnabled && isDisplayed;
    }, waitTime);
  } catch (error) {
    console.error("Element is not interactable:", error);
    throw new Error("Element is not interactable");
  }
}

// Handle file uploads
app.post("/upload", upload.array("obrFiles"), async (req, res) => {
  const files = req.files;
  const jiraHost = req.body.jiraHost;
  const jiraUsername = req.body.jiraUsername;
  const jiraPassword = req.body.jiraPassword;

  console.log("Received upload request:", {
    jiraHost,
    jiraUsername,
    jiraPassword,
    files,
  });

  if (!files || files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  if (!jiraHost || !jiraUsername || !jiraPassword) {
    return res
      .status(400)
      .json({ message: "Jira host, username, and password are required" });
  }

  let driver;

  try {
    // Initialize Selenium WebDriver
    driver = await new Builder().forBrowser("chrome").build();
    console.log("Initialized Selenium WebDriver");

    // Visit the Jira UPM page and handle redirects
    await visitUrlWithRedirectHandling(
      driver,
      `${jiraHost}/plugins/servlet/upm?source=side_nav_manage_addons`,
      jiraUsername,
      jiraPassword
    );

    for (const file of files) {
      // Wait for the upload button to be present and interactable
      let uploadButton = await driver.wait(
        until.elementLocated(By.css("#upm-upload")),
        60000
      );
      console.log("Found upload button");
      await waitForElementToBeInteractable(driver, uploadButton);
      await uploadButton.click();

      // Open the upload dialog
      let uploadDialog = await driver.wait(
        until.elementLocated(By.css("#upm-upload-dialog")),
        60000
      );
      console.log("Opened upload dialog");

      // Upload the file
      let fileInput = await uploadDialog.findElement(
        By.css("#upm-upload-file")
      );
      await fileInput.sendKeys(path.resolve(__dirname, file.path));
      console.log("Uploaded file:", file.filename);

      // Click the confirm button
      let confirmButton = await uploadDialog.findElement(
        By.css(
          "#upm-upload-dialog > footer > div > button.aui-button.aui-button-primary.confirm"
        )
      );
      await confirmButton.click();
      console.log("Clicked confirm button");

      // Wait for the upload to complete by checking for the text "Installed and ready to go!"
      await driver.wait(
        until.elementLocated(
          By.xpath("//*[contains(text(), 'Installed and ready to go!')]")
        ),
        300000
      );
      console.log("File installed and ready to go:", file.filename);

      // Click the "Close" button to close the "Installation successful" modal
      let statusDialogButton = await driver.wait(
        until.elementLocated(
          By.css("#upm-plugin-status-dialog > footer > div > button")
        ),
        60000
      );
      await statusDialogButton.click();
      console.log("Clicked status dialog button");
    }

    res.json({ message: "Files uploaded successfully" });
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ message: "An error occurred during upload" });
  } finally {
    if (driver) {
      await driver.quit();
      console.log("Selenium WebDriver quit");
    }
    deleteFiles(files);
  }
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Function to start the server with port retry logic
function startServer(port) {
  const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(
        `Port ${port} is already in use, trying port ${port + 1}...`
      );
      startServer(port + 1);
    } else {
      console.error(`Server error: ${err}`);
    }
  });
}

// Start the server
startServer(port);
