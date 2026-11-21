import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { networkInterfaces } from "node:os";
import { manufacturingCollections, mergeManufacturingData } from "./manufacturing-data.mjs";
import { bearerToken, createAuthService, getRequiredPermission, hasPermission } from "./auth.mjs";
import { filterManufacturingData, filterModuleRecords, hasTenantScope, validateManufacturingWrite } from "./tenant-scope.mjs";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.AXIMACH_API_KEY || "";
const authService = createAuthService(process.env.AXIMACH_AUTH_USERS, { sessionTtlMs: Number(process.env.AXIMACH_SESSION_TTL_MS || 12 * 60 * 60 * 1000) });
const DB_PATH = resolve(process.env.AXIMACH_DATA_FILE || "./data/aximach.json");
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
const AUDIT_RETENTION_LIMIT = 10000;
let db = { contacts: [], schedules: [], logs: [], auditEvents: [], records: {}, manufacturingData: null, uiPreferences: null, restoreGeneration: 0 };
let busy = false;
let saveQueue = Promise.resolve();
let restoreInProgress = false;

async function loadDb() {
  try { db = { ...db, ...JSON.parse(await readFile(DB_PATH, "utf8")) }; }
  catch (error) { if (error.code !== "ENOENT") console.error("Could not load data store:", error.message); }
  if (!Array.isArray(db.auditEvents)) db.auditEvents = [];
}
async function writeSnapshot(filePath, snapshot) {
  await mkdir(dirname(filePath), { recursive: true });
  const temp = filePath + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temp, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: "wx" });
    await rename(temp, filePath);
  } catch (error) {
    try { await unlink(temp); } catch { /* temp may not have been created */ }
    throw error;
  }
}
function saveDb() {
  const persist = () => writeSnapshot(DB_PATH, db);
  // Serialize writes so overlapping API requests cannot race on one temp file
  // or let an older snapshot replace a newer complete data store.
  const next = saveQueue.then(persist, persist);
  saveQueue = next.catch(() => {});
  return next;
}
function validBackupData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (!Array.isArray(data.contacts) || !Array.isArray(data.schedules) || !Array.isArray(data.logs)) return false;
  if (!data.records || typeof data.records !== "object" || Array.isArray(data.records)) return false;
  if (data.uiPreferences != null && (typeof data.uiPreferences !== "object" || Array.isArray(data.uiPreferences))) return false;
  if (data.auditEvents !== undefined && !Array.isArray(data.auditEvents)) return false;
  if (data.manufacturingData != null) {
    if (typeof data.manufacturingData !== "object" || Array.isArray(data.manufacturingData)) return false;
    for (const collection of manufacturingCollections) {
      if (data.manufacturingData[collection] !== undefined && !Array.isArray(data.manufacturingData[collection])) return false;
    }
  }
  return Object.values(data.records).every(value => Array.isArray(value));
}
const allowedOrigins = new Set([
  "http://localhost:5173", "http://localhost", "https://localhost", "capacitor://localhost",
  ...String(process.env.AXIMACH_ALLOWED_ORIGINS || process.env.AXIMACH_ALLOWED_ORIGIN || "")
    .split(",").map(origin => origin.trim()).filter(Boolean)
]);
function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  res.setHeader("vary", "Origin");
  if (origin && allowedOrigins.has(origin)) res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-headers", "content-type,x-aximach-key,authorization");
  res.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
}
function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
function mergeAuditEvents(...groups) {
  const unique = new Map();
  for (const group of groups) {
    for (const event of Array.isArray(group) ? group : []) {
      if (event && typeof event.id === "string" && event.id) unique.set(event.id, event);
    }
  }
  return [...unique.values()]
    .sort((left, right) => (Date.parse(left.occurredAt || "") || 0) - (Date.parse(right.occurredAt || "") || 0))
    .slice(-AUDIT_RETENTION_LIMIT);
}
function appendAuditEvent(req, principal, action, details = {}) {
  const event = {
    id: randomUUID(),
    occurredAt: new Date().toISOString(),
    actorId: String(principal?.id || "system:scheduler"),
    actorUsername: String(principal?.username || "scheduler"),
    actorRole: String(principal?.role || "system"),
    method: String(req?.method || "SYSTEM"),
    path: new URL(req?.url || "/scheduler", "http://localhost").pathname,
    action,
    ...details
  };
  db.auditEvents = [...(Array.isArray(db.auditEvents) ? db.auditEvents : []), event].slice(-AUDIT_RETENTION_LIMIT);
  return event;
}
function auditCollectionCounts(payload, allowedCollections) {
  const counts = {};
  let recordCount = 0;
  for (const collection of allowedCollections) {
    const value = payload?.[collection];
    if (!Array.isArray(value) || value.length === 0) continue;
    counts[collection] = value.length;
    recordCount += value.length;
  }
  return { collectionCounts: counts, recordCount };
}
async function body(req, maxBytes = 8_500_000) {
  let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > maxBytes) throw new Error("Request too large"); }
  return raw ? JSON.parse(raw) : {};
}
function authorized(req) {
  if (!API_KEY) return false;
  const provided = Buffer.from(String(req.headers["x-aximach-key"] || ""), "utf8");
  const expected = Buffer.from(API_KEY, "utf8");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}
