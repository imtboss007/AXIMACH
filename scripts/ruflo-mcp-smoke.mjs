import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const VERSION = "3.80.0";
const RESPONSE_TIMEOUT_MS = 120_000;
const root = await mkdtemp(join(tmpdir(), "aximach-ruflo-pilot-"));
const home = join(root, "home");
const cwd = process.cwd();
const cache = join(root, "npm-cache");
const { mkdir } = await import("node:fs/promises");
await Promise.all([mkdir(home), mkdir(cache)]);

const baseFetch = spawnSync("git", ["fetch", "--depth", "100", "origin", "stage6/p0-production-quantity-integrity"], { cwd, encoding: "utf8", timeout: 120_000 });
if (baseFetch.status !== 0) throw new Error("Could not fetch AXIMACH base branch: " + (baseFetch.stderr || baseFetch.error?.message || "git fetch failed"));

let child;
let stdoutBuffer = "";
let stderrTail = "";
const pending = new Map();
let nextId = 1;

function fail(message) {
  throw new Error(message + (stderrTail ? "\nRuflo stderr (tail):\n" + stderrTail.slice(-4000) : ""));
}

function onLine(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return;
  try {
    const message = JSON.parse(trimmed);
    if (message.id !== undefined && pending.has(message.id)) {
      const resolve = pending.get(message.id);
      pending.delete(message.id);
      resolve(message);
    }
  } catch {
    // Ignore non-protocol stdout lines; only matching JSON-RPC responses count.
  }
}

function request(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timed out waiting for MCP response to " + method));
    }, RESPONSE_TIMEOUT_MS);
    pending.set(id, (message) => {
      clearTimeout(timer);
      if (message.error) reject(new Error(method + " returned MCP error: " + JSON.stringify(message.error)));
      else resolve(message.result);
    });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function notify(method, params = {}) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

try {
  child = spawn("npx", ["--yes", "claude-flow@" + VERSION, "mcp", "start"], {
    cwd,
    env: {
      PATH: process.env.PATH ?? "",
      HOME: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      XDG_CACHE_HOME: cache,
      npm_config_cache: cache,
      TMPDIR: root,
      CI: "true",
      DO_NOT_TRACK: "1",
      NODE_ENV: "test",
    },
    stdio: ["pipe", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk;
    let newline;
    while ((newline = stdoutBuffer.indexOf("\n")) >= 0) {
      const line = stdoutBuffer.slice(0, newline);
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      onLine(line);
    }
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    stderrTail = (stderrTail + chunk).slice(-8000);
  });
  child.on("error", (error) => {
    for (const [id, resolve] of pending) {
      pending.delete(id);
      resolve({ error: { message: error.message } });
    }
  });
  child.on("exit", (code, signal) => {
    for (const [id, resolve] of pending) {
      pending.delete(id);
      resolve({ error: { message: "Ruflo MCP process exited before responding (code=" + code + ", signal=" + signal + ")" } });
    }
  });

  const initialized = await request("initialize", {
    protocolVersion: "2025-11-25",
    capabilities: {},
    clientInfo: { name: "aximach-ruflo-isolated-pilot", version: "1.0.0" },
  });
  if (!initialized?.serverInfo?.name || !initialized?.protocolVersion) {
    fail("MCP initialize response did not contain server identity and protocol version");
  }

  notify("notifications/initialized");
  const listed = await request("tools/list");
  const tools = Array.isArray(listed?.tools) ? listed.tools : [];
  if (!tools.length) fail("MCP handshake succeeded but no tools were listed");

  const names = tools.map((tool) => tool.name).filter(Boolean).sort();
  if (new Set(names).size !== names.length) fail("MCP tool inventory contains duplicate tool names");

  const inspectNames = new Set(["agent_execute","agent_list","agent_health","analyze_diff","analyze_diff-risk","analyze_file-risk","browser_act","browser_cookie_use","config_get","config_set","github_repo_analyze","guidance_recommend","memory_search","memory_retrieve","performance_bottleneck","performance_report","system_health","terminal_execute","workflow_execute"]);
  const inspectedTools = tools.filter((tool) => inspectNames.has(tool.name)).map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  const reviewTool = tools.find((tool) => tool.name === "analyze_diff");
  if (!reviewTool) fail("Read-only analyze_diff tool is not registered");
  const review = await request("tools/call", {
    name: "analyze_diff",
    arguments: {
      ref: "stage6/p0-production-quantity-integrity..HEAD",
      includeFileRisks: true,
      includeReviewers: true,
      useRuVector: false,
    },
  });
  if (review.isError) fail("Ruflo analyze_diff tool returned an error");
  const reviewText = review.content?.find((item) => item.type === "text")?.text ?? "";
  let reviewData;
  try { reviewData = JSON.parse(reviewText); } catch { reviewData = { raw: reviewText.slice(0, 4000) }; }
  if (reviewData.error) fail("Ruflo analyze_diff reported an error: " + reviewData.message);

  console.log(JSON.stringify({
    result: "PASS",
    pinnedPackage: "claude-flow@" + VERSION,
    server: initialized.serverInfo,
    protocolVersion: initialized.protocolVersion,
    toolCount: names.length,
    inspectedTools,
    toolNames: names,
    pilotToolCall: "analyze_diff",
    pilotAnalysis: {
      summary: reviewData.summary,
      risk: reviewData.risk,
      classification: reviewData.classification,
      fileCount: Array.isArray(reviewData.files) ? reviewData.files.length : undefined,
      fileRisks: Array.isArray(reviewData.fileRisks) ? reviewData.fileRisks.slice(0, 20) : undefined,
    },
    executedToolCalls: 1,
    projectFilesExposed: true,
    credentialsProvided: false,
    transport: "stdio",
  }, null, 2));
} catch (error) {
  console.error("RUFLO_PILOT_FAIL:", error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null) {
    try {
      if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
      else child.kill("SIGTERM");
    } catch {}
    await Promise.race([delay(3000), new Promise((resolve) => child.once("exit", resolve))]);
    if (child.exitCode === null) {
      try {
        if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch {}
    }
  }
  await rm(root, { recursive: true, force: true });
}
