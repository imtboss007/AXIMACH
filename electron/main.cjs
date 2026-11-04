const { app, BrowserWindow, shell, protocol } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

// Keep Chromium GPU acceleration enabled for smooth 3D orbit interaction by default.
// Set AXIMACH_DISABLE_GPU=1 only as a troubleshooting fallback for unstable graphics drivers.
if (process.env.AXIMACH_DISABLE_GPU === "1") app.disableHardwareAcceleration();
// Vite ES-module assets are served from a scoped, standard app:// origin instead of file://.
// Electron recommends custom protocols for bundled local pages: https://www.electronjs.org/docs/latest/tutorial/security
protocol.registerSchemesAsPrivileged([{
  scheme: "aximach",
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}]);
const CLIENT_ORIGINS = "null,aximach://bundle,capacitor://localhost,https://localhost,http://localhost,http://localhost:5173";
let sharedApiKey = "";
let manufacturingServer;
let whatsappBridge;

function diagnosticLog(message, details) {
  try {
    const logFile = process.env.AXIMACH_SMOKE_LOG || path.join(app.getPath("userData"), "logs", "startup.log");
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile,
      "[" + new Date().toISOString() + "] " + message + " " + (details || "") + "\n", "utf8");
  } catch (error) { console.error("AXIMACH could not write startup log:", error); }
}

function registerFrontendProtocol() {
  const root = path.resolve(app.getAppPath(), "dist");
  const index = path.join(root, "index.html");
  diagnosticLog("frontend package check:", JSON.stringify({ root, indexExists: fs.existsSync(index) }));
  if (!fs.existsSync(index)) throw new Error("Packaged AXIMACH frontend is missing: " + index);

  protocol.handle("aximach", async request => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405 });
      }
      const url = new URL(request.url);
      if (url.hostname !== "bundle") return new Response("Unknown AXIMACH resource host", { status: 404 });
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); }
      catch { return new Response("Invalid asset path", { status: 400 }); }
      const relative = pathname === "/" ? "index.html" : (pathname.startsWith("/") ? pathname.slice(1) : pathname);
      let filePath = path.resolve(root, relative);
      if (filePath !== root && !filePath.startsWith(root + path.sep)) {
        diagnosticLog("blocked frontend path:", pathname);
        return new Response("Forbidden", { status: 403 });
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, "index.html");
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        diagnosticLog("frontend asset missing:", pathname);
        return new Response("AXIMACH frontend asset not found: " + pathname, { status: 404 });
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".ico": "image/x-icon",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
        ".ttf": "font/ttf",
        ".map": "application/json; charset=utf-8",
      };
      const contentType = contentTypes[ext] || "application/octet-stream";
      if ([".html", ".js", ".css"].includes(ext)) diagnosticLog("frontend asset request:", pathname);
      // Read using Electron's patched fs API so app.asar virtual paths work on Windows.
      const body = fs.readFileSync(filePath);
      const headers = {
        "content-type": contentType,
        "content-length": String(body.length),
        "x-content-type-options": "nosniff",
        "cache-control": relative.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      };
      if ([".html", ".js", ".css"].includes(ext)) diagnosticLog("frontend asset response:", pathname + " · 200 · " + contentType + " · " + body.length + " bytes");
      return new Response(request.method === "HEAD" ? null : body, { status: 200, headers });
    } catch (error) {
      diagnosticLog("frontend protocol error:", error.stack || error.message);
      return new Response("AXIMACH local asset server error: " + (error.message || String(error)), { status: 500 });
    }
  });
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
    cwd: app.getPath("userData"), windowsHide: true, detached: false,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", ...env }, stdio: "ignore",
  });
  child.on("error", error => diagnosticLog(label + " failed:", error.message));
  child.on("exit", code => {
    if (code && code !== 0) diagnosticLog(label + " exited:", String(code));
    if (label === "AXIMACH shared-data server") manufacturingServer = undefined;
    if (label === "AXIMACH WhatsApp bridge") whatsappBridge = undefined;
  });
  return child;
}

function startLocalServices() {
  const appRoot = app.getAppPath();
  const serverDir = path.join(app.getPath("userData"), "aximach");
  const whatsappDir = path.join(app.getPath("userData"), "whatsapp");
  fs.mkdirSync(serverDir, { recursive: true });
  fs.mkdirSync(whatsappDir, { recursive: true });
  sharedApiKey = getSharedApiKey(serverDir);
  if (!manufacturingServer) manufacturingServer = spawnLocalService(path.join(appRoot, "server", "index.mjs"), {
    PORT: "8787", AXIMACH_API_KEY: sharedApiKey,
    AXIMACH_DATA_FILE: path.join(serverDir, "aximach.json"),
    AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
  }, "AXIMACH shared-data server");
  if (!whatsappBridge) whatsappBridge = spawnLocalService(path.join(appRoot, "server", "whatsapp-web.mjs"), {
    WA_WEB_PORT: "8789", WA_WEB_HOST: "0.0.0.0",
    AXIMACH_API_KEY: sharedApiKey, AXIMACH_ALLOWED_ORIGINS: CLIENT_ORIGINS,
    WA_WEB_DATA_FILE: path.join(whatsappDir, "whatsapp-web-lan.json"),
    WA_WEB_AUTH_DIR: path.join(whatsappDir, "whatsapp-auth-lan"),
  }, "AXIMACH WhatsApp bridge");
}

