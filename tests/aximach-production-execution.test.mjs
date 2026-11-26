import test from "node:test";
import assert from "node:assert/strict";
import {getEligibleProductionOperators,validateProductionAssignment,getOperationAssignmentTotals} from "../src/productionExecution.mjs";

const po={id:"po-1",number:"PO-001",companyId:"c1",factoryId:"f1",lines:[{id:"line-1",componentId:"cmp-1",quantity:100}]};
const component={id:"cmp-1",companyId:"c1",partNumber:"CMP-1",revision:"A"};
const operation={id:"op-1",poId:"po-1",poLineId:"line-1",componentId:"cmp-1",processDefinitionId:"proc-vmc",executionType:"Internal",machineId:"machine-1",quantity:100,status:"Planned",plannedStart:"2026-12-01T08:00:00.000Z",plannedEnd:"2026-12-01T18:00:00.000Z"};
const machine={id:"machine-1",companyId:"c1",factoryId:"f1",machineType:"VMC",status:"Available"};
const operator={id:"operator-1",companyId:"c1",factoryId:"f1",employeeCode:"OP-001",displayName:"Operator One",status:"Active",processDefinitionIds:["proc-vmc"],machineTypeCapabilities:["VMC"]};
const candidate={
 id:"assignment-1",companyId:"c1",factoryId:"f1",poId:"po-1",poLineId:"line-1",componentId:"cmp-1",
 operationId:"op-1",machineId:"machine-1",operatorId:"operator-1",operatorCode:"OP-001",operatorName:"Operator One",
 shiftCode:"A",shiftName:"Day Shift",plannedStart:"2026-12-01T08:00:00.000Z",plannedEnd:"2026-12-01T12:00:00.000Z",
 actualStart:"",actualEnd:"",targetQuantity:60,status:"Assigned",notes:""
};
const context=(overrides={})=>({
 purchaseOrders:[po],components:[component],operations:[operation],machines:[machine],operators:[operator],assignments:[],
 maintenanceWorkOrders:[],machineDowntime:[],...overrides
});

test("eligible operator list is isolated by company, factory, status and process/machine skills",()=>{
 const rows=[
  operator,
  {...operator,id:"other-company",companyId:"c2",employeeCode:"OP-002"},
  {...operator,id:"other-factory",factoryId:"f2",employeeCode:"OP-003"},
  {...operator,id:"inactive",status:"Inactive",employeeCode:"OP-004"},
  {...operator,id:"wrong-process",processDefinitionIds:["proc-turn"],employeeCode:"OP-005"},
  {...operator,id:"general",processDefinitionIds:[],machineTypeCapabilities:[],employeeCode:"OP-006"}
 ];
 assert.deepEqual(getEligibleProductionOperators(rows,{companyId:"c1",factoryId:"f1",processDefinitionId:"proc-vmc",machineType:"VMC"}).map(x=>x.id),["operator-1","general"]);
});

test("a valid internal PO-line operation, machine, operator and shift assignment is accepted",()=>{
 assert.deepEqual(validateProductionAssignment(candidate,context()),{ok:true,reason:""});
});

test("assignments reject foreign company/factory, wrong PO line, outsourced work and wrong machine",()=>{
 assert.equal(validateProductionAssignment({...candidate,companyId:"c2"},context()).reason,"company-factory-mismatch");
 assert.equal(validateProductionAssignment({...candidate,factoryId:"f2"},context()).reason,"company-factory-mismatch");
 assert.equal(validateProductionAssignment({...candidate,poLineId:"another-line"},context()).reason,"po-line-operation-mismatch");
 assert.equal(validateProductionAssignment(candidate,context({operations:[{...operation,executionType:"Outsourced"}]})).reason,"internal-machine-assignment-required");
 assert.equal(validateProductionAssignment({...candidate,machineId:"machine-2"},context()).reason,"linked-record-not-found");
});

test("operator process and machine capabilities must match the saved operation and machine",()=>{
 assert.equal(validateProductionAssignment(candidate,context({operators:[{...operator,processDefinitionIds:["proc-turn"]}]})).reason,"operator-process-capability-mismatch");
 assert.equal(validateProductionAssignment(candidate,context({operators:[{...operator,machineTypeCapabilities:["CNC Turning"]}]})).reason,"operator-machine-capability-mismatch");
});

