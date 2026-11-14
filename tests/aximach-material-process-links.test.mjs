import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("material process link collection is normalized, merged and server-synced", () => {
  const client = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/manufacturing-data.mjs", import.meta.url), "utf8");
  assert.ok(client.includes("materialProcessLinks: MaterialProcessLinkRecord[]"));
  assert.ok(client.includes("materialProcessLinks: mergeRows(local.materialProcessLinks, remote.materialProcessLinks)"));
  assert.ok(server.includes('"materialProcessLinks"'));
});

test("vehicle marker is icon-only and popup resolves the saved directory route plus leg snapshot", () => {
  const source = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("routeRecord?: TransportRouteRecord"));
  assert.ok(source.includes("Transport Directory ID:"));
  assert.ok(source.includes("Saved component rate snapshot:"));
  assert.ok(!source.includes("<span>TRANSPORT</span>"));
  assert.ok(!source.includes("<small>{leg.vehicleType}</small>"));
});

test("material markers and connector legend distinguish material, main, alternate, rework and transport links", () => {
  const marker = readFileSync(new URL("../src/MaterialFlowMarker.tsx", import.meta.url), "utf8");
  const legend = readFileSync(new URL("../src/RouteConnectorLegend.tsx", import.meta.url), "utf8");
  for (const value of ["MATERIAL → PROCESS LINK","BOM line:","Process operation:","PO requirement:"]) assert.ok(marker.includes(value));
  for (const value of ["Main route","Alternate route","Rework route","Material → process","Transport leg · vehicle colour"]) assert.ok(legend.includes(value));
});

test("Inventory creates independent material links scoped to the exact PO line, BOM and operation", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const flow = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes("materialLinkBomLineId"));
  assert.ok(inventory.includes("materialLinkOperationId"));
  assert.ok(inventory.includes("operation.poLineId!==selection.line.id"));
  assert.ok(inventory.includes("materialProcessLinks:[...current.materialProcessLinks"));
  assert.ok(app.includes("initialContext={moduleContext}"));
  assert.ok(flow.includes('subtab:"process-links"'));
  assert.ok(flow.includes("componentMaterialProcessLinks"));
});

test("Process Map node, Route Flow and Manufacturing Universe render material and transport independently", () => {
  const flow = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(flow.includes('materialLinksAt(operation.id,"before")'));
  assert.ok(flow.includes('transportLegsAt(operation.id,"before")'));
  assert.ok(flow.includes('materialLinksAt(operation.id,"after")'));
  assert.ok(flow.includes('transportLegsAt(operation.id,"after")'));
  assert.ok(flow.includes("linked-node-arrow route-connector"));
  assert.ok(universe.includes('materialLinksAt(operation.id,"before")'));
  assert.ok(universe.includes('transportFor(operation.id,"before")'));
  assert.ok(universe.includes('materialLinksAt(operation.id,"after")'));
  assert.ok(universe.includes('transportFor(operation.id,"after")'));
  assert.ok(universe.includes("<RouteConnectorLegend/>"));
  assert.ok(flow.includes("<RouteConnectorLegend/>"));
});

test("synthetic route example has three materials linked to distinct process operations and six transport legs", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-transport-routing-demo.json", import.meta.url), "utf8"));
  const operations = new Map(fixture.operations.map(row=>[row.id,row]));
  const materials = new Map(fixture.materials.map(row=>[row.id,row]));
  const bomLines = new Map(fixture.bomLines.map(row=>[row.id,row]));
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.materialProcessLinks.length, 3);
  assert.equal(new Set(fixture.materialProcessLinks.map(row=>row.materialId)).size, 3);
  assert.equal(new Set(fixture.materialProcessLinks.map(row=>row.operationId)).size, 3);
  assert.equal(fixture.transportLegs.length, 6);
  for (const link of fixture.materialProcessLinks) {
    assert.ok(materials.has(link.materialId));
    assert.ok(bomLines.has(link.bomLineId));
    assert.ok(operations.has(link.operationId));
    assert.equal(bomLines.get(link.bomLineId).materialId, link.materialId);
    assert.equal(bomLines.get(link.bomLineId).componentId, link.componentId);
    assert.equal(link.poLineId, fixture.component.poLineId);
    assert.equal(link.componentId, fixture.component.id);
    assert.equal(link.poId, fixture.purchaseOrder.id);
  }
  for (const leg of fixture.transportLegs) {
    assert.ok(!leg.anchorOperationId || operations.has(leg.anchorOperationId));
    assert.ok(fixture.transportRoutes.some(route=>route.id===leg.routeId));
  }
});

