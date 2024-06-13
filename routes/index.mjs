import express from "express";
import path from "path";
import { deleteFiles } from "../helpers/fileHelpers.mjs";
import { uninstallPlugins } from "../helpers/jiraHelpers.mjs";
import {
  visitUrlWithRedirectHandling,
  waitForElementToBeInteractable,
} from "../helpers/seleniumHelpers.mjs";
import { Builder, By, until } from "selenium-webdriver";

const router = express.Router();

router.get("/", (req, res) => {
  res.sendFile(path.join(path.resolve(), "public", "index.html"));
});

router.post("/upload", async (req, res) => {
  const files = req.files;
  const jiraHost = req.body.jiraHost;
  const jiraUsername = req.body.jiraUsername;
  const jiraPassword = req.body.jiraPassword;
  const uninstallPluginsFlag = req.body.uninstallPlugins === "true";

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

  try {
    // Uninstall plugins if flag is set
    if (uninstallPluginsFlag) {
      const uninstallSuccess = await uninstallPlugins(
        jiraHost,
        jiraUsername,
        jiraPassword
      );
      if (!uninstallSuccess) {
        return res
          .status(500)
          .json({ message: "Failed to uninstall one or more plugins" });
      }
    }

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
      await fileInput.sendKeys(path.resolve(path.resolve(), file.path));
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

export default router;
