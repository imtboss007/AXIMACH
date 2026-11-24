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
const PublicApiSchema = z.object({
  id: z.string(), name: z.string(), category: z.string(), description: z.string(),
  purpose: z.string(), auth: z.string(), https: z.string(), cors: z.string(),
  stage: z.string(), docs: z.string().url(), upstream: z.string().optional(),
  coverage: z.string(), limitation: z.string()
});
const PublicApiDirectorySchema = z.object({
  source: z.object({
    repository: z.string(), repositoryUrl: z.string().url(), readmeUrl: z.string().url(),
    license: z.string(), note: z.string()
  }),
  total: z.number().int().nonnegative(),
  items: z.array(PublicApiSchema)
});
const CatalogueSchema = z.object({
  generatedAt: z.string(),
  total: z.number().int().nonnegative(),
  items: z.array(IntegrationSchema),
  publicApis: PublicApiDirectorySchema.optional()
});
type Integration = z.infer<typeof IntegrationSchema>;
type PublicApiDirectory = z.infer<typeof PublicApiDirectorySchema>;
type FxResult = { provider:string;base:string;quotes:string[];date:string;rows:Array<{date:string;base:string;quote:string;rate:number}>;note:string;source:string };
type HolidayResult = { provider:string;country:string;year:number;holidays:Array<{date:string;name:string;localName?:string;countryCode:string;nationalHoliday:boolean;subdivisionCodes:string[]|null;holidayTypes:string[]}>;note:string;source:string };
type EvResult = { provider:string;state:string;city:string;stations:Array<{id:string;operator:string;ownership:string;state:string;district:string;city:string;address:string;latitude:number;longitude:number;locationQuality:string;connectors:string[];currents:string[];maxPowerKw:number|null;distanceKm:number|null}>;meta:{page:number;limit:number;totalFound:number;totalPages:number;source:{name:string;publisher?:string};attribution:string};note:string;source:string };
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

