const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");

const LOCAL_BRIDGE_KEY = "aximach-desktop-local-bridge-v1";
let whatsappBridge;

function startWhatsAppBridge() {
  if (whatsappBridge) return;
  const appRoot = app.getAppPath();
  const entry = path.join(appRoot, "server", "whatsapp-web.mjs");
  const dataDir = path.join(app.getPath("userData"), "whatsapp");
  whatsappBridge = spawn(process.execPath, [entry], {
    cwd: app.getPath("userData"),
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      WA_WEB_PORT: "8788",
      AXIMACH_API_KEY: process.env.AXIMACH_API_KEY || LOCAL_BRIDGE_KEY,
      AXIMACH_ALLOWED_ORIGIN: "null",
      WA_WEB_DATA_FILE: path.join(dataDir, "whatsapp-web.json"),
      WA_WEB_AUTH_DIR: path.join(dataDir, "whatsapp-auth"),
    },
    stdio: "ignore",
  });
  whatsappBridge.on("error", (error) => console.error("WhatsApp bridge failed to start:", error.message));
  whatsappBridge.on("exit", (code) => { whatsappBridge = undefined; if (code) console.error("WhatsApp bridge exited with code", code); });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 980,
    minHeight: 680,
    autoHideMenuBar: false,
    backgroundColor: "#07111d",
    title: "AXIMACH — Manufacturing OS",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

app.whenReady().then(() => {
  startWhatsAppBridge();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", () => {
  if (whatsappBridge && !whatsappBridge.killed) whatsappBridge.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
