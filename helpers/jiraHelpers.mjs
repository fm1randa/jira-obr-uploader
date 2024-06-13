import fetch from "node-fetch";

const PLUGIN_KEYS = [
  "com.greffon.folio",
  "com.tempoplugin.tempo-planner",
  "is.origo.jira.tempo-plugin",
  "com.tempoplugin.tempo-teams",
  "com.tempoplugin.tempo-platform-api",
  "com.tempoplugin.tempo-platform-jira",
  "com.tempoplugin.tempo-plan-core",
  "com.tempoplugin.tempo-core",
  "com.tempoplugin.tempo-accounts",
];

// Helper function to uninstall plugins
async function uninstallPlugins(jiraHost, jiraUsername, jiraPassword) {
  const url = `${jiraHost}/rest/plugins/1.0/`;
  const headers = {
    Authorization:
      "Basic " +
      Buffer.from(`${jiraUsername}:${jiraPassword}`).toString("base64"),
    "Content-Type": "application/json",
  };

  let allSuccess = true;

  for (const pluginKey of PLUGIN_KEYS) {
    try {
      console.log(`Uninstalling plugin: ${pluginKey}`);
      const response = await fetch(`${url}${pluginKey}-key`, {
        method: "DELETE",
        headers: headers,
      });
      if (response.ok) {
        console.log(`Successfully uninstalled plugin: ${pluginKey}`);
      } else if (response.status >= 500) {
        console.error(
          `Failed to uninstall plugin: ${pluginKey}. Status: ${response.status}`
        );
        allSuccess = false;
      } else {
        console.log(
          `Non-fatal error uninstalling plugin: ${pluginKey}. Status: ${response.status}`
        );
      }
    } catch (error) {
      console.error(`Error uninstalling plugin: ${pluginKey}`, error);
      allSuccess = false;
    }
  }

  return allSuccess;
}

export { uninstallPlugins };
