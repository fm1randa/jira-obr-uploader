function clearMessages() {
  const messagesSection = document.getElementById("messages");
  messagesSection.querySelectorAll("div").forEach((message) => {
    message.remove();
  });
}

document
  .getElementById("messages-clear")
  .addEventListener("click", clearMessages);
