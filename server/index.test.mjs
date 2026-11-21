import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { request as httpRequest } from "node:http";
import { createServer as createNetServer } from "node:net";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const serverEntry = fileURLToPath(new URL("./index.mjs", import.meta.url));
const { hashPassword } = await import("./auth.mjs");
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

function startServer(port, dataFile, extraEnv = {}) {
  return spawn(process.execPath, [serverEntry], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port), AXIMACH_API_KEY: apiKey, AXIMACH_AUTH_USERS: "", AXIMACH_DATA_FILE: dataFile, AXIMACH_ALLOWED_ORIGINS: "http://localhost", ...extraEnv },
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

function beginDelayedJsonRequest(baseUrl, path, headers, firstChunk) {
  const target = new URL(baseUrl);
  const request = httpRequest({ hostname: target.hostname, port: target.port, path, method: "PUT", headers: { ...headers, "transfer-encoding": "chunked" } });
  const responsePromise = new Promise((resolve, reject) => {
    request.once("error", reject);
    request.once("response", response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
  });
  request.write(firstChunk);
  return { finish: finalChunk => request.end(finalChunk), response: responsePromise };
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const gracefulExit = once(child, "exit");
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    gracefulExit.then(() => true),
    new Promise(resolve => setTimeout(() => resolve(false), 3000))
  ]);
  if (!stopped && child.exitCode === null) {
    const forcedExit = once(child, "exit").catch(() => {});
    child.kill("SIGKILL");
    await Promise.race([forcedExit, new Promise(resolve => setTimeout(resolve, 1000))]);
  }
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
    const wrongKey = await fetch(baseUrl + "/api/manufacturing-data", {
      headers: { "x-aximach-key": "incorrect-key" }
    });
    assert.equal(wrongKey.status, 401);

    const headers = { "content-type": "application/json", "x-aximach-key": apiKey };
    const syntheticOperation = {
      id: "operation-shared-1", poId: "po-shared-1", poLineId: "line-shared-1",
      componentId: "component-shared-1", sequence: 10, name: "VMC machining",
      updatedAt: "2026-11-04T10:00:00.000Z"
    };
    const syntheticTransportRoute = {
      id: "transport-route-shared-1", vendorId: "vendor-shared-1", fromLocation: "Factory",
      toLocation: "VMC subcontractor", vehicleType: "Mini truck", tripDirection: "One-way",
      fixedAmount: 850, currency: "INR", active: true, updatedAt: "2026-11-04T10:00:00.000Z"
    };
    const syntheticTransportLeg = {
      id: "transport-leg-device-a", poId: "po-shared-1", poLineId: "line-shared-1",
      componentId: "component-shared-1", routeId: syntheticTransportRoute.id,
      vendorId: "vendor-shared-1", fromLocation: "Factory", toLocation: "VMC subcontractor",
      vehicleType: "Mini truck", tripDirection: "One-way", fixedAmount: 850, tripCount: 2,
      anchorOperationId: syntheticOperation.id, placement: "before",
      updatedAt: "2026-11-04T10:00:00.000Z"
    };
    const syntheticMaterialLink = {
      id: "material-process-device-a", companyId: "company-1", poId: "po-shared-1",
      poLineId: "line-shared-1", componentId: "component-shared-1", bomLineId: "bom-shared-1",
      materialId: "material-shared-1", operationId: syntheticOperation.id,
      quantityPerPart: 1.25, unit: "kg", flowType: "Material input", placement: "before",
      updatedAt: "2026-11-04T10:00:00.000Z"
    };
    const secondMaterialLink = {
      ...syntheticMaterialLink, id: "material-process-device-b", materialId: "material-shared-2",
      bomLineId: "bom-shared-2", operationId: "operation-shared-2",
      updatedAt: "2026-11-04T10:01:00.000Z"
    };
    const secondTransportLeg = {
      ...syntheticTransportLeg, id: "transport-leg-device-b", anchorOperationId: "operation-shared-2",
      toLocation: "Heat treatment", sequence: 2, updatedAt: "2026-11-04T10:01:00.000Z"
    };
    const syntheticRelationship = {
      id: "relationship-shared-1", poId: "po-shared-1", poLineId: "line-shared-1",
      componentId: "component-shared-1", fromOperationId: syntheticOperation.id,
      toOperationId: "operation-shared-2", relationshipType: "main", status: "Active",
      updatedAt: "2026-11-04T10:00:00.000Z"
    };

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

    const [initialPut, deviceBPut] = await Promise.all([
      fetch(baseUrl + "/api/manufacturing-data", {
        method: "PUT", headers, body: JSON.stringify({ data: {
          companies: [{ id: "company-1", name: "Company A", updatedAt: "2026-11-04T10:00:00.000Z" }],
          operations: [syntheticOperation],
          transportRoutes: [syntheticTransportRoute],
          transportLegs: [syntheticTransportLeg],
          materialProcessLinks: [syntheticMaterialLink],
          routeRelationships: [syntheticRelationship],
          followUpAssignments: [firstAssignment]
        } })
      }),
      fetch(baseUrl + "/api/manufacturing-data", {
        method: "PUT", headers, body: JSON.stringify({ data: {
          operations: [{ ...syntheticOperation, id: "operation-shared-2", sequence: 20, name: "Heat treatment", updatedAt: "2026-11-04T10:01:00.000Z" }],
          transportLegs: [secondTransportLeg],
          materialProcessLinks: [secondMaterialLink],
          followUpAssignments: [secondAssignment]
        } })
      })
    ]);
    assert.equal(initialPut.status, 200);
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
    assert.equal(currentData.operations.length, 2, "both devices' process operations must merge");
    assert.equal(currentData.transportRoutes.length, 1, "Transport Directory masters remain separate from component legs");
    assert.equal(currentData.transportLegs.length, 2, "independent transport legs from both devices must merge");
    assert.equal(currentData.materialProcessLinks.length, 2, "independent material feeds from both devices must merge");
    assert.equal(currentData.routeRelationships.length, 1, "saved route connectors must persist");
    assert.equal(currentData.materialProcessLinks.find(row => row.id === syntheticMaterialLink.id).operationId, syntheticOperation.id);

    await stopServer(child);
    child = undefined;
    const persisted = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(persisted.manufacturingData.followUpAssignments.length, 2);
    assert.equal(persisted.manufacturingData.materialProcessLinks.length, 2);
    assert.equal(persisted.manufacturingData.transportLegs.length, 2);
    assert.equal(persisted.manufacturingData.routeRelationships.length, 1);

    child = startServer(port, dataFile);
    await waitForHealth(child, baseUrl);
    const afterRestart = await fetch(baseUrl + "/api/manufacturing-data", { headers });
    assert.equal(afterRestart.status, 200);
    const restartedData = (await afterRestart.json()).data;
    assert.equal(restartedData.followUpAssignments.length, 2);
    assert.equal(restartedData.followUpAssignments.some(row => row.contactName === "Contact A"), true);
    assert.equal(restartedData.followUpAssignments.some(row => row.contactName === "Contact B"), true);
    assert.equal(restartedData.operations.length, 2);
    assert.equal(restartedData.transportRoutes[0].fixedAmount, 850);
    assert.equal(restartedData.transportLegs.length, 2);
    assert.equal(restartedData.materialProcessLinks.length, 2);
    assert.equal(restartedData.routeRelationships[0].toOperationId, "operation-shared-2");
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});

