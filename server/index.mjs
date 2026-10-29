import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT || 8787);
const API_KEY = process.env.AXIMACH_API_KEY || "";
const DB_PATH = resolve(process.env.AXIMACH_DATA_FILE || "./data/aximach.json");
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
let db = { contacts: [], schedules: [], logs: [] };
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
  let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 1_000_000) throw new Error("Request too large"); }
  return raw ? JSON.parse(raw) : {};
}
function authorized(req) { return API_KEY && req.headers["x-aximach-key"] === API_KEY; }
function normalisePhone(phone) { return String(phone || "").replace(/\D/g, ""); }

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
        if (task.repeat === "daily") task.nextRunAt = new Date(Date.parse(task.nextRunAt) + 86400000).toISOString();
        else if (task.repeat === "weekly") task.nextRunAt = new Date(Date.parse(task.nextRunAt) + 604800000).toISOString();
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
  if (req.method === "OPTIONS") return json(res, 204, {});
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") return json(res, 200, { ok: true, service: "AXIMACH scheduler", credentialsConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), persistentStore: DB_PATH });
  if (!authorized(req)) return json(res, 401, { error: "Set AXIMACH_API_KEY on the server and send it in x-aximach-key." });
  try {
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
