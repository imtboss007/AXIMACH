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
  assert.ok(scene.includes("drawFactoryMachine(factoryBatches,p,op"));
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
  assert.ok(visual.includes(".process-map-graph-canvas .react-flow__edge.animated .react-flow__edge-path"));
  assert.ok(visual.includes("@media(prefers-reduced-motion:reduce)"));
});


test("Phone Process Map opens the compact PO-line graph and preserves the collapsible 3D scene",()=>{
  const map=source("src/LinkedProcessWorkspace.tsx");
  assert.match(map,/matchMedia\("\(pointer:coarse\)"\)\.matches && window\.matchMedia\("\(orientation:portrait\)"\)\.matches \? "graph"/);
  assert.ok(map.includes('["graph","sphere","cube"'),"The 3D universe must remain available from graph-first mode.");
  assert.ok(map.includes("compactViewport?28+row*185:100+index*230"),"Phone graph nodes must use compact placement.");
  assert.ok(map.includes("fitView fitViewOptions={{padding:.14,minZoom:.26,maxZoom:1.2}}"));
});

test("Route Flow applies the selected layout to the live graph, preserves explicit transport endpoints and enables pinch zoom",()=>{
  const flow=source("src/RouteFlowWorkspace.tsx");
  assert.ok(flow.includes('import { buildRouteFlowOperationPositions } from "./routeFlowLayout.js"'));
  assert.ok(flow.includes("buildRouteFlowOperationPositions(lineOperations,routeLayout,portrait)"));
  assert.ok(flow.includes("},[routeNodes,routeMaterials,routeLegs,routeOperations,relationships,branch,vendors,routeLayout,workspaceTheme])"));
  assert.ok(flow.includes("const graphEdgeType=routeLayout==="));
  assert.ok(flow.includes("zoomOnScroll zoomOnPinch preventScrolling"));
  assert.ok(flow.includes("maxZoom={2.8}"));
  assert.ok(flow.includes("<RouteConnectorLegend/>"));
  assert.ok(flow.includes("RouteFlowFitController revision={routeLayout+"));
  assert.ok(flow.includes("targetOperationId"),"Transport destinations must remain explicit saved references.");
  assert.ok(flow.includes('markerEnd:{type:MarkerType.ArrowClosed,color:style.color,width:18,height:18}'));
  assert.ok(flow.includes("strokeWidth:type===\"transport\"?3.4:3.8"));
});

test("Every selected route layout yields stable compact positions and retains saved branch parent anchors",async()=>{
  const {buildRouteFlowOperationPositions}=await import("../src/routeFlowLayout.js");
  const operations=[
    {id:"m1",sequence:1,branch:"Main route",relationType:"main",plannedStart:"2026-11-24T08:00:00Z"},
    {id:"m2",sequence:2,branch:"Main route",relationType:"main",plannedStart:"2026-11-25T08:00:00Z"},
    {id:"m3",sequence:3,branch:"Main route",relationType:"main",plannedStart:"2026-11-26T08:00:00Z"},
    {id:"a1",sequence:1,branch:"Alternate route",relationType:"alternate",parentId:"m1",plannedStart:"2026-11-24T12:00:00Z"},
    {id:"r1",sequence:1,branch:"Rework route",relationType:"rework",parentId:"m2",plannedStart:"2026-11-25T12:00:00Z"}
  ];
  const layouts=["orthogonal","s-curve","horizontal","vertical","swimlane","timeline","radial","circular","organic"];
  const results=new Map();
  for(const layout of layouts){
    const points=buildRouteFlowOperationPositions(operations,layout,true);
    assert.deepEqual(Object.keys(points).sort(),operations.map(row=>row.id).sort());
    assert.equal(new Set(Object.values(points).map(point=>point.x+":"+point.y)).size,operations.length,layout+" must not overlap every node at one point");
    assert.deepEqual(points,buildRouteFlowOperationPositions(operations,layout,true),layout+" must be deterministic");
    results.set(layout,points);
  }
  assert.notDeepEqual(results.get("horizontal"),results.get("vertical"));
  assert.notDeepEqual(results.get("orthogonal"),results.get("s-curve"));
  assert.notDeepEqual(results.get("radial"),results.get("circular"));
  assert.ok(results.get("horizontal").a1.x>results.get("horizontal").m1.x,"Alternate branch keeps its saved parent as its visual origin.");
  assert.ok(results.get("vertical").a1.y>results.get("vertical").m1.y,"Vertical alternate branch follows its saved parent.");
  const phone=buildRouteFlowOperationPositions(operations,"horizontal",true);
  const desktop=buildRouteFlowOperationPositions(operations,"horizontal",false);
  assert.ok(desktop.m2.x-phone.m2.x>0,"Compact and desktop spacing must be independently tuned.");
});

