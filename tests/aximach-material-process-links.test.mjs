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

test("in-app transport demo displays material feeds, directory master links and connector legend", () => {
  const demo = readFileSync(new URL("../src/TransportRoutingDemo.tsx", import.meta.url), "utf8");
  assert.ok(demo.includes("MaterialFlowMarker"));
  assert.ok(demo.includes("RouteConnectorLegend"));
  assert.ok(demo.includes("routeRecord={routes.get(leg.routeId)}"));
  assert.ok(demo.includes("materialLinks.map(link"));
  assert.ok(demo.includes("materialLinksAt(operation.id,\"before\")"));
  assert.ok(demo.includes("No company, PO, component, vendor, material, BOM, material-process link"));
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
  assert.ok(panel.includes("One component line may contain multiple part records"));
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
  assert.ok(master.includes('onSelectModule("process-map",{companyId:linkedOrder?.companyId||row.companyId,poId:linkedOrder?.id,poLineId:linkedLine?.id,componentId:row.id})'));
  assert.ok(master.includes('onSelectModule("inventory",{companyId:linkedOrder?.companyId||row.companyId,poId:linkedOrder?.id,poLineId:linkedLine?.id,componentId:row.id})'));
  assert.ok(processMap.includes('subtab:"process-links"'));
  assert.ok(processMap.includes('onSelectModule("transport-master",{companyId,poId,poLineId,componentId:selectedLine?.componentId})'));
});