test("authenticated backup and restore verifies integrity and preserves a pre-restore snapshot", { timeout: 20000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-backup-restore-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const headers = { "content-type": "application/json", "x-aximach-key": apiKey };
  let child;

  try {
    child = startServer(port, dataFile);
    await waitForHealth(child, baseUrl);

    const unauthorizedBackup = await fetch(baseUrl + "/api/backup");
    assert.equal(unauthorizedBackup.status, 401, "backup export must require the API key");

    const seed = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ data: {
        companies: [{ id: "backup-company-1", name: "Original Company", updatedAt: "2026-11-20T01:00:00.000Z" }]
      } })
    });
    assert.equal(seed.status, 200);

    const backupResponse = await fetch(baseUrl + "/api/backup", { headers });
    assert.equal(backupResponse.status, 200);
    const backup = await backupResponse.json();
    assert.equal(backup.format, "aximach-backup");
    assert.equal(backup.version, 1);
    assert.equal(
      backup.sha256,
      (await import("node:crypto")).createHash("sha256").update(JSON.stringify(backup.data)).digest("hex")
    );

    const missingConfirmation = await fetch(baseUrl + "/api/restore", {
      method: "POST", headers, body: JSON.stringify({ backup })
    });
    assert.equal(missingConfirmation.status, 400);

    const tamperedBackup = { ...backup, data: { ...backup.data, contacts: [{ id: "tampered" }] } };
    const rejectedTamper = await fetch(baseUrl + "/api/restore", {
      method: "POST", headers,
      body: JSON.stringify({ backup: tamperedBackup, confirmation: "RESTORE_AXIMACH_BACKUP" })
    });
    assert.equal(rejectedTamper.status, 400);
    assert.match((await rejectedTamper.json()).error, /integrity check failed/i);

    const changed = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ data: {
        companies: [{ id: "backup-company-1", name: "Changed Company", updatedAt: "2026-11-20T02:00:00.000Z" }]
      } })
    });
    assert.equal(changed.status, 200);

    const restored = await fetch(baseUrl + "/api/restore", {
      method: "POST", headers,
      body: JSON.stringify({ backup, confirmation: "RESTORE_AXIMACH_BACKUP" })
    });
    assert.equal(restored.status, 200);
    const restoreResult = await restored.json();
    assert.ok(restoreResult.preRestoreBackup.startsWith("aximach.json.pre-restore-"));

    const current = await fetch(baseUrl + "/api/manufacturing-data", { headers });
    const currentBody = await current.json();
    const currentData = currentBody.data;
    assert.equal(currentData.companies.find(row => row.id === "backup-company-1").name, "Original Company");
    assert.equal(restoreResult.restoreGeneration, 1, "restore must advance the server generation");
    assert.equal(currentBody.restoreGeneration, 1);
    const staleManufacturingWrite = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ data: { companies: [{ id: "stale", name: "Stale client write" }] } })
    });
    assert.equal(staleManufacturingWrite.status, 409, "pre-restore clients without a generation must be blocked");
    const staleRecordsWrite = await fetch(baseUrl + "/api/records", {
      method: "PUT", headers, body: JSON.stringify({ records: { companies: [{ id: "stale", title: "Stale record" }] } })
    });
    assert.equal(staleRecordsWrite.status, 409, "pre-restore module-record clients must be blocked");
    const currentGenerationWrite = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers, body: JSON.stringify({ restoreGeneration: 1, data: { companies: [{ id: "backup-company-1", name: "Post-restore update", updatedAt: "2026-11-20T03:00:00.000Z" }] } })
    });
    assert.equal(currentGenerationWrite.status, 200, "current-generation clients must continue syncing");
    const moduleState = await fetch(baseUrl + "/api/records", { headers });
    assert.equal((await moduleState.json()).restoreGeneration, 1);
    const currentGenerationRecordsWrite = await fetch(baseUrl + "/api/records", {
      method: "PUT", headers, body: JSON.stringify({ restoreGeneration: 1, records: { companies: [{ id: "restored-record", title: "Current-generation record", updatedAt: "2026-11-20T03:10:00.000Z" }] } })
    });
    assert.equal(currentGenerationRecordsWrite.status, 200, "current-generation module-record clients must continue syncing");

    const files = await (await import("node:fs/promises")).readdir(folder);
    assert.ok(files.includes(restoreResult.preRestoreBackup), "restore must preserve the pre-restore database snapshot");
    const preRestore = JSON.parse(await readFile(join(folder, restoreResult.preRestoreBackup), "utf8"));
    assert.equal(preRestore.manufacturingData.companies.find(row => row.id === "backup-company-1").name, "Changed Company");

    const persistedAfterRestore = JSON.parse(await readFile(dataFile, "utf8"));
    assert.equal(persistedAfterRestore.manufacturingData.companies.find(row => row.id === "backup-company-1").name, "Post-restore update", "writes completed after restore must persist on the restored generation");
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});

