import { createServer } from "node:http";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import QRCode from "qrcode";

const PORT = Number(process.env.WA_WEB_PORT || 8788);
const HOST = process.env.WA_WEB_HOST || "0.0.0.0";
const KEY = process.env.AXIMACH_API_KEY || "";
const DATA = resolve(process.env.WA_WEB_DATA_FILE || "./data/whatsapp-web.json");
const AUTH = resolve(process.env.WA_WEB_AUTH_DIR || "./data/whatsapp-auth");
let state = { contacts: [], groups: [], schedules: [], logs: [], qr: null, connected: false, user: null };
let socket;
let reconnectTimer;
let busy = false;

async function load() {
  try { state = { ...state, ...JSON.parse(await readFile(DATA, "utf8")), qr: null, connected: false }; }
  catch (e) { if (e.code !== "ENOENT") console.error("WhatsApp store load failed:", e.message); }
}
async function save() {
  await mkdir(dirname(DATA), { recursive: true });
  const tmp = DATA + ".tmp";
  await writeFile(tmp, JSON.stringify({ ...state, qr: null, connected: false }, null, 2), { mode: 0o600 });
  await rename(tmp, DATA);
}
const allowedOrigins = new Set(String(process.env.AXIMACH_ALLOWED_ORIGINS || process.env.AXIMACH_ALLOWED_ORIGIN || "http://localhost:5173")
  .split(",").map(origin => origin.trim()).filter(Boolean));
