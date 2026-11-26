import test from "node:test";
import assert from "node:assert/strict";
import { filterManufacturingData, validateManufacturingWrite } from "./tenant-scope.mjs";
const companyA={id:"company-a",name:"A"},companyB={id:"company-b",name:"B"};
const user={id:"user-a",role:"manager",companyIds:["company-a"],factoryIds:[]};
const customer=(id,ownerCompanyId)=>({id,ownerCompanyId,customerCode:id,legalName:id,displayName:id,currency:"INR",status:"Active"});
const prospect=(id,ownerCompanyId)=>({id,ownerCompanyId,businessName:id,stage:"New",evidence:[{
 id:"evidence-"+id,provider:"SearXNG",query:"industrial OEM buyers",sourceUrl:"https://example.com/"+id,
 sourceTitle:"Public company directory",snippet:"Public snippet",retrievedAt:"2026-11-22T08:00:00.000Z"
}]});
test("tenant-filtered manufacturing data returns only company-owned customers and prospects",()=>{
 const visible=filterManufacturingData({updatedAt:"2026-11-22T08:00:00.000Z",companies:[companyA,companyB],
  customers:[customer("customer-a","company-a"),customer("customer-b","company-b"),customer("legacy-customer",undefined)],
  prospects:[prospect("prospect-a","company-a"),prospect("prospect-b","company-b")]},user);
 assert.deepEqual(visible.customers.map(row=>row.id),["customer-a"]);
 assert.deepEqual(visible.prospects.map(row=>row.id),["prospect-a"]);
});
test("tenant user may add a prospect only for an assigned company",()=>{
 const data={companies:[companyA,companyB],customers:[],prospects:[]};
 assert.equal(validateManufacturingWrite(data,{customers:[],prospects:[prospect("prospect-a","company-a")]},user).ok,true);
 const denied=validateManufacturingWrite(data,{customers:[],prospects:[prospect("prospect-b","company-b")]},user);
 assert.equal(denied.ok,false);assert.match(denied.error,/prospects/);
});
test("tenant user may add customers only with an assigned owner company",()=>{
 const data={companies:[companyA,companyB],customers:[],prospects:[]};
 assert.equal(validateManufacturingWrite(data,{customers:[customer("customer-a","company-a")],prospects:[]},user).ok,true);
 assert.equal(validateManufacturingWrite(data,{customers:[customer("customer-b","company-b")],prospects:[]},user).ok,false);
 assert.equal(validateManufacturingWrite(data,{customers:[customer("customer-legacy",undefined)],prospects:[]},user).ok,false);
});

