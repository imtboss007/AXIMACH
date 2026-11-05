import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion } from "motion/react";
import { Activity, ArrowRight, Boxes, ClipboardCheck, Cog, Cpu, Disc3, GitBranch, Scissors, Zap, Truck, Workflow, Wrench } from "lucide-react";
import type { OperationRecord } from "./manufacturingData";
import { ProcessIcon } from "./IconStudio";

type Props = { operations: OperationRecord[]; selectedOperationId: string; simulationIndex: number; zoom: number; onSelectOperation: (id: string) => void; onAddSubprocess?: (parentId: string) => void };

function fallbackFor(name: string) {
  const value = name.toLowerCase();
  if (/transport|dispatch|ship|logistic|delivery/.test(value)) return <Truck size={20} />;
  if (/inspect|quality|measure|test|cmm/.test(value)) return <ClipboardCheck size={20} />;
  if (/cnc|vmc|hmc|machining centre|machining center/.test(value)) return <Cpu size={20} />;
  if (/turn|lathe|shaft/.test(value)) return <Disc3 size={20} />;
  if (/mill|drill|boring|tapping/.test(value)) return <Cog size={20} />;
  if (/wire edm|edm|spark erosion|laser/.test(value)) return <Zap size={20} />;
  if (/weld|fabricat|cutting|shear/.test(value)) return <Scissors size={20} />;
  if (/grind|honing|lapping|polish/.test(value)) return <Wrench size={20} />;
  if (/material|stock|store|warehouse/.test(value)) return <Boxes size={20} />;
  if (/production|assembly|pack/.test(value)) return <Activity size={20} />;
  return <Workflow size={20} />;
}

type ProcessLayoutMode = "sphere" | "route" | "vortex" | "cube" | "molecular" | "orbit" | "digital-mesh";

