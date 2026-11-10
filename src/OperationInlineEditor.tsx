import { useState } from "react";
import { Save, X } from "lucide-react";
import type { LifecycleStatus, OperationRecord } from "./manufacturingData";

type Props = {
  operation: OperationRecord;
  vendors: Array<{id:string;company:string}>;
  onSave: (patch: Partial<OperationRecord>) => void;
  onCancel: () => void;
};
const statuses:LifecycleStatus[]=["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"];
const localInput=(value:string)=>{if(!value)return "";const date=new Date(value);if(Number.isNaN(date.getTime()))return value.slice(0,16);return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const storedDate=(value:string)=>value?new Date(value).toISOString():"";

export default function OperationInlineEditor({operation,vendors,onSave,onCancel}:Props) {
  const [draft,setDraft]=useState<Record<string,string>>({
    name:operation.name,category:operation.category,subcategory:operation.subcategory||"",
    machine:operation.machine||"",vendorId:operation.vendorId||"",status:operation.status,
    quantity:String(operation.quantity),completed:String(operation.completed),accepted:String(operation.accepted),rejected:String(operation.rejected),
    ratePerPart:String(operation.ratePerPart),actualRatePerPart:String(operation.actualRatePerPart),
    plannedStart:localInput(operation.plannedStart),plannedEnd:localInput(operation.plannedEnd),
    actualStart:localInput(operation.actualStart),actualEnd:localInput(operation.actualEnd),
    paymentStatus:operation.paymentStatus||"Unpaid",paidAmount:String(operation.paidAmount||0),
    executionType:operation.executionType||"Outsourced",toleranceCategory:operation.toleranceCategory||"Standard",
    transportVendorId:operation.transportVendorId||"",transportFrom:operation.transportFrom||"",transportTo:operation.transportTo||"",
    transportVehicleType:operation.transportVehicleType||"",transportPickup:localInput(operation.transportPickup||""),
    transportDelivery:localInput(operation.transportDelivery||""),transportCost:String(operation.transportCost||0),
    inspectionResult:operation.inspectionResult||"",qualityNotes:operation.qualityNotes||"",branch:operation.branch||"Main route",notes:operation.notes||""
  });
  const set=(key:keyof typeof draft,value:string)=>setDraft(current=>({...current,[key]:value}));
  const numeric=(value:string)=>Math.max(0,Number(value)||0);
  const date=(value:string)=>value?storedDate(value):"";
  return <section className="ax-operation-inline-editor" aria-label={"Edit "+operation.name+" in this workspace"}>
    <div className="ax-inline-editor-head"><div><small>EDIT IN THIS WORKSPACE · OP-{String(operation.sequence).padStart(3,"0")}</small><strong>{operation.name}</strong></div><button type="button" className="button-quiet compact-button" onClick={onCancel}><X size={14}/> Close</button></div>
    <div className="ax-inline-editor-grid">
      <label>Operation / process<input value={draft.name} onChange={e=>set("name",e.target.value)}/></label>
      <label>Category<input value={draft.category} onChange={e=>set("category",e.target.value)}/></label>
      <label>Sub-process<input value={draft.subcategory} onChange={e=>set("subcategory",e.target.value)}/></label>
      <label>Machine / station<input value={draft.machine} onChange={e=>set("machine",e.target.value)}/></label>
      <label>Process vendor<select value={draft.vendorId} onChange={e=>set("vendorId",e.target.value)}><option value="">Not assigned</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company}</option>)}</select></label>
      <label>Status<select value={draft.status} onChange={e=>set("status",e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label>
      <label>Planned quantity<input type="number" min="0" value={draft.quantity} onChange={e=>set("quantity",e.target.value)}/></label>
      <label>Completed quantity<input type="number" min="0" value={draft.completed} onChange={e=>set("completed",e.target.value)}/></label>
      <label>Accepted quantity<input type="number" min="0" value={draft.accepted} onChange={e=>set("accepted",e.target.value)}/></label>
      <label>Rejected quantity<input type="number" min="0" value={draft.rejected} onChange={e=>set("rejected",e.target.value)}/></label>
      <label>Rate per part (₹)<input type="number" min="0" step="0.01" value={draft.ratePerPart} onChange={e=>set("ratePerPart",e.target.value)}/></label>
      <label>Actual rate per part (₹)<input type="number" min="0" step="0.01" value={draft.actualRatePerPart} onChange={e=>set("actualRatePerPart",e.target.value)}/></label>
      <label>Planned start<input type="datetime-local" value={draft.plannedStart} onChange={e=>set("plannedStart",e.target.value)}/></label>
      <label>Planned delivery / due<input type="datetime-local" value={draft.plannedEnd} onChange={e=>set("plannedEnd",e.target.value)}/></label>
      <label>Actual start<input type="datetime-local" value={draft.actualStart} onChange={e=>set("actualStart",e.target.value)}/></label>
      <label>Actual completion<input type="datetime-local" value={draft.actualEnd} onChange={e=>set("actualEnd",e.target.value)}/></label>
      <label>Payment status<select value={draft.paymentStatus} onChange={e=>set("paymentStatus",e.target.value)}><option>Unpaid</option><option>Paid</option></select></label>
      <label>Paid amount (₹)<input type="number" min="0" step="0.01" value={draft.paidAmount} onChange={e=>set("paidAmount",e.target.value)}/></label>
      <label>Execution<select value={draft.executionType} onChange={e=>set("executionType",e.target.value)}><option>Internal</option><option>Outsourced</option></select></label>
      <label>Tolerance<select value={draft.toleranceCategory} onChange={e=>set("toleranceCategory",e.target.value)}><option>Standard</option><option>Precision</option><option>Close</option><option>Ultra Precision</option></select></label>
      <label>Transport vendor<select value={draft.transportVendorId} onChange={e=>set("transportVendorId",e.target.value)}><option value="">Not assigned</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company}</option>)}</select></label>
      <label>Vehicle type<input value={draft.transportVehicleType} onChange={e=>set("transportVehicleType",e.target.value)}/></label>
      <label>Transport from<input value={draft.transportFrom} onChange={e=>set("transportFrom",e.target.value)}/></label>
      <label>Transport to<input value={draft.transportTo} onChange={e=>set("transportTo",e.target.value)}/></label>
      <label>Pickup date &amp; time<input type="datetime-local" value={draft.transportPickup} onChange={e=>set("transportPickup",e.target.value)}/></label>
      <label>Delivery date &amp; time<input type="datetime-local" value={draft.transportDelivery} onChange={e=>set("transportDelivery",e.target.value)}/></label>
      <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={draft.transportCost} onChange={e=>set("transportCost",e.target.value)}/></label>
      <label>Inspection result<input value={draft.inspectionResult} onChange={e=>set("inspectionResult",e.target.value)}/></label>
      <label>Branch / route<input value={draft.branch} onChange={e=>set("branch",e.target.value)}/></label>
      <label className="ax-inline-wide">Quality notes<input value={draft.qualityNotes} onChange={e=>set("qualityNotes",e.target.value)}/></label>
      <label className="ax-inline-wide">Operation notes<textarea value={draft.notes} onChange={e=>set("notes",e.target.value)}/></label>
    </div>
    <div className="ax-inline-editor-actions"><small>Saving updates the shared operation record. You remain in this Route Flow / Manufacturing Universe screen.</small><button type="button" className="button-primary" onClick={()=>onSave({
      name:draft.name.trim(),category:draft.category.trim(),subcategory:draft.subcategory.trim(),machine:draft.machine.trim(),
      vendorId:draft.vendorId,status:draft.status as LifecycleStatus,quantity:numeric(draft.quantity),completed:numeric(draft.completed),
      accepted:numeric(draft.accepted),rejected:numeric(draft.rejected),ratePerPart:numeric(draft.ratePerPart),actualRatePerPart:numeric(draft.actualRatePerPart),
      plannedStart:date(draft.plannedStart),plannedEnd:date(draft.plannedEnd),actualStart:date(draft.actualStart),actualEnd:date(draft.actualEnd),
      paymentStatus:draft.paymentStatus as "Paid"|"Unpaid",paidAmount:numeric(draft.paidAmount),
      executionType:draft.executionType as "Internal"|"Outsourced",toleranceCategory:draft.toleranceCategory as OperationRecord["toleranceCategory"],
      transportVendorId:draft.transportVendorId,transportFrom:draft.transportFrom,transportTo:draft.transportTo,
      transportVehicleType:draft.transportVehicleType,transportPickup:date(draft.transportPickup),transportDelivery:date(draft.transportDelivery),
      transportCost:numeric(draft.transportCost),inspectionResult:draft.inspectionResult,qualityNotes:draft.qualityNotes,branch:draft.branch.trim()||"Main route",notes:draft.notes
    })}><Save size={15}/> Save operation</button></div>
  </section>;
}
