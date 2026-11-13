import { useMemo, useState } from "react";
import { Activity, CheckCircle2, GitBranch, RotateCcw, Truck, X } from "lucide-react";
import fixtureJson from "../tests/fixtures/aximach-one-component-multipart-route.json";
import { RouteConnectorLegend } from "./RouteConnectorLegend";
import { VehicleBadge, VEHICLE_TYPES } from "./TransportVehicle";

type Props = { onClose?: () => void };
const fixture = fixtureJson as any;
const money = (value:number) => "₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const relationshipLabels:Record<string,string> = {
  main:"Main",alternate:"Alternate",rework:"Rework",dependency:"Dependency",parallel:"Parallel",
  merge:"Merge",split:"Split", "follow-on":"Follow-on",feedback:"Feedback",conditional:"Conditional",successor:"Successor"
};
const partProcessIds = (partId:string) => {
  const part = fixture.parts.find((row:any)=>row.id===partId);
  const branchName = part?.partNumber?.endsWith("-SHAFT") ? "Shaft branch"
    : part?.partNumber?.endsWith("-BODY") ? "Body branch" : "Cover branch";
  const bomIds = new Set(fixture.bomLines.filter((row:any)=>row.partId===partId).map((row:any)=>row.id));
  const linked = fixture.materialProcessLinks.filter((row:any)=>bomIds.has(row.bomLineId)).map((row:any)=>row.operationId);
  const sharedAndBranch = fixture.operations.filter((row:any)=>row.branch==="Main route"||row.branch===branchName).map((row:any)=>row.id);
  return new Set([...linked,...sharedAndBranch]);
};
const partById = new Map(fixture.parts.map((row:any)=>[row.id,row]));
const operationById = new Map(fixture.operations.map((row:any)=>[row.id,row]));
const vendorById = new Map(fixture.vendors.map((row:any)=>[row.id,row.company]));
const routeById = new Map(fixture.transportRoutes.map((row:any)=>[row.id,row]));
const materialById = new Map(fixture.materials.map((row:any)=>[row.id,row]));
const bomById = new Map(fixture.bomLines.map((row:any)=>[row.id,row]));