export default function ProcessUniverse3D({ operations, selectedOperationId, simulationIndex, zoom, onSelectOperation, onAddSubprocess }: Props) {\n  const [expandedOperationId, setExpandedOperationId] = useState("");\n  const parentOperations = useMemo(() => operations.filter(operation => !operation.parentId || !operations.some(parent => parent.id === operation.parentId)), [operations]);\n  const subprocessesFor = (parentId: string) => operations.filter(operation => operation.parentId === parentId);
  const [layoutMode, setLayoutMode] = useState<ProcessLayoutMode>("sphere");
  const rotateX = useMotionValue(-12);
  const rotateY = useMotionValue(18);
  const reducedMotion = useReducedMotion();
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
  const mobileFrameDelta = useRef(0);
  const [compactViewport, setCompactViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 650px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 650px)");
    const updateCompact = () => setCompactViewport(query.matches);
    query.addEventListener("change", updateCompact);
    return () => query.removeEventListener("change", updateCompact);
  }, []);
  useAnimationFrame((_time, delta) => {
    if (drag.current || reducedMotion || document.visibilityState === "hidden") return;
    let frameDelta = delta;
    if (compactViewport) {
      mobileFrameDelta.current += delta;
      if (mobileFrameDelta.current < 32) return;
      frameDelta = mobileFrameDelta.current;
      mobileFrameDelta.current = 0;
    }
    rotateY.set(rotateY.get() + frameDelta * 0.0048);
  });
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY, rx: rotateX.get(), ry: rotateY.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    rotateY.set(drag.current.ry + (event.clientX - drag.current.x) * 0.62);
    rotateX.set(Math.max(-55, Math.min(55, drag.current.rx - (event.clientY - drag.current.y) * 0.52)));
  };
  const endDrag = () => { drag.current = null; };

  const orbitNodes = useMemo(() => parentOperations.map((operation, index) => {
    const count = Math.max(parentOperations.length, 1);
    const y = 1 - 2 * ((index + 0.5) / count);
    const latitude = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
    const longitude = index * (Math.PI * (3 - Math.sqrt(5))) * 180 / Math.PI;
    const transform = `translate(-50%,-50%) rotateY(${longitude}deg) rotateX(${latitude}deg) translateZ(var(--process-orbit-radius,205px)) rotateX(${-latitude}deg) rotateY(${-longitude}deg)`;
    return { operation, index, transform };
  }), [parentOperations]);

  const lanes = useMemo(() => {
    const grouped = new Map<string, OperationRecord[]>();
    for (const operation of operations) {
      const branch = operation.branch || "Main route";
      const rows = grouped.get(branch) || [];
      rows.push(operation);
      grouped.set(branch, rows);
    }
    return [...grouped.entries()].map(([name, rows]) => ({ name, rows: rows.slice().sort((a,b) => a.sequence-b.sequence), alternate: name !== "Main route" }));
  }, [operations]);
  const stageStyle: CSSProperties = { transform: `scale(${zoom}) rotateX(2deg)`, transformOrigin: "top left", width: `${100 / zoom}%` };

  return <section className={"process-universe-3d mode-" + layoutMode} aria-label="Interactive 3D process route graph">
    <header className="process-universe-head">
      <div><span className="process-universe-kicker"><span /> LIVE ROUTE / INTERACTIVE 3D</span><h3>Manufacturing process universe</h3><p>Drag the process sphere to rotate it. Select any saved process icon to open its real operation record; simulation highlights each step in sequence.</p></div>
      <div className="process-universe-count"><strong>{parentOperations.length}</strong><span>MAIN PROCESSES</span></div>
    </header>
    <nav className="process-universe-layouts" aria-label="Process map visualisation modes">
      {([{id:"sphere",label:"Sphere"},{id:"route",label:"Conventional route"},{id:"vortex",label:"Vortex"},{id:"cube",label:"Cube"},{id:"molecular",label:"Molecular"},{id:"orbit",label:"Orbit"},{id:"digital-mesh",label:"Digital mesh"}] as const).map(option=><button type="button" key={option.id} className={layoutMode===option.id?"active":""} aria-pressed={layoutMode===option.id} onClick={()=>setLayoutMode(option.id)}>{option.label}</button>)}
    </nav>
    <div className="process-orbit-panel">
      <div className="process-orbit-meta"><span><i /> LIVE PO-LINE ROUTE</span><span>3D ORBIT · TOUCH / MOUSE DRAG</span></div>
      <div className="process-orbit-viewport">
        <motion.div className="process-orbit-rotator" onPointerDown={event => { if ((event.target as HTMLElement).closest(".process-orbit-node")) return; startDrag(event); }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{ rotateX, rotateY, touchAction: "none" }}>
          <div className="process-orbit-ring process-orbit-ring-a" /><div className="process-orbit-ring process-orbit-ring-b" />
          <div className="process-orbit-core"><span className="process-orbit-core-gloss" /><span className="process-orbit-core-grid" /><div><small>AXIMACH / ROUTE CORE</small><strong>{parentOperations.length.toString().padStart(2,"0")}</strong><b>PROCESS STEPS</b><em>LIVE RECORDS</em></div><i className="process-orbit-dot process-orbit-dot-a" /><i className="process-orbit-dot process-orbit-dot-b" /><i className="process-orbit-dot process-orbit-dot-c" /></div>
          {orbitNodes.map(({ operation, index, transform }) => {
            const active = selectedOperationId === operation.id, current = simulationIndex === index, passed = simulationIndex > index;
            const state = operation.status.toLowerCase().replaceAll(" ","-");
            return <button key={operation.id} type="button" className={"process-orbit-node status-" + state + (active ? " is-selected" : "") + (current ? " simulation-current" : "") + (passed ? " simulation-passed" : "")} style={{ transform }} onClick={() => { onSelectOperation(operation.id); setExpandedOperationId(current => current === operation.id ? "" : operation.id); }} aria-pressed={active} title={operation.name + " · " + operation.status}>
              <span className="process-orbit-node-top"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><i /></span>
              <ProcessIcon processName={operation.name} fallback={fallbackFor(operation.name)} />
              <strong>{operation.name}</strong>{subprocessesFor(operation.id).length > 0 && <small className="process-orbit-node-qty">{subprocessesFor(operation.id).length} SUB-PROCESS(ES)</small>}<small className="process-orbit-node-qty">{operation.completed.toLocaleString("en-IN")} / {operation.quantity.toLocaleString("en-IN")} pcs</small>
            </button>;
          })}
        </motion.div>
      </div>
      <div className="process-orbit-help"><span>↔ DRAG TO ROTATE</span><span>SELECT A PROCESS NODE TO OPEN ITS RECORD</span><span>SIMULATION IS VISUAL ONLY</span></div>
    </div>
    <div className="process-universe-viewport"><div className="process-universe-stage" style={stageStyle}>
      {lanes.map(lane => <section className={"process-universe-lane" + (lane.alternate ? " is-branch" : "")} key={lane.name}>
        <div className="process-universe-lane-label"><span className="process-universe-branch-icon">{lane.alternate ? <GitBranch size={15}/> : <Workflow size={15}/>}</span><span><strong>{lane.name}</strong><small>{lane.alternate ? "Alternate / rework branch" : "Primary manufacturing route"}</small></span><em>{lane.rows.length} STEP{lane.rows.length === 1 ? "" : "S"}</em></div>
        <div className="process-universe-node-track">{lane.rows.map((operation,index) => {
          const globalIndex = parentOperations.findIndex(item => item.id === operation.id);
          const active = selectedOperationId === operation.id, current = simulationIndex === globalIndex, passed = simulationIndex > globalIndex;\n          const childOperations = subprocessesFor(operation.id);\n          const expanded = expandedOperationId === operation.id;
          const state = operation.status.toLowerCase().replaceAll(" ","-");
          return <div className="process-universe-node-wrap" key={operation.id}>
            <button type="button" className={"process-universe-node status-" + state + (active ? " is-selected" : "") + (current ? " simulation-current" : "") + (passed ? " simulation-passed" : "")} onClick={() => onSelectOperation(operation.id)} aria-pressed={active} title={"Open " + operation.name + " operation record"}>
              <span className="process-universe-node-top"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><em>{operation.status}</em></span>
              <span className="process-universe-node-icon"><ProcessIcon processName={operation.name} fallback={fallbackFor(operation.name)} /></span>
              <strong>{operation.name}</strong>{childOperations.length > 0 && <small className="process-universe-node-category">{childOperations.length} sub-process(es) · {childOperations[0].vendorId ? "vendor linked" : "vendor assignment pending"}</small>}<small className="process-universe-node-category">{operation.category || operation.machine || "Manufacturing operation"}</small>
              <span className="process-universe-qty"><b>{operation.completed.toLocaleString("en-IN")}</b> / {operation.quantity.toLocaleString("en-IN")} pcs</span>
              {operation.machine && <span className="process-universe-machine">{operation.machine}</span>}
            </button>
            {index < lane.rows.length - 1 && <span className="process-universe-connector" aria-hidden="true"><ArrowRight size={17}/></span>}
          </div>;
        })}</div>
        {lane.alternate && <div className="process-universe-branch-note">Branch retained with its parent operation and rework history.</div>}
      </section>)}
      {operations.length === 0 && <div className="process-universe-empty">No saved operations are available for this PO line.</div>}
      <div className="process-universe-floor" aria-hidden="true"/>
    </div></div>
    <footer className="process-universe-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="process-universe-safe">Simulation is visual only. It never changes job, operation or quantity records.</span></footer>
  </section>;
}