test("operator assignments cannot overlap, while back-to-back shifts are allowed",()=>{
 const existing={...candidate,id:"assignment-existing",plannedStart:"2026-12-01T08:00:00.000Z",plannedEnd:"2026-12-01T12:00:00.000Z",targetQuantity:60,status:"Assigned"};
 assert.equal(validateProductionAssignment({...candidate,id:"assignment-next",plannedStart:"2026-12-01T11:00:00.000Z",plannedEnd:"2026-12-01T15:00:00.000Z",targetQuantity:40},context({assignments:[existing]})).reason,"operator-time-conflict");
 assert.deepEqual(validateProductionAssignment({...candidate,id:"assignment-next",plannedStart:"2026-12-01T12:00:00.000Z",plannedEnd:"2026-12-01T18:00:00.000Z",targetQuantity:40},context({assignments:[existing]})),{ok:true,reason:""});
});

test("operation target allocation cannot exceed the operation's required quantity",()=>{
 const existing={...candidate,id:"assignment-existing",targetQuantity:60,status:"Completed"};
 assert.equal(validateProductionAssignment({...candidate,id:"assignment-over",targetQuantity:41},context({assignments:[existing]})).reason,"operation-allocation-exceeded");
});

test("assignment schedule must fit the operation plan and avoid other machine reservations",()=>{
 assert.equal(validateProductionAssignment({...candidate,plannedStart:"2026-12-01T07:00:00.000Z"},context()).reason,"outside-operation-window");
 const other={...operation,id:"op-other",plannedStart:"2026-12-01T10:00:00.000Z",plannedEnd:"2026-12-01T11:00:00.000Z"};
 assert.equal(validateProductionAssignment(candidate,context({operations:[operation,other]})).reason,"machine-maintenance-conflict");
});

test("active maintenance and downtime windows block machine assignments",()=>{
 const maintenance={id:"wo-1",machineId:"machine-1",status:"Planned",scheduledStart:"2026-12-01T09:00:00.000Z",scheduledEnd:"2026-12-01T10:00:00.000Z"};
 assert.equal(validateProductionAssignment(candidate,context({maintenanceWorkOrders:[maintenance]})).reason,"machine-maintenance-conflict");
 const downtime={id:"down-1",machineId:"machine-1",startedAt:"2026-12-01T09:00:00.000Z",endedAt:"2026-12-01T10:00:00.000Z",downtimeType:"Unplanned breakdown"};
 assert.equal(validateProductionAssignment(candidate,context({machineDowntime:[downtime]})).reason,"machine-maintenance-conflict");
});

test("completed assignments require actual start and end timestamps",()=>{
 assert.equal(validateProductionAssignment({...candidate,status:"Completed"},context()).reason,"actual-completion-window-required");
 assert.deepEqual(validateProductionAssignment({...candidate,status:"Completed",actualStart:"2026-12-01T08:00:00.000Z",actualEnd:"2026-12-01T12:00:00.000Z"},context()),{ok:true,reason:""});
});

test("operation assignment totals preserve completed targets and exclude cancelled records",()=>{
 const rows=[
  {...candidate,id:"a",targetQuantity:30,status:"Completed"},
  {...candidate,id:"b",targetQuantity:40,status:"Running"},
  {...candidate,id:"c",targetQuantity:20,status:"Cancelled"},
  {...candidate,id:"d",targetQuantity:10,status:"Planned"}
 ];
 assert.deepEqual(getOperationAssignmentTotals(rows,"op-1"),{assignedQuantity:80,assignmentCount:3,activeCount:2,runningCount:1,completedCount:1});
});

test("started work can be completed and historised after the machine becomes unavailable or the operator is deactivated",()=>{
 const running={...candidate,status:"Running",actualStart:"2026-12-01T08:15:00.000Z"};
 const contextWithChangedState=context({
  machines:[{...machine,status:"Breakdown"}],
  operators:[{...operator,status:"Inactive"}],
  assignments:[running]
 });
 const completed={...running,status:"Completed",actualEnd:"2026-12-01T12:15:00.000Z"};
 assert.deepEqual(validateProductionAssignment(completed,{...contextWithChangedState,editingId:running.id}),{ok:true,reason:""});
});
test("an operation that starts late can retain its actual start against the original planned shift window",()=>{
 const delayed={...candidate,status:"Running",actualStart:"2026-12-01T12:30:00.000Z"};
 assert.deepEqual(validateProductionAssignment(delayed,context()),{ok:true,reason:""});
});
