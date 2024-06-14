import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { deleteFiles } from "./helpers/fileHelpers.mjs";
import { uninstallPlugins } from "./helpers/jiraHelpers.mjs";
import {
  visitUrlWithRedirectHandling,
  waitForElementToBeInteractable,
} from "./helpers/seleniumHelpers.mjs";
import { Builder, By, until } from "selenium-webdriver";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 80;

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
    uninstallPluginsFlag,
    clientId,
  } = req.body;

  const start = Date.now();
  console.log("Received upload request:", {
    jiraHost,
    jiraUsername,
    jiraPassword,
    uninstallPluginsFlag,
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

  const hostURL = new URL(jiraHost);

  try {
    // Uninstall plugins if flag is set
    if (uninstallPluginsFlag) {
      sendWsMessage(clientId, "Uninstalling plugins...", "info");
      const uninstallSuccess = await uninstallPlugins(
        hostURL.origin,
        jiraUsername,
        jiraPassword
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
    driver = await new Builder().forBrowser("chrome").build();

    // Visit the Jira UPM page and handle redirects
    await visitUrlWithRedirectHandling(
      driver,
      `${hostURL.origin}/plugins/servlet/upm?source=side_nav_manage_addons`,
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
