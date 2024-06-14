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

const messagesDiv = document.getElementById("messages");
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
  messagesDiv.appendChild(messageElement);
  messageElement.classList.add(data.status);

  const logLevel = document.getElementById("log-level").value;
  if (logLevel === "normal" && data.status === "debug") {
    messageElement.style.display = "none";
  }
};

document.getElementById("upload-form").addEventListener("submit", (event) => {
  event.preventDefault();

  const jiraHost = document.getElementById("jira-host").value;
  const jiraUsername = document.getElementById("jira-username").value;
  const jiraPassword = document.getElementById("jira-password").value;
  const uninstallPlugins = document.getElementById("uninstall-plugins").checked;
  const files = document.getElementById("obr-files").files;

  console.log("Submitting form with credentials:", {
    jiraHost,
    jiraUsername,
    jiraPassword,
    uninstallPlugins,
  });

  localStorage.setItem("jiraHost", jiraHost);
  localStorage.setItem("jiraUsername", jiraUsername);
  localStorage.setItem("jiraPassword", jiraPassword);

  console.log("Credentials saved to localStorage");

  const formData = new FormData();
  formData.append("jiraHost", jiraHost);
  formData.append("jiraUsername", jiraUsername);
  formData.append("jiraPassword", jiraPassword);
  formData.append("uninstallPluginsFlag", uninstallPlugins);
  formData.append("clientId", clientId);

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
