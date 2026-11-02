const { ipcRenderer } = require("electron");

try {
  const values = ipcRenderer.sendSync("aximach:get-bootstrap-settings");
  if (values && typeof values === "object") {
    for (const [key, value] of Object.entries(values)) {
      if (typeof key === "string" && typeof value === "string") {
        window.localStorage.setItem(key, value);
      }
    }
  }
} catch (error) {
  console.error("AXIMACH preload bootstrap could not read local service settings:", error);
}
