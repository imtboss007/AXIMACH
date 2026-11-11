import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
const source = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");

test("one PO component owns three independent part records in a component-level line", () => {
  assert.equal(fixture.expected.componentCount, 1);
  assert.equal(fixture.parts.length, 3);
  assert.equal(new Set(fixture.parts.map(part => part.id)).size, 3);
  assert.ok(fixture.parts.every(part => part.componentId === fixture.component.id));
  assert.equal(fixture.poLine.componentId, fixture.component.id);
  assert.equal(fixture.poLine.allocationLevel, "component");
  assert.equal(fixture.purchaseOrder.lines.length, 1);
  assert.equal(fixture.purchaseOrder.lines[0].id, fixture.poLine.id);
});

test("each part has its own multi-material list and BOM rows do not leak between parts", () => {
  const materials = new Map(fixture.materials.map(row => [row.id, row]));
  const parts = new Map(fixture.parts.map(row => [row.id, row]));
  assert.equal(materials.size, 5);
  for (const part of fixture.parts) {
    assert.ok(part.materialIds.length >= 2, part.partNumber + " must have at least two material IDs");
    assert.equal(new Set(part.materialIds).size, part.materialIds.length);
    for (const materialId of part.materialIds) assert.ok(materials.has(materialId), part.partNumber + " points to an unknown material");
    const partBom = fixture.bomLines.filter(row => row.partId === part.id);
    assert.deepEqual(new Set(partBom.map(row => row.materialId)), new Set(part.materialIds));
    for (const bom of partBom) {
      assert.equal(bom.componentId, fixture.component.id);
      assert.equal(parts.get(bom.partId).componentId, bom.componentId);
    }
  }
  assert.equal(fixture.bomLines.length, 7);
});

test("one shared raw material can feed multiple operations and all material links resolve to the exact BOM part", () => {
  const bom = new Map(fixture.bomLines.map(row => [row.id, row]));
  const materials = new Map(fixture.materials.map(row => [row.id, row]));
  const operations = new Map(fixture.operations.map(row => [row.id, row]));
  assert.equal(fixture.materialProcessLinks.length, 9);
  for (const link of fixture.materialProcessLinks) {
    const bomRow = bom.get(link.bomLineId);
    assert.ok(bomRow, link.id + " must resolve to a BOM row");
    assert.equal(bomRow.componentId, link.componentId);
    assert.equal(bomRow.materialId, link.materialId);
    assert.ok(materials.has(link.materialId));
    assert.ok(operations.has(link.operationId));
    assert.equal(link.componentId, fixture.component.id);
    assert.equal(link.poId, fixture.purchaseOrder.id);
    assert.equal(link.poLineId, fixture.poLine.id);
  }
  const aluminiumLinks = fixture.materialProcessLinks.filter(link => link.materialId === "mp-mat-al");
  assert.deepEqual(new Set(aluminiumLinks.map(link => link.operationId)), new Set(["mp-op-cut", "mp-op-vmc", "mp-op-cover"]));
  assert.equal(new Set(aluminiumLinks.map(link => bom.get(link.bomLineId).partId)).size, 2);
});

test("branch graph includes all eleven relationship kinds and no dangling operation endpoints", () => {
  const operationIds = new Set(fixture.operations.map(row => row.id));
  const types = ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];
  assert.equal(fixture.routeRelationships.length, 11);
  for (const type of types) {
    const rows = fixture.routeRelationships.filter(row => row.relationshipType === type);
    assert.equal(rows.length, 1, "relationship type " + type + " must have one fixture edge");
  }
  for (const relation of fixture.routeRelationships) {
    assert.ok(operationIds.has(relation.fromOperationId), relation.id + " has an invalid source");
    assert.ok(operationIds.has(relation.toOperationId), relation.id + " has an invalid destination");
    assert.equal(relation.componentId, fixture.component.id);
    assert.equal(relation.poLineId, fixture.poLine.id);
  }
});

test("eight transport legs are independent, route-backed and anchored to operations of the same component", () => {
  const routes = new Map(fixture.transportRoutes.map(row => [row.id, row]));
  const operations = new Map(fixture.operations.map(row => [row.id, row]));
  assert.equal(fixture.transportRoutes.length, 6);
  assert.equal(fixture.transportLegs.length, 8);
  assert.equal(new Set(fixture.transportLegs.map(row => row.id)).size, 8);
  for (const leg of fixture.transportLegs) {
    assert.ok(routes.has(leg.routeId), leg.id + " must resolve to a route master");
    assert.ok(operations.has(leg.anchorOperationId), leg.id + " must resolve to an operation");
    assert.equal(leg.componentId, fixture.component.id);
    assert.equal(leg.poId, fixture.purchaseOrder.id);
    assert.equal(leg.poLineId, fixture.poLine.id);
  }
  const vmcLegs = fixture.transportLegs.filter(leg => leg.anchorOperationId === "mp-op-vmc");
  assert.equal(vmcLegs.length, 2, "one process can have multiple separate transport records");
  assert.equal(new Set(vmcLegs.map(leg => leg.routeId)).size, 2);
});