test("in-app demo covers one assembly, three part routes, all relationship types and multi-carrier transport", () => {
  const demo = readFileSync(new URL("../src/TransportRoutingDemo.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
  assert.ok(demo.includes("aximach-one-component-multipart-route.json"));
  assert.ok(demo.includes("Part process routes"));
  assert.ok(demo.includes("Relationship types"));
  assert.ok(demo.includes("Transport legs"));
  assert.ok(demo.includes("Carrier options"));
  assert.ok(demo.includes("Add alternative 4-wheeler carrier leg"));
  assert.ok(demo.includes("RouteConnectorLegend"));
  assert.ok(demo.includes("partProcessIds"));
  assert.ok(demo.includes("showSecondCarrier"));
  assert.ok(routeFlow.includes("Open multi-part demo"));
  assert.ok(routeFlow.includes("<TransportRoutingDemo onClose"));
  assert.equal(fixture.parts.length, 3);
  assert.equal(fixture.operations.length, 9);
  assert.equal(fixture.routeRelationships.length, 14);
  assert.equal(new Set(fixture.routeRelationships.map(row=>row.relationshipType)).size, 11);
  assert.equal(fixture.transportLegs.length, 11);
  assert.equal(fixture.transportRoutes.length, 10);
});

test("component parts retain multiple material master IDs with legacy single-material migration", () => {
  const model = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  assert.ok(model.includes("materialId: string; materialIds?: string[]"));
  assert.ok(model.includes("Array.isArray(part.materialIds)"));
  assert.ok(model.includes("...(part.materialId ? [part.materialId] : [])"));
  assert.ok(panel.includes("materialIds:[...new Set"));
  assert.ok(panel.includes("part?.materialIds?.[0]"));
});

test("saving additional parts does not convert a component-level PO line into one single-part allocation", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  assert.ok(panel.includes("const nextPurchaseOrders=current.purchaseOrders"));
  assert.ok(panel.includes("// Do not convert a component-level PO line to a single-part line"));
  assert.ok(!panel.includes('lines:order.lines.map(line=>line.id!==effectivePoLineId?line:{...line,allocationLevel:"part" as const,partId:part.id})'));
});

test("Process Map material procurement persists a part-scoped BOM row and archives only its generated row", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const model = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(model.includes("partId?: string;"));
  assert.ok(model.includes("sourceMaterialCostEntryId?: string;"));
  assert.ok(panel.includes("sourceMaterialCostEntryId:sourceBom?.sourceMaterialCostEntryId"));
  assert.ok(panel.includes("quantityPerPart:sourceBom?perPieceKg"));
  assert.ok(panel.includes('row.sourceMaterialCostEntryId===entry.id'));
});

test("Material Directory BOM, part and material-process actions enforce exact part identity", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes('id="bom-part"'));
  assert.ok(inventory.includes('(row.partId || "") === (bomDraft.partId || "")'));
  assert.ok(inventory.includes('row.partId === materialLinkSelection.line.partId'));
  assert.ok(inventory.includes('bom.partId!==selection.line.partId'));
  assert.ok(inventory.includes('partLinks.some(part => part.componentId === directoryComponentId)'));
  assert.ok(inventory.includes('part.materialIds?.includes(m.id)'));
  assert.ok(inventory.includes("const visibleBom = useMemo"));
  assert.ok(inventory.includes("const linkedOrders = orders.filter"));
  assert.ok(inventory.includes('className="material-directory-filter-bar"'));
});

test("BOM issue preview and ledger posting include component-wide and selected-part BOM rows only", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes('!bomIssueSelection.line.partId || !row.partId || row.partId === bomIssueSelection.line.partId'));
  assert.ok(inventory.includes('!line.partId || !row.partId || row.partId === line.partId'));
});

test("Process Map is scoped to the exact selected PO line and its part material allocations", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes('op.poLineId === selectedLine?.id && op.componentId === selectedLine?.componentId'));
  assert.ok(processMap.includes('leg.poLineId === selectedLine?.id'));
  assert.ok(processMap.includes('entry.poLineId === selectedLine?.id'));
  assert.ok(processMap.includes('entry.partId===selectedPart.id'));
  assert.ok(processMap.includes('const expectedQuantity = Math.max(0,Number(selectedLine?.quantity)||0)'));
});

