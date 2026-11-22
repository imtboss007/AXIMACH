import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("Route Flow React Flow graph preserves every route-stage kind and its existing actions", () => {
  const flow = source("src/RouteFlowWorkspace.tsx");
  assert.match(flow, /const routeFlowGraph = useMemo\(/);
  assert.match(flow, /const nodes:RouteFlowGraphNode\[\]=routeNodes\.map\(/);
  assert.match(flow, /const edges:Edge\[\]=routeNodes\.slice\(0,-1\)\.map\(/);
  for (const kind of ["operation", "material", "material-transport", "transport", "missing-material"]) {
    assert.ok(flow.includes('node.kind==="' + kind + '"'), "Route Flow graph must map " + kind + " stages.");
  }
  assert.ok(flow.includes("setEditingOperation(node.operation)"), "Operation node must retain its edit action.");
  assert.ok(flow.includes("setInspectedTransportId(node.leg.id)"), "Transport node must open its saved transport record.");
  assert.ok(flow.includes("setInspectedMaterialTransportId(node.entry.id)"), "Material inbound transport node must open its saved record.");
  assert.ok(flow.includes("connectorFor(index)"), "Graph edges must use the existing route relationship/transport connector resolver.");
  assert.ok(flow.includes('data-testid="route-flow-react-canvas"'));
  assert.ok(flow.includes('routeCanvasMode==="graph"'));
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
  assert.ok(scene.includes('import { relaxProcessSceneLabels } from "./processSceneLabelLayout.js"'));
  assert.ok(scene.includes('kind:"catalogue" as const'));
  assert.ok(scene.includes('const projectedCatalogue=projectedLayout.catalogues'));
  assert.ok(scene.includes('relaxProcessSceneLabels(all,w,h)'));
  assert.ok(scene.includes('anchor:item.screen'));
  assert.ok(scene.includes('item.anchor??item.screen'), "Edge endpoints must keep the original WebGL projection after label decluttering.");
  assert.ok(layout.includes('catalogue: { width: 168, height: 96 }'));
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
