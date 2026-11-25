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
  assert.ok(flow.includes('testId="route-flow-shared-canvas"'));
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
  assert.ok(map.includes('addEdge(sourceId,"operation:"+origin.branchRoot.id,relation,"branch-origin:"+origin.parent.id+":"+origin.branchRoot.id'), "Alternate/rework branch origin edges must be retained.");
  assert.ok(map.includes('addEdge(id,target,"main","material-allocation:"+entry.id'), "Material allocation edges must be retained.");
  assert.ok(map.includes('addEdge(source,target,"main","bom-link-edge:"+link.id'), "BOM-to-process edges must be retained.");
  assert.ok(map.includes('addEdge(materialId,id,"transport","transport-from-material:"+leg.id') && map.includes('addEdge(id,"operation:"+leg.targetOperationId,"transport","transport-to-operation:"+leg.id'),
    "Material-sourced transport must connect through the transport leg to its receiving operation.");
  assert.ok(map.includes('data-testid="process-map-react-canvas"'));
  assert.ok(map.includes('testId="process-map-react-flow"'));
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
  assert.ok(map.includes("compactViewport?48+index*248:96+index*278"),"Phone and desktop graph nodes must use the collision-spaced horizontal flow.");
  assert.ok(map.includes("400+row*820"),"Each component route branch gets a dedicated material/process/transport band.");
  assert.ok(map.includes("fitViewOptions={{padding:.12,minZoom:.12,maxZoom:1.2}}"));
});