test("Route Flow never defaults to an unrelated first company, PO or component line", () => {
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(routeFlow.includes("initialContext?:NavigationContext"));
  assert.ok(routeFlow.includes("const appliedContextKey=useRef"));
  assert.ok(routeFlow.includes('const company=companies.find(row=>row.id===companyPick)'));
  assert.ok(routeFlow.includes('const order=companyOrders.find(row=>row.id===poPick)'));
  assert.ok(routeFlow.includes('const line=lineOptions.find(row=>row.id===linePick)'));
  assert.ok(!routeFlow.includes("||companies[0]"));
  assert.ok(!routeFlow.includes("||companyOrders[0]"));
  assert.ok(!routeFlow.includes("||lineOptions[0]"));
  assert.ok(app.includes('<RouteFlowWorkspace initialContext={moduleContext}'));
});

test("Component master and Process Map module links pass source record context", () => {
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(master.includes("const componentNavigationContext ="));
  assert.ok(master.includes('onSelectModule("process-map",componentNavigationContext(row.id))'));
  assert.ok(master.includes('onSelectModule("inventory",componentNavigationContext(row.id))'));
  assert.ok(master.includes("selectedComponentForNavigation"));
  assert.ok(processMap.includes('subtab:"process-links"'));
  assert.ok(processMap.includes('onSelectModule("transport-master",{companyId,poId,poLineId,componentId:selectedLine?.componentId})'));
  assert.ok(processMap.includes("materialProcessPartLabels"));
});

test("material-to-process markers disclose the exact BOM part across Process Map, Route Flow and Manufacturing Universe", () => {
  const marker = readFileSync(new URL("../src/MaterialFlowMarker.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(marker.includes("partLabel?: string"));
  assert.ok(marker.includes("Part: {partLabel}"));
  assert.ok(processMap.includes("partLabel={materialProcessPartLabels[link.id]}"));
  assert.ok(routeFlow.includes("partLabel={materialProcessPartLabels[link.id]}"));
  assert.ok(universe.includes("materialPartLabels?.[link.id]"));
});

test("part-scoped routes hide process links whose BOM belongs to another part", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("return !selectedPart||!linkedBom?.partId||linkedBom.partId===selectedPart.id"));
  assert.ok(routeFlow.includes("return !line?.partId||!linkedBom?.partId||linkedBom.partId===line.partId"));
  assert.ok(routeFlow.includes("leg.componentId===componentId"));
});

test("Manufacturing Universe uses the incoming component context and never falls back to first unrelated records", () => {
  const universe = readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("initialContext?:NavigationContext"));
  assert.ok(universe.includes("const appliedContextKey=useRef"));
  assert.ok(universe.includes("const company=companies.find(row=>row.id===companyPick)"));
  assert.ok(universe.includes("const po=companyOrders.find(row=>row.id===poPick)"));
  assert.ok(universe.includes("const line=lines.find(row=>row.id===linePick)"));
  assert.ok(!universe.includes("||companies[0]"));
  assert.ok(!universe.includes("||companyOrders[0]"));
  assert.ok(!universe.includes("||lines[0]"));
  assert.ok(universe.includes("lineComponent?.partNumber"));
  assert.ok(universe.includes("materialPartLabels={sceneMaterialPartLabels}"));
  assert.ok(universe.includes('universeScope==="enterprise"&&(sceneRouteOperations.length>0||sceneRouteMaterials.length>0||sceneRouteLegs.length>0)'));
  assert.ok(universe.includes('universeScope==="po-line"&&!!poLineId&&(routeOperations.length>0||routeMaterials.length>0||routeLegs.length>0)'));
  assert.ok(universe.includes("const globalRouteLabels=useMemo"));
  assert.ok(app.includes('<ManufacturingUniverseWorkspace initialContext={moduleContext}'));
});

test("Material Directory filters materials reachable only from component-part material IDs by PO", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes("partLinks.some(part => orders.some(po => po.id === directoryPoId"));
  assert.ok(inventory.includes("line.componentId === part.componentId && (!line.partId || line.partId === part.id)"));
});

test("Legacy Process Map allocations and transport legs are not copied into ambiguous multi-line components", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("selectedComponentLineCount === 1"));
  assert.ok(processMap.includes("(!leg.poLineId && selectedComponentLineCount === 1)"));
  assert.ok(routeFlow.includes("componentGlobalLineCount===1"));
  assert.ok(routeFlow.includes("componentLineCount===1"));
});

