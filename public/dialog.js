const dialog = document.querySelector("dialog");
const showButton = document.getElementById("modal-show");
const closeButton = document.getElementById("modal-close");

showButton.addEventListener("click", () => {
  dialog.showModal();
});

closeButton.addEventListener("click", () => {
  dialog.close();
});
