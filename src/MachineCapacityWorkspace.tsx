import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, CalendarClock, Check, Clock3, Factory, Plus, Settings2, ShieldCheck, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type MachineResourceRecord, type MaintenanceEventRecord } from "./manufacturingData";

type Props = { mode: "maintenance" | "production"; onBack: () => void; onNotice: (value: string) => void; onSelectModule: (id: string) => void };
type MachineDraft = Omit<MachineResourceRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type EventDraft = Omit<MaintenanceEventRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
const localDate = (date: Date) => [date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");\nconst today = () => localDate(new Date());
const dateTimeLocal = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const blankMachine = (): MachineDraft => ({ factoryId: "", code: "", name: "", category: "CNC", makeModel: "", workingHoursPerDay: 0, shiftStartTime: "", workingDays: [], status: "Available", notes: "" });
const blankEvent = (): EventDraft => ({ resourceId: "", type: "Preventive", title: "", reason: "", priority: "Medium", status: "Scheduled", plannedStartAt: dateTimeLocal(new Date(Date.now() + 3600000)), plannedEndAt: dateTimeLocal(new Date(Date.now() + 7200000)), actualStartAt: "", actualEndAt: "", assignedTo: "", workOrderRef: "", notes: "" });
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const activeEvent = (event: MaintenanceEventRecord) => event.status !== "Cancelled";
function intervalFor(event: MaintenanceEventRecord): [number, number] | null {
  if (!activeEvent(event)) return null;
  const completedActual = event.status === "Completed" && Boolean(event.actualStartAt) && Boolean(event.actualEndAt);
  const start = completedActual ? event.actualStartAt : event.status === "In progress" && event.actualStartAt ? event.actualStartAt : event.plannedStartAt;
  const end = completedActual ? event.actualEndAt : event.status === "In progress" ? (event.actualEndAt || new Date(Math.max(Date.now(),Date.parse(event.plannedEndAt))).toISOString()) : event.plannedEndAt;
  const a = Date.parse(start), b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a, b] : null;
}
function overlapHours(intervals: Array<[number, number]>, from: number, to: number) {
  const clipped = intervals.map(([a,b]) => [Math.max(a,from), Math.min(b,to)] as [number,number]).filter(([a,b]) => b>a).sort((a,b)=>a[0]-b[0]);
  let total = 0, start = 0, end = 0;
  for (const [a,b] of clipped) { if (!start && !end) { start=a; end=b; } else if (a<=end) end=Math.max(end,b); else { total += end-start; start=a; end=b; } }
  if (end>start) total += end-start;
  return total / 3600000;
}
function downtimeWithinShifts(machine: MachineResourceRecord, intervals: Array<[number,number]>, from: Date, to: Date) {
  const days = new Set(machine.workingDays || []);
  let total = 0;
  const cursor = new Date(from.getFullYear(),from.getMonth(),from.getDate());
  const last = new Date(to.getFullYear(),to.getMonth(),to.getDate());
  while (cursor <= last) {
    if (days.has(cursor.getDay())) {
      const [hour,minute] = (machine.shiftStartTime || "08:00").split(":").map(Number);
      const shiftStart = new Date(cursor.getFullYear(),cursor.getMonth(),cursor.getDate(),hour||0,minute||0).getTime();
      const shiftEnd = shiftStart + Math.max(0,machine.workingHoursPerDay||0)*3600000;
      total += overlapHours(intervals,Math.max(shiftStart,from.getTime()),Math.min(shiftEnd,to.getTime()));
    }
    cursor.setDate(cursor.getDate()+1);
  }
  return total;
}
function workingHours(machine: MachineResourceRecord, from: Date, to: Date) {
  const days = new Set(machine.workingDays || []);
  let count = 0;
  const cursor = new Date(from.getFullYear(),from.getMonth(),from.getDate());
  const last = new Date(to.getFullYear(),to.getMonth(),to.getDate());
  while (cursor <= last) { if (days.has(cursor.getDay())) count++; cursor.setDate(cursor.getDate()+1); }
  return count * Math.max(0, machine.workingHoursPerDay || 0);
}