test("Route Flow applies the selected layout to the live graph, preserves explicit transport endpoints and enables pinch zoom",()=>{
  const flow=source("src/RouteFlowWorkspace.tsx");
  assert.ok(flow.includes('import { buildRouteFlowOperationPositions } from "./routeFlowLayout.js"'));
  assert.ok(flow.includes("buildRouteFlowOperationPositions(lineOperations,routeLayout,portrait)"));
  assert.ok(flow.includes('window.addEventListener("orientationchange",syncViewport)'),"Phone rotation must recompute compact graph geometry.");
  assert.ok(flow.includes("workspaceTheme,compactGraphViewport])"),"Viewport changes must invalidate the live layout memo.");
  assert.ok(flow.includes("},[routeNodes,routeMaterials,routeLegs,routeOperations,relationships,branch,vendors,routeLayout,workspaceTheme,compactGraphViewport])"));
  assert.ok(flow.includes("routeRelationshipEdgeGeometry(type,nodeCenter(source),nodeCenter(target),routeLayout,parallelIndex)"),"Each edge must adapt to its real node geometry and selected route layout.");
  assert.ok(flow.includes("type:geometry.edgeType,label,animated"),"The edge path type must be selected per relationship.");
  assert.ok(flow.includes("pathOptions:geometry.pathOptions"),"Per-edge routing geometry must be carried in edge data.");
  assert.ok(flow.includes("zoomOnScroll") && flow.includes("zoomOnPinch"),"Route Flow must support wheel and pinch zoom through the shared graph.");
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
  assert.ok(flow.includes('className:"route-flow-edge route-flow-edge-"+type'));
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

test("one shared graph canvas renders every route type, material movement and vehicle-specific transport node",()=>{
  const shared=source("src/ManufacturingGraphCanvas.tsx");
  const route=source("src/RouteFlowWorkspace.tsx");
  const map=source("src/LinkedProcessWorkspace.tsx");
  const universe=source("src/ManufacturingEcosystemGraph.tsx");
  const layout=source("src/manufacturingGraphLayout.mjs");
  for(const surface of [route,map,universe]) assert.ok(surface.includes("ManufacturingGraphCanvas"),"All three spatial views use the shared graph canvas.");
  for(const type of ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor","transport"]) {
    assert.ok(layout.includes(type), "Shared connector layout is missing "+type);
  }
  assert.ok(route.includes("VehicleTypeIcon vehicleType={data.vehicleType||\"truck\"}"));
  assert.ok(map.includes('const vehicleType=data.vehicleType||"truck"') && map.includes('<VehicleTypeIcon vehicleType={vehicleType} size={15}/>'));
  assert.ok(map.includes('const transportId="material-transport:"+entry.id'),"Material inbound transport must be a distinct graph node.");
  assert.ok(map.includes("relationshipRows.forEach(link=>"),"Saved typed relationships must be rendered in the Process Map.");
  assert.ok(universe.includes("RouteConnectorLegend compact"),"Manufacturing Universe must show the full route-type legend.");
  assert.ok(universe.includes("relationshipRows")||universe.includes("routeLinks.forEach"),"Manufacturing Universe must include saved route relationships.");
  assert.ok(shared.includes("ReactFlowProvider")&&shared.includes("<ReactFlow"),"The reusable canvas owns the React Flow provider and renderer.");
});


test("Route Flow supports n8n-style drag-to-connect and persists typed PO-line relationships",()=>{
  const route=source("src/RouteFlowWorkspace.tsx");
  const shared=source("src/ManufacturingGraphCanvas.tsx");
  assert.ok(shared.includes("changes.applyTo(current)") && shared.includes('changes.getByType("position")'),"The shared canvas must keep draggable node positions controlled.");
  assert.ok(shared.includes("onConnect?:(connection:Connection)=>void"),"The shared canvas must expose React Flow connections.");
  assert.ok(shared.includes("onConnect={onConnect}"),"The shared canvas must forward connection events.");
  assert.ok(route.includes("const connectRouteNodes=(connection:Connection)=>{"),"Route Flow must handle drag-to-connect.");
  const connectors=source("src/manufacturingGraphConnections.ts");
  assert.ok(route.includes("connectManufacturingGraphNodes"),"Route Flow must use the shared manufacturing connection contract.");
  assert.ok(connectors.includes('routeRelationships:[...(current.routeRelationships||[]),record]'),"Operation connections must persist in the shared route relationship model.");
  assert.ok(connectors.includes("anchorOperationId:operation.id"),"Material/process links must persist on material allocation records.");
  assert.ok(connectors.includes("targetOperationId:operation.id"),"Transport receiving links must persist on transport-leg records.");
  assert.ok(connectors.includes("operationId:operation.id"),"Quality links must persist on inspection records.");
  assert.ok(connectors.includes("vendorId:vendor.id"),"Vendor assignments must persist on their owning records.");
  assert.ok(route.includes("nodesDraggable\n          nodesConnectable\n          onConnect={connectRouteNodes}"),"The Route Flow canvas must enable node dragging and connector handles.");
  assert.ok(route.includes("connectManufacturingGraphNodes"),"Material, transport and quality links are handled by the shared typed connector.");
});


test("Manufacturing Universe supports typed n8n-style operation connections without linking unrelated records",()=>{
  const graph=source("src/ManufacturingEcosystemGraph.tsx");
  const universe=source("src/ManufacturingUniverseWorkspace.tsx");
  assert.ok(graph.includes('const connectable=data.kind==="operation"||data.kind==="material"||data.kind==="transport"||data.kind==="quality"||data.kind==="vendor"||data.kind==="process"'),"Operation, material, transport, quality, vendor and process nodes expose typed connector handles.");
  assert.ok(graph.includes("nodesConnectable")&&graph.includes("onConnect={connection=>onConnect?.(connection,relationshipType)}"),"The Universe graph forwards drag connections with the selected relationship type.");
  assert.ok(graph.includes('aria-label="New manufacturing connection type"'),"The relationship type is selectable.");
  assert.ok(graph.includes("scope?.poLineId")&&graph.includes("matchesLine"),"The Universe graph is scoped to the selected PO component line.");
  assert.ok(universe.includes("const connectUniverseOperations=(connection:Connection,relationshipType:string)=>{"),"The Universe workspace must use the shared graph connection handler.");
  assert.ok(universe.includes("scope:{companyId,poId,poLineId,componentId}"),"The Universe must pass the selected company, PO and component scope.");
  assert.ok(universe.includes("onConnect={connectUniverseOperations}"),"The Universe graph is wired to the shared data update.");
});


test("Manufacturing Universe is scoped to the selected component and uses the named Manufacturing Graph view",()=>{
  const graph=source("src/ManufacturingEcosystemGraph.tsx");
  const workspace=source("src/ManufacturingUniverseWorkspace.tsx");
  assert.ok(graph.includes("scope?:GraphScope"),"The graph accepts an explicit manufacturing scope.");
  assert.ok(graph.includes("const scoped=Boolean(scope?.companyId||scope?.poId||scope?.poLineId||scope?.componentId)"));
  assert.ok(graph.includes("const matchesLine="),"Every line-level collection is filtered by the active component route.");
  assert.ok(graph.includes("columns:mobile?2:4"),"The mobile graph layout must use fewer horizontal groups.");
  assert.ok(graph.includes("minZoom:.28"),"The mobile graph must not auto-shrink the whole unfiltered company database to unreadable size.");
  assert.ok(workspace.includes("scope={{companyId,poId,poLineId,componentId}}"));
  assert.ok(workspace.includes("Manufacturing Graph"),"The old Ecosystem tab is replaced by the Manufacturing Graph label.");
  assert.ok(workspace.includes('useState<"ecosystem"|"route"|"preview">("ecosystem")'),"Manufacturing Universe exposes the live graph, single-component preview and animated 3D route.");
  assert.ok(workspace.includes("const defaultPO=!context.poId&&!context.poLineId&&!context.operationId"),"An unscoped visit must select one available live PO instead of rendering the entire company database.");
  assert.ok(workspace.includes("targetPO?.lines.find(row=>!row.deletedAt)"),"An unscoped visit must open the first active component line in that PO.");
  assert.ok(workspace.includes("<SingleComponentRouteGraphDemo/>"),"The one-company, one-PO, one-component preview must be directly available inside Manufacturing Universe.");
});

test("the retired two-company demo importer is removed and reserved DEMO records are archived without touching real IDs",()=>{
  const data=source("src/manufacturingData.ts");
  const importer=source("src/IntelligenceWorkspaces.tsx");
  const exchange=source("src/App.tsx");
  assert.ok(data.includes('marker = "aximach.demo-data-cleanup.v3"'));
  assert.ok(data.includes('row.id.startsWith("DEMO-")'));
  assert.ok(data.includes("supplierFinanceApprovals:archiveRows(canonical.supplierFinanceApprovals)"));
  assert.ok(!importer.includes("loadTwoCompanyDemo"));
  assert.ok(!importer.includes("createAxMachTwoCompanyDemo"));
  assert.ok(importer.includes("One-company / one-PO / one-component manufacturing preview"));
  assert.ok(!exchange.includes("Import Demo Factory"));
});

test("process definitions use stable distinct category colours instead of the legacy shared blue",()=>{
  const palette=source("src/processPalette.ts");
  const directory=source("src/SpecializedDirectoryWorkspace.tsx");
  const route=source("src/RouteFlowWorkspace.tsx");
  const universe=source("src/ManufacturingEcosystemGraph.tsx");
  assert.ok(palette.includes("CATEGORY_COLOURS"));
  assert.ok(palette.includes("LEGACY_DEFAULTS"));
  const requiredColours=[
    ["sawing","#0e9ca6"],["turning","#d28a22"],["wire edm","#7958c8"],
    ["gear cutting","#d35463"],["heat treatment","#2f7fca"],["grinding","#24936d"],
    ["metrology","#b86a35"],["laser cutting","#287aa0"],["forming","#9a5b91"],
    ["fabrication","#6e9439"],["welding","#bd684b"],["finishing","#4d70b5"],
    ["vmc machining","#a17b28"],["deburring","#278f89"],["quality","#8a64b5"],
    ["assembly","#cd7a28"],["packaging","#527d91"],["punching","#b14d72"]
  ];
  for(const [category,colour] of requiredColours){
    assert.ok(palette.includes('"'+category+'":"'+colour+'"'),"missing distinct process colour for "+category);
  }
  assert.equal(new Set(requiredColours.map(([,colour])=>colour)).size,18,"all 18 demo process categories must have distinct colours");
  assert.ok(directory.includes("resolveProcessColor(row)"));
  assert.ok(directory.includes("processPaletteColor(category,processType)"));
  assert.ok(route.includes("resolveProcessColor({"));
  assert.ok(universe.includes("resolveProcessColor({"));
});


test("large interactive manufacturing graphs preserve readable phone zoom and manual pan",()=>{
  const canvas=source("src/ManufacturingGraphCanvas.tsx");
  const demo=source("src/SingleComponentRouteGraphDemo.tsx");
  const universe=source("src/ManufacturingEcosystemGraph.tsx");
  assert.ok(canvas.includes("defaultViewport?:{x:number;y:number;zoom:number}"));
  assert.ok(canvas.includes("defaultViewport={defaultViewport}"));
  assert.ok(demo.includes('matchMedia("(max-width:760px)")'));
  assert.ok(demo.includes("fitView={!compactViewport}"));
  assert.ok(demo.includes("zoom:.68"));
  assert.ok(universe.includes('matchMedia("(max-width:760px)")'));
  assert.ok(universe.includes("fitView={!compactViewport}"));
  assert.ok(universe.includes("zoom:.62"));
});

test("manufacturing route connectors show animated directional pulses without overriding arrow colours",()=>{
  const edge=source("src/ManufacturingRelationshipEdge.tsx");
  const route=source("src/RouteFlowWorkspace.tsx");
  const universe=source("src/ManufacturingEcosystemGraph.tsx");
  const demo=source("src/SingleComponentRouteGraphDemo.tsx");
  const css=source("src/aximach-visual-fixes.css");
  assert.ok(edge.includes("flowMotion?:boolean"));
  assert.ok(edge.includes("<animateMotion dur="));
  assert.ok(route.includes('flowMotion:["main","alternate","rework","transport","material"].includes(type)'));
  assert.ok(universe.includes('flowMotion:["main","alternate","rework","transport","feeds operation","allocated to"].includes(link.kind)'));
  assert.ok(demo.includes('flowMotion:["main","alternate","rework","transport","material"].includes(row.type)'));
  assert.ok(css.includes(".ax-manufacturing-edge-pulse"));
  assert.ok(css.includes("@media(prefers-reduced-motion:reduce)"));
  assert.ok(!css.includes(".ax-ecosystem-flow-canvas .react-flow__arrowhead path{fill:currentColor!important"));
});


test("Manufacturing Universe renders every selected-line BOM material link and attaches unanchored allocations to the first main operation",()=>{
  const graph=source("src/ManufacturingEcosystemGraph.tsx");
  assert.ok(graph.includes("materialProcessLinks=activeRows(data.materialProcessLinks||[]).filter(matchesLine)"));
  assert.ok(graph.includes('const linkId="material-link:"+link.id'));
  assert.ok(graph.includes('if(link.flowType==="Output")edge("operation:"+link.operationId,linkId,"output from operation")'));
  assert.ok(graph.includes('else edge(linkId,"operation:"+link.operationId,"feeds operation")'));
  assert.ok(graph.includes("const firstMainOperation=operations.filter"));
  assert.ok(graph.includes("operations.find(operation=>operation.id===row.anchorOperationId)||firstMainOperation"));
  assert.ok(graph.includes("if(targetOperation)edge(transportId,\"operation:\"+targetOperation.id,\"transport\")"));
});

test("custom process colours override palette defaults while legacy shared blues fall back to category colours",()=>{
  const palette=source("src/processPalette.ts");
  assert.ok(palette.includes("const saved=[record.processColor,record.displayColor]"));
  assert.ok(palette.includes(".find(value=>Boolean(value)&&!LEGACY_DEFAULTS.has(value))"));
  assert.ok(palette.includes("if(saved)return saved"));
});
