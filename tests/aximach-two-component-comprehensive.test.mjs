import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-two-component-multipart-route.json", import.meta.url), "utf8"));
const relationshipTypes = ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];
const vehicleTypes = ["2-wheeler","3-wheeler","4-wheeler","Light commercial vehicle","Mini truck","Heavy-duty 4-wheeler","Heavy truck","Container truck","Trailer / tractor","Bus / staff vehicle","Courier / delivery","Air freight","Rail freight","Sea freight / container vessel","Inland waterway vessel","Multimodal freight"];
const moduleIds = ["companies","components","purchasing","vendors","transport-master","contact360","process-master","planned-cost","vendor-capability","inventory","production","route-flow","manufacturing-universe","dispatch","quality","costing","communications","reports","ai-insights","export"];

const partsById = new Map(fixture.parts.map(row => [row.id,row]));
const componentsById = new Map(fixture.components.map(row => [row.id,row]));
const linesById = new Map(fixture.purchaseOrder.lines.map(row => [row.id,row]));
const linesByPartId = new Map(fixture.purchaseOrder.lines.filter(row=>row.partId).map(row=>[row.partId,row]));
const operationsById = new Map(fixture.operations.map(row => [row.id,row]));
const processDefinitionsById = new Map(fixture.processDefinitions.map(row=>[row.id,row]));
const vendorsById = new Map(fixture.vendors.map(row=>[row.id,row]));
const materialsById = new Map(fixture.materials.map(row=>[row.id,row]));
const bomById = new Map(fixture.bomLines.map(row=>[row.id,row]));
const routesById = new Map(fixture.transportRoutes.map(row=>[row.id,row]));

test("integrated acceptance fixture is synthetic and contains exactly two parent components", () => {
  assert.equal(fixture.synthetic,true);
  assert.equal(fixture.liveSeed,false);
  assert.equal(fixture.components.length,2);
  assert.equal(fixture.parts.length,5);
  assert.equal(new Set(fixture.components.map(row=>row.id)).size,2);
  assert.equal(new Set(fixture.parts.map(row=>row.id)).size,5);
  assert.equal(new Set(fixture.parts.map(row=>row.componentId)).size,2);
  for(const component of fixture.components){
    const children=fixture.parts.filter(part=>part.componentId===component.id);
    assert.ok(children.length>=2,component.partNumber+" must have multiple child parts");
    assert.ok(children.every(part=>part.componentId===component.id));
  }
});

test("every child part owns one separate part-level PO line and independent process route", () => {
  assert.equal(fixture.purchaseOrder.lines.length,5);
  for(const part of fixture.parts){
    const line=linesByPartId.get(part.id);
    assert.ok(line,part.partNumber+" needs a part-level purchase-order line");
    assert.equal(line.allocationLevel,"part");
    assert.equal(line.partId,part.id);
    assert.equal(line.componentId,part.componentId);
    assert.equal(line.quantity,120);
    const route=fixture.operations.filter(operation=>operation.poLineId===line.id);
    assert.ok(route.length>=part.processes.length+2,part.partNumber+" needs its full main, alternate and rework routes");
    assert.ok(route.every(operation=>operation.poId===fixture.purchaseOrder.id&&operation.componentId===part.componentId));
    assert.ok(route.some(operation=>operation.branch==="Main route"));
    assert.ok(route.some(operation=>operation.branch==="Alternate route"&&operation.relationType==="alternate"));
    assert.ok(route.some(operation=>operation.branch==="Rework route"&&operation.relationType==="rework"));
    assert.equal(new Set(route.map(operation=>operation.id)).size,route.length);
  }
  assert.deepEqual(new Set(fixture.parts.map(part=>part.precisionClass)),new Set(["Standard","Precision","Ultra Precision"]));
});

test("Process Directory definitions and stable subcategory IDs resolve every saved operation", () => {
  const subcategoryIds=new Set();
  for(const definition of fixture.processDefinitions){
    assert.ok(definition.id&&definition.category&&definition.processType);
    assert.ok(definition.subcategories.length>0);
    assert.equal(definition.subcategories.length,definition.subcategoryIds.length);
    for(const id of definition.subcategoryIds){assert.ok(!subcategoryIds.has(id),"subcategory IDs must be globally unique");subcategoryIds.add(id);}
    for(const vendorId of definition.vendorIds) assert.ok(vendorsById.has(vendorId));
  }
  for(const operation of fixture.operations){
    const definition=processDefinitionsById.get(operation.processDefinitionId);
    assert.ok(definition,operation.id+" must resolve a Process Directory definition");
    assert.ok(definition.subcategoryIds.includes(operation.processSubcategoryId),operation.id+" must store a stable subcategory ID");
    assert.ok(definition.vendorIds.includes(operation.vendorId),operation.id+" vendor must be allowed by the selected definition");
    const line=linesById.get(operation.poLineId);
    assert.ok(line);
    assert.equal(line.componentId,operation.componentId);
  }
});