test("Process Map, Route Flow and Manufacturing Universe keep part-scoped material and transport branches distinct", () => {
  const processMap = source("LinkedProcessWorkspace.tsx");
  const routeFlow = source("RouteFlowWorkspace.tsx");
  const universe = source("ProcessUniverse3D.tsx");
  const workspace = source("ManufacturingUniverseWorkspace.tsx");
  assert.ok(processMap.includes("componentMaterialProcessLinks"));
  assert.ok(processMap.includes("linkedBom.partId===selectedPart.id"));
  assert.ok(processMap.includes("materialProcessPartLabels"));
  assert.ok(routeFlow.includes("materialProcessPartLabels"));
  assert.ok(routeFlow.includes("leg.poLineId===linePick"));
  assert.ok(routeFlow.includes("componentId===componentId"));
  assert.ok(universe.includes("materialPartLabels?.[link.id]"));
  assert.ok(universe.includes("materialLinksAt(operation.id"));
  assert.ok(workspace.includes("materialPartLabels={materialProcessPartLabels}"));
});

test("all nineteen Process Map visual modes are declared and exposed once in the visible selector", () => {
  const flow = source("LinkedProcessWorkspace.tsx");
  const typeMatch = flow.match(/const \[visualStyle,setVisualStyle\] = useState<([^>]+)>/);
  assert.ok(typeMatch);
  const declared = [...typeMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  const start = flow.indexOf('aria-label="All Process Map viewing modes"');
  const end = flow.indexOf(".map(option=><button", start);
  const block = flow.slice(start, end);
  const exposed = [...block.matchAll(/\{id:"([^"]+)",label:/g)].map(match => match[1]);
  assert.equal(declared.length, 19);
  assert.deepEqual([...exposed].sort(), [...declared].sort());
  assert.equal(new Set(exposed).size, 19);
});

test("all nine Route Flow layouts are selectable and shared by Process Map and Process Universe", () => {
  const picker = source("RouteLayoutPicker.tsx");
  const declaredMatch = picker.match(/export type RouteLayoutMode = ([^;]+);/);
  const options = [...picker.matchAll(/<option value="([^"]+)">/g)].map(match => match[1]);
  const declared = [...declaredMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  assert.equal(declared.length, 9);
  assert.deepEqual([...options].sort(), [...declared].sort());
  assert.ok(source("RouteFlowWorkspace.tsx").includes("<RouteLayoutPicker"));
  assert.ok(source("ProcessUniverse3D.tsx").includes("<RouteLayoutPicker"));
  assert.ok(source("ManufacturingUniverseWorkspace.tsx").includes("ProcessUniverse3D"));
});

test("all eleven relationship tools and four relationship statuses are selectable in Route Flow", () => {
  const flow = source("RouteFlowWorkspace.tsx");
  const types = ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];
  for (const type of types) assert.ok(flow.includes('id:"' + type + '"'));
  for (const status of ["Active","Planned","Conditional","Disabled"]) assert.ok(flow.includes('"' + status + '"'));
  assert.ok(flow.includes("Relationship Types (11)"));
});

test("Route Flow exposes 3D/list, vertical layout, independent edge types and record-popup actions", () => {
  const flow = source("RouteFlowWorkspace.tsx");
  assert.ok(flow.includes('useState<"3d" | "list">("3d")'));
  assert.ok(flow.includes("setVertical"));
  assert.ok(flow.includes("transportPopupAnchor"));
  assert.ok(flow.includes("onTransportClick"));
  assert.ok(flow.includes("TransportRecordInspector"));
  assert.ok(flow.includes("MaterialTransportRecordInspector"));
});

test("Manufacturing Universe exposes export formats, field visibility and a transport-record inspector", () => {
  const universe = source("ManufacturingUniverseWorkspace.tsx");
  const graph = source("ProcessUniverse3D.tsx");
  for (const format of ["svg","png","pdf","csv","json"]) assert.ok(universe.includes('value="' + format + '"'));
  assert.ok(universe.includes("visibleUniverseFields"));
  assert.ok(universe.includes("TransportRecordInspector"));
  assert.ok(universe.includes("MaterialTransportRecordInspector"));
});
