import test from "node:test";
import assert from "node:assert/strict";
import {getMachineAvailability,validateMachineMaintenanceWindow,validateMachineSchedule} from "../src/machineMaintenance.mjs";
const machine={id:"m1",status:"Available"};
const operations=[{id:"op1",machineId:"m1",executionType:"Internal",status:"Planned",plannedStart:"2026-11-26T09:00:00.000Z",plannedEnd:"2026-11-26T11:00:00.000Z"}];
const workOrders=[
 {id:"wo1",machineId:"m1",status:"Planned",priority:"High",scheduledStart:"2026-11-26T13:00:00.000Z",scheduledEnd:"2026-11-26T15:00:00.000Z"},
 {id:"wo2",machineId:"m1",status:"Completed",scheduledStart:"2026-11-26T10:00:00.000Z",scheduledEnd:"2026-11-26T12:00:00.000Z"}
];
const downtime=[{id:"dt1",machineId:"m1",downtimeType:"Unplanned breakdown",startedAt:"2026-11-26T16:00:00.000Z",endedAt:""}];
test("maintenance work order windows cannot overlap production reservations",()=>{
 assert.equal(validateMachineMaintenanceWindow("m1","2026-11-26T10:00:00.000Z","2026-11-26T12:00:00.000Z",operations,workOrders,downtime).reason,"production-conflict");
});
test("maintenance work orders cannot overlap another active maintenance order",()=>{
 assert.equal(validateMachineMaintenanceWindow("m1","2026-11-26T14:00:00.000Z","2026-11-26T16:00:00.000Z",[],workOrders,downtime).reason,"maintenance-conflict");
});
test("maintenance windows reject an open-ended machine downtime overlap",()=>{
 assert.equal(validateMachineMaintenanceWindow("m1","2026-11-26T17:00:00.000Z","2026-11-26T18:00:00.000Z",[],[],downtime).reason,"downtime-conflict");
});
test("maintenance work orders allow back-to-back production intervals",()=>{
 assert.deepEqual(validateMachineMaintenanceWindow("m1","2026-11-26T11:00:00.000Z","2026-11-26T12:00:00.000Z",operations,[],[]),{ok:true,reason:""});
});
test("production reservations are blocked by maintenance work orders and downtime",()=>{
 assert.equal(validateMachineSchedule({...operations[0],id:"op2",plannedStart:"2026-11-26T13:30:00.000Z",plannedEnd:"2026-11-26T14:30:00.000Z"},[], "",workOrders,downtime).reason,"machine-maintenance-conflict");
 assert.equal(validateMachineSchedule({...operations[0],id:"op3",plannedStart:"2026-11-26T16:30:00.000Z",plannedEnd:"2026-11-26T17:30:00.000Z"},[], "",[],downtime).reason,"machine-downtime-conflict");
});
test("machine availability is derived from active breakdown and maintenance records",()=>{
 const when="2026-11-26T16:30:00.000Z";
 const result=getMachineAvailability(machine,workOrders,downtime,when);
 assert.equal(result.status,"Breakdown");
 assert.equal(result.blocksProduction,true);
 assert.equal(result.activeDowntime.id,"dt1");
});
test("completed maintenance history does not block current availability",()=>{
 const result=getMachineAvailability(machine,[workOrders[1]],[], "2026-11-26T10:00:00.000Z");
 assert.equal(result.status,"Available");
 assert.equal(result.blocksProduction,false);
});
test("an in-progress repair remains blocking after its scheduled end until the work order is closed",()=>{
 const repair={id:"wo-live",machineId:"m1",status:"In progress",actualStart:"2026-11-26T12:00:00.000Z",scheduledStart:"2026-11-26T12:00:00.000Z",scheduledEnd:"2026-11-26T14:00:00.000Z"};
 const operation={...operations[0],id:"op-after-repair",plannedStart:"2026-11-26T16:00:00.000Z",plannedEnd:"2026-11-26T17:00:00.000Z"};
 assert.equal(validateMachineSchedule(operation,[],"",[repair],[]).reason,"machine-maintenance-conflict");
 assert.equal(validateMachineMaintenanceWindow("m1","2026-11-26T16:00:00.000Z","2026-11-26T17:00:00.000Z",[],[repair],[]).reason,"maintenance-conflict");
});
test("an in-progress or waiting-for-parts work order without a schedule fails closed",()=>{
 const repair={id:"wo-unscheduled",machineId:"m1",status:"Waiting parts"};
 const operation={...operations[0],id:"op-unscheduled-repair",plannedStart:"2026-11-26T16:00:00.000Z",plannedEnd:"2026-11-26T17:00:00.000Z"};
 assert.equal(validateMachineSchedule(operation,[],"",[repair],[]).reason,"machine-maintenance-conflict");
 assert.equal(validateMachineMaintenanceWindow("m1","2026-11-26T16:00:00.000Z","2026-11-26T17:00:00.000Z",[],[repair],[]).reason,"maintenance-conflict");
});
test("critical maintenance work takes precedence over high priority in availability details",()=>{
 const orders=[
  {id:"wo-high",machineId:"m1",status:"In progress",priority:"High",actualStart:"2026-11-26T12:00:00.000Z"},
  {id:"wo-critical",machineId:"m1",status:"In progress",priority:"Critical",actualStart:"2026-11-26T12:30:00.000Z"}
 ];
 const result=getMachineAvailability(machine,orders,[],"2026-11-26T16:30:00.000Z");
 assert.equal(result.activeWorkOrder.id,"wo-critical");
});