test("every part-level route contains all eleven typed relationship kinds with valid same-line endpoints", () => {
  assert.equal(new Set(fixture.routeRelationships.map(row=>row.relationshipType)).size,11);
  for(const part of fixture.parts){
    const line=linesByPartId.get(part.id);
    const relationships=fixture.routeRelationships.filter(row=>row.poLineId===line.id);
    assert.deepEqual(new Set(relationships.map(row=>row.relationshipType)),new Set(relationshipTypes));
    for(const relationship of relationships){
      assert.equal(relationship.poId,fixture.purchaseOrder.id);
      assert.equal(relationship.componentId,part.componentId);
      const from=operationsById.get(relationship.fromOperationId);
      const to=operationsById.get(relationship.toOperationId);
      assert.ok(from&&to);
      assert.equal(from.poLineId,line.id);
      assert.equal(to.poLineId,line.id);
      assert.notEqual(from.id,to.id);
    }
  }
  assert.deepEqual(new Set(fixture.routeRelationships.map(row=>row.status)),new Set(["Active","Planned","Conditional","Disabled"]));
});

test("all sixteen vehicle categories are registered in the application and present together in saved component legs", () => {
  const vehicleSource = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  const directorySource = readFileSync(new URL("../src/TransportDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const registry = vehicleSource.match(/export const VEHICLE_TYPES = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
  const registeredVehicleTypes = [...registry.matchAll(/"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(new Set(registeredVehicleTypes), new Set(vehicleTypes), "Transport Directory must expose all sixteen approved vehicle categories");
  assert.ok(directorySource.includes("...VEHICLE_TYPES") && directorySource.includes("vehicleOptions.map"), "Transport Directory must build its selectable vehicle options from the shared vehicle registry");
  assert.deepEqual(new Set(fixture.transportRoutes.map(row=>row.vehicleType)),new Set(vehicleTypes));
  assert.deepEqual(new Set(fixture.transportLegs.map(row=>row.vehicleType)),new Set(vehicleTypes));
  assert.equal(fixture.transportRoutes.length,16);
  assert.equal(fixture.transportLegs.length,16);
  for(const route of fixture.transportRoutes){
    assert.ok(vendorsById.has(route.vendorId));
    assert.ok(Number.isFinite(route.fixedAmount)&&route.fixedAmount>=0);
    assert.ok(["One-way","Two-way"].includes(route.tripDirection));
  }
  for(const leg of fixture.transportLegs){
    const route=routesById.get(leg.routeId);
    assert.ok(route,"every leg references a saved Transport Directory route");
    assert.equal(route.vendorId,leg.vendorId);
    assert.equal(route.vehicleType,leg.vehicleType);
    assert.equal(route.fromLocation,leg.fromLocation);
    assert.equal(route.toLocation,leg.toLocation);
    assert.equal(leg.poId,fixture.purchaseOrder.id);
    assert.ok(linesById.has(leg.poLineId));
    assert.equal(linesById.get(leg.poLineId).componentId,leg.componentId);
    assert.equal(operationsById.get(leg.targetOperationId)?.poLineId,leg.poLineId);
    if(leg.anchorOperationId) assert.equal(operationsById.get(leg.anchorOperationId)?.poLineId,leg.poLineId);
    assert.ok(leg.fixedAmount>=0&&leg.tripCount>=1);
  }
  assert.equal(new Set(fixture.transportLegs.map(leg=>leg.poLineId)).size,5,"all five part routes must carry transport");
});

test("part materials, BOM, process feeds and material costing retain exact component and PO-line identity", () => {
  assert.ok(fixture.bomLines.length>=fixture.parts.length);
  for(const part of fixture.parts){
    const line=linesByPartId.get(part.id);
    assert.ok(part.materialIds.length>=2);
    const bomRows=fixture.bomLines.filter(row=>row.partId===part.id);
    assert.ok(bomRows.length>=2);
    for(const bom of bomRows){
      assert.equal(bom.componentId,part.componentId);
      assert.ok(part.materialIds.includes(bom.materialId));
      assert.ok(materialsById.has(bom.materialId));
    }
    const links=fixture.materialProcessLinks.filter(row=>row.poLineId===line.id);
    assert.ok(links.length>=2);
    for(const link of links){
      const bom=bomById.get(link.bomLineId);
      assert.ok(bom);
      assert.equal(bom.partId,part.id);
      assert.equal(bom.componentId,part.componentId);
      assert.equal(bom.materialId,link.materialId);
      assert.equal(link.componentId,part.componentId);
      assert.equal(operationsById.get(link.operationId)?.poLineId,line.id);
      assert.ok(["Material input","Consumable","WIP transfer","Output"].includes(link.flowType));
      assert.ok(["before","after"].includes(link.placement));
    }
    const costRows=fixture.materialCostEntries.filter(row=>row.partId===part.id);
    assert.ok(costRows.length>=bomRows.length);
    assert.ok(costRows.every(row=>row.componentId===part.componentId&&row.poLineId===line.id));
  }
  assert.deepEqual(new Set(fixture.materialProcessLinks.map(row=>row.flowType)),new Set(["Material input","Consumable","WIP transfer","Output"]));
  assert.deepEqual(new Set(fixture.materialProcessLinks.map(row=>row.placement)),new Set(["before","after"]));
});

test("the full dataset contains live-linked records for all twenty catalogue modules", () => {
  const app=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
  const start=app.indexOf("const modules: ModuleItem[] = [");
  const end=app.indexOf("\n];",start);
  const appIds=[...app.slice(start,end).matchAll(/\{ id: "([^"]+)"/g)].map(match=>match[1]);
  assert.deepEqual(fixture.moduleIds,moduleIds);
  assert.deepEqual([...appIds].sort(),[...moduleIds].sort());
  assert.equal(new Set(fixture.moduleIds).size,20);
  const domains={
    company:fixture.company,factory:fixture.factory,components:fixture.components,parts:fixture.parts,
    purchaseOrder:fixture.purchaseOrder,vendors:fixture.vendors,transportRoutes:fixture.transportRoutes,
    contactProfiles:fixture.contactProfiles,processDefinitions:fixture.processDefinitions,plannedCosts:fixture.plannedCosts,
    materials:fixture.materials,bomLines:fixture.bomLines,inventoryTransactions:fixture.inventoryTransactions,
    operations:fixture.operations,routeRelationships:fixture.routeRelationships,transportLegs:fixture.transportLegs,
    inspectionMeasurements:fixture.inspectionMeasurements,quotations:fixture.quotations,
    payments:fixture.paymentTransactions,followUpAssignments:fixture.followUpAssignments
  };
  for(const id of moduleIds){
    const collections=fixture.moduleCoverage[id];
    assert.ok(collections?.length,id+" has no declared record coverage");
    for(const collection of collections){
      const value=domains[collection];
      assert.ok(value!==undefined,id+" references missing data domain "+collection);
      assert.ok(Array.isArray(value)?value.length>0:Boolean(value),id+" has no saved records in "+collection);
    }
  }
});

test("all major manufacturing option sets are represented together, without fabricated live data", () => {
  assert.deepEqual(new Set(fixture.parts.map(part=>part.precisionClass)),new Set(["Standard","Precision","Ultra Precision"]));
  assert.deepEqual(new Set(fixture.quotations.map(row=>row.status)),new Set(["Received","Selected","Rejected","Expired"]));
  assert.deepEqual(new Set(fixture.inventoryTransactions.map(row=>row.transactionType)),new Set(["Opening balance","Receipt","Issue to production","WIP transfer","Return","Rejected","Scrap","Finished goods receipt","Dispatch","Adjustment"]));
  assert.deepEqual(new Set(fixture.inspectionMeasurements.map(row=>row.result)),new Set(["Pass","Fail","Not assessed"]));
  assert.deepEqual(new Set(fixture.operations.map(row=>row.status)),new Set(["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"]));
  assert.deepEqual(new Set(fixture.transportLegs.map(row=>row.tripDirection)),new Set(["One-way","Two-way"]));
  assert.deepEqual(new Set(fixture.purchaseOrder.lines.map(row=>row.jobStatus)),new Set(["In progress","Finished"]));
  assert.deepEqual(new Set(fixture.contactProfiles.map(row=>row.linkedType)),new Set(["company","vendor"]));
  assert.ok(fixture.expected.allPartsHaveIndependentOperationChains);
  assert.ok(fixture.expected.allTransportVehiclesPersisted);
  assert.equal(fixture.liveSeed,false,"the synthetic acceptance fixture must never auto-seed live customer records");
});


test("Demo Factory generator builds exactly two parent components, five child parts, complete route branches and all registered vehicle types", () => {
  const demo = readFileSync(new URL("../src/aximachDemoData.ts", import.meta.url), "utf8");
  const parentBlock = demo.match(/const parentSpecs = \[([\s\S]*?)\n  \];/)?.[1] ?? "";
  const partBlock = demo.match(/const parts: Part\[\] = \[([\s\S]*?)\n  \];/)?.[1] ?? "";
  assert.equal([...parentBlock.matchAll(/\{ code:/g)].length, 2, "Demo Factory must contain exactly two parent component specifications");
  assert.equal([...partBlock.matchAll(/\{ key:/g)].length, 5, "Demo Factory must contain five child part specifications");
  assert.ok(demo.includes('const components: ManufacturingData["components"] = parentSpecs.map'));
  assert.ok(demo.includes('const componentParts: ManufacturingData["componentParts"] = []'));
  assert.ok(demo.includes("componentParts.push({"));
  assert.ok(demo.includes('allocationLevel: "part"'));
  assert.ok(demo.includes("relationshipTypes.forEach") && demo.includes("routeRelationships.push"));
  assert.ok(demo.includes('addBranch("Alternate route"') && demo.includes('addBranch("Rework route"'));
  assert.equal((demo.match(/VEHICLE_TYPES.map\(/g) || []).length, 2, "all registered vehicle types must be saved as both directory routes and component legs");
  assert.ok(demo.includes("materialProcessLinks.push"));
  assert.ok(demo.includes("bomLines.push"));
});


test("Production, Quality and Dispatch retain child-part identity for every part-level PO line", () => {
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const production = operations.slice(operations.indexOf("export function ProductionPlanWorkspace"), operations.indexOf("export function TransportDispatchWorkspace"));
  const dispatch = operations.slice(operations.indexOf("export function TransportDispatchWorkspace"), operations.indexOf("export function QualityInspectionWorkspace"));
  const quality = operations.slice(operations.indexOf("export function QualityInspectionWorkspace"));
  assert.ok(production.includes("part:parts.find(part=>part.id===line.partId)"));
  assert.ok(production.includes("row.part?.partNumber") && production.includes("row.part?.name"));
  assert.ok(production.includes('line.partId?"pieces"'));
  assert.ok(dispatch.includes("part:parts.find(part=>part.id===pos.find(po=>po.id===leg.poId)?.lines.find(line=>line.id===leg.poLineId)?.partId)"));
  assert.ok(dispatch.includes("row.part?.partNumber") && dispatch.includes("row.part?.name"));
  assert.ok(quality.includes("parts=activeRows(data.componentParts||[])"));
  assert.ok(quality.includes("const childPart=operationLine?.partId?parts.find(part=>part.id===operationLine.partId):undefined"));
  assert.ok(quality.includes("childPart.partNumber") && quality.includes("childPart.name"));
});

test("Quality and Dispatch expose every typed operation lifecycle status supported by AXIMACH", () => {
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const statuses = ["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"];
  const quality = operations.slice(operations.indexOf("export function QualityInspectionWorkspace"));
  const dispatch = operations.slice(operations.indexOf("export function TransportDispatchWorkspace"), operations.indexOf("export function QualityInspectionWorkspace"));
  for (const status of statuses) {
    assert.ok(quality.includes("<option>" + status + "</option>"), "Quality status selector missing " + status);
    assert.ok(dispatch.includes("<option>" + status + "</option>"), "Dispatch status selector missing " + status);
  }
});


test("all twenty registered AXIMACH modules route to dedicated functional workspaces", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const routes = [
    ['activeModuleId === "companies" || activeModuleId === "purchasing" || activeModuleId === "components"', "ManufacturingMasterWorkspace"],
    ['activeModuleId === "vendors"', "VendorWorkspace"],
    ['activeModuleId === "transport-master"', "TransportDirectoryWorkspace"],
    ['activeModuleId === "contact360"', "Contact360Workspace"],
    ['activeModuleId === "process-master" || activeModuleId === "planned-cost"', "SpecializedDirectoryWorkspace"],
    ['activeModuleId === "vendor-capability"', "VendorNetworkWorkspace"],
    ['activeModuleId === "inventory"', "InventoryWorkspace"],
    ['activeModuleId === "production"', "ProductionPlanWorkspace"],
    ['activeModuleId === "route-flow"', "RouteFlowWorkspace"],
    ['activeModuleId === "manufacturing-universe"', "ManufacturingUniverseWorkspace"],
    ['activeModuleId === "dispatch"', "TransportDispatchWorkspace"],
    ['activeModuleId === "quality"', "QualityInspectionWorkspace"],
    ['activeModuleId === "costing"', "LinkedCostingWorkspace"],
    ['activeModuleId === "communications"', "FollowUpWorkspace"],
    ['activeModuleId === "reports"', "ReportsAnalyticsWorkspace"],
    ['activeModuleId === "ai-insights"', "AIInsightsWorkspace"],
    ['activeModuleId === "export"', "DataExchangeWorkspace"]
  ];
  for (const [condition, workspace] of routes) {
    assert.ok(app.includes(condition), "App route is missing " + condition);
    assert.ok(app.includes("<" + workspace), "App route does not render " + workspace);
  }
});
