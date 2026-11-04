import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const serverEntry = fileURLToPath(new URL("./index.mjs", import.meta.url));
const apiKey = "aximach-integration-test-key-0123456789abcdef";

async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a test port.");
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

function startServer(port, dataFile) {
  return spawn(process.execPath, [serverEntry], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      AXIMACH_API_KEY: apiKey,
      AXIMACH_DATA_FILE: dataFile,
      AXIMACH_ALLOWED_ORIGINS: "http://localhost"
    },
    stdio: "ignore"
  });
}

async function waitForHealth(child, baseUrl) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (child.exitCode !== null) throw new Error("AXIMACH server exited before becoming healthy (code " + child.exitCode + ").");
    try {
      const response = await fetch(baseUrl + "/health", { cache: "no-store" });
      if (response.ok) return response;
    } catch { /* wait until the local server begins listening */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("AXIMACH server did not become healthy within 8 seconds.");
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

test("HTTP server persists and merges follow-up assignments across device updates and restart", { timeout: 20000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-shared-data-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  let child;

  try {
    child = startServer(port, dataFile);
    const healthResponse = await waitForHealth(child, baseUrl);
    const health = await healthResponse.json();
    assert.equal(health.ok, true);
    assert.equal(health.storage, "local-file");
    assert.equal(JSON.stringify(health).includes(dataFile), false, "public health must not reveal the data-file path");

    const unauthorized = await fetch(baseUrl + "/api/manufacturing-data");
    assert.equal(unauthorized.status, 401);

    const headers = { "content-type": "application/json", "x-aximach-key": apiKey };
    const firstAssignment = {
      id: "followup-link-device-a", moduleId: "companies", recordId: "company-1",
      recordLabel: "Company A", contactId: "contact-a", contactName: "Contact A",
      contactPhone: "9000000001", contactEmail: "", createdAt: "2026-11-04T10:00:00.000Z", updatedAt: "2026-11-04T10:00:00.000Z"
    };
    const secondAssignment = {
      id: "followup-link-device-b", moduleId: "companies", recordId: "company-1",
      recordLabel: "Company A", contactId: "contact-b", contactName: "Contact B",
      contactPhone: "9000000002", contactEmail: "", createdAt: "2026-11-04T10:01:00.000Z", updatedAt: "2026-11-04T10:01:00.000Z"
    };

    const initialPut = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ data: {
        companies: [{ id: "company-1", name: "Company A", updatedAt: "2026-11-04T10:00:00.000Z" }],
        followUpAssignments: [firstAssignment]
      } })
    });
    assert.equal(initialPut.status, 200);

    const deviceBPut = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ data: { followUpAssignments: [secondAssignment] } })
    });
    assert.equal(deviceBPut.status, 200);

    const staleDevicePut = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ data: {
        updatedAt: "2026-11-03T10:00:00.000Z",
        companies: [],
        followUpAssignments: []
      } })
    });
    assert.equal(staleDevicePut.status, 200);

    const current = await fetch(baseUrl + "/api/manufacturing-data", { headers });
    assert.equal(current.status, 200);
    const currentData = (await current.json()).data;
    assert.equal(currentData.followUpAssignments.length, 2);
    assert.deepEqual(new Set(currentData.followUpAssignments.map(row => row.id)), new Set([firstAssignment.id, secondAssignment.id]));
    assert.equal(currentData.companies[0].name, "Company A");

    await stopServer(child);
    child = undefined;
    const persisted = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(persisted.manufacturingData.followUpAssignments.length, 2);

    child = startServer(port, dataFile);
    await waitForHealth(child, baseUrl);
    const afterRestart = await fetch(baseUrl + "/api/manufacturing-data", { headers });
    assert.equal(afterRestart.status, 200);
    const restartedData = (await afterRestart.json()).data;
    assert.equal(restartedData.followUpAssignments.length, 2);
    assert.equal(restartedData.followUpAssignments.some(row => row.contactName === "Contact A"), true);
    assert.equal(restartedData.followUpAssignments.some(row => row.contactName === "Contact B"), true);
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});