test("Save & Add Another Material retains the same part identity and physical dimensions", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  assert.ok(panel.includes('if(part){\n      setTarget("part");setNewPartMode(false);setPartId(part.id);setPartName(part.name);setPartNumber(part.partNumber);'));
  assert.ok(panel.includes('setDimensions(Object.fromEntries(Object.entries(part.dimensions||{}).map(([key,value])=>[key,String(value)])));'));
  assert.ok(panel.includes('setDimensionUnits(part.dimensionUnits||{});'));
  assert.ok(panel.includes('Save & Add Another Material'));
});

test("All Material Directory tabs share linked-record filters and show the part belonging to each process-link BOM", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes('const visibleTransactions = useMemo'));
  assert.ok(inventory.includes('return companyMatch&&poMatch&&componentMatch'));
  assert.ok(inventory.includes('(!directoryComponentId || link.componentId===directoryComponentId)') || inventory.includes('!directoryComponentId || link.componentId===directoryComponentId'));
  assert.ok(inventory.includes('link.poId===directoryPoId'));
  assert.ok(inventory.includes('const part=bom?.partId?'));
  assert.ok(inventory.includes('Part "+(part.partNumber?part.partNumber+" ":"")+part.name'));
});

test("component-only navigation does not silently pick the first PO when the component has multiple PO lines", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx", import.meta.url), "utf8");
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("const componentOnlyLine = componentLines.length === 1 ? componentLines[0] : undefined"));
  assert.ok(routeFlow.includes("const componentOnlyLine=componentLines.length===1?componentLines[0]:undefined"));
  assert.ok(universe.includes("const componentOnlyLine=componentLines.length===1?componentLines[0]:undefined"));
  assert.ok(master.includes("const unique=matchingLines.length===1?matchingLines[0]:undefined"));
  assert.ok(processMap.includes("targetComponentLines.length === 1 ? targetComponentLines[0] : undefined"));
  assert.ok(routeFlow.includes("matchingComponentLines.length===1?matchingComponentLines[0]:undefined"));
  assert.ok(universe.includes("matchingComponentLines.length===1?matchingComponentLines[0]:undefined"));
});

test("master module navigation opens the exact selected component or PO and does not silently route the first row", () => {
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(master.includes("const selectedComponentForNavigation="));
  assert.ok(master.includes("const selectedPOForNavigation="));
  assert.ok(master.includes("disabled={!selectedComponentForNavigation}"));
  assert.ok(master.includes("disabled={!selectedPOForNavigation}"));
  assert.ok(master.includes("setSelectedComponentIds([target.id])"));
  assert.ok(master.includes('setOpenedPoId(navigationContext?.poId || "")'));
});

test("BOM part selection rejects a part belonging to a different or archived component", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes('part.id === bomDraft.partId && part.componentId === bomDraft.componentId && !part.deletedAt'));
  assert.ok(inventory.includes("The selected BOM part must be an active part belonging to the selected component."));
});

test("Production Plan opens Process Map only for an exact selected or unique visible PO line and counts that line's own operations", () => {
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(operations.includes("const processNavigationJob=selectedVisibleJobs.length===1?selectedVisibleJobs[0]:(filtered.length===1?filtered[0]:undefined)"));
  assert.ok(operations.includes('disabled={!processNavigationContext}'));
  assert.ok(operations.includes('ops.find(op=>op.poId===po.id&&op.poLineId===line.id)'));
  assert.ok(!operations.includes('||operations[0]'));
  assert.ok(operations.includes('operations.filter(op=>op.category!=="Logistics").length'));
});