async function requestPublicApi<T>(path:string):Promise<T> {
  const base=(window.localStorage.getItem("aximach.scheduler.url")||"").trim().replace(/\/+$/, "");
  const key=window.localStorage.getItem("aximach.scheduler.key")||"";
  const userMode=getServerAuthMode()==="users";
  const session=readServerSession(base);
  if(!base||window.localStorage.getItem("aximach.storage.mode")==="local-only") throw new Error("Connect the shared AXIMACH data server first.");
  if(userMode&&(!session||session.user.role!=="admin")) throw new Error("Public API access requires a shared-server administrator account.");
  if(!userMode&&!key) throw new Error("The shared AXIMACH server API key is not available on this device.");
  const response=await fetch(base.replace(/\/+$/,"")+path,{headers:getServerAuthHeaders(key,base,session?.token,userMode),cache:"no-store"});
  const payload:unknown=await response.json().catch(()=>null);
  if(!response.ok){
    const message=typeof payload==="object"&&payload&&"error" in payload?String((payload as {error:unknown}).error):"Public API request failed (HTTP "+response.status+").";
    throw new Error(message);
  }
  return payload as T;
}
const publicApiStageLabel:Record<string,string>={"live-adapter":"Live AXIMACH adapter",candidate:"Optional candidate","review-required":"Review required"};

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
  const [publicApis,setPublicApis]=useState<PublicApiDirectory|null>(null);
  const [publicApiError,setPublicApiError]=useState("");
  const [fxBusy,setFxBusy]=useState(false);
  const [holidayBusy,setHolidayBusy]=useState(false);
  const [evBusy,setEvBusy]=useState(false);
  const [fxError,setFxError]=useState("");
  const [holidayError,setHolidayError]=useState("");
  const [evError,setEvError]=useState("");
  const [fxBase,setFxBase]=useState("INR");
  const [fxQuotes,setFxQuotes]=useState("USD,EUR,PLN");
  const [fxAmount,setFxAmount]=useState("1");
  const [fxData,setFxData]=useState<FxResult|null>(null);
  const [holidayCountry,setHolidayCountry]=useState("IN");
  const [holidayYear,setHolidayYear]=useState(String(new Date().getFullYear()));
  const [holidayData,setHolidayData]=useState<HolidayResult|null>(null);
  const [evState,setEvState]=useState("Karnataka");
  const [evCity,setEvCity]=useState("Bengaluru");
  const [evData,setEvData]=useState<EvResult|null>(null);
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
      setPublicApis(parsed.data.publicApis||null);
      setPublicApiError(parsed.data.publicApis?"":"The connected server has an older integration catalogue. Update the AXIMACH server to enable the curated public API directory.");
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load integration catalogue.");
      setLoaded(true);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const loadFx=async()=>{
    setFxBusy(true);setFxError("");
    try{
      const params=new URLSearchParams({base:fxBase.trim().toUpperCase(),quotes:fxQuotes.trim()});
      setFxData(await requestPublicApi<FxResult>("/api/public-apis/fx?"+params.toString()));
    }catch(error){setFxError(error instanceof Error?error.message:"Could not load reference FX rates.");}
    finally{setFxBusy(false);}
  };
  const loadHolidays=async()=>{
    setHolidayBusy(true);setHolidayError("");
    try{
      const params=new URLSearchParams({country:holidayCountry.trim().toUpperCase(),year:holidayYear.trim()});
      setHolidayData(await requestPublicApi<HolidayResult>("/api/public-apis/holidays?"+params.toString()));
    }catch(error){setHolidayError(error instanceof Error?error.message:"Could not load public holidays.");}
    finally{setHolidayBusy(false);}
  };
  const loadEvStations=async()=>{
    setEvBusy(true);setEvError("");
    try{
      const params=new URLSearchParams({state:evState.trim(),city:evCity.trim(),page:"1",limit:"20"});
      setEvData(await requestPublicApi<EvResult>("/api/public-apis/ev-stations?"+params.toString()));
    }catch(error){setEvError(error instanceof Error?error.message:"Could not load EV stations.");}
    finally{setEvBusy(false);}
  };


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

    <section className="surface-panel public-api-lab">
      <div className="panel-heading">
        <div><h3>Public API tools</h3><p>Read-only adapters curated from the public-apis directory. Results never write manufacturing, costing or schedule records.</p></div>
        <span className="integration-stage stage-adding">3 live read-only adapters</span>
      </div>
      {!publicApis && <div className="module-safety-note"><ShieldCheck size={15}/><span>{publicApiError||"Loading the curated API directory from the shared AXIMACH server."}</span></div>}
      {publicApis && <div className="public-api-source-note">
        <span>Source: <strong>{publicApis.source.repository}</strong> · {publicApis.total} selected entries · MIT catalogue licence</span>
        <a href={publicApis.source.readmeUrl} target="_blank" rel="noreferrer">Original directory <ExternalLink size={12}/></a>
      </div>}
      <div className="public-api-tools-grid">
        <article className="public-api-tool">
          <div className="public-api-tool-head"><span className="public-api-tool-code">FX / 01</span><span className="integration-stage stage-adding">Live adapter</span></div>
          <h4>Supplier currency reference</h4>
          <p>Frankfurter rates for imported materials, export quotations and supplier comparison. No key required.</p>
          <div className="public-api-form-grid">
            <label>Base currency<input value={fxBase} maxLength={3} onChange={event=>setFxBase(event.target.value.toUpperCase())} placeholder="INR"/></label>
            <label>Quote currencies<input value={fxQuotes} onChange={event=>setFxQuotes(event.target.value.toUpperCase())} placeholder="USD,EUR,PLN"/></label>
            <label>Illustrative amount<input inputMode="decimal" value={fxAmount} onChange={event=>setFxAmount(event.target.value)} placeholder="1"/></label>
          </div>
          <button type="button" className="button-primary compact-button" disabled={fxBusy||!fxBase.trim()||!fxQuotes.trim()} onClick={()=>void loadFx()}><RefreshCw size={13}/>{fxBusy?"Loading rates…":"Get reference rates"}</button>
          {fxError&&<div className="scheduler-error" role="alert">{fxError}</div>}
          {fxData&&<div className="public-api-result">
            <div className="public-api-result-head"><strong>{fxData.base} reference rates</strong><span>Rate date · {fxData.date||"Not supplied"}</span></div>
            {fxData.rows.map(row=><div className="public-api-fx-row" key={row.quote}><span>1 {row.base} =</span><strong>{row.rate.toLocaleString("en-IN",{maximumFractionDigits:6})} {row.quote}</strong><small>{fxAmount.trim()!==""&&Number.isFinite(Number(fxAmount))?(Number(fxAmount)*row.rate).toLocaleString("en-IN",{maximumFractionDigits:2})+" "+row.quote:""}</small></div>)}
            <small className="public-api-caveat">{fxData.note} <a href={fxData.source} target="_blank" rel="noreferrer">Source</a></small>
          </div>}
        </article>

        <article className="public-api-tool">
          <div className="public-api-tool-head"><span className="public-api-tool-code">CAL / 02</span><span className="integration-stage stage-adding">Live adapter</span></div>
          <h4>Factory working-day reference</h4>
          <p>Nager.Date public holidays with first-level subdivision codes where the provider supplies them.</p>
          <div className="public-api-form-grid">
            <label>Country code<input value={holidayCountry} maxLength={2} onChange={event=>setHolidayCountry(event.target.value.toUpperCase())} placeholder="IN"/></label>
            <label>Calendar year<input inputMode="numeric" value={holidayYear} maxLength={4} onChange={event=>setHolidayYear(event.target.value)} placeholder="2026"/></label>
          </div>
          <button type="button" className="button-primary compact-button" disabled={holidayBusy||holidayCountry.length!==2||holidayYear.length!==4} onClick={()=>void loadHolidays()}><RefreshCw size={13}/>{holidayBusy?"Loading calendar…":"Load holidays"}</button>
          {holidayError&&<div className="scheduler-error" role="alert">{holidayError}</div>}
          {holidayData&&<div className="public-api-result">
            <div className="public-api-result-head"><strong>{holidayData.country} · {holidayData.year}</strong><span>{holidayData.holidays.length} holidays</span></div>
            <div className="public-api-holiday-list">{holidayData.holidays.slice(0,18).map((holiday,index)=><div className="public-api-holiday-row" key={holiday.date+"-"+holiday.name+"-"+index}><time>{holiday.date}</time><strong>{holiday.localName||holiday.name}</strong><small>{holiday.subdivisionCodes?.join(", ")||(holiday.nationalHoliday?"National":"Regional / unspecified")}</small></div>)}</div>
            <small className="public-api-caveat">{holidayData.note} <a href={holidayData.source} target="_blank" rel="noreferrer">Source</a></small>
          </div>}
        </article>

        <article className="public-api-tool">
          <div className="public-api-tool-head"><span className="public-api-tool-code">EV / 03</span><span className="integration-stage stage-adding">Live adapter</span></div>
          <h4>India EV charging directory</h4>
          <p>Third-party directory of public charging locations, connector types and rated charging power.</p>
          <div className="public-api-form-grid">
            <label>State / UT<input value={evState} onChange={event=>setEvState(event.target.value)} placeholder="Karnataka"/></label>
            <label>City<input value={evCity} onChange={event=>setEvCity(event.target.value)} placeholder="Bengaluru"/></label>
          </div>
          <button type="button" className="button-primary compact-button" disabled={evBusy||evState.trim().length<2} onClick={()=>void loadEvStations()}><RefreshCw size={13}/>{evBusy?"Searching…":"Find charging stations"}</button>
          {evError&&<div className="scheduler-error" role="alert">{evError}</div>}
          {evData&&<div className="public-api-result">
            <div className="public-api-result-head"><strong>{evData.city||evData.state}</strong><span>{evData.meta.totalFound.toLocaleString("en-IN")} listed · page {evData.meta.page}/{evData.meta.totalPages||1}</span></div>
            <div className="public-api-ev-list">{evData.stations.slice(0,10).map(station=><div className="public-api-ev-row" key={station.id}><strong>{station.operator}</strong><span>{station.address}</span><small>{station.connectors.join(" · ")||"Connector not recorded"} · {station.maxPowerKw===null?"Power not recorded":station.maxPowerKw+" kW"}</small><a href={"https://www.openstreetmap.org/?mlat="+station.latitude+"&mlon="+station.longitude+"#map=17/"+station.latitude+"/"+station.longitude} target="_blank" rel="noreferrer">Map location <ExternalLink size={11}/></a></div>)}</div>
            <small className="public-api-caveat">{evData.note} Attribution: {evData.meta.attribution} <a href={evData.source} target="_blank" rel="noreferrer">API source</a></small>
          </div>}
        </article>
      </div>
      {publicApis&&<div className="public-api-directory-block">
        <div className="panel-heading"><div><h4>Additional APIs screened</h4><p>Candidate providers are listed, not connected. Their authentication, licence, quotas and data terms still apply.</p></div></div>
        <div className="public-api-directory-grid">{publicApis.items.map(item=><article className="public-api-directory-card" key={item.id}>
          <div className="public-api-directory-top"><strong>{item.name}</strong><span className={"integration-stage stage-"+(item.stage==="live-adapter"?"adding":item.stage==="review-required"?"verify":"candidate")}>{publicApiStageLabel[item.stage]||item.stage}</span></div>
          <small>{item.category} · Auth: {item.auth} · HTTPS: {item.https} · CORS: {item.cors}</small>
          <p>{item.purpose}</p>
          <details><summary>Coverage and limitations</summary><p>{item.coverage}</p><p>{item.limitation}</p></details>
          <a href={item.docs} target="_blank" rel="noreferrer">Provider documentation <ExternalLink size={12}/></a>
        </article>)}</div>
      </div>}
    </section>

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
