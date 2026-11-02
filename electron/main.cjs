const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const CLIENT_ORIGINS = "null,capacitor://localhost,https://localhost,http://localhost,http://localhost:5173";
let sharedApiKey = "";
let manufacturingServer;
let whatsappBridge;

function getSharedApiKey(dataDir) {
  const keyPath = path.join(dataDir, "shared-api-key.txt");
  try {
    const existing = fs.readFileSync(keyPath, "utf8").trim();
    if (existing.length >= 40) return existing;
  } catch { /* first launch */ }
  const key = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyPath, key, { encoding: "utf8", mode: 0o600 });
  return key;
}

function spawnLocalService(entry, env, label) {
  const child = spawn(process.execPath, [entry], {
    cwd: app.getPath("userData"),
    windowsHide: true,
    detached: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ...env },
    stdio: "ignore",
  });
  child.on("error", (error) => console.error(label + " failed to start:", error.message));
  child.on("exit", (code) => {
    if (code && code !== 0) console.error(label + " exited with code", code);
    if (label === "AXIMACH shared-data server") manufacturingServer = undefined;
    if (label === "AXIMACH WhatsApp bridge") whatsappBridge = undefined;
  });
  return child;
}

function startLocalServices() {
  if (manufacturingServer && whatsappBridge) return;
  const appRoot = app.getAppPath();
  const serverDir = path.join(app.getPath("userData"), "aximach");
  const whatsappDir = path.join(app.getPath("userData"), "whatsapp");
  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(whatsappDir, { recursive: true });
  sharedApiKey = getSharedApiKey(serverDir);

  if (!manufacturingServer) {
    manufacturingServer = spawnLocalService(path.join(appRoot, "server", "index.mjs"), {
      PORT: "8787",
      AXIMACH_API_KEY: sharedApiKey,
      AXIMACH_DATA_FILE: path.join(serverDir, "aximach.json"),
      AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
    }, "AXIMACH shared-data server");
  }

  if (!whatsappBridge) {
    whatsappBridge = spawnLocalService(path.join(appRoot, "server", "whatsapp-web.mjs"), {
      WA_WEB_PORT: "8788",
      WA_WEB_HOST: "0.0.0.0",
      AXIMACH_API_KEY: sharedApiKey,
      AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
      WA_WEB_DATA_FILE: path.join(whatsappDir, "whatsapp-web.json"),
      WA_WEB_AUTH_DIR: path.join(whatsappDir, "whatsapp-auth"),
    }, "AXIMACH WhatsApp bridge");
  }
}

function injectLocalServerSettings(window) {
  const settings = {
    "aximach.scheduler.url": "http://127.0.0.1:8787",
    "aximach.scheduler.key": sharedApiKey,
    "aximach.whatsapp.url": "http://127.0.0.1:8788",
  };
  const bootstrap = "(() => { try { const values = " + JSON.stringify(settings)
    + "; for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); } catch (_) {} })();";
  window.webContents.addDocumentStartJavaScript(bootstrap);
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

  injectLocalServerSettings(window);

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

function stopLocalServices() {
  for (const child of [manufacturingServer, whatsappBridge]) {
    if (child && !child.killed) {
      try { child.kill(); } catch { /* already stopped */ }
    }
  }
  manufacturingServer = undefined;
  whatsappBridge = undefined;
}

app.whenReady().then(() => {
  startLocalServices();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("before-quit", stopLocalServices);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
