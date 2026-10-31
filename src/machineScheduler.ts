import type { MachineResourceRecord, MaintenanceEventRecord, OperationRecord } from "./manufacturingData";

export type MachineSlotProposal = {
  operation: OperationRecord;
  machine: MachineResourceRecord;
  startAt: string;
  endAt: string;
  segments: Array<{ startAt: string; endAt: string }>;
  requiredHours: number;
  alternate: boolean;
};

const localDayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const addDays = (value: Date, count: number) => { const d = new Date(value); d.setDate(d.getDate()+count); return d; };
const asIso = (value: number) => new Date(value).toISOString();
const eventInterval = (event: MaintenanceEventRecord): [number, number] | null => {
  if (event.status === "Cancelled") return null;
  const completed = event.status === "Completed" && event.actualStartAt && event.actualEndAt;
  const start = completed ? event.actualStartAt : event.status === "In progress" && event.actualStartAt ? event.actualStartAt : event.plannedStartAt;
  const end = completed ? event.actualEndAt : event.status === "In progress" ? (event.actualEndAt || asIso(Math.max(Date.now(), Date.parse(event.plannedEndAt)))) : event.plannedEndAt;
  const a = Date.parse(start), b = Date.parse(end);
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? [a,b] : null;
};

function allocate(machine: MachineResourceRecord, operation: OperationRecord, earliest: number, horizon: number, events: MaintenanceEventRecord[]): MachineSlotProposal | null {
  if (machine.status !== "Available" || !(machine.workingHoursPerDay > 0) || !machine.workingDays?.length) return null;
  const requiredHours = Math.max(0, operation.setupHours || 0) + Math.max(0, operation.quantity || 0) * Math.max(0, operation.cycleTimeSeconds || 0) / 3600;
  if (!(requiredHours > 0)) return null;
  const blocks = events.filter(e=>e.resourceId===machine.id).map(eventInterval).filter((v): v is [number,number] => Boolean(v)).sort((a,b)=>a[0]-b[0]);
  let remaining = requiredHours * 3600000;
  const segments: Array<{startAt:string;endAt:string}> = [];
  let cursor = Math.max(earliest, localDayStart(new Date(earliest)).getTime());
  const maxDays = Math.max(1, Math.ceil((horizon-cursor)/86400000)+1);
  for (let day=0; day<maxDays && cursor<horizon && remaining>0; day++) {
    const date = addDays(new Date(cursor),day);
    if (!machine.workingDays.includes(date.getDay())) continue;
    const [h,m] = (machine.shiftStartTime || "08:00").split(":").map(Number);
    const shiftStart = new Date(date.getFullYear(),date.getMonth(),date.getDate(),h||0,m||0).getTime();
    const shiftEnd = shiftStart + machine.workingHoursPerDay*3600000;
    let free: Array<[number,number]> = [[Math.max(shiftStart,earliest),Math.min(shiftEnd,horizon)]].filter(([a,b])=>b>a);
    for (const [blockStart,blockEnd] of blocks) {
      const next: Array<[number,number]> = [];
      for (const [a,b] of free) {
        if (blockEnd<=a || blockStart>=b) next.push([a,b]);
        else { if(blockStart>a) next.push([a,Math.min(blockStart,b)]); if(blockEnd<b) next.push([Math.max(blockEnd,a),b]); }
      }
      free=next;
    }
    for (const [a,b] of free) {
      if (remaining<=0) break;
      const take=Math.min(remaining,b-a);
      if(take>0) segments.push({startAt:asIso(a),endAt:asIso(a+take)});
      remaining-=take;
    }
  }
  if (remaining>0 || !segments.length) return null;
  return {operation,machine,startAt:segments[0].startAt,endAt:segments[segments.length-1].endAt,segments,requiredHours,alternate:machine.id!==operation.machineResourceId};
}

export function proposeMachineSchedule(input: {
  operations: OperationRecord[];
  machines: MachineResourceRecord[];
  events: MaintenanceEventRecord[];
  fromDate: string;
  toDate: string;
}): MachineSlotProposal[] {
  const {operations,machines,events,fromDate,toDate}=input;
  const from = new Date(fromDate+"T00:00:00");
  const horizonDate = new Date(toDate+"T23:59:59.999");
  // Extend the search horizon to 90 calendar days after the selected window's start.
  const horizon = Math.max(horizonDate.getTime(),addDays(from,90).getTime());
  const activeMachines=machines.filter(m=>m.status==="Available");
  const nextFree=new Map(activeMachines.map(m=>[m.id,from.getTime()]));
  const pending=operations.filter(op=>op.status!=="Complete" && op.machineResourceId && op.plannedStart && (Number(op.setupHours||0)>0 || Number(op.cycleTimeSeconds||0)>0))
    .sort((a,b)=>a.plannedStart.localeCompare(b.plannedStart)||a.sequence-b.sequence);
  const proposals: MachineSlotProposal[]=[];
  for(const operation of pending){
    const requested = Math.max(from.getTime(),new Date(operation.plannedStart+"T00:00:00").getTime());
    const primary=activeMachines.find(m=>m.id===operation.machineResourceId);
    if(!primary) continue;
    const alternates=activeMachines.filter(m=>m.id!==primary.id && m.factoryId===primary.factoryId && m.category.trim().toLowerCase()===primary.category.trim().toLowerCase());
    const primaryProposal=allocate(primary,operation,Math.max(requested,nextFree.get(primary.id)||requested),horizon,events);
    const deadline=operation.plannedEnd ? new Date(operation.plannedEnd+"T23:59:59.999").getTime() : horizon;
    let chosen=primaryProposal && Date.parse(primaryProposal.endAt)<=deadline ? primaryProposal : null;
    if(!chosen){
      const alternateProposals=alternates.map(machine=>allocate(machine,operation,Math.max(requested,nextFree.get(machine.id)||requested),horizon,events)).filter((v):v is MachineSlotProposal=>Boolean(v));
      alternateProposals.sort((a,b)=>Date.parse(a.endAt)-Date.parse(b.endAt));
      chosen=alternateProposals[0] || primaryProposal;
    }
    if(!chosen) continue;
    proposals.push(chosen);
    nextFree.set(chosen.machine.id,Date.parse(chosen.endAt));
  }
  return proposals;
}
