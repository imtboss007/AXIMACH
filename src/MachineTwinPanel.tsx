import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, Cable, CheckCircle2, CircleDot, PlugZap, Plus, RefreshCw, ShieldCheck, Trash2, Waves } from "lucide-react";

type Protocol = "OPC UA" | "Modbus TCP" | "MTConnect" | "REST gateway";
type Signal = Record<string, unknown> & { key: string; label?: string };
type Profile = { id: string; name: string; protocol: Protocol; endpoint: string; unitId?: number; signals: Signal[]; readOnly: true };
type Point = { key: string; label: string; value: unknown; quality: string; sourceTimestamp: string | null; sampledAt: string };
type Snapshot = { id: string; name: string; protocol: Protocol; connected: boolean; sampledAt: string; points: Point[]; readOnly: true };
type MachineState = { profiles: Profile[]; latest: Record<string, Snapshot> };

const EXAMPLES: Record<Protocol, string> = {
  "OPC UA": JSON.stringify([{ key: "spindleSpeed", label: "Spindle speed", nodeId: "ns=2;s=Machine.SpindleSpeed" }, { key: "machineState", label: "Machine state", nodeId: "ns=2;s=Machine.State" }], null, 2),
  "Modbus TCP": JSON.stringify([{ key: "spindleSpeed", label: "Spindle speed", address: 0, functionCode: 4, dataType: "uint16", scale: 1 }, { key: "machineState", label: "Machine state", address: 1, functionCode: 4, dataType: "uint16", scale: 1 }], null, 2),
  "MTConnect": JSON.stringify([{ key: "spindleSpeed", label: "Spindle speed", dataItemId: "spindle-speed" }, { key: "machineState", label: "Machine state", dataItemId: "execution" }], null, 2),
  "REST gateway": JSON.stringify([{ key: "machineState", label: "Machine state", jsonPointer: "/state" }, { key: "spindleSpeed", label: "Spindle speed", jsonPointer: "/spindle/speed" }], null, 2)
};

