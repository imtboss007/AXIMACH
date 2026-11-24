import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Route Flow React Flow graph draws all PO-line branches and persisted relationship links", () => {
  const flow = source("src/RouteFlowWorkspace.tsx");
  assert.match(flow, /const routeFlowGraph = useMemo\(/);
  assert.match(flow, /const graphSource:FlowNode\[\]=\[/);
  assert.match(flow, /const nodes:RouteFlowGraphNode\[\]=uniqueSource\.map\(/);
  for (const kind of ["operation", "material", "material-transport", "transport", "missing-material"]) {
    assert.ok(flow.includes('node.kind==="' + kind + '"'), "Route Flow graph must map " + kind + " stages.");
  }
  assert.ok(flow.includes("setEditingOperation(node.operation)"), "Operation node must retain its edit action.");
  assert.ok(flow.includes("setInspectedTransportId(node.leg.id)"), "Transport node must open its saved transport record.");
  assert.ok(flow.includes("setInspectedMaterialTransportId(node.entry.id)"), "Material inbound transport node must open its saved record.");
  assert.ok(flow.includes('relationships.filter(link=>link.status!=="Disabled")'), "Enabled and planned saved relationships must become graph edges.");
  assert.ok(flow.includes("addEdge(link.fromOperationId,link.toOperationId,link.relationshipType"), "Relationship edges must preserve their saved type.");
  assert.ok(flow.includes('data-testid="route-flow-react-canvas"'));
  assert.ok(flow.includes('routeCanvasMode==="graph"'));
  assert.ok(flow.includes('useState<"cards"|"graph">("graph")'), "The branch-aware interactive graph is the default Route Flow view.");
});

test("Process Map graph is scoped to the selected PO line and preserves branch, BOM and transport relationships", () => {
  const map = source("src/LinkedProcessWorkspace.tsx");
  assert.match(map, /const processMapGraph = useMemo\(/);
  assert.ok(map.includes('link.poId===poId&&link.poLineId===selectedLine?.id&&link.componentId===selectedLine?.componentId&&link.status!=="Disabled"'),
    "Saved route relationships must be restricted to the selected PO line and component.");
  assert.ok(map.includes("exportBranches.map"), "Each active route branch must receive its own graph lane.");
  assert.ok(map.includes('kind:"BRANCH ORIGIN REFERENCE"'), "Out-of-scope branch parents must remain visible as reference nodes.");
  assert.ok(map.includes('kind:"MATERIAL PROCUREMENT"'), "Material allocations must appear as independent graph nodes.");
  assert.ok(map.includes('kind:"MATERIAL → PROCESS LINK"'), "BOM-to-process links must appear as independent graph nodes.");
  assert.ok(map.includes('kind:"TRANSPORT LEG"'), "Transport legs must appear as independent graph nodes.");
  assert.ok(map.includes('id:"branch-origin:"+origin.parent.id+":"+origin.branchRoot.id'), "Alternate/rework branch origin edges must be retained.");
  assert.ok(map.includes('id:"material-allocation:"+entry.id'), "Material allocation edges must be retained.");
  assert.ok(map.includes('id:"bom-link-edge:"+link.id'), "BOM-to-process edges must be retained.");
  assert.ok(map.includes('id:"transport-from-material:"+leg.id') && map.includes('id:"transport-to-operation:"+leg.id'),
    "Material-sourced transport must connect through the transport leg to its receiving operation.");
  assert.ok(map.includes('data-testid="process-map-react-canvas"'));
  assert.ok(map.includes('onAction:()=>{setSelectedOperationId(operation.id);setShowEditor(false);}'),
    "Process operation graph nodes must select the corresponding saved operation.");
  assert.ok(map.includes('setInspectedTransportId(leg.id)'), "Transport graph nodes must open their saved detail inspector.");
});

test("Manufacturing Universe graph retains cross-register record navigation and graph preference controls", () => {
  const graph = source("src/ManufacturingEcosystemGraph.tsx");
  assert.ok(graph.includes("getVisibleEcosystemNodes"));
  assert.ok(graph.includes("searchEcosystemNodes"));
  assert.ok(graph.includes("onNavigate(selected.moduleId,selected.context)"), "Selecting an ecosystem record must open its source module with record context.");
  assert.ok(graph.includes("ECOSYSTEM_FLOW_NODE_TYPES"));
  assert.ok(graph.includes("ECOSYSTEM_GRAPH_PREFERENCES_KEY") || graph.includes("GRAPH_PREFERENCES_KEY"));
  assert.ok(graph.includes('data-testid="ecosystem-flow-canvas"'));
});

test("synthetic multi-route fixture covers the graph relationship types without importing live demo data", () => {
  const fixture = JSON.parse(source("tests/fixtures/aximach-transport-routing-demo.json"));
  assert.equal(fixture.synthetic, true);
  assert.equal(fixture.liveSeed, false);
  assert.equal(fixture.operations.length, 8);
  assert.ok(fixture.operations.some(row => row.branch === "Main route"));
  assert.ok(fixture.operations.some(row => row.relationType === "alternate"));
  assert.equal(fixture.transportLegs.length, 6);
  assert.equal(fixture.materialProcessLinks.length, 3);
  assert.equal(new Set(fixture.materialProcessLinks.map(row => row.operationId)).size, 3);
  assert.ok(fixture.transportLegs.some(row => row.placement === "start"));
  assert.ok(fixture.transportLegs.some(row => row.placement === "before"));
  assert.ok(fixture.transportLegs.some(row => row.placement === "after"));
});


test("3D process label layout includes every node class in one shared collision pass", () => {
  const scene = source("src/ProcessScene3D.tsx");
  const layout = source("src/processSceneLabelLayout.js");
  assert.ok(scene.includes('import { processSceneLabelBounds, relaxProcessSceneLabels } from "./processSceneLabelLayout.js"'));
  assert.ok(scene.includes('kind:"catalogue" as const'));
  assert.ok(scene.includes('const projectedCatalogue=projectedLayout.catalogues'));
  assert.ok(scene.includes('relaxProcessSceneLabels(all,w,h,size.vw)'));
  assert.ok(scene.includes('anchor:item.screen'));
  assert.ok(scene.includes('item.anchor??item.screen'), "Edge endpoints must keep the original WebGL projection after label decluttering.");
  assert.ok(layout.includes('catalogue: { width: 184, height: 112 }'));
  assert.ok(layout.includes('core: { width: 140, height: 56 }'));
  assert.ok(layout.includes('findNearestFreeSlot'));
  assert.ok(layout.includes("packDenseLabels"));
});

test("short-landscape Route Flow and Manufacturing Universe keep navigation chrome off the canvas", () => {
  const css = source("src/aximach-ui.css");
  const app = source("src/App.tsx");
  const responsiveRule = css.slice(css.lastIndexOf("/* Short-landscape Route Flow and Manufacturing Universe"));
  assert.ok(responsiveRule.includes('@media (orientation:landscape) and (max-height:600px) and (max-width:1100px)'));
  assert.ok(responsiveRule.includes('.app-shell:has(.route-flow-workspace) .command-rail'));
  assert.ok(responsiveRule.includes('.app-shell:has(.manufacturing-universe-workspace) .command-rail'));
  assert.ok(responsiveRule.includes('display:none!important'));
  assert.ok(app.includes('onClick={openModuleExplorer}'), "The command-deck module explorer remains available for navigation.");
});


test("short-landscape graph canvases adapt to the available viewport and hide secondary minimaps", () => {
  const css = source("src/aximach-ui.css");
  const responsiveRule = css.slice(css.lastIndexOf("/* Short-landscape graph workspaces"));
  assert.ok(responsiveRule.includes("@media (orientation:landscape) and (max-height:600px) and (max-width:1100px)"));
  for (const canvas of [".route-flow-graph-canvas", ".process-map-graph-canvas", ".ax-ecosystem-flow-canvas"]) {
    assert.ok(responsiveRule.includes(canvas), "Missing short-landscape sizing for " + canvas);
  }
  assert.ok(responsiveRule.includes("height:clamp(220px,calc(100dvh - 160px),380px)"));
  assert.ok(responsiveRule.includes("min-height:220px"));
  assert.ok(responsiveRule.includes(".react-flow__minimap"));
  assert.ok(responsiveRule.includes("display:none!important"));
});


test("premium dashboard command layer is computed exclusively from saved operation and transport records", () => {
  const dashboard = source("src/DashboardWorkspace.tsx");
  const command = source("src/DashboardCommandLayer.tsx");
  assert.ok(dashboard.includes("<DashboardCommandLayer operations={ops}"));
  for (const field of ["completedQuantity={completion}", "plannedQuantity={planned}", "qualityHolds={holds.length}", "overdue={overdue.length}", "activeTransport={activeLegs.length}"]) assert.ok(dashboard.includes(field));
  for (const marker of ["data-testid=\"dashboard-command-graphics\"", "aria-valuenow={safePercent}", "operation.machine", "operation.category", "row.status === \"Running\""]) assert.ok(command.includes(marker));
  assert.ok(command.includes("Machine assignments are not recorded"));
});

test("factory floor mode renders manufacturing-specific selectable workcells and supports user motion controls", () => {
  const scene = source("src/ProcessScene3D.tsx"), universe = source("src/ProcessUniverse3D.tsx");
  assert.ok(scene.includes("factoryMachineKind"));
  for (const kind of ["machining", "lathe", "edm", "welding", "laser", "metrology", "workcell"]) assert.ok(scene.includes("\"" + kind + "\""));
  assert.ok(scene.includes("drawFactoryMachine(draw,p,op"));
  assert.ok(scene.includes("op.machine||(\"Workcell · \"+(op.category||\"General\"))"));
  assert.ok(universe.includes("id:\"factory\",label:\"Factory Floor\""));
  assert.ok(universe.includes("setAutoRotateEnabled") && universe.includes("setFlowMotionEnabled"));
  assert.ok(universe.includes("motionEnabled={flowMotionEnabled && !prefersReducedMotion}"));
  assert.ok(scene.includes("if(motionEnabled)"));
});

test("Route Flow graph animates only edges attached to real Running operation records", () => {
  const route = source("src/RouteFlowWorkspace.tsx"), visual = source("src/aximach-visual-fixes.css");
  assert.ok(route.includes('const animated=routeOperations.some(operation=>(operation.id===source||operation.id===target)&&operation.status==="Running")'));
  assert.ok(route.includes("label,animated,"));
  assert.ok(visual.includes(".route-flow-graph-canvas .react-flow__edge.animated .react-flow__edge-path"));
  assert.ok(visual.includes("@media(prefers-reduced-motion:reduce)"));
});