test("Transport Directory and Dispatch retain the originating PO component and selected transporter", () => {
  const directory = readFileSync(new URL("../src/TransportDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(directory.includes("initialContext?:NavigationContext"));
  assert.ok(directory.includes("const linkedLegs=transportLegs.filter(matches)"));
  assert.ok(directory.includes("setRouteFilterIds(initialContext?.routeId?[initialContext.routeId]:[])"));
  assert.ok(directory.includes('onSelectModule("vendors",{...initialContext,vendorId:'));
  const dispatch = operations.slice(operations.indexOf("export function TransportDispatchWorkspace"), operations.indexOf("export function QualityInspectionWorkspace"));
  assert.ok(dispatch.includes("const contextMatch="));
  assert.ok(dispatch.includes("row.poLineId===initialContext.poLineId"));
  assert.ok(dispatch.includes('onSelectModule("process-map",{companyId:pos.find(po=>po.id===row.poId)?.companyId,poId:row.poId,poLineId:row.poLineId,componentId:row.componentId'));
  assert.ok(app.includes('<TransportDirectoryWorkspace initialContext={moduleContext}'));
  assert.ok(app.includes('<TransportDispatchWorkspace initialContext={moduleContext}'));
});

test("VMC step 2 fans out to the shaft, body and cover part routes with separate carrier vehicles", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
  const operations = new Map(fixture.operations.map(row => [row.id, row]));
  const routes = new Map(fixture.transportRoutes.map(row => [row.id, row]));
  const bomLines = new Map(fixture.bomLines.map(row => [row.id, row]));
  const partNames = new Map(fixture.parts.map(row => [row.id, row.partNumber]));
  const expected = new Map([
    ["mp-op-turn", "mp-part-shaft"],
    ["mp-op-insert", "mp-part-body"],
    ["mp-op-cover", "mp-part-cover"]
  ]);
  const fanout = fixture.transportLegs.filter(row => row.anchorOperationId === "mp-op-vmc" && expected.has(row.targetOperationId));
  assert.equal(fanout.length, 3, "the second-stage VMC process must have one outbound leg to each part branch");
  assert.equal(new Set(fanout.map(row => row.targetOperationId)).size, 3, "each part branch must receive its own transport leg");
  assert.equal(new Set(fanout.map(row => row.vehicleType)).size, 3, "each branch transfer must use a different vehicle category");
  assert.equal(new Set(fanout.map(row => row.vendorId)).size, 3, "each branch transfer must retain its own carrier");
  for (const leg of fanout) {
    const target = operations.get(leg.targetOperationId);
    assert.ok(target, "each transport target must resolve a saved process operation");
    assert.equal(target.poLineId, fixture.poLine.id);
    assert.equal(target.componentId, fixture.component.id);
    const targetPartIds = new Set(fixture.materialProcessLinks
      .filter(link => link.operationId === target.id)
      .map(link => bomLines.get(link.bomLineId)?.partId)
      .filter(Boolean));
    assert.deepEqual([...targetPartIds], [expected.get(target.id)], "the target process must resolve to the intended part-scoped BOM material");
    assert.equal(partNames.get(expected.get(target.id)), ({
      "mp-op-turn": "ASSY-MP-01-SHAFT",
      "mp-op-insert": "ASSY-MP-01-BODY",
      "mp-op-cover": "ASSY-MP-01-COVER"
    })[target.id]);
    const route = routes.get(leg.routeId);
    assert.ok(route, "each outbound leg must reference a saved Transport Directory route");
    assert.equal(route.vendorId, leg.vendorId);
    assert.equal(route.vehicleType, leg.vehicleType);
    assert.equal(route.fromLocation, "VMC subcontractor");
    assert.equal(route.toLocation, leg.toLocation);
  }
  const relationTypesByTarget = new Map(fixture.routeRelationships
    .filter(row => row.fromOperationId === "mp-op-vmc")
    .map(row => [row.toOperationId, row.relationshipType]));
  assert.equal(relationTypesByTarget.get("mp-op-turn"), "split");
  assert.equal(relationTypesByTarget.get("mp-op-insert"), "parallel");
  assert.equal(relationTypesByTarget.get("mp-op-cover"), "alternate");
});

test("the second-stage VMC-to-shaft process connection supports multiple independent carriers", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
  const sameConnection = fixture.transportLegs.filter(row =>
    row.anchorOperationId === "mp-op-vmc" && row.targetOperationId === "mp-op-turn"
  );
  assert.ok(sameConnection.some(row => row.id === "mp-leg-09" && row.vehicleType === "2-wheeler"));
  const firstCarrier = fixture.transportRoutes.find(row => row.id === "mp-route-07");
  const secondCarrier = fixture.transportRoutes.find(row => row.id === "mp-route-12");
  assert.ok(firstCarrier && secondCarrier, "the same VMC-to-shaft transfer must have two saved Transport Directory options");
  for (const route of [firstCarrier, secondCarrier]) {
    assert.equal(route.fromLocation, "VMC subcontractor");
    assert.equal(route.toLocation, "CNC shaft turning supplier");
  }
  assert.notEqual(firstCarrier.vehicleType, secondCarrier.vehicleType);
  assert.notEqual(firstCarrier.vendorId, secondCarrier.vendorId);
  assert.equal(secondCarrier.vehicleType, "4-wheeler");
  assert.ok(!sameConnection.some(row => row.routeId === "mp-route-12"),
    "the second carrier is deliberately a separate saved route option; browser acceptance creates and persists a distinct leg from it");
});

