import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { deleteFiles } from "./helpers/fileHelpers.mjs";
import { uninstallPlugins } from "./helpers/jiraHelpers.mjs";
import {
  safeWaitForElementToBeInteractable,
  visitUrlWithRedirectHandling,
  waitForElementToBeInteractable,
} from "./helpers/seleniumHelpers.mjs";
import { Builder, By, until } from "selenium-webdriver";
import Chrome from "selenium-webdriver/chrome.js";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.argv[2] || 80;

const dest = path.join(process.cwd(), "/uploads");
let driverOptions;

try {
  driverOptions = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "options.json"), "utf8")
  );
  console.log("Loaded options file:", driverOptions);
} catch {
  console.warn("Could not find options file, using default options");
  driverOptions = {};
}

console.log(`Set file upload destination to ${dest}`);

// Set up Multer storage
const upload = multer({
  dest,
  preservePath: true,
});

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the public directory
console.log(path.join(process.cwd(), "public"));
app.use(express.static(path.join(process.cwd(), "public")));

// Handle file uploads
app.post("/upload", upload.array("obrFiles"), async (req, res) => {
  const files = req.files;
  const {
    jiraHost,
    jiraUsername,
    jiraPassword,
    clientId,
    uninstallablePlugins: rawUninstallablePlugins,
  } = req.body;

  const start = Date.now();
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

  const parsedHostURL =
    jiraHost.lastIndexOf("/") === jiraHost.length - 1
      ? jiraHost.slice(0, -1)
      : jiraHost;

  try {
    const uninstallablePlugins = JSON.parse(rawUninstallablePlugins);
    if (uninstallablePlugins.length > 0) {
      sendWsMessage(clientId, "Uninstalling plugins...", "info");
      const uninstallSuccess = await uninstallPlugins(
        parsedHostURL,
        jiraUsername,
        jiraPassword,
        (message, info) => sendWsMessage(clientId, message, info),
        uninstallablePlugins
      );
      if (!uninstallSuccess) {
        sendWsMessage(
          clientId,
          "Failed to uninstall one or more plugins",
          "error"
        );
        return res
          .status(500)
          .json({ message: "Failed to uninstall one or more plugins" });
      }
      sendWsMessage(clientId, "Plugins uninstalled successfully", "success");
    }

    sendWsMessage(clientId, "Opening Jira UPM...", "info");
    // Initialize Selenium WebDriver
    const options = new Chrome.Options();
    if (driverOptions.headless) {
      console.log("Running in headless mode");
      sendWsMessage(clientId, "Running in headless mode", "debug");
      options.addArguments("--headless");
    }
    if (driverOptions.disableGpu) {
      console.log("Disabling GPU");
      sendWsMessage(clientId, "Disabling GPU", "debug");
      options.addArguments("--disable-gpu");
    }
    if (driverOptions.noSandbox) {
      console.log("Disabling sandbox");
      sendWsMessage(clientId, "Disabling sandbox", "debug");
      options.addArguments("--no-sandbox");
    }
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    // Visit the Jira UPM page and handle redirects
    await visitUrlWithRedirectHandling(
      driver,
      `${parsedHostURL}/plugins/servlet/upm?source=side_nav_manage_addons`,
      jiraUsername,
      jiraPassword
    );
    sendWsMessage(clientId, "Opened Jira UPM", "success");
    sendWsMessage(clientId, "Uploading files...", "info");
    for (const file of files) {
      // Wait for the upload button to be present and interactable
      const uploadButton = await driver.wait(
        until.elementLocated(By.css("#upm-upload")),
        60000
      );
      sendWsMessage(
        clientId,
        `Found upload button for file: ${file.originalname}`,
        "debug"
      );
      await waitForElementToBeInteractable(driver, uploadButton);

      // Close all aui-close-button elements to prevent blocking the upload button
      sendWsMessage(clientId, "Closing all open dialogs...", "debug");
      const closeButtons = await driver.findElements(
        By.css(".aui-close-button")
      );
      for (const closeButton of closeButtons) {
        if (
          await safeWaitForElementToBeInteractable(driver, closeButton, 1000)
        ) {
          await closeButton.click();
        }
      }

      await uploadButton.click();

      // Open the upload dialog
      const uploadDialog = await driver.wait(
        until.elementLocated(By.css("#upm-upload-dialog")),
        60000
      );
      sendWsMessage(
        clientId,
        `Opened upload dialog for file: ${file.originalname}`,
        "debug"
      );

      // Upload the file
      const fileInput = await uploadDialog.findElement(
        By.css("#upm-upload-file")
      );
      await fileInput.sendKeys(path.resolve(__dirname, file.path));
      sendWsMessage(clientId, `Uploaded file: ${file.originalname}`, "debug");

      // Click the confirm button
      const confirmButton = await uploadDialog.findElement(
        By.css(
          "#upm-upload-dialog > footer > div > button.aui-button.aui-button-primary.confirm"
        )
      );
      await confirmButton.click();
      sendWsMessage(clientId, `Installing '${file.originalname}'...`, "info");

      // Wait for the upload to complete by checking for the text "Installed and ready to go!"
      await driver.wait(
        until.elementLocated(
          By.xpath("//*[contains(text(), 'Installed and ready to go!')]")
        ),
        300000
      );
      sendWsMessage(
        clientId,
        `OBR '${file.originalname}' installed successfully!`,
        "success"
      );

      // Click the "Close" button to close the "Installation successful" modal
      const statusDialogButton = await driver.wait(
        until.elementLocated(
          By.css(
            "#upm-plugin-status-dialog > footer > div > button.aui-button.aui-button-link.cancel"
          )
        ),
        60000
      );
      await statusDialogButton.click();
      sendWsMessage(
        clientId,
        `Clicked status dialog button for file: ${file.originalname}`,
        "debug"
      );
    }
    const end = Date.now();
    const elapsedMinutes = ((end - start) / 60000).toFixed(1);
    sendWsMessage(
      clientId,
      `All files uploaded successfully! Elapsed time: ${elapsedMinutes} minutes.`,
      "success"
    );
    res.json({ message: "Files uploaded successfully" });
  } catch (error) {
    console.error("Error during file upload:", error);
    sendWsMessage(
      clientId,
      `Error during file upload: ${error.message}`,
      "error"
    );
    res.status(500).json({ message: "An error occurred during upload" });
  } finally {
    if (driver) {
      await driver.quit();
      sendWsMessage(clientId, "Selenium WebDriver quit", "debug");
    }
    deleteFiles(files);
    sendWsMessage(clientId, "Deleted uploaded files", "debug");
  }
});

// Create HTTP server
const httpServer = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  // Generate a unique ID for the client
  ws.clientId = req.headers["sec-websocket-key"];
  ws.send(
    JSON.stringify({
      clientId: ws.clientId,
      message: "Connected to WebSocket server",
      status: "debug",
    })
  );

  ws.on("message", (message) => {
    console.log(`Received message: ${message}`);
    // Handle other incoming messages if necessary
  });
});

// Function to send WebSocket messages
const sendWsMessage = (clientId, message, status) => {
  const wsMessage = JSON.stringify({ clientId, message, status });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.clientId === clientId) {
      client.send(wsMessage);
    }
  });
};

// Start the server
httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
