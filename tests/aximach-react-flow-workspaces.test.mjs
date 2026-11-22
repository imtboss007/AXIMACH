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
  assert.ok(graph.includes("onNavigate(node.moduleId,node.context)"), "Selecting an ecosystem record must open its source module with record context.");
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
