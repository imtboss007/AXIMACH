import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
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

test("all sixteen supported vehicle categories are present together in Transport Directory and saved component legs", () => {
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

test("all thirteen material calculator stock-shape options are saved against exact part and PO-line records", () => {
  const shapes=["plate","flat-bar","round-bar","square-bar","hex-bar","round-tube","square-tube","rectangular-tube","angle","channel","i-beam","t-section","custom-profile"];
  assert.deepEqual(new Set(fixture.materialCostEntries.map(row=>row.shapeType)),new Set(shapes));
  for(const row of fixture.materialCostEntries){
    assert.ok(row.partId&&partsById.has(row.partId));
    assert.ok(linesById.has(row.poLineId));
    assert.equal(linesByPartId.get(row.partId)?.id,row.poLineId);
    assert.ok(row.dimensions&&Object.values(row.dimensions).every(value=>Number.isFinite(Number(value))&&Number(value)>0));
    assert.ok(row.weightPerPieceKg>0&&row.totalWeightKg>0&&row.materialRate>0&&row.materialCost>0);
  }
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
    payments:fixture.paymentTransactions,paymentTransactions:fixture.paymentTransactions,
    materialCostEntries:fixture.materialCostEntries,materialProcessLinks:fixture.materialProcessLinks,
    quotes:fixture.quotations,inspections:fixture.inspectionMeasurements,followUpAssignments:fixture.followUpAssignments
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
