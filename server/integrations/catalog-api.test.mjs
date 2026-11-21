import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "../auth.mjs";

const serverEntry = fileURLToPath(new URL("../index.mjs", import.meta.url));

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate test port.");
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const stopped = once(child, "exit").then(() => true);
  child.kill("SIGTERM");
  if (!await Promise.race([stopped, new Promise(resolve => setTimeout(() => resolve(false), 3000))])) {
    const forced = once(child, "exit").catch(() => {});
    child.kill("SIGKILL");
    await Promise.race([forced, new Promise(resolve => setTimeout(resolve, 1000))]);
  }
}

test("integration catalogue is admin-only and does not disclose connector secret values", { timeout: 20000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-catalog-api-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const users = [
    { id: "catalog-admin", username: "catalog.admin", role: "admin", passwordHash: await hashPassword("AXIMACH-catalog-admin-passphrase") },
    { id: "catalog-viewer", username: "catalog.viewer", role: "viewer", passwordHash: await hashPassword("AXIMACH-catalog-viewer-passphrase") }
  ];
  const child = spawn(process.execPath, [serverEntry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      AXIMACH_API_KEY: "",
      AXIMACH_AUTH_USERS: JSON.stringify(users),
      AXIMACH_DATA_FILE: dataFile,
      AXIMACH_SEARXNG_URL: "https://search.example.test",
      APOLLO_API_KEY: "catalog-test-secret-must-not-leak"
    },
    stdio: "ignore"
  });

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (child.exitCode !== null) throw new Error("AXIMACH server exited before health check.");
      try {
        const response = await fetch(baseUrl + "/health", { cache: "no-store" });
        if (response.ok) { healthy = true; break; }
      } catch { /* Wait for the local test server to listen. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(healthy, true, "server should become healthy");

    const unauthenticated = await fetch(baseUrl + "/api/integrations/catalog", { cache: "no-store" });
    assert.equal(unauthenticated.status, 401);

    const login = async (username, password) => {
      const response = await fetch(baseUrl + "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      assert.equal(response.status, 200);
      return response.json();
    };
    const admin = await login("catalog.admin", "AXIMACH-catalog-admin-passphrase");
    const viewer = await login("catalog.viewer", "AXIMACH-catalog-viewer-passphrase");

    const denied = await fetch(baseUrl + "/api/integrations/catalog", {
      headers: { authorization: "Bearer " + viewer.token },
      cache: "no-store"
    });
    assert.equal(denied.status, 403);

    const accepted = await fetch(baseUrl + "/api/integrations/catalog", {
      headers: { authorization: "Bearer " + admin.token },
      cache: "no-store"
    });
    assert.equal(accepted.status, 200);
    const payload = await accepted.json();
    assert.equal(payload.total, payload.items.length);
    assert.ok(payload.total >= 100);
    assert.equal(payload.items.find(item => item.id === "searxng").status, "configured-unverified");
    assert.equal(JSON.stringify(payload).includes("catalog-test-secret-must-not-leak"), false);
    assert.ok(JSON.stringify(payload).includes("APOLLO_API_KEY") === false, "unconfigured credentials are not advertised as required unless an adapter defines a key");
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});
