document.getElementById("log-level").addEventListener("change", (event) => {
  const logLevel = event.target.value;
  console.log("Log level changed to:", logLevel);
  if (logLevel === "normal") {
    Array.from(document.getElementsByClassName("debug")).forEach((element) => {
      element.style.display = "none";
    });
  } else {
    Array.from(document.getElementsByClassName("debug")).forEach((element) => {
      element.style.display = "block";
    });
  }
});