const factoryA={id:"factory-a",companyId:"company-a",name:"A Factory"};
const factoryB={id:"factory-b",companyId:"company-b",name:"B Factory"};
const machineA={
 id:"machine-a",companyId:"company-a",factoryId:"factory-a",assetCode:"VMC-01",
 name:"Vertical machining centre 01",machineType:"VMC",manufacturer:"Example",
 model:"VMC-850",serialNumber:"SN-A1",controller:"Fanuc",axisCount:3,
 processDefinitionIds:["process-vmc"],materialCapabilities:["Aluminium","EN24"],
 status:"Available",notes:"Company A asset",createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const machineB={...machineA,id:"machine-b",companyId:"company-b",factoryId:"factory-b",assetCode:"VMC-01",name:"Company B VMC"};
const processDefinition={id:"process-vmc",processType:"VMC machining",category:"Machining",subcategories:[],vendorIds:[],notes:"Shared process master"};
test("tenant-filtered manufacturing data exposes only machine assets belonging to assigned company and factory",()=>{
 const visible=filterManufacturingData({
  companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[machineA,machineB]
 },user);
 assert.deepEqual(visible.machines.map(row=>row.id),["machine-a"]);
});
test("tenant user can add only machine assets in an assigned company and its own factory",()=>{
 const data={companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[],processDefinitions:[processDefinition]};
 assert.equal(validateManufacturingWrite(data,{machines:[machineA]},user).ok,true);
 assert.equal(validateManufacturingWrite(data,{machines:[machineB]},user).ok,false);
 assert.equal(validateManufacturingWrite(data,{machines:[{...machineA,id:"machine-wrong-factory",factoryId:"factory-b"}]},user).ok,false);
});
test("machine asset codes must be unique within a company",()=>{
 const duplicate={...machineA,id:"machine-a-duplicate"};
 const result=validateManufacturingWrite(
  {companies:[companyA],factories:[factoryA],machines:[],processDefinitions:[processDefinition]},
  {machines:[machineA,duplicate]},user
 );
 assert.equal(result.ok,false);
 assert.match(result.error,/machines/);
});
test("production operations can link only to a same-company same-factory machine with a matching process capability",()=>{
 const component={id:"component-a",companyId:"company-a",partNumber:"A-01"};
 const po={id:"po-a",number:"PO-A",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-a",componentId:"component-a"}]};
 const base={companies:[companyA],factories:[factoryA],components:[component],purchaseOrders:[po],machines:[machineA],processDefinitions:[processDefinition],operations:[]};
 const operation={id:"operation-a",poId:"po-a",poLineId:"line-a",componentId:"component-a",machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",vendorId:"",transportVendorId:"",status:"Planned"};
 assert.equal(validateManufacturingWrite(base,{operations:[operation]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operation,executionType:"Outsourced"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operation,processDefinitionId:"process-turning"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operation,machineId:"machine-b"}]},user).ok,false);
});

test("server rejects overlapping internal operation reservations on the same registered machine",()=>{
 const component={id:"component-schedule",companyId:"company-a",partNumber:"SCHEDULE-01"};
 const po={id:"po-schedule",number:"PO-SCHEDULE",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-schedule",componentId:"component-schedule"}]};
 const existing={id:"operation-existing",poId:"po-schedule",poLineId:"line-schedule",componentId:"component-schedule",machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",status:"Planned",vendorId:"",transportVendorId:"",plannedStart:"2026-11-26T09:00:00",plannedEnd:"2026-11-26T11:00:00"};
 const candidate={...existing,id:"operation-new",plannedStart:"2026-11-26T10:30:00",plannedEnd:"2026-11-26T12:00:00"};
 const base={companies:[companyA],factories:[factoryA],components:[component],purchaseOrders:[po],machines:[machineA],processDefinitions:[processDefinition],operations:[existing]};
 const result=validateManufacturingWrite(base,{operations:[candidate]},user);
 assert.equal(result.ok,false);
 assert.match(result.error,/operations/);
});
test("server allows back-to-back machine reservations and ignores completed operations",()=>{
 const component={id:"component-schedule",companyId:"company-a",partNumber:"SCHEDULE-01"};
 const po={id:"po-schedule",number:"PO-SCHEDULE",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-schedule",componentId:"component-schedule"}]};
 const existing={id:"operation-existing",poId:"po-schedule",poLineId:"line-schedule",componentId:"component-schedule",machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",status:"Planned",vendorId:"",transportVendorId:"",plannedStart:"2026-11-26T09:00:00",plannedEnd:"2026-11-26T11:00:00"};
 const base={companies:[companyA],factories:[factoryA],components:[component],purchaseOrders:[po],machines:[machineA],processDefinitions:[processDefinition],operations:[existing]};
 const backToBack={...existing,id:"operation-next",plannedStart:"2026-11-26T11:00:00",plannedEnd:"2026-11-26T12:00:00"};
 assert.equal(validateManufacturingWrite(base,{operations:[backToBack]},user).ok,true);
 const completedOverlap={...existing,id:"operation-complete",status:"Complete",plannedStart:"2026-11-26T09:30:00",plannedEnd:"2026-11-26T10:30:00"};
 const baseWithCompleted={...base,operations:[{...existing,status:"Complete"},]};
 assert.equal(validateManufacturingWrite(baseWithCompleted,{operations:[completedOverlap]},user).ok,true);
});

const maintenancePlanA={
 id:"maintenance-plan-a",companyId:"company-a",factoryId:"factory-a",machineId:"machine-a",
 planName:"Quarterly spindle inspection",maintenanceType:"Preventive",frequencyValue:3,frequencyUnit:"Months",
 lastCompletedAt:"2026-09-01",nextDueAt:"2026-12-01",estimatedDurationHours:2,
 checklist:["Check spindle runout","Inspect lubrication"],assignedTo:"Maintenance team",active:true,notes:"",
 createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const maintenanceWorkOrderA={
 id:"maintenance-wo-a",companyId:"company-a",factoryId:"factory-a",machineId:"machine-a",planId:"maintenance-plan-a",
 workOrderNumber:"MWO-20261126-001",workType:"Preventive",priority:"Normal",status:"Planned",
 title:"Quarterly spindle inspection",reportedAt:"2026-11-25T08:00:00.000Z",
 scheduledStart:"2026-11-26T12:00:00.000Z",scheduledEnd:"2026-11-26T14:00:00.000Z",
 actualStart:"",actualEnd:"",symptom:"",rootCause:"",actionTaken:"",technician:"Maintenance team",
 estimatedCost:2500,actualCost:0,notes:"",createdAt:"2026-11-25T08:00:00.000Z",updatedAt:"2026-11-25T08:00:00.000Z"
};
const downtimeA={
 id:"downtime-a",companyId:"company-a",factoryId:"factory-a",machineId:"machine-a",
 downtimeType:"Unplanned breakdown",startedAt:"2026-11-26T15:00:00.000Z",endedAt:"",
 reason:"Spindle drive fault",productionImpactQty:25,recordedBy:"Shift supervisor",notes:"",
 createdAt:"2026-11-26T15:00:00.000Z",updatedAt:"2026-11-26T15:00:00.000Z"
};
test("tenant filtering returns maintenance plans, work orders and downtime only for assigned machine assets",()=>{
 const foreignMachine={...machineB};
 const visible=filterManufacturingData({
  companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[machineA,foreignMachine],
  maintenancePlans:[maintenancePlanA,{...maintenancePlanA,id:"maintenance-plan-b",companyId:"company-b",factoryId:"factory-b",machineId:"machine-b"}],
  maintenanceWorkOrders:[maintenanceWorkOrderA,{...maintenanceWorkOrderA,id:"maintenance-wo-b",companyId:"company-b",factoryId:"factory-b",machineId:"machine-b"}],
  machineDowntime:[downtimeA,{...downtimeA,id:"downtime-b",companyId:"company-b",factoryId:"factory-b",machineId:"machine-b"}]
 },user);
 assert.deepEqual(visible.maintenancePlans.map(row=>row.id),["maintenance-plan-a"]);
 assert.deepEqual(visible.maintenanceWorkOrders.map(row=>row.id),["maintenance-wo-a"]);
 assert.deepEqual(visible.machineDowntime.map(row=>row.id),["downtime-a"]);
});
test("tenant can add a maintenance plan and work order only for a machine owned by its assigned company and factory",()=>{
 const base={companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[machineA,machineB],maintenancePlans:[],maintenanceWorkOrders:[],machineDowntime:[]};
 assert.equal(validateManufacturingWrite(base,{maintenancePlans:[maintenancePlanA]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{maintenancePlans:[{...maintenancePlanA,id:"foreign-plan",companyId:"company-b",factoryId:"factory-b",machineId:"machine-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite({...base,maintenancePlans:[maintenancePlanA]},{maintenanceWorkOrders:[maintenanceWorkOrderA]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{maintenanceWorkOrders:[{...maintenanceWorkOrderA,id:"foreign-wo",companyId:"company-b",factoryId:"factory-b",machineId:"machine-b"}]},user).ok,false);
});
test("server rejects a planned maintenance work order that overlaps an active production operation",()=>{
 const component={id:"component-maintenance",companyId:"company-a",partNumber:"MAINT-01"};
 const po={id:"po-maintenance",number:"PO-MAINT",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-maintenance",componentId:"component-maintenance"}]};
 const operation={id:"operation-maintenance",poId:po.id,poLineId:"line-maintenance",componentId:component.id,machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",status:"Planned",vendorId:"",transportVendorId:"",plannedStart:"2026-11-26T13:00:00.000Z",plannedEnd:"2026-11-26T15:00:00.000Z"};
 const base={companies:[companyA],factories:[factoryA],components:[component],purchaseOrders:[po],machines:[machineA],processDefinitions:[processDefinition],operations:[operation],maintenancePlans:[maintenancePlanA],maintenanceWorkOrders:[],machineDowntime:[]};
 const result=validateManufacturingWrite(base,{maintenanceWorkOrders:[maintenanceWorkOrderA]},user);
 assert.equal(result.ok,false);
 assert.match(result.error,/maintenanceWorkOrders/);
});
test("server blocks production reservations overlapping a maintenance work order or open downtime",()=>{
 const component={id:"component-maintenance",companyId:"company-a",partNumber:"MAINT-01"};
 const po={id:"po-maintenance",number:"PO-MAINT",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-maintenance",componentId:component.id}]};
 const base={companies:[companyA],factories:[factoryA],components:[component],purchaseOrders:[po],machines:[machineA],processDefinitions:[processDefinition],operations:[],maintenancePlans:[maintenancePlanA],maintenanceWorkOrders:[maintenanceWorkOrderA],machineDowntime:[downtimeA]};
 const operation={id:"operation-maintenance",poId:po.id,poLineId:"line-maintenance",componentId:component.id,machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",status:"Planned",vendorId:"",transportVendorId:"",plannedStart:"2026-11-26T13:00:00.000Z",plannedEnd:"2026-11-26T15:00:00.000Z"};
 assert.equal(validateManufacturingWrite(base,{operations:[operation]},user).ok,false);
 const downtimeOverlap={...operation,id:"operation-downtime",plannedStart:"2026-11-26T15:30:00.000Z",plannedEnd:"2026-11-26T16:30:00.000Z"};
 assert.equal(validateManufacturingWrite({...base,maintenanceWorkOrders:[]},{operations:[downtimeOverlap]},user).ok,false);
});
test("server rejects downtime events without valid machine ownership or positive interval",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],maintenanceWorkOrders:[],machineDowntime:[]};
 assert.equal(validateManufacturingWrite(base,{machineDowntime:[downtimeA]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{machineDowntime:[{...downtimeA,id:"bad-downtime",factoryId:"factory-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{machineDowntime:[{...downtimeA,id:"bad-time",endedAt:"2026-11-26T14:00:00.000Z"}]},user).ok,false);
});

const toolingA={
 id:"tooling-a",companyId:"company-a",factoryId:"factory-a",assetCode:"EM-10",name:"10 mm carbide end mill",toolType:"Solid carbide end mill",
 compatibleMachineIds:["machine-a"],machineTypeCapabilities:["VMC"],processDefinitionIds:["process-vmc"],materialCapabilities:["EN24"],
 toolLifeLimitMinutes:100,toolLifeUsedMinutes:20,toolLifeLimitCycles:1000,toolLifeUsedCycles:100,regrindCount:0,maxRegrinds:3,
 status:"Available",inspectionDueAt:"2026-12-20",storageLocation:"Tool crib",notes:"",createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const toolingB={...toolingA,id:"tooling-b",companyId:"company-b",factoryId:"factory-b",assetCode:"EM-10"};
const fixtureA={
 id:"fixture-a",companyId:"company-a",factoryId:"factory-a",assetCode:"FIX-01",name:"Spindle sleeve fixture",fixtureType:"Dedicated fixture",
 compatibleMachineIds:["machine-a"],machineTypeCapabilities:["VMC"],processDefinitionIds:["process-vmc"],componentIds:["component-resource"],
 usageCycles:20,maxUsageCycles:500,status:"Available",inspectionDueAt:"2026-12-20",storageLocation:"Fixture rack",setupNotes:"Datum A/B",notes:"",
 createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const componentResource={id:"component-resource",companyId:"company-a",partNumber:"RESOURCE-01",material:"EN24"};
const poResource={id:"po-resource",number:"PO-RESOURCE",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-resource",componentId:"component-resource"}]};
const operationResource={
 id:"operation-resource",poId:"po-resource",poLineId:"line-resource",componentId:"component-resource",machineId:"machine-a",
 processDefinitionId:"process-vmc",executionType:"Internal",status:"Planned",vendorId:"",transportVendorId:"",
 plannedStart:"2026-11-26T09:00:00.000Z",plannedEnd:"2026-11-26T11:00:00.000Z",
 toolingAssetIds:["tooling-a"],fixtureAssetIds:["fixture-a"]
};
test("tenant visibility and write validation scope tooling and fixture assets to their owning factory",()=>{
 const visible=filterManufacturingData({companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[machineA,machineB],toolingAssets:[toolingA,toolingB],fixtureAssets:[fixtureA]},user);
 assert.deepEqual(visible.toolingAssets.map(row=>row.id),["tooling-a"]);
 assert.deepEqual(visible.fixtureAssets.map(row=>row.id),["fixture-a"]);
 const base={companies:[companyA,companyB],factories:[factoryA,factoryB],machines:[machineA,machineB],processDefinitions:[processDefinition],components:[componentResource],toolingAssets:[],fixtureAssets:[]};
 assert.equal(validateManufacturingWrite(base,{toolingAssets:[toolingA],fixtureAssets:[fixtureA]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{toolingAssets:[toolingB]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{fixtureAssets:[{...fixtureA,id:"wrong-factory",factoryId:"factory-b"}]},user).ok,false);
});
test("tooling and fixture asset codes must be unique within their company",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],toolingAssets:[],fixtureAssets:[]};
 assert.equal(validateManufacturingWrite(base,{toolingAssets:[toolingA,{...toolingA,id:"tooling-duplicate"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{fixtureAssets:[fixtureA,{...fixtureA,id:"fixture-duplicate"}]},user).ok,false);
});
test("production operations may only reserve tooling and fixtures compatible with their machine, process, material and component",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],purchaseOrders:[poResource],toolingAssets:[toolingA],fixtureAssets:[fixtureA],operations:[]};
 assert.equal(validateManufacturingWrite(base,{operations:[operationResource]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operationResource,id:"bad-process",processDefinitionId:"process-turning"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operationResource,id:"bad-machine",machineId:"machine-other"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operationResource,id:"bad-material",toolingAssetIds:[] ,fixtureAssetIds:["fixture-a"],componentId:"component-other"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{operations:[{...operationResource,id:"outsourced-resource",executionType:"Outsourced"}]},user).ok,false);
});
test("server prevents overlapping reservations of the same tool or fixture across active operations",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],purchaseOrders:[poResource],toolingAssets:[toolingA],fixtureAssets:[fixtureA],operations:[operationResource]};
 const overlap={...operationResource,id:"operation-resource-overlap",plannedStart:"2026-11-26T10:30:00.000Z",plannedEnd:"2026-11-26T12:00:00.000Z"};
 assert.equal(validateManufacturingWrite(base,{operations:[overlap]},user).ok,false);
 const backToBack={...operationResource,id:"operation-resource-next",plannedStart:"2026-11-26T11:00:00.000Z",plannedEnd:"2026-11-26T12:00:00.000Z"};
 assert.equal(validateManufacturingWrite(base,{operations:[backToBack]},user).ok,true);
});
test("resource usage events must reference a same-company asset and an operation that already reserves it",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],purchaseOrders:[poResource],toolingAssets:[toolingA],fixtureAssets:[fixtureA],operations:[operationResource],resourceUsageEvents:[]};
 const event={id:"tool-event-a",companyId:"company-a",factoryId:"factory-a",resourceType:"tooling",resourceId:"tooling-a",operationId:"operation-resource",eventType:"Production use",runtimeMinutes:30,cycles:10,occurredAt:"2026-11-26T10:00:00.000Z",notes:""};
 assert.equal(validateManufacturingWrite(base,{resourceUsageEvents:[event]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{resourceUsageEvents:[{...event,id:"bad-tool-event",resourceId:"tooling-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{resourceUsageEvents:[{...event,id:"wrong-operation-event",operationId:"missing"}]},user).ok,false);
});

test("tooling and fixture reservations require a valid operation schedule window",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],purchaseOrders:[poResource],toolingAssets:[toolingA],fixtureAssets:[fixtureA],operations:[]};
 const unscheduled={...operationResource,id:"unscheduled-resource"};
 delete unscheduled.plannedStart;
 delete unscheduled.plannedEnd;
 assert.equal(validateManufacturingWrite(base,{operations:[unscheduled]},user).ok,false);
 const invalidRange={...operationResource,id:"invalid-resource-window",plannedStart:"2026-11-26T11:00:00.000Z",plannedEnd:"2026-11-26T10:00:00.000Z"};
 assert.equal(validateManufacturingWrite(base,{operations:[invalidRange]},user).ok,false);
});
test("recorded tool usage may exceed nominal life only when the tool is quarantined as Needs regrind",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],toolingAssets:[toolingA],fixtureAssets:[]};
 const overLimit={...toolingA,toolLifeUsedMinutes:110,toolLifeUsedCycles:1100,status:"Needs regrind"};
 assert.equal(validateManufacturingWrite(base,{toolingAssets:[overLimit]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{toolingAssets:[{...overLimit,status:"Available"}]},user).ok,false);
});

test("an existing operation keeps its historical tool and fixture links after quarantine, but a new reservation is blocked",()=>{
 const base={companies:[companyA],factories:[factoryA],machines:[machineA],processDefinitions:[processDefinition],components:[componentResource],purchaseOrders:[poResource],toolingAssets:[toolingA],fixtureAssets:[fixtureA],operations:[operationResource]};
 const quarantinedTool={...toolingA,toolLifeUsedMinutes:110,toolLifeUsedCycles:1100,status:"Needs regrind"};
 const quarantinedFixture={...fixtureA,status:"Under maintenance"};
 assert.equal(validateManufacturingWrite(base,{toolingAssets:[quarantinedTool],fixtureAssets:[quarantinedFixture],operations:[operationResource]},user).ok,true);
 const nextOperation={...operationResource,id:"operation-resource-next",toolingAssetIds:["tooling-a"],fixtureAssetIds:["fixture-a"],plannedStart:"2026-11-26T11:00:00.000Z",plannedEnd:"2026-11-26T12:00:00.000Z"};
 assert.equal(validateManufacturingWrite({...base,toolingAssets:[quarantinedTool],fixtureAssets:[quarantinedFixture]},{operations:[nextOperation]},user).ok,false);
});

const consumptionComponent={id:"component-consumption",companyId:"company-a",partNumber:"CONS-01",revision:"B"};
const consumptionPO={id:"po-consumption",number:"PO-CONS",companyId:"company-a",factoryId:"factory-a",lines:[{id:"line-consumption",componentId:"component-consumption",quantity:10}]};
const consumptionOperation={id:"operation-consumption",poId:"po-consumption",poLineId:"line-consumption",componentId:"component-consumption",executionType:"Internal",status:"Planned"};
const consumptionMaterial={id:"material-consumption",code:"EN8",name:"EN8 steel",grade:"EN8",unit:"kg"};
const consumptionBom={id:"bom-consumption",componentId:"component-consumption",materialId:"material-consumption",revision:"B",quantityPerPart:1,scrapPercent:5};
const consumptionIssue={id:"issue-consumption",itemType:"material",itemId:"material-consumption",transactionType:"Issue to production",direction:"out",quantity:50,companyId:"company-a",factoryId:"factory-a",poId:"po-consumption",poLineId:"line-consumption",operationId:"operation-consumption"};
const materialConsumptionRecord={
 id:"material-use-1",companyId:"company-a",factoryId:"factory-a",poId:"po-consumption",poLineId:"line-consumption",
 componentId:"component-consumption",partId:"",bomLineId:"bom-consumption",materialId:"material-consumption",operationId:"operation-consumption",
 unit:"kg",plannedQuantity:10.5,issuedQuantityAtRecord:50,consumedQuantity:9,scrapQuantity:1,returnedQuantity:0,
 sourceMaterialProcessLinkIds:[],occurredAt:"2026-11-26T06:00:00.000Z",reference:"ISSUE-SLIP-01",recordedBy:"Operator A",notes:"Turning scrap",
 createdAt:"2026-11-26T06:00:00.000Z",updatedAt:"2026-11-26T06:00:00.000Z"
};
test("tenant reads expose only material consumption with matching company, factory, PO line, BOM and operation",()=>{
 const componentB={id:"component-consumption-b",companyId:"company-b",partNumber:"CONS-B"};
 const poB={id:"po-consumption-b",number:"PO-CONS-B",companyId:"company-b",factoryId:"factory-b",lines:[{id:"line-consumption-b",componentId:componentB.id}]};
 const opB={...consumptionOperation,id:"operation-consumption-b",poId:poB.id,poLineId:"line-consumption-b",componentId:componentB.id};
 const bomB={...consumptionBom,id:"bom-consumption-b",componentId:componentB.id};
 const materialB={...consumptionMaterial,id:"material-consumption-b"};
 const rowB={...materialConsumptionRecord,id:"material-use-b",companyId:"company-b",factoryId:"factory-b",poId:poB.id,poLineId:"line-consumption-b",componentId:componentB.id,bomLineId:bomB.id,materialId:materialB.id,operationId:opB.id};
 const visible=filterManufacturingData({
  companies:[companyA,companyB],factories:[factoryA,factoryB],components:[consumptionComponent,componentB],
  purchaseOrders:[consumptionPO,poB],operations:[consumptionOperation,opB],materials:[consumptionMaterial,materialB],
  bomLines:[consumptionBom,bomB],inventoryTransactions:[consumptionIssue],
  materialConsumptions:[materialConsumptionRecord,rowB]
 },user);
 assert.deepEqual(visible.materialConsumptions.map(row=>row.id),["material-use-1"]);
});
test("tenant writes accept exact actual material consumption linked to issued stock and reject foreign or mismatched links",()=>{
 const base={
  companies:[companyA],factories:[factoryA],components:[consumptionComponent],purchaseOrders:[consumptionPO],
  operations:[consumptionOperation],materials:[consumptionMaterial],bomLines:[consumptionBom],
  inventoryTransactions:[consumptionIssue],materialProcessLinks:[],materialConsumptions:[]
 };
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[materialConsumptionRecord]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[{...materialConsumptionRecord,id:"wrong-company",companyId:"company-b",factoryId:"factory-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[{...materialConsumptionRecord,id:"wrong-factory",factoryId:"factory-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[{...materialConsumptionRecord,id:"wrong-operation",operationId:"operation-other"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[{...materialConsumptionRecord,id:"wrong-bom",bomLineId:"bom-other"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[{...materialConsumptionRecord,id:"over-issue",consumedQuantity:49,scrapQuantity:0,returnedQuantity:2}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[{...materialConsumptionRecord,id:"scrap-over-use",consumedQuantity:1,scrapQuantity:2}]},user).ok,false);
});
test("returned material requires exactly one matching append-only stock return transaction",()=>{
 const base={
  companies:[companyA],factories:[factoryA],components:[consumptionComponent],purchaseOrders:[consumptionPO],
  operations:[consumptionOperation],materials:[consumptionMaterial],bomLines:[consumptionBom],
  inventoryTransactions:[consumptionIssue],materialProcessLinks:[],materialConsumptions:[]
 };
 const record={...materialConsumptionRecord,id:"material-use-return",consumedQuantity:8,scrapQuantity:1,returnedQuantity:2};
 const returnTransaction={
  id:"return-consumption",itemType:"material",itemId:"material-consumption",transactionType:"Return",direction:"in",quantity:2,
  occurredAt:record.occurredAt,reference:"MATERIAL RETURN · "+record.reference,notes:"Returned from process",
  companyId:record.companyId,factoryId:record.factoryId,poId:record.poId,poLineId:record.poLineId,operationId:record.operationId,
  vendorId:"",reversalOfId:"",sourceConsumptionId:record.id,createdAt:record.createdAt,createdBy:"AXIMACH"
 };
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[record],inventoryTransactions:[returnTransaction]},user).ok,true);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[record],inventoryTransactions:[]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[record],inventoryTransactions:[returnTransaction,{...returnTransaction,id:"return-duplicate"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{materialConsumptions:[record],inventoryTransactions:[{...returnTransaction,poLineId:"other-line"}]},user).ok,false);
});

const productionOperatorA={
 id:"operator-a",companyId:"company-a",factoryId:"factory-a",employeeCode:"OP-A01",displayName:"Operator A",
 role:"VMC operator",processDefinitionIds:["process-vmc"],machineTypeCapabilities:["VMC"],
 status:"Active",notes:"",createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const productionOperationA={
 id:"production-operation-a",poId:"production-po-a",poLineId:"production-line-a",componentId:"production-component-a",
 machineId:"machine-a",processDefinitionId:"process-vmc",executionType:"Internal",status:"Planned",
 quantity:100,plannedStart:"2026-11-26T08:00:00.000Z",plannedEnd:"2026-11-26T18:00:00.000Z",
 vendorId:"",transportVendorId:""
};
const productionComponentA={id:"production-component-a",companyId:"company-a",partNumber:"PROD-01"};
const productionPOA={id:"production-po-a",number:"PO-PROD-A",companyId:"company-a",factoryId:"factory-a",lines:[{id:"production-line-a",componentId:"production-component-a",quantity:100}]};
const productionAssignmentA={
 id:"production-assignment-a",companyId:"company-a",factoryId:"factory-a",poId:"production-po-a",poLineId:"production-line-a",
 componentId:"production-component-a",operationId:"production-operation-a",machineId:"machine-a",
 operatorId:"operator-a",operatorCode:"OP-A01",operatorName:"Operator A",shiftCode:"A",shiftName:"Day Shift",
 plannedStart:"2026-11-26T08:00:00.000Z",plannedEnd:"2026-11-26T12:00:00.000Z",
 actualStart:"",actualEnd:"",targetQuantity:60,status:"Assigned",notes:"",
 createdAt:"2026-11-20T08:00:00.000Z",updatedAt:"2026-11-20T08:00:00.000Z"
};
const productionBase={
 companies:[companyA],factories:[factoryA],components:[productionComponentA],purchaseOrders:[productionPOA],
 machines:[machineA],processDefinitions:[processDefinition],operations:[productionOperationA],
 productionOperators:[],productionAssignments:[]
};
test("tenant reads expose only production operators and shift assignments owned by the assigned company and factory",()=>{
 const foreignOperator={...productionOperatorA,id:"operator-b",companyId:"company-b",factoryId:"factory-b",employeeCode:"OP-B01"};
 const foreignComponent={...productionComponentA,id:"production-component-b",companyId:"company-b"};
 const foreignPO={...productionPOA,id:"production-po-b",number:"PO-PROD-B",companyId:"company-b",factoryId:"factory-b",lines:[{id:"production-line-b",componentId:foreignComponent.id,quantity:100}]};
 const foreignOperation={...productionOperationA,id:"production-operation-b",poId:foreignPO.id,poLineId:"production-line-b",componentId:foreignComponent.id,machineId:"machine-b"};
 const foreignAssignment={...productionAssignmentA,id:"production-assignment-b",companyId:"company-b",factoryId:"factory-b",poId:foreignPO.id,poLineId:"production-line-b",componentId:foreignComponent.id,operationId:foreignOperation.id,machineId:"machine-b",operatorId:foreignOperator.id,operatorCode:foreignOperator.employeeCode,operatorName:foreignOperator.displayName};
 const visible=filterManufacturingData({
  companies:[companyA,companyB],factories:[factoryA,factoryB],components:[productionComponentA,foreignComponent],
  purchaseOrders:[productionPOA,foreignPO],machines:[machineA,machineB],processDefinitions:[processDefinition],
  operations:[productionOperationA,foreignOperation],productionOperators:[productionOperatorA,foreignOperator],
  productionAssignments:[productionAssignmentA,foreignAssignment]
 },user);
 assert.deepEqual(visible.productionOperators.map(row=>row.id),["operator-a"]);
 assert.deepEqual(visible.productionAssignments.map(row=>row.id),["production-assignment-a"]);
});
test("tenant writes accept a properly scoped internal production operator and assignment",()=>{
 const incoming={productionOperators:[productionOperatorA],productionAssignments:[productionAssignmentA]};
 assert.equal(validateManufacturingWrite({...productionBase,productionOperators:[],productionAssignments:[]},incoming,user).ok,true);
});
test("tenant writes reject cross-factory operators, invalid skill links, foreign assignments and over-allocation",()=>{
 const base={...productionBase,productionOperators:[productionOperatorA],productionAssignments:[]};
 assert.equal(validateManufacturingWrite(base,{productionOperators:[{...productionOperatorA,id:"operator-bad",factoryId:"factory-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{productionOperators:[{...productionOperatorA,id:"operator-bad",processDefinitionIds:["not-in-directory"]}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{productionAssignments:[{...productionAssignmentA,id:"foreign-assignment",companyId:"company-b"}]},user).ok,false);
 assert.equal(validateManufacturingWrite(base,{productionAssignments:[{...productionAssignmentA,id:"bad-shift",shiftCode:"",targetQuantity:20}]},user).ok,false);
 const assigned={...productionAssignmentA,id:"already-assigned",targetQuantity:60,status:"Completed"};
 const nearlyFull={...productionAssignmentA,id:"over-assigned",targetQuantity:50};
 assert.equal(validateManufacturingWrite({...base,productionAssignments:[assigned]},{productionAssignments:[nearlyFull]},user).ok,false);
});
test("tenant writes reject overlapping production operator schedules and machine assignments",()=>{
 const existing={...productionAssignmentA,id:"existing-assignment",plannedStart:"2026-11-26T08:00:00.000Z",plannedEnd:"2026-11-26T12:00:00.000Z",targetQuantity:40};
 const overlapping={...productionAssignmentA,id:"overlap-assignment",plannedStart:"2026-11-26T11:00:00.000Z",plannedEnd:"2026-11-26T15:00:00.000Z",targetQuantity:40};
 const base={...productionBase,productionOperators:[productionOperatorA],productionAssignments:[existing]};
 assert.equal(validateManufacturingWrite(base,{productionAssignments:[overlapping]},user).ok,false);
 const maintenance={...maintenanceWorkOrderA,scheduledStart:"2026-11-26T09:00:00.000Z",scheduledEnd:"2026-11-26T10:00:00.000Z"};
 assert.equal(validateManufacturingWrite({...base,maintenanceWorkOrders:[maintenance]},{productionAssignments:[productionAssignmentA]},user).ok,false);
});
