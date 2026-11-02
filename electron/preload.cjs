const { ipcRenderer } = require("electron");

// Keep the renderer sandboxed. Only the three bootstrap values explicitly
// returned by the main process are copied into localStorage; saved user values
// are never overwritten.
try {
  const bootstrap = ipcRenderer.sendSync("aximach:get-bootstrap-settings");
  if (bootstrap && typeof bootstrap === "object") {
    for (const key of ["aximach.scheduler.url", "aximach.scheduler.key", "aximach.whatsapp.url"]) {
      const value = bootstrap[key];
      if (typeof value === "string" && value && window.localStorage.getItem(key) === null) {
        window.localStorage.setItem(key, value);
      }
    }
  }
} catch (error) {
  console.error("AXIMACH desktop bootstrap settings unavailable:", error);
}
