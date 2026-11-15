import { useMemo, useState } from "react";
import { Activity, CheckCircle2, Package, Route, Truck, X } from "lucide-react";
import fixtureJson from "../tests/fixtures/aximach-one-component-multipart-route.json";
import { RouteConnectorLegend } from "./RouteConnectorLegend";
import { VehicleBadge } from "./TransportVehicle";

type Props = { onClose?: () => void };
const fixture = fixtureJson as any;
const money = (value:number) => "₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const relationshipLabels:Record<string,string> = {
  main:"Main route",alternate:"Alternate route",rework:"Rework route",dependency:"Dependency",parallel:"Parallel",
  merge:"Merge",split:"Split","follow-on":"Follow-on",feedback:"Feedback",conditional:"Conditional",successor:"Successor"
};
const moduleLabels:Record<string,string> = {
  companies:"Company Directory",components:"Component Directory",purchasing:"Purchase Orders",vendors:"Vendor Directory",
  "transport-master":"Transport Directory",contact360:"Contact 360","process-master":"Process Directory",
  "planned-cost":"Component Planned Cost","vendor-capability":"Vendor Network",inventory:"Material Directory",
  production:"Production Plan & Process Plan","route-flow":"Route Flow & Relationships",
  "manufacturing-universe":"Manufacturing Universe",dispatch:"Transport & Dispatch",quality:"Quality Inspection",
  costing:"Costing & Payment",communications:"Follow-up Centre",reports:"Reports & Analytics",
  "ai-insights":"AI Insights",export:"Data Exchange Centre"
};
const partById = new Map<string, any>(fixture.parts.map((row:any)=>[row.id,row]));
const componentById = new Map<string, any>(fixture.components.map((row:any)=>[row.id,row]));
const operationById = new Map<string, any>(fixture.operations.map((row:any)=>[row.id,row]));
const routeById = new Map<string, any>(fixture.transportRoutes.map((row:any)=>[row.id,row]));
const vendorById = new Map<string, any>(fixture.vendors.map((row:any)=>[row.id,row.company]));
const materialById = new Map<string, any>(fixture.materials.map((row:any)=>[row.id,row]));
const bomById = new Map<string, any>(fixture.bomLines.map((row:any)=>[row.id,row]));
const lineByPartId = new Map<string, any>(fixture.purchaseOrder.lines.filter((row:any)=>row.partId).map((row:any)=>[row.partId,row]));

