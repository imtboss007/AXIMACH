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
  for (const type of ["2-wheeler / Bike","3-wheeler / Auto rickshaw","Tempo / 3-wheeler goods carrier","Heavy-duty tempo","4-wheeler / Car","Mini truck","Lorry / goods truck","Heavy lorry","Heavy truck","Container truck","Trailer / tractor","Bus / staff vehicle"]) assert.ok(visuals.includes(type), "Missing vehicle option: "+type);
  assert.ok(visuals.includes("function VehicleSilhouette"), "Tempo, auto-rickshaw and lorry require dedicated vector silhouettes.");
  assert.ok(visuals.includes("heavy-tempo") && visuals.includes("three-wheeler") && visuals.includes("heavy-lorry"));
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
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(css, /process-route-flow-track\{display:flex;align-items:stretch;flex-wrap:wrap/);
  assert.match(css, /\.process-route-index\{position:sticky/);
  assert.match(css, /\.linked-route-canvas:fullscreen/);
  assert.match(css, /\.process-universe-stage\{width:100% !important;min-width:0 !important/);
  // Device orientation is owned by the app module lifecycle, not the
  // map-only fullscreen control inside LinkedProcessWorkspace.
  assert.ok(app.includes('activeModuleId === "process-map"'));
  assert.ok(app.includes('activeModuleId === "route-flow"'));
  assert.ok(app.includes('activeModuleId === "manufacturing-universe"'));
  assert.ok(app.includes('requestDeviceOrientation(next ? "landscape-primary" : "portrait-primary")'), "Landscape is requested only from the explicit user-controlled workspace toggle.");
  assert.ok(workspace.includes("The app-level landscape lock remains active until Process Map is closed."));
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
  assert.ok(visuals.includes('if(/heavy\\s*(?:duty\\s*)?tempo|tempo\\s*heavy/.test(value))'));
  assert.ok(demo.includes("{VEHICLE_TYPES.map(type=><VehicleBadge"));
  for (const type of ["2-wheeler","3-wheeler","4-wheeler","Light commercial vehicle","Mini truck","Heavy-duty tempo","Lorry / goods truck","Heavy lorry","Heavy truck","Container truck","Trailer / tractor","Bus / staff vehicle","Courier / delivery van"]) assert.ok(visuals.includes(type));
});

test("courier/delivery uses a van identity while bike and auto use their own types", () => {
  const visuals = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  assert.ok(visuals.includes('courier|delivery\\s*van'));
  assert.ok(visuals.includes('color:"#299A70"'));
  assert.ok(visuals.includes('color:"#D49A2D"'));
  assert.ok(visuals.includes('color:"#16A6A0"'));
});


test("every transport category keeps a unique stable colour in Process Map, Route Flow and Manufacturing Universe", () => {
  const visuals = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const transportInspector = readFileSync(new URL("../src/TransportRecordInspector.tsx", import.meta.url), "utf8");
  const materialInspector = readFileSync(new URL("../src/MaterialTransportRecordInspector.tsx", import.meta.url), "utf8");
  const visualBlock = visuals.slice(visuals.indexOf("const VEHICLE_VISUALS"), visuals.indexOf("function resolveVehicleKind"));
  const colors = [...visualBlock.matchAll(/color:"(#[A-Fa-f0-9]+)"/g)].map(match => match[1]);
  assert.equal(colors.length, 18, "every canonical vehicle class must have an explicit colour");
  assert.equal(new Set(colors).size, 18, "every canonical vehicle class must have a distinct identity colour");
  assert.ok(universe.includes("<VehicleTypeIcon vehicleType={route.vehicle}"));
  assert.ok(universe.includes("<VehicleTypeIcon vehicleType={leg.vehicleType}"));
  assert.ok(scene.includes("<VehicleTypeIcon vehicleType={route.vehicle}"));
  assert.ok(scene.includes("<VehicleTypeIcon vehicleType={leg.vehicleType}"));
  assert.ok(routeFlow.includes("<VehicleTypeIcon vehicleType={vehicleType}"));
  assert.ok(transportInspector.includes("<VehicleTypeIcon vehicleType={leg.vehicleType}"));
  assert.ok(materialInspector.includes('<VehicleTypeIcon vehicleType={entry.transportVehicleType||""}'));
});

test("Manufacturing Universe does not render a material-entry transport leg twice", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("!leg.materialEntryId&&leg.anchorOperationId"));
  assert.ok(universe.includes("onSelectMaterialTransport"));
  assert.ok(universe.includes("onSelectTransportLeg"));
});


test("legacy transport legs without a PO-line ID remain visible only when the component has one unambiguous PO line", () => {
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(routeFlow.includes("(!leg.poLineId&&componentGlobalLineCount===1)"));
  assert.ok(processMap.includes("(!leg.poLineId&&selectedComponentLineCount===1)"));
  assert.ok(processMap.includes("(!leg.poLineId&&selectedComponentLineCount===1)||exportOperations.some"));
});

test("explicit transport destinations are shown in 2D route views and honoured across 3D branch geometry", () => {
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(routeFlow.includes("node.leg.targetOperationId"));
  assert.ok(routeFlow.includes("route-flow-transport-target"));
  assert.ok(processMap.includes('leg.targetOperationId&&<small className="process-route-flow-transport-target"'));
  assert.ok(scene.includes("const branchRows=lineRows.filter"));
  assert.ok(scene.includes('const toOperation=target||(leg.placement==="start"'));
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


test("Process Map relationship semantics survive inserted material and transport stages", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("previousOperationByRouteNode[index]"));
  assert.ok(processMap.includes("nextOperationByRouteNode[index]"));
  assert.ok(processMap.includes("const savedRelationship=fromOperation&&toOperation?"));
});

test("explicit typed route relationships replace duplicate implicit 3D edges and survive material/transport routing", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("explicitRelationshipPairs"));
  assert.ok(universe.includes("if (!explicitRelationshipPairs.has(pairId))"));
  assert.ok(universe.includes("validRouteRelationships"));
  assert.ok(scene.includes('!String(edge.id||"").startsWith("relationship-")&&replacedOperationEdges.has'));
});


test("explicit transport sender and receiver IDs persist without inferring the next displayed operation", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const operations = new Map(fixture.operations.map(row=>[row.id,row]));
  const crossBranch = fixture.transportLegs.find(leg=>leg.anchorOperationId && leg.targetOperationId &&
    operations.get(leg.anchorOperationId)?.branch !== operations.get(leg.targetOperationId)?.branch);
  assert.ok(crossBranch, "fixture must exercise a transport hand-off between main and alternate branches");
  assert.ok(operations.has(crossBranch.anchorOperationId), "sending operation ID must resolve");
  assert.ok(operations.has(crossBranch.targetOperationId), "receiving operation ID must resolve");
  assert.ok(processMap.includes('setTransportTargetOperationId(leg?.targetOperationId || "")'));
  assert.ok(processMap.includes('targetOperationId: receivingOperation?.id || undefined'));
  assert.ok(processMap.includes('label="Sending process (from)"'));
  assert.ok(processMap.includes('label="Receiving process (to) · optional"'));
  assert.ok(processMap.includes('Destinations are never inferred from display order.'));
});

test("Route Flow never infers a transport receiver from the next displayed operation", () => {
  const routeFlow = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(routeFlow.includes('const target=operationFor(leg.targetOperationId||"")'));
  assert.ok(!routeFlow.includes("inferredTarget"), "The next displayed operation is not a valid transport destination.");
  assert.ok(routeFlow.includes('if(target)addEdge(transportId,target.id,"transport","transport-to:"+leg.id'));
});
