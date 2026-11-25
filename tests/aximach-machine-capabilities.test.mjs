import test from "node:test";
import assert from "node:assert/strict";
import { getEligibleMachineAssets, validateMachineAssignment } from "../src/machineCapabilities.mjs";

const machines=[
 {id:"m1",companyId:"c1",factoryId:"f1",assetCode:"VMC-01",name:"VMC 01",machineType:"VMC",processDefinitionIds:["vmc"],status:"Available"},
 {id:"m2",companyId:"c1",factoryId:"f1",assetCode:"TURN-01",name:"Turn 01",machineType:"CNC Turning",processDefinitionIds:["turn"],status:"Available"},
 {id:"m3",companyId:"c2",factoryId:"f2",assetCode:"VMC-02",name:"VMC 02",machineType:"VMC",processDefinitionIds:["vmc"],status:"Available"},
 {id:"m4",companyId:"c1",factoryId:"f1",assetCode:"VMC-03",name:"VMC 03",machineType:"VMC",processDefinitionIds:[],status:"Available"},
 {id:"m5",companyId:"c1",factoryId:"f1",assetCode:"VMC-04",name:"VMC 04",machineType:"VMC",processDefinitionIds:["vmc"],status:"Under maintenance"},
 {id:"m6",companyId:"c1",factoryId:"f1",assetCode:"VMC-05",name:"VMC 05",machineType:"VMC",processDefinitionIds:["vmc"],status:"Running"}
];

test("eligible machine assets are scoped to the selected company and factory",()=>{
 assert.deepEqual(getEligibleMachineAssets(machines,{companyId:"c1",factoryId:"f1"}).map(m=>m.id),["m2","m1","m4"]);
});
test("eligible machine assets filter by stable Process Directory definition IDs",()=>{
 assert.deepEqual(getEligibleMachineAssets(machines,{companyId:"c1",factoryId:"f1",processDefinitionId:"vmc"}).map(m=>m.id),["m1","m4"]);
});
test("unmapped machine capabilities are treated as general-purpose rather than a false mismatch",()=>{
 assert.deepEqual(getEligibleMachineAssets(machines,{companyId:"c1",factoryId:"f1",processDefinitionId:"vmc"}).map(m=>m.id),["m1","m4"]);
});
test("machines under maintenance are not offered for new assignments",()=>{
 assert.ok(!getEligibleMachineAssets(machines,{companyId:"c1",factoryId:"f1"}).some(m=>m.id==="m5"));
});
test("a currently assigned running machine remains visible for editing its operation",()=>{
 assert.ok(getEligibleMachineAssets(machines,{companyId:"c1",factoryId:"f1",processDefinitionId:"vmc",selectedMachineId:"m6"}).some(m=>m.id==="m6"));
});
test("machine assignment rejects a machine from another company or factory",()=>{
 assert.equal(validateMachineAssignment(machines[2],{machineId:"m3",companyId:"c1",factoryId:"f1",executionType:"Internal"}).reason,"company-mismatch");
 assert.equal(validateMachineAssignment(machines[0],{machineId:"m1",companyId:"c1",factoryId:"f2",executionType:"Internal"}).reason,"factory-mismatch");
});
test("machine assignment rejects outsourced operations and incompatible process definitions",()=>{
 assert.equal(validateMachineAssignment(machines[0],{machineId:"m1",companyId:"c1",factoryId:"f1",executionType:"Outsourced"}).reason,"outsourced-operation");
 assert.equal(validateMachineAssignment(machines[0],{machineId:"m1",companyId:"c1",factoryId:"f1",processDefinitionId:"turn",executionType:"Internal"}).reason,"process-capability-mismatch");
});
test("machine assignment accepts an available matching internal machine and its existing running assignment",()=>{
 assert.deepEqual(validateMachineAssignment(machines[0],{machineId:"m1",companyId:"c1",factoryId:"f1",processDefinitionId:"vmc",executionType:"Internal"}),{ok:true,reason:""});
 assert.deepEqual(validateMachineAssignment(machines[5],{machineId:"m6",existingMachineId:"m6",companyId:"c1",factoryId:"f1",processDefinitionId:"vmc",executionType:"Internal"}),{ok:true,reason:""});
});
