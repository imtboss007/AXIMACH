const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

app.disableHardwareAcceleration();

const CLIENT_ORIGINS = "null,capacitor://localhost,https://localhost,http://localhost,http://localhost:5173";
let sharedApiKey = "";
let manufacturingServer;
let whatsappBridge;

function diagnosticLog(message, details) {
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "startup.log"),
      "[" + new Date().toISOString() + "] " + message + " " + (details || "") + "\n", "utf8");
  } catch (error) {
    console.error("AXIMACH could not write startup log:", error);
  }
}

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
  child.on("error", (error) => {
    diagnosticLog(label + " failed to start:", error.message);
    console.error(label + " failed to start:", error.message);
  });
  child.on("exit", (code) => {
    if (code && code !== 0) diagnosticLog(label + " exited:", String(code));
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
      PORT: "8787", AXIMACH_API_KEY: sharedApiKey,
      AXIMACH_DATA_FILE: path.join(serverDir, "aximach.json"),
      AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
    }, "AXIMACH shared-data server");
  }
  if (!whatsappBridge) {
    whatsappBridge = spawnLocalService(path.join(appRoot, "server", "whatsapp-web.mjs"), {
      WA_WEB_PORT: "8789", WA_WEB_HOST: "0.0.0.0",
      AXIMACH_API_KEY: sharedApiKey, AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
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

function showDiagnosticPage(window, heading, detail) {
  const safeHeading = String(heading).replace(/[<>&]/g, "");
  const safeDetail = String(detail || "No further detail was reported.").replace(/[<>&]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>AXIMACH startup diagnostics</title></head>
  <body style="margin:0;padding:40px;background:#0b1626;color:#e8f2ff;font:14px/1.6 Segoe UI,Arial,sans-serif">
    <h1 style="font-size:26px">${safeHeading}</h1>
    <p>The AXIMACH window opened, but its workspace did not render.</p>
    <pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#101f33;border:1px solid #36506b;border-radius:8px;color:#ffd5a6">${safeDetail}</pre>
    <p style="color:#9ab2ce">A startup log was saved in the AXIMACH user-data folder under logs\\startup.log. Send a photo of this diagnostic screen to support.</p>
  </body></html>`;
  window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 980, minHeight: 680,
    autoHideMenuBar: false, backgroundColor: "#f4f7fc",
    title: "AXIMACH — Manufacturing OS",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  injectLocalServerSettings(window);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("console-message", (_event, details) => {
    const line = details.level + ": " + details.message + " (" + details.sourceId + ":" + details.lineNumber + ")";
    diagnosticLog("renderer console:", line);
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    diagnosticLog("renderer process exited:", JSON.stringify(details));
    showDiagnosticPage(window, "AXIMACH renderer stopped", JSON.stringify(details, null, 2));
  });
  window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    diagnosticLog("page load failed:", JSON.stringify({ code, description, url, isMainFrame }));
    if (isMainFrame) showDiagnosticPage(window, "AXIMACH could not load its application files",
      JSON.stringify({ code, description, url, isMainFrame }, null, 2));
  });

  const frontend = path.join(app.getAppPath(), "dist", "index.html");
  diagnosticLog("loading frontend:", frontend + " exists=" + fs.existsSync(frontend));
  window.loadFile(frontend).catch((error) => {
    diagnosticLog("frontend load rejected:", error.stack || error.message);
    showDiagnosticPage(window, "AXIMACH could not open its application files", error.stack || error.message);
  });

  window.webContents.on("did-finish-load", () => {
    diagnosticLog("frontend document loaded:", window.webContents.getURL());
    setTimeout(async () => {
      if (window.isDestroyed()) return;
      try {
        const state = await window.webContents.executeJavaScript(`(() => {
          const root = document.getElementById("root");
          return {
            readyState: document.readyState,
            url: location.href,
            rootExists: !!root,
            rootChildren: root ? root.children.length : 0,
            appShell: !!document.querySelector(".app-shell"),
            rootText: root ? (root.innerText || "").slice(0, 500) : "",
            scripts: Array.from(document.scripts).map(s => s.src || "inline")
          };
        })()`);
        diagnosticLog("renderer health check:", JSON.stringify(state));
        if (!state.appShell) {
          showDiagnosticPage(window, "AXIMACH workspace did not start", JSON.stringify(state, null, 2)
            + "\\n\\nCheck startup.log for the JavaScript error that prevented the React workspace from mounting.");
        }
      } catch (error) {
        diagnosticLog("renderer health check failed:", error.stack || error.message);
        showDiagnosticPage(window, "AXIMACH renderer health check failed", error.stack || error.message);
      }
    }, 12000);
  });
}

function stopLocalServices() {
  for (const child of [manufacturingServer, whatsappBridge]) {
    if (child && !child.killed) { try { child.kill(); } catch { /* already stopped */ } }
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
