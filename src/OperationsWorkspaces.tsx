import { useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarClock, Check, ClipboardCheck, FileDown, Package, Plus, RotateCcw, Search, ShieldCheck, Truck, Workflow, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type LifecycleStatus, type OperationRecord, type InspectionMeasurementRecord } from "./manufacturingData";

type Props={onBack:()=>void;onNotice:(value:string)=>void;notice:string;onSelectModule:(id:string)=>void};
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const transportDraft=()=>({vendorId:"",routeId:"",from:"",to:"",vehicleType:"",pickup:"",delivery:"",cost:"0",notes:""});

export function ProductionPlanWorkspace({onBack,onNotice,notice,onSelectModule}:Props){
 const {data,update,syncStatus}=useManufacturingData();
 const companies=activeRows(data.companies),pos=activeRows(data.purchaseOrders),components=activeRows(data.components),vendors=activeRows(data.vendors),ops=activeRows(data.operations);
 const [search,setSearch]=useState("");const [transportLine,setTransportLine]=useState<{poId:string;lineId:string}|null>(null);const [draft,setDraft]=useState(transportDraft());
 const [companyFilters,setCompanyFilters]=useState<string[]>([]);
 const [poFilters,setPoFilters]=useState<string[]>([]);
 const [componentFilters,setComponentFilters]=useState<string[]>([]);
 const [jobStatusFilters,setJobStatusFilters]=useState<string[]>([]);
 const [selectedJobKeys,setSelectedJobKeys]=useState<string[]>([]);
 const toggleSet=(setter:(next:string[]|((previous:string[])=>string[]))=>void,value:string)=>setter(previous=>previous.includes(value)?previous.filter(item=>item!==value):[...previous,value]);
 const clearFilters=()=>{setSearch("");setCompanyFilters([]);setPoFilters([]);setComponentFilters([]);setJobStatusFilters([]);};

 const rows=useMemo(()=>pos.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line,company:companies.find(c=>c.id===po.companyId),component:components.find(c=>c.id===line.componentId),operations:ops.filter(op=>op.poId===po.id&&op.poLineId===line.id)}))),[pos,companies,components,ops]);
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
    const selectedIds=new Set(selectedVisibleJobs.map(row=>row.line.id));
    const incomplete=ops.filter(op=>selectedIds.has(op.poLineId)&&op.status!=="Complete");
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
  if(!transportLine)return;const po=pos.find(x=>x.id===transportLine.poId);const line=po?.lines.find(x=>x.id===transportLine.lineId);if(!po||!line)return;
  const component=components.find(x=>x.id===line.componentId);if(!component){onNotice("The selected PO line has no matching Component Directory record.");return;}
  const vendor=vendors.find(x=>x.id===draft.vendorId);if(!vendor){onNotice("Select a transport vendor.");return;}
  const cost=Number(draft.cost);if(!Number.isFinite(cost)||cost<0){onNotice("Enter a valid transport cost.");return;}
  if(draft.pickup&&draft.delivery&&draft.delivery<draft.pickup){onNotice("Delivery date cannot be before pickup date.");return;}
  const stamp=nowIso();const existing=ops.filter(x=>x.poId===po.id&&x.poLineId===line.id);
  const record:OperationRecord={
   id:makeId("operation"),poId:po.id,poLineId:line.id,componentId:component.id,sequence:Math.max(0,...existing.map(x=>x.sequence))+10,
   name:"Transport / dispatch",category:"Logistics",machine:"",vendorId:"",status:"Queued" as LifecycleStatus,
   plannedStart:draft.pickup,plannedEnd:draft.delivery,actualStart:"",actualEnd:"",
   quantity:line.quantity,completed:0,accepted:0,rejected:0,ratePerPart:0,actualRatePerPart:0,
   transportVendorId:vendor.id,transportRouteId:draft.routeId,transportFrom:draft.from,transportTo:draft.to,transportVehicleType:draft.vehicleType,transportPickup:draft.pickup,transportDelivery:draft.delivery,transportCost:cost,
   qualityNotes:"",inspectionResult:"",notes:draft.notes,branch:"Main route",parentId:"",
   paymentStatus:"Unpaid",paidAmount:0,paymentReference:"",subcategory:"Transport",
   createdAt:stamp,updatedAt:stamp
  };
  update(current=>({...current,operations:[...current.operations,record]}));
  setTransportLine(null);setDraft(transportDraft());onNotice("Transport entry saved against the selected PO component line. It is now visible in Process Plan and Transport & Dispatch.");
 };
 return <section className="workspace-page operations-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/>{syncStatus==="synced"?"SHARED DATA SYNCED":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":"PO-LINKED PRODUCTION"}</span></div>
  {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / PRODUCTION CONTROL</div><h1>Production Plan<span>.</span></h1><p>PO-wise and component-wise job control. Transport and job completion are saved against the same PO component line used by Process Plan.</p></div><button className="button-primary" onClick={()=>onSelectModule("process-map")}><Workflow size={15}/> Open Process Plan</button></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, PO, component, number, quantity, due date or status…"/></label><span className="module-number">{filtered.length} PO COMPONENT JOBS</span><button className="button-quiet compact-button" onClick={clearFilters}>Clear filters</button></div>
  <section className="surface-panel production-plan-filter-panel"><div className="panel-heading"><div><h3>Multi-select filters</h3><p>Combine company, multiple PO, component and job status filters.</p></div><button className="button-quiet compact-button" onClick={()=>{setCompanyFilters(companies.map(x=>x.id));setPoFilters(pos.map(x=>x.id));setComponentFilters(components.map(x=>x.id));setJobStatusFilters(["Finished","In Progress"]);}}>Select all</button></div>
   <div className="contact360-filter-grid">
    <div><strong>Company</strong>{companies.map(x=><label key={x.id}><input type="checkbox" checked={companyFilters.includes(x.id)} onChange={()=>toggleSet(setCompanyFilters,x.id)}/>{x.name}</label>)}</div>
    <div><strong>Purchase order</strong>{pos.map(x=><label key={x.id}><input type="checkbox" checked={poFilters.includes(x.id)} onChange={()=>toggleSet(setPoFilters,x.id)}/>{x.number}</label>)}</div>
    <div><strong>Component</strong>{components.map(x=><label key={x.id}><input type="checkbox" checked={componentFilters.includes(x.id)} onChange={()=>toggleSet(setComponentFilters,x.id)}/>{x.partNumber} · {x.name}</label>)}</div>
    <div><strong>Job status</strong>{["In Progress","Finished"].map(x=><label key={x}><input type="checkbox" checked={jobStatusFilters.includes(x)} onChange={()=>toggleSet(setJobStatusFilters,x)}/>{x}</label>)}</div>
   </div>
  </section>
  <div className="process-table-bulkbar production-plan-bulkbar"><label><input type="checkbox" checked={filtered.length>0&&filtered.every(row=>selectedJobKeys.includes(row.po.id+":"+row.line.id))} onChange={e=>selectVisibleJobs(e.target.checked)}/> Select all visible jobs</label><span>{selectedVisibleJobs.length} selected</span><button className="button-primary compact-button" disabled={!selectedVisibleJobs.length} onClick={()=>finishSelectedJobs(true)}>Finish selected jobs</button><button className="button-quiet compact-button" disabled={!selectedVisibleJobs.length} onClick={()=>finishSelectedJobs(false)}>Reopen selected jobs</button><button className="button-quiet compact-button" disabled={!selectedJobKeys.length} onClick={()=>setSelectedJobKeys([])}>Clear selection</button></div>
  {transportLine&&<section className="surface-panel"><div className="panel-heading"><div><h3>Add transport to PO component</h3><p>This creates a logistics operation linked to the selected PO component line.</p></div></div>
   <div className="module-record-form specialized-form">
    <label>Transport vendor *<select value={draft.vendorId} onChange={e=>setDraft({...draft,vendorId:e.target.value,routeId:"",from:"",to:"",vehicleType:"",cost:"0"})}><option value="">Select transport vendor</option>{vendors.filter(v=>v.vendorType==="Transport").map(v=><option key={v.id} value={v.id}>{v.company} · {v.contact}</option>)}</select></label>
    <label>Saved route<select value={draft.routeId} onChange={e=>{const route=vendors.find(v=>v.id===draft.vendorId)?.transportRoutes?.find(r=>r.id===e.target.value);setDraft({...draft,routeId:e.target.value,from:route?.fromLocation||"",to:route?.toLocation||"",vehicleType:route?.vehicleType||"",cost:String(route?.fixedCost||0)});}}><option value="">Select route</option>{(vendors.find(v=>v.id===draft.vendorId)?.transportRoutes||[]).map(route=><option key={route.id} value={route.id}>{route.fromLocation} → {route.toLocation} · ₹{route.fixedCost.toLocaleString("en-IN")}</option>)}</select></label>
    <label>From location<input readOnly value={draft.from}/></label><label>To location<input readOnly value={draft.to}/></label><label>Vehicle type<input readOnly value={draft.vehicleType}/></label>
    <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={draft.cost} onChange={e=>setDraft({...draft,cost:e.target.value})}/></label>
    <label>Pickup date &amp; time<input type="datetime-local" value={draft.pickup} onChange={e=>setDraft({...draft,pickup:e.target.value})}/></label>
    <label>Delivery date &amp; time<input type="datetime-local" min={draft.pickup||undefined} value={draft.delivery} onChange={e=>setDraft({...draft,delivery:e.target.value})}/></label>
    <label className="module-form-wide">Transport notes<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Pickup location, consignment reference, handover notes…"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={saveTransport}><Truck size={14}/> Save transport</button><button className="button-quiet" onClick={()=>setTransportLine(null)}>Cancel</button></div>
   </div>
  </section>}
  <section className="surface-panel"><div className="panel-heading"><div><h3>Production jobs</h3><p>{rows.filter(x=>x.line.jobStatus!=="Finished").length} in progress · {rows.filter(x=>x.line.jobStatus==="Finished").length} finished</p></div></div>
   {filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Select</th><th>Company</th><th>PO</th><th>Component</th><th>Quantity</th><th>Due date</th><th>Processes</th><th>Transport</th><th>Job status</th><th>Actions</th></tr></thead><tbody>{filtered.map(({po,line,company,component,operations})=>{
    const finished=line.jobStatus==="Finished";const transport=operations.filter(op=>op.transportVendorId||op.category==="Logistics");
    return <tr key={po.id+":"+line.id}><td><input type="checkbox" aria-label={"Select "+po.number+" "+(component?.partNumber||"component")} checked={selectedJobKeys.includes(po.id+":"+line.id)} onChange={()=>toggleSet(setSelectedJobKeys,po.id+":"+line.id)}/></td><td>{company?.name||"Company missing"}</td><td><strong>{po.number}</strong><small>{po.issueDate||"PO date not entered"}</small></td><td><strong>{component?.partNumber||"Part missing"}</strong><small>{component?.name||"Component record missing"}</small></td><td>{line.quantity.toLocaleString("en-IN")} {component?.salePriceUnit==="set"?"sets":"pieces"}</td><td>{line.targetDelivery||po.targetDelivery||"—"}</td><td>{operations.filter(op=>op.category!=="Logistics").length}</td><td>{transport.length} entries</td><td><span className={"record-state "+(finished?"state-selected":"state-open")}>{finished?"Job Finished":"In Progress"}</span></td><td><div className="production-job-actions"><button className="button-quiet compact-button" onClick={()=>openTransport(po.id,line.id)}><Truck size={12}/> Add transport</button><button className={finished?"button-quiet compact-button":"button-primary compact-button"} onClick={()=>setJob(po.id,line.id,!finished)}>{finished?<RotateCcw size={12}/>:<Check size={12}/>} {finished?"Reopen":"Finish"}</button><button className="button-quiet compact-button" onClick={()=>onSelectModule("process-map")}><Workflow size={12}/> Process Plan</button></div></td></tr>;
   })}</tbody></table></div>:<div className="module-empty-state"><Package size={25}/><h3>{search?"No matching jobs":"No PO component jobs yet"}</h3><p>Create a Company, Component and Purchase Order first. Production jobs are generated from saved PO component lines.</p><button className="button-primary" onClick={()=>onSelectModule("purchasing")}><Plus size={14}/> Open Purchase Orders</button></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Transport is saved as a process operation against the same PO component line. Finished/Reopen updates the PO line only and preserves process history. Shared cross-device behavior requires your configured shared AXIMACH data server.</span></div>
 </section>;
}

export function TransportDispatchWorkspace({onBack,onNotice,notice,onSelectModule}:Props){
 const {data,update}=useManufacturingData();const ops=activeRows(data.operations).filter(op=>op.transportVendorId||op.category==="Logistics");
 const vendors=activeRows(data.vendors),pos=activeRows(data.purchaseOrders),components=activeRows(data.components);
 const [search,setSearch]=useState("");
 const filtered=ops.filter(op=>(op.name+" "+op.category+" "+op.notes+" "+(vendors.find(v=>v.id===op.transportVendorId)?.company||"")+" "+(pos.find(po=>po.id===op.poId)?.number||"")+" "+(components.find(c=>c.id===op.componentId)?.partNumber||"")).toLowerCase().includes(search.toLowerCase().trim()));
 const updateStatus=(id:string,status:LifecycleStatus)=>{update(current=>({...current,operations:current.operations.map(op=>op.id===id?{...op,status,actualEnd:status==="Complete"?(op.actualEnd||nowIso().slice(0,10)):op.actualEnd,updatedAt:nowIso()}:op)}));onNotice("Transport status updated in the linked process operation.");};
 return <section className="workspace-page operations-workspace"><div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> LINKED DISPATCH RECORDS</span></div>{notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> LOGISTICS / DISPATCH CONTROL</div><h1>Transport &amp; Dispatch<span>.</span></h1><p>Transport operations entered from Production Plan and Process Plan remain linked to their PO component line.</p></div><button className="button-primary" onClick={()=>onSelectModule("production")}><Truck size={15}/> Add from Production Plan</button></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search transport vendor, PO or component…"/></label><span className="module-number">{filtered.length} TRANSPORT RECORDS</span></div>
  <section className="surface-panel">{filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO / component</th><th>Transport vendor</th><th>Route</th><th>Vehicle</th><th>Pickup</th><th>Delivery</th><th>Cost</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(op=><tr key={op.id}><td><strong>{pos.find(po=>po.id===op.poId)?.number||"PO missing"}</strong><small>{components.find(c=>c.id===op.componentId)?.partNumber||"Component missing"}</small></td><td>{vendors.find(v=>v.id===op.transportVendorId)?.company||"Vendor not assigned"}</td><td>{op.transportFrom&&op.transportTo?op.transportFrom+" → "+op.transportTo:"Route not recorded"}</td><td>{op.transportVehicleType||"—"}</td><td>{op.transportPickup||"—"}</td><td>{op.transportDelivery||"—"}</td><td>{money(op.transportCost)}</td><td><span className="record-state">{op.status}</span></td><td><select value={op.status} onChange={e=>updateStatus(op.id,e.target.value as LifecycleStatus)}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></td></tr>)}</tbody></table></div>:<div className="module-empty-state"><Truck size={24}/><h3>No transport records</h3><p>Add transport against a PO component in Production Plan or Process Plan.</p><button className="button-primary" onClick={()=>onSelectModule("production")}>Open Production Plan</button></div>}</section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Dispatch status is the same operation status shown in Process Plan. This screen does not duplicate or unlink transport records.</span></div>
 </section>;
}

export function QualityInspectionWorkspace({onBack,onNotice,notice}:Props){
 const {data,update}=useManufacturingData();const ops=activeRows(data.operations);const vendors=activeRows(data.vendors),components=activeRows(data.components),pos=activeRows(data.purchaseOrders);
 const measurements=activeRows(data.inspectionMeasurements||[]);
 const [search,setSearch]=useState("");
 const [measurementOperationId,setMeasurementOperationId]=useState("");
 const [characteristic,setCharacteristic]=useState("");
 const [nominalValue,setNominalValue]=useState("");
 const [lowerLimit,setLowerLimit]=useState("");
 const [upperLimit,setUpperLimit]=useState("");
 const [measuredValue,setMeasuredValue]=useState("");
 const [unit,setUnit]=useState("mm");
 const [measurementNotes,setMeasurementNotes]=useState("");
 const filtered=ops.filter(op=>{
  const historyText=measurements.filter(item=>item.operationId===op.id).map(item=>[item.characteristic,item.result,item.notes].join(" ")).join(" ");
  return (op.name+" "+op.category+" "+op.status+" "+op.inspectionResult+" "+op.qualityNotes+" "+historyText+" "+(components.find(c=>c.id===op.componentId)?.partNumber||"")+" "+(pos.find(po=>po.id===op.poId)?.number||"")).toLowerCase().includes(search.toLowerCase().trim());
 });
 const selectedMeasurementOperation=filtered.find(op=>op.id===measurementOperationId)||filtered[0];
 const patch=(id:string,key:"completed"|"accepted"|"rejected"|"inspectionResult"|"qualityNotes"|"status",value:string|number)=>{
  update(current=>({...current,operations:current.operations.map(op=>op.id===id?{...op,[key]:value,updatedAt:nowIso()}:op)}));
  onNotice("Inspection values saved to the linked process operation.");
 };
 const saveMeasurement=()=>{
  const operation=ops.find(op=>op.id===(measurementOperationId||selectedMeasurementOperation?.id));
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
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUALITY / INSPECTION REGISTER</div><h1>Quality Inspection<span>.</span></h1><p>Inspection measurements, tolerance results, accepted/rejected quantities and inspection history stay linked to the same PO component and process operation.</p></div></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search PO, component, operation or measurement…"/></label><span className="module-number">{filtered.length} OPERATIONS · {measurements.length} MEASUREMENTS</span></div>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Record an inspection measurement</h3><p>Each saved reading is retained as a dated history entry; tolerance checks are evaluated against the entered limits.</p></div></div>
   {ops.length?<div className="module-record-form specialized-form">
    <label className="module-form-wide">PO component / operation<select value={measurementOperationId||selectedMeasurementOperation?.id||""} onChange={e=>setMeasurementOperationId(e.target.value)}><option value="">Select operation</option>{ops.map(op=><option key={op.id} value={op.id}>{pos.find(po=>po.id===op.poId)?.number||"PO"} · {components.find(c=>c.id===op.componentId)?.partNumber||"Component"} · {op.name}</option>)}</select></label>
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
   return <tr key={op.id}><td><strong>{pos.find(po=>po.id===op.poId)?.number||"PO missing"}</strong><small>{components.find(c=>c.id===op.componentId)?.partNumber||"Component missing"}</small></td><td><strong>{op.name}</strong><small>{vendors.find(v=>v.id===op.vendorId)?.company||"Vendor not assigned"}</small><small>{op.qualityNotes||"No inspection requirement"}</small></td><td><input type="number" min="0" max={op.quantity} value={op.completed} onChange={e=>patch(op.id,"completed",Math.max(0,Number(e.target.value)||0))}/></td><td><input type="number" min="0" max={op.completed} value={op.accepted} onChange={e=>patch(op.id,"accepted",Math.max(0,Number(e.target.value)||0))}/></td><td><input type="number" min="0" max={op.completed} value={op.rejected} onChange={e=>patch(op.id,"rejected",Math.max(0,Number(e.target.value)||0))}/></td><td><input value={op.inspectionResult} onChange={e=>patch(op.id,"inspectionResult",e.target.value)} placeholder="Measured result / NCR ref"/></td><td><div className="inspection-history-cell">{history.length?history.map(item=><small key={item.id}><strong>{item.characteristic}:</strong> {item.measuredValue} {item.unit} · {item.result}{item.lowerLimit!==null||item.upperLimit!==null?" · "+(item.lowerLimit??"−∞")+" to "+(item.upperLimit??"+∞"):""} · {new Date(item.inspectedAt).toLocaleString("en-IN")}{item.notes?" · "+item.notes:""}</small>):<small>No measurement history</small>}</div></td><td><select value={op.status} onChange={e=>patch(op.id,"status",e.target.value)}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></td></tr>;
  })}</tbody></table></div>:<div className="module-empty-state"><ClipboardCheck size={24}/><h3>{search?"No inspection rows match":"No process operations to inspect"}</h3><p>Add process operations in Process Plan; inspection records will appear here linked to the PO component.</p></div>}</section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Measurement readings are append-only inspection history. Existing operation measurements and quantity/status fields remain attached to the same PO component. A quality hold is not automatically cleared by a passing reading.</span></div>
 </section>;
}