export default function TransportRoutingDemo({onClose}:Props) {
  const [partFilter,setPartFilter] = useState("all");
  const [view,setView] = useState("assemblies");
  const [selectedLeg,setSelectedLeg] = useState(fixture.transportLegs[0]?.id || "");
  const [step,setStep] = useState(-1);
  const selectedPart = partById.get(partFilter);
  const visibleLineIds = useMemo(()=>partFilter==="all"
    ? new Set(fixture.purchaseOrder.lines.map((line:any)=>line.id))
    : new Set([lineByPartId.get(partFilter)?.id].filter(Boolean)),[partFilter]);
  const visibleOperations = fixture.operations.filter((operation:any)=>visibleLineIds.has(operation.poLineId))
    .sort((a:any,b:any)=>a.sequence-b.sequence);
  const visibleLinks = fixture.materialProcessLinks.filter((link:any)=>visibleLineIds.has(link.poLineId));
  const visibleRelationships = fixture.routeRelationships.filter((link:any)=>visibleLineIds.has(link.poLineId));
  const visibleLegs = fixture.transportLegs.filter((leg:any)=>visibleLineIds.has(leg.poLineId));
  const selectedLegRow = fixture.transportLegs.find((row:any)=>row.id===selectedLeg);
  const activeOperation = step>=0?visibleOperations[Math.min(step,visibleOperations.length-1)]:null;
  const componentSummaries = fixture.components.map((component:any)=>({
    component,
    parts:fixture.parts.filter((part:any)=>part.componentId===component.id)
  }));
  const relationshipCounts = Object.keys(relationshipLabels).map(type=>({
    type,count:visibleRelationships.filter((row:any)=>row.relationshipType===type).length
  }));
  const moduleCoverage = fixture.moduleIds.map((id:string)=>({
    id,label:moduleLabels[id]||id,collections:fixture.moduleCoverage[id]||[]
  }));
  const partSummary = fixture.parts.map((part:any)=>({
    part,line:lineByPartId.get(part.id),
    operations:fixture.operations.filter((op:any)=>op.poLineId===lineByPartId.get(part.id)?.id)
      .sort((a:any,b:any)=>a.sequence-b.sequence)
  }));
  const allVehicles = fixture.transportRoutes.map((route:any)=>route.vehicleType);
  const partLabel = (id:string) => {
    const part=partById.get(id);
    return part ? part.partNumber+" · "+part.name : "Unassigned part";
  };
  return <section className="transport-demo-panel surface-panel" aria-label="Two component five part comprehensive route and transport demonstration">
    <div className="transport-demo-heading">
      <div><span className="transport-demo-kicker"><Activity size={13}/> SYNTHETIC END-TO-END DEMO · READ-ONLY PREVIEW</span>
        <h3>Two assemblies · five part routes · all carriers</h3>
        <p>{fixture.components.length} parent components · {fixture.parts.length} child parts · PO {fixture.purchaseOrder.number} · {fixture.purchaseOrder.lines.length} part-level PO lines</p>
      </div>
      <div className="transport-demo-heading-actions"><span className="module-number">DEMO ONLY</span>{onClose&&<button type="button" className="icon-control" onClick={onClose} aria-label="Close two-component route demo"><X size={14}/></button>}</div>
    </div>
    <div className="transport-demo-toolbar">
      <label>View part <select aria-label="Filter demo by part" value={partFilter} onChange={event=>{setPartFilter(event.target.value);setStep(-1);}}>
        <option value="all">Both assemblies · all five parts</option>
        {fixture.components.map((component:any)=><optgroup key={component.id} label={component.partNumber+" · "+component.name}>
          {fixture.parts.filter((part:any)=>part.componentId===component.id).map((part:any)=><option key={part.id} value={part.id}>{part.partNumber} · {part.name}</option>)}
        </optgroup>)}
      </select></label>
      <button type="button" className="button-primary compact-button" onClick={()=>setStep(value=>Math.min(value+1,visibleOperations.length-1))} disabled={step>=visibleOperations.length-1}><Activity size={13}/> Next process</button>
      <button type="button" className="button-quiet compact-button" onClick={()=>setStep(-1)}>Reset</button>
      <span>{step<0?"Ready to simulate": "Process "+(step+1)+" / "+visibleOperations.length}</span>
    </div>
    {activeOperation&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Highlighted process: <strong>{activeOperation.name}</strong> · {partLabel(activeOperation.poLineId)}</span></div>}
    <div className="transport-demo-costs">
      <div><small>PARENT COMPONENTS</small><strong>{fixture.components.length}</strong><span>Two saved assembly masters</span></div>
      <div><small>CHILD PARTS</small><strong>{fixture.parts.length}</strong><span>Part-level identity retained</span></div>
      <div><small>PROCESS OPERATIONS</small><strong>{visibleOperations.length}</strong><span>Main + alternate + rework</span></div>
      <div><small>RELATIONSHIP TYPES</small><strong>{relationshipCounts.filter((row:any)=>row.count>0).length}/11</strong><span>All typed route links represented</span></div>
      <div><small>VEHICLE CATEGORIES</small><strong>{new Set(visibleLegs.map((leg:any)=>leg.vehicleType)).size}/16</strong><span>Saved master routes + leg snapshots</span></div>
    </div>
    <div className="transport-demo-view-tabs" role="tablist" aria-label="Two-component acceptance views">
      <button type="button" role="tab" aria-selected={view==="assemblies"} onClick={()=>setView("assemblies")}>Assemblies & parts</button>
      <button type="button" role="tab" aria-selected={view==="routes"} onClick={()=>setView("routes")}>Part process routes</button>
      <button type="button" role="tab" aria-selected={view==="relationships"} onClick={()=>setView("relationships")}>Relationship types</button>
      <button type="button" role="tab" aria-selected={view==="transport"} onClick={()=>setView("transport")}>Transport legs</button>
      <button type="button" role="tab" aria-selected={view==="vehicles"} onClick={()=>setView("vehicles")}>All vehicles</button>
      <button type="button" role="tab" aria-selected={view==="materials"} onClick={()=>setView("materials")}>Material feeds</button>
      <button type="button" role="tab" aria-selected={view==="modules"} onClick={()=>setView("modules")}>20-module coverage</button>
    </div>
    {view==="assemblies"&&<div className="transport-demo-branches">
      {componentSummaries.map(({component,parts}:any)=><article className="transport-demo-lane" key={component.id}>
        <div className="transport-demo-lane-title"><strong>{component.partNumber} · {component.name}</strong><small>{parts.length} saved child parts · PO {fixture.purchaseOrder.number}</small></div>
        <div className="transport-demo-track">{parts.map((part:any)=><div className="transport-demo-step-wrap" key={part.id}>
          <div className="transport-demo-operation"><small>{part.partNumber}</small><strong>{part.name}</strong><span>{part.revision} · {part.precisionClass} · {part.processes.length} main process stages</span></div>
        </div>)}</div>
      </article>)}
    </div>}
    {view==="routes"&&<div className="transport-demo-branches">
      {partSummary.filter(({part}:any)=>partFilter==="all"||part.id===partFilter).map(({part,line,operations}:any)=><article className="transport-demo-lane" key={part.id}>
        <div className="transport-demo-lane-title"><strong>{part.partNumber} · {part.name}</strong><small>{componentById.get(part.componentId)?.partNumber} · {line?.id} · {operations.length} linked process / branch steps</small></div>
        <div className="transport-demo-track">{operations.map((operation:any,index:number)=><div className={"transport-demo-step-wrap"+(activeOperation?.id===operation.id?" is-current":"")} key={operation.id}>
          <div className="transport-demo-operation"><small>OP-{String(operation.sequence).padStart(3,"0")} · {operation.branch}</small><strong>{operation.name}</strong><span>{operation.status} · {operation.quantity} pcs · {operation.toleranceCategory||"No class"}</span></div>
          {index<operations.length-1&&<span className="transport-demo-arrow route-connector route-connector-main">→</span>}
        </div>)}</div>
        <div className="transport-demo-material-summary"><strong>Part BOM / process feed</strong>{visibleLinks.filter((link:any)=>link.poLineId===line?.id).map((link:any)=><span key={link.id}>{materialById.get(link.materialId)?.code} → {operationById.get(link.operationId)?.name} · {link.flowType} · {link.quantityPerPart} {link.unit}</span>)}</div>
      </article>)}
    </div>}
    {view==="relationships"&&<div className="transport-demo-relationships">
      <div className="transport-demo-lane-title"><strong>Saved process-to-process relationship links</strong><small>All 11 types are saved; filter by part to see the exact PO-line route</small></div>
      <div className="transport-demo-costs">{relationshipCounts.map((row:any)=><div key={row.type}><small>{relationshipLabels[row.type]}</small><strong>{row.count}</strong><span>Saved relationship(s)</span></div>)}</div>
      {visibleRelationships.map((link:any)=><div className="transport-demo-relationship-row" key={link.id}>
        <span className={"route-flow-link-symbol route-flow-curve-"+link.relationshipType}>{relationshipLabels[link.relationshipType]||link.relationshipType}</span>
        <strong>{operationById.get(link.fromOperationId)?.name}</strong><span>→</span><strong>{operationById.get(link.toOperationId)?.name}</strong>
        <small>{partLabel(link.poLineId)} · {link.status}{link.condition?" · "+link.condition:""}</small>
      </div>)}
    </div>}
    {view==="transport"&&<div className="transport-demo-transport">
      <div className="transport-demo-lane-title"><strong>All saved transport legs across the selected assemblies</strong><small>Every leg retains route, vendor, PO line, process anchor, vehicle, trips and rate snapshot</small></div>
      {visibleLegs.map((leg:any)=><button type="button" className={"transport-demo-transport-row"+(selectedLeg===leg.id?" is-selected":"")} key={leg.id} onClick={()=>setSelectedLeg(leg.id)}>
        <span><VehicleBadge vehicleType={leg.vehicleType}/></span><strong>{leg.fromLocation} → {leg.toLocation}</strong><small>{vendorById.get(leg.vendorId)} · {partLabel(leg.poLineId)} · {leg.placement}</small><em>{leg.tripCount} × {money(leg.fixedAmount)} = {money(leg.fixedAmount*leg.tripCount)}</em>
      </button>)}
      {selectedLegRow&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Selected leg: <strong>{selectedLegRow.id}</strong> · {selectedLegRow.anchorOperationId?operationById.get(selectedLegRow.anchorOperationId)?.name:"Component start"}{selectedLegRow.targetOperationId?" → "+operationById.get(selectedLegRow.targetOperationId)?.name:""} · {selectedLegRow.status} · {selectedLegRow.tripDirection}</span></div>}
    </div>}
    {view==="vehicles"&&<div className="transport-demo-carriers">
      <div className="transport-demo-lane-title"><strong>Every supported vehicle category is represented in saved route masters and component legs</strong><small>All 16 categories are present together in this single acceptance dataset</small></div>
      <div className="transport-demo-vehicle-legend">{fixture.transportRoutes.map((route:any)=><div className="transport-demo-transport-row" key={route.id}><VehicleBadge vehicleType={route.vehicleType}/><strong>{route.fromLocation} → {route.toLocation}</strong><small>{vendorById.get(route.vendorId)} · {route.tripDirection}</small><em>{money(route.fixedAmount)}</em></div>)}</div>
    </div>}
    {view==="materials"&&<div className="transport-demo-relationships">
      <div className="transport-demo-lane-title"><strong>Multi-material BOM and material-to-process flows</strong><small>Part, BOM, material, PO line and operation IDs are independently linked</small></div>
      {visibleLinks.map((link:any)=><div className="transport-demo-relationship-row" key={link.id}>
        <strong>{partLabel(link.poLineId)}</strong><span>→</span><strong>{materialById.get(link.materialId)?.name}</strong><small>{bomById.get(link.bomLineId)?.id} · {link.flowType} · {link.placement} · {link.quantityPerPart} {link.unit} · {operationById.get(link.operationId)?.name}</small>
      </div>)}
    </div>}
    {view==="modules"&&<div className="transport-demo-relationships">
      <div className="transport-demo-lane-title"><strong>All 20 modules have connected records in this synthetic acceptance dataset</strong><small>Module coverage is derived from saved records; empty live customer data is not modified</small></div>
      {moduleCoverage.map((module:any)=><div className="transport-demo-relationship-row" key={module.id}><strong>{module.label}</strong><span>{module.id}</span><small>{module.collections.join(" · ")}</small><CheckCircle2 size={15}/></div>)}
    </div>}
    <RouteConnectorLegend/>
    <div className="transport-demo-vehicle-legend"><strong>Vehicle identities · all {allVehicles.length} saved master categories</strong>{fixture.transportRoutes.map((route:any)=><VehicleBadge key={route.id} vehicleType={route.vehicleType}/>)}</div>
    <div className="transport-demo-safety"><strong>What this scenario verifies</strong>
      <span>Two Component Master assemblies → five child parts → five part-level PO lines → independent main / alternate / rework operation chains → 11 typed relationship kinds → multi-material BOM and process feeds → all 16 transport categories → quotes, payments, inspections, stock ledger, contacts and follow-up assignments → all 20 module data domains.</span>
      <span>All company, supplier, PO, material and process values are synthetic. This is a read-only fixture preview and does not write to live AXIMACH records.</span>
    </div>
  </section>;
}
