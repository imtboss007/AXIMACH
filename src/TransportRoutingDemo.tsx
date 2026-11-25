import { useMemo, useState } from "react";
import { Activity, CheckCircle2, GitBranch, RotateCcw, X } from "lucide-react";
import demoFixture from "./single-component-route-demo.json";
import type { ComponentTransportLegRecord, MaterialProcessLinkRecord, MaterialRecord, TransportRouteRecord } from "./manufacturingData";
import { TransportLegMarker, VehicleBadge, VEHICLE_TYPES } from "./TransportVehicle";
import { MaterialFlowMarker } from "./MaterialFlowMarker";
import { RouteConnectorLegend } from "./RouteConnectorLegend";
import { SingleComponentRouteGraphDemo } from "./SingleComponentRouteGraphDemo";

type Props={onClose?:()=>void};
type DemoOperation={id:string;name:string;sequence:number;branch:string;relationType:string|null;parentId:string;quantity:number;costIncluded:boolean;category:string;processType:string;subProcess:string;subComponent:string;ratePerPartINR:number;plannedCostINR:number;costRole:"base"|"alternate"|"rework"};
const operations=demoFixture.operations as DemoOperation[];
const legs=demoFixture.transportLegs as unknown as Array<ComponentTransportLegRecord&{costRole:"base"|"alternate"|"rework";costIncluded:boolean}>;
const materials=demoFixture.materials as unknown as MaterialRecord[];
const materialLinks=demoFixture.materialProcessLinks as unknown as MaterialProcessLinkRecord[];
const routes=new Map(demoFixture.transportRoutes.map(route=>[route.id,route as unknown as TransportRouteRecord]));
const vendors=new Map(demoFixture.vendors.map(vendor=>[vendor.id,vendor.company]));
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const baseOperations=operations.filter(row=>row.costRole==="base").sort((a,b)=>a.sequence-b.sequence);
const operationGroups=[...new Set(operations.map(row=>row.branch))];
const processCost=(role:"base"|"alternate"|"rework")=>operations.filter(row=>row.costRole===role).reduce((sum,row)=>sum+row.plannedCostINR,0);
const transportCost=(role:"base"|"alternate"|"rework")=>legs.filter(row=>row.costRole===role).reduce((sum,row)=>sum+row.fixedAmount*row.tripCount,0);
const materialCost=demoFixture.bomLines.reduce((sum,line)=>{const material=materials.find(row=>row.id===line.materialId);return sum+(material?.ratePerUnit||0)*line.quantityPerPart*demoFixture.component.quantity*(1+line.scrapPercent/100);},0);
const allProcessCost=processCost("base")+processCost("alternate")+processCost("rework");
const allTransportCost=transportCost("base")+transportCost("alternate")+transportCost("rework");

