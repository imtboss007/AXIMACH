import { spawn } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const VERSION = "3.80.0";
const ALLOWED_TOOLS = new Set(["analyze_diff", "analyze_diff-risk", "analyze_file-risk"]);
const home = await mkdtemp(join(tmpdir(), "aximach-ruflo-home-"));
const cache = join(home, "npm-cache");
await mkdir(cache, { recursive: true });

const inheritedPath = process.env.PATH ?? "";
const env = {
  PATH: inheritedPath,
  HOME: home,
  USERPROFILE: home,
  APPDATA: join(home, "AppData", "Roaming"),
  LOCALAPPDATA: join(home, "AppData", "Local"),
  XDG_CONFIG_HOME: join(home, ".config"),
  XDG_CACHE_HOME: cache,
  npm_config_cache: cache,
  TMPDIR: home,
  TEMP: home,
  TMP: home,
  SystemRoot: process.env.SystemRoot ?? "",
  ComSpec: process.env.ComSpec ?? "",
  CI: "true",
  DO_NOT_TRACK: "1",
  NODE_ENV: "production",
};

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(command, ["--yes", "claude-flow@" + VERSION, "mcp", "start"], {
  cwd: process.cwd(),
  env,
  stdio: ["pipe", "pipe", "pipe"],
  shell: process.platform === "win32",
  detached: process.platform !== "win32",
});

const pending = new Map();
let stdoutBuffer = "";
let closed = false;

function send(message) {
  if (!closed) process.stdout.write(JSON.stringify(message) + "\n");
}

function errorResponse(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function forward(message) {
  child.stdin.write(JSON.stringify(message) + "\n");
}

function handleClientLine(line) {
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    errorResponse(null, -32700, "Parse error");
    return;
  }
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    errorResponse(message?.id ?? null, -32600, "Invalid JSON-RPC request");
    return;
  }

  if (message.id === undefined) {
    if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") {
      forward(message);
    }
    return;
  }

  if (message.method === "tools/list") {
    pending.set(String(message.id), "tools/list");
    forward(message);
    return;
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (!ALLOWED_TOOLS.has(name)) {
      errorResponse(message.id, -32602, "Tool blocked by AXIMACH Ruflo allowlist: " + String(name || "unknown"));
      return;
    }
    const outgoing = structuredClone(message);
    if (name === "analyze_diff") {
      outgoing.params.arguments = { ...(outgoing.params.arguments ?? {}), useRuVector: false };
    }
    pending.set(String(message.id), "tools/call");
    forward(outgoing);
    return;
  }

  if (message.method === "initialize" || message.method === "ping") {
    pending.set(String(message.id), message.method);
    forward(message);
    return;
  }

  errorResponse(message.id, -32601, "Method not exposed by AXIMACH Ruflo allowlist");
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", handleClientLine);

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  let newline;
  while ((newline = stdoutBuffer.indexOf("\n")) >= 0) {
    const line = stdoutBuffer.slice(0, newline);
    stdoutBuffer = stdoutBuffer.slice(newline + 1);
    if (!line.trim()) continue;
    try {
      const message = JSON.parse(line);
      if (message.id !== undefined && pending.has(String(message.id))) {
        const method = pending.get(String(message.id));
        pending.delete(String(message.id));
        if (method === "tools/list" && message.result && Array.isArray(message.result.tools)) {
          message.result.tools = message.result.tools.filter((tool) => ALLOWED_TOOLS.has(tool.name));
          delete message.result.nextCursor;
        }
      }
      send(message);
    } catch {
      // Never pass non-JSON server output into the MCP protocol stream.
      process.stderr.write("AXIMACH Ruflo wrapper ignored a non-protocol stdout line.\n");
    }
  }
});

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => process.stderr.write(chunk));
child.on("error", (error) => {
  for (const [id] of pending) {
    pending.delete(id);
    errorResponse(id, -32603, "Ruflo process failed to start: " + error.message);
  }
});
child.on("exit", (code, signal) => {
  for (const [id] of pending) {
    pending.delete(id);
    errorResponse(id, -32603, "Ruflo process exited (code=" + code + ", signal=" + signal + ")");
  }
  shutdown();
});

async function shutdown() {
  if (closed) return;
  closed = true;
  rl.close();
  if (child.exitCode === null) {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {}
  }
  await rm(home, { recursive: true, force: true }).catch(() => {});
}

process.stdin.on("close", shutdown);
process.on("SIGINT", () => { shutdown().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { shutdown().finally(() => process.exit(0)); });
