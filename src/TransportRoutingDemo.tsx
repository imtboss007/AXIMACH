import { useMemo, useState } from "react";
import { Activity, CheckCircle2, GitBranch, RotateCcw, X } from "lucide-react";
import demoFixture from "../tests/fixtures/aximach-transport-routing-demo.json";
import type { ComponentTransportLegRecord, MaterialProcessLinkRecord, MaterialRecord, TransportRouteRecord } from "./manufacturingData";
import { TransportLegMarker, VehicleBadge, VEHICLE_TYPES } from "./TransportVehicle";
import { MaterialFlowMarker } from "./MaterialFlowMarker";
import { RouteConnectorLegend } from "./RouteConnectorLegend";

type Props = { onClose?: () => void };
type DemoOperation = { id:string; name:string; sequence:number; branch:string; relationType:string|null; parentId:string; quantity:number; costIncluded:boolean };

const operations = demoFixture.operations as DemoOperation[];
const legs = demoFixture.transportLegs as unknown as ComponentTransportLegRecord[];
const materials = demoFixture.materials as unknown as MaterialRecord[];
const materialLinks = demoFixture.materialProcessLinks as unknown as MaterialProcessLinkRecord[];
const routes = new Map(demoFixture.transportRoutes.map(route=>[route.id,route as unknown as TransportRouteRecord]));
const vendors = new Map(demoFixture.vendors.map(vendor=>[vendor.id,vendor.company]));
const mainOperations = operations.filter(operation=>operation.branch==="Main route").sort((a,b)=>a.sequence-b.sequence);
const alternateOperations = operations.filter(operation=>operation.branch!=="Main route").sort((a,b)=>a.sequence-b.sequence);
const money = (value:number) => "₹"+value.toLocaleString("en-IN",{maximumFractionDigits:2});

