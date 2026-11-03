const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

// Avoid black/blank renderer windows on Windows systems with incompatible GPU drivers.
// AXIMACH's command-centre visuals are CSS-based, so software rendering is an acceptable fallback.
app.disableHardwareAcceleration();

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
      WA_WEB_PORT: "8789",
      WA_WEB_HOST: "0.0.0.0",
      AXIMACH_API_KEY: sharedApiKey,
      AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
      WA_WEB_DATA_FILE: path.join(whatsappDir, "whatsapp-web-lan.json"),
      WA_WEB_AUTH_DIR: path.join(whatsappDir, "whatsapp-auth-lan"),
    }, "AXIMACH WhatsApp bridge");
  }
}

function injectLocalServerSettings(window) {
  const settings = {
    "aximach.scheduler.url": "http://127.0.0.1:8787",
    "aximach.scheduler.key": sharedApiKey,
    "aximach.whatsapp.url": "http://127.0.0.1:8789",
  };
  const bootstrap = "(() => { try { const values = " + JSON.stringify(settings)
    + "; for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); } catch (_) {} })();";
  window.webContents.addDocumentStartJavaScript(bootstrap);
}

function showLoadFailure(window, error) {
  const detail = String(error?.message || error || "Unknown startup error").replace(/[<>&]/g, (char) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;",
  })[char]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>AXIMACH startup error</title></head>
    <body style="margin:0;padding:48px 24px;background:#0b1626;color:#e8f2ff;font:14px/1.6 Segoe UI,Arial,sans-serif">
      <h1>AXIMACH could not open its local application files</h1>
      <p>Close the app and reinstall the latest AXIMACH setup package.</p>
      <pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#101f33;border:1px solid #36506b;border-radius:8px;color:#ffd5a6">${detail}</pre>
    </body></html>`;
  window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 980,
    minHeight: 680,
    autoHideMenuBar: false,
    backgroundColor: "#0b1626",
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

  window.webContents.on("render-process-gone", (_event, details) => {
    console.error("AXIMACH renderer process exited:", details);
  });
  window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    console.error("AXIMACH page load failed:", { code, description, url, isMainFrame });
  });

  window.loadFile(path.join(__dirname, "..", "dist", "index.html")).catch((error) => {
    console.error("AXIMACH local frontend load failed:", error);
    showLoadFailure(window, error);
  });
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