function principalFromRequest(req) {
  if (authService) { const token = bearerToken(req); const session = authService.authenticate(token); return session ? { ...session.user, sessionExpiresAt: session.expiresAt } : null; }
  return authorized(req) ? { id: "legacy-api-key", username: "legacy-api-key", role: "admin", legacy: true } : null;
}
function isLoopbackAddress(value) {
  const address = String(value || "").replace(/^::ffff:/, "");
  return address === "127.0.0.1" || address === "::1";
}
function privateLanAddresses() {
  const found = new Set();
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      const ip = entry.address;
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(ip)) found.add(ip);
    }
  }
  return [...found].sort();
}

function normalisePhone(phone) { return String(phone || "").replace(/\D/g, ""); }
function mergeModuleRecords(existing, incoming) {
  const left = existing && typeof existing === "object" ? existing : {};
  const right = incoming && typeof incoming === "object" ? incoming : {};
  const merged = {};
  for (const moduleId of new Set([...Object.keys(left), ...Object.keys(right)])) {
    const rows = new Map();
    for (const row of Array.isArray(left[moduleId]) ? left[moduleId] : []) if (row?.id) rows.set(row.id, row);
    for (const row of Array.isArray(right[moduleId]) ? right[moduleId] : []) {
      if (!row?.id) continue;
      const old = rows.get(row.id);
      if (!old || (Date.parse(row.updatedAt || "") || 0) >= (Date.parse(old.updatedAt || "") || 0)) rows.set(row.id, row);
    }
    merged[moduleId] = [...rows.values()];
  }
  return merged;
}
async function sendWhatsApp(to, message) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error("WhatsApp Cloud API credentials are not configured.");
  if (!to || !message) throw new Error("Recipient and message are required.");
  const response = await fetch("https://graph.facebook.com/" + GRAPH_VERSION + "/" + phoneId + "/messages", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: normalisePhone(to), type: "text", text: { preview_url: false, body: message } })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "WhatsApp send failed with HTTP " + response.status);
  return result;
}
async function tick() {
  if (busy || restoreInProgress) return; busy = true;
  try {
    const now = Date.now();
    for (const task of db.schedules) {
      if (!task.enabled || task.nextRunAt == null || Date.parse(task.nextRunAt) > now) continue;
      try {
        const result = await sendWhatsApp(task.to, task.message);
        db.logs.unshift({ id: randomUUID(), scheduleId: task.id, at: new Date().toISOString(), status: "sent", providerMessageId: result.messages?.[0]?.id || "", detail: "Accepted by WhatsApp Cloud API" });
        appendAuditEvent(null, null, "whatsapp-schedule.sent", { targetId: task.id, providerAccepted: true });
        task.lastRunAt = new Date().toISOString();
        if (task.repeat === "daily" || task.repeat === "weekly") { const period = task.repeat === "daily" ? 86400000 : 604800000; let next = Date.parse(task.nextRunAt) + period; while (next <= Date.now()) next += period; task.nextRunAt = new Date(next).toISOString(); }
        else { task.enabled = false; task.nextRunAt = null; }
      } catch (error) {
        db.logs.unshift({ id: randomUUID(), scheduleId: task.id, at: new Date().toISOString(), status: "failed", detail: error.message });
        appendAuditEvent(null, null, "whatsapp-schedule.failed", { targetId: task.id });
        task.lastError = error.message;
        // Prevent a rapid retry loop. A failed task is paused for operator review.
        task.enabled = false;
      }
      await saveDb();
    }
    db.logs = db.logs.slice(0, 2000);
  } finally { busy = false; }
}
const server = createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-max-age": "86400" }); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "AXIMACH shared-data and scheduler server", credentialsConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), storage: "local-file", authMode: authService ? "users" : "api-key" });
  if (url.pathname === "/api/connection-info" && req.method === "GET") {
    if (!isLoopbackAddress(req.socket.remoteAddress)) return json(res, 403, { error: "Connection information is available only to the AXIMACH PC itself." });
    return json(res, 200, {
      service: "AXIMACH local shared-data server",
      port: PORT,
      ...(authService ? { authMode: "users" } : { apiKey: API_KEY, note: "Connect other AXIMACH devices to the same Wi-Fi and use one of these private LAN addresses with this API key." }),
      addresses: privateLanAddresses().map(ip => "http://" + ip + ":" + PORT)
    });
  }
  if (url.pathname.startsWith("/api/auth/")) {
    if (!authService) return json(res, 404, { error: "User authentication is not configured on this server." });
    try {
      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        const input = await body(req, 64_000);
        const result = await authService.login(input.username, input.password, req.socket.remoteAddress);
        if (!result.ok) {
          appendAuditEvent(req, { id: "anonymous", username: "unauthenticated", role: "unauthenticated" }, "auth.login.rejected", { rateLimited: Boolean(result.rateLimited) });
          await saveDb();
          return json(res, result.rateLimited ? 429 : 401, { error: result.rateLimited ? "Too many sign-in attempts. Try again in 15 minutes." : "Invalid username or password." });
        }
        appendAuditEvent(req, result.user, "auth.login.success", { expiresAt: result.expiresAt });
        await saveDb();
        return json(res, 200, result);
      }
      if (url.pathname === "/api/auth/session" && req.method === "GET") {
        const principal = principalFromRequest(req);
        if (!principal) return json(res, 401, { error: "A valid user session is required." });
        return json(res, 200, { user: { id: principal.id, username: principal.username, role: principal.role }, expiresAt: principal.sessionExpiresAt });
      }
      if (url.pathname === "/api/auth/logout" && req.method === "POST") {
        const token = bearerToken(req);
        const principal = principalFromRequest(req);
        if (!principal) return json(res, 401, { error: "A valid user session is required." });
        authService.logout(token);
        appendAuditEvent(req, principal, "auth.logout");
        await saveDb();
        return json(res, 200, { ok: true });
      }
      return json(res, 404, { error: "Authentication route not found." });
    } catch (error) { return json(res, 400, { error: error.message || "Authentication request failed." }); }
  }
  const principal = principalFromRequest(req);
  if (!principal) return json(res, 401, { error: "User session or valid AXIMACH API credentials are required." });
  const requiredPermission = getRequiredPermission(url.pathname, req.method);
  if (requiredPermission && !hasPermission(principal, requiredPermission)) {
    appendAuditEvent(req, principal, "authorization.denied", { requiredPermission });
    await saveDb();
    return json(res, 403, { error: "Your account role does not permit this action." });
  }
  if (!principal.legacy && principal.role !== "admin" && ["data:read","data:write"].includes(requiredPermission) && !hasTenantScope(principal)) {
    appendAuditEvent(req, principal, "authorization.denied", { requiredPermission, reason: "missing-company-or-factory-scope" });
    await saveDb();
    return json(res, 403, { error: "Assign at least one company or factory to this account before accessing manufacturing data." });
  }
  if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry after it completes." });
  try {
    if (url.pathname === "/api/backup" && req.method === "GET") {
      const snapshot = JSON.parse(JSON.stringify(db));
      const serialized = JSON.stringify(snapshot);
      return json(res, 200, {
        format: "aximach-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        sha256: createHash("sha256").update(serialized).digest("hex"),
        data: snapshot
      });
    }
    if (url.pathname === "/api/restore" && req.method === "POST") {
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req, 20_000_000);
      if (restoreInProgress) return json(res, 503, { error: "Another restore is already in progress; retry after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying." });
      const backup = input.backup;
      if (input.confirmation !== "RESTORE_AXIMACH_BACKUP") {
        return json(res, 400, { error: "Explicit restore confirmation is required." });
      }
      if (!backup || backup.format !== "aximach-backup" || backup.version !== 1 || !validBackupData(backup.data)) {
        return json(res, 400, { error: "Unsupported or invalid AXIMACH backup format." });
      }
      const serialized = JSON.stringify(backup.data);
      const digest = createHash("sha256").update(serialized).digest("hex");
      const suppliedDigest = String(backup.sha256 || "");
      const digestBytes = Buffer.from(digest, "hex");
      const suppliedBytes = Buffer.from(suppliedDigest, "hex");
      if (suppliedBytes.length !== digestBytes.length || !timingSafeEqual(digestBytes, suppliedBytes)) {
        return json(res, 400, { error: "Backup integrity check failed; the current data was not changed." });
      }
      if (busy) return json(res, 503, { error: "The scheduler is processing a task; retry restore after that task completes." });
      if (restoreInProgress) return json(res, 503, { error: "Another restore is already in progress; retry after it completes." });
      restoreInProgress = true;
      const previous = db;
      try {
        await saveQueue;
        const preRestorePath = DB_PATH + ".pre-restore-" + Date.now() + "-" + randomUUID() + ".json";
        await writeSnapshot(preRestorePath, previous);
        db = {
          contacts: backup.data.contacts,
          schedules: backup.data.schedules,
          logs: backup.data.logs,
          records: backup.data.records,
          recordsUpdatedAt: backup.data.recordsUpdatedAt || null,
          manufacturingData: backup.data.manufacturingData || null,
          uiPreferences: backup.data.uiPreferences || null,
          auditEvents: mergeAuditEvents(previous.auditEvents, backup.data.auditEvents),
          restoreGeneration: Number(previous.restoreGeneration || 0) + 1
        };
        appendAuditEvent(req, principal, "backup.restore", { restoreGeneration: db.restoreGeneration });
        try {
          await saveDb();
        } catch (error) {
          db = previous;
          throw error;
        }
        return json(res, 200, {
          ok: true,
          restoredAt: new Date().toISOString(),
          preRestoreBackup: preRestorePath.split(/[\\/]/).at(-1),
          restoreGeneration: db.restoreGeneration
        });
      } finally {
        restoreInProgress = false;
      }
    }
    if (url.pathname === "/api/manufacturing-data" && req.method === "GET") {
      const data = principal.legacy || principal.role === "admin" ? (db.manufacturingData || null) : filterManufacturingData(db.manufacturingData || {}, principal);
      return json(res, 200, { data, updatedAt: db.manufacturingData?.updatedAt || null, restoreGeneration: Number(db.restoreGeneration || 0) });
    }
    if (url.pathname === "/api/manufacturing-data" && req.method === "PUT") {
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req);
      if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry this write after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying.", restoreGeneration: Number(db.restoreGeneration || 0) });
      const currentGeneration = Number(db.restoreGeneration || 0);
      if ((currentGeneration > 0 || input.restoreGeneration !== undefined) && (!Number.isSafeInteger(input.restoreGeneration) || input.restoreGeneration !== currentGeneration)) {
        return json(res, 409, { error: "The server was restored since this device last synced. Refresh shared data before writing.", restoreGeneration: currentGeneration });
      }
      if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) return json(res, 400, { error: "data must be an AXIMACH manufacturing data object." });
      for (const collection of manufacturingCollections) if (input.data[collection] !== undefined && !Array.isArray(input.data[collection])) return json(res, 400, { error: collection + " must be an array." });
      const currentManufacturing = db.manufacturingData || {};
      const currentInvoices = new Map((currentManufacturing.supplierInvoices || []).filter(row=>row?.id).map(row=>[row.id,row]));
      const currentSupplierPayments = new Map((currentManufacturing.supplierPayments || []).filter(row=>row?.id).map(row=>[row.id,row]));
      if (Array.isArray(input.data.supplierInvoices)) {
        input.data.supplierInvoices = input.data.supplierInvoices.map(row => {
          const prior = currentInvoices.get(row.id);
          const createdBy = prior?.createdBy || (authService ? principal.id : (row.createdBy || "local-user"));
          return { ...row, createdBy };
        });
      }
      if (Array.isArray(input.data.supplierPayments)) {
        input.data.supplierPayments = input.data.supplierPayments.map(row => {
          const prior = currentSupplierPayments.get(row.id);
          const createdBy = prior?.createdBy || (authService ? principal.id : (row.createdBy || "local-user"));
          return { ...row, createdBy };
        });
      }
      if (Array.isArray(input.data.supplierPaymentAllocations)) {
        const existingAPAllocations = new Map((currentManufacturing.supplierPaymentAllocations || []).filter(row=>row?.id).map(row=>[row.id,row]));
        input.data.supplierPaymentAllocations = input.data.supplierPaymentAllocations.map(row => {
          const prior = existingAPAllocations.get(row.id);
          return { ...row, createdBy: prior?.createdBy || (authService ? principal.id : (row.createdBy || "local-user")) };
        });
      }
      if (Array.isArray(input.data.supplierFinanceApprovals)) {
        const currentApprovals = new Map((currentManufacturing.supplierFinanceApprovals || []).filter(row=>row?.id).map(row=>[row.id,row]));
        input.data.supplierFinanceApprovals = input.data.supplierFinanceApprovals.map(row => {
          const prior = currentApprovals.get(row.id);
          if (prior) return prior;
          const target = row.targetType === "invoice" ? currentInvoices.get(row.targetId) : currentSupplierPayments.get(row.targetId);
          return {
            ...row,
            decidedBy: principal.id,
            decidedByRole: principal.role === "manager" ? "manager" : "admin",
            decidedAt: new Date().toISOString(),
            targetUpdatedAt: target?.updatedAt || ""
          };
        });
      }
      const scopeValidation = validateManufacturingWrite(currentManufacturing, input.data, principal);
      if (!scopeValidation.ok) return json(res, 403, { error: scopeValidation.error });
      const encoded = JSON.stringify(input.data);
      if (encoded.length > 8_000_000) return json(res, 413, { error: "Manufacturing data exceeds the 8 MB limit." });
      const currentRowsById = collection => new Map((currentManufacturing[collection] || []).filter(row=>row?.id).map(row=>[row.id,row]));
      const financeAuditEvents = [];
      const currentAllocationRows = currentRowsById("supplierPaymentAllocations");
      const currentApprovalRows = currentRowsById("supplierFinanceApprovals");
      const currentInvoiceRows = currentRowsById("supplierInvoices");
      const currentPaymentRows = currentRowsById("supplierPayments");
      for (const invoice of input.data.supplierInvoices || []) {
        const prior = currentInvoiceRows.get(invoice.id);
        if (!prior) financeAuditEvents.push({ action:"supplier-invoice.created", details:{ targetId:invoice.id, companyId:invoice.companyId, vendorId:invoice.vendorId, status:invoice.status } });
        else if (prior.status !== invoice.status) financeAuditEvents.push({ action:"supplier-invoice.status-changed", details:{ targetId:invoice.id, fromStatus:prior.status, toStatus:invoice.status } });
      }
      for (const payment of input.data.supplierPayments || []) {
        const prior = currentPaymentRows.get(payment.id);
        if (!prior) financeAuditEvents.push({ action:"supplier-payment.created", details:{ targetId:payment.id, companyId:payment.companyId, vendorId:payment.vendorId, method:payment.method, status:payment.status } });
        else if (prior.status !== payment.status) financeAuditEvents.push({ action:"supplier-payment.status-changed", details:{ targetId:payment.id, fromStatus:prior.status, toStatus:payment.status } });
      }
      for (const approval of input.data.supplierFinanceApprovals || []) {
        if (!currentApprovalRows.has(approval.id)) financeAuditEvents.push({ action:"supplier-finance.approval", details:{ approvalId:approval.id, targetType:approval.targetType, targetId:approval.targetId, decision:approval.decision } });
      }
      for (const allocation of input.data.supplierPaymentAllocations || []) {
        if (!currentAllocationRows.has(allocation.id)) financeAuditEvents.push({ action:"supplier-payment.allocated", details:{ allocationId:allocation.id, paymentId:allocation.paymentId, invoiceId:allocation.invoiceId } });
      }
      db.manufacturingData = mergeManufacturingData(db.manufacturingData, input.data);
      appendAuditEvent(req, principal, "manufacturing-data.sync", auditCollectionCounts(input.data, manufacturingCollections));
      for (const event of financeAuditEvents) appendAuditEvent(req, principal, event.action, event.details);
      await saveDb();
      const visibleData = principal.legacy || principal.role === "admin" ? db.manufacturingData : filterManufacturingData(db.manufacturingData, principal);
      return json(res, 200, { ok: true, data: visibleData, updatedAt: db.manufacturingData.updatedAt, restoreGeneration: Number(db.restoreGeneration || 0) });
    }
    if (url.pathname === "/api/records" && req.method === "GET") return json(res, 200, { records: filterModuleRecords(db.records || {}, principal), updatedAt: db.recordsUpdatedAt || null, restoreGeneration: Number(db.restoreGeneration || 0) });
    if (url.pathname === "/api/records" && req.method === "PUT") {
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req);
      if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry this write after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying.", restoreGeneration: Number(db.restoreGeneration || 0) });
      const currentGeneration = Number(db.restoreGeneration || 0);
      if ((currentGeneration > 0 || input.restoreGeneration !== undefined) && (!Number.isSafeInteger(input.restoreGeneration) || input.restoreGeneration !== currentGeneration)) {
        return json(res, 409, { error: "The server was restored since this device last synced. Refresh module records before writing.", restoreGeneration: currentGeneration });
      }
      if (!input.records || typeof input.records !== "object" || Array.isArray(input.records)) return json(res, 400, { error: "records must be an object keyed by module ID." });
      if (Object.values(input.records).some(rows => !Array.isArray(rows))) return json(res, 400, { error: "Each module ID must contain a records array." });
      const encoded = JSON.stringify(input.records);
      if (encoded.length > 8_000_000) return json(res, 413, { error: "Record payload exceeds the 8 MB limit. Export/archive older records first." });
      db.records = mergeModuleRecords(db.records, input.records);
      db.recordsUpdatedAt = new Date().toISOString();
      const moduleCounts = Object.fromEntries(Object.entries(input.records).filter(([moduleId, rows]) => /^[a-z0-9][a-z0-9-]{0,63}$/i.test(moduleId) && rows.length).map(([moduleId, rows]) => [moduleId, rows.length]));
      appendAuditEvent(req, principal, "module-records.sync", { moduleCounts, recordCount: Object.values(moduleCounts).reduce((sum, count) => sum + count, 0) });
      await saveDb();
      return json(res, 200, { ok: true, records: db.records, updatedAt: db.recordsUpdatedAt, restoreGeneration: Number(db.restoreGeneration || 0) });
    }
    if (url.pathname === "/api/ui-preferences" && req.method === "GET") {
      return json(res, 200, { preferences: db.uiPreferences || null, updatedAt: db.uiPreferences?.updatedAt || null });
    }
    if (url.pathname === "/api/ui-preferences" && req.method === "PUT") {
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req);
      if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry this write after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying.", restoreGeneration: Number(db.restoreGeneration || 0) });
      if (!input.preferences || typeof input.preferences !== "object" || Array.isArray(input.preferences)) {
        return json(res, 400, { error: "preferences must be a UI preference object." });
      }
      const encoded = JSON.stringify(input.preferences);
      if (encoded.length > 2_000_000) return json(res, 413, { error: "UI preferences exceed the 2 MB limit." });
      const incomingAt = Date.parse(input.preferences.updatedAt || "") || 0;
      const currentAt = Date.parse(db.uiPreferences?.updatedAt || "") || 0;
      if (!db.uiPreferences || incomingAt >= currentAt) {
        db.uiPreferences = { ...input.preferences, updatedAt: input.preferences.updatedAt || new Date().toISOString() };
        appendAuditEvent(req, principal, "ui-preferences.update", { preferenceKeys: Object.keys(input.preferences).slice(0, 40) });
        await saveDb();
      }
      return json(res, 200, { ok: true, preferences: db.uiPreferences, updatedAt: db.uiPreferences?.updatedAt || null });
    }
    if (url.pathname === "/api/contacts" && req.method === "GET") return json(res, 200, { contacts: db.contacts });
    if (url.pathname === "/api/contacts" && req.method === "POST") {
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req);
      if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry this write after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying.", restoreGeneration: Number(db.restoreGeneration || 0) });
      if (!String(input.name || "").trim() || !normalisePhone(input.phone)) return json(res, 400, { error: "Contact name and international phone number are required." });
      const contact = { id: randomUUID(), name: String(input.name).trim(), phone: normalisePhone(input.phone), company: String(input.company || ""), optedIn: input.optedIn === true, createdAt: new Date().toISOString() };
      db.contacts.push(contact); appendAuditEvent(req, principal, "whatsapp-contact.create", { targetId: contact.id, optedIn: contact.optedIn }); await saveDb(); return json(res, 201, { contact });
    }
    if (url.pathname === "/api/schedules" && req.method === "GET") return json(res, 200, { schedules: db.schedules, logs: db.logs });
    if (url.pathname === "/api/schedules" && req.method === "POST") {
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req);
      if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry this write after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying.", restoreGeneration: Number(db.restoreGeneration || 0) });
      const to = normalisePhone(input.to); const message = String(input.message || "").trim(); const due = Date.parse(input.nextRunAt);
      if (!to || !message || !Number.isFinite(due) || due <= Date.now()) return json(res, 400, { error: "A valid international phone number, message and future nextRunAt are required." });
      const contact = db.contacts.find(item => item.phone === to);
      if (!contact || !contact.optedIn) return json(res, 400, { error: "Add the contact and record their WhatsApp opt-in before scheduling." });
      const repeat = ["once", "daily", "weekly"].includes(input.repeat) ? input.repeat : "once";
      const task = {
        id: randomUUID(), to, message, nextRunAt: new Date(due).toISOString(), repeat, enabled: true,
        vendorId: String(input.vendorId || "").trim().slice(0, 128),
        operationId: String(input.operationId || "").trim().slice(0, 128),
        process: String(input.process || "").trim().slice(0, 160),
        company: String(input.company || "").trim().slice(0, 160),
        createdAt: new Date().toISOString(), lastRunAt: null, lastError: ""
      };
      db.schedules.push(task); appendAuditEvent(req, principal, "whatsapp-schedule.create", { targetId: task.id, repeat: task.repeat, operationId: task.operationId || "", vendorId: task.vendorId || "" }); await saveDb(); return json(res, 201, { schedule: task });
    }
    const match = url.pathname.match(/^\/api\/schedules\/([\w-]+)$/);
    if (match && req.method === "PATCH") {
      const task = db.schedules.find(item => item.id === match[1]); if (!task) return json(res, 404, { error: "Schedule not found." });
      const requestGeneration = Number(db.restoreGeneration || 0);
      const input = await body(req);
      if (restoreInProgress) return json(res, 503, { error: "A restore is in progress; retry this write after it completes." });
      if (requestGeneration !== Number(db.restoreGeneration || 0)) return json(res, 409, { error: "The server was restored while this request was uploading. Refresh before retrying.", restoreGeneration: Number(db.restoreGeneration || 0) });
      if (typeof input.enabled === "boolean") task.enabled = input.enabled;
      if (input.nextRunAt && Number.isFinite(Date.parse(input.nextRunAt))) task.nextRunAt = new Date(input.nextRunAt).toISOString();
      appendAuditEvent(req, principal, "whatsapp-schedule.update", { targetId: task.id, enabled: task.enabled });
      await saveDb(); return json(res, 200, { schedule: task });
    }
    if (url.pathname === "/api/audit-events" && req.method === "GET") return json(res, 200, { events: db.auditEvents || [], retentionLimit: AUDIT_RETENTION_LIMIT });
    if (url.pathname === "/api/logs" && req.method === "GET") return json(res, 200, { logs: db.logs });
    return json(res, 404, { error: "Route not found." });
  } catch (error) { return json(res, 400, { error: error.message || "Request failed." }); }
});
await loadDb();
server.listen(PORT, "0.0.0.0", () => console.log("AXIMACH scheduler listening on", PORT));
setInterval(() => { tick().catch(error => console.error("Scheduler error:", error)); }, 10000);
