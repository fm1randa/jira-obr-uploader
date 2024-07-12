const dialog = document.querySelector("dialog");
const showButton = document.getElementById("modal-show");
const closeButton = document.getElementById("modal-close");

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

// "Show the dialog" button opens the dialog modally
showButton.addEventListener("click", () => {
  dialog.showModal();
});

// "Close" button closes the dialog
closeButton.addEventListener("click", () => {
  dialog.close();
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("log-level").addEventListener("change", (event) => {
    const logLevel = event.target.value;
    console.log("Log level changed to:", logLevel);
    if (logLevel === "normal") {
      Array.from(document.getElementsByClassName("debug")).forEach(
        (element) => {
          element.style.display = "none";
        }
      );
    } else {
      Array.from(document.getElementsByClassName("debug")).forEach(
        (element) => {
          element.style.display = "block";
        }
      );
    }
  });

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
});

const messagesSection = document.getElementById("messages");
const uploadButton = document.querySelector('button[type="submit"]');

const ws = new WebSocket(`ws://${new URL(window.location.href).host}`);

let clientId;

ws.onopen = () => {
  uploadButton.disabled = false;

  // Send a message to obtain the client ID
  ws.send(JSON.stringify({ action: "getClientId" }));
};

ws.onerror = () => {
  uploadButton.disabled = true;
};

ws.onclose = () => {
  uploadButton.disabled = true;
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.clientId) {
    clientId = data.clientId;
  }

  const messageElement = document.createElement("div");
  messageElement.textContent = data.message;
  messagesSection.appendChild(messageElement);
  messageElement.classList.add(data.status);

  const logLevel = document.getElementById("log-level").value;
  if (logLevel === "normal" && data.status === "debug") {
    messageElement.style.display = "none";
  }
};

document.getElementById("upload-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter.id !== "form-upload") return;

  const jiraHost = document.getElementById("jira-host").value;
  const jiraUsername = document.getElementById("jira-username").value;
  const jiraPassword = document.getElementById("jira-password").value;
  const files = document.getElementById("obr-files").files;
  const enabledDefaultPlugins = PLUGIN_KEYS.filter(
    (pluginKey) => localStorage.getItem(pluginKey) === "true"
  );
  const customPlugins = localStorage.getItem("customPlugins") || "[]";

  console.log("Submitting form with credentials:", {
    jiraHost,
    jiraUsername,
    jiraPassword,
  });

  localStorage.setItem("jiraHost", jiraHost);
  localStorage.setItem("jiraUsername", jiraUsername);
  localStorage.setItem("jiraPassword", jiraPassword);

  console.log("Credentials saved to localStorage");

  const formData = new FormData();
  formData.append("jiraHost", jiraHost);
  formData.append("jiraUsername", jiraUsername);
  formData.append("jiraPassword", jiraPassword);
  formData.append("clientId", clientId);
  formData.append(
    "uninstallablePlugins",
    JSON.stringify(enabledDefaultPlugins.concat(JSON.parse(customPlugins)))
  );

  for (const file of files) {
    formData.append("obrFiles", file);
    console.log("Appending file to formData:", file.name);
  }

  fetch("/upload", {
    method: "POST",
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => console.log("Upload response:", data))
    .catch((error) => console.error("Upload error:", error));
});

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
      (savedPlugin.includes(pluginName) || PLUGIN_KEYS.includes(pluginName)) &&
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

document
  .getElementById("modal-add")
  .addEventListener("click", () => addCustomPlugin());

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

document
  .getElementById("modal-toggle-all-default")
  .addEventListener("click", () => toggleAllDefaultPlugins());

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
  PLUGIN_KEYS.forEach((plugin) => {
    if (localStorage.getItem(plugin) === null) {
      localStorage.setItem(plugin, "true");
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initializeDefaultPluginStates();
  loadPluginStates();
});

function clearMessages() {
  messagesSection.querySelectorAll("div").forEach((message) => {
    message.remove();
  });
}

document
  .getElementById("messages-clear")
  .addEventListener("click", clearMessages);