function ProcessRateGraph({rows}:{rows:DemoOperation[]}) {
 const width=1080,height=260,padX=48,padY=28,maxRate=Math.max(1,...rows.map(row=>row.ratePerPartINR));
 const plotWidth=width-padX*2,plotHeight=height-padY*2;
 const points=rows.map((row,index)=>({row,x:padX+(rows.length===1?0:index*plotWidth/(rows.length-1)),y:height-padY-(row.ratePerPartINR/maxRate)*plotHeight}));
 const polyline=points.map(point=>point.x+","+point.y).join(" ");
 return <section className="transport-demo-rate-panel">
  <div className="transport-demo-rate-heading"><div><span>ENGINEERING COST MODEL · SYNTHETIC RATE CARD</span><h4>Process rate graph · INR per piece</h4><p>Every operation is priced against the same AST-1001 PO line quantity of {demoFixture.component.quantity} pieces.</p></div><div className="transport-demo-rate-total"><small>BASE PROCESS PLAN</small><strong>{money(processCost("base"))}</strong></div></div>
  <div className="transport-demo-rate-chart-scroll"><svg className="transport-demo-rate-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Per-operation rate in rupees per piece across all process stages">
    {[0,.25,.5,.75,1].map(fraction=><g key={fraction}><line x1={padX} x2={width-padX} y1={height-padY-fraction*plotHeight} y2={height-padY-fraction*plotHeight} stroke="#d8e5ef" strokeDasharray="3 5"/><text x={padX-9} y={height-padY-fraction*plotHeight+3} textAnchor="end" fontSize="9" fill="#71869a">{Math.round(maxRate*fraction)}</text></g>)}
    <polyline points={polyline} fill="none" stroke="#2389a4" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
    {points.map(point=><g key={point.row.id}><circle cx={point.x} cy={point.y} r="5" fill={point.row.costRole==="alternate"?"#3f84ca":point.row.costRole==="rework"?"#d46a55":"#168d88"} stroke="#fff" strokeWidth="2"><title>{point.row.name} · {money(point.row.ratePerPartINR)} / piece · {money(point.row.plannedCostINR)} planned</title></circle><text x={point.x} y={height-7} textAnchor="middle" fontSize="8" fill="#667f94">{String(point.row.sequence).padStart(2,"0")}</text></g>)}
    <text x={padX} y="13" fontSize="9" fontWeight="700" fill="#607a90">₹ / PIECE</text>
  </svg></div>
  <div className="transport-demo-rate-legend"><span><i className="is-base"/>Base / included route</span><span><i className="is-alt"/>Alternate route · excluded until selected</span><span><i className="is-rework"/>Rework route · conditional</span></div>
  <div className="transport-demo-operation-cost-table">
   <div className="transport-demo-cost-table-head"><span>OP / PROCESS</span><span>ROUTE / BOM SUBASSEMBLY</span><span>QTY</span><span>RATE / PC</span><span>PLANNED COST</span></div>
   {rows.map(row=><div className={"transport-demo-cost-table-row is-"+row.costRole} key={row.id}><span><b>OP-{String(row.sequence).padStart(3,"0")}</b> {row.name}<small>{row.category} · {row.processType}</small></span><span>{row.branch}<small>{row.subComponent}</small></span><span>{row.quantity}</span><span>{money(row.ratePerPartINR)}</span><strong>{money(row.plannedCostINR)}</strong></div>)}
  </div>
 </section>;
}