test("a write whose body finishes after restore is rejected by the captured generation", { timeout: 20000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-restore-race-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const headers = { "content-type": "application/json", "x-aximach-key": apiKey };
  let child;

  try {
    child = startServer(port, dataFile);
    await waitForHealth(child, baseUrl);
    const backupResponse = await fetch(baseUrl + "/api/backup", { headers });
    assert.equal(backupResponse.status, 200);
    const backup = await backupResponse.json();

    const delayed = beginDelayedJsonRequest(baseUrl, "/api/ui-preferences", headers, '{"preferences":');
    await new Promise(resolve => setTimeout(resolve, 75));

    const restored = await fetch(baseUrl + "/api/restore", {
      method: "POST", headers,
      body: JSON.stringify({ backup, confirmation: "RESTORE_AXIMACH_BACKUP" })
    });
    assert.equal(restored.status, 200);
    const restoreResult = await restored.json();
    assert.equal(restoreResult.restoreGeneration, 1);

    delayed.finish('{"theme":"stale-after-restore","updatedAt":"2026-11-20T02:30:00.000Z"}}');
    const delayedResult = await delayed.response;
    assert.equal(delayedResult.status, 409, "pre-restore writes that finish after the restore must not mutate the recovered database");
    const preferences = await fetch(baseUrl + "/api/ui-preferences", { headers });
    assert.equal((await preferences.json()).preferences, null);
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});


test("server user authentication issues expiring bearer sessions and enforces role permissions", { timeout: 30000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-user-auth-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const users = [
    { id: "auth-admin", username: "admin", passwordHash: await hashPassword("AXIMACH-admin-Password-2026!"), role: "admin", active: true },
    { id: "auth-operator", username: "operator", passwordHash: await hashPassword("AXIMACH-operator-Password-2026!"), role: "operator", companyIds: ["auth-company"], active: true },
    { id: "auth-viewer", username: "viewer", passwordHash: await hashPassword("AXIMACH-viewer-Password-2026!"), role: "viewer", companyIds: ["auth-company"], active: true }
  ];
  let child;
  try {
    child = startServer(port, dataFile, { AXIMACH_AUTH_USERS: JSON.stringify(users), AXIMACH_SESSION_TTL_MS: String(30 * 60 * 1000) });
    const health = await (await waitForHealth(child, baseUrl)).json();
    assert.equal(health.authMode, "users");
    const sharedKeyBypass = await fetch(baseUrl + "/api/manufacturing-data", { headers: { "x-aximach-key": apiKey } });
    assert.equal(sharedKeyBypass.status, 401, "legacy shared key must not bypass user mode");
    assert.equal((await fetch(baseUrl + "/api/auth/session")).status, 401);

    const badLogin = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "operator", password: "incorrect-password" }) });
    assert.equal(badLogin.status, 401);
    const login = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "operator", password: "AXIMACH-operator-Password-2026!" }) });
    assert.equal(login.status, 200);
    const operatorSession = await login.json();
    assert.match(operatorSession.token, /^[A-Za-z0-9_-]{40,60}$/);
    assert.equal(operatorSession.user.role, "operator");
    const operatorHeaders = { authorization: "Bearer " + operatorSession.token, "content-type": "application/json" };
    const whoAmI = await fetch(baseUrl + "/api/auth/session", { headers: operatorHeaders });
    assert.equal(whoAmI.status, 200);
    assert.equal((await whoAmI.json()).user.username, "operator");
    assert.equal((await fetch(baseUrl + "/api/manufacturing-data", { headers: operatorHeaders })).status, 200);
    const operatorWrite = await fetch(baseUrl + "/api/manufacturing-data", { method: "PUT", headers: operatorHeaders, body: JSON.stringify({ data: { components: [{ id: "auth-component", companyId: "auth-company", name: "Operator component", updatedAt: "2026-11-20T04:00:00.000Z" }] } }) });
    assert.equal(operatorWrite.status, 200);
    assert.equal((await fetch(baseUrl + "/api/backup", { headers: operatorHeaders })).status, 403);
    assert.equal((await fetch(baseUrl + "/api/not-yet-classified", { headers: operatorHeaders })).status, 403, "unclassified routes must fail closed for non-admin users");

    const viewerLogin = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "viewer", password: "AXIMACH-viewer-Password-2026!" }) });
    assert.equal(viewerLogin.status, 200);
    const viewer = await viewerLogin.json();
    const viewerHeaders = { authorization: "Bearer " + viewer.token, "content-type": "application/json" };
    assert.equal((await fetch(baseUrl + "/api/records", { headers: viewerHeaders })).status, 403, "generic legacy module records remain admin-only until tenant ownership is modeled");
    const blockedWrite = await fetch(baseUrl + "/api/records", { method: "PUT", headers: viewerHeaders, body: JSON.stringify({ records: { companies: [{ id: "viewer-write" }] } }) });
    assert.equal(blockedWrite.status, 403);

    const adminLogin = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "AXIMACH-admin-Password-2026!" }) });
    assert.equal(adminLogin.status, 200);
    const admin = await adminLogin.json(), adminHeaders = { authorization: "Bearer " + admin.token };
    assert.equal((await fetch(baseUrl + "/api/backup", { headers: adminHeaders })).status, 200);
    const info = await (await fetch(baseUrl + "/api/connection-info")).json();
    assert.equal(info.authMode, "users");
    assert.equal(Object.hasOwn(info, "apiKey"), false);

    assert.equal((await fetch(baseUrl + "/api/auth/logout", { method: "POST", headers: adminHeaders })).status, 200);
    assert.equal((await fetch(baseUrl + "/api/manufacturing-data", { headers: adminHeaders })).status, 401, "logout must revoke the bearer session immediately");
    const reLogin = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "AXIMACH-admin-Password-2026!" }) });
    assert.equal(reLogin.status, 200);
    const reAuthenticatedAdmin = await reLogin.json();
    const securityAudit = await fetch(baseUrl + "/api/audit-events", { headers: { authorization: "Bearer " + reAuthenticatedAdmin.token } });
    assert.equal(securityAudit.status, 200);
    const securityActions = (await securityAudit.json()).events.map(event => event.action);
    assert.equal(securityActions.includes("auth.login.rejected"), true, "failed sign-ins must be audited");
    assert.equal(securityActions.includes("auth.login.success"), true, "successful sign-ins must be audited");
    assert.equal(securityActions.includes("auth.logout"), true, "sign-outs must be audited");
    for (let attempt = 0; attempt < 8; attempt++) {
      const failed = await fetch(baseUrl + "/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "wrong-password" })
      });
      assert.equal(failed.status, attempt < 7 ? 401 : 429, "failed sign-in attempts should throttle only after the configured threshold");
    }
    const throttled = await fetch(baseUrl + "/api/auth/login", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "AXIMACH-admin-Password-2026!" })
    });
    assert.equal(throttled.status, 429, "repeated failures must rate-limit subsequent sign-in attempts");
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});

