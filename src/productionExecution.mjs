import { validateMachineMaintenanceWindow } from "./machineMaintenance.mjs";
const ACTIVE_ASSIGNMENT_STATUSES=new Set(["Planned","Assigned","Running"]);
const dateRange=(startValue,endValue)=>{
 const start=Date.parse(startValue||""),end=Date.parse(endValue||"");
 return Number.isFinite(start)&&Number.isFinite(end)&&end>start?{start,end}:null;
};
const overlaps=(a,b)=>a.start<b.end&&b.start<a.end;
const hasCapability=(values,id)=>!Array.isArray(values)||values.length===0||Boolean(id&&values.includes(id));

export function getEligibleProductionOperators(operators=[],scope={}){
 const rows=Array.isArray(operators)?operators:[];
 return rows.filter(operator=>
  operator&&!operator.deletedAt&&operator.status==="Active"&&
  operator.companyId===scope.companyId&&operator.factoryId===scope.factoryId&&
  hasCapability(operator.processDefinitionIds,scope.processDefinitionId)&&
  hasCapability(operator.machineTypeCapabilities,scope.machineType)
 ).sort((a,b)=>String(a.employeeCode||"").localeCompare(String(b.employeeCode||"")));
}

/**
 * Validate a PO-line operation assignment as one atomically saved workforce slot.
 * Assignment target quantities are allocations only: completed/accepted/rejected
 * production quantities remain on OperationRecord and its inspection history.
 */
