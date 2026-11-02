import net from "node:net";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const PROTOCOLS = new Set(["OPC UA", "Modbus TCP", "MTConnect", "REST gateway"]);
const DATA_TYPES = new Set(["uint16", "int16", "uint32", "int32", "float32"]);
const MAX_SIGNALS = 64;

function fail(message) { throw new Error(message); }
function privateIp(address) {
  const value = String(address || "").toLowerCase().replace(/^::ffff:/, "");
  if (net.isIPv4(value)) {
    const [a, b] = value.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 192 && b === 168)
      || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
  }
  if (net.isIPv6(value)) return value === "::1" || value.startsWith("fc") || value.startsWith("fd")
    || value.startsWith("fe80:") || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.")
    || value.startsWith("::ffff:192.168.") || value.startsWith("::ffff:172.");
  return false;
}

async function assertPrivateHost(hostname) {
  const host = String(hostname || "").replace(/^\[|\]$/g, "");
  if (!host || host.length > 253) fail("A valid machine host is required.");
  let addresses;
  try { addresses = await lookup(host, { all: true, verbatim: true }); }
  catch { fail("Machine host could not be resolved from the AXIMACH gateway."); }
  if (!addresses.length || addresses.some(item => !privateIp(item.address))) {
    fail("Machine connections are restricted to loopback or private LAN addresses. Public endpoints are blocked.");
  }
  return addresses;
}

export function validateMachineProfile(input) {
  if (!input || typeof input !== "object") fail("Machine profile is required.");
  const protocol = String(input.protocol || "");
  if (!PROTOCOLS.has(protocol)) fail("Choose OPC UA, Modbus TCP, MTConnect or REST gateway.");
  const name = String(input.name || "").trim();
  const endpoint = String(input.endpoint || "").trim();
  if (!name || name.length > 100) fail("Machine name is required (maximum 100 characters).");
  if (!endpoint || endpoint.length > 500) fail("A machine endpoint is required (maximum 500 characters).");
  if (!Array.isArray(input.signals) || input.signals.length < 1 || input.signals.length > MAX_SIGNALS) {
    fail("Add between 1 and 64 named telemetry signals.");
  }
  const signals = input.signals.map((item, index) => {
    const key = String(item?.key || "").trim();
    const label = String(item?.label || key).trim();
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) fail("Signal " + (index + 1) + " needs a stable key (letters, numbers, _ or -).");
    if (!label || label.length > 80) fail("Signal " + key + " needs a label of at most 80 characters.");
    const signal = { key, label };
    if (protocol === "OPC UA") {
      signal.nodeId = String(item.nodeId || "").trim();
      if (!signal.nodeId || signal.nodeId.length > 512) fail("OPC UA signal " + key + " needs a NodeId.");
    } else if (protocol === "Modbus TCP") {
      signal.address = Number(item.address);
      signal.functionCode = Number(item.functionCode || 3);
      signal.dataType = String(item.dataType || "uint16");
      signal.scale = Number.isFinite(Number(item.scale)) ? Number(item.scale) : 1;
      signal.offset = Number.isFinite(Number(item.offset)) ? Number(item.offset) : 0;
      if (!Number.isInteger(signal.address) || signal.address < 0 || signal.address > 65535) fail("Modbus signal " + key + " needs a 0–65535 register address.");
      if (![3, 4].includes(signal.functionCode)) fail("Modbus supports read-only function codes 3 and 4 only.");
      if (!DATA_TYPES.has(signal.dataType)) fail("Unsupported Modbus data type for " + key + ".");
    } else if (protocol === "MTConnect") {
      signal.dataItemId = String(item.dataItemId || "").trim();
      if (!signal.dataItemId || signal.dataItemId.length > 160) fail("MTConnect signal " + key + " needs a dataItemId.");
    } else {
      signal.jsonPointer = String(item.jsonPointer || "").trim();
      if (!signal.jsonPointer.startsWith("/") || signal.jsonPointer.length > 500) fail("REST signal " + key + " needs a JSON Pointer such as /data/spindleSpeed.");
    }
    return signal;
  });
  if (new Set(signals.map(item => item.key)).size !== signals.length) fail("Signal keys must be unique.");
  const unitId = Number(input.unitId || 1);
  if (!Number.isInteger(unitId) || unitId < 1 || unitId > 247) fail("Modbus unit ID must be between 1 and 247.");
  return {
    id: String(input.id || randomUUID()),
    name, protocol, endpoint, unitId, signals,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readOnly: true
  };
}