test("Route Flow contrast, touch and vehicle marker rules remain explicit",()=>{
  const visual=source("src/aximach-visual-fixes.css");
  const flow=source("src/RouteFlowWorkspace.tsx");
  const legend=source("src/RouteConnectorLegend.tsx");
  assert.ok(visual.includes(".route-flow-graph-canvas .react-flow__pane"));
  assert.ok(visual.includes("touch-action:none!important"));
  assert.ok(visual.includes('data-workspace-theme="dark"'));
  assert.ok(visual.includes('data-workspace-theme="light"'));
  assert.ok(visual.includes('width:25px!important;height:25px!important'));
  assert.ok(!visual.includes("width:248px!important"));
  assert.ok(!visual.includes("width:242px!important"));
  assert.ok(flow.includes("className:{\"route-flow-edge route-flow-edge-\"+type}"));
  for(const kind of ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor","material","transport"]){
    assert.ok(legend.includes('"'+kind+'"'),"Missing full legend connector "+kind);
  }
});

test("Process Map uses one connector legend and the 3D scene remains enlarged and touch-safe",()=>{
  const map=source("src/LinkedProcessWorkspace.tsx");
  const scene=source("src/ProcessScene3D.tsx");
  const visual=source("src/aximach-visual-fixes.css");
  assert.ok(map.includes("<RouteConnectorLegend compact/>"));
  assert.ok(!map.includes("<RouteConnectorLegend compact/><RouteConnectorLegend/>"));
  assert.ok(scene.includes('perspective(.74'));
  assert.ok(scene.includes("-4.15"));
  assert.ok(scene.includes('touchAction:"none"'));
  assert.ok(visual.includes(".process-scene-zoom-viewport"));
  assert.ok(visual.includes(".ax-full3d-transport-icon{width:25px"));
});

test("Manufacturing Universe SVG export includes visible themed relationship paths",()=>{
  const graph=source("src/ManufacturingEcosystemGraph.tsx");
  assert.ok(graph.includes("getComputedStyle(document.documentElement)"));
  assert.ok(graph.includes('stroke-width="2.2"'));
  assert.ok(graph.includes('marker-end="url(#ax-arrow)"'));
  assert.ok(graph.includes('fill="#ffffff"'));
  assert.ok(graph.includes("setTimeout(()=>URL.revokeObjectURL(url),1200)"));
});

test("Manufacturing graphs use theme-aware readable text, compact material panels and mobile fullscreen controls",()=>{
  const visual=source("src/aximach-visual-fixes.css");
  for(const selector of [".ax-ecosystem-flow-node small",".route-flow-graph-node>small",".process-map-graph-card>small"]) {
    assert.ok(visual.includes(selector),"Missing high-contrast text rule: "+selector);
  }
  assert.ok(visual.includes(".ax-map-fullscreen-shell:fullscreen .route-flow-graph-canvas"));
  assert.ok(visual.includes(".linked-route-canvas:fullscreen .process-map-graph-canvas"));
  assert.ok(visual.includes(".process-material-route-row{"));
  assert.ok(visual.includes("grid-template-columns:minmax(0,1fr)!important"));
});


test("Route Flow workspace contains one integrated showcase for every saved relationship type plus material and transport",()=>{
  const route=source("src/RouteFlowWorkspace.tsx");
  const showcase=source("src/RouteFlowShowcase.tsx");
  assert.ok(route.includes('import { RouteFlowShowcase } from "./RouteFlowShowcase"'));
  assert.ok(route.includes("<RouteFlowShowcase/>"));
  for(const kind of ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor","material","transport"]){
    assert.ok(showcase.includes(kind),"Missing route pattern or flow key: "+kind);
  }
  for(const example of ["end-to-end","main","alternate","rework","parallel","split","merge","conditional","dependency","follow-on","feedback","successor","material","transport"]){
    assert.ok(showcase.includes('id:"'+example+'"'),"Missing sample flow: "+example);
  }
  assert.ok(showcase.includes("<strong>14</strong><small>FLOW PATTERNS</small>"));
});

test("Route Flow Showcase demonstrates all nine supported layout modes",()=>{
  const showcase=source("src/RouteFlowShowcase.tsx");
  for(const layout of ["orthogonal","s-curve","horizontal","vertical","swimlane","timeline","radial","circular","organic"]){
    assert.ok(showcase.includes('id:"'+layout+'"'),"Missing layout mode: "+layout);
  }
  assert.ok(showcase.includes("Flow layout styles"));
  assert.ok(showcase.includes("setSelectedLayout"));
});

test("Route Flow Showcase is a read-only example library and does not write PO or operation data",()=>{
  const showcase=source("src/RouteFlowShowcase.tsx");
  assert.ok(showcase.includes("DEMONSTRATION ONLY"));
  assert.ok(showcase.includes("NO PO / OPERATION RECORDS MODIFIED"));
  assert.ok(!showcase.includes("useManufacturingData"));
  assert.ok(!showcase.includes("update("));
  assert.ok(showcase.includes("aria-pressed"));
  assert.ok(showcase.includes("aria-selected"));
});

test("Route Flow Showcase includes responsive cards and contrast-aware styling",()=>{
  const visual=source("src/aximach-visual-fixes.css");
  for(const selector of [".route-flow-showcase",".route-flow-showcase-preview",".route-flow-showcase-card",".route-flow-showcase-legend"]){
    assert.ok(visual.includes(selector),"Missing showcase style: "+selector);
  }
  assert.ok(visual.includes("@media(max-width:600px)"));
  assert.ok(visual.includes("var(--ax-theme-text"));
});
