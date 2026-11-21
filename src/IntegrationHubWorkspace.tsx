import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { z } from "zod";
import { ArrowRight, ExternalLink, Plug, RefreshCw, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { getServerAuthHeaders, getServerAuthMode, readServerSession } from "./serverAuth";

const IntegrationSchema = z.object({
  id: z.string(),
  name: z.string(),
  family: z.string(),
  kind: z.string(),
  stage: z.string(),
  role: z.string(),
  upstream: z.string().optional(),
  license: z.string().optional(),
  requiredEnv: z.array(z.string()).optional(),
  configured: z.boolean(),
  status: z.string()
});
const CatalogueSchema = z.object({
  generatedAt: z.string(),
  total: z.number().int().nonnegative(),
  items: z.array(IntegrationSchema)
});
type Integration = z.infer<typeof IntegrationSchema>;
type Props = { onBack: () => void; onNotice: (message: string) => void; notice?: string };

function readConnection() {
  const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
  const key = window.localStorage.getItem("aximach.scheduler.key") || "";
  const userMode = getServerAuthMode() === "users";
  const session = readServerSession(base);
  if (!base || window.localStorage.getItem("aximach.storage.mode") === "local-only") {
    throw new Error("Connect the shared AXIMACH data server first. Open Follow-up Centre → PC ↔ Android shared data settings.");
  }
  if (userMode && (!session || session.user.role !== "admin")) {
    throw new Error("The integration registry requires an administrator sign-in on the shared AXIMACH server.");
  }
  if (!userMode && !key) throw new Error("The shared AXIMACH server API key is not available on this device.");
  return { base, headers: getServerAuthHeaders(key, base, session?.token, userMode) };
}
const stageLabel: Record<string,string> = {
  "in-app": "Already in AXIMACH",
  adding: "Being integrated",
  candidate: "Selected candidate",
  reference: "Reference / skill",
  verify: "Verify source / licence",
  provider: "External provider"
};
const statusLabel: Record<string,string> = {
  "configured-unverified": "Configured · not health-tested",
  "not-configured": "Needs server configuration",
  "in-app": "In current application",
  adding: "Integration foundation added"
};

export default function IntegrationHubWorkspace({ onBack, notice }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("All categories");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const chartRef = useRef<HTMLDivElement|null>(null);

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const connection = readConnection();
      const response = await fetch(connection.base + "/api/integrations/catalog", {
        headers: connection.headers,
        cache: "no-store"
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof payload === "object" && payload && "error" in payload ? String((payload as {error:unknown}).error) : "Integration catalogue request failed (HTTP " + response.status + ").");
      const parsed = CatalogueSchema.safeParse(payload);
      if (!parsed.success) throw new Error("The shared server returned an invalid integration catalogue. Refresh the server code before retrying.");
      if (parsed.data.total !== parsed.data.items.length) throw new Error("The integration catalogue count does not match its records.");
      setItems(parsed.data.items);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load integration catalogue.");
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const families = useMemo(() => ["All categories", ...Array.from(new Set(items.map(item => item.family))).sort()], [items]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter(item => (family === "All categories" || item.family === family) &&
      (!needle || [item.name,item.family,item.kind,item.role,item.license || "",item.stage].join(" ").toLowerCase().includes(needle)));
  }, [items, query, family]);
  const counts = useMemo(() => ({
    total: items.length,
    inApp: items.filter(item => item.stage === "in-app").length,
    adding: items.filter(item => item.stage === "adding").length,
    candidates: items.filter(item => item.stage === "candidate").length,
    verify: items.filter(item => item.stage === "verify").length,
    configured: items.filter(item => item.status === "configured-unverified").length
  }), [items]);

  useEffect(() => {
    const container = chartRef.current;
    if (!container || !items.length) return;
    const chart = echarts.init(container);
    const categoryData = Array.from(new Set(items.map(item => item.family))).sort().map(name => ({
      name,
      value: items.filter(item => item.family === name).length
    }));
    chart.setOption({
      animationDuration: 450,
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      legend: { type: "scroll", orient: "horizontal", bottom: 0, textStyle: { color: "inherit", fontSize: 10 } },
      series: [{
        name: "Toolkit coverage",
        type: "pie",
        radius: ["38%", "67%"],
        center: ["50%", "43%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 5, borderColor: "transparent", borderWidth: 2 },
        label: { show: true, formatter: "{b}", fontSize: 10 },
        labelLine: { length: 8, length2: 6 },
        data: categoryData
      }]
    });
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(container);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
    };
  }, [items]);

  return <section className="workspace-page intelligence-workspace integration-hub">
    <div className="workspace-topline">
      <button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button>
      <span className="demo-pill"><i/> ECOSYSTEM / CONNECTOR CONTROL</span>
    </div>
    {notice && <div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
    <div className="workspace-title-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-mark"/> PLATFORM SERVICES / OPEN ECOSYSTEM</div>
        <h1>Integrations &amp; API<span>.</span></h1>
        <p>One governed connector layer for AXIMACH engineering, manufacturing, analytics, AI and external intelligence.</p>
      </div>
      <button className="button-primary" type="button" disabled={busy} onClick={() => void refresh()}><RefreshCw size={14}/>{busy ? "Refreshing…" : "Refresh registry"}</button>
    </div>

    <div className="metric-grid dashboard-metric-grid integration-metrics">
      <article className="metric-card"><div className="metric-card-top"><span>Catalogue entries</span><Plug size={16}/></div><strong className="metric-number">{counts.total}</strong><div className="metric-card-bottom"><span>Across tool families</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Already in app</span><ShieldCheck size={16}/></div><strong className="metric-number">{counts.inApp}</strong><div className="metric-card-bottom"><span>Existing runtime capabilities</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Integration foundations</span><SlidersHorizontal size={16}/></div><strong className="metric-number">{counts.adding}</strong><div className="metric-card-bottom"><span>Added in this implementation slice</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Configured endpoints</span><Plug size={16}/></div><strong className="metric-number">{counts.configured}</strong><div className="metric-card-bottom"><span>Presence only; not a health check</span></div></article>
    </div>

    <div className="integration-hub-grid">
      <section className="surface-panel integration-chart-panel">
        <div className="panel-heading"><div><h3>Ecosystem coverage</h3><p>Catalogue entries by assigned capability family.</p></div></div>
        <div className="integration-chart" ref={chartRef} role="img" aria-label="Chart showing integration catalogue entries by capability family">
          {!items.length && <div className="module-empty-state">The chart appears when the secured registry loads.</div>}
        </div>
      </section>
      <section className="surface-panel integration-governance-panel">
        <div className="panel-heading"><div><h3>Connection governance</h3><p>How AXIMACH handles external tools.</p></div><ShieldCheck size={18}/></div>
        <div className="integration-governance-item"><strong>Server-side credentials</strong><span>Only environment-variable names are listed. Secret values are never returned to this screen.</span></div>
        <div className="integration-governance-item"><strong>Source and licence review</strong><span>Unverified names remain reference-only until the exact upstream and reuse terms are checked.</span></div>
        <div className="integration-governance-item"><strong>Human approval</strong><span>External findings do not automatically change supplier, customer, finance or production master records.</span></div>
      </section>
    </div>

    <section className="surface-panel integration-directory-panel">
      <div className="panel-heading">
        <div><h3>Integration directory</h3><p>{filtered.length} of {items.length} listed components, services, skills and references.</p></div>
        <span className="muted-copy">{loaded ? "Registry response received" : "Loading registry"}</span>
      </div>
      <div className="integration-filters">
        <label className="integration-search"><Search size={15}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search tool, capability, source or licence"/></label>
        <select value={family} onChange={event=>setFamily(event.target.value)} aria-label="Filter integration category">
          {families.map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      {error && <div className="module-safety-note integration-error" role="alert"><ShieldCheck size={15}/><span>{error}</span></div>}
      {!error && filtered.length === 0 && <div className="module-empty-state"><Plug size={24}/><h3>No matching integration</h3><p>Change the search or category filter.</p></div>}
      {filtered.length > 0 && <div className="integration-directory-list">
        {filtered.map(item=><article className="integration-directory-card" key={item.id}>
          <div className="integration-directory-main">
            <div className="integration-directory-name"><strong>{item.name}</strong><span>{item.family} · {item.kind.replaceAll("-"," ")}</span></div>
            <p>{item.role}</p>
            <div className="integration-directory-meta">
              <span className={"integration-stage stage-"+item.stage}>{stageLabel[item.stage] || item.stage}</span>
              {item.license && <span>Licence: {item.license}</span>}
              {item.requiredEnv?.length ? <span>Server setting: {item.requiredEnv.join(", ")}</span> : null}
            </div>
            {item.status === "configured-unverified" && <small className="integration-caution">The setting exists; endpoint authentication and actual service health have not been tested.</small>}
          </div>
          <div className="integration-directory-action">
            <span className={"integration-status status-"+item.status}>{statusLabel[item.status] || item.status.replaceAll("-"," ")}</span>
            {item.upstream && <a href={item.upstream} target="_blank" rel="noreferrer" aria-label={"Open upstream source for "+item.name}><ExternalLink size={14}/> Source</a>}
          </div>
        </article>)}
      </div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>This registry is a governance and readiness view, not a claim that every listed tool is installed or connected. A configured environment variable is not proof of a live, authenticated service. Each adapter must pass its own licence, security, connection and acceptance tests before being marked integrated.</span></div>
  </section>;
}