function applyCors(req, res) {
  const origin = String(req.headers.origin || "");
  res.setHeader("vary", "Origin");
  if (origin && allowedOrigins.has(origin)) res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-headers", "content-type,x-aximach-key");
  res.setHeader("access-control-allow-methods", "GET,POST,PATCH,OPTIONS");
}
function reply(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
async function readBody(req) {
  let raw = ""; for await (const chunk of req) { raw += chunk; if (raw.length > 1_000_000) throw new Error("Request too large"); }
  return raw ? JSON.parse(raw) : {};
}
function auth(req) { return Boolean(KEY) && req.headers["x-aximach-key"] === KEY; }
function phoneNumber(jid) { return String(jid || "").split("@")[0].split(":")[0].replace(/\D/g, ""); }
function upsertContact(c) {
  const id = c.id || c.lid || "";
  if (!id || id.endsWith("@g.us") || id === "status@broadcast") return;
  const number = phoneNumber(id);
  const existing = state.contacts.find(x => x.id === id || (number && x.phone === number));
  const item = { id, phone: number, name: c.name || c.notify || c.verifiedName || existing?.name || number || id, notify: c.notify || existing?.notify || "", syncedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, item); else state.contacts.push(item);
}
async function connect() {
  try {
    const { state: credentials, saveCreds } = await useMultiFileAuthState(AUTH);
    let version;
    try { ({ version } = await fetchLatestBaileysVersion()); } catch {}
    socket = makeWASocket({ auth: credentials, ...(version ? { version } : {}), printQRInTerminal: false, markOnlineOnConnect: false, syncFullHistory: true });
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
      if (qr) state.qr = qr;
      if (connection === "open") { state.connected = true; state.qr = null; state.user = socket.user?.id || null; refreshGroups().catch(() => {}); save().catch(console.error); }
      if (connection === "close") {
        state.connected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) { clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => connect().catch(console.error), 3000); }
        else { state.qr = null; console.error("WhatsApp session logged out; manual re-pair required."); }
      }
    });
    socket.ev.on("contacts.upsert", list => { for (const c of list) upsertContact(c); save().catch(console.error); });
    socket.ev.on("contacts.update", list => { for (const c of list) upsertContact(c); save().catch(console.error); });
    socket.ev.on("messaging-history.set", ({ contacts = [], chats = [] }) => {
      for (const c of contacts) upsertContact(c);
      for (const c of chats) if (c.id && !c.id.endsWith("@g.us")) upsertContact({ id: c.id, name: c.name, notify: c.name });
      save().catch(console.error);
    });
    socket.ev.on("messages.upsert", ({ messages = [], type }) => {
      if (type !== "notify") return;
      for (const m of messages) {
        if (m.key?.fromMe) continue;
        state.logs.unshift({ id: randomUUID(), at: new Date().toISOString(), status: "incoming", from: m.key?.remoteJid || "", text: m.message?.conversation || m.message?.extendedTextMessage?.text || "[non-text message]" });
      }
      state.logs = state.logs.slice(0, 2000);
      save().catch(console.error);
    });
  } catch (e) {
    state.connected = false;
    console.error("WhatsApp connection failed:", e.message);
    clearTimeout(reconnectTimer); reconnectTimer = setTimeout(() => connect().catch(console.error), 10000);
  }
}
async function refreshGroups() {
  if (!socket || !state.connected) return;
  const groups = await socket.groupFetchAllParticipating();
  state.groups = Object.values(groups).map(g => ({ id: g.id, name: g.subject || g.id, participants: g.participants?.length || 0, syncedAt: new Date().toISOString() }));
  await save();
}
async function schedulerTick() {
  if (busy || !socket || !state.connected) return;
  busy = true;
  try {
    for (const task of state.schedules) {
      if (!task.enabled || !task.nextRunAt || Date.parse(task.nextRunAt) > Date.now()) continue;
      try {
        const result = await socket.sendMessage(task.to, { text: task.message });
        state.logs.unshift({ id: randomUUID(), scheduleId: task.id, at: new Date().toISOString(), status: "sent", messageId: result?.key?.id || "" });
        task.lastRunAt = new Date().toISOString(); task.lastError = "";
        if (task.repeat === "daily" || task.repeat === "weekly") {
          const step = task.repeat === "daily" ? 86400000 : 604800000;
          let next = Date.parse(task.nextRunAt) + step; while (next <= Date.now()) next += step;
          task.nextRunAt = new Date(next).toISOString();
        } else { task.enabled = false; task.nextRunAt = null; }
      } catch (e) {
        task.lastError = e.message; task.enabled = false;
        state.logs.unshift({ id: randomUUID(), scheduleId: task.id, at: new Date().toISOString(), status: "failed", detail: e.message });
      }
      await save();
    }
    state.logs = state.logs.slice(0, 2000);
  } finally { busy = false; }
}
const server = createServer(async (req, res) => {
  applyCors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-max-age": "86400" }); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/health" && req.method === "GET") return reply(res, 200, { ok: true, service: "AXIMACH WhatsApp Web bridge", connected: state.connected, credentialsPersisted: true });
  if (!auth(req)) return reply(res, 401, { error: "Set AXIMACH_API_KEY on the server and send it in x-aximach-key." });
  try {
    if (url.pathname === "/api/whatsapp/status" && req.method === "GET") return reply(res, 200, { connected: state.connected, user: state.user, needsPairing: !state.connected && Boolean(state.qr), qr: state.qr, qrDataUrl: state.qr ? await QRCode.toDataURL(state.qr) : null });
    if (url.pathname === "/api/whatsapp/contacts" && req.method === "GET") return reply(res, 200, { contacts: state.contacts });
    if (url.pathname === "/api/whatsapp/groups" && req.method === "GET") { await refreshGroups(); return reply(res, 200, { groups: state.groups }); }
    if (url.pathname === "/api/whatsapp/refresh-groups" && req.method === "POST") { await refreshGroups(); return reply(res, 200, { groups: state.groups }); }
    if (url.pathname === "/api/whatsapp/send" && req.method === "POST") {
      if (!state.connected || !socket) return reply(res, 503, { error: "WhatsApp is not connected." });
      const input = await readBody(req); const to = String(input.to || "").trim(); const message = String(input.message || "").trim();
      if (!to || !message) return reply(res, 400, { error: "Recipient JID/phone and message are required." });
      if (input.optedIn !== true) return reply(res, 400, { error: "Confirm recipient consent before sending." });
      const jid = to.includes("@") ? to : phoneNumber(to) + "@s.whatsapp.net";
      const sent = await socket.sendMessage(jid, { text: message });
      return reply(res, 200, { ok: true, messageId: sent?.key?.id || "" });
    }
    if (url.pathname === "/api/whatsapp/schedules" && req.method === "GET") return reply(res, 200, { schedules: state.schedules, logs: state.logs });
    if (url.pathname === "/api/whatsapp/schedules" && req.method === "POST") {
      const input = await readBody(req); const to = String(input.to || "").trim(); const message = String(input.message || "").trim(); const due = Date.parse(input.nextRunAt);
      if (!to || !message || !Number.isFinite(due) || due <= Date.now()) return reply(res, 400, { error: "Recipient, message and future nextRunAt are required." });
      if (input.optedIn !== true) return reply(res, 400, { error: "Confirm recipient consent before scheduling." });
      const repeat = ["once", "daily", "weekly"].includes(input.repeat) ? input.repeat : "once";
      const task = { id: randomUUID(), to, message, nextRunAt: new Date(due).toISOString(), repeat, enabled: true, createdAt: new Date().toISOString(), lastRunAt: null, lastError: "" };
      state.schedules.push(task); await save(); return reply(res, 201, { schedule: task });
    }
    const match = url.pathname.match(/^\/api\/whatsapp\/schedules\/([\w-]+)$/);
    if (match && req.method === "PATCH") {
      const task = state.schedules.find(x => x.id === match[1]); if (!task) return reply(res, 404, { error: "Schedule not found." });
      const input = await readBody(req); if (typeof input.enabled === "boolean") task.enabled = input.enabled;
      if (input.nextRunAt && Number.isFinite(Date.parse(input.nextRunAt))) task.nextRunAt = new Date(input.nextRunAt).toISOString();
      await save(); return reply(res, 200, { schedule: task });
    }
    return reply(res, 404, { error: "Route not found." });
  } catch (e) { return reply(res, 400, { error: e.message || "Request failed." }); }
});
await load();
server.listen(PORT, HOST, () => console.log("AXIMACH WhatsApp Web bridge listening on", HOST, PORT));
connect().catch(console.error);
setInterval(() => schedulerTick().catch(console.error), 10000);
