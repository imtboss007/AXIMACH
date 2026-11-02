import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Crosshair, Maximize2, Pause, Play, RotateCcw, RotateCw,
  StepForward, ZoomIn, ZoomOut, ChevronDown
} from "lucide-react";
import type { OperationRecord } from "./manufacturingData";
import ProcessVisualIcon from "./ProcessVisualIcon";
import {
  PROCESS_MAP_GEOMETRY_MODES,
  cycleProcessMapGeometryMode,
  getProcessMapGeometryPoint,
  type ProcessMapGeometryMode,
  type ProcessMapGeometryPoint
} from "./processMapGeometry";

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
const pointX = (point: ProcessMapGeometryPoint) => 500 + point.x * 315;
const pointY = (point: ProcessMapGeometryPoint) => 230 + point.y * 126;

function GeometryBackdrop({ mode }: { mode: ProcessMapGeometryMode }) {
  return <svg key={mode} className={"pm3d-geometry-backdrop pm3d-geometry-" + mode} viewBox="0 0 1000 460" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="pm3d-wire-gradient" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#64e7f1" stopOpacity=".62"/>
        <stop offset="48%" stopColor="#4e9fc7" stopOpacity=".2"/>
        <stop offset="100%" stopColor="#7aabff" stopOpacity=".46"/>
      </linearGradient>
      <filter id="pm3d-wire-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g className="pm3d-geometry-lines" stroke="url(#pm3d-wire-gradient)" filter="url(#pm3d-wire-glow)">
      {mode === "sphere" && <>
        <ellipse cx="500" cy="230" rx="245" ry="194"/>
        <ellipse cx="500" cy="230" rx="245" ry="76" transform="rotate(-24 500 230)"/>
        <ellipse cx="500" cy="230" rx="100" ry="194" transform="rotate(28 500 230)"/>
        <ellipse cx="500" cy="230" rx="178" ry="194" transform="rotate(-48 500 230)"/>
        <path d="M255 230 C340 70 660 70 745 230 C660 390 340 390 255 230Z"/>
      </>}
      {mode === "cube" && <>
        <path d="M500 48 L724 156 L500 264 L276 156 Z"/>
        <path d="M276 156 L276 354 L500 452 L500 264"/>
        <path d="M724 156 L724 354 L500 452"/>
        <path d="M500 48 L500 264"/>
        <path d="M386 102 L386 404 M614 102 L614 404" opacity=".38"/>
      </>}
      {mode === "pyramid" && <>
        <path d="M500 45 L240 375 L760 375 Z"/>
        <path d="M500 45 L380 420 L620 420 Z"/>
        <path d="M240 375 L380 420 L500 452 L620 420 L760 375"/>
        <path d="M500 45 L500 452 M500 45 L240 375 M500 45 L760 375" opacity=".62"/>
        <path d="M332 260 L668 260 M285 320 L715 320" opacity=".35"/>
      </>}
      {mode === "helix" && <>
        <path d="M300 38 C720 100 720 150 300 220 C-40 290 -40 350 700 430"/>
        <path d="M700 38 C280 100 280 150 700 220 C1040 290 1040 350 300 430"/>
        {Array.from({ length: 7 }, (_, index) => {
          const y = 64 + index * 54;
          return <path key={index} d={"M" + (330 + (index % 2) * 110) + " " + y + " L" + (670 - (index % 2) * 110) + " " + y} opacity=".48"/>;
        })}
      </>}
      {mode === "orbit" && <>
        <ellipse cx="500" cy="230" rx="280" ry="142"/>
        <ellipse cx="500" cy="230" rx="280" ry="142" transform="rotate(58 500 230)"/>
        <ellipse cx="500" cy="230" rx="280" ry="142" transform="rotate(-58 500 230)"/>
        <circle cx="500" cy="230" r="44" opacity=".7"/>
      </>}
      {mode === "vortex" && <>
        <path d="M500 230 C620 90 820 160 730 300 C640 438 370 390 345 240 C320 90 565 55 650 175 C730 286 560 352 455 285 C370 230 435 145 520 156 C580 164 592 225 548 250"/>
        <path d="M500 230 C580 145 715 178 670 285 C625 378 430 355 405 245" opacity=".46"/>
        <path d="M500 230 L250 70 M500 230 L760 70 M500 230 L830 360 M500 230 L170 360" opacity=".25"/>
      </>}
    </g>
    <g className="pm3d-geometry-orbit-points">
      <circle cx="500" cy="46" r="4"/><circle cx="754" cy="230" r="4"/><circle cx="500" cy="414" r="4"/><circle cx="246" cy="230" r="4"/>
    </g>
  </svg>;
}

export default function ProcessMap3DViewer({
  operations, vendors, selectedOperationId, showVendor, showPrice, onSelectOperation
}: Props) {
  const [yaw, setYaw] = useState(-13);
  const [pitch, setPitch] = useState(16);
  const [zoom, setZoom] = useState(0.92);
  const [playing, setPlaying] = useState(false);
  const [simulationStep, setSimulationStep] = useState(-1);
  const [closeup, setCloseup] = useState(false);
  const [geometryMode, setGeometryMode] = useState<ProcessMapGeometryMode>("sphere");
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
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
      const points = items.map((_, index) => getProcessMapGeometryPoint(geometryMode, index, items.length));
      return { name, items, parents, points };
    });
  }, [sorted, geometryMode]);
  const selected = sorted.find(operation => operation.id === selectedOperationId) || sorted[0];
  const activeMode = PROCESS_MAP_GEOMETRY_MODES.find(mode => mode.id === geometryMode) || PROCESS_MAP_GEOMETRY_MODES[0];

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
  const changeMode = (next: ProcessMapGeometryMode) => {
    setGeometryMode(next);
    setModeMenuOpen(false);
    setCloseup(false);
  };
  const cycleMode = (direction: -1 | 1) => {
    setGeometryMode(current => cycleProcessMapGeometryMode(current, direction));
    setModeMenuOpen(false);
    setCloseup(false);
  };

  return <section className={"surface-panel process-map-3d-viewer " + (closeup ? "is-closeup" : "")}>
    <div className="pm3d-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-mark"/> INTERACTIVE ROUTE STUDIO</div>
        <h3>3D process route <span>·</span> {operations.length} saved stage(s)</h3>
        <p>Choose a 3D shape, rotate it with the arrows or camera controls, and animate the selected layout. Saved operation records stay unchanged.</p>
      </div>
      <span className="pm3d-live-indicator"><i/> RECORD-LINKED VIEW</span>
    </div>

    <div className="pm3d-control-deck">
      <div className="pm3d-control-group pm3d-mode-control">
        <span className="pm3d-control-label">3D MODE</span>
        <button type="button" className="button-quiet compact-button pm3d-mode-arrow" onClick={() => cycleMode(-1)} aria-label="Previous 3D mode" title="Previous 3D shape"><ArrowLeft size={14}/></button>
        <button type="button" className="button-quiet compact-button pm3d-mode-current" onClick={() => setModeMenuOpen(open => !open)} aria-expanded={modeMenuOpen} aria-haspopup="menu">
          <span className={"pm3d-mode-glyph pm3d-mode-glyph-" + geometryMode} aria-hidden="true"/>
          <strong>{activeMode.label.toUpperCase()}</strong>
          <ChevronDown size={12}/>
        </button>
        <button type="button" className="button-quiet compact-button pm3d-mode-arrow" onClick={() => cycleMode(1)} aria-label="Next 3D mode" title="Next 3D shape"><ArrowRight size={14}/></button>
        <button type="button" className={"button-quiet compact-button pm3d-auto-rotate " + (autoRotate ? "control-active" : "")} onClick={() => setAutoRotate(value => !value)} aria-pressed={autoRotate}>
          {autoRotate ? <Pause size={13}/> : <Play size={13}/>} {autoRotate ? "Stop animation" : "Animate mode"}
        </button>
        {modeMenuOpen && <div className="pm3d-mode-menu" role="menu" aria-label="Choose 3D geometry mode">
          <div className="pm3d-mode-menu-title"><span>SELECT GEOMETRY</span><small>{PROCESS_MAP_GEOMETRY_MODES.length} INTERACTIVE STYLES</small></div>
          <div className="pm3d-mode-options">
            {PROCESS_MAP_GEOMETRY_MODES.map(mode => <button type="button" role="menuitem" key={mode.id} className={"pm3d-mode-option " + (geometryMode === mode.id ? "active" : "")} onClick={() => changeMode(mode.id)}>
              <span className={"pm3d-mode-glyph pm3d-mode-glyph-" + mode.id} aria-hidden="true"/>
              <span><strong>{mode.label}</strong><small>{mode.hint}</small></span>
              {geometryMode === mode.id && <i aria-hidden="true"/>}
            </button>)}
          </div>
        </div>}
      </div>
      <div className="pm3d-control-group">
        <span className="pm3d-control-label">CAMERA</span>
        <button type="button" className="button-quiet compact-button" onClick={() => setYaw(value => Math.max(-55, value - 9))} title="Rotate left"><RotateCcw size={13}/> Left</button>
        <button type="button" className="button-quiet compact-button" onClick={() => setYaw(value => Math.min(55, value + 9))} title="Rotate right"><RotateCw size={13}/> Right</button>
        <button type="button" className="button-quiet compact-button" onClick={() => setPitch(value => Math.max(-8, value - 6))} title="Lower camera">Lower</button>
        <button type="button" className="button-quiet compact-button" onClick={() => setPitch(value => Math.min(38, value + 6))} title="Raise camera">Raise</button>
        <label className="pm3d-angle-control">YAW<input aria-label="Camera yaw" type="range" min="-55" max="55" step="1" value={yaw} onChange={event => setYaw(Number(event.target.value) )}/></label>
        <label className="pm3d-angle-control">PITCH<input aria-label="Camera pitch" type="range" min="-8" max="38" step="1" value={pitch} onChange={event => setPitch(Number(event.target.value) )}/></label>
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
        <button type="button" className="button-quiet compact-button" disabled={!sorted.length} onClick={() => { setPlaying(false); setSimulationStep(0); if (sorted[0]) onSelectOperation(sorted[0].id); }}><RotateCcw size={13}/> Restart</button>
        <button type="button" className="button-quiet compact-button" disabled={!sorted.length || simulationStep >= sorted.length - 1} onClick={() => { setPlaying(false); setSimulationStep(value => Math.min(sorted.length - 1, Math.max(0, value + 1))); }}><StepForward size={13}/> Next stage</button>
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
      {sorted.length ? <div className={"pm3d-scene " + (autoRotate ? "pm3d-auto-rotating" : "")} style={{ transform: "perspective(1350px) rotateX(" + pitch + "deg) rotateY(" + yaw + "deg) scale(" + zoom + ")" }}>
        <div className="pm3d-geometry-stage">
          <div className="pm3d-floor-plate"/>
          {lanes.map(lane => <div className={"pm3d-lane " + (lane.name === "Main route" ? "pm3d-main-lane" : "pm3d-branch-lane")} key={lane.name}>
            <div className="pm3d-lane-label"><b>{lane.name === "Main route" ? "PRIMARY ROUTE" : "ALTERNATE / REWORK"}</b><span>{lane.items.length} stage(s){lane.parents.length ? " · branches from " + lane.parents.join(", ") : ""}</span></div>
            <GeometryBackdrop mode={geometryMode}/>
            <svg className="pm3d-geometry-connectors" viewBox="0 0 1000 460" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="pm3d-route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#64e1ed"/>
                </marker>
              </defs>
              {lane.points.slice(0, -1).map((point, index) => {
                const next = lane.points[index + 1];
                const startX = pointX(point), startY = pointY(point);
                const endX = pointX(next), endY = pointY(next);
                const curve = Math.max(24, Math.abs(endX - startX) * 0.23);
                const direction = endX >= startX ? 1 : -1;
                const d = "M " + startX + " " + startY + " C " + (startX + curve * direction) + " " + startY + ", " + (endX - curve * direction) + " " + endY + ", " + endX + " " + endY;
                return <path key={index} className="pm3d-geometry-link" d={d} markerEnd="url(#pm3d-route-arrow)"/>;
              })}
            </svg>
            <div className="pm3d-node-row">
              {lane.items.map((operation, index) => {
                const globalIndex = sorted.findIndex(item => item.id === operation.id);
                const point = lane.points[index];
                const selectedNode = operation.id === selected?.id;
                const simulated = simulationStep >= globalIndex;
                const isCurrent = simulationStep === globalIndex;
                const vendor = vendorName(operation.vendorId);
                return <div
                  className="pm3d-node-wrap"
                  key={operation.id}
                  style={{
                    left: (50 + point.x * 31) + "%",
                    top: (50 + point.y * 28) + "%",
                    zIndex: Math.round((point.z + 1) * 20 + globalIndex / 100),
                    transform: "translate(-50%,-50%) translateZ(" + (point.z * 82) + "px) rotateX(" + point.rotateX + "deg) rotateY(" + point.rotateY + "deg)"
                  }}
                >
                  <button
                    type="button"
                    className={"pm3d-node status-" + statusClass(operation.status) + (selectedNode ? " selected" : "") + (simulated ? " simulated" : "") + (isCurrent ? " simulation-current" : "")}
                    style={{ animationDelay: (Math.min(index, 8) * 55) + "ms" }}
                    onClick={() => { setPlaying(false); setSimulationStep(-1); onSelectOperation(operation.id); setCloseup(true); setYaw(-4); setPitch(5); setZoom(1.16); }}
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
                </div>;
              })}
            </div>
          </div>)}
          <div className="pm3d-scene-caption"><span>AXIMACH · {activeMode.label.toUpperCase()} GEOMETRY</span><span>CAMERA X {pitch}° · Y {yaw}°</span></div>
        </div>
      </div> : <div className="pm3d-empty"><Crosshair size={30}/><strong>No saved route stages to display</strong><span>Add a real operation to this PO component line, then the 3D route will build from those records.</span></div>}
    </div>

    <div className="pm3d-foot">
      <div className="pm3d-legend"><span><i className="pm3d-legend-queued"/> Queued</span><span><i className="pm3d-legend-running"/> Running</span><span><i className="pm3d-legend-complete"/> Complete</span><span><i className="pm3d-legend-hold"/> Quality hold</span><span><i className="pm3d-legend-sim"/> Simulation path</span></div>
      <span className="pm3d-privacy-hint">{activeMode.hint}. The view is visual only; production records are unchanged.</span>
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
