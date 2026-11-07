import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarClock, Check, ClipboardCheck, FileDown, Package, Plus, RotateCcw, Search, ShieldCheck, Truck, Workflow, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ComponentTransportLegRecord, type LifecycleStatus, type OperationRecord, type InspectionMeasurementRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { ComponentIcon } from "./IconStudio";

type LinkedNavigationContext={companyId?:string;poId?:string;poLineId?:string;componentId?:string;operationId?:string;vendorId?:string;routeId?:string};
type Props={onBack:()=>void;onNotice:(value:string)=>void;notice:string;onSelectModule:(id:string,context?:LinkedNavigationContext)=>void;initialContext?:LinkedNavigationContext};
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const transportDraft=()=>({vendorId:"",routeId:"",from:"",to:"",vehicleType:"",tripDirection:"One-way" as "One-way"|"Two-way",tripCount:"1",anchorOperationId:"",placement:"after" as "start"|"before"|"after",pickup:"",delivery:"",cost:"0",notes:""});

export function ProductionPlanWorkspace({onBack,onNotice,notice,onSelectModule,initialContext}:Props){
 const {data,update,syncStatus}=useManufacturingData();
 const companies=activeRows(data.companies),pos=activeRows(data.purchaseOrders),components=activeRows(data.components),vendors=activeRows(data.vendors),ops=activeRows(data.operations),transportRoutes=activeRows(data.transportRoutes||[]),transportLegs=activeRows(data.transportLegs||[]);
 const [search,setSearch]=useState("");const [transportLine,setTransportLine]=useState<{poId:string;lineId:string}|null>(null);const [draft,setDraft]=useState(transportDraft());
 const [companyFilters,setCompanyFilters]=useState<string[]>([]);
 const [poFilters,setPoFilters]=useState<string[]>([]);
 const [componentFilters,setComponentFilters]=useState<string[]>([]);
 const [jobStatusFilters,setJobStatusFilters]=useState<string[]>([]);
 const [selectedJobKeys,setSelectedJobKeys]=useState<string[]>([]);
 const toggleSet=(setter:(next:string[]|((previous:string[])=>string[]))=>void,value:string)=>setter(previous=>previous.includes(value)?previous.filter(item=>item!==value):[...previous,value]);
 const clearFilters=()=>{setSearch("");setCompanyFilters([]);setPoFilters([]);setComponentFilters([]);setJobStatusFilters([]);};
 useEffect(()=>{
  const contextOperation=initialContext?.operationId?ops.find(op=>op.id===initialContext.operationId):undefined;
  const contextPoId=initialContext?.poId||contextOperation?.poId||"";
  const contextPo=pos.find(po=>po.id===contextPoId);
  const contextLineId=initialContext?.poLineId||contextOperation?.poLineId||"";
  const contextComponentId=initialContext?.componentId||contextOperation?.componentId||contextPo?.lines.find(line=>line.id===contextLineId)?.componentId||"";
  setSearch("");
  setCompanyFilters(initialContext?.companyId?[initialContext.companyId]:(contextPo?[contextPo.companyId]:[]));
  setPoFilters(contextPoId?[contextPoId]:[]);
  setComponentFilters(contextComponentId?[contextComponentId]:[]);
  setJobStatusFilters([]);
 },[initialContext?.companyId,initialContext?.poId,initialContext?.poLineId,initialContext?.componentId,initialContext?.operationId]);

 const rows=useMemo(()=>pos.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line,company:companies.find(c=>c.id===po.companyId),component:components.find(c=>c.id===line.componentId),operations:ops.filter(op=>op.poId===po.id&&op.poLineId===line.id),transportLegs:transportLegs.filter(leg=>leg.poId===po.id&&leg.poLineId===line.id)}))),[pos,companies,components,ops,transportLegs]);
 const filtered=rows.filter(row=>{
  const text=[row.company?.name,row.po.number,row.component?.name,row.component?.partNumber,row.line.quantity,row.line.targetDelivery,row.po.targetDelivery,row.line.jobStatus,...row.operations.map(op=>[op.name,op.category,op.subcategory,op.status,op.vendorId,op.plannedStart,op.plannedEnd,op.quantity,op.completed,op.rejected,op.ratePerPart,op.transportCost,op.notes].join(" "))].join(" ").toLowerCase();
  return text.includes(search.toLowerCase().trim())
   &&(!companyFilters.length||companyFilters.includes(row.po.companyId))
   &&(!poFilters.length||poFilters.includes(row.po.id))
   &&(!componentFilters.length||componentFilters.includes(row.line.componentId))
   &&(!jobStatusFilters.length||jobStatusFilters.includes(row.line.jobStatus||"In Progress"));
 });
 const visibleJobKeys=filtered.map(row=>row.po.id+":"+row.line.id);
 const selectedVisibleJobs=filtered.filter(row=>selectedJobKeys.includes(row.po.id+":"+row.line.id));
 const selectVisibleJobs=(checked:boolean)=>setSelectedJobKeys(current=>checked?[...new Set([...current,...visibleJobKeys])]:current.filter(key=>!visibleJobKeys.includes(key)));
 const finishSelectedJobs=(finished:boolean)=>{
  if(!selectedVisibleJobs.length){onNotice("Select one or more PO component jobs first.");return;}
  if(finished){
    const selectedIds=new Set(selectedVisibleJobs.map(row=>row.po.id+":"+row.line.id));
    const incomplete=ops.filter(op=>selectedIds.has(op.poId+":"+op.poLineId)&&op.status!=="Complete");
    if(incomplete.length&&!window.confirm(incomplete.length+" operation(s) on the selected jobs are not Complete. Finish the selected PO jobs anyway?"))return;
  }
  const keys=new Set(selectedVisibleJobs.map(row=>row.po.id+":"+row.line.id));
  const stamp=nowIso();
  update(current=>({...current,purchaseOrders:current.purchaseOrders.map(order=>({...order,updatedAt:stamp,lines:order.lines.map(line=>keys.has(order.id+":"+line.id)?{...line,jobStatus:finished?"Finished":"In progress",jobFinishedAt:finished?stamp:undefined,updatedAt:stamp}:line)}))}));
  onNotice((finished?"Finished ":"Reopened ")+selectedVisibleJobs.length+" selected PO component job(s). Operation history remains unchanged.");
  setSelectedJobKeys([]);
 };
 const setJob=(poId:string,lineId:string,finished:boolean)=>{
  const stamp=nowIso();const po=pos.find(x=>x.id===poId);const line=po?.lines.find(x=>x.id===lineId);if(!po||!line)return;
  if(finished){const incomplete=ops.filter(op=>op.poId===poId&&op.poLineId===lineId&&op.status!=="Complete");if(incomplete.length&&!window.confirm(incomplete.length+" process operation(s) are not Complete. Finish the PO-line job anyway? Operation records will remain unchanged."))return;}
  update(current=>({...current,purchaseOrders:current.purchaseOrders.map(order=>order.id!==poId?order:{...order,updatedAt:stamp,lines:order.lines.map(item=>item.id!==lineId?item:{...item,jobStatus:finished?"Finished":"In progress",jobFinishedAt:finished?stamp:undefined,updatedAt:stamp})})}));
  onNotice(finished?"Job marked Finished. The Process Plan reads the same PO-line status.":"Job reopened. Existing operation and transport history was retained.");
 };
 const openTransport=(poId:string,lineId:string)=>{setTransportLine({poId,lineId});setDraft(transportDraft());};
 const saveTransport=()=>{
  if(!transportLine)return;
  const po=pos.find(x=>x.id===transportLine.poId),line=po?.lines.find(x=>x.id===transportLine.lineId);
  if(!po||!line){onNotice("The selected PO component line is no longer available.");return;}
  const component=components.find(x=>x.id===line.componentId);
  if(!component){onNotice("The selected PO line has no matching Component Directory record.");return;}
  const route=transportRoutes.find(x=>x.id===draft.routeId);
  if(!route){onNotice("Select a saved route from Transport Directory first.");return;}
  if(route.active===false){onNotice("This Transport Directory route is inactive. Activate it before assigning it to a new PO component.");return;}
  const vendor=vendors.find(x=>x.id===route.vendorId);
  if(!vendor){onNotice("The selected route vendor is missing or archived. Repair the route in Transport Directory.");return;}
  const amount=Number(draft.cost),tripCount=Number(draft.tripCount);
  if(!Number.isFinite(amount)||amount<0||amount!==route.fixedAmount){onNotice("Transport charge must match the saved fixed rate in Transport Directory. Update the route there if required.");return;}
  if(!Number.isInteger(tripCount)||tripCount<1){onNotice("Enter a whole-number trip count of at least 1.");return;}
  if(draft.pickup&&draft.delivery&&draft.delivery<draft.pickup){onNotice("Delivery date cannot be before pickup date.");return;}
  if(draft.placement!=="start"&&!draft.anchorOperationId){onNotice("Select the process operation before or after which this transport leg belongs.");return;}
  if(draft.placement==="start"&&draft.anchorOperationId){onNotice("A component-start transport leg must not have a process anchor.");return;}
  if(draft.anchorOperationId&&!ops.some(op=>op.id===draft.anchorOperationId&&op.poId===po.id&&op.poLineId===line.id)){onNotice("The selected process anchor does not belong to this PO component line.");return;}
  const stamp=nowIso(),existing=transportLegs.filter(leg=>leg.poId===po.id&&leg.poLineId===line.id);
  const record:ComponentTransportLegRecord={id:makeId("transport-leg"),poId:po.id,poLineId:line.id,componentId:component.id,sequence:Math.max(0,...existing.map(x=>x.sequence))+10,routeId:route.id,vendorId:route.vendorId,fromLocation:route.fromLocation,toLocation:route.toLocation,tripDirection:route.tripDirection,vehicleType:route.vehicleType,fixedAmount:route.fixedAmount,tripCount,anchorOperationId:draft.placement==="start"?"":draft.anchorOperationId,placement:draft.placement,pickupAt:draft.pickup,deliveryAt:draft.delivery,status:"Queued",completedTrips:0,notes:draft.notes,createdAt:stamp,updatedAt:stamp};
  update(current=>({...current,transportLegs:[...(current.transportLegs||[]),record]}));
  setTransportLine(null);setDraft(transportDraft());
  onNotice("Transport leg saved from the independent Transport Directory master. It is linked to the PO component and optional process anchor; process operations and process-cost totals were not changed.");
 };
 return <section className="workspace-page operations-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/>{syncStatus==="synced"?"SHARED DATA SYNCED":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":"PO-LINKED PRODUCTION"}</span></div>
  {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / PRODUCTION CONTROL</div><h1>Production Plan<span>.</span></h1><p>PO-wise and component-wise job control. Transport and job completion are saved against the same PO component line used by Process Plan.</p></div><button className="button-primary" onClick={()=>onSelectModule("process-map")}><Workflow size={15}/> Open Process Plan</button></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, PO, component, number, quantity, due date or status…"/></label><span className="module-number">{filtered.length} PO COMPONENT JOBS</span><button className="button-quiet compact-button" onClick={clearFilters}>Clear filters</button></div>
  <section className="surface-panel production-plan-filter-panel"><div className="panel-heading"><div><h3>Multi-select filters</h3><p>Each column has searchable multi-select, All and Clear controls. Empty selections include all jobs.</p></div><button className="button-quiet compact-button" onClick={clearFilters}>Clear all filters</button></div>
   <div className="contact360-filter-grid ax-search-filter-columns">
 <SearchableMultiSelect id="production-company-filter" label="Company" options={companies.map(x=>({id:x.id,label:x.name}))} selected={companyFilters} onChange={setCompanyFilters} emptyMeansAll/>
 <SearchableMultiSelect id="production-po-filter" label="Purchase order" options={pos.map(x=>({id:x.id,label:x.number+" · "+(companies.find(c=>c.id===x.companyId)?.name||"Company")}))} selected={poFilters} onChange={setPoFilters} emptyMeansAll/>
 <SearchableMultiSelect id="production-component-filter" label="Component" options={components.map(x=>({id:x.id,label:x.partNumber+" · "+x.name}))} selected={componentFilters} onChange={setComponentFilters} emptyMeansAll/>
 <SearchableMultiSelect id="production-status-filter" label="Job status" options={["In Progress","Finished"].map(x=>({id:x,label:x}))} selected={jobStatusFilters} onChange={setJobStatusFilters} emptyMeansAll/>
</div>
  </section>
  <div className="process-table-bulkbar production-plan-bulkbar"><label><input type="checkbox" checked={filtered.length>0&&filtered.every(row=>selectedJobKeys.includes(row.po.id+":"+row.line.id))} onChange={e=>selectVisibleJobs(e.target.checked)}/> Select all visible jobs</label><span>{selectedVisibleJobs.length} selected</span><button className="button-primary compact-button" disabled={!selectedVisibleJobs.length} onClick={()=>finishSelectedJobs(true)}>Finish selected jobs</button><button className="button-quiet compact-button" disabled={!selectedVisibleJobs.length} onClick={()=>finishSelectedJobs(false)}>Reopen selected jobs</button><button className="button-quiet compact-button" disabled={!selectedJobKeys.length} onClick={()=>setSelectedJobKeys([])}>Clear selection</button></div>
  {transportLine&&<section className="surface-panel"><div className="panel-heading"><div><h3>Add transport to PO component</h3><p>This creates a transport leg from the Transport Directory master, linked to the PO component line and optional process anchor.</p></div></div>
   <div className="module-record-form specialized-form">
    <SearchablePicker id="production-transport-vendor" label="Transport vendor *" value={draft.vendorId} placeholder="Type vendor or contact…" options={vendors.filter(v=>transportRoutes.some(route=>route.vendorId===v.id&&route.active!==false)).map(v=>({id:v.id,label:v.company+" · "+v.contact}))} onChange={value=>setDraft({...draft,vendorId:value,routeId:"",from:"",to:"",vehicleType:"",cost:"0"})}/>
    <SearchablePicker id="production-transport-route" label="Saved route *" value={draft.routeId} placeholder="Search route, vehicle or direction…" options={transportRoutes.filter(route=>route.vendorId===draft.vendorId).map(route=>({id:route.id,label:route.fromLocation+" → "+route.toLocation+" · "+route.vehicleType+" · "+route.tripDirection+" · ₹"+route.fixedAmount.toLocaleString("en-IN")}))} onChange={value=>{const route=transportRoutes.find(row=>row.id===value);setDraft({...draft,routeId:value,from:route?.fromLocation||"",to:route?.toLocation||"",vehicleType:route?.vehicleType||"",tripDirection:route?.tripDirection||"One-way",cost:String(route?.fixedAmount||0)});}}/>
    <label>From location<input readOnly value={draft.from}/></label><label>To location<input readOnly value={draft.to}/></label><label>Vehicle type<input readOnly value={draft.vehicleType}/></label>
    <label>Trip direction<input readOnly value={draft.tripDirection}/></label><label>Trip count<input type="number" min="1" step="1" value={draft.tripCount} onChange={e=>setDraft({...draft,tripCount:e.target.value})}/></label>
    <SearchablePicker id="production-transport-placement" label="Transport position *" value={draft.placement} options={[{id:"start",label:"At component start"},{id:"before",label:"Before selected process"},{id:"after",label:"After selected process"}]} onChange={value=>setDraft({...draft,placement:value as "start"|"before"|"after",anchorOperationId:value==="start"?"":draft.anchorOperationId})}/>
    <SearchablePicker id="production-transport-anchor" label="Connect to process *" value={draft.anchorOperationId} disabled={draft.placement==="start"} placeholder="Search process operation…" options={ops.filter(op=>op.poId===transportLine?.poId&&op.poLineId===transportLine?.lineId).sort((a,b)=>a.sequence-b.sequence).map(op=>({id:op.id,label:"OP-"+String(op.sequence).padStart(3,"0")+" · "+op.name+" · "+op.status}))} onChange={value=>setDraft({...draft,anchorOperationId:value})}/>
    <label>Transport fixed rate (₹)<input readOnly value={draft.cost}/></label>
    <label>Pickup date &amp; time<input type="datetime-local" value={draft.pickup} onChange={e=>setDraft({...draft,pickup:e.target.value})}/></label>
    <label>Delivery date &amp; time<input type="datetime-local" min={draft.pickup||undefined} value={draft.delivery} onChange={e=>setDraft({...draft,delivery:e.target.value})}/></label>
    <label className="module-form-wide">Transport notes<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Pickup location, consignment reference, handover notes…"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={saveTransport}><Truck size={14}/> Save transport</button><button className="button-quiet" onClick={()=>setTransportLine(null)}>Cancel</button></div>
   </div>
  </section>}
  <section className="surface-panel"><div className="panel-heading"><div><h3>Production jobs</h3><p>{rows.filter(x=>x.line.jobStatus!=="Finished").length} in progress · {rows.filter(x=>x.line.jobStatus==="Finished").length} finished</p></div></div>
   {filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Select</th><th>Company</th><th>PO</th><th>Component</th><th>Quantity</th><th>Due date</th><th>Processes</th><th>Transport</th><th>Job status</th><th>Actions</th></tr></thead><tbody>{filtered.map(({po,line,company,component,operations,transportLegs:jobTransportLegs})=>{
    const finished=line.jobStatus==="Finished";const transport=[...operations.filter(op=>op.transportVendorId||op.category==="Logistics"),...jobTransportLegs];
    return <tr key={po.id+":"+line.id}><td><input type="checkbox" aria-label={"Select "+po.number+" "+(component?.partNumber||"component")} checked={selectedJobKeys.includes(po.id+":"+line.id)} onChange={()=>toggleSet(setSelectedJobKeys,po.id+":"+line.id)}/></td><td>{company?.name||"Company missing"}</td><td><strong>{po.number}</strong><small>{po.issueDate||"PO date not entered"}</small></td><td><span className="component-record-identity"><ComponentIcon componentId={component?.id} componentName={(component?.name||"Component")+" "+(component?.partNumber||"")}/><span><strong>{component?.partNumber||"Part missing"}</strong><small>{component?.name||"Component record missing"}</small></span></span></td><td>{line.quantity.toLocaleString("en-IN")} {component?.salePriceUnit==="set"?"sets":"pieces"}</td><td>{line.targetDelivery||po.targetDelivery||"—"}</td><td>{operations.filter(op=>op.category!=="Logistics").length}</td><td>{transport.length} entries</td><td><span className={"record-state "+(finished?"state-selected":"state-open")}>{finished?"Job Finished":"In Progress"}</span></td><td><div className="production-job-actions"><button className="button-quiet compact-button" onClick={()=>openTransport(po.id,line.id)}><Truck size={12}/> Add transport</button><button className={finished?"button-quiet compact-button":"button-primary compact-button"} onClick={()=>setJob(po.id,line.id,!finished)}>{finished?<RotateCcw size={12}/>:<Check size={12}/>} {finished?"Reopen":"Finish"}</button><button className="button-quiet compact-button" onClick={()=>{const targetOperation=operations.find(op=>op.id===initialContext?.operationId&&op.poId===po.id&&op.poLineId===line.id)||operations[0];onSelectModule("process-map",{companyId:po.companyId,poId:po.id,poLineId:line.id,componentId:line.componentId,operationId:targetOperation?.id,vendorId:targetOperation?.vendorId});}}><Workflow size={12}/> Process Plan</button></div></td></tr>;
   })}</tbody></table></div>:<div className="module-empty-state"><Package size={25}/><h3>{search?"No matching jobs":"No PO component jobs yet"}</h3><p>Create a Company, Component and Purchase Order first. Production jobs are generated from saved PO component lines.</p><button className="button-primary" onClick={()=>onSelectModule("purchasing")}><Plus size={14}/> Open Purchase Orders</button></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Transport is stored as a dedicated transport leg linked to the PO component and optional process anchor. It is kept separate from process operations and process costing.</span></div>
 </section>;
}

export function TransportDispatchWorkspace({onBack,onNotice,notice,onSelectModule}:Props){
 const {data,update}=useManufacturingData();
 const vendors=activeRows(data.vendors),pos=activeRows(data.purchaseOrders),components=activeRows(data.components);
 const legs=activeRows(data.transportLegs||[]);
 const legacyOps=activeRows(data.operations).filter(op=>op.transportVendorId||op.category==="Logistics");
 const [search,setSearch]=useState("");
 const rows=[
  ...legs.map(leg=>({id:leg.id,kind:"transport-leg" as const,poId:leg.poId,poLineId:leg.poLineId,componentId:leg.componentId,vendorId:leg.vendorId,from:leg.fromLocation,to:leg.toLocation,vehicle:leg.vehicleType,direction:leg.tripDirection,trips:leg.tripCount,pickup:leg.pickupAt||"",delivery:leg.deliveryAt||"",cost:leg.fixedAmount*leg.tripCount,status:leg.status||"Queued" as LifecycleStatus,sequence:leg.sequence})),
  ...legacyOps.map(op=>({id:op.id,kind:"legacy-operation" as const,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,vendorId:op.transportVendorId,from:op.transportFrom,to:op.transportTo,vehicle:op.transportVehicleType,direction:"—",trips:1,pickup:op.transportPickup,delivery:op.transportDelivery,cost:op.transportCost,status:op.status,sequence:op.sequence}))
 ];
 const filtered=rows.filter(row=>{const vendor=vendors.find(v=>v.id===row.vendorId);const po=pos.find(x=>x.id===row.poId);const component=components.find(x=>x.id===row.componentId);return (vendor?.company+" "+vendor?.contact+" "+po?.number+" "+component?.partNumber+" "+component?.name+" "+row.from+" "+row.to+" "+row.vehicle+" "+row.direction+" "+row.status).toLowerCase().includes(search.toLowerCase().trim());});
 const updateStatus=(row:{id:string;kind:"transport-leg"|"legacy-operation"},status:LifecycleStatus)=>{
  const stamp=nowIso();
  if(row.kind==="transport-leg"){update(current=>({...current,transportLegs:(current.transportLegs||[]).map(leg=>leg.id===row.id?{...leg,status,completedTrips:status==="Complete"?leg.tripCount:Math.min(leg.completedTrips||0,leg.tripCount),updatedAt:stamp}:leg)}));onNotice("Transport-leg status updated in the Transport Directory-linked dispatch record.");}
  else{update(current=>({...current,operations:current.operations.map(op=>op.id===row.id?{...op,status,actualEnd:status==="Complete"?(op.actualEnd||stamp.slice(0,10)):op.actualEnd,updatedAt:stamp}:op)}));onNotice("Legacy transport-operation status updated; existing process history was retained.");}
 };
 return <section className="workspace-page operations-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> LINKED DISPATCH RECORDS</span></div>
  {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> LOGISTICS / DISPATCH CONTROL</div><h1>Transport &amp; Dispatch<span>.</span></h1><p>Actual transport legs are read from Transport Directory and linked to their purchase-order component and optional Process Plan anchor.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("transport-master")}><Truck size={14}/> Transport Directory</button><button className="button-primary" onClick={()=>onSelectModule("production")}><Package size={15}/> Add PO transport leg</button></div></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor, PO, component, route, vehicle or status…"/></label><span className="module-number">{filtered.length} TRANSPORT LEGS / RECORDS</span><button className="button-quiet compact-button" onClick={()=>setSearch("")}>Clear filters</button></div>
  <section className="surface-panel">{filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO / component</th><th>Transport vendor</th><th>Route / direction</th><th>Vehicle</th><th>Trips</th><th>Pickup</th><th>Delivery</th><th>Total transport</th><th>Status</th><th>Interlinks</th></tr></thead><tbody>{filtered.map(row=><tr key={row.kind+":"+row.id}><td><strong>{pos.find(po=>po.id===row.poId)?.number||"PO missing"}</strong><small className="component-record-identity component-record-identity-compact"><ComponentIcon componentId={row.componentId} componentName={(components.find(c=>c.id===row.componentId)?.name||"Component")+" "+(components.find(c=>c.id===row.componentId)?.partNumber||"")}/><span>{components.find(c=>c.id===row.componentId)?.partNumber||"Component missing"} · {components.find(c=>c.id===row.componentId)?.name||""}</span></small></td><td>{vendors.find(v=>v.id===row.vendorId)?.company||"Vendor not assigned"}</td><td>{row.from&&row.to?row.from+" → "+row.to:"Route not recorded"}<small>{row.direction} · {row.kind==="transport-leg"?"Transport Directory rate":"Legacy transport record"}</small></td><td>{row.vehicle||"—"}</td><td>{row.trips}</td><td>{row.pickup||"—"}</td><td>{row.delivery||"—"}</td><td>{money(row.cost)}</td><td><select value={row.status} onChange={e=>updateStatus(row,e.target.value as LifecycleStatus)}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option><option>Delayed</option></select></td><td><div className="vendor-network-actions"><button className="button-quiet compact-button" onClick={()=>onSelectModule("vendors",{vendorId:row.vendorId})}>Vendor</button><button className="button-quiet compact-button" onClick={()=>onSelectModule("process-map",{companyId:pos.find(po=>po.id===row.poId)?.companyId,poId:row.poId,poLineId:row.poLineId,componentId:row.componentId,operationId:row.kind==="legacy-operation"?row.id:undefined,vendorId:row.vendorId})}>Process Plan</button></div></td></tr>)}</tbody></table></div>:<div className="module-empty-state"><Truck size={24}/><h3>No transport records</h3><p>Add a route rate in Transport Directory, then attach a transport leg to a PO component in Production Plan or Process Plan.</p><div className="relationship-actions"><button className="button-primary" onClick={()=>onSelectModule("transport-master")}>Open Transport Directory</button><button className="button-quiet" onClick={()=>onSelectModule("production")}>Open Production Plan</button></div></div>}</section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Transport legs remain separate from process-operation rows and are included in transport cost only. Legacy logistics-operation records stay visible for history.</span></div>
 </section>;
}

export function QualityInspectionWorkspace({onBack,onNotice,notice,initialContext}:Props){
 const {data,update}=useManufacturingData();const ops=activeRows(data.operations);const vendors=activeRows(data.vendors),components=activeRows(data.components),pos=activeRows(data.purchaseOrders);
 const measurements=activeRows(data.inspectionMeasurements||[]);
 const [search,setSearch]=useState("");
 const [measurementOperationId,setMeasurementOperationId]=useState(initialContext?.operationId||"");
 useEffect(()=>{setMeasurementOperationId(initialContext?.operationId||"");setSearch("");},[initialContext?.companyId,initialContext?.poId,initialContext?.poLineId,initialContext?.componentId,initialContext?.operationId,initialContext?.vendorId]);
 const contextOps=ops.filter(op=>(!initialContext?.companyId||pos.find(po=>po.id===op.poId)?.companyId===initialContext.companyId)&&(!initialContext?.poId||op.poId===initialContext.poId)&&(!initialContext?.poLineId||op.poLineId===initialContext.poLineId)&&(!initialContext?.componentId||op.componentId===initialContext.componentId)&&(!initialContext?.operationId||op.id===initialContext.operationId)&&(!initialContext?.vendorId||op.vendorId===initialContext.vendorId));
 const [characteristic,setCharacteristic]=useState("");
 const [nominalValue,setNominalValue]=useState("");
 const [lowerLimit,setLowerLimit]=useState("");
 const [upperLimit,setUpperLimit]=useState("");
 const [measuredValue,setMeasuredValue]=useState("");
 const [unit,setUnit]=useState("mm");
 const [measurementNotes,setMeasurementNotes]=useState("");
 const filtered=contextOps.filter(op=>{
  const historyText=measurements.filter(item=>item.operationId===op.id).map(item=>[item.characteristic,item.result,item.notes].join(" ")).join(" ");
  return (op.name+" "+op.category+" "+op.status+" "+op.inspectionResult+" "+op.qualityNotes+" "+historyText+" "+(components.find(c=>c.id===op.componentId)?.partNumber||"")+" "+(pos.find(po=>po.id===op.poId)?.number||"")).toLowerCase().includes(search.toLowerCase().trim());
 });
 const selectedMeasurementOperation=filtered.find(op=>op.id===measurementOperationId)||filtered[0];
 const patch=(id:string,key:"completed"|"accepted"|"rejected"|"inspectionResult"|"qualityNotes"|"status",value:string|number)=>{
  const currentOperation=ops.find(op=>op.id===id);
  if(!currentOperation){onNotice("The selected process operation is no longer available.");return;}
  if(key==="completed"||key==="accepted"||key==="rejected"){
   const quantity=Number(value);
   if(!Number.isSafeInteger(quantity)||quantity<0){onNotice("Completed, accepted and rejected quantities must be non-negative whole numbers.");return;}
   const nextCompleted=key==="completed"?quantity:currentOperation.completed;
   const nextAccepted=key==="accepted"?quantity:currentOperation.accepted;
   const nextRejected=key==="rejected"?quantity:currentOperation.rejected;
   if(nextCompleted>currentOperation.quantity){onNotice("Completed quantity cannot exceed the operation quantity.");return;}
   if(nextAccepted+nextRejected>nextCompleted){onNotice("Accepted plus rejected quantity cannot exceed completed quantity.");return;}
  }
  update(current=>({...current,operations:current.operations.map(op=>op.id===id?{...op,[key]:value,updatedAt:nowIso()}:op)}));
  onNotice("Inspection values saved to the linked process operation.");
 };
 const saveMeasurement=()=>{
  const operation=selectedMeasurementOperation;
  if(!operation){onNotice("Select a saved PO-linked operation before recording a measurement.");return;}
  const value=Number(measuredValue);
  const nominal=nominalValue.trim()===""?null:Number(nominalValue);
  const lower=lowerLimit.trim()===""?null:Number(lowerLimit);
  const upper=upperLimit.trim()===""?null:Number(upperLimit);
  if(!characteristic.trim()||measuredValue.trim()===""||!Number.isFinite(value)){onNotice("Enter a characteristic and a valid measured value.");return;}
  if((nominalValue.trim()!==""&&!Number.isFinite(nominal))||(lowerLimit.trim()!==""&&!Number.isFinite(lower))||(upperLimit.trim()!==""&&!Number.isFinite(upper))){onNotice("Nominal value and tolerance limits must be valid numbers.");return;}
  if(lower!==null&&upper!==null&&lower>upper){onNotice("Lower tolerance cannot exceed upper tolerance.");return;}
  const result:InspectionMeasurementRecord["result"]=lower===null&&upper===null?"Not assessed":((lower===null||value>=lower)&&(upper===null||value<=upper)?"Pass":"Fail");
  const stamp=nowIso();
  const row:InspectionMeasurementRecord={id:makeId("inspection"),operationId:operation.id,poId:operation.poId,poLineId:operation.poLineId,componentId:operation.componentId,characteristic:characteristic.trim(),nominalValue:nominal,lowerLimit:lower,upperLimit:upper,measuredValue:value,unit:unit.trim(),result,notes:measurementNotes.trim(),inspectedAt:stamp,createdAt:stamp,updatedAt:stamp};
  update(current=>({...current,inspectionMeasurements:[...current.inspectionMeasurements,row]}));
  setCharacteristic("");setNominalValue("");setLowerLimit("");setUpperLimit("");setMeasuredValue("");setMeasurementNotes("");
  onNotice("Measurement saved as an immutable inspection-history record linked to the original PO component and process operation. Result: "+result+".");
 };
 return <section className="workspace-page operations-workspace"><div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> OPERATION-LINKED INSPECTION</span></div>{notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUALITY / INSPECTION REGISTER</div><h1>Quality Inspection<span>.</span></h1><p>Inspection measurements, tolerance results, accepted/rejected quantities and inspection history stay linked to the same PO component and process operation.</p></div>{selectedMeasurementOperation&&<button className="button-quiet" onClick={()=>onSelectModule("process-map",{companyId:pos.find(po=>po.id===selectedMeasurementOperation.poId)?.companyId,poId:selectedMeasurementOperation.poId,poLineId:selectedMeasurementOperation.poLineId,componentId:selectedMeasurementOperation.componentId,operationId:selectedMeasurementOperation.id,vendorId:selectedMeasurementOperation.vendorId})}><Workflow size={14}/> Open exact Process Plan operation</button>}</div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO, component, operation or measurement…"/></label><span className="module-number">{filtered.length} OPERATIONS · {measurements.length} MEASUREMENTS</span></div>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Record an inspection measurement</h3><p>Each saved reading is retained as a dated history entry; tolerance checks are evaluated against the entered limits.</p></div></div>
   {ops.length?<div className="module-record-form specialized-form">
    <label className="module-form-wide">PO component / operation<select value={selectedMeasurementOperation?.id||""} onChange={e=>setMeasurementOperationId(e.target.value)}><option value="">Select operation</option>{contextOps.map(op=><option key={op.id} value={op.id}>{pos.find(po=>po.id===op.poId)?.number||"PO"} · {components.find(c=>c.id===op.componentId)?.partNumber||"Component"} · {op.name}</option>)}</select></label>
    <label>Characteristic *<input value={characteristic} onChange={e=>setCharacteristic(e.target.value)} placeholder="Bore diameter, flatness, length…"/></label>
    <label>Unit<input value={unit} onChange={e=>setUnit(e.target.value)} placeholder="mm, µm, kg…"/></label>
    <label>Nominal value<input type="number" step="any" value={nominalValue} onChange={e=>setNominalValue(e.target.value)} placeholder="Optional"/></label>
    <label>Lower limit<input type="number" step="any" value={lowerLimit} onChange={e=>setLowerLimit(e.target.value)} placeholder="Optional"/></label>
    <label>Upper limit<input type="number" step="any" value={upperLimit} onChange={e=>setUpperLimit(e.target.value)} placeholder="Optional"/></label>
    <label>Measured value *<input type="number" step="any" value={measuredValue} onChange={e=>setMeasuredValue(e.target.value)} placeholder="Actual reading"/></label>
    <label className="module-form-wide">Inspection notes<input value={measurementNotes} onChange={e=>setMeasurementNotes(e.target.value)} placeholder="Gauge, instrument ID, sampling point or NCR reference…"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={saveMeasurement}><Plus size={14}/> Save measurement</button></div>
   </div>:<div className="module-empty-state"><ClipboardCheck size={24}/><h3>No process operations to inspect</h3><p>Add process operations in Process Plan; measurement capture will then be linked to the PO component.</p></div>}
  </section>
  <section className="surface-panel">{filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO / component</th><th>Operation / requirement</th><th>Completed</th><th>Accepted</th><th>Rejected</th><th>Inspection result</th><th>Measurement history</th><th>Status</th></tr></thead><tbody>{filtered.map(op=>{
   const history=measurements.filter(item=>item.operationId===op.id).sort((a,b)=>(b.inspectedAt||"").localeCompare(a.inspectedAt||""));
   return <tr key={op.id}><td><strong>{pos.find(po=>po.id===op.poId)?.number||"PO missing"}</strong><small className="component-record-identity component-record-identity-compact"><ComponentIcon componentId={op.componentId} componentName={(components.find(c=>c.id===op.componentId)?.name||"Component")+" "+(components.find(c=>c.id===op.componentId)?.partNumber||"")}/><span>{components.find(c=>c.id===op.componentId)?.partNumber||"Component missing"}</span></small></td><td><strong>{op.name}</strong><small>{vendors.find(v=>v.id===op.vendorId)?.company||"Vendor not assigned"}</small><small>{op.qualityNotes||"No inspection requirement"}</small></td><td><input type="number" min="0" max={op.quantity} value={op.completed} onChange={e=>patch(op.id,"completed",Math.max(0,Number(e.target.value)||0))}/></td><td><input type="number" min="0" max={op.completed} value={op.accepted} onChange={e=>patch(op.id,"accepted",Math.max(0,Number(e.target.value)||0))}/></td><td><input type="number" min="0" max={op.completed} value={op.rejected} onChange={e=>patch(op.id,"rejected",Math.max(0,Number(e.target.value)||0))}/></td><td><input value={op.inspectionResult} onChange={e=>patch(op.id,"inspectionResult",e.target.value)} placeholder="Measured result / NCR ref"/></td><td><div className="inspection-history-cell">{history.length?history.map(item=><small key={item.id}><strong>{item.characteristic}:</strong> {item.measuredValue} {item.unit} · {item.result}{item.lowerLimit!==null||item.upperLimit!==null?" · "+(item.lowerLimit??"−∞")+" to "+(item.upperLimit??"+∞"):""} · {new Date(item.inspectedAt).toLocaleString("en-IN")}{item.notes?" · "+item.notes:""}</small>):<small>No measurement history</small>}</div></td><td><select value={op.status} onChange={e=>patch(op.id,"status",e.target.value)}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></td></tr>;
  })}</tbody></table></div>:<div className="module-empty-state"><ClipboardCheck size={24}/><h3>{search?"No inspection rows match":"No process operations to inspect"}</h3><p>Add process operations in Process Plan; inspection records will appear here linked to the PO component.</p></div>}</section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Measurement readings are append-only inspection history. Existing operation measurements and quantity/status fields remain attached to the same PO component. A quality hold is not automatically cleared by a passing reading.</span></div>
 </section>;
}
