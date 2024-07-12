function savePluginState(event) {
  const checkbox = event.target;
  localStorage.setItem(checkbox.id, checkbox.checked);
}

function toggleAllDefaultPlugins() {
  // if all are checked, uncheck all. if any are unchecked, check all. if none are checked, check all.
  const defaultPlugins = document.querySelectorAll(
    '#default-plugin-list input[type="checkbox"]'
  );
  const allChecked = Array.from(defaultPlugins).every(
    (checkbox) => checkbox.checked
  );
  defaultPlugins.forEach((checkbox) => (checkbox.checked = !allChecked));
  defaultPlugins.forEach((checkbox) => savePluginState({ target: checkbox }));

  console.log("Toggled all default plugins");
}

function removeCustomPlugin(pluginName) {
  let customPlugins = JSON.parse(localStorage.getItem("customPlugins")) || [];
  customPlugins = customPlugins.filter((plugin) => plugin !== pluginName);
  localStorage.setItem("customPlugins", JSON.stringify(customPlugins));
}

function saveCustomPlugin(pluginName) {
  const customPlugins = JSON.parse(localStorage.getItem("customPlugins")) || [];
  if (!customPlugins.includes(pluginName)) {
    customPlugins.push(pluginName);
    localStorage.setItem("customPlugins", JSON.stringify(customPlugins));
  }
}

function addCustomPlugin(pluginName = null, save = true) {
  const customPluginInput = document.getElementById("custom-plugin-input");
  if (!pluginName) {
    pluginName = customPluginInput.value.trim();
  }

  if (pluginName) {
    const savedPlugin = JSON.parse(localStorage.getItem("customPlugins")) || [];
    if (
      (savedPlugin.includes(pluginName) ||
        BROWSER_PLUGIN_KEYS.includes(pluginName)) &&
      save
    ) {
      alert("Plugin already in the list", pluginName);
      customPluginInput.value = "";
      return;
    }

    const pluginList = document.getElementById("custom-plugin-list");

    const listItem = document.createElement("li");
    listItem.className = "plugin-item";

    const label = document.createElement("label");
    label.textContent = pluginName;

    const removeButton = document.createElement("button");
    removeButton.textContent = "Remove";
    removeButton.onclick = function () {
      pluginList.removeChild(listItem);
      removeCustomPlugin(pluginName);
    };

    listItem.appendChild(label);
    listItem.appendChild(removeButton);
    pluginList.appendChild(listItem);

    if (save) {
      saveCustomPlugin(pluginName);
    }

    customPluginInput.value = "";
  }
}

function loadPluginStates() {
  const defaultPlugins = document.querySelectorAll(
    '#default-plugin-list input[type="checkbox"]'
  );
  defaultPlugins.forEach((checkbox) => {
    const state = localStorage.getItem(checkbox.id);
    checkbox.checked = state === "true";
    checkbox.addEventListener("change", savePluginState);
  });

  const customPlugins = JSON.parse(localStorage.getItem("customPlugins")) || [];
  customPlugins.forEach((plugin) => addCustomPlugin(plugin, false));
}

function initializeDefaultPluginStates() {
  BROWSER_PLUGIN_KEYS.forEach((plugin) => {
    if (localStorage.getItem(plugin) === null) {
      localStorage.setItem(plugin, "true");
    }
  });
}

function loadCredentials() {
  const jiraHost = localStorage.getItem("jiraHost");
  const jiraUsername = localStorage.getItem("jiraUsername");
  const jiraPassword = localStorage.getItem("jiraPassword");

  if (jiraHost) document.getElementById("jira-host").value = jiraHost;
  if (jiraUsername)
    document.getElementById("jira-username").value = jiraUsername;
  if (jiraPassword)
    document.getElementById("jira-password").value = jiraPassword;

  console.log("Loaded credentials from localStorage:", {
    jiraHost,
    jiraUsername,
    jiraPassword,
  });
}

document
  .getElementById("modal-toggle-all-default")
  .addEventListener("click", () => toggleAllDefaultPlugins());

document
  .getElementById("modal-add")
  .addEventListener("click", () => addCustomPlugin());

document.addEventListener("DOMContentLoaded", function () {
  loadCredentials();
  initializeDefaultPluginStates();
  loadPluginStates();
});