function injectLocalServerSettings(window) {
  const settings = {
    "aximach.scheduler.url": "http://127.0.0.1:8787",
    "aximach.scheduler.key": sharedApiKey,
    "aximach.whatsapp.url": "http://127.0.0.1:8789",
  };
  const bootstrap = "(() => { try { const values = " + JSON.stringify(settings)
    + "; for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value); } catch (_) {} })();";

  // Electron WebContents does not expose addDocumentStartJavaScript().
  // Use the documented executeJavaScript() once the page has finished loading.
  window.webContents.once("did-finish-load", () => {
    window.webContents.executeJavaScript(bootstrap).then(() => {
      diagnosticLog("local service settings:", "injected after document load");
    }).catch(error => {
      diagnosticLog("local service settings injection failed:", error.stack || error.message);
    });
  });
}

function showDiagnosticPage(window, heading, detail) {
  const safeHeading = String(heading).replace(/[<>&]/g, "");
  const safeDetail = String(detail || "No further detail was reported.").replace(/[<>&]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>AXIMACH startup diagnostics</title></head>
  <body style="margin:0;padding:40px;background:#0b1626;color:#e8f2ff;font:14px/1.6 Segoe UI,Arial,sans-serif">
    <h1 style="font-size:26px">${safeHeading}</h1>
    <p>The AXIMACH window opened, but its workspace did not render.</p>
    <pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;background:#101f33;border:1px solid #36506b;border-radius:8px;color:#ffd5a6">${safeDetail}</pre>
    <p style="color:#9ab2ce">Startup log: %APPDATA%\\AXIMACH\\logs\\startup.log</p>
  </body></html>`;
  window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
}

function createWindow(frontendUrl = "aximach://bundle/index.html") {
  const window = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 980, minHeight: 680,
    autoHideMenuBar: false, backgroundColor: "#0b1626",
    title: "AXIMACH — Manufacturing OS",
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    injectLocalServerSettings(window);
  } catch (error) {
    diagnosticLog("local service settings setup failed:", error.stack || error.message);
  }
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("console-message", (_event, details) => {
    diagnosticLog("renderer console:", details.level + ": " + details.message
      + " (" + details.sourceId + ":" + details.lineNumber + ")");
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

  diagnosticLog("loading frontend through scoped protocol:", frontendUrl);
  window.loadURL(frontendUrl).catch(error => {
    diagnosticLog("frontend load rejected:", error.stack || error.message);
    showDiagnosticPage(window, "AXIMACH could not open its application files", error.stack || error.message);
    if (process.env.AXIMACH_SMOKE_TEST === "1") app.exit(1);
  });

  window.webContents.on("did-finish-load", () => {
    diagnosticLog("frontend document loaded:", window.webContents.getURL());
  });

  // Run independently of did-finish-load: a broken module import must not leave
  // the native window alive forever with only its background color visible.
  setTimeout(async () => {
    if (window.isDestroyed()) return;
    try {
      const state = await Promise.race([
        window.webContents.executeJavaScript(`(() => ({
          url: location.href, readyState: document.readyState,
          rootExists: !!document.getElementById("root"),
          appShell: !!document.querySelector(".app-shell"),
          startupError: !!document.querySelector('[data-aximach-startup-error="true"]'),
          resources: performance.getEntriesByType("resource").map(x => x.name).slice(-40)
        }))()`),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Renderer did not respond to the startup watchdog within 5 seconds.")), 5000))
      ]);
      diagnosticLog("renderer watchdog:", JSON.stringify(state));
      if (state.appShell) {
        diagnosticLog("renderer status:", "React workspace mounted successfully");
        if (process.env.AXIMACH_SMOKE_TEST === "1") app.quit();
      } else {
        diagnosticLog("renderer status:", "Workspace did not mount");
        if (!state.startupError && !String(state.url || "").startsWith("data:")) {
          showDiagnosticPage(window, "AXIMACH workspace did not mount", JSON.stringify(state, null, 2));
        }
        if (process.env.AXIMACH_SMOKE_TEST === "1") app.exit(1);
      }
    } catch (error) {
      diagnosticLog("renderer watchdog failed:", error.stack || error.message);
      showDiagnosticPage(window, "AXIMACH renderer health check failed", error.stack || error.message);
      if (process.env.AXIMACH_SMOKE_TEST === "1") app.exit(1);
    }
  }, 12000);
}

function stopLocalServices() {
  for (const child of [manufacturingServer, whatsappBridge]) {
    if (child && !child.killed) { try { child.kill(); } catch { /* already stopped */ } }
  }
  manufacturingServer = undefined; whatsappBridge = undefined;
}
app.whenReady().then(() => {
  try {
    diagnosticLog("application startup:", "Electron ready");
    registerFrontendProtocol();
    if (process.env.AXIMACH_SMOKE_TEST === "1") diagnosticLog("smoke test mode:", "local background services skipped");
    else startLocalServices();
    createWindow("aximach://bundle/index.html");
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow("aximach://bundle/index.html");
    });
  } catch (error) {
    diagnosticLog("fatal application startup error:", error.stack || error.message);
    if (process.env.AXIMACH_SMOKE_TEST === "1") app.exit(1);
    else {
      const diagnostic = new BrowserWindow({ width: 1000, height: 700, backgroundColor: "#0b1626" });
      showDiagnosticPage(diagnostic, "AXIMACH could not start", error.stack || error.message);
    }
  }
}).catch(error => {
  diagnosticLog("Electron ready handler failed:", error.stack || error.message);
  if (process.env.AXIMACH_SMOKE_TEST === "1") app.exit(1);
});
app.on("before-quit", stopLocalServices);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