export default function MachineCapacityWorkspace({ mode, onBack, onNotice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const machines = activeRows(data.machineResources);
  const events = activeRows(data.maintenanceEvents);
  const operations = activeRows(data.operations);
  const factories = activeRows(data.factories);
  const [machineDraft, setMachineDraft] = useState<MachineDraft>(blankMachine());
  const [eventDraft, setEventDraft] = useState<EventDraft>(blankEvent());
  const [machineEditingId, setMachineEditingId] = useState("");
  const [eventEditingId, setEventEditingId] = useState("");
  const [showMachineForm, setShowMachineForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(() => { const d=new Date(); d.setDate(d.getDate()+6); return localDate(d); });
  const [search, setSearch] = useState("");
  const rangeStart = new Date(fromDate + "T00:00:00");
  const rangeEnd = new Date(toDate + "T23:59:59.999");
  const validRange = Number.isFinite(rangeStart.getTime()) && Number.isFinite(rangeEnd.getTime()) && rangeEnd >= rangeStart;
  const capacityRows = useMemo(() => machines.map(machine => {
    const base = validRange && machine.status === "Available" ? workingHours(machine, rangeStart, rangeEnd) : 0;
    const intervals = events.filter(event=>event.resourceId===machine.id).map(intervalFor).filter((x): x is [number,number] => Boolean(x));
    const downtime = validRange ? Math.min(base, downtimeWithinShifts(machine,intervals,rangeStart,rangeEnd)) : 0;
    return { machine, base, downtime, available: Math.max(0,base-downtime), utilisationLoss: base ? downtime/base*100 : 0 };
  }),[machines,events,fromDate,toDate,validRange]);
  const totalBase = capacityRows.reduce((s,r)=>s+r.base,0);
  const totalDowntime = capacityRows.reduce((s,r)=>s+r.downtime,0);
  const totalAvailable = capacityRows.reduce((s,r)=>s+r.available,0);
  const capacityConflicts = operations.filter(op=>op.machineResourceId && op.plannedStart && op.plannedEnd && op.status!=="Complete").flatMap(op=>{ const machine=machines.find(m=>m.id===op.machineResourceId); const start=new Date(op.plannedStart+"T00:00:00"); const end=new Date(op.plannedEnd+"T23:59:59.999"); return events.filter(event=>event.resourceId===op.machineResourceId).filter(event=>{const interval=intervalFor(event);return machine?.status==="Available" && interval && downtimeWithinShifts(machine,[interval],start,end)>0;}).map(event=>({operation:op,event,machine})); });
  const visibleEvents = events.filter(e => (e.title+" "+e.reason+" "+e.workOrderRef+" "+(machines.find(m=>m.id===e.resourceId)?.name||"")).toLowerCase().includes(search.toLowerCase().trim())).sort((a,b)=>a.plannedStartAt.localeCompare(b.plannedStartAt));
  const resetMachine = () => { setShowMachineForm(false); setMachineEditingId(""); setMachineDraft(blankMachine()); };
  const resetEvent = () => { setShowEventForm(false); setEventEditingId(""); setEventDraft(blankEvent()); };
  const saveMachine = () => {
    if (!machineDraft.code.trim() || !machineDraft.name.trim() || !machineDraft.factoryId) { onNotice("Select a factory and enter the machine code and name."); return; }
    if (!(machineDraft.workingHoursPerDay>0) || machineDraft.workingHoursPerDay>24 || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(machineDraft.shiftStartTime) || !machineDraft.workingDays.length) { onNotice("Enter a valid shift start, positive shift hours and at least one working day."); return; }
    const stamp=nowIso(), id=machineEditingId||makeId("machine");
    update(current=>({...current,machineResources:[...current.machineResources.filter(x=>x.id!==id),{...machineDraft,code:machineDraft.code.trim(),name:machineDraft.name.trim(),id,createdAt:current.machineResources.find(x=>x.id===id)?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined}]}));
    resetMachine(); onNotice("Machine resource saved. It is now available to maintenance and production-capacity calculations.");
  };
  const saveEvent = () => {
    if (!eventDraft.resourceId || !eventDraft.title.trim() || !eventDraft.plannedStartAt || !eventDraft.plannedEndAt) { onNotice("Select a machine, enter a downtime title and set the planned start and end."); return; }
    if (Date.parse(eventDraft.plannedEndAt)<=Date.parse(eventDraft.plannedStartAt)) { onNotice("Downtime end must be after its start."); return; }
    if (eventDraft.status==="Completed" && (!eventDraft.actualStartAt || !eventDraft.actualEndAt)) { onNotice("Enter both actual start and actual end before marking maintenance completed."); return; }
    if (eventDraft.status==="Completed" && eventDraft.actualStartAt && eventDraft.actualEndAt && Date.parse(eventDraft.actualEndAt)<=Date.parse(eventDraft.actualStartAt)) { onNotice("Actual downtime end must be after its actual start."); return; }
    const stamp=nowIso(), id=eventEditingId||makeId("maintenance");
    update(current=>({...current,maintenanceEvents:[...current.maintenanceEvents.filter(x=>x.id!==id),{...eventDraft,title:eventDraft.title.trim(),plannedStartAt:new Date(eventDraft.plannedStartAt).toISOString(),plannedEndAt:new Date(eventDraft.plannedEndAt).toISOString(),actualStartAt:eventDraft.actualStartAt?new Date(eventDraft.actualStartAt).toISOString():"",actualEndAt:eventDraft.actualEndAt?new Date(eventDraft.actualEndAt).toISOString():"",id,createdAt:current.maintenanceEvents.find(x=>x.id===id)?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined}]}));
    resetEvent(); onNotice("Maintenance / downtime event saved. Its overlapping hours are deducted from machine capacity.");
  };
  const editMachine=(m:MachineResourceRecord)=>{setMachineEditingId(m.id);setMachineDraft({factoryId:m.factoryId,code:m.code,name:m.name,category:m.category,makeModel:m.makeModel,workingHoursPerDay:m.workingHoursPerDay,shiftStartTime:m.shiftStartTime||"08:00",workingDays:m.workingDays||[1,2,3,4,5,6],status:m.status,notes:m.notes});setShowMachineForm(true);};
  const editEvent=(e:MaintenanceEventRecord)=>{setEventEditingId(e.id);setEventDraft({resourceId:e.resourceId,type:e.type,title:e.title,reason:e.reason,priority:e.priority,status:e.status,plannedStartAt:dateTimeLocal(new Date(e.plannedStartAt)),plannedEndAt:dateTimeLocal(new Date(e.plannedEndAt)),actualStartAt:e.actualStartAt?dateTimeLocal(new Date(e.actualStartAt)):"",actualEndAt:e.actualEndAt?dateTimeLocal(new Date(e.actualEndAt)):"",assignedTo:e.assignedTo,workOrderRef:e.workOrderRef,notes:e.notes});setShowEventForm(true);};
  const archiveMachine=(m:MachineResourceRecord)=>{if(events.some(e=>e.resourceId===m.id&&e.status==="In progress")){onNotice("Cannot archive a machine with an in-progress maintenance event.");return;}const stamp=nowIso();update(current=>({...current,machineResources:current.machineResources.map(x=>x.id===m.id?{...x,deletedAt:stamp,updatedAt:stamp}:x)}));onNotice("Machine archived; its historical maintenance records are retained.");};
  const archiveEvent=(e:MaintenanceEventRecord)=>{const stamp=nowIso();update(current=>({...current,maintenanceEvents:current.maintenanceEvents.map(x=>x.id===e.id?{...x,deletedAt:stamp,updatedAt:stamp}:x)}));onNotice("Maintenance event archived.");};
  const formatHours=(n:number)=>n.toLocaleString("en-IN",{maximumFractionDigits:1});
  return <section className="workspace-page machine-capacity-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Command centre</button><span className="demo-pill"><i/> {syncStatus==="synced"?"SERVER SYNCED":syncStatus==="error"?"SYNC ERROR":"LOCAL / SYNC PENDING"}</span></div>
    <div className="module-hero"><div className="module-hero-icon"><Settings2 size={27}/></div><div className="module-hero-copy"><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / RESOURCE AVAILABILITY</div><h1>{mode==="maintenance"?"Maintenance & Downtime":"Production Capacity"}<span>.</span></h1><p>Machine-level availability calculated from working calendars and scheduled or actual maintenance downtime.</p></div><button className="button-quiet" onClick={()=>onSelectModule(mode==="maintenance"?"production":"maintenance")}>{mode==="maintenance"?"Open production capacity":"Manage maintenance"} <Activity size={15}/></button></div>
    <section className="capacity-filter surface-panel"><div><strong>Capacity calculation window</strong><small>Working hours are taken from each machine's configured working days and shift hours. Downtime intervals are unioned to prevent double deduction.</small></div><label>From<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label>To<input type="date" min={fromDate} value={toDate} onChange={e=>setToDate(e.target.value)}/></label></section>
    {!validRange&&<div className="notice-banner"><AlertTriangle size={15}/> Select a valid date range.</div>}
    <section className="capacity-kpis">
      <article><small>GROSS MACHINE CAPACITY</small><strong>{formatHours(totalBase)} h</strong><span>{machines.length} active machine resource(s)</span></article>
      <article><small>MAINTENANCE / DOWNTIME</small><strong>{formatHours(totalDowntime)} h</strong><span>{totalBase?((totalDowntime/totalBase)*100).toFixed(1):"0.0"}% of gross capacity</span></article>
      <article><small>NET AVAILABLE CAPACITY</small><strong>{formatHours(totalAvailable)} h</strong><span>Capacity after downtime deduction</span></article>
      <article><small>OPEN MAINTENANCE EVENTS</small><strong>{events.filter(e=>e.status==="Scheduled"||e.status==="In progress").length}</strong><span>Scheduled or currently in progress</span></article>
    </section>
    <section className="surface-panel capacity-impact-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> MACHINE CAPACITY LEDGER</div><h3>Available production hours by machine</h3><p>Retired or restricted machines contribute zero available capacity. Completed events use actual timestamps when recorded.</p></div><span className="module-number">{capacityRows.length} MACHINES</span></div>
      {capacityRows.length?<div className="capacity-table-wrap"><table className="capacity-table"><thead><tr><th>Machine</th><th>Factory</th><th>Working pattern</th><th>Gross hours</th><th>Downtime</th><th>Net available</th><th>Capacity loss</th><th>State</th>{mode==="maintenance"&&<th>Manage</th>}</tr></thead><tbody>{capacityRows.map(row=><tr key={row.machine.id}><td><strong>{row.machine.code} · {row.machine.name}</strong><small>{row.machine.category} · {row.machine.makeModel||"Model not entered"}</small></td><td>{factories.find(f=>f.id===row.machine.factoryId)?.name||"Factory unavailable"}</td><td>{row.machine.workingHoursPerDay} h/day · {(row.machine.workingDays||[]).map(d=>dayNames[d]).join(", ")}</td><td>{formatHours(row.base)}</td><td className={row.downtime?"capacity-downtime":""}>{formatHours(row.downtime)}</td><td><strong>{formatHours(row.available)} h</strong></td><td>{row.base?row.utilisationLoss.toFixed(1)+"%":"—"}</td><td>{row.machine.status}</td>{mode==="maintenance"&&<td><button className="capacity-row-action" onClick={()=>editMachine(row.machine)}>Edit</button><button className="capacity-row-action" onClick={()=>archiveMachine(row.machine)}>Archive</button></td>}</tr>)}</tbody></table></div>:<div className="module-empty-state"><Factory size={25}/><h3>No machine resources registered</h3><p>Register machines with their factory and actual shift calendar before capacity can be calculated.</p>{mode==="maintenance"&&<button className="button-primary" onClick={()=>{setMachineDraft({...blankMachine(),factoryId:factories[0]?.id||""});setShowMachineForm(true);}}><Plus size={14}/> Add first machine</button>}</div>}
    </section>
    {mode==="maintenance"&&<>
      <section className="capacity-actions"><div><h2>Machine resource master</h2><p>Stable machine IDs connect maintenance events and future production assignments.</p></div><button className="button-primary" onClick={()=>{setMachineDraft({...blankMachine(),factoryId:factories[0]?.id||""});setMachineEditingId("");setShowMachineForm(true);}}><Plus size={15}/> Register machine</button></section>
      {showMachineForm&&<section className="surface-panel capacity-editor"><div className="panel-heading"><div><h3>{machineEditingId?"Edit machine resource":"Register machine resource"}</h3><p>Enter the real machine calendar. No sample capacity is assumed.</p></div><button className="icon-control" onClick={resetMachine}><X size={15}/></button></div><div className="capacity-form-grid">
        <label>Factory *<select value={machineDraft.factoryId} onChange={e=>setMachineDraft({...machineDraft,factoryId:e.target.value})}><option value="">Select factory…</option>{factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <label>Machine code *<input value={machineDraft.code} onChange={e=>setMachineDraft({...machineDraft,code:e.target.value})} placeholder="e.g. VMC-01"/></label>
        <label>Machine name *<input value={machineDraft.name} onChange={e=>setMachineDraft({...machineDraft,name:e.target.value})} placeholder="e.g. Vertical machining centre"/></label>
        <label>Category<input value={machineDraft.category} onChange={e=>setMachineDraft({...machineDraft,category:e.target.value})} placeholder="CNC / VMC / EDM / Grinding"/></label>
        <label>Make / model<input value={machineDraft.makeModel} onChange={e=>setMachineDraft({...machineDraft,makeModel:e.target.value})} placeholder="Manufacturer and model"/></label>
        <label>Shift start time *<input type="time" value={machineDraft.shiftStartTime} onChange={e=>setMachineDraft({...machineDraft,shiftStartTime:e.target.value})}/></label>
        <label>Working hours per day *<input type="number" min="0.1" max="24" step="0.25" value={machineDraft.workingHoursPerDay} onChange={e=>setMachineDraft({...machineDraft,workingHoursPerDay:Number(e.target.value)})}/></label>
        <label>Resource status<select value={machineDraft.status} onChange={e=>setMachineDraft({...machineDraft,status:e.target.value as MachineDraft["status"]})}><option>Available</option><option>Restricted</option><option>Retired</option></select></label>
        <div className="capacity-days"><strong>Working days *</strong><div>{dayNames.map((name,index)=><label key={name}><input type="checkbox" checked={machineDraft.workingDays.includes(index)} onChange={e=>setMachineDraft({...machineDraft,workingDays:e.target.checked?[...machineDraft.workingDays,index]:machineDraft.workingDays.filter(d=>d!==index)})}/>{name}</label>)}</div></div>
        <label className="capacity-wide">Notes<input value={machineDraft.notes} onChange={e=>setMachineDraft({...machineDraft,notes:e.target.value})} placeholder="Cell, spindle, operating constraints…"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveMachine}><Check size={14}/> Save machine</button><button className="button-quiet" onClick={resetMachine}>Cancel</button></div>
      </div></section>}
      <section className="capacity-actions"><div><h2>Maintenance & downtime events</h2><p>Planned preventive work and unplanned breakdowns both block the machine for their effective interval.</p></div><button className="button-primary" disabled={!machines.length} onClick={()=>{setEventDraft({...blankEvent(),resourceId:machines[0]?.id||""});setEventEditingId("");setShowEventForm(true);}}><Plus size={15}/> Record downtime</button></section>
      {showEventForm&&<section className="surface-panel capacity-editor"><div className="panel-heading"><div><h3>{eventEditingId?"Edit maintenance event":"New maintenance / downtime event"}</h3><p>Scheduled events reduce future capacity; in-progress breakdowns use actual start through the estimated repair end, at least through now.</p></div><button className="icon-control" onClick={resetEvent}><X size={15}/></button></div><div className="capacity-form-grid">
        <label>Machine resource *<select value={eventDraft.resourceId} onChange={e=>setEventDraft({...eventDraft,resourceId:e.target.value})}><option value="">Select machine…</option>{machines.map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select></label>
        <label>Event type<select value={eventDraft.type} onChange={e=>setEventDraft({...eventDraft,type:e.target.value as EventDraft["type"]})}>{["Preventive","Breakdown","Inspection","Setup / Calibration","Other"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Title *<input value={eventDraft.title} onChange={e=>setEventDraft({...eventDraft,title:e.target.value})} placeholder="Spindle bearing replacement"/></label>
        <label>Priority<select value={eventDraft.priority} onChange={e=>setEventDraft({...eventDraft,priority:e.target.value as EventDraft["priority"]})}>{["Low","Medium","High","Critical"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Status<select value={eventDraft.status} onChange={e=>setEventDraft({...eventDraft,status:e.target.value as EventDraft["status"]})}>{["Scheduled","In progress","Completed","Cancelled"].map(v=><option key={v}>{v}</option>)}</select></label>
        <label>Assigned technician<input value={eventDraft.assignedTo} onChange={e=>setEventDraft({...eventDraft,assignedTo:e.target.value})} placeholder="Technician / team"/></label>
        <label>Planned start *<input type="datetime-local" value={eventDraft.plannedStartAt} onChange={e=>setEventDraft({...eventDraft,plannedStartAt:e.target.value})}/></label>
        <label>Planned end *<input type="datetime-local" value={eventDraft.plannedEndAt} onChange={e=>setEventDraft({...eventDraft,plannedEndAt:e.target.value})}/></label>
        <label>Actual start<input type="datetime-local" value={eventDraft.actualStartAt} onChange={e=>setEventDraft({...eventDraft,actualStartAt:e.target.value})}/></label>
        <label>Actual end<input type="datetime-local" value={eventDraft.actualEndAt} onChange={e=>setEventDraft({...eventDraft,actualEndAt:e.target.value})}/></label>
        <label>Work order reference<input value={eventDraft.workOrderRef} onChange={e=>setEventDraft({...eventDraft,workOrderRef:e.target.value})} placeholder="Maintenance WO / breakdown ID"/></label>
        <label>Reason<input value={eventDraft.reason} onChange={e=>setEventDraft({...eventDraft,reason:e.target.value})} placeholder="Failure symptom / PM scope"/></label>
        <label className="capacity-wide">Notes<input value={eventDraft.notes} onChange={e=>setEventDraft({...eventDraft,notes:e.target.value})} placeholder="Isolation, spares, verification and release notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveEvent}><Check size={14}/> Save downtime event</button><button className="button-quiet" onClick={resetEvent}>Cancel</button></div>
      </div></section>}
      <section className="surface-panel capacity-event-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> MAINTENANCE REGISTER</div><h3>Saved maintenance events</h3><p>{events.length} active event record(s) · archived records remain in history</p></div><input className="capacity-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search machine, event, work order…"/></div>
        {visibleEvents.length?<div className="capacity-event-list">{visibleEvents.map(event=><article key={event.id}><span className={"capacity-event-icon "+(event.type==="Breakdown"?"is-breakdown":"")}><Wrench size={17}/></span><div className="capacity-event-main"><strong>{event.title}</strong><small>{machines.find(m=>m.id===event.resourceId)?.code||"Machine archived"} · {event.type} · {event.priority} priority</small><p>{event.reason||"No reason entered"} · {event.workOrderRef||"No work-order reference"}</p><small>{event.plannedStartAt.replace("T"," ")} → {event.plannedEndAt.replace("T"," ")}</small></div><span className={"record-state state-"+event.status.toLowerCase().replaceAll(" ","-")}>{event.status}</span><div className="capacity-event-actions"><button onClick={()=>editEvent(event)}>Edit</button><button onClick={()=>archiveEvent(event)}>Archive</button></div></article>)}</div>:<div className="vendor-empty">No maintenance or downtime events recorded.</div>}
      </section>
      <section className="surface-panel capacity-event-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> RESOURCE SCHEDULE CONFLICTS</div><h3>Operations overlapping maintenance</h3><p>Process Map operations linked to a registered machine are checked against that machine's maintenance windows.</p></div><span className="module-number">{capacityConflicts.length} CONFLICTS</span></div>{capacityConflicts.length?<div className="capacity-event-list">{capacityConflicts.map(({operation,event,machine})=><article key={operation.id+":"+event.id}><span className="capacity-event-icon is-breakdown"><AlertTriangle size={17}/></span><div className="capacity-event-main"><strong>{operation.name} · {operation.poId}</strong><small>{machine?.code||"Machine"} · {operation.plannedStart} → {operation.plannedEnd}</small><p>Overlaps {event.type.toLowerCase()} downtime: {event.title}</p></div><span className="record-state state-quality-hold">Schedule conflict</span><div className="capacity-event-actions"><button onClick={()=>onSelectModule("process-map")}>Open Process Map</button></div></article>)}</div>:<div className="vendor-empty">No linked operation / maintenance overlaps detected in saved records.</div>}</section>
      <div className="module-safety-note"><ShieldCheck size={15}/><span>Capacity is a planning calculation from configured machine calendars and recorded downtime—not live machine telemetry. Overlapping maintenance windows are counted once per machine. Do not treat a machine as safe to run until the maintenance verification and authorised return-to-service process is complete.</span></div>
    </>}
    {mode==="production"&&<>
    <section className="surface-panel capacity-impact-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PLANNER HANDOFF</div><h3>Capacity available to production planning</h3><p>These net machine-hour values are the capacity ceiling before operation cycle-time and job-priority allocation.</p></div><button className="button-primary" onClick={()=>onSelectModule("maintenance")}><Wrench size={14}/> Open maintenance schedule</button></div><div className="capacity-planner-note"><AlertTriangle size={17}/><span>Production allocation must not exceed the net available hours shown above. This stage calculates the machine-level capacity reduction; operation-level finite scheduling and automatic rescheduling remain the next integration step.</span></div></section>
      <section className="surface-panel capacity-event-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> RESOURCE SCHEDULE CONFLICTS</div><h3>Operations overlapping maintenance</h3><p>Process Map operations linked to a registered machine are checked against that machine's maintenance windows.</p></div><span className="module-number">{capacityConflicts.length} CONFLICTS</span></div>{capacityConflicts.length?<div className="capacity-event-list">{capacityConflicts.map(({operation,event,machine})=><article key={operation.id+":"+event.id}><span className="capacity-event-icon is-breakdown"><AlertTriangle size={17}/></span><div className="capacity-event-main"><strong>{operation.name} · {operation.poId}</strong><small>{machine?.code||"Machine"} · {operation.plannedStart} → {operation.plannedEnd}</small><p>Overlaps {event.type.toLowerCase()} downtime: {event.title}</p></div><span className="record-state state-quality-hold">Schedule conflict</span><div className="capacity-event-actions"><button onClick={()=>onSelectModule("process-map")}>Open Process Map</button></div></article>)}</div>:<div className="vendor-empty">No linked operation / maintenance overlaps detected in saved records.</div>}</section>
    </>}
  </section>;
}
