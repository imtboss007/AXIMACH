const ACTIVE_WORK_ORDER_STATUSES = new Set(["Planned","In progress","Waiting parts"]);
const WORK_ORDER_PRIORITY_RANK = Object.freeze({Critical:0,High:1,Normal:2,Low:3});

function timeRange(startValue,endValue){
  const start=Date.parse(startValue||"");
  const end=Date.parse(endValue||"");
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return null;
  return {start,end};
}
function overlaps(left,right){
  return left.start<right.end&&right.start<left.end;
}

/**
 * A planned work order reserves only its scheduled interval. Once work has
 * started (or is waiting for parts), the machine remains unavailable until
 * the work order is explicitly completed or cancelled. Do not release the
 * machine merely because the original schedule has elapsed.
 */
function activeWorkOrderRange(order){
  if(!order||!ACTIVE_WORK_ORDER_STATUSES.has(order.status))return null;
  if(order.status==="Planned"){
    const planned=timeRange(order.scheduledStart,order.scheduledEnd);
    if(planned)return planned;
    // A malformed partial planned window must fail closed rather than allow
    // another reservation to occupy an interval that cannot be established.
    return order.scheduledStart||order.scheduledEnd
      ?{start:Number.NEGATIVE_INFINITY,end:Number.POSITIVE_INFINITY}
      :null;
  }
  const candidates=[order.actualStart,order.scheduledStart,order.reportedAt];
  let start=Number.NEGATIVE_INFINITY;
  for(const value of candidates){
    const parsed=Date.parse(value||"");
    if(Number.isFinite(parsed)){start=parsed;break;}
  }
  // In-progress and waiting-for-parts work stays open-ended until its status
  // is closed. Scheduled end is a target, not proof that the repair finished.
  return {start,end:Number.POSITIVE_INFINITY};
}

export function getMachineAvailability(machine, workOrders=[], downtimeRecords=[], at=new Date().toISOString()){
  const timestamp=Date.parse(at);
  const now=Number.isFinite(timestamp)?timestamp:Date.now();
  const events=(Array.isArray(downtimeRecords)?downtimeRecords:[])
    .filter(row=>row?.machineId===machine?.id&&!row.deletedAt&&Number.isFinite(Date.parse(row.startedAt||""))&&Date.parse(row.startedAt)<=now&&(!row.endedAt||Date.parse(row.endedAt)>now))
    .sort((a,b)=>Date.parse(b.startedAt)-Date.parse(a.startedAt));
  const activeDowntime=events[0]||null;
  const activeOrders=(Array.isArray(workOrders)?workOrders:[])
    .filter(row=>row?.machineId===machine?.id&&!row.deletedAt&&ACTIVE_WORK_ORDER_STATUSES.has(row.status))
    .filter(row=>{
      const range=activeWorkOrderRange(row);
      return Boolean(range&&range.start<=now&&range.end>now);
    })
    .sort((a,b)=>(WORK_ORDER_PRIORITY_RANK[a.priority]??2)-(WORK_ORDER_PRIORITY_RANK[b.priority]??2));
  const activeWorkOrder=activeOrders[0]||null;
  const plannedOrder=(Array.isArray(workOrders)?workOrders:[])
    .filter(row=>row?.machineId===machine?.id&&!row.deletedAt&&row.status==="Planned")
    .filter(row=>{const range=timeRange(row.scheduledStart,row.scheduledEnd);return Boolean(range&&range.start<=now&&range.end>now);})[0]||null;
  const availability = machine?.status==="Retired" ? "Retired"
    : activeDowntime?.downtimeType==="Unplanned breakdown" ? "Breakdown"
    : activeDowntime?.downtimeType==="Planned maintenance" ? "Planned maintenance"
    : activeDowntime ? "Under maintenance"
    : activeWorkOrder?.status==="In progress"||activeWorkOrder?.status==="Waiting parts" ? "Under maintenance"
    : activeWorkOrder ? "Planned maintenance"
    : plannedOrder ? "Planned maintenance"
    : machine?.status||"Available";
  return {
    status:availability,
    activeDowntime,
    activeWorkOrder,
    plannedOrder,
    blocksProduction:["Retired","Breakdown","Under maintenance","Planned maintenance"].includes(availability)
  };
}

