import test from "node:test";
import assert from "node:assert/strict";
import {getEligibleToolingAssets,getEligibleFixtureAssets,validateOperationResourceAssignments,applyResourceUsageEvent} from "../src/manufacturingResourceCompatibility.mjs";
const tooling=[
 {id:"t1",companyId:"c1",factoryId:"f1",assetCode:"EM-10",status:"Available",compatibleMachineIds:["m1"],machineTypeCapabilities:["VMC"],processDefinitionIds:["vmc"],materialCapabilities:["EN24"],toolLifeLimitMinutes:100,toolLifeUsedMinutes:20,toolLifeLimitCycles:1000,toolLifeUsedCycles:120,inspectionDueAt:"2026-12-01"},
 {id:"t2",companyId:"c2",factoryId:"f2",assetCode:"EM-11",status:"Available",processDefinitionIds:["vmc"],toolLifeLimitMinutes:100,toolLifeUsedMinutes:0},
 {id:"t3",companyId:"c1",factoryId:"f1",assetCode:"EM-12",status:"Needs regrind",processDefinitionIds:["vmc"],toolLifeLimitMinutes:100,toolLifeUsedMinutes:100},
 {id:"t4",companyId:"c1",factoryId:"f1",assetCode:"EM-13",status:"Available",processDefinitionIds:["turn"],toolLifeLimitMinutes:100,toolLifeUsedMinutes:0},
 {id:"t5",companyId:"c1",factoryId:"f1",assetCode:"EM-14",status:"Available",processDefinitionIds:["vmc"],toolLifeLimitMinutes:100,toolLifeUsedMinutes:0,inspectionDueAt:"2020-01-01"}
];
const fixtures=[
 {id:"f1",companyId:"c1",factoryId:"f1",assetCode:"FIX-01",status:"Available",compatibleMachineIds:["m1"],processDefinitionIds:["vmc"],componentIds:["cpt1"],usageCycles:10,maxUsageCycles:100,inspectionDueAt:"2026-12-01"},
 {id:"f2",companyId:"c1",factoryId:"f1",assetCode:"FIX-02",status:"Available",componentIds:["other"],usageCycles:0},
 {id:"f3",companyId:"c1",factoryId:"f1",assetCode:"FIX-03",status:"Under maintenance",usageCycles:0}
];
test("tooling eligibility filters company, factory, machine, process, material, life and inspection",()=>{
 assert.deepEqual(getEligibleToolingAssets(tooling,{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24"}).map(x=>x.id),["t1"]);
});
test("fixtures require the same scope, compatible machine, process, component and inspection status",()=>{
 assert.deepEqual(getEligibleFixtureAssets(fixtures,{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",componentId:"cpt1"}).map(x=>x.id),["f1"]);
});
test("operation resource assignments reject duplicate or incompatible resource IDs",()=>{
 assert.equal(validateOperationResourceAssignments({toolingIds:["t1","t1"],toolingAssets:tooling,scope:{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24"}}).reason,"duplicate-or-invalid-resource-id");
 assert.equal(validateOperationResourceAssignments({toolingIds:["t4"],toolingAssets:tooling,scope:{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24"}}).ok,false);
});
test("tool usage consumes life exactly once per recorded production event and forces regrind at limit",()=>{
 const updated=applyResourceUsageEvent(tooling[0],{resourceType:"tooling",eventType:"Production use",runtimeMinutes:80,cycles:900,occurredAt:"2026-11-25T12:00:00.000Z"});
 assert.equal(updated.toolLifeUsedMinutes,100);assert.equal(updated.toolLifeUsedCycles,1020);assert.equal(updated.status,"Needs regrind");
});
test("regrind increments the regrind counter and resets current life; over-limit regrind is rejected",()=>{
 const asset={...tooling[0],status:"Needs regrind",regrindCount:1,maxRegrinds:2,toolLifeUsedMinutes:100,toolLifeUsedCycles:1000};
 const updated=applyResourceUsageEvent(asset,{resourceType:"tooling",eventType:"Regrind",runtimeMinutes:0,cycles:0,occurredAt:"2026-11-25T12:00:00.000Z"});
 assert.equal(updated.regrindCount,2);assert.equal(updated.toolLifeUsedMinutes,0);assert.equal(updated.status,"Available");
 assert.throws(()=>applyResourceUsageEvent({...asset,regrindCount:2},{resourceType:"tooling",eventType:"Regrind",runtimeMinutes:0,cycles:0}));
 assert.throws(()=>applyResourceUsageEvent({...asset,status:"Available"},{resourceType:"tooling",eventType:"Regrind",runtimeMinutes:0,cycles:0}),/Needs regrind/);
});
test("fixture use increments life cycles and inspection failure blocks the fixture",()=>{
 const used=applyResourceUsageEvent(fixtures[0],{resourceType:"fixture",eventType:"Production use",runtimeMinutes:10,cycles:20});
 assert.equal(used.usageCycles,30);
 const inspected=applyResourceUsageEvent(used,{resourceType:"fixture",eventType:"Inspection",runtimeMinutes:0,cycles:0,inspectionResult:"Fail",occurredAt:"2026-11-25T12:00:00.000Z"});
 assert.equal(inspected.status,"Under maintenance");
});
test("passed inspection can release a resource held for inspection and records the next due date",()=>{
 const updated=applyResourceUsageEvent({...fixtures[0],status:"Under maintenance"},{resourceType:"fixture",eventType:"Inspection",runtimeMinutes:0,cycles:0,inspectionResult:"Pass",inspectionDueAt:"2027-01-01",occurredAt:"2026-11-25T12:00:00.000Z"});
 assert.equal(updated.status,"Available");assert.equal(updated.inspectionDueAt,"2027-01-01");
});

test("existing in-use tooling and fixtures remain valid only for the operation that already holds them",()=>{
 const inUseTool={...tooling[0],status:"In use"};
 const inUseFixture={...fixtures[0],status:"In use"};
 const retained=validateOperationResourceAssignments({
  toolingIds:["t1"],fixtureIds:["f1"],toolingAssets:[inUseTool],fixtureAssets:[inUseFixture],
  scope:{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24",componentId:"cpt1",existingToolingIds:["t1"],existingFixtureIds:["f1"]}
 });
 assert.equal(retained.ok,true);
 const newOperation=validateOperationResourceAssignments({
  toolingIds:["t1"],fixtureIds:["f1"],toolingAssets:[inUseTool],fixtureAssets:[inUseFixture],
  scope:{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24",componentId:"cpt1"}
 });
 assert.equal(newOperation.ok,false);
});
 
test("restricted tooling is excluded when the selected operation has no known compatible material",()=>{
 const asset={...tooling[0],materialCapabilities:["EN24"]};
 assert.deepEqual(getEligibleToolingAssets([asset],{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc"}),[]);
});

test("existing operation retains its tool and fixture links after life or inspection quarantines the assets",()=>{
 const quarantinedTool={...tooling[0],status:"Needs regrind",toolLifeUsedMinutes:100,toolLifeUsedCycles:1000};
 const quarantinedFixture={...fixtures[0],status:"Under maintenance"};
 const retained=validateOperationResourceAssignments({
  toolingIds:["t1"],fixtureIds:["f1"],toolingAssets:[quarantinedTool],fixtureAssets:[quarantinedFixture],
  scope:{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24",componentId:"cpt1",existingToolingIds:["t1"],existingFixtureIds:["f1"]}
 });
 assert.equal(retained.ok,true);
 const newOperation=validateOperationResourceAssignments({
  toolingIds:["t1"],fixtureIds:["f1"],toolingAssets:[quarantinedTool],fixtureAssets:[quarantinedFixture],
  scope:{companyId:"c1",factoryId:"f1",machineId:"m1",machineType:"VMC",processDefinitionId:"vmc",material:"EN24",componentId:"cpt1"}
 });
 assert.equal(newOperation.ok,false);
});

test("resource usage events are idempotent by event ID and must match the selected asset",()=>{
 const event={id:"evt-duplicate",resourceId:"t1",resourceType:"tooling",eventType:"Production use",runtimeMinutes:10,cycles:0,occurredAt:"2026-11-25T12:00:00.000Z"};
 assert.throws(()=>applyResourceUsageEvent(tooling[0],event,[{id:"evt-duplicate"}]),/already been applied/);
 assert.throws(()=>applyResourceUsageEvent(tooling[0],{...event,id:"evt-other",resourceId:"another-tool"}),/does not match/);
 assert.throws(()=>applyResourceUsageEvent(tooling[0],{...event,id:"evt-invalid",eventType:"Unknown"}),/not valid/);
});
test("production usage requires measurable runtime or cycles and cannot continue after a life limit",()=>{
 assert.throws(()=>applyResourceUsageEvent(tooling[0],{resourceType:"tooling",eventType:"Production use",runtimeMinutes:0,cycles:0}),/positive runtime or production cycles/);
 assert.throws(()=>applyResourceUsageEvent({...tooling[0],toolLifeUsedMinutes:100},{resourceType:"tooling",eventType:"Production use",runtimeMinutes:1,cycles:0}),/life limit has already been reached/);
 assert.throws(()=>applyResourceUsageEvent({...fixtures[0],usageCycles:100},{resourceType:"fixture",eventType:"Production use",runtimeMinutes:30,cycles:1}),/usage limit has already been reached/);
 assert.throws(()=>applyResourceUsageEvent(fixtures[0],{resourceType:"fixture",eventType:"Production use",runtimeMinutes:30,cycles:0}),/positive production cycles/);
});
test("repair and inspection cannot bypass an exhausted tooling or fixture life limit",()=>{
 const exhaustedTool={...tooling[0],status:"Under maintenance",toolLifeUsedMinutes:100};
 const inspectedTool=applyResourceUsageEvent(exhaustedTool,{resourceType:"tooling",eventType:"Inspection",runtimeMinutes:0,cycles:0,inspectionResult:"Pass"});
 assert.equal(inspectedTool.status,"Needs regrind");
 assert.equal(applyResourceUsageEvent(exhaustedTool,{resourceType:"tooling",eventType:"Repair",runtimeMinutes:0,cycles:0}).status,"Needs regrind");
 const exhaustedFixture={...fixtures[0],status:"Under maintenance",usageCycles:100};
 assert.equal(applyResourceUsageEvent(exhaustedFixture,{resourceType:"fixture",eventType:"Inspection",runtimeMinutes:0,cycles:0,inspectionResult:"Pass"}).status,"Under maintenance");
 assert.equal(applyResourceUsageEvent(exhaustedFixture,{resourceType:"fixture",eventType:"Repair",runtimeMinutes:0,cycles:0}).status,"Under maintenance");
});
test("retired assets cannot be silently reactivated through inspection, repair or replacement",()=>{
 const retired={...tooling[0],status:"Retired"};
 for(const eventType of ["Inspection","Repair","Replacement"]){
  assert.throws(()=>applyResourceUsageEvent(retired,{resourceType:"tooling",eventType,runtimeMinutes:0,cycles:0,inspectionResult:"Pass"}),/Retired resources cannot be returned to service/);
 }
});
test("replacement resets expired resource life only after quarantine",()=>{
 const tool={...tooling[0],status:"Needs regrind",toolLifeUsedMinutes:100,toolLifeUsedCycles:1000,regrindCount:2};
 const replacedTool=applyResourceUsageEvent(tool,{resourceType:"tooling",eventType:"Replacement",runtimeMinutes:0,cycles:0});
 assert.equal(replacedTool.status,"Available");assert.equal(replacedTool.toolLifeUsedMinutes,0);assert.equal(replacedTool.regrindCount,0);
 const fixture={...fixtures[0],status:"Under maintenance",usageCycles:100};
 const replacedFixture=applyResourceUsageEvent(fixture,{resourceType:"fixture",eventType:"Replacement",runtimeMinutes:0,cycles:0});
 assert.equal(replacedFixture.status,"Available");assert.equal(replacedFixture.usageCycles,0);
 assert.throws(()=>applyResourceUsageEvent(fixtures[0],{resourceType:"fixture",eventType:"Replacement",runtimeMinutes:0,cycles:0}),/quarantined or life-expired/);
});