function serverConfig() {
  const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
  const key = window.localStorage.getItem("aximach.scheduler.key") || "";
  return base && key ? { base, key } : null;
}
function formatValue(value: unknown) {
  if (value === null || value === undefined) return "No data";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function MachineTwinPanel() {
  const [protocol, setProtocol] = useState<Protocol>("OPC UA");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [unitId, setUnitId] = useState("1");
  const [signalJson, setSignalJson] = useState(EXAMPLES["OPC UA"]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [latest, setLatest] = useState<Record<string, Snapshot>>({});
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);
  const pollingRef = useRef(false);
  const config = serverConfig();

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const cfg = serverConfig();
    if (!cfg) throw new Error("AXIMACH shared-data server URL and API key are not configured on this device. Open Follow-up Registry → Server settings first.");
    const response = await fetch(cfg.base + path, {
      ...init,
      headers: { "content-type": "application/json", "x-aximach-key": cfg.key, ...(init.headers || {}) },
      signal: AbortSignal.timeout(10000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Machine gateway request failed (" + response.status + ").");
    return payload;
  }, []);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await request("/api/machine-twins");
      setProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      setLatest(data.latest || {});
      if (!selectedId && data.profiles?.[0]?.id) setSelectedId(data.profiles[0].id);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load machine twins.");
    }
  }, [request, selectedId]);

  useEffect(() => { void loadProfiles(); }, [loadProfiles]);

  const poll = useCallback(async (id: string) => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      const data = await request("/api/machine-twins/" + encodeURIComponent(id) + "/poll", { method: "POST", body: "{}" });
      if (data.snapshot) setLatest(current => ({ ...current, [id]: data.snapshot as Snapshot }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Machine poll failed.");
    } finally { pollingRef.current = false; }
  }, [request]);

  useEffect(() => {
    if (!selectedId || !autoPoll) return;
    void poll(selectedId);
    const timer = window.setInterval(() => { void poll(selectedId); }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedId, autoPoll, poll]);

  const saveProfile = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const signals = JSON.parse(signalJson) as Signal[];
      if (!Array.isArray(signals)) throw new Error("Signals must be a JSON array.");
      const data = await request("/api/machine-twins", { method: "POST", body: JSON.stringify({ profile: { name, protocol, endpoint, unitId: Number(unitId), signals } }) });
      const profile = data.profile as Profile;
      setProfiles(current => [...current.filter(item => item.id !== profile.id), profile]);
      setSelectedId(profile.id);
      setNotice("Machine twin profile saved. Attempting a read-only telemetry poll.");
      await poll(profile.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save machine profile.");
    } finally { setBusy(false); }
  };

  const removeProfile = async (id: string) => {
    if (!window.confirm("Remove this machine twin profile and its latest snapshot? No controller settings or machine data will be written.")) return;
    try {
      await request("/api/machine-twins/" + encodeURIComponent(id), { method: "DELETE" });
      setProfiles(current => current.filter(item => item.id !== id));
      setLatest(current => { const next = { ...current }; delete next[id]; return next; });
      setSelectedId(current => current === id ? "" : current);
      setNotice("Machine twin profile removed.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not remove profile."); }
  };

  const snapshot = selectedId ? latest[selectedId] : undefined;
  return <section className="irl-card irl-connection irl-machine-live">
    <div className="irl-section-heading"><div><small>03 / INDUSTRIAL CONNECTIVITY</small><h2>Live machine twin</h2></div><PlugZap size={19}/></div>
    <div className="irl-connection-status"><i/> {snapshot?.connected ? "LIVE READ-ONLY DATA" : "NOT CONNECTED"} <span>{config ? "Authenticated gateway configured" : "Shared server not configured"}</span></div>
    <p>Connect an approved private-LAN gateway. AXIMACH reads configured signals only; there are no controller write, cycle-start, feed-hold or machine-control commands.</p>
    <div className="irl-machine-create">
      <label>Protocol <select value={protocol} onChange={e => { const p=e.target.value as Protocol; setProtocol(p); setSignalJson(EXAMPLES[p]); }}>{Object.keys(EXAMPLES).map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Machine / asset name <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. VMC-01"/></label>
      <label className="irl-endpoint-label">Gateway endpoint <input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder={protocol === "Modbus TCP" ? "tcp://192.168.1.40:502" : protocol === "OPC UA" ? "opc.tcp://192.168.1.40:4840" : protocol === "MTConnect" ? "http://192.168.1.40:5000/current" : "http://192.168.1.40:8080/telemetry"}/></label>
      {protocol === "Modbus TCP" && <label>Modbus unit ID <input type="number" min="1" max="247" value={unitId} onChange={e => setUnitId(e.target.value)}/></label>}
      <label className="irl-machine-signal-label">Signal map JSON <textarea rows={7} spellCheck={false} value={signalJson} onChange={e => setSignalJson(e.target.value)}/></label>
    </div>
    <div className="irl-machine-actions"><button type="button" className="irl-save-profile" disabled={busy || !name.trim() || !endpoint.trim() || !config} onClick={() => void saveProfile()}><Plus size={14}/>{busy ? "Saving…" : "Save & poll machine"}</button><button type="button" className="irl-save-profile secondary" onClick={() => void loadProfiles()}><RefreshCw size={14}/> Refresh twins</button><label><input type="checkbox" checked={autoPoll} onChange={e => setAutoPoll(e.target.checked)}/> Poll every 5 seconds</label></div>
    {profiles.length > 0 && <div className="irl-machine-list"><small>SAVED MACHINE TWINS</small>{profiles.map(profile => <div key={profile.id} className={profile.id === selectedId ? "selected" : ""}><button type="button" onClick={() => setSelectedId(profile.id)}><b>{profile.name}</b><span>{profile.protocol} · {profile.signals.length} signals</span></button><button type="button" aria-label={"Remove " + profile.name} onClick={() => void removeProfile(profile.id)}><Trash2 size={14}/></button></div>)}</div>}
    {snapshot && <div className="irl-machine-readings"><div className="irl-machine-readings-head"><b><Activity size={15}/> {snapshot.name} / TELEMETRY</b><span>{snapshot.sampledAt ? new Date(snapshot.sampledAt).toLocaleString() : "Awaiting sample"}</span></div>{snapshot.points.map(point => <div className="irl-machine-point" key={point.key}><span><b>{point.label || point.key}</b><small>{point.key} · {point.sourceTimestamp ? "source " + new Date(point.sourceTimestamp).toLocaleString() : "gateway sample"}</small></span><strong>{formatValue(point.value)}</strong><em className={point.quality === "GOOD" ? "good" : "unknown"}>{point.quality}</em></div>)}</div>}
    {notice && <p className="irl-machine-notice"><CheckCircle2 size={14}/>{notice}</p>}
    {error && <p className="irl-machine-error"><AlertTriangle size={14}/>{error}</p>}
    <p className="irl-connection-note"><ShieldCheck size={14}/> Connections are restricted to loopback/private LAN addresses. Configure secrets only on the gateway PC in the local machine-secrets JSON file. For OPC UA, use certificate-backed SignAndEncrypt; anonymous None mode is blocked unless an administrator explicitly opts in. Never place passwords, private keys or certificates in the browser profile or GitHub repository.</p>
  </section>;
}
export default MachineTwinPanel;
