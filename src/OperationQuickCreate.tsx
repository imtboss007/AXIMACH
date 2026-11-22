import { useState } from "react";
import { Plus, Save, X } from "lucide-react";
import { makeId, nowIso, type OperationRecord } from "./manufacturingData";

type Props={
  poId:string;poLineId:string;componentId:string;sequence:number;branch:string;
  vendors:Array<{id:string;company:string}>;
  onSave:(operation:OperationRecord)=>void;onCancel:()=>void;
};
const asIso=(value:string)=>value?new Date(value).toISOString():"";
export default function OperationQuickCreate({poId,poLineId,componentId,sequence,branch,vendors,onSave,onCancel}:Props){
 const [name,setName]=useState("");const [category,setCategory]=useState("Machining");const [subcategory,setSubcategory]=useState("");
 const [machine,setMachine]=useState("");const [vendorId,setVendorId]=useState("");const [quantity,setQuantity]=useState("1");
 const [rate,setRate]=useState("0");const [start,setStart]=useState("");const [end,setEnd]=useState("");const [notes,setNotes]=useState("");
 const save=()=>{
  if(!poId||!poLineId||!componentId){return;}
  if(!name.trim()||!category.trim())return;
  const stamp=nowIso();
  const operation:OperationRecord={
   id:makeId("operation"),poId,poLineId,componentId,sequence,name:name.trim(),category:category.trim(),machine:machine.trim(),vendorId,
   status:"Planned",plannedStart:asIso(start),plannedEnd:asIso(end),actualStart:"",actualEnd:"",
   quantity:Math.max(1,Number(quantity)||1),completed:0,accepted:0,rejected:0,ratePerPart:Math.max(0,Number(rate)||0),actualRatePerPart:0,
   transportVendorId:"",transportPickup:"",transportDelivery:"",transportCost:0,qualityNotes:"",inspectionResult:"",notes,
   subcategory:subcategory.trim(),branch,parentId:"",createdAt:stamp,updatedAt:stamp
  };
  onSave(operation);
 };
 return <section className="ax-operation-inline-editor ax-operation-quick-create" aria-label="Add process stage inside workspace">
  <div className="ax-inline-editor-head"><div><small>ADD PROCESS STAGE · CURRENT PO COMPONENT LINE</small><strong>New manufacturing operation</strong></div><button type="button" className="button-quiet compact-button" onClick={onCancel}><X size={14}/> Close</button></div>
  <div className="ax-inline-editor-grid">
   <label>Operation / process<input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. CNC finish turning"/></label>
   <label>Process category<input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Machining, Grinding, Heat treatment…"/></label>
   <label>Sub-process<input value={subcategory} onChange={e=>setSubcategory(e.target.value)} placeholder="Optional process detail"/></label>
   <label>Machine / station<input value={machine} onChange={e=>setMachine(e.target.value)} placeholder="Machine or work centre"/></label>
   <label>Vendor<select value={vendorId} onChange={e=>setVendorId(e.target.value)}><option value="">Not assigned</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company}</option>)}</select></label>
   <label>Quantity<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
   <label>Rate per part (₹)<input type="number" min="0" step="0.01" value={rate} onChange={e=>setRate(e.target.value)}/></label>
   <label>Planned start<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label>
   <label>Planned delivery / due<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
   <label className="ax-inline-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Operation, quality or handling notes"/></label>
  </div>
  <div className="ax-inline-editor-actions"><small>New step will be saved to this PO line and immediately appear in the shared route / universe view.</small><button type="button" className="button-primary" disabled={!poId||!poLineId||!componentId||!name.trim()} onClick={save}><Plus size={15}/> Add process stage</button></div>
 </section>;
}