test("tenant-scoped user reads and writes only its assigned company and related manufacturing records", { timeout: 30000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-tenant-scope-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const users = [
    { id: "tenant-admin", username: "admin", passwordHash: await hashPassword("AXIMACH-tenant-admin-Password!"), role: "admin" },
    { id: "tenant-a-user", username: "companya", passwordHash: await hashPassword("AXIMACH-companya-Password!"), role: "operator", companyIds: ["company-a"] },
    { id: "tenant-a-manager", username: "managera", passwordHash: await hashPassword("AXIMACH-managera-Password!"), role: "manager", companyIds: ["company-a"] },
    { id: "tenant-a-viewer", username: "viewera", passwordHash: await hashPassword("AXIMACH-viewera-Password!"), role: "viewer", companyIds: ["company-a"] },
    { id: "tenant-a-factory-user", username: "factorya", passwordHash: await hashPassword("AXIMACH-factorya-Password!"), role: "operator", factoryIds: ["factory-a"] },
    { id: "tenant-unassigned", username: "unassigned", passwordHash: await hashPassword("AXIMACH-unassigned-Password!"), role: "operator" }
  ];
  let child;
  try {
    child = startServer(port, dataFile, { AXIMACH_AUTH_USERS: JSON.stringify(users) });
    await waitForHealth(child, baseUrl);
    const login = async (username, password) => {
      const response = await fetch(baseUrl + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      assert.equal(response.status, 200);
      const session = await response.json();
      return { authorization: "Bearer " + session.token, "content-type": "application/json" };
    };
    const adminHeaders = await login("admin","AXIMACH-tenant-admin-Password!");
    const seed = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT", headers: adminHeaders,
      body: JSON.stringify({ data: {
        companies: [
          { id:"company-a", name:"Company A", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"company-b", name:"Company B", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        factories: [
          { id:"factory-a", companyId:"company-a", name:"Factory A", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"factory-b", companyId:"company-b", name:"Factory B", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        components: [
          { id:"component-a", companyId:"company-a", name:"Component A", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"component-b", companyId:"company-b", name:"Component B", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        materials: [
          { id:"material-a", code:"MAT-A", name:"Material A", preferredVendorId:"vendor-a", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        componentParts: [
          { id:"part-a", componentId:"component-a", materialId:"material-a", materialIds:["material-a"], vendorIds:["vendor-a","vendor-b"], updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        bomLines: [
          { id:"bom-cross-part", componentId:"component-a", materialId:"material-a", partId:"part-b", quantityPerPart:1, updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        purchaseOrders: [
          { id:"po-a", companyId:"company-a", factoryId:"factory-a", lines:[{id:"line-a",componentId:"component-a",quantity:10}], updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"po-b", companyId:"company-b", factoryId:"factory-b", lines:[{id:"line-b",componentId:"component-b",quantity:20}], updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        operations: [
          { id:"operation-a", poId:"po-a", poLineId:"line-a", componentId:"component-a", vendorId:"vendor-a", processDefinitionId:"process-a", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"operation-a-cross-vendor", poId:"po-a", poLineId:"line-a", componentId:"component-a", vendorId:"vendor-b", processDefinitionId:"process-a", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"operation-b", poId:"po-b", poLineId:"line-b", componentId:"component-b", vendorId:"vendor-b", processDefinitionId:"process-b", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        vendors: [
          { id:"vendor-a", company:"A subcontractor", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"vendor-b", company:"B subcontractor", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"vendor-ap-only", company:"AP-only supplier", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        supplierInvoices: [
          { id:"ap-only-invoice", companyId:"company-a", factoryId:"factory-a", vendorId:"vendor-ap-only", invoiceNumber:"AP-ONLY-001", invoiceDate:"2026-11-20", dueDate:"2026-12-20", currency:"INR", subtotal:100, taxAmount:18, totalAmount:118, status:"Draft", notes:"", createdBy:"tenant-admin", createdAt:"2026-11-20T05:00:00.000Z", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        processDefinitions: [
          { id:"process-a", processType:"Machining", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"process-b", processType:"Grinding", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        quotations: [
          { id:"cross-tenant-quote-hidden", poId:"po-a", poLineId:"line-a", componentId:"component-a", operationId:"operation-b", vendorId:"vendor-b", ratePerPart:999, updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        transportLegs: [
          { id:"cross-tenant-leg-hidden", poId:"po-a", poLineId:"line-a", componentId:"component-a", anchorOperationId:"operation-b", targetOperationId:"operation-a", routeId:"route-b", vendorId:"vendor-b", tripCount:1, updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        paymentTransactions: [
          { id:"cross-tenant-payment-hidden", poId:"po-a", poLineId:"line-a", componentId:"component-a", operationId:"operation-b", vendorId:"vendor-b", amount:999999, updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        inspectionMeasurements: [
          { id:"cross-tenant-inspection-hidden", poId:"po-a", poLineId:"line-a", componentId:"component-a", operationId:"operation-b", characteristic:"Secret", measuredValue:999, result:"Fail", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        plannedCosts: [
          { id:"cross-tenant-plan-hidden", companyId:"company-a", poId:"po-b", componentId:"component-b", processDefinitionId:"process-b", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        materialCostEntries: [
          { id:"cross-tenant-material-hidden", companyId:"company-a", poId:"po-b", componentId:"component-b", materialId:"material-b", updatedAt:"2026-11-20T05:00:00.000Z" },
          { id:"cross-tenant-anchor-cost-hidden", companyId:"company-a", poId:"po-a", poLineId:"line-a", componentId:"component-a", anchorOperationId:"operation-b", materialId:"material-a", vendorId:"vendor-b", updatedAt:"2026-11-20T05:00:00.000Z" }
        ],
        inventoryTransactions: [
          { id:"cross-tenant-stock-hidden", companyId:"company-a", factoryId:"factory-b", itemType:"component", itemId:"component-b", transactionType:"Receipt", direction:"in", quantity:1, updatedAt:"2026-11-20T05:00:00.000Z" }
        ]
      } })
    });
    assert.equal(seed.status,200);

    assert.equal((await fetch(baseUrl + "/api/audit-events", { headers: adminHeaders })).status, 200, "administrators can read the shared audit trail");
    const companyHeaders = await login("companya","AXIMACH-companya-Password!");
    assert.equal((await fetch(baseUrl + "/api/audit-events", { headers: companyHeaders })).status, 403, "scoped operators cannot read the global audit trail");
    const deniedAudit = await fetch(baseUrl + "/api/audit-events", { headers: adminHeaders });
    const deniedAuditEvents = (await deniedAudit.json()).events;
    assert.equal(deniedAuditEvents.some(event => event.action === "authorization.denied" && event.actorUsername === "companya" && event.requiredPermission === "audit:read"), true, "failed audit access is itself recorded for administrators");
    const response = await fetch(baseUrl + "/api/manufacturing-data", { headers: companyHeaders });
    assert.equal(response.status,200);
    const scoped = (await response.json()).data;
    assert.deepEqual(scoped.companies.map(row=>row.id),["company-a"]);
    assert.deepEqual(scoped.factories.map(row=>row.id),["factory-a"]);
    assert.deepEqual(scoped.purchaseOrders.map(row=>row.id),["po-a"]);
    assert.deepEqual(scoped.components.map(row=>row.id),["component-a"]);
    assert.deepEqual(scoped.operations.map(row=>row.id),["operation-a"]);
    assert.equal(scoped.vendors.some(row=>row.id==="vendor-b"),false,"vendor referenced across companies is not exposed through a forged operation link");
    assert.deepEqual(scoped.componentParts,[],"component parts referencing an out-of-scope vendor are excluded");
    assert.deepEqual(scoped.bomLines,[],"BOM lines referencing an out-of-scope component part are excluded");
    assert.equal(scoped.materials[0]?.preferredVendorId,"","foreign preferred-vendor identifiers are removed from material master records");
    assert.deepEqual(scoped.vendors.map(row=>row.id),["vendor-a","vendor-ap-only"],"supplier is visible through its AP invoice even without any operation/transport reference");
    assert.deepEqual(scoped.supplierInvoices.map(row=>row.id),["ap-only-invoice"],"tenant-scoped AP invoice remains visible with its supplier master");
    assert.deepEqual(scoped.processDefinitions.map(row=>row.id),["process-a"]);
    assert.deepEqual(scoped.plannedCosts,[],"tenant scope excludes a company-tagged cost row linked to a foreign PO/component/process");
    assert.deepEqual(scoped.materialCostEntries,[],"tenant scope excludes material costing linked to a foreign PO/component");
    assert.deepEqual(scoped.inventoryTransactions,[],"tenant scope excludes stock records for another factory");
    assert.deepEqual(scoped.quotations,[],"quotes linked to a foreign operation are not exposed even when PO identifiers are forged");
    assert.deepEqual(scoped.transportLegs,[],"transport legs with foreign anchor/target operations are not exposed");
    assert.deepEqual(scoped.paymentTransactions,[],"payments with foreign operation references are not exposed");
    assert.deepEqual(scoped.inspectionMeasurements,[],"inspections with foreign operation references are not exposed");

    const foreignWrite = await fetch(baseUrl + "/api/manufacturing-data", {
      method:"PUT", headers:companyHeaders,
      body:JSON.stringify({data:{purchaseOrders:[{id:"po-b",companyId:"company-b",factoryId:"factory-b",lines:[{id:"line-b",componentId:"component-b",quantity:999}]}]}})
    });
    assert.equal(foreignWrite.status,403,"cross-company PO update must be blocked");

    const foreignVendorLink = await fetch(baseUrl + "/api/manufacturing-data", {
      method:"PUT", headers:companyHeaders,
      body:JSON.stringify({data:{operations:[{id:"operation-a",poId:"po-a",poLineId:"line-a",componentId:"component-a",vendorId:"vendor-b",processDefinitionId:"process-a"}]}})
    });
    assert.equal(foreignVendorLink.status,403,"a scoped operation cannot be linked to a vendor visible only through another company's PO");

    const foreignComponentPo = await fetch(baseUrl + "/api/manufacturing-data", {
      method:"PUT", headers:companyHeaders,
      body:JSON.stringify({data:{purchaseOrders:[{id:"new-cross-tenant-po",companyId:"company-a",factoryId:"factory-a",lines:[{id:"cross-tenant-line",componentId:"component-b",quantity:5}]}]}})
    });
    assert.equal(foreignComponentPo.status,403,"an assigned-company PO cannot reference another company's component");

    const crossTenantPlan = await fetch(baseUrl + "/api/manufacturing-data", {
      method:"PUT", headers:companyHeaders,
      body:JSON.stringify({data:{plannedCosts:[{id:"cross-tenant-cost",companyId:"company-a",poId:"po-b",componentId:"component-b",plannedQty:1,plannedRate:1}]}})
    });
    assert.equal(crossTenantPlan.status,403,"a company-owned cost row cannot reference a foreign PO or component");

    const factoryHeaders = await login("factorya","AXIMACH-factorya-Password!");
    const factoryRead = await fetch(baseUrl + "/api/manufacturing-data", {headers:factoryHeaders});
    assert.equal(factoryRead.status,200);
    assert.deepEqual((await factoryRead.json()).data.purchaseOrders.map(row=>row.id),["po-a"],"factory-only assignment resolves only its parent company and factory's POs");

    const validWrite = await fetch(baseUrl + "/api/manufacturing-data", {
      method:"PUT", headers:companyHeaders,
      body:JSON.stringify({data:{components:[{id:"component-a",companyId:"company-a",name:"Component A updated",updatedAt:"2026-11-20T06:00:00.000Z"}]}})
    });
    assert.equal(validWrite.status,200,"assigned-company component edits remain available");
    const apStamp = "2026-11-20T07:00:00.000Z";
    const invoice = {
      id:"ap-invoice-a",companyId:"company-a",factoryId:"factory-a",vendorId:"vendor-a",
      poId:"po-a",poLineId:"line-a",invoiceNumber:"SUP-2026-001",invoiceDate:"2026-11-20",dueDate:"2026-12-20",
      currency:"INR",subtotal:100,taxAmount:18,totalAmount:118,status:"Submitted",notes:"First supplier invoice",
      createdBy:"client-supplied-creator",createdAt:apStamp,updatedAt:apStamp
    };
    const createdInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierInvoices:[invoice]}})
    });
    assert.equal(createdInvoice.status,200,"scoped supplier invoice can be created and submitted");
    const storedInvoice=(await createdInvoice.json()).data.supplierInvoices.find(row=>row.id===invoice.id);
    assert.equal(storedInvoice.createdBy,"tenant-a-user","server, not client payload, sets the invoice creator");

    const duplicateInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,
      body:JSON.stringify({data:{supplierInvoices:[{...invoice,id:"ap-invoice-duplicate",createdAt:apStamp,updatedAt:apStamp}]}})
    });
    assert.equal(duplicateInvoice.status,403,"duplicate supplier invoice number for the same company/vendor is rejected");

    const operatorApproval=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-operator-approval",targetType:"invoice",targetId:invoice.id,decision:"Approved",
        decidedBy:"forged-actor",decidedByRole:"admin",comments:"Operator attempt",decidedAt:apStamp,createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(operatorApproval.status,403,"operator cannot approve supplier invoices");

    const managerHeaders=await login("managera","AXIMACH-managera-Password!");
    const managerApproval=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-manager-approval",targetType:"invoice",targetId:invoice.id,decision:"Approved",
        decidedBy:"forged-actor",decidedByRole:"admin",comments:"Checked against PO and supplier invoice",decidedAt:apStamp,createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(managerApproval.status,200,"a different scoped manager can approve the invoice");
    const savedApproval=(await managerApproval.json()).data.supplierFinanceApprovals.find(row=>row.id==="ap-manager-approval");
    assert.equal(savedApproval.decidedBy,"tenant-a-manager","server stamps the authenticated approver");
    assert.equal(savedApproval.decidedByRole,"manager","client cannot forge administrator approval");

    const managerSnapshotResponse=await fetch(baseUrl+"/api/manufacturing-data",{headers:managerHeaders});
    assert.equal(managerSnapshotResponse.status,200);
    const managerSnapshot=(await managerSnapshotResponse.json()).data;
    const repeatSync=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,body:JSON.stringify({data:managerSnapshot})
    });
    assert.equal(repeatSync.status,200,"a full scoped-device sync must preserve existing AP approvals and unchanged shared masters");

    const editApprovedInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,
      body:JSON.stringify({data:{supplierInvoices:[{...storedInvoice,totalAmount:200,updatedAt:"2026-11-20T08:00:00.000Z"}]}})
    });
    assert.equal(editApprovedInvoice.status,403,"an approved supplier invoice is immutable");

    const selfInvoice={...invoice,id:"ap-self-invoice",invoiceNumber:"SUP-2026-SELF",createdBy:"client",createdAt:apStamp,updatedAt:apStamp};
    const managerCreatedInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,body:JSON.stringify({data:{supplierInvoices:[selfInvoice]}})
    });
    assert.equal(managerCreatedInvoice.status,200);
    const managerStoredInvoice=(await managerCreatedInvoice.json()).data.supplierInvoices.find(row=>row.id===selfInvoice.id);
    assert.equal(managerStoredInvoice.createdBy,"tenant-a-manager");
    const selfApproval=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-self-approval",targetType:"invoice",targetId:selfInvoice.id,decision:"Approved",
        comments:"Self approval attempt",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(selfApproval.status,403,"invoice creator cannot approve their own invoice");

    const returnedInvoice={...invoice,id:"ap-return-invoice",invoiceNumber:"SUP-2026-RETURN",createdAt:apStamp,updatedAt:apStamp};
    const createReturnedInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierInvoices:[returnedInvoice]}})
    });
    assert.equal(createReturnedInvoice.status,200);
    const returnDecision=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-return-decision",targetType:"invoice",targetId:returnedInvoice.id,decision:"Returned",
        comments:"Please correct tax reference",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(returnDecision.status,200,"manager can return an invoice for correction");
    const revisedInvoice={...returnedInvoice,status:"Submitted",subtotal:110,taxAmount:19.8,totalAmount:129.8,updatedAt:"2026-11-20T09:30:00.000Z"};
    const resubmitInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierInvoices:[revisedInvoice]}})
    });
    assert.equal(resubmitInvoice.status,200,"creator can submit a corrected invoice revision");
    const approveRevisedInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-return-decision-2",targetType:"invoice",targetId:returnedInvoice.id,decision:"Approved",
        comments:"Corrected invoice checked",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(approveRevisedInvoice.status,200,"a revised invoice can receive a new approval without deleting its earlier returned decision");

    const supplierPayment={
      id:"ap-payment-a",companyId:"company-a",factoryId:"factory-a",vendorId:"vendor-a",
      paymentDate:"2026-11-21",method:"Bank transfer",bankReference:"UTR-AX-001",amount:80,currency:"INR",
      status:"Submitted",notes:"Part payment",createdBy:"client",createdAt:apStamp,updatedAt:apStamp
    };
    const createPayment=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierPayments:[supplierPayment]}})
    });
    assert.equal(createPayment.status,200,"supplier payment can be entered separately from process-operation payments");
    const duplicateBankReference=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,
      body:JSON.stringify({data:{supplierPayments:[{...supplierPayment,id:"ap-payment-duplicate",createdAt:apStamp,updatedAt:apStamp}]}})
    });
    assert.equal(duplicateBankReference.status,403,"supplier payment bank references cannot be duplicated for the same company and vendor");
    const paymentApproval=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-payment-approval",targetType:"payment",targetId:supplierPayment.id,decision:"Approved",
        comments:"Payment details verified",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(paymentApproval.status,200,"manager can approve a submitted supplier payment");

    const allocation={id:"ap-payment-allocation-a",paymentId:supplierPayment.id,invoiceId:invoice.id,amount:80,notes:"Partial settlement",createdBy:"tenant-a-user",createdAt:apStamp,updatedAt:apStamp};
    const allocate=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierPaymentAllocations:[allocation]}})
    });
    assert.equal(allocate.status,200,"approved supplier payment can be allocated to the matching approved invoice");
    const apAuditResponse=await fetch(baseUrl+"/api/audit-events",{headers:adminHeaders});
    assert.equal(apAuditResponse.status,200);
    const apAuditEvents=(await apAuditResponse.json()).events;
    for (const action of ["supplier-invoice.created","supplier-payment.created","supplier-finance.approval","supplier-payment.allocated"]) {
      assert.equal(apAuditEvents.some(event=>event.action===action),true,"administrator audit trail captures "+action);
    }
    const apAuditJson=JSON.stringify(apAuditEvents.filter(event=>event.action.startsWith("supplier-")));
    for (const secret of ["SUP-2026-001","UTR-AX-001","Checked against PO and supplier invoice"]) {
      assert.equal(apAuditJson.includes(secret),false,"AP audit events do not expose invoice numbers, bank references or reviewer comments");
    }
    assert.equal(apAuditEvents.some(event=>event.action.startsWith("supplier-")&&Object.hasOwn(event,"amount")),false,"AP audit events do not expose financial amounts");

    const secondPayment={...supplierPayment,id:"ap-payment-b",bankReference:"UTR-AX-002",amount:50,createdAt:apStamp,updatedAt:apStamp};
    const createSecondPayment=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierPayments:[secondPayment]}})
    });
    assert.equal(createSecondPayment.status,200);
    const approveSecondPayment=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-payment-approval-b",targetType:"payment",targetId:secondPayment.id,decision:"Approved",
        comments:"Second payment verified",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(approveSecondPayment.status,200);
    const overAllocateInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,
      body:JSON.stringify({data:{supplierPaymentAllocations:[{
        id:"ap-over-invoice",paymentId:secondPayment.id,invoiceId:invoice.id,amount:50,
        notes:"Would exceed invoice balance",createdBy:"tenant-a-user",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(overAllocateInvoice.status,403,"invoice allocations cannot exceed the remaining invoice balance");

    const secondInvoice={...invoice,id:"ap-invoice-b",invoiceNumber:"SUP-2026-002",totalAmount:90,subtotal:90,taxAmount:0,createdAt:apStamp,updatedAt:apStamp};
    const createSecondInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,body:JSON.stringify({data:{supplierInvoices:[secondInvoice]}})
    });
    assert.equal(createSecondInvoice.status,200);
    const approveSecondInvoice=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:managerHeaders,
      body:JSON.stringify({data:{supplierFinanceApprovals:[{
        id:"ap-invoice-approval-b",targetType:"invoice",targetId:secondInvoice.id,decision:"Approved",
        comments:"Second invoice verified",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(approveSecondInvoice.status,200);
    const overAllocatePayment=await fetch(baseUrl+"/api/manufacturing-data",{
      method:"PUT",headers:companyHeaders,
      body:JSON.stringify({data:{supplierPaymentAllocations:[{
        id:"ap-over-payment",paymentId:supplierPayment.id,invoiceId:secondInvoice.id,amount:1,
        notes:"Would exceed payment value",createdBy:"tenant-a-user",createdAt:apStamp,updatedAt:apStamp
      }]}})
    });
    assert.equal(overAllocatePayment.status,403,"allocations cannot exceed the remaining payment amount");


    const viewerHeaders = await login("viewera","AXIMACH-viewera-Password!");
    const viewerWrite = await fetch(baseUrl + "/api/manufacturing-data", {
      method:"PUT", headers:viewerHeaders,
      body:JSON.stringify({data:{components:[{id:"component-a",companyId:"company-a",name:"Viewer overwrite"}]}})
    });
    assert.equal(viewerWrite.status,403,"read-only role cannot write scoped company records");

    const unassignedHeaders = await login("unassigned","AXIMACH-unassigned-Password!");
    const unassignedRead = await fetch(baseUrl + "/api/manufacturing-data", {headers:unassignedHeaders});
    assert.equal(unassignedRead.status,403,"unassigned users cannot access manufacturing records");
    const genericRecords = await fetch(baseUrl + "/api/records", {headers:companyHeaders});
    assert.equal(genericRecords.status,403,"generic legacy module records remain admin-only until ownership is modeled");
  } finally {
    await stopServer(child);
    await rm(folder,{recursive:true,force:true});
  }
});

test("server audit trail records durable mutation metadata without copying sensitive contact or message content", { timeout: 20000 }, async () => {
  const folder = await mkdtemp(join(tmpdir(), "aximach-audit-trail-"));
  const dataFile = join(folder, "aximach.json");
  const port = await freePort();
  const baseUrl = "http://127.0.0.1:" + port;
  const headers = { "content-type": "application/json", "x-aximach-key": apiKey };
  let child;

  try {
    child = startServer(port, dataFile);
    await waitForHealth(child, baseUrl);

    assert.equal((await fetch(baseUrl + "/api/audit-events")).status, 401, "audit history must require authentication");
    const write = await fetch(baseUrl + "/api/manufacturing-data", {
      method: "PUT",
      headers,
      body: JSON.stringify({ data: {
        companies: [{ id: "audit-company-1", name: "Confidential Company Name", updatedAt: "2026-11-21T07:00:00.000Z" }]
      } })
    });
    assert.equal(write.status, 200);

    const contact = await fetch(baseUrl + "/api/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Confidential Contact Name", phone: "919876543210", company: "Confidential Company Name", optedIn: true })
    });
    assert.equal(contact.status, 201);

    const schedule = await fetch(baseUrl + "/api/schedules", {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: "919876543210",
        message: "Confidential approved message body",
        nextRunAt: new Date(Date.now() + 86400000).toISOString(),
        repeat: "once",
        operationId: "audit-operation-1"
      })
    });
    assert.equal(schedule.status, 201);

    const beforeRestoreResponse = await fetch(baseUrl + "/api/audit-events", { headers });
    assert.equal(beforeRestoreResponse.status, 200);
    const beforeRestore = await beforeRestoreResponse.json();
    assert.equal(beforeRestore.retentionLimit, 10000);
    assert.deepEqual(beforeRestore.events.map(event => event.action), [
      "manufacturing-data.sync",
      "whatsapp-contact.create",
      "whatsapp-schedule.create"
    ]);
    const serialized = JSON.stringify(beforeRestore.events);
    for (const secret of ["Confidential Company Name", "Confidential Contact Name", "919876543210", "Confidential approved message body"]) {
      assert.equal(serialized.includes(secret), false, "audit metadata must not copy sensitive payload value: " + secret);
    }
    assert.equal(beforeRestore.events[0].actorUsername, "legacy-api-key");
    assert.deepEqual(beforeRestore.events[0].collectionCounts, { companies: 1 });
    assert.equal(beforeRestore.events[1].optedIn, true);
    assert.equal(beforeRestore.events[2].operationId, "audit-operation-1");

    const backupResponse = await fetch(baseUrl + "/api/backup", { headers });
    assert.equal(backupResponse.status, 200);
    const backup = await backupResponse.json();
    assert.equal(Array.isArray(backup.data.auditEvents), true, "full backup must include the audit history");

    const restored = await fetch(baseUrl + "/api/restore", {
      method: "POST",
      headers,
      body: JSON.stringify({ backup, confirmation: "RESTORE_AXIMACH_BACKUP" })
    });
    assert.equal(restored.status, 200);
    const afterRestoreResponse = await fetch(baseUrl + "/api/audit-events", { headers });
    const afterRestore = await afterRestoreResponse.json();
    assert.equal(afterRestore.events.length, 4);
    assert.equal(afterRestore.events.at(-1).action, "backup.restore");
    assert.equal(afterRestore.events.filter(event => event.action === "manufacturing-data.sync").length, 1);

    await stopServer(child);
    child = undefined;

    child = startServer(port, dataFile);
    await waitForHealth(child, baseUrl);
    const afterRestart = await fetch(baseUrl + "/api/audit-events", { headers });
    assert.equal(afterRestart.status, 200);
    const persisted = await afterRestart.json();
    assert.equal(persisted.events.length, 4, "audit history must persist across server restart");
    assert.deepEqual(persisted.events.map(event => event.action), [
      "manufacturing-data.sync",
      "whatsapp-contact.create",
      "whatsapp-schedule.create",
      "backup.restore"
    ]);
  } finally {
    await stopServer(child);
    await rm(folder, { recursive: true, force: true });
  }
});

