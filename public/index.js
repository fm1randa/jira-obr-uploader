const BROWSER_PLUGIN_KEYS = [
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
  const enabledDefaultPlugins = BROWSER_PLUGIN_KEYS.filter(
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