function parseModbusEndpoint(endpoint) {
  const url = new URL(endpoint.includes("://") ? endpoint : "tcp://" + endpoint);
  if (url.protocol !== "tcp:") fail("Modbus endpoint must use tcp://host:port.");
  const port = Number(url.port || 502);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("Invalid Modbus TCP port.");
  return { host: url.hostname.replace(/^\[|\]$/g, ""), port };
}

function readModbusSignal(host, port, unitId, signal) {
  return new Promise((resolve, reject) => {
    const transaction = Math.floor(Math.random() * 65535);
    const registerCount = signal.dataType === "uint32" || signal.dataType === "int32" || signal.dataType === "float32" ? 2 : 1;
    const request = Buffer.alloc(12);
    request.writeUInt16BE(transaction, 0);
    request.writeUInt16BE(0, 2);
    request.writeUInt16BE(6, 4);
    request.writeUInt8(unitId, 6);
    request.writeUInt8(signal.functionCode, 7);
    request.writeUInt16BE(signal.address, 8);
    request.writeUInt16BE(registerCount, 10);
    const socket = net.createConnection({ host, port });
    let buffer = Buffer.alloc(0);
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(new Error("Modbus read timed out for " + signal.key + ".")), 5000);
    socket.once("connect", () => socket.write(request));
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 7) return;
      const length = buffer.readUInt16BE(4);
      if (buffer.length < 6 + length) return;
      if (buffer.readUInt16BE(0) !== transaction) return finish(new Error("Modbus transaction ID mismatch."));
      const responseFunction = buffer.readUInt8(7);
      if (responseFunction & 0x80) return finish(new Error("Modbus exception code " + buffer.readUInt8(8) + " for " + signal.key + "."));
      if (responseFunction !== signal.functionCode) return finish(new Error("Unexpected Modbus function code."));
      const byteCount = buffer.readUInt8(8);
      const data = buffer.subarray(9, 9 + byteCount);
      if (data.length !== registerCount * 2) return finish(new Error("Modbus returned an unexpected register length."));
      let raw;
      if (signal.dataType === "uint16") raw = data.readUInt16BE(0);
      else if (signal.dataType === "int16") raw = data.readInt16BE(0);
      else if (signal.dataType === "uint32") raw = data.readUInt32BE(0);
      else if (signal.dataType === "int32") raw = data.readInt32BE(0);
      else raw = data.readFloatBE(0);
      finish(null, raw * signal.scale + signal.offset);
    });
    socket.once("error", error => finish(new Error("Modbus connection failed: " + error.message)));
  });
}

async function readOpcUa(profile) {
  const [host] = await assertPrivateHost(new URL(profile.endpoint).hostname);
  void host;
  const secretsPath = process.env.AXIMACH_MACHINE_SECRETS_FILE;
  let secret = {};
  if (secretsPath) {
    try {
      const all = JSON.parse(await readFile(secretsPath, "utf8"));
      secret = all[profile.id] || {};
    } catch { fail("Machine secrets file is configured but cannot be read or parsed."); }
  }
  const securityMode = String(secret.securityMode || "None");
  if (securityMode === "None" && process.env.AXIMACH_ALLOW_OPCUA_NONE !== "1") {
    fail("OPC UA is safely blocked until a SignAndEncrypt certificate profile is configured in AXIMACH_MACHINE_SECRETS_FILE. Anonymous SecurityMode=None requires the explicit AXIMACH_ALLOW_OPCUA_NONE=1 opt-in.");
  }
  const opc = await import("node-opcua-client");
  const clientOptions = {
    endpointMustExist: false,
    connectionStrategy: { maxRetry: 1, initialDelay: 250, maxDelay: 1000 },
    requestedSessionTimeout: 10000
  };
  if (securityMode === "SignAndEncrypt") {
    if (!secret.certificateFile || !secret.privateKeyFile) fail("OPC UA SignAndEncrypt requires certificateFile and privateKeyFile in the local machine secrets file.");
    clientOptions.securityMode = opc.MessageSecurityMode.SignAndEncrypt;
    clientOptions.securityPolicy = opc.SecurityPolicy[secret.securityPolicy || "Basic256Sha256"];
    clientOptions.certificateFile = secret.certificateFile;
    clientOptions.privateKeyFile = secret.privateKeyFile;
  } else {
    clientOptions.securityMode = opc.MessageSecurityMode.None;
    clientOptions.securityPolicy = opc.SecurityPolicy.None;
  }
  const client = opc.OPCUAClient.create(clientOptions);
  let session;
  try {
    await client.connect(profile.endpoint);
    const identity = secret.username ? { userName: secret.username, password: String(secret.password || "") } : undefined;
    session = await client.createSession(identity);
    const points = [];
    for (const signal of profile.signals) {
      const value = await session.read({ nodeId: signal.nodeId, attributeId: opc.AttributeIds.Value });
      points.push({
        key: signal.key, label: signal.label,
        value: value?.value?.value ?? null,
        quality: value?.statusCode?.name || "UNKNOWN",
        sourceTimestamp: value?.sourceTimestamp ? value.sourceTimestamp.toISOString() : null,
        sampledAt: new Date().toISOString()
      });
    }
    return points;
  } finally {
    if (session) await session.close().catch(() => {});
    await client.disconnect().catch(() => {});
  }
}