export default function TransportRoutingDemo({onClose}:Props) {
  const [partFilter,setPartFilter] = useState("all");
  const [view,setView] = useState("branches");
  const [selectedLeg,setSelectedLeg] = useState("mp-leg-09");
  const [showSecondCarrier,setShowSecondCarrier] = useState(false);
  const [step,setStep] = useState(-1);
  const selectedPart = fixture.parts.find((row:any)=>row.id===partFilter);
  const visibleOperations = useMemo(()=>fixture.operations.filter((operation:any)=>{
    if(partFilter==="all")return true;
    return partProcessIds(partFilter).has(operation.id);
  }),[partFilter]);
  const visibleLinks = fixture.materialProcessLinks.filter((link:any)=>!selectedPart||bomById.get(link.bomLineId)?.partId===selectedPart.id);
  const visibleLegs = fixture.transportLegs.filter((leg:any)=>!selectedPart||(()=>{
    const target=operationById.get(leg.targetOperationId||leg.anchorOperationId);
    return !target||partProcessIds(selectedPart.id).has(target.id);
  })());
  const selectedLegRow = fixture.transportLegs.find((row:any)=>row.id===selectedLeg);
  const routeOptions = fixture.transportRoutes.filter((row:any)=>row.fromLocation==="VMC subcontractor"&&row.toLocation==="CNC shaft turning supplier");
  const allRelationshipTypes = Object.keys(relationshipLabels);
  const activeOperation = step>=0?visibleOperations[Math.min(step,visibleOperations.length-1)]:null;
  const branchSummary = fixture.parts.map((part:any)=>({part,operations:[...partProcessIds(part.id)].map(id=>operationById.get(id)).filter(Boolean).sort((a:any,b:any)=>a.sequence-b.sequence)}));
  const simulatedSecondLeg = showSecondCarrier?{id:"SIMULATED-ALT-CARRIER",routeId:"mp-route-12",vehicleType:"4-wheeler",vendorId:"mp-vendor-material",fromLocation:"VMC subcontractor",toLocation:"CNC shaft turning supplier",fixedAmount:650,tripCount:1,anchorOperationId:"mp-op-vmc",targetOperationId:"mp-op-turn"}:null;
  return <section className="transport-demo-panel surface-panel" aria-label="One component multi-part route and transport demonstration">
    <div className="transport-demo-heading">
      <div><span className="transport-demo-kicker"><Activity size={13}/> SYNTHETIC END-TO-END DEMO · READ-ONLY PREVIEW</span>
        <h3>One assembly · three part routes · multiple carriers</h3>
        <p>{fixture.component.partNumber} · {fixture.component.name} · PO {fixture.purchaseOrder.number} · {fixture.poLine.quantity} assemblies</p>
      </div>
      <div className="transport-demo-heading-actions"><span className="module-number">DEMO ONLY</span>{onClose&&<button type="button" className="icon-control" onClick={onClose} aria-label="Close multi-part route demo"><X size={14}/></button>}</div>
    </div>
    <div className="transport-demo-toolbar">
      <label>View part <select aria-label="Filter demo by part" value={partFilter} onChange={event=>{setPartFilter(event.target.value);setStep(-1);}}><option value="all">Whole assembly · all parts</option>{fixture.parts.map((part:any)=><option key={part.id} value={part.id}>{part.partNumber} · {part.name}</option>)}</select></label>
      <button type="button" className="button-primary compact-button" onClick={()=>setStep(value=>Math.min(value+1,visibleOperations.length-1))} disabled={step>=visibleOperations.length-1}><Activity size={13}/> Next process</button>
      <button type="button" className="button-quiet compact-button" onClick={()=>setStep(-1)}><RotateCcw size={13}/> Reset</button>
      <span>{step<0?"Ready to simulate": "Process "+(step+1)+" / "+visibleOperations.length}</span>
    </div>
    {activeOperation&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Highlighted process: <strong>{activeOperation.name}</strong> · {activeOperation.branch}</span></div>}
    <div className="transport-demo-costs">
      <div><small>ASSEMBLY QUANTITY</small><strong>{fixture.poLine.quantity.toLocaleString("en-IN")}</strong><span>One component PO line</span></div>
      <div><small>PARTS</small><strong>{fixture.parts.length}</strong><span>Body · shaft · cover</span></div>
      <div><small>PROCESS OPERATIONS</small><strong>{fixture.operations.length}</strong><span>Shared + branch-specific</span></div>
      <div><small>RELATIONSHIPS</small><strong>{fixture.routeRelationships.length}</strong><span>{allRelationshipTypes.length} relationship types</span></div>
      <div><small>TRANSPORT LEGS</small><strong>{fixture.transportLegs.length+(showSecondCarrier?1:0)}</strong><span>Multiple legs and destinations</span></div>
    </div>
    <div className="transport-demo-view-tabs" role="tablist" aria-label="Demo scenario views">
      <button type="button" role="tab" aria-selected={view==="branches"} onClick={()=>setView("branches")}>Part process routes</button>
      <button type="button" role="tab" aria-selected={view==="relationships"} onClick={()=>setView("relationships")}>Relationship types</button>
      <button type="button" role="tab" aria-selected={view==="transport"} onClick={()=>setView("transport")}>Transport legs</button>
      <button type="button" role="tab" aria-selected={view==="carriers"} onClick={()=>setView("carriers")}>Carrier options</button>
    </div>
    {view==="branches"&&<div className="transport-demo-branches">
      {branchSummary.filter(({part}:any)=>partFilter==="all"||part.id===partFilter).map(({part,operations}:any)=><article className="transport-demo-lane" key={part.id}>
        <div className="transport-demo-lane-title"><strong>{part.partNumber} · {part.name}</strong><small>{part.materialIds.length} material types · {operations.length} linked process steps</small></div>
        <div className="transport-demo-track">{operations.map((operation:any,index:number)=><div className={"transport-demo-step-wrap"+(activeOperation?.id===operation.id?" is-current":"")} key={operation.id}>
          <div className="transport-demo-operation"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><strong>{operation.name}</strong><span>{operation.branch} · {operation.quantity} pcs</span></div>
          {index<operations.length-1&&<span className="transport-demo-arrow route-connector route-connector-main">→</span>}
        </div>)}</div>
        <div className="transport-demo-material-summary"><strong>Part BOM / process feed</strong>{visibleLinks.filter((link:any)=>operations.some((operation:any)=>operation.id===link.operationId)).map((link:any)=><span key={link.id}>{materialById.get(link.materialId)?.code} → {operationById.get(link.operationId)?.name} · {bomById.get(link.bomLineId)?.quantityPerPart} {materialById.get(link.materialId)?.unit}/part</span>)}</div>
      </article>)}
      <article className="transport-demo-lane"><div className="transport-demo-lane-title"><strong>Shared assembly stages</strong><small>Common operations before branch split and final inspection / merge</small></div><div className="transport-demo-track">{fixture.operations.filter((row:any)=>["mp-op-cut","mp-op-vmc","mp-op-inspect"].includes(row.id)).map((operation:any)=><div className="transport-demo-step-wrap" key={operation.id}><div className="transport-demo-operation"><small>OP-{String(operation.sequence).padStart(3,"0")}</small><strong>{operation.name}</strong><span>Shared assembly route</span></div></div>)}</div></article>
    </div>}
    {view==="relationships"&&<div className="transport-demo-relationships">
      <div className="transport-demo-lane-title"><strong>Saved process-to-process connections</strong><small>All 11 relationship types are represented in this one-component example</small></div>
      {fixture.routeRelationships.map((link:any)=><div className="transport-demo-relationship-row" key={link.id}>
        <span className={"route-flow-link-symbol route-flow-curve-"+link.relationshipType}>{relationshipLabels[link.relationshipType]||link.relationshipType}</span>
        <strong>{operationById.get(link.fromOperationId)?.name}</strong><span>→</span><strong>{operationById.get(link.toOperationId)?.name}</strong>
        <small>{link.condition||link.status}</small>
      </div>)}
    </div>}
    {view==="transport"&&<div className="transport-demo-transport">
      <div className="transport-demo-lane-title"><strong>Separate transport legs across multiple process destinations</strong><small>Each row retains its own route, carrier, vehicle, pickup and delivery</small></div>
      {visibleLegs.map((leg:any)=><button type="button" className={"transport-demo-transport-row"+(selectedLeg===leg.id?" is-selected":"")} key={leg.id} onClick={()=>setSelectedLeg(leg.id)}>
        <span><Truck size={15}/>{leg.vehicleType}</span><strong>{routeById.get(leg.routeId)?.fromLocation} → {routeById.get(leg.routeId)?.toLocation}</strong><small>{vendorById.get(leg.vendorId)} · {leg.id}</small><em>{money(leg.fixedAmount*leg.tripCount)}</em>
      </button>)}
      {selectedLegRow&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Selected leg: <strong>{selectedLegRow.id}</strong> · {selectedLegRow.anchorOperationId?operationById.get(selectedLegRow.anchorOperationId)?.name:"Component start"} {selectedLegRow.targetOperationId?" → "+operationById.get(selectedLegRow.targetOperationId)?.name:""} · {selectedLegRow.vehicleType}</span></div>}
    </div>}
    {view==="carriers"&&<div className="transport-demo-carriers">
      <div className="transport-demo-lane-title"><strong>Same process connection · different transport options</strong><small>VMC subcontractor → CNC shaft turning supplier</small></div>
      {routeOptions.map((route:any)=><div className="transport-demo-transport-row" key={route.id}><span><Truck size={15}/>{route.vehicleType}</span><strong>{route.fromLocation} → {route.toLocation}</strong><small>{vendorById.get(route.vendorId)} · {route.id}</small><em>{money(route.fixedAmount)}</em></div>)}
      {simulatedSecondLeg&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Simulation added a second carrier leg: <strong>{simulatedSecondLeg.vehicleType}</strong> · {vendorById.get(simulatedSecondLeg.vendorId)} · {money(simulatedSecondLeg.fixedAmount)}</span></div>}
      <button type="button" className="button-primary compact-button" onClick={()=>setShowSecondCarrier(value=>!value)}>{showSecondCarrier?"Remove simulated carrier leg":"Add alternative 4-wheeler carrier leg"}</button>
      <small>This preview demonstrates two independent carriers on the same VMC-to-shaft connection. The simulation does not write to live records.</small>
    </div>}
    <RouteConnectorLegend/>
    <div className="transport-demo-vehicle-legend"><strong>Vehicle identity</strong>{VEHICLE_TYPES.map(type=><VehicleBadge key={type} vehicleType={type}/>)}</div>
    <div className="transport-demo-safety"><strong>What this scenario verifies</strong><span>One component PO line → three separate part records → multiple BOM materials per part → shared VMC operation → split / parallel / alternate branch routes → multiple process destinations → distinct carriers and vehicle types → final inspection / merge.</span><span>All company, vendor, PO and material names in this scenario are synthetic. This is a read-only demo; use the live editors to create and save real records.</span></div>
  </section>;
}
