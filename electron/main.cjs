const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const smokeDataArgument = process.argv.find(argument => argument.startsWith("--aximach-smoke-data-dir="));
const smokeUserData = process.env.AXIMACH_SMOKE_USER_DATA || smokeDataArgument?.slice("--aximach-smoke-data-dir=".length) || "";
const isSmokeTest = process.env.AXIMACH_SMOKE_TEST === "1" || process.argv.includes("--aximach-smoke-test");
if (isSmokeTest) {
  if (smokeUserData) app.setPath("userData", smokeUserData);
  app.commandLine.appendSwitch("disable-gpu");
}

const CLIENT_ORIGINS = "null,capacitor://localhost,https://localhost,http://localhost,http://localhost:5173";
let sharedApiKey = "";
let manufacturingServer;
let whatsappBridge;
let mainWindow;
let startupLogPath;

function logStartup(message, details) {
  const detail = details ? String(details.stack || details.message || JSON.stringify(details)) : "";
  const line = `[${new Date().toISOString()}] ${message}${detail ? " " + detail : ""}\n`;
  try { fs.appendFileSync(startupLogPath, line, "utf8"); } catch { /* diagnostics may not be initialised yet */ }
  console.error(line.trim());
}
function initialiseDiagnostics() {
  const directory = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(directory, { recursive: true });
  startupLogPath = path.join(directory, "startup.log");
  logStartup("AXIMACH startup", { platform: process.platform, electron: process.versions.electron, chromium: process.versions.chrome });
}
function showRecoveryScreen(window, reason) {
  if (window.isDestroyed()) return;
  const safe = String(reason || "Renderer could not be loaded.").replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[c]);
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AXIMACH Recovery</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 0,#17385d,#07111d 65%);color:#eaf3ff;font:15px Segoe UI,Arial,sans-serif}.panel{width:min(650px,calc(100% - 36px));padding:36px;border:1px solid #365a7c;border-radius:22px;background:rgba(10,27,46,.94);box-shadow:0 30px 100px #0008}small{letter-spacing:3px;color:#75c9ef}h1{font-size:30px;margin:14px 0}p{color:#b8c9db;line-height:1.65}.error{padding:12px;border-radius:9px;background:#061522;color:#ffcfb8;overflow-wrap:anywhere;font:12px Consolas,monospace}button{margin:18px 10px 0 0;padding:12px 18px;border:0;border-radius:9px;background:#64b9f1;color:#061522;font-weight:700;cursor:pointer}</style></head><body><main class="panel"><small>AXIMACH / RECOVERY MODE</small><h1>The command environment did not start</h1><p>AXIMACH detected a renderer loading problem instead of leaving a blank window. Retry the application. If it happens again, share the diagnostic log with support.</p><div class="error">${safe}</div><button onclick="location.reload()">Retry loading</button><p>Diagnostic log: <span class="error">${startupLogPath || "Application user-data/logs/startup.log"}</span></p></main></body></html>`;
  window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html)).catch(error => logStartup("Recovery screen failed", error));
}
function getSharedApiKey(dataDir) {
  const keyPath = path.join(dataDir, "shared-api-key.txt");
  try { const existing = fs.readFileSync(keyPath, "utf8").trim(); if (existing.length >= 40) return existing; } catch { /* first launch */ }
  const key = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(keyPath, key, { encoding: "utf8", mode: 0o600 });
  return key;
}
function spawnLocalService(entry, env, label) {
  const child = spawn(process.execPath, [entry], { cwd: app.getPath("userData"), windowsHide: true, detached: false, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ...env }, stdio: "ignore" });
  child.on("error", error => logStartup(label + " failed to start", error));
  child.on("exit", code => {
    if (code && code !== 0) logStartup(label + " exited", code);
    if (label === "AXIMACH shared-data server") manufacturingServer = undefined;
    if (label === "AXIMACH WhatsApp bridge") whatsappBridge = undefined;
  });
  return child;
}
function startLocalServices() {
  const appRoot = app.getAppPath();
  const resourcesRoot = process.resourcesPath || appRoot;
  const serviceRoot = app.isPackaged ? path.join(resourcesRoot, "aximach-server") : path.join(appRoot, "server");
  const serverDir = path.join(app.getPath("userData"), "aximach");
  const whatsappDir = path.join(app.getPath("userData"), "whatsapp");
  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(whatsappDir, { recursive: true });
  sharedApiKey = getSharedApiKey(serverDir);
  const serverEntry = path.join(serviceRoot, "index.mjs");
  const whatsappEntry = path.join(serviceRoot, "whatsapp-web.mjs");
  if (!manufacturingServer && fs.existsSync(serverEntry)) manufacturingServer = spawnLocalService(serverEntry, { PORT: "8787", AXIMACH_API_KEY: sharedApiKey, AXIMACH_DATA_FILE: path.join(serverDir, "aximach.json"), AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS, NODE_PATH: path.join(appRoot, "node_modules") }, "AXIMACH shared-data server");
  else if (!fs.existsSync(serverEntry)) logStartup("Shared-data server entry is missing", serverEntry);
  if (!whatsappBridge && fs.existsSync(whatsappEntry)) whatsappBridge = spawnLocalService(whatsappEntry, { WA_WEB_PORT: "8789", WA_WEB_HOST: "0.0.0.0", AXIMACH_API_KEY: sharedApiKey, AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS, WA_WEB_DATA_FILE: path.join(whatsappDir, "whatsapp-web-lan.json"), WA_WEB_AUTH_DIR: path.join(whatsappDir, "whatsapp-auth-lan"), NODE_PATH: path.join(appRoot, "node_modules") }, "AXIMACH WhatsApp bridge");
  else if (!fs.existsSync(whatsappEntry)) logStartup("WhatsApp bridge entry is missing", whatsappEntry);
}
function injectLocalServerSettings(window) {
  const settings = { "aximach.scheduler.url": "http://127.0.0.1:8787", "aximach.scheduler.key": sharedApiKey, "aximach.whatsapp.url": "http://127.0.0.1:8789" };
  const bootstrap = "(() => { try { const values = " + JSON.stringify(settings) + "; for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); } catch (_) {} })();";
  window.webContents.addDocumentStartJavaScript(bootstrap);
}
function createWindow() {
  const window = new BrowserWindow({ width: 1600, height: 1000, minWidth: 980, minHeight: 680, autoHideMenuBar: false, backgroundColor: "#07111d", title: "AXIMACH — Manufacturing OS", show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  mainWindow = window;
  injectLocalServerSettings(window);
  window.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url); return { action: "deny" }; });
  window.webContents.on("did-fail-load", (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) {
      logStartup("Renderer failed to load", { code, description, url });
      if (isSmokeTest) app.exit(1);
      else { showRecoveryScreen(window, description + " (code " + code + ")"); if (!window.isDestroyed()) window.show(); }
    }
  });
  window.webContents.on("dom-ready", () => logStartup("Renderer DOM ready"));
  window.webContents.on("did-start-loading", () => logStartup("Renderer navigation started"));
  window.webContents.on("did-stop-loading", () => logStartup("Renderer navigation stopped"));
  window.webContents.on("console-message", (_event, details) => {
    if (isSmokeTest && details.level >= 2) logStartup("Renderer console error", { message: details.message, line: details.lineNumber, source: details.sourceId });
  });
  window.webContents.on("did-finish-load", () => {
    if (!isSmokeTest || window.isDestroyed()) return;
    logStartup("Renderer did-finish-load received");
    window.webContents.executeJavaScript("({readyState:document.readyState,rootChildren:document.querySelector('#root')?.children.length||0,rootText:document.querySelector('#root')?.innerText?.slice(0,600)||''})")
      .then(snapshot => {
        const passed = snapshot.readyState === "complete" && snapshot.rootChildren > 0 && snapshot.rootText.includes("AXIMACH");
        logStartup(passed ? "Windows packaged-renderer smoke test passed" : "Windows packaged-renderer smoke test failed", snapshot);
        app.exit(passed ? 0 : 1);
      })
      .catch(error => { logStartup("Windows packaged-renderer smoke evaluation failed", error); app.exit(1); });
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    logStartup("Renderer process exited", details);
    if (isSmokeTest) app.exit(1);
    else { showRecoveryScreen(window, "Renderer process exited: " + details.reason + " (exit " + details.exitCode + ")"); if (!window.isDestroyed()) window.show(); }
  });
  window.webContents.on("unresponsive", () => logStartup("Renderer became unresponsive"));
  window.webContents.on("responsive", () => logStartup("Renderer responsive again"));
  window.on("ready-to-show", () => { if (!isSmokeTest) window.show(); });
  window.on("closed", () => { if (mainWindow === window) mainWindow = undefined; });
  const indexPath = path.join(app.getAppPath(), "dist", "index.html");
  logStartup("Loading renderer", indexPath);
  if (!fs.existsSync(indexPath)) { logStartup("Packaged renderer entry is missing", indexPath); showRecoveryScreen(window, "Packaged application file is missing: " + indexPath); window.show(); return window; }
  window.loadFile(indexPath).then(() => {
    logStartup("Renderer loadFile promise resolved");
    if (!isSmokeTest && !window.isDestroyed()) window.show();
  }).catch(error => {
    logStartup("Renderer loadFile rejected", error);
    if (isSmokeTest) app.exit(1);
    else { showRecoveryScreen(window, error.message); if (!window.isDestroyed()) window.show(); }
  });
  return window;
}
function stopLocalServices() {
  for (const child of [manufacturingServer, whatsappBridge]) if (child && !child.killed) { try { child.kill(); } catch { /* already stopped */ } }
  manufacturingServer = undefined; whatsappBridge = undefined;
}
if (isSmokeTest && smokeUserData) {
  const earlyDir = path.join(smokeUserData, "logs");
  try {
    fs.mkdirSync(earlyDir, { recursive: true });
    fs.appendFileSync(path.join(earlyDir, "startup.log"), `[${new Date().toISOString()}] Electron main module loaded; waiting for app readiness\\n`, "utf8");
  } catch {}
}
process.on("uncaughtException", error => { logStartup("Uncaught main-process exception", error); if (isSmokeTest) app.exit(1); });
process.on("unhandledRejection", error => { logStartup("Unhandled main-process rejection", error); if (isSmokeTest) app.exit(1); });
app.whenReady().then(() => {
  try {
    initialiseDiagnostics();
    logStartup("Electron app.whenReady resolved");
    if (!isSmokeTest) startLocalServices();
    createWindow();
    if (isSmokeTest) setTimeout(() => { logStartup("Windows packaged-renderer smoke test timed out"); app.exit(2); }, 60000);
    app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }
  catch (error) {
    logStartup("Fatal application startup error", error);
    if (isSmokeTest) { app.exit(1); return; }
    if (!mainWindow || mainWindow.isDestroyed()) { mainWindow = new BrowserWindow({ width: 900, height: 650, show: true, backgroundColor: "#07111d" }); showRecoveryScreen(mainWindow, error.message); }
  }
}).catch(error => { logStartup("AXIMACH failed before Electron became ready", error); if (isSmokeTest) app.exit(1); });
app.on("before-quit", stopLocalServices);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
