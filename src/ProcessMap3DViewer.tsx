import { useEffect, useMemo, useState } from "react";
import {
  Crosshair, Maximize2, Pause, Play, RotateCcw, RotateCw,
  StepForward, ZoomIn, ZoomOut
} from "lucide-react";
import type { OperationRecord } from "./manufacturingData";
import ProcessVisualIcon from "./ProcessVisualIcon";

type VendorLabel = { id: string; company: string };
type Props = {
  operations: OperationRecord[];
  vendors: VendorLabel[];
  selectedOperationId?: string;
  showVendor: boolean;
  showPrice: boolean;
  onSelectOperation: (operationId: string) => void;
};
const dateLabel = (value?: string) => value
  ? new Date(value + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
  : "Not set";
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z]+/g, "-");

export default function ProcessMap3DViewer({
  operations, vendors, selectedOperationId, showVendor, showPrice, onSelectOperation
}: Props) {
  const [yaw, setYaw] = useState(-13);
  const [pitch, setPitch] = useState(16);
  const [zoom, setZoom] = useState(0.92);
  const [playing, setPlaying] = useState(false);
  const [simulationStep, setSimulationStep] = useState(-1);
  const [closeup, setCloseup] = useState(false);
  const [layoutMode, setLayoutMode] = useState<"route" | "sphere" | "vortex" | "cube" | "molecular">("route");
  const sorted = useMemo(
    () => [...operations].sort((a, b) => a.sequence - b.sequence || a.name.localeCompare(b.name)),
    [operations]
  );
  const lanes = useMemo(() => {
    const names = [...new Set(sorted.map(operation => operation.branch || "Main route"))];
    names.sort((a, b) => a === "Main route" ? -1 : b === "Main route" ? 1 : a.localeCompare(b));
    return names.map(name => {
      const items = sorted.filter(operation => (operation.branch || "Main route") === name);
      const parents = [...new Set(items.map(operation => operation.parentId).filter(Boolean))]
        .map(id => sorted.find(operation => operation.id === id)?.name || "")
        .filter(Boolean);
      return { name, items, parents };
    });
  }, [sorted]);
  const selected = sorted.find(operation => operation.id === selectedOperationId) || sorted[0];
  const spatialPositions = useMemo(() => sorted.map((operation, index) => {
    const total = Math.max(1, sorted.length);
    const t = (index + 0.5) / total;
    let x = 50, y = 50, depth = 0;
    if (layoutMode === "sphere" || layoutMode === "molecular") {
      if (total === 1) { x = 50; y = 50; }
      else {
        const z = 1 - 2 * t;
        const radius = Math.sqrt(Math.max(0, 1 - z * z));
        const angle = index * 2.399963229728653;
        x = 50 + radius * Math.cos(angle) * (layoutMode === "sphere" ? 39 : 33);
        y = 50 - z * (layoutMode === "sphere" ? 34 : 29);
        depth = z;
      }
    } else if (layoutMode === "vortex") {
      const radius = 5 + t * 39;
      const angle = index * 0.82 - Math.PI / 2;
      x = 50 + Math.cos(angle) * radius;
      y = 50 + Math.sin(angle) * radius * 0.72;
      depth = t;
    } else if (layoutMode === "cube") {
      const layer = Math.floor(index / 4);
      const inset = Math.max(0.28, 1 - layer * 0.19);
      const corners = [{x:50,y:12},{x:88,y:34},{x:50,y:56},{x:12,y:34}];
      const from = corners[index % 4], to = corners[(index % 4 + 1) % 4];
      x = 50 + (from.x + (to.x - from.x) * 0.5 - 50) * inset;
      y = 34 + (from.y + (to.y - from.y) * 0.5 - 34) * inset;
      depth = inset;
    }
    return { id: operation.id, x, y, depth, index };
  }), [sorted, layoutMode]);
  const positionById = useMemo(() => new Map(spatialPositions.map(point => [point.id, point])), [spatialPositions]);


  useEffect(() => {
    if (!playing || sorted.length < 2) return;
    if (simulationStep >= sorted.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setSimulationStep(current => Math.min(sorted.length - 1, current + 1)), 1050);
    return () => window.clearTimeout(timer);
  }, [playing, simulationStep, sorted.length]);

  useEffect(() => {
    if (simulationStep >= sorted.length) setSimulationStep(sorted.length - 1);
    if (sorted.length === 0) {
      setSimulationStep(-1);
      setPlaying(false);
    }
  }, [sorted.length, simulationStep]);
  useEffect(() => {
    if (simulationStep >= 0 && sorted[simulationStep]) onSelectOperation(sorted[simulationStep].id);
  }, [simulationStep]);

  const startSimulation = () => {
    if (!sorted.length) return;
    if (sorted.length === 1) {
      setSimulationStep(0);
      setPlaying(false);
      return;
    }
    if (simulationStep >= sorted.length - 1 || simulationStep < 0) setSimulationStep(0);
    setPlaying(true);
  };
  const resetCamera = () => {
    setYaw(-13);
    setPitch(16);
    setZoom(0.92);
    setCloseup(false);
  };
  const focusSelected = () => {
    if (!selected) return;
    onSelectOperation(selected.id);
    setCloseup(true);
    setPitch(5);
    setYaw(-4);
    setZoom(1.16);
  };
  const vendorName = (id: string) => vendors.find(vendor => vendor.id === id)?.company || "Vendor not assigned";

  return <section className={"surface-panel process-map-3d-viewer " + (closeup ? "is-closeup" : "")}>
    <div className="pm3d-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-mark"/> INTERACTIVE ROUTE STUDIO</div>
        <h3>3D process route <span>·</span> {operations.length} saved stage(s)</h3>
        <p>Rotate the route, zoom into any stage and play a step-by-step route walkthrough. Saved operation records are not changed by the simulation.</p>
      </div>
      <span className="pm3d-live-indicator"><i/> RECORD-LINKED VIEW</span>
    </div>

    <div className="pm3d-layout-switcher" aria-label="Process map visualisation modes">
      {([{id:"route",label:"Conventional route"},{id:"sphere",label:"Sphere"},{id:"vortex",label:"Vortex"},{id:"cube",label:"Cube"},{id:"molecular",label:"Molecular network"}] as const).map(option =>
        <button type="button" key={option.id} className={layoutMode===option.id?"active":""} aria-pressed={layoutMode===option.id} onClick={()=>setLayoutMode(option.id)}>{option.label}</button>
      )}
    </div>
    <div className="pm3d-control-deck">
      <div className="pm3d-control-group">
        <span className="pm3d-control-label">CAMERA</span>
        <button type="button" className="button-quiet compact-button" onClick={() => setYaw(value => Math.max(-55, value - 9))} title="Rotate left"><RotateCcw size={13}/> Left</button>
        <button type="button" className="button-quiet compact-button" onClick={() => setYaw(value => Math.min(55, value + 9))} title="Rotate right"><RotateCw size={13}/> Right</button>
        <button type="button" className="button-quiet compact-button" onClick={() => setPitch(value => Math.max(-8, value - 6))} title="Lower camera">Lower</button>
        <button type="button" className="button-quiet compact-button" onClick={() => setPitch(value => Math.min(38, value + 6))} title="Raise camera">Raise</button>
        <label className="pm3d-angle-control">YAW<input aria-label="Camera yaw" type="range" min="-55" max="55" step="1" value={yaw} onChange={event=>setYaw(Number(event.target.value))}/></label>
        <label className="pm3d-angle-control">PITCH<input aria-label="Camera pitch" type="range" min="-8" max="38" step="1" value={pitch} onChange={event=>setPitch(Number(event.target.value))}/></label>
      </div>
      <div className="pm3d-control-group">
        <span className="pm3d-control-label">ZOOM</span>
        <button type="button" className="button-quiet compact-button" onClick={() => setZoom(value => Math.max(0.58, Number((value - 0.1).toFixed(2))))} title="Zoom out"><ZoomOut size={14}/></button>
        <input aria-label="3D process map zoom" type="range" min="0.58" max="1.35" step="0.01" value={zoom} onChange={event => setZoom(Number(event.target.value))}/>
        <button type="button" className="button-quiet compact-button" onClick={() => setZoom(value => Math.min(1.35, Number((value + 0.1).toFixed(2))))} title="Zoom in"><ZoomIn size={14}/></button>
        <span className="pm3d-zoom-readout">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="pm3d-control-group pm3d-playback">
        <span className="pm3d-control-label">ROUTE WALKTHROUGH</span>
        {!playing
          ? <button type="button" className="button-primary compact-button" disabled={!sorted.length} onClick={startSimulation}><Play size={13}/> {simulationStep >= 0 && simulationStep < sorted.length - 1 ? "Resume" : "Play route"}</button>
          : <button type="button" className="button-primary compact-button" onClick={() => setPlaying(false)}><Pause size={13}/> Pause</button>}
        <button type="button" className="button-quiet compact-button" disabled={!sorted.length} onClick={() => {setPlaying(false);setSimulationStep(0);if(sorted[0])onSelectOperation(sorted[0].id);}}><RotateCcw size={13}/> Restart</button>
        <button type="button" className="button-quiet compact-button" disabled={!sorted.length || simulationStep >= sorted.length - 1} onClick={() => {setPlaying(false);setSimulationStep(value => Math.min(sorted.length - 1, Math.max(0, value + 1)));}}><StepForward size={13}/> Next stage</button>
        <span className="pm3d-step-readout">{sorted.length ? (simulationStep < 0 ? "Ready" : (simulationStep + 1) + " / " + sorted.length) : "No route"}</span>
      </div>
      <div className="pm3d-control-group pm3d-focus-actions">
        <button type="button" className="button-quiet compact-button" onClick={focusSelected} disabled={!selected}><Crosshair size={13}/> Close-up selected</button>
        {closeup && <button type="button" className="button-quiet compact-button" onClick={resetCamera}><Maximize2 size={13}/> Fit full route</button>}
        {!closeup && <button type="button" className="button-quiet compact-button" onClick={resetCamera}><Maximize2 size={13}/> Reset view</button>}
      </div>
    </div>

    {layoutMode === "route" ? <div className="pm3d-scene-viewport">
      <div className="pm3d-scene-grid"/>
      {sorted.length ? <div className="pm3d-scene" style={{ transform: "perspective(1350px) rotateX(" + pitch + "deg) rotateY(" + yaw + "deg) scale(" + zoom + ")" }}>
        <div className="pm3d-floor-plate"/>
        {lanes.map((lane, laneIndex) => <div className={"pm3d-lane " + (lane.name === "Main route" ? "pm3d-main-lane" : "pm3d-branch-lane")} key={lane.name} style={{ transform: "translateZ(" + (laneIndex * 18) + "px)" }}>
          <div className="pm3d-lane-label"><b>{lane.name === "Main route" ? "PRIMARY ROUTE" : "ALTERNATE / REWORK"}</b><span>{lane.items.length} stage(s){lane.parents.length ? " · branches from " + lane.parents.join(", ") : ""}</span></div>
          <div className="pm3d-node-row">
            {lane.items.map((operation, index) => {
              const globalIndex = sorted.findIndex(item => item.id === operation.id);
              const selectedNode = operation.id === selected?.id;
              const simulated = simulationStep >= globalIndex;
              const isCurrent = simulationStep === globalIndex;
              const vendor = vendorName(operation.vendorId);
              return <div className="pm3d-node-wrap" key={operation.id}>
                <button
                  type="button"
                  className={"pm3d-node status-" + statusClass(operation.status) + (selectedNode ? " selected" : "") + (simulated ? " simulated" : "") + (isCurrent ? " simulation-current" : "")}
                  style={{ transform: "translateZ(" + (Math.min(index, 7) * 9) + "px)", animationDelay: (Math.min(index, 8) * 55) + "ms" }}
                  onClick={() => {setPlaying(false);setSimulationStep(-1);onSelectOperation(operation.id);setCloseup(true);setYaw(-4);setPitch(5);setZoom(1.16);}}
                  title={"Focus " + operation.name}
                >
                  <span className="pm3d-node-top"><small>STAGE {String(globalIndex + 1).padStart(2, "0")}</small><small>OP-{String(operation.sequence).padStart(3, "0")}</small></span>
                  <span className="pm3d-node-symbol"><ProcessVisualIcon name={operation.name} category={operation.category} size="md"/></span>
                  <strong>{operation.name}</strong>
                  <span className="pm3d-node-date"><small>GIVEN</small><b>{dateLabel(operation.plannedStart)}</b></span>
                  <span className="pm3d-node-date"><small>DELIVERY</small><b>{dateLabel(operation.plannedEnd)}</b></span>
                  <span className="pm3d-node-qty"><small>QTY</small><b>{operation.quantity.toLocaleString("en-IN")} pcs</b></span>
                  {showVendor && <span className="pm3d-node-optional"><small>PROCESS VENDOR</small><b>{vendor}</b></span>}
                  {showVendor && <span className="pm3d-node-optional"><small>TRANSPORT VENDOR</small><b>{vendorName(operation.transportVendorId)}</b></span>}
                  {showPrice && <span className="pm3d-node-optional"><small>PRICE / PC</small><b>{money(operation.ratePerPart)}</b></span>}
                  <span className="pm3d-node-status">{operation.status}</span>
                  {isCurrent && <span className="pm3d-sim-beacon">SIMULATING</span>}
                </button>
                {index < lane.items.length - 1 && <span className="pm3d-connector"><i/></span>}
              </div>;
            })}
          </div>
        </div>)}
        <div className="pm3d-scene-caption"><span>AXIMACH ROUTE MODEL</span><span>CAMERA X {pitch}° · Y {yaw}°</span></div>
      </div> : <div className="pm3d-empty"><Crosshair size={30}/><strong>No saved route stages to display</strong><span>Add a real operation to this PO component line, then the 3D route will build from those records.</span></div>}
    </div> : <div className={"pm3d-spatial-viewport mode-" + layoutMode}>
      <div className="pm3d-spatial-backdrop">
        {layoutMode === "cube" && <svg className="pm3d-cube-outline" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true"><path d="M50 5 90 25 50 47 10 25Z M10 25V57L50 68 90 57V25 M50 47V68" fill="none" stroke="rgba(82,211,228,.55)" strokeWidth=".7"/><path d="M50 5V35" stroke="rgba(95,151,235,.3)" strokeWidth=".5"/></svg>}
        {layoutMode === "vortex" && <div className="pm3d-vortex-rings"/>}
        {(layoutMode === "sphere" || layoutMode === "molecular") && <div className="pm3d-spatial-globe"/>}
        <svg className="pm3d-spatial-connectors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs><marker id="spatialRouteArrow" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0 0 L3 1.5 L0 3Z" fill="#63dce9"/></marker></defs>
          {lanes.map(lane => {
            const points = lane.items.map(operation => positionById.get(operation.id)).filter(Boolean);
            return points.length > 1 ? <polyline key={lane.name} points={points.map(point => point!.x + "," + point!.y).join(" ")} fill="none" stroke="rgba(94,215,232,.66)" strokeWidth=".48" strokeDasharray="1.4 1.2" markerEnd="url(#spatialRouteArrow)"/> : null;
          })}
        </svg>
        <div className="pm3d-spatial-nodes" style={{ transform: "perspective(1200px) rotateX(" + pitch + "deg) rotateY(" + yaw + "deg) scale(" + zoom + ")" }}>
          {sorted.map((operation,index) => {
            const point = positionById.get(operation.id);
            if (!point) return null;
            const selectedNode = operation.id === selected?.id;
            const simulated = simulationStep >= index;
            const isCurrent = simulationStep === index;
            return <button type="button" key={operation.id}
              className={"pm3d-spatial-node status-" + statusClass(operation.status) + (selectedNode ? " selected" : "") + (simulated ? " simulated" : "") + (isCurrent ? " simulation-current" : "")}
              style={{ left: point.x + "%", top: point.y + "%", zIndex: 20 + Math.round((point.depth + 1) * 10) + index, transform: "translate(-50%,-50%) translateZ(" + (point.depth * 42) + "px)" }}
              onClick={() => {setPlaying(false);setSimulationStep(-1);onSelectOperation(operation.id);setCloseup(true);setYaw(-4);setPitch(5);setZoom(1.12);}}
              title={operation.name + " · " + operation.status}>
              <span className="pm3d-spatial-node-top"><small>{String(index+1).padStart(2,"0")} / OP-{String(operation.sequence).padStart(3,"0")}</small><span className={"pm3d-spatial-status status-" + statusClass(operation.status)}>{operation.status}</span></span>
              <span className="pm3d-spatial-node-icon"><ProcessVisualIcon name={operation.name} category={operation.category} size="md"/></span>
              <strong>{operation.name}</strong>
              <small>{operation.category || "Process"} · {operation.quantity.toLocaleString("en-IN")} pcs</small>
              {showVendor && <small className="pm3d-spatial-extra">Vendor: {vendorName(operation.vendorId)}</small>}
              {showVendor && <small className="pm3d-spatial-extra">Transport: {vendorName(operation.transportVendorId)}</small>}
              {showPrice && <small className="pm3d-spatial-extra">Rate: {money(operation.ratePerPart)} / pc</small>}
              {isCurrent && <i className="pm3d-spatial-beacon">SIMULATING</i>}
            </button>;
          })}
        </div>
      </div>
      <div className="pm3d-spatial-caption">{layoutMode.toUpperCase()} PROCESS NETWORK · {sorted.length} SAVED STAGE(S) · BRANCH RELATIONSHIPS PRESERVED</div>
    </div>}
    
    <div className="pm3d-foot">
      <div className="pm3d-legend"><span><i className="pm3d-legend-queued"/> Queued</span><span><i className="pm3d-legend-running"/> Running</span><span><i className="pm3d-legend-complete"/> Complete</span><span><i className="pm3d-legend-hold"/> Quality hold</span><span><i className="pm3d-legend-sim"/> Simulation path</span></div>
      <span className="pm3d-privacy-hint">Vendor and price display can be enabled separately for this view and export.</span>
    </div>

    {selected && <div className={"pm3d-closeup-card " + (closeup ? "active" : "")}>
      <div className="pm3d-closeup-label"><Crosshair size={14}/> {closeup ? "CLOSE-UP / SELECTED STAGE" : "SELECTED STAGE DETAIL"}</div>
      <div className="pm3d-closeup-main">
        <div><small>PROCESS</small><strong>{selected.name}</strong><span>{selected.category || "Process type not specified"} · OP-{String(selected.sequence).padStart(3, "0")}</span></div>
        <div><small>GIVEN DATE</small><strong>{dateLabel(selected.plannedStart)}</strong><span>{selected.plannedStartTime || "Time not set"}</span></div>
        <div><small>DELIVERY DATE</small><strong>{dateLabel(selected.plannedEnd)}</strong><span>{selected.plannedEndTime || "Time not set"}</span></div>
        <div><small>QUANTITY</small><strong>{selected.quantity.toLocaleString("en-IN")} pcs</strong><span>{selected.accepted.toLocaleString("en-IN")} accepted · {selected.rejected.toLocaleString("en-IN")} rejected</span></div>
        {showVendor && <div><small>PROCESS VENDOR</small><strong>{vendorName(selected.vendorId)}</strong><span>{selected.vendorPaymentStatus || "Payment not recorded"}</span></div>}
        {showVendor && <div><small>TRANSPORT VENDOR</small><strong>{vendorName(selected.transportVendorId)}</strong><span>Assigned to this operation</span></div>}
        {showPrice && <div><small>PRICE / PIECE</small><strong>{money(selected.ratePerPart)}</strong><span>Actual rate: {selected.actualRatePerPart > 0 ? money(selected.actualRatePerPart) : "Not entered"}</span></div>}
      </div>
      <div className="pm3d-closeup-actions">
        <span className={"pm3d-selected-status status-" + statusClass(selected.status)}>{selected.status}</span>
        <button type="button" className="button-quiet compact-button" onClick={() => onSelectOperation(selected.id)}>Keep stage selected</button>
        {closeup && <button type="button" className="button-quiet compact-button" onClick={() => setCloseup(false)}>Exit close-up</button>}
      </div>
    </div>}
    <p className="pm3d-simulation-note">Walkthrough simulation only: it animates the order of saved route stages and does not simulate machine physics, change operation status or write to production records.</p>
  </section>;
}