export function validateProductionAssignment(candidate,context={}){
 const fail=reason=>({ok:false,reason});
 if(!candidate||typeof candidate!=="object")return fail("invalid-assignment");
 if(!["Planned","Assigned","Running","Completed","Cancelled"].includes(candidate.status))return fail("invalid-assignment-status");
 const po=(context.purchaseOrders||[]).find(row=>row?.id===candidate.poId&&!row.deletedAt);
 const line=po?.lines?.find(row=>row?.id===candidate.poLineId&&!row.deletedAt);
 const component=(context.components||[]).find(row=>row?.id===candidate.componentId&&!row.deletedAt);
 const operation=(context.operations||[]).find(row=>row?.id===candidate.operationId&&!row.deletedAt);
 const machine=(context.machines||[]).find(row=>row?.id===candidate.machineId&&!row.deletedAt);
 const operator=(context.operators||[]).find(row=>row?.id===candidate.operatorId&&!row.deletedAt);
 if(!po||!line||!component||!operation||!machine||!operator)return fail("linked-record-not-found");
 if(!po.companyId||!po.factoryId||candidate.companyId!==po.companyId||candidate.factoryId!==po.factoryId||
    machine.companyId!==po.companyId||machine.factoryId!==po.factoryId||
    operator.companyId!==po.companyId||operator.factoryId!==po.factoryId)
  return fail("company-factory-mismatch");
 if(line.componentId!==component.id||operation.poId!==po.id||operation.poLineId!==line.id||operation.componentId!==component.id)
  return fail("po-line-operation-mismatch");
 if(operation.executionType==="Outsourced"||!operation.machineId||operation.machineId!==machine.id)
  return fail("internal-machine-assignment-required");
 const active=ACTIVE_ASSIGNMENT_STATUSES.has(candidate.status||"Planned");
 if(active&&(machine.status==="Retired"||machine.status==="Breakdown"||machine.status==="Under maintenance"||machine.status==="Planned maintenance"))
  return fail("machine-unavailable");
 if(candidate.operatorCode!==operator.employeeCode||candidate.operatorName!==operator.displayName)return fail("operator-snapshot-mismatch");
 if(active&&operator.status!=="Active")return fail("operator-inactive");
 if(active&&["Complete","Rejected"].includes(operation.status))return fail("operation-not-open");
 if(active&&!hasCapability(operator.processDefinitionIds,operation.processDefinitionId))
  return fail("operator-process-capability-mismatch");
 if(active&&!hasCapability(operator.machineTypeCapabilities,machine.machineType))
  return fail("operator-machine-capability-mismatch");
 if(typeof candidate.shiftCode!=="string"||!candidate.shiftCode.trim()||
    typeof candidate.shiftName!=="string"||!candidate.shiftName.trim())
  return fail("shift-required");
 const window=dateRange(candidate.plannedStart,candidate.plannedEnd);
 if(!window)return fail("invalid-time-window");
 const operationWindow=dateRange(operation.plannedStart,operation.plannedEnd);
 if((operation.plannedStart||operation.plannedEnd)&&!operationWindow)return fail("operation-window-invalid");
 if(operationWindow&&(window.start<operationWindow.start||window.end>operationWindow.end))
  return fail("outside-operation-window");
 const target=Number(candidate.targetQuantity);
 if(!Number.isSafeInteger(target)||target<=0||!Number.isSafeInteger(Number(operation.quantity))||target>Number(operation.quantity))
  return fail("invalid-target-quantity");
 if(ACTIVE_ASSIGNMENT_STATUSES.has(candidate.status||"Planned")&&candidate.status==="Running"&&!candidate.actualStart)
  return fail("actual-start-required");
 if(candidate.status==="Completed"){
  const actual=dateRange(candidate.actualStart,candidate.actualEnd);
  if(!actual)return fail("actual-completion-window-required");
 }
 if(candidate.actualEnd&&(!candidate.actualStart||!Number.isFinite(Date.parse(candidate.actualEnd))||Date.parse(candidate.actualEnd)<=Date.parse(candidate.actualStart)))
  return fail("invalid-actual-window");
 const assignments=Array.isArray(context.assignments)?context.assignments:[];
 const retained=assignments.filter(row=>row&&!row.deletedAt&&row.id!==(context.editingId||candidate.id));
 const operationAllocation=retained.filter(row=>row.operationId===operation.id&&row.status!=="Cancelled")
  .reduce((sum,row)=>sum+Math.max(0,Number(row.targetQuantity)||0),0);
 if(candidate.status!=="Cancelled"&&operationAllocation+target>Number(operation.quantity))return fail("operation-allocation-exceeded");
 if(ACTIVE_ASSIGNMENT_STATUSES.has(candidate.status||"Planned")){
  const machineWindow=validateMachineMaintenanceWindow(candidate.machineId,candidate.plannedStart,candidate.plannedEnd,
   (context.operations||[]).filter(row=>row?.id!==operation.id),context.maintenanceWorkOrders||[],context.machineDowntime||[]);
  if(!machineWindow.ok)return fail("machine-maintenance-conflict");
  for(const row of retained){
   if(!ACTIVE_ASSIGNMENT_STATUSES.has(row.status)||row.companyId!==candidate.companyId||row.factoryId!==candidate.factoryId)continue;
   const otherWindow=dateRange(row.plannedStart,row.plannedEnd);
   if(!otherWindow||!overlaps(window,otherWindow))continue;
   if(row.operatorId===candidate.operatorId)return fail("operator-time-conflict");
   if(row.machineId===candidate.machineId&&row.operationId!==candidate.operationId)return fail("machine-assignment-time-conflict");
  }
 }
 return {ok:true,reason:""};
}

export function getOperationAssignmentTotals(assignments=[],operationId){
 const rows=(Array.isArray(assignments)?assignments:[]).filter(row=>row&&!row.deletedAt&&row.operationId===operationId&&row.status!=="Cancelled");
 return {
  assignedQuantity:rows.reduce((sum,row)=>sum+Math.max(0,Number(row.targetQuantity)||0),0),
  assignmentCount:rows.length,
  activeCount:rows.filter(row=>ACTIVE_ASSIGNMENT_STATUSES.has(row.status)).length,
  runningCount:rows.filter(row=>row.status==="Running").length,
  completedCount:rows.filter(row=>row.status==="Completed").length
 };
}
