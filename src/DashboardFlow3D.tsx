
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Boxes, ChevronLeft, ChevronRight, Maximize2, Pause, Play, RotateCcw, RotateCw, Truck, ZoomIn, ZoomOut } from "lucide-react";
import type { OperationRecord, ComponentRecord, PurchaseOrderRecord, CompanyRecord } from "./manufacturingData";
import ProcessVisualIcon from "./ProcessVisualIcon";
type Props = {
  operations: OperationRecord[];
  components: ComponentRecord[];
  orders: PurchaseOrderRecord[];
  companies: CompanyRecord[];
  onOpenOperation: (selection: { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string }) => void;
};
const formatDate = (value?: string) => value
  ? new Date(value + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
  : "Not scheduled";
export default function DashboardFlow3D({ operations, components, orders, companies, onOpenOperation }: Props) {
  const [companyId, setCompanyId] = useState("");
  const [poId, setPoId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [active, setActive] = useState(0);
  const [yaw, setYaw] = useState(-16);
  const [pitch, setPitch] = useState(14);
  const [zoom, setZoom] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [closeup, setCloseup] = useState(false);
  const filteredOperations = useMemo(() => operations.filter(operation => {
    const po = orders.find(item => item.id === operation.poId);
    return (!companyId || po?.companyId === companyId) &&
      (!poId || operation.poId === poId) &&
      (!componentId || operation.componentId === componentId);
  }).sort((a, b) => {
    const poA = orders.find(item => item.id === a.poId)?.number || "";
    const poB = orders.find(item => item.id === b.poId)?.number || "";
    return poA.localeCompare(poB) || a.poLineId.localeCompare(b.poLineId) || a.sequence - b.sequence;
  }), [operations, orders, companyId, poId, componentId]);
  const rows = filteredOperations.slice(0, 12);
  const selected = rows[Math.min(active, Math.max(0, rows.length - 1))];
  const po = selected ? orders.find(item => item.id === selected.poId) : undefined;
  const component = selected ? components.find(item => item.id === selected.componentId) : undefined;
  const company = po ? companies.find(item => item.id === po.companyId) : undefined;
  const poOptions = orders.filter(order => !companyId || order.companyId === companyId);
  const componentOptions = components.filter(item => operations.some(operation =>
    operation.componentId === item.id &&
    (!companyId || orders.find(order => order.id === operation.poId)?.companyId === companyId) &&
    (!poId || operation.poId === poId)
  ));
  useEffect(() => { setActive(0); setPlaying(false); setCloseup(false); }, [companyId, poId, componentId]);
  useEffect(() => {
    if (active >= rows.length && rows.length) setActive(rows.length - 1);
    if (!rows.length) { setActive(0); setPlaying(false); }
  }, [rows.length, active]);
  useEffect(() => {
    if (!playing || rows.length < 2) return;
    if (active >= rows.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setActive(index => Math.min(rows.length - 1, index + 1)), 1350);
    return () => window.clearTimeout(timer);
  }, [playing, active, rows.length]);
  const choose = (index: number) => { setPlaying(false); setActive(Math.max(0, Math.min(rows.length - 1, index))); };
  const playRoute = () => {
    if (rows.length < 2) return;
    if (active >= rows.length - 1) setActive(0);
    setCloseup(false);
    setPlaying(true);
  };
  const resetCamera = () => { setYaw(-16); setPitch(14); setZoom(1); setCloseup(false); };
  return <div className="axi-dashboard-flow3d">
    <div className="axi-flow3d-topline"><span><i/> LIVE MANUFACTURING ROUTE</span><span>{filteredOperations.length} MATCHING STAGES · {rows.length} IN VIEW</span></div>
    <div className="axi-flow3d-filters" aria-label="Dashboard route filters">
      <label>COMPANY<select value={companyId} onChange={event => { setCompanyId(event.target.value); setPoId(""); setComponentId(""); }}><option value="">All companies</option>{companies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>PURCHASE ORDER<select value={poId} onChange={event => { setPoId(event.target.value); setComponentId(""); }}><option value="">All POs</option>{poOptions.map(item => <option key={item.id} value={item.id}>{item.number}</option>)}</select></label>
      <label>COMPONENT<select value={componentId} onChange={event => setComponentId(event.target.value)}><option value="">All components</option>{componentOptions.map(item => <option key={item.id} value={item.id}>{item.partNumber} · {item.name}</option>)}</select></label>
    </div>
    <div className="axi-flow3d-stage">
      <div className={"axi-flow3d-scene" + (closeup ? " is-closeup" : "")} style={{ "--flow-yaw": yaw + "deg", "--flow-pitch": pitch + "deg", "--flow-zoom": zoom } as CSSProperties}>
        <div className="axi-flow3d-grid"/>
        <div className="axi-flow3d-track">
          {rows.length ? rows.map((operation, index) => <button type="button" key={operation.id}
            className={"axi-flow3d-node " + (index === active ? "is-active " : "") + (operation.status === "Complete" ? "is-complete" : "")}
            style={{ "--node-index": index, "--node-count": rows.length } as CSSProperties}
            onClick={() => { choose(index); setCloseup(true); }} title={operation.name + " · " + operation.status}>
            <ProcessVisualIcon name={operation.name} category={operation.category} size="md"/>
            <small>{String(index + 1).padStart(2, "0")}</small><span>{operation.name}</span>
          </button>) : <div className="axi-flow3d-empty"><Boxes size={34}/><strong>No matching production stages</strong><span>Create operations in Process Planning or clear the filters.</span></div>}
        </div>
        {selected && <div className="axi-flow3d-focus"><ProcessVisualIcon name={selected.name} category={selected.category} size="lg"/><small>SELECTED PROCESS</small><strong>{selected.name}</strong><span>{selected.category || "Process"} · {selected.status}</span></div>}
      </div>
      <div className="axi-flow3d-tools">
        <div className="axi-flow3d-toolgroup"><button type="button" title="Rotate left" onClick={() => setYaw(value => Math.max(-60, value - 10))}><RotateCcw size={14}/></button><button type="button" title="Rotate right" onClick={() => setYaw(value => Math.min(60, value + 10))}><RotateCw size={14}/></button><button type="button" title="Tilt up" onClick={() => setPitch(value => Math.max(-10, value - 5))}>↑</button><button type="button" title="Tilt down" onClick={() => setPitch(value => Math.min(40, value + 5))}>↓</button></div>
        <div className="axi-flow3d-toolgroup"><button type="button" title="Zoom out" onClick={() => setZoom(value => Math.max(.62, Number((value - .08).toFixed(2))))}><ZoomOut size={14}/></button><button type="button" title="Zoom in" onClick={() => setZoom(value => Math.min(1.5, Number((value + .08).toFixed(2))))}><ZoomIn size={14}/></button><button type="button" title="Reset camera" onClick={resetCamera}><RotateCcw size={14}/></button></div>
        <div className="axi-flow3d-toolgroup"><button type="button" title="Previous stage" disabled={!rows.length} onClick={() => choose(active - 1)}><ChevronLeft size={14}/></button><button type="button" title={playing ? "Pause walkthrough" : "Play walkthrough"} disabled={rows.length < 2} onClick={() => playing ? setPlaying(false) : playRoute()}>{playing ? <Pause size={14}/> : <Play size={14}/>}</button><button type="button" title="Next stage" disabled={!rows.length} onClick={() => choose(active + 1)}><ChevronRight size={14}/></button></div>
      </div>
    </div>
    <div className="axi-flow3d-bottom">
      <div><small>COMPANY / PURCHASE ORDER</small><strong>{company?.name || "Multiple / all companies"} · {po?.number || "Multiple / all POs"}</strong><span>{component?.partNumber || "Select a route stage"} · {component?.name || "Component"}</span></div>
      <div><small>STAGE / DUE DATE</small><strong>{rows.length ? String(active + 1).padStart(2, "0") + " / " + String(rows.length).padStart(2, "0") : "—"}</strong><span>{selected ? formatDate(selected.plannedStart) + " → " + formatDate(selected.plannedEnd) : "No scheduled stage"}</span></div>
      <button type="button" className="axi-flow3d-open" disabled={!selected || !po} onClick={() => selected && po && onOpenOperation({ companyId: po.companyId, factoryId: po.factoryId, poId: po.id, poLineId: selected.poLineId, operationId: selected.id })}><Maximize2 size={14}/> Open process</button>
    </div>
    <div className="axi-flow3d-footnote"><Truck size={13}/> Route playback follows saved operation order; it does not alter production records. {filteredOperations.length > rows.length ? "Use the filters to narrow the route; first 12 stages are shown." : "Select a stage to inspect or open its saved record."}</div>
  </div>;
}
