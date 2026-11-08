import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type CSSProperties } from "react";
import { motion, useMotionValue } from "motion/react";
import { Activity, ArrowRight, Boxes, ClipboardCheck, Cog, Cpu, Disc3, GitBranch, Scissors, Zap, Truck, Workflow, Wrench } from "lucide-react";
import type { OperationRecord } from "./manufacturingData";
import { ProcessIcon } from "./IconStudio";

type ProcessDefinitionNode = { id: string; processType: string; category: string; subcategories?: string[]; subcategoryIds?: string[]; vendorIds?: string[]; displayColor?: string };
type Props = { operations: OperationRecord[]; allOperations?: OperationRecord[]; processDefinitions?: ProcessDefinitionNode[]; vendors?: Array<{ id: string; company: string }>; visibleFields?: string[]; showArrows?: boolean; selectedOperationId: string; simulationIndex: number; zoom: number; initialLayout?: ProcessLayoutMode; onSelectOperation: (id: string) => void; onAddSubprocess?: (parentId: string) => void; onAddProcessDefinition?: (definitionId: string) => void };

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

export default function ProcessUniverse3D({ operations, allOperations, processDefinitions = [], vendors = [], visibleFields = [], showArrows = true, selectedOperationId, simulationIndex, zoom, initialLayout = "sphere", onSelectOperation, onAddSubprocess, onAddProcessDefinition }: Props) {
  const [expandedOperationId, setExpandedOperationId] = useState("");
  const fieldVisible = (field: string) => visibleFields.includes(field);
  const dateLabel = (value?: string) => value ? value.slice(0, 10) : "Not set";
  const parentOperations = useMemo(() => operations.filter(operation => operation.relationType !== "subprocess"), [operations]);
  const displayOperations = parentOperations.length ? parentOperations : operations;
  const lookupOperations = allOperations || operations;
  const subprocessesFor = (parentId: string) => lookupOperations.filter(operation => operation.relationType === "subprocess" && operation.parentId === parentId);
  const branchesFor = (parentId: string) => lookupOperations.filter(operation => (operation.relationType === "alternate" || operation.relationType === "rework") && operation.parentId === parentId);
  const [layoutMode, setLayoutMode] = useState<ProcessLayoutMode>(initialLayout);
  useEffect(() => setLayoutMode(initialLayout), [initialLayout]);
  const rotateX = useMotionValue(-12);
  const rotateY = useMotionValue(18);
  const drag = useRef<{ x: number; y: number; rx: number; ry: number } | null>(null);
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

  // Coordinate all saved route nodes against the full PO-line route. A scoped
  // view therefore keeps stable globe positions and can still draw an origin
  // connection to a parent that is not part of the selected route scope.
  const coordinateOperations = useMemo(() => {
    const source = lookupOperations.length ? lookupOperations : displayOperations;
    return source.filter(operation => operation.relationType !== "subprocess").slice().sort((a,b) => a.sequence-b.sequence);
  }, [lookupOperations, displayOperations]);
  const orbitPointFor = (operation: OperationRecord) => {
    const index = coordinateOperations.findIndex(item => item.id === operation.id);
    if (index < 0) return { x: 0, y: 0, z: 0 };
    const count = Math.max(coordinateOperations.length, 1);
    const unitY = 1 - 2 * ((index + 0.5) / count);
    const ringRadius = Math.sqrt(Math.max(0, 1 - unitY * unitY));
    const angle = index * (Math.PI * (3 - Math.sqrt(5)));
    const radius = 205;
    return { x: Math.sin(angle) * ringRadius * radius, y: -unitY * radius, z: Math.cos(angle) * ringRadius * radius };
  };
  const orbitNodes = useMemo(() => displayOperations.map((operation, index) => {
    const globalIndex = coordinateOperations.findIndex(item => item.id === operation.id);
    const count = Math.max(coordinateOperations.length, 1);
    const y = 1 - 2 * ((globalIndex < 0 ? index : globalIndex) + 0.5) / count;
    const latitude = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
    const longitude = (globalIndex < 0 ? index : globalIndex) * (Math.PI * (3 - Math.sqrt(5))) * 180 / Math.PI;
    const transform = `translate(-50%,-50%) rotateY(${longitude}deg) rotateX(${latitude}deg) translateZ(var(--process-orbit-radius,205px)) rotateX(${-latitude}deg) rotateY(${-longitude}deg)`;
    return { operation, index, transform, point: orbitPointFor(operation) };
  }), [displayOperations, coordinateOperations]);

  // When a PO line has no saved operations yet, put the real Process Directory
  // definitions onto the interactive 3D orbit. These are catalogue actions,
  // not fabricated production operations; selecting one opens the PO-line
  // operation editor and only Save creates a production record.
  const catalogueOrbitNodes = useMemo(() => processDefinitions.map((definition, index) => {
    const count = Math.max(processDefinitions.length, 1);
    const y = 1 - 2 * ((index + 0.5) / count);
    const latitude = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
    const longitude = index * (Math.PI * (3 - Math.sqrt(5))) * 180 / Math.PI;
    const transform = `translate(-50%,-50%) rotateY(${longitude}deg) rotateX(${latitude}deg) translateZ(var(--process-orbit-radius,205px)) rotateX(${-latitude}deg) rotateY(${-longitude}deg)`;
    return { definition, index, transform };
  }), [processDefinitions]);
  const showCatalogueOrbit = operations.length === 0 && catalogueOrbitNodes.length > 0;
  const orbitCount = displayOperations.length || (showCatalogueOrbit ? catalogueOrbitNodes.length : 0);

  const lanes = useMemo(() => {
    const grouped = new Map<string, OperationRecord[]>();
    for (const operation of parentOperations) {
      const branch = operation.branch || "Main route";
      const rows = grouped.get(branch) || [];
      rows.push(operation);
      grouped.set(branch, rows);
    }
    return [...grouped.entries()].map(([name, rows]) => {
      const ordered = rows.slice().sort((a,b) => a.sequence-b.sequence);
      let branchRoot: OperationRecord | undefined;
      let parent: OperationRecord | undefined;
      if (name !== "Main route") {
        for (const candidate of ordered) {
          if (candidate.relationType !== "alternate" && candidate.relationType !== "rework") continue;
          let current = candidate;
          let ancestor = lookupOperations.find(item => item.id === current.parentId);
          let guard = 0;
          // Walk through later branch steps until we reach the original operation
          // outside this branch. This still works when the active route scope only
          // contains one selected branch step rather than the branch root.
          while (ancestor && (ancestor.branch || "Main route") === name && ancestor.parentId && guard++ < lookupOperations.length) {
            current = ancestor;
            ancestor = lookupOperations.find(item => item.id === current.parentId);
          }
          if (ancestor && (ancestor.branch || "Main route") !== name) {
            branchRoot = current;
            parent = ancestor;
            break;
          }
        }
      }
      return { name, rows: ordered, alternate: name !== "Main route", branchRoot, parent, branchRelation: branchRoot?.relationType };
    });
  }, [parentOperations, lookupOperations]);
  const orbitConnections = useMemo(() => {
    const visibleIds = new Set(displayOperations.map(operation => operation.id));
    const edges: Array<{id:string;from:OperationRecord;to:OperationRecord;relation:"main"|"alternate"|"rework";color:string}> = [];
    const byBranch = new Map<string, OperationRecord[]>();
    for (const operation of coordinateOperations) {
      const branch = operation.branch || "Main route";
      const rows = byBranch.get(branch) || [];
      rows.push(operation);
      byBranch.set(branch, rows);
    }
    const accentFor = (operation:OperationRecord) => processDefinitions.find(definition=>definition.id===operation.processDefinitionId)?.displayColor || operation.processColor || "#6fa9e5";
    for (const [branch, rows] of byBranch) {
      const ordered = rows.slice().sort((a,b)=>a.sequence-b.sequence);
      const lane = lanes.find(item=>item.name===branch);
      const relation = branch==="Main route" ? "main" : lane?.branchRelation==="rework" ? "rework" : "alternate";
      const color = relation==="rework" ? "#e38b45" : relation==="alternate" ? "#4b95eb" : undefined;
      for (let index=0; index<ordered.length-1; index++) {
        const from=ordered[index], to=ordered[index+1];
        if (!visibleIds.has(from.id) && !visibleIds.has(to.id)) continue;
        edges.push({id:from.id+"->"+to.id,from,to,relation,color:color||accentFor(to)});
      }
      if (branch!=="Main route" && lane?.branchRoot && lane.parent && displayOperations.some(operation=>(operation.branch||"Main route")===branch)) {
        const from=lane.parent, to=lane.branchRoot;
        edges.push({id:from.id+"->"+to.id,from,to,relation:relation==="rework"?"rework":"alternate",color:relation==="rework"?"#e38b45":"#4b95eb"});
      }
    }
    const anchors = new Map<string,{operation:OperationRecord;relation:"main"|"alternate"|"rework";color:string}>();
    for (const edge of edges) {
      if (!visibleIds.has(edge.from.id)) anchors.set(edge.from.id,{operation:edge.from,relation:edge.relation,color:edge.color});
      if (!visibleIds.has(edge.to.id)) anchors.set(edge.to.id,{operation:edge.to,relation:edge.relation,color:edge.color});
    }
    return { edges, anchors:[...anchors.values()] };
  }, [coordinateOperations, displayOperations, lanes, processDefinitions]);
  const stageStyle: CSSProperties = { transform: `scale(${zoom}) rotateX(2deg)`, transformOrigin: "top left", width: `${100 / zoom}%` };

  return <section className={"process-universe-3d mode-" + layoutMode} aria-label="Interactive 3D process route graph">
    <header className="process-universe-head">
      <div><span className="process-universe-kicker"><span /> LIVE ROUTE / INTERACTIVE 3D</span><h3>Manufacturing process universe</h3><p>Drag the process sphere to rotate it. Select any saved process icon to open its real operation record; simulation highlights each step in sequence.</p></div>
      <div className="process-universe-count"><strong>{orbitCount}</strong><span>{displayOperations.length ? "SAVED PROCESS STEPS" : "AVAILABLE STAGES"}</span></div>
    </header>
    <nav className="process-universe-layouts" aria-label="Process map visualisation modes">
      {([{id:"sphere",label:"Sphere"},{id:"route",label:"Conventional route"},{id:"vortex",label:"Vortex"},{id:"cube",label:"Cube"},{id:"molecular",label:"Molecular"},{id:"orbit",label:"Orbit"},{id:"digital-mesh",label:"Digital mesh"}] as const).map(option=><button type="button" key={option.id} className={layoutMode===option.id?"active":""} aria-pressed={layoutMode===option.id} onClick={()=>setLayoutMode(option.id)}>{option.label}</button>)}
    </nav>
    <div className="process-orbit-panel">
      <div className="process-orbit-meta"><span><i /> LIVE PO-LINE ROUTE</span><span>3D ORBIT · TOUCH / MOUSE DRAG</span></div>
      <div className="process-orbit-viewport">
        <motion.div className="process-orbit-rotator" onPointerDown={event => { if ((event.target as HTMLElement).closest(".process-orbit-node")) return; startDrag(event); }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} style={{ rotateX, rotateY, touchAction: "none" }}>
          <div className="process-orbit-ring process-orbit-ring-a" /><div className="process-orbit-ring process-orbit-ring-b" />{showArrows && orbitConnections.edges.map(edge=>{
            const from=orbitPointFor(edge.from), to=orbitPointFor(edge.to);
            const dx=to.x-from.x, dy=to.y-from.y, dz=to.z-from.z;
            const length=Math.sqrt(dx*dx+dy*dy+dz*dz);
            if(length<1)return null;
            const axisY=-dz/length, axisZ=dy/length;
            const axisMagnitude=Math.hypot(axisY,axisZ);
            const rotateAxisY=axisMagnitude<0.0001?1:axisY/axisMagnitude;
            const rotateAxisZ=axisMagnitude<0.0001?0:axisZ/axisMagnitude;
            const angle=Math.acos(Math.max(-1,Math.min(1,dx/length)))*180/Math.PI;
            const midX=(from.x+to.x)/2,midY=(from.y+to.y)/2,midZ=(from.z+to.z)/2;
            return <div key={edge.id} className={"process-orbit-connector is-"+edge.relation} style={{width:length,color:edge.color,transform:`translate3d(${midX}px,${midY}px,${midZ}px) rotate3d(0,${rotateAxisY},${rotateAxisZ},${angle}deg) translate(-50%,-50%)`}} title={edge.from.name+" → "+edge.to.name} aria-hidden="true"/>;
          })}
          {showArrows && orbitConnections.anchors.map(anchor=>{
            const point=orbitPointFor(anchor.operation);
            return <div key={"anchor-"+anchor.operation.id} className={"process-orbit-parent-anchor is-"+anchor.relation} style={{color:anchor.color,transform:`translate3d(${point.x}px,${point.y}px,${point.z}px) translate(-50%,-50%)`}} title={"Connected parent: "+anchor.operation.name+" · OP-"+anchor.operation.sequence} aria-hidden="true"><span/></div>;
          })}
          
          <div className="process-orbit-core"><span className="process-orbit-core-gloss" /><span className="process-orbit-core-grid" /><div><small>AXIMACH / ROUTE CORE</small><strong>{orbitCount.toString().padStart(2,"0")}</strong><b>{displayOperations.length ? "PROCESS STEPS" : "DIRECTORY STAGES"}</b><em>{displayOperations.length ? "SAVED ROUTE" : "CATALOGUE ONLY"}</em></div><i className="process-orbit-dot process-orbit-dot-a" /><i className="process-orbit-dot process-orbit-dot-b" /><i className="process-orbit-dot process-orbit-dot-c" /></div>
          {orbitNodes.map(({ operation, index, transform }) => {
            const active = selectedOperationId === operation.id, current = simulationIndex === index, passed = simulationIndex > index;
            const state = operation.status.toLowerCase().replaceAll(" ","-");
            const processDefinition = processDefinitions.find(item=>item.id===operation.processDefinitionId);
            const accent = processDefinition?.displayColor || operation.processColor || "#6fa9e5";
            return <button key={operation.id} type="button" className={"process-orbit-node status-" + state + (active ? " is-selected" : "") + (current ? " simulation-current" : "") + (passed ? " simulation-passed" : "")} style={{ transform, "--process-accent":accent } as CSSProperties} onClick={() => { onSelectOperation(operation.id); setExpandedOperationId(current => current === operation.id ? "" : operation.id); }} aria-pressed={active} title={operation.name + " · " + operation.status}>
              <span className="process-orbit-node-top"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><i /></span>
              <ProcessIcon processId={operation.processDefinitionId} processName={operation.name} category={operation.category} subcategory={operation.subcategory} fallback={fallbackFor(operation.name)} />
              <strong>{operation.name}</strong>
              <div className="process-orbit-node-details">
                {fieldVisible("category") && <small>Category · {operation.category || "Not set"}</small>}
                {fieldVisible("subcategory") && operation.subcategory && <small>Subcategory · {operation.subcategory}</small>}
                {fieldVisible("vendor") && <small>Vendor · {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "Not assigned"}</small>}
                {fieldVisible("plannedStart") && <small>Start · {dateLabel(operation.plannedStart)}</small>}
                {fieldVisible("plannedEnd") && <small>Delivery · {dateLabel(operation.plannedEnd)}</small>}
                {fieldVisible("quantity") && <small>Quantity · {operation.quantity.toLocaleString("en-IN")} pcs</small>}
                {fieldVisible("completed") && <small>Completed · {operation.completed.toLocaleString("en-IN")} pcs</small>}
                {fieldVisible("price") && <small>Price / part · ₹{(operation.actualRatePerPart || operation.ratePerPart).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                {fieldVisible("amount") && <small>Process amount · ₹{(operation.quantity * (operation.actualRatePerPart || operation.ratePerPart)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
              </div>
              {subprocessesFor(operation.id).length > 0 && <small className="process-orbit-node-qty">{subprocessesFor(operation.id).length} SUB-PROCESS(ES)</small>}
            </button>;
          })}
          {showCatalogueOrbit && catalogueOrbitNodes.map(({ definition, index, transform }) => (
            <button key={definition.id} type="button" className="process-orbit-node status-planned process-orbit-node-catalog"
              style={{ transform }}
              onPointerDown={event => event.stopPropagation()}
              onClick={() => onAddProcessDefinition?.(definition.id)}
              disabled={!onAddProcessDefinition}
              aria-label={"Add " + definition.processType + " from Process Directory to selected PO line"}
              title={definition.category + " · " + definition.processType + " · Add to selected PO line"}>
              <span className="process-orbit-node-top"><small>LIB-{String(index + 1).padStart(2,"0")}</small><i /></span>
              <ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={fallbackFor(definition.processType)} />
              <strong>{definition.processType}</strong>
              <small className="process-orbit-node-qty">{definition.category}</small>
              <small className="process-orbit-node-qty">{(definition.subcategories || []).length} SUB-PROCESS OPTION(S)</small>
              <em className="process-orbit-node-action">＋ ADD TO PO LINE</em>
            </button>
          ))}
        </motion.div>
      </div>
      <div className="process-orbit-help"><span>↔ DRAG TO ROTATE</span><span>{showCatalogueOrbit ? "SELECT A DIRECTORY NODE TO CREATE A PO-LINE OPERATION" : "SELECT A PROCESS NODE TO OPEN ITS RECORD"}</span><span>SIMULATION IS VISUAL ONLY</span></div>
    </div>
    <div className="process-universe-viewport"><div className="process-universe-stage" style={stageStyle}>
      {lanes.map(lane => <section className={"process-universe-lane" + (lane.alternate ? " is-branch " + (lane.branchRelation==="rework"?"is-rework":"is-alternate") : "")} key={lane.name}>
        <div className="process-universe-lane-label"><span className="process-universe-branch-icon">{lane.alternate ? <GitBranch size={15}/> : <Workflow size={15}/>}</span><span><strong>{lane.name}</strong><small>{lane.alternate ? (lane.branchRelation==="rework"?"Rework branch":"Alternate route") + (lane.parent ? " · connected from OP-" + String(lane.parent.sequence).padStart(3,"0") + " " + lane.parent.name : "") : "Primary manufacturing route"}</small></span><em>{lane.rows.length} STEP{lane.rows.length === 1 ? "" : "S"}</em></div>
        {lane.alternate && lane.branchRoot && <div className={"process-universe-branch-link " + (lane.branchRelation==="rework"?"is-rework":"is-alternate")} data-parent-id={lane.parent?.id||""} data-branch-root-id={lane.branchRoot?.id||""} aria-label={(lane.branchRelation==="rework"?"Rework":"Alternate")+" branch connection from "+(lane.parent?.name||"parent process")+" to "+(lane.branchRoot?.name||lane.name)}><span>OP-{String(lane.parent?.sequence||0).padStart(3,"0")} · {lane.parent?.name||"Parent operation"}</span>{showArrows && <ArrowRight size={16} style={{color:lane.branchRelation==="rework"?"#e38b45":"#4b95eb"}}/>}<strong>{lane.branchRoot?.name||lane.name}</strong><small>{lane.branchRelation==="rework"?"REWORK BRANCH":"ALTERNATE ROUTE"}</small></div>}
        <div className="process-universe-node-track">{lane.rows.map((operation,index) => {
          const globalIndex = displayOperations.findIndex(item => item.id === operation.id);
          const active = selectedOperationId === operation.id, current = simulationIndex === globalIndex, passed = simulationIndex > globalIndex;
          const childOperations = subprocessesFor(operation.id);
          const linkedBranches = branchesFor(operation.id);
          const expanded = expandedOperationId === operation.id;
          const state = operation.status.toLowerCase().replaceAll(" ","-");
          const processDefinition = processDefinitions.find(item=>item.id===operation.processDefinitionId);
          const accent = processDefinition?.displayColor || operation.processColor || "#6fa9e5";
          return <div className="process-universe-node-wrap" key={operation.id}>
            <button type="button" className={"process-universe-node status-" + state + (active ? " is-selected" : "") + (current ? " simulation-current" : "") + (passed ? " simulation-passed" : "")} style={{"--process-accent":accent} as CSSProperties} onClick={() => { onSelectOperation(operation.id); setExpandedOperationId(current => current === operation.id ? "" : operation.id); }} aria-pressed={active} title={"Open " + operation.name + " operation record"}>
              <span className="process-universe-node-top"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><em>{operation.status}</em></span>
              <span className="process-universe-node-icon"><ProcessIcon processId={operation.processDefinitionId} processName={operation.name} category={operation.category} subcategory={operation.subcategory} fallback={fallbackFor(operation.name)} /></span>
              <strong>{operation.name}</strong>
              <div className="process-universe-node-details">
                {fieldVisible("category") && <small>{operation.category || "Category not set"}</small>}
                {fieldVisible("subcategory") && operation.subcategory && <small>Subcategory · {operation.subcategory}</small>}
                {fieldVisible("vendor") && <small>Vendor · {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "Not assigned"}</small>}
                {fieldVisible("plannedStart") && <small>Start · {dateLabel(operation.plannedStart)}</small>}
                {fieldVisible("plannedEnd") && <small>Delivery · {dateLabel(operation.plannedEnd)}</small>}
                {fieldVisible("quantity") && <small>Quantity · {operation.quantity.toLocaleString("en-IN")} pcs</small>}
                {fieldVisible("completed") && <small>Completed · {operation.completed.toLocaleString("en-IN")} pcs</small>}
                {fieldVisible("price") && <small>Price / part · ₹{(operation.actualRatePerPart || operation.ratePerPart).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
                {fieldVisible("amount") && <small>Process amount · ₹{(operation.quantity * (operation.actualRatePerPart || operation.ratePerPart)).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</small>}
              </div>
              {childOperations.length > 0 && <small className="process-universe-node-category">{childOperations.length} linked sub-process(es)</small>}
              {operation.machine && <span className="process-universe-machine">{operation.machine}</span>}
            </button>
            {expanded && <div className="process-node-subprocess-dropdown"><strong>{operation.name} · Linked steps</strong>{childOperations.map(child => <button type="button" key={child.id} onClick={() => onSelectOperation(child.id)}><span>{child.name}</span><small>Sub-process · {child.status} · {child.machine || "Machine not set"}</small></button>)}{linkedBranches.map(child => <button type="button" key={child.id} onClick={() => onSelectOperation(child.id)}><span>{child.name}</span><small>{child.relationType === "rework" ? "Rework branch" : "Alternate route"} · {child.status}</small></button>)}<button type="button" className="process-node-add-subprocess" onClick={() => onAddSubprocess?.(operation.id)}>＋ Add sub-process</button></div>}
            {showArrows && index < lane.rows.length - 1 && <span className="process-universe-connector" style={{color:lane.branchRelation==="rework"?"#e38b45":lane.branchRelation==="alternate"?"#4b95eb":accent}} aria-hidden="true"><ArrowRight size={17}/></span>}
          </div>;
        })}</div>
        {lane.alternate && <div className="process-universe-branch-note">Branch retained with its parent operation and rework history.</div>}
      </section>)}
      {operations.length === 0 && processDefinitions.length > 0 && <section className="process-directory-map-catalog" aria-label="Available Process Directory stages">
        <div className="process-directory-map-heading"><span>PROCESS DIRECTORY</span><strong>{processDefinitions.length} AVAILABLE STAGES</strong><small>Library definitions only · not yet saved as production operations</small></div>
        <div className="process-directory-map-nodes">{processDefinitions.map(definition => <button type="button" className="process-directory-map-node" key={definition.id} onClick={() => onAddProcessDefinition?.(definition.id)} disabled={!onAddProcessDefinition}>
          <ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={fallbackFor(definition.processType)} />
          <strong>{definition.processType}</strong><span>{definition.category}</span><small>{(definition.subcategories || []).length} sub-process option(s)</small><em>＋ Add to selected PO line</em>
        </button>)}</div>
      </section>}
      {operations.length === 0 && processDefinitions.length === 0 && <div className="process-universe-empty">No saved operations or Process Directory definitions are available.</div>}
      <div className="process-universe-floor" aria-hidden="true"/>
    </div></div>
    <footer className="process-universe-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="process-universe-safe">Simulation is visual only. It never changes job, operation or quantity records.</span></footer>
  </section>;
}