export function validateMachineMaintenanceWindow(machineId,startValue,endValue,operations=[],workOrders=[],downtimeRecords=[],editingWorkOrderId=""){
  const candidate=timeRange(startValue,endValue);
  if(!candidate)return {ok:false,reason:"invalid-time-window"};
  for(const operation of Array.isArray(operations)?operations:[]){
    if(!operation||operation.machineId!==machineId||operation.deletedAt||operation.executionType==="Outsourced"||["Complete","Rejected"].includes(operation.status))continue;
    const range=timeRange(operation.plannedStart,operation.plannedEnd);
    if(range&&overlaps(candidate,range))return {ok:false,reason:"production-conflict",conflictingRecordId:operation.id};
  }
  for(const order of Array.isArray(workOrders)?workOrders:[]){
    if(!order||order.id===editingWorkOrderId||order.machineId!==machineId||order.deletedAt)continue;
    const range=activeWorkOrderRange(order);
    if(range&&overlaps(candidate,range))return {ok:false,reason:"maintenance-conflict",conflictingRecordId:order.id};
  }
  for(const event of Array.isArray(downtimeRecords)?downtimeRecords:[]){
    if(!event||event.machineId!==machineId||event.deletedAt||!event.startedAt)continue;
    const start=Date.parse(event.startedAt);
    const end=event.endedAt?Date.parse(event.endedAt):Number.POSITIVE_INFINITY;
    if(Number.isFinite(start)&&(!event.endedAt||Number.isFinite(end))&&overlaps(candidate,{start,end}))return {ok:false,reason:"downtime-conflict",conflictingRecordId:event.id};
  }
  return {ok:true,reason:""};
}

export function validateMachineSchedule(candidate,operations=[],editingId="",maintenanceWorkOrders=[],downtimeRecords=[]){
  if(!candidate?.machineId||candidate.executionType==="Outsourced"||["Complete","Rejected"].includes(candidate.status)||candidate.deletedAt)return {ok:true,reason:""};
  const range=timeRange(candidate.plannedStart,candidate.plannedEnd);
  if(!candidate.plannedStart&&!candidate.plannedEnd)return {ok:true,reason:""};
  if(!range)return {ok:false,reason:"invalid-time-window"};
  for(const other of Array.isArray(operations)?operations:[]){
    if(!other||other.id===(editingId||candidate.id)||other.machineId!==candidate.machineId||other.executionType==="Outsourced"||other.deletedAt||["Complete","Rejected"].includes(other.status))continue;
    const otherRange=timeRange(other.plannedStart,other.plannedEnd);
    if(otherRange&&overlaps(range,otherRange))return {ok:false,reason:"machine-time-conflict",conflictingOperationId:other.id};
  }
  for(const order of Array.isArray(maintenanceWorkOrders)?maintenanceWorkOrders:[]){
    if(!order||order.machineId!==candidate.machineId||order.deletedAt)continue;
    const maintenanceRange=activeWorkOrderRange(order);
    if(maintenanceRange&&overlaps(range,maintenanceRange))return {ok:false,reason:"machine-maintenance-conflict",conflictingMaintenanceId:order.id};
  }
  for(const event of Array.isArray(downtimeRecords)?downtimeRecords:[]){
    if(!event||event.machineId!==candidate.machineId||event.deletedAt||!event.startedAt)continue;
    const start=Date.parse(event.startedAt),end=event.endedAt?Date.parse(event.endedAt):Number.POSITIVE_INFINITY;
    if(Number.isFinite(start)&&(!event.endedAt||Number.isFinite(end))&&overlaps(range,{start,end}))return {ok:false,reason:"machine-downtime-conflict",conflictingDowntimeId:event.id};
  }
  return {ok:true,reason:""};
}