async function readMtConnect(profile) {
  const url = new URL(profile.endpoint);
  await assertPrivateHost(url.hostname);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: "error", headers: { accept: "application/xml,text/xml" } });
  if (!response.ok) fail("MTConnect gateway returned HTTP " + response.status + ".");
  const xml = await response.text();
  if (xml.length > 2_000_000) fail("MTConnect response exceeded the 2 MB safety limit.");
  const values = new Map();
  const tag = /<([A-Za-z][\w:.-]*)\b([^>]*)>([^<]*)<\/\1>/g;
  let match;
  while ((match = tag.exec(xml))) {
    const attrs = match[2];
    const id = attrs.match(/\bdataItemId\s*=\s*["']([^"']+)["']/i)?.[1];
    if (id) values.set(id, { value: match[3].trim(), timestamp: attrs.match(/\btimestamp\s*=\s*["']([^"']+)["']/i)?.[1] || null });
  }
  return profile.signals.map(signal => {
    const found = values.get(signal.dataItemId);
    return { key: signal.key, label: signal.label, value: found?.value ?? null, quality: found ? "GOOD" : "NO_DATA", sourceTimestamp: found?.timestamp || null, sampledAt: new Date().toISOString() };
  });
}

function pointerValue(source, pointer) {
  return pointer.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~")).reduce((value, key) => value == null ? undefined : value[key], source);
}
async function readRestGateway(profile, secret) {
  const url = new URL(profile.endpoint);
  await assertPrivateHost(url.hostname);
  const headers = { accept: "application/json", ...(secret.headers || {}) };
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(8000), redirect: "error" });
  if (!response.ok) fail("REST machine gateway returned HTTP " + response.status + ".");
  const payload = await response.json();
  const encoded = JSON.stringify(payload);
  if (encoded.length > 2_000_000) fail("REST machine gateway response exceeded the 2 MB safety limit.");
  return profile.signals.map(signal => {
    const value = pointerValue(payload, signal.jsonPointer);
    return { key: signal.key, label: signal.label, value: value ?? null, quality: value === undefined ? "NO_DATA" : "GOOD", sourceTimestamp: null, sampledAt: new Date().toISOString() };
  });
}

async function readModbus(profile) {
  const { host, port } = parseModbusEndpoint(profile.endpoint);
  await assertPrivateHost(host);
  const points = [];
  for (const signal of profile.signals) {
    const value = await readModbusSignal(host, port, profile.unitId, signal);
    points.push({ key: signal.key, label: signal.label, value, quality: "GOOD", sourceTimestamp: null, sampledAt: new Date().toISOString() });
  }
  return points;
}

export async function readMachineTelemetry(profile) {
  const sampledAt = new Date().toISOString();
  let points;
  if (profile.protocol === "OPC UA") points = await readOpcUa(profile);
  else if (profile.protocol === "Modbus TCP") points = await readModbus(profile);
  else if (profile.protocol === "MTConnect") points = await readMtConnect(profile);
  else {
    let secret = {};
    const secretsPath = process.env.AXIMACH_MACHINE_SECRETS_FILE;
    if (secretsPath) {
      try { secret = JSON.parse(await readFile(secretsPath, "utf8"))[profile.id] || {}; }
      catch { fail("Machine secrets file is configured but cannot be read or parsed."); }
    }
    points = await readRestGateway(profile, secret);
  }
  return {
    id: profile.id, name: profile.name, protocol: profile.protocol,
    connected: points.some(point => point.quality === "GOOD"),
    sampledAt, points, readOnly: true
  };
}
