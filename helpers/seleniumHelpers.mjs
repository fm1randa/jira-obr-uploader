import { By, until } from "selenium-webdriver";

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

export {
  handleWebSudo,
  waitForNavigationToUrl,
  visitUrlWithRedirectHandling,
  waitForElementToBeInteractable,
};