export default function TransportRoutingDemo({onClose}:Props) {
  const [selectedLegId,setSelectedLegId] = useState("");
  const [selectedMaterialLinkId,setSelectedMaterialLinkId] = useState("");
  const [alternateEnabled,setAlternateEnabled] = useState(false);
  const [simulationIndex,setSimulationIndex] = useState(-1);
  const activeOperations = alternateEnabled ? [...mainOperations,...alternateOperations] : mainOperations;
  const currentOperation = activeOperations[simulationIndex];
  const startLegs = legs.filter(leg=>!leg.anchorOperationId||leg.placement==="start");
  const legsAt = (operationId:string,placement:"before"|"after") =>
    legs.filter(leg=>leg.anchorOperationId===operationId&&(leg.placement||"after")===placement);
  const renderLeg = (leg:ComponentTransportLegRecord) => <TransportLegMarker key={leg.id} leg={leg}
    vendorName={vendors.get(leg.vendorId)||"Demo vendor"} routeRecord={routes.get(leg.routeId)} selected={selectedLegId===leg.id}
    onSelect={()=>setSelectedLegId(current=>current===leg.id?"":leg.id)}/>;
  const materialLinksAt = (operationId:string,placement:"before"|"after") => materialLinks.filter(link=>link.operationId===operationId&&link.placement===placement);
  const renderMaterialLink = (link:MaterialProcessLinkRecord) => {const material=materials.find(row=>row.id===link.materialId);return material?<MaterialFlowMarker key={link.id} link={link} material={material} componentQuantity={demoFixture.component.quantity} selected={selectedMaterialLinkId===link.id} onSelect={()=>setSelectedMaterialLinkId(current=>current===link.id?"":link.id)}/>:null;};
  const mainTransportCost = useMemo(()=>legs.filter(leg=>!leg.anchorOperationId||mainOperations.some(operation=>operation.id===leg.anchorOperationId)).reduce((sum,leg)=>sum+leg.fixedAmount*leg.tripCount,0),[]);
  const alternateTransportCost = useMemo(()=>legs.filter(leg=>alternateOperations.some(operation=>operation.id===leg.anchorOperationId)).reduce((sum,leg)=>sum+leg.fixedAmount*leg.tripCount,0),[]);
  const activeTransportCost = mainTransportCost+(alternateEnabled?alternateTransportCost:0);
  const processCost = demoFixture.component.processCostINR;
  return <section className="transport-demo-panel surface-panel" aria-label="Multi-route and transport demonstration">
    <div className="transport-demo-heading">
      <div><span className="transport-demo-kicker"><Activity size={13}/> ISOLATED SIMULATION / NO LIVE RECORDS</span>
        <h3>One component · multiple process and transport routes</h3>
        <p>{demoFixture.component.partNumber} · {demoFixture.component.name} · {demoFixture.component.material} · {demoFixture.component.quantity} pcs</p>
      </div>
      <div className="transport-demo-heading-actions"><span className="module-number">DEMO ONLY</span>{onClose&&<button type="button" className="icon-control" onClick={onClose} aria-label="Close transport demo"><X size={14}/></button>}</div>
    </div>
    <div className="transport-demo-toolbar">
      <button type="button" className="button-primary compact-button" onClick={()=>setSimulationIndex(index=>Math.min(index+1,activeOperations.length-1))} disabled={simulationIndex>=activeOperations.length-1}><Activity size={13}/> Next process step</button>
      <button type="button" className="button-quiet compact-button" onClick={()=>setSimulationIndex(-1)}><RotateCcw size={13}/> Reset simulation</button>
      <label><input type="checkbox" checked={alternateEnabled} onChange={event=>{setAlternateEnabled(event.target.checked);setSimulationIndex(-1);}}/> Activate alternate supplier route</label>
      <span>{simulationIndex<0?"Ready":simulationIndex>=activeOperations.length-1?"Simulation reached final active step": "Step "+(simulationIndex+1)+" of "+activeOperations.length}</span>
    </div>
    {currentOperation&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Current simulation step: <strong>OP-{String(currentOperation.sequence).padStart(3,"0")} · {currentOperation.name}</strong></span></div>}
    <div className="transport-demo-lane">
      <div className="transport-demo-lane-title"><strong>Main manufacturing route</strong><small>{mainOperations.length} process steps · all legs belong to the same component / PO line</small></div>
      {startLegs.length>0&&<div className="transport-demo-start-legs">{startLegs.map(renderLeg)}</div>}
      <div className="transport-demo-track">{mainOperations.map((operation,index)=><div className="transport-demo-step-wrap" key={operation.id}>
        {materialLinksAt(operation.id,"before").map(renderMaterialLink)}
        {legsAt(operation.id,"before").map(renderLeg)}
        <div className={"transport-demo-operation"+(currentOperation?.id===operation.id?" is-current":"")}><small>OP-{String(operation.sequence).padStart(3,"0")}</small><strong>{operation.name}</strong><span>{operation.quantity} pcs · main route</span></div>
        {legsAt(operation.id,"after").map(renderLeg)}
        {materialLinksAt(operation.id,"after").map(renderMaterialLink)}
        {index<mainOperations.length-1&&<span className="transport-demo-arrow route-connector route-connector-main">→</span>}
      </div>)}</div>
    </div>
    <div className={"transport-demo-lane transport-demo-alternate"+(alternateEnabled?" is-enabled":"")}>
      <div className="transport-demo-lane-title"><strong><GitBranch size={14}/> Alternate grinding supplier route</strong><small>{alternateEnabled?"Included in active route costing":"Available branch · excluded until activated"}</small></div>
      <div className="transport-demo-track">{alternateOperations.map(operation=><div className="transport-demo-step-wrap" key={operation.id}>
        {materialLinksAt(operation.id,"before").map(renderMaterialLink)}
        {legsAt(operation.id,"before").map(renderLeg)}
        <div className={"transport-demo-operation"+(currentOperation?.id===operation.id?" is-current":"")}><small>OP-{String(operation.sequence).padStart(3,"0")}</small><strong>{operation.name}</strong><span>{operation.quantity} pcs · alternate</span></div>
        {legsAt(operation.id,"after").map(renderLeg)}
        {materialLinksAt(operation.id,"after").map(renderMaterialLink)}
      </div>)}</div>
    </div>
    <div className="transport-demo-material-summary"><strong>Material feed links</strong>{materialLinks.map(link=>{const material=materials.find(row=>row.id===link.materialId);return <span key={link.id}>{material?.code||"Material"} → {demoFixture.operations.find(row=>row.id===link.operationId)?.name||"Process"} · {link.quantityPerPart} {link.unit}/part</span>;})}</div>
    <RouteConnectorLegend/>
    <div className="transport-demo-vehicle-legend"><strong>Vehicle identity</strong>{VEHICLE_TYPES.map(type=><VehicleBadge key={type} vehicleType={type}/>)}</div>
    <div className="transport-demo-costs">
      <div><small>PROCESS COST</small><strong>{money(processCost)}</strong><span>Kept separate from transport</span></div>
      <div><small>MAIN ROUTE TRANSPORT</small><strong>{money(mainTransportCost)}</strong><span>{legs.filter(leg=>!leg.anchorOperationId||mainOperations.some(operation=>operation.id===leg.anchorOperationId)).reduce((sum,leg)=>sum+leg.tripCount,0)} trips</span></div>
      <div><small>ALTERNATE TRANSPORT</small><strong>{money(alternateTransportCost)}</strong><span>{alternateEnabled?"Included":"Excluded until selected"}</span></div>
      <div className="transport-demo-total"><small>PROCESS + ACTIVE TRANSPORT</small><strong>{money(processCost+activeTransportCost)}</strong><span>{alternateEnabled?"Main + alternate routes":"Main route only"}</span></div>
    </div>
    <p className="transport-demo-safety">Synthetic preview only. Clicking vehicle icons opens that individual transport record. Advancing the simulation highlights the active process; switching on the alternate branch changes only this preview. No company, PO, component, vendor, material, BOM, material-process link, operation, route, transport leg or inventory record is written to AXIMACH.</p>
  </section>;
}
