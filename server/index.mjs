import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.AXIMACH_API_KEY || "";
const DB_PATH = resolve(process.env.AXIMACH_DATA_FILE || "./data/aximach.json");
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
let db = { contacts: [], schedules: [], logs: [], records: {}, manufacturingData: null };
let busy = false;

async function loadDb() {
  try { db = { ...db, ...JSON.parse(await readFile(DB_PATH, "utf8")) }; }
  catch (error) { if (error.code !== "ENOENT") console.error("Could not load data store:", error.message); }
}
async function saveDb() {
  await mkdir(dirname(DB_PATH), { recursive: true });
  const temp = DB_PATH + ".tmp";
  await writeFile(temp, JSON.stringify(db, null, 2), { mode: 0o600 });
  await rename(temp, DB_PATH);
}
function json(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": process.env.AXIMACH_ALLOWED_ORIGIN || "http://localhost:5173", "access-control-allow-headers": "content-type,x-aximach-key", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS" });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 8_500_000) throw new Error("Request too large"); }
  return raw ? JSON.parse(raw) : {};
}
function authorized(req) { return API_KEY && req.headers["x-aximach-key"] === API_KEY; }
function normalisePhone(phone) { return String(phone || "").replace(/\D/g, ""); }
const manufacturingCollections = ["companies", "factories", "purchaseOrders", "components", "vendors", "operations", "quotations"];
function mergeManufacturingData(existing, incoming) {
  const left = existing && typeof existing === "object" ? existing : {};
  const right = incoming && typeof incoming === "object" ? incoming : {};
  const merged = {};
  for (const collection of manufacturingCollections) {
    const rows = new Map();
    for (const row of Array.isArray(left[collection]) ? left[collection] : []) if (row?.id) rows.set(row.id, row);
    for (const row of Array.isArray(right[collection]) ? right[collection] : []) {
      if (!row?.id) continue;
      const current = rows.get(row.id);
      if (!current || (Date.parse(row.updatedAt || "") || 0) >= (Date.parse(current.updatedAt || "") || 0)) rows.set(row.id, row);
    }
    merged[collection] = [...rows.values()];
  }
  merged.updatedAt = [left.updatedAt, right.updatedAt].sort().at(-1) || new Date().toISOString();
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
  if (busy) return; busy = true;
  try {
    const now = Date.now();
    for (const task of db.schedules) {
      if (!task.enabled || task.nextRunAt == null || Date.parse(task.nextRunAt) > now) continue;
      try {
        const result = await sendWhatsApp(task.to, task.message);
        db.logs.unshift({ id: randomUUID(), scheduleId: task.id, at: new Date().toISOString(), status: "sent", providerMessageId: result.messages?.[0]?.id || "", detail: "Accepted by WhatsApp Cloud API" });
        task.lastRunAt = new Date().toISOString();
        if (task.repeat === "daily" || task.repeat === "weekly") { const period = task.repeat === "daily" ? 86400000 : 604800000; let next = Date.parse(task.nextRunAt) + period; while (next <= Date.now()) next += period; task.nextRunAt = new Date(next).toISOString(); }
        else { task.enabled = false; task.nextRunAt = null; }
      } catch (error) {
        db.logs.unshift({ id: randomUUID(), scheduleId: task.id, at: new Date().toISOString(), status: "failed", detail: error.message });
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
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": process.env.AXIMACH_ALLOWED_ORIGIN || "http://localhost:5173", "access-control-allow-headers": "content-type,x-aximach-key", "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS", "access-control-max-age": "86400" }); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "AXIMACH scheduler", credentialsConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), persistentStore: DB_PATH });
  if (!authorized(req)) return json(res, 401, { error: "Set AXIMACH_API_KEY on the server and send it in x-aximach-key." });
  try {
    if (url.pathname === "/api/manufacturing-data" && req.method === "GET") {
      return json(res, 200, { data: db.manufacturingData || null, updatedAt: db.manufacturingData?.updatedAt || null });
    }
    if (url.pathname === "/api/manufacturing-data" && req.method === "PUT") {
      const input = await body(req);
      if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) return json(res, 400, { error: "data must be an AXIMACH manufacturing data object." });
      for (const collection of manufacturingCollections) if (input.data[collection] !== undefined && !Array.isArray(input.data[collection])) return json(res, 400, { error: collection + " must be an array." });
      const encoded = JSON.stringify(input.data);
      if (encoded.length > 8_000_000) return json(res, 413, { error: "Manufacturing data exceeds the 8 MB limit." });
      db.manufacturingData = mergeManufacturingData(db.manufacturingData, input.data);
      await saveDb();
      return json(res, 200, { ok: true, data: db.manufacturingData, updatedAt: db.manufacturingData.updatedAt });
    }
    if (url.pathname === "/api/records" && req.method === "GET") return json(res, 200, { records: db.records || {}, updatedAt: db.recordsUpdatedAt || null });
    if (url.pathname === "/api/records" && req.method === "PUT") {
      const input = await body(req);
      if (!input.records || typeof input.records !== "object" || Array.isArray(input.records)) return json(res, 400, { error: "records must be an object keyed by module ID." });
      const encoded = JSON.stringify(input.records);
      if (encoded.length > 8_000_000) return json(res, 413, { error: "Record payload exceeds the 8 MB limit. Export/archive older records first." });
      db.records = input.records;
      db.recordsUpdatedAt = new Date().toISOString();
      await saveDb();
      return json(res, 200, { ok: true, updatedAt: db.recordsUpdatedAt });
    }
    if (url.pathname === "/api/contacts" && req.method === "GET") return json(res, 200, { contacts: db.contacts });
    if (url.pathname === "/api/contacts" && req.method === "POST") {
      const input = await body(req); if (!String(input.name || "").trim() || !normalisePhone(input.phone)) return json(res, 400, { error: "Contact name and international phone number are required." });
      const contact = { id: randomUUID(), name: String(input.name).trim(), phone: normalisePhone(input.phone), company: String(input.company || ""), optedIn: input.optedIn === true, createdAt: new Date().toISOString() };
      db.contacts.push(contact); await saveDb(); return json(res, 201, { contact });
    }
    if (url.pathname === "/api/schedules" && req.method === "GET") return json(res, 200, { schedules: db.schedules, logs: db.logs });
    if (url.pathname === "/api/schedules" && req.method === "POST") {
      const input = await body(req);
      const to = normalisePhone(input.to); const message = String(input.message || "").trim(); const due = Date.parse(input.nextRunAt);
      if (!to || !message || !Number.isFinite(due) || due <= Date.now()) return json(res, 400, { error: "A valid international phone number, message and future nextRunAt are required." });
      const contact = db.contacts.find(item => item.phone === to);
      if (!contact || !contact.optedIn) return json(res, 400, { error: "Add the contact and record their WhatsApp opt-in before scheduling." });
      const repeat = ["once", "daily", "weekly"].includes(input.repeat) ? input.repeat : "once";
      const task = { id: randomUUID(), to, message, nextRunAt: new Date(due).toISOString(), repeat, enabled: true, createdAt: new Date().toISOString(), lastRunAt: null, lastError: "" };
      db.schedules.push(task); await saveDb(); return json(res, 201, { schedule: task });
    }
    const match = url.pathname.match(/^\/api\/schedules\/([\w-]+)$/);
    if (match && req.method === "PATCH") {
      const task = db.schedules.find(item => item.id === match[1]); if (!task) return json(res, 404, { error: "Schedule not found." });
      const input = await body(req); if (typeof input.enabled === "boolean") task.enabled = input.enabled;
      if (input.nextRunAt && Number.isFinite(Date.parse(input.nextRunAt))) task.nextRunAt = new Date(input.nextRunAt).toISOString();
      await saveDb(); return json(res, 200, { schedule: task });
    }
    if (url.pathname === "/api/logs" && req.method === "GET") return json(res, 200, { logs: db.logs });
    return json(res, 404, { error: "Route not found." });
  } catch (error) { return json(res, 400, { error: error.message || "Request failed." }); }
});
await loadDb();
server.listen(PORT, "0.0.0.0", () => console.log("AXIMACH scheduler listening on", PORT));
setInterval(() => { tick().catch(error => console.error("Scheduler error:", error)); }, 10000);
