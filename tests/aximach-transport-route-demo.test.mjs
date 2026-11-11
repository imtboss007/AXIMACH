import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-transport-routing-demo.json", import.meta.url), "utf8"));

test("one component can carry multiple transport legs to different process steps and route branches", () => {
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.liveSeed, false);
  const operations = new Map(fixture.operations.map(row => [row.id, row]));
  const routes = new Map(fixture.transportRoutes.map(row => [row.id, row]));
  assert.ok(fixture.transportLegs.length >= 6);
  assert.equal(new Set(fixture.transportLegs.map(row => row.componentId)).size, 1);
  assert.equal(new Set(fixture.transportLegs.map(row => row.poLineId)).size, 1);
  assert.ok(new Set(fixture.transportLegs.map(row => row.anchorOperationId)).size >= 5);
  for (const leg of fixture.transportLegs) {
    assert.equal(leg.componentId, fixture.component.id);
    assert.equal(leg.poId, fixture.purchaseOrder.id);
    assert.equal(leg.poLineId, fixture.component.poLineId);
    assert.ok(routes.has(leg.routeId), "each transport leg resolves a saved route ID");
    assert.equal(routes.get(leg.routeId).vendorId, leg.vendorId);
    if (leg.anchorOperationId) assert.ok(operations.has(leg.anchorOperationId), "each anchored leg resolves its exact operation ID");
  }
});

test("vehicle classes have individual visual identities and separate transport popups", () => {
  const visuals = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../src/TransportDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const flow = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  for (const type of ["2-wheeler", "3-wheeler", "4-wheeler", "Mini truck", "Heavy truck", "Container truck"]) assert.ok(visuals.includes(type));
  assert.ok(visuals.includes("TransportLegMarker"));
  assert.ok(directory.includes("<VehicleBadge vehicleType={route.vehicleType}/>"));
  assert.ok(flow.includes("transportLegsAt(operation.id,\"before\")"));
  assert.ok(flow.includes("transportLegsAt(operation.id,\"after\")"));
  assert.ok(universe.includes('transportFor(operation.id,"before")'));
  assert.ok(universe.includes('transportFor(operation.id,"after")'));
});

test("route views fit smaller cards, expose portrait step navigation and support landscape fullscreen", () => {
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.match(css, /process-route-flow-track\{display:flex;align-items:stretch;flex-wrap:wrap/);
  assert.match(css, /\.process-route-index\{position:sticky/);
  assert.match(css, /\.linked-route-canvas:fullscreen/);
  assert.match(css, /\.process-universe-stage\{width:100% !important;min-width:0 !important/);
  assert.ok(workspace.includes('orientation.lock("landscape")'));
  assert.ok(workspace.includes('className="process-route-index"'));
  assert.ok(universe.includes("process-universe-node-track"));
});

test("multi-route example is visible and interactive in both Process Map and Transport Directory without live writes", () => {
  const demo = readFileSync(new URL("../src/TransportRoutingDemo.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../src/TransportDirectoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("<TransportRoutingDemo onClose="));
  assert.ok(directory.includes("<TransportRoutingDemo onClose="));
  assert.ok(demo.includes("Next process step"));
  assert.ok(demo.includes("Activate alternate supplier route"));
  assert.ok(demo.includes("No company, PO, component, vendor, material, BOM, material-process link"));
  assert.ok(demo.includes("TransportLegMarker"));
});

test("Module Universe cards remain compact and scroll within the viewport", () => {
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.ok(styles.includes(".module-universe .universe-grid{grid-template-columns:repeat(auto-fill"));
  assert.ok(styles.includes(".module-universe .universe-card{min-height:76px"));
  assert.ok(styles.includes("orientation:landscape) and (max-height:600px"));
});

test("portrait operation navigation is available in Route Flow, node Process Map and Manufacturing Universe", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(workspace.includes('className="process-route-index"'));
  assert.ok(workspace.includes('className="linked-process-index"'));
  assert.ok(universe.includes('className="process-universe-index"'));
  assert.match(css, /linked-node-scroll\{display:grid;grid-template-columns:42px minmax\(0,1fr\)/);
  assert.match(css, /process-universe-viewport\{display:grid;grid-template-columns:42px minmax\(0,1fr\)/);
});

test("Transport & Dispatch also displays the shared multi-route demo and vehicle-specific icon", () => {
  const dispatch = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(dispatch.includes("<TransportRoutingDemo onClose="));
  assert.ok(dispatch.includes("<VehicleBadge vehicleType={row.vehicle}/>"));
});

test("every supported vehicle category is displayed with a permanent visual identity", () => {
  const visuals = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  const demo = readFileSync(new URL("../src/TransportRoutingDemo.tsx", import.meta.url), "utf8");
  assert.ok(visuals.includes('if (/heavy.?duty/.test(value))'));
  assert.ok(demo.includes("{VEHICLE_TYPES.map(type=><VehicleBadge"));
  for (const type of ["2-wheeler","3-wheeler","4-wheeler","Light commercial vehicle","Mini truck","Heavy-duty 4-wheeler","Heavy truck","Container truck","Trailer / tractor","Bus / staff vehicle","Courier / delivery"]) assert.ok(visuals.includes(type));
});

test("courier/delivery and 2-wheeler use separate vehicle colours", () => {
  const visuals = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  assert.ok(visuals.includes('if (/courier|delivery/.test(value))'));
  assert.ok(visuals.includes('color: "#B56BC5"'));
  assert.ok(visuals.includes('color: "#D49A2D"'));
});


test("every transport category keeps a unique stable colour in Process Map, Route Flow and Manufacturing Universe", () => {
  const visuals = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const visualBlock = visuals.slice(visuals.indexOf("export function getVehicleVisual"), visuals.indexOf("export function VehicleIcon"));
  const colors = [...visualBlock.matchAll(/color: "(#[A-Fa-f0-9]+)"/g)].map(match => match[1]);
  assert.equal(colors.length, 12, "11 supported vehicle categories plus one fallback identity must have colours");
  assert.equal(new Set(colors).size, 12, "every vehicle category and fallback must have a distinct identity colour");
  assert.ok(universe.includes("<VehicleTypeIcon vehicleType={route.vehicle}"));
  assert.ok(universe.includes("<VehicleTypeIcon vehicleType={leg.vehicleType}"));
  assert.ok(scene.includes("<VehicleTypeIcon vehicleType={route.vehicle}"));
  assert.ok(scene.includes("<VehicleTypeIcon vehicleType={leg.vehicleType}"));
  assert.ok(routeFlow.includes("<VehicleTypeIcon vehicleType={vehicleType}"));
});

test("Manufacturing Universe does not render a material-entry transport leg twice", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("!leg.materialEntryId&&leg.anchorOperationId"));
  assert.ok(universe.includes("onSelectMaterialTransport"));
  assert.ok(universe.includes("onSelectTransportLeg"));
});


test("Route Flow transport markers are compact vehicle-only icons; details stay in the popup", () => {
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(routeFlow.includes('!transport&&<small>{label||relationLabel(type)}</small>'));
  assert.ok(!routeFlow.includes('<small>{transport?(vehicleType||"TRANSPORT")'));
  assert.ok(routeFlow.includes('<VehicleTypeIcon vehicleType={vehicleType} size={17}/>'));
  assert.ok(routeFlow.includes('tripCount+" trip(s) · Open details"'));
  assert.ok(css.includes("width:27px;height:27px;padding:3px;border:1px solid #c9e0f5;border-radius:8px"));
});
