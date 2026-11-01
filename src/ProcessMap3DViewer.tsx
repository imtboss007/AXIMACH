import { useEffect, useMemo, useState } from "react";
import {
  Crosshair, Maximize2, Pause, Play, RotateCcw, RotateCw,
  StepForward, ZoomIn, ZoomOut
} from "lucide-react";
import type { OperationRecord } from "./manufacturingData";

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

    <div className="pm3d-scene-viewport">
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
                  <span className="pm3d-node-symbol"><i/><i/><i/></span>
                  <strong>{operation.name}</strong>
                  <span className="pm3d-node-date"><small>GIVEN</small><b>{dateLabel(operation.plannedStart)}</b></span>
                  <span className="pm3d-node-date"><small>DELIVERY</small><b>{dateLabel(operation.plannedEnd)}</b></span>
                  <span className="pm3d-node-qty"><small>QTY</small><b>{operation.quantity.toLocaleString("en-IN")} pcs</b></span>
                  {showVendor && <span className="pm3d-node-optional"><small>VENDOR</small><b>{vendor}</b></span>}
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
    </div>

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
        {showVendor && <div><small>VENDOR</small><strong>{vendorName(selected.vendorId)}</strong><span>{selected.vendorPaymentStatus || "Payment not recorded"}</span></div>}
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