export default function TransportRoutingDemo({onClose}:Props) {
 const [selectedLegId,setSelectedLegId]=useState("");
 const [selectedMaterialLinkId,setSelectedMaterialLinkId]=useState("");
 const [alternateEnabled,setAlternateEnabled]=useState(false);
 const [reworkEnabled,setReworkEnabled]=useState(false);
 const [simulationIndex,setSimulationIndex]=useState(-1);
 const activeOperations=useMemo(()=>operations.filter(row=>row.costRole==="base"||(row.costRole==="alternate"&&alternateEnabled)||(row.costRole==="rework"&&reworkEnabled)).sort((a,b)=>a.sequence-b.sequence),[alternateEnabled,reworkEnabled]);
 const currentOperation=activeOperations[simulationIndex];
 const startLegs=legs.filter(leg=>!leg.anchorOperationId||leg.placement==="start");
 const legsAt=(operationId:string,placement:"before"|"after")=>legs.filter(leg=>leg.anchorOperationId===operationId&&(leg.placement||"after")===placement);
 const renderLeg=(leg:typeof legs[number])=><TransportLegMarker key={leg.id} leg={leg} vendorName={vendors.get(leg.vendorId)||"ASTER transport"} routeRecord={routes.get(leg.routeId)} selected={selectedLegId===leg.id} onSelect={()=>setSelectedLegId(current=>current===leg.id?"":leg.id)}/>;
 const materialLinksAt=(operationId:string,placement:"before"|"after")=>materialLinks.filter(link=>link.operationId===operationId&&link.placement===placement);
 const renderMaterialLink=(link:MaterialProcessLinkRecord)=>{const material=materials.find(row=>row.id===link.materialId);return material?<MaterialFlowMarker key={link.id} link={link} material={material} componentQuantity={demoFixture.component.quantity} selected={selectedMaterialLinkId===link.id} onSelect={()=>setSelectedMaterialLinkId(current=>current===link.id?"":link.id)}/>:null;};
 const activeProcessCost=processCost("base")+(alternateEnabled?processCost("alternate"):0)+(reworkEnabled?processCost("rework"):0);
 const activeTransportCost=transportCost("base")+(alternateEnabled?transportCost("alternate"):0)+(reworkEnabled?transportCost("rework"):0);
 const activeTotal=materialCost+activeProcessCost+activeTransportCost;
 const tripCount=(role:string)=>legs.filter(row=>row.costRole===role).reduce((sum,row)=>sum+row.tripCount,0);
 const rateRows=[...operations].sort((a,b)=>a.sequence-b.sequence);
 const orderedBranches=["Main route","Shaft subassembly","Bracket subassembly","Base plate subassembly","Manifold subassembly","Alternate route","Rework route","Final assembly"].filter(branch=>operationGroups.includes(branch));
 return <section className="transport-demo-panel surface-panel" aria-label="One-company one-component advanced manufacturing route and rate demonstration">
  <div className="transport-demo-heading"><div><span className="transport-demo-kicker"><Activity size={13}/> ISOLATED SIMULATION / NO LIVE RECORDS · ONE COMPANY / ONE PO / ONE COMPONENT</span>
   <h3>{demoFixture.company.name} · {demoFixture.component.partNumber} · {demoFixture.component.name}</h3>
   <p>{demoFixture.purchaseOrder.number} · {demoFixture.component.material} · {demoFixture.component.quantity} pieces · {operations.length} priced operations · {demoFixture.expected.processCategoryCount} process categories</p>
  </div><div className="transport-demo-heading-actions"><span className="module-number">SINGLE SOURCE DEMO</span>{onClose&&<button type="button" className="icon-control" onClick={onClose} aria-label="Close transport demo"><X size={14}/></button>}</div></div>
  <div className="transport-demo-toolbar">
   <button type="button" className="button-primary compact-button" onClick={()=>setSimulationIndex(index=>Math.min(index+1,activeOperations.length-1))} disabled={simulationIndex>=activeOperations.length-1}><Activity size={13}/> Next process step</button>
   <button type="button" className="button-quiet compact-button" onClick={()=>setSimulationIndex(-1)}><RotateCcw size={13}/> Reset simulation</button>
   <label><input type="checkbox" checked={alternateEnabled} onChange={event=>{setAlternateEnabled(event.target.checked);setSimulationIndex(-1);}}/> Activate alternate supplier route</label>
   <label><input type="checkbox" checked={reworkEnabled} onChange={event=>{setReworkEnabled(event.target.checked);setSimulationIndex(-1);}}/> Include conditional rework cost</label>
   <span>{simulationIndex<0?"Ready":simulationIndex>=activeOperations.length-1?"Simulation reached final active step":"Step "+(simulationIndex+1)+" of "+activeOperations.length}</span>
  </div>
  {currentOperation&&<div className="transport-demo-current"><CheckCircle2 size={15}/><span>Current simulation step: <strong>OP-{String(currentOperation.sequence).padStart(3,"0")} · {currentOperation.name}</strong></span></div>}
  <SingleComponentRouteGraphDemo/>
  <ProcessRateGraph rows={rateRows}/>
  <section className="transport-demo-branch-lanes" aria-label="All manufacturing routes for the single component">
   <div className="transport-demo-lane-title"><strong><GitBranch size={14}/> Manufacturing route lanes · one component / one PO line</strong><small>Every lane retains the same company, PO, component and quantity scope.</small></div>
   {orderedBranches.map(branch=>{const branchOperations=operations.filter(operation=>operation.branch===branch).sort((a,b)=>a.sequence-b.sequence);const optional=branch==="Alternate route"||branch==="Rework route";const enabled=!optional||(branch==="Alternate route"?alternateEnabled:reworkEnabled);const branchCost=branchOperations.reduce((sum,row)=>sum+row.plannedCostINR,0);return <div className={"transport-demo-lane "+(branch==="Alternate route"?"transport-demo-alternate":branch==="Rework route"?"transport-demo-rework":"")+(enabled?" is-enabled":" is-disabled")} key={branch}>
    <div className="transport-demo-lane-title"><strong>{branch}</strong><small>{branchOperations.length} stages · {money(branchCost)} planned · {enabled?(optional?"Included in active scenario":"Included in base plan"):"Visible but excluded from active scenario"}</small></div>
    {branch==="Main route"&&startLegs.length>0&&<div className="transport-demo-start-legs">{startLegs.map(renderLeg)}</div>}
    <div className="transport-demo-track">{branchOperations.map((operation,index)=><div className="transport-demo-step-wrap" key={operation.id}>
      {materialLinksAt(operation.id,"before").map(renderMaterialLink)}
      {legsAt(operation.id,"before").map(renderLeg)}
      <div className={"transport-demo-operation"+(currentOperation?.id===operation.id?" is-current":"")}><small>OP-{String(operation.sequence).padStart(3,"0")} · {operation.category}</small><strong>{operation.name}</strong><span>{operation.subComponent} · {operation.quantity} pcs · {money(operation.ratePerPartINR)}/pc · {money(operation.plannedCostINR)}</span></div>
      {legsAt(operation.id,"after").map(renderLeg)}
      {materialLinksAt(operation.id,"after").map(renderMaterialLink)}
      {index<branchOperations.length-1&&<span className="transport-demo-arrow route-connector route-connector-main">→</span>}
    </div>)}</div>
   </div>;})}
  </section>
  <div className="transport-demo-material-summary"><strong>BOM material feeds · all allocated to AST-1001</strong>{materialLinks.map(link=>{const material=materials.find(row=>row.id===link.materialId);return <span key={link.id}>{material?.code||"Material"} → {demoFixture.operations.find(row=>row.id===link.operationId)?.name||"Process"} · {link.quantityPerPart} {link.unit}/part</span>;})}</div>
  <RouteConnectorLegend/>
  <div className="transport-demo-vehicle-legend"><strong>Vehicle identity</strong>{VEHICLE_TYPES.map(type=><VehicleBadge key={type} vehicleType={type}/>)}</div>
  <div className="transport-demo-costs">
   <div><small>BOM MATERIAL COST</small><strong>{money(materialCost)}</strong><span>{bomLinesSummary()}</span></div>
   <div><small>BASE PROCESS COST</small><strong>{money(processCost("base"))}</strong><span>{baseOperations.length} included operation stages</span></div>
   <div><small>BASE TRANSPORT COST</small><strong>{money(transportCost("base"))}</strong><span>{tripCount("base")} planned trips</span></div>
   <div className="transport-demo-total"><small>ACTIVE TOTAL PLAN</small><strong>{money(activeTotal)}</strong><span>Materials + process + active transport</span></div>
  </div>
  <div className="transport-demo-optional-costs"><span>Alternate process + transport: <b>{money(processCost("alternate")+transportCost("alternate"))}</b> · {alternateEnabled?"included":"excluded"}</span><span>Conditional rework + transport: <b>{money(processCost("rework")+transportCost("rework"))}</b> · {reworkEnabled?"included":"excluded"}</span><span>All possible scenario cost: <b>{money(materialCost+allProcessCost+allTransportCost)}</b></span></div>
  <p className="transport-demo-safety">Synthetic preview only. One company, one PO, one top-level component and one PO line. BOM subassembly branches are all scoped to that same component. The alternate and rework scenarios are visible but excluded from the base plan until selected. Clicking a vehicle icon opens its own transport record. No company, PO, component, vendor, material, BOM, operation, route, transport leg or inventory record is written to AXIMACH.</p>
 </section>;
}

function bomLinesSummary(){return demoFixture.bomLines.length+" BOM / consumable lines · all same component";}
