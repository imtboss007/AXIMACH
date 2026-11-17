import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("all 20 catalogue modules have a corresponding workspace render route", () => {
  const app = read("../src/App.tsx");
  const catalogueStart = app.indexOf("const modules: ModuleItem[] = [");
  const catalogueEnd = app.indexOf("\n];", catalogueStart);
  const catalogue = app.slice(catalogueStart, catalogueEnd);
  const renderStart = app.indexOf('{activeModuleId === "dashboard"');
  const renderEnd = app.indexOf("</Suspense>", renderStart);
  const renderer = app.slice(renderStart, renderEnd);
  const ids = [...catalogue.matchAll(/\{ id: "([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 20, "catalogue count should match the visible menu count");
  assert.equal(new Set(ids).size, ids.length, "module IDs must be unique");
  for (const id of ids) {
    assert.ok(renderer.includes('activeModuleId === "' + id + '"'), "missing route renderer for module " + id);
  }
  assert.ok(renderer.includes('activeModuleId === "process-map"'), "the dedicated Process Map must also be routable");
});

test("Contact 360 and master-record links retain the selected company/vendor identity", () => {
  const app = read("../src/App.tsx");
  const relationships = read("../src/RelationshipWorkspaces.tsx");
  assert.ok(app.includes('initialVendorId={moduleContext.vendorId||contactVendorSeed}'));
  assert.ok(relationships.includes('row.linkedType==="company"?"companies":"vendors"'));
  assert.ok(relationships.includes('{companyId:row.linkedId}:{vendorId:row.linkedId}'));
  assert.ok(relationships.includes('onSelectModule("contact360",{vendorId:v.id})'));
});

test("Vendor Network and Vendor Directory never choose the first assigned operation", () => {
  const network = read("../src/RelationshipWorkspaces.tsx");
  const vendor = read("../src/App.tsx");
  const processMap = read("../src/LinkedProcessWorkspace.tsx");
  assert.ok(network.includes('const routeOperation=processOps.length===1?processOps[0]:undefined'));
  assert.ok(network.includes('disabled={!routeOperation||!routePO}'));
  assert.ok(network.includes('operationId:routeOperation.id'));
  assert.ok(vendor.includes("const selectedVendorOperations=selected?activeRows(data.operations).filter(op=>op.vendorId===selected.id):[]"));
  assert.ok(vendor.includes("const selectedUniqueOperation=selectedVendorOperations.length===1?selectedVendorOperations[0]:undefined"));
  assert.ok(vendor.includes("disabled={!selectedUniqueOperation||!selectedOperationPO}"));
  assert.ok(processMap.includes("const vendorOnlyOperation = vendorOperations.length === 1 ? vendorOperations[0] : undefined"));
  assert.ok(processMap.includes("matchingVendorOperations.length === 1 ? matchingVendorOperations[0] : undefined"));
});

test("Costing, Component Master and Purchase Order links preserve selected record context", () => {
  const costing = read("../src/LinkedCostingWorkspace.tsx");
  const master = read("../src/ManufacturingMasterWorkspace.tsx");
  assert.ok(costing.includes('onSelectModule("vendors",{companyId,poId,poLineId:selectedLine?.lineId,componentId:selectedComponent?.id,operationId:selectedOperation?.id,vendorId:selectedOperation?.vendorId||vendorId||undefined})'));
  assert.ok(costing.includes('onSelectModule("purchasing",{companyId,poId,poLineId:selectedLine?.lineId,componentId:selectedComponent?.id})'));
  assert.ok(master.includes('onSelectModule("process-map",componentNavigationContext(row.id))'));
  assert.ok(master.includes('onSelectModule("process-map",selectedPOContext)'));
  assert.ok(master.includes('onSelectModule("costing",selectedComponentContext)'));
  assert.ok(master.includes('disabled={!selectedPOForNavigation}'));
});

test("Production Plan and Dispatch cross-links retain the incoming job context", () => {
  const operations = read("../src/OperationsWorkspaces.tsx");
  assert.ok(operations.includes('onSelectModule("transport-master",initialContext)'));
  assert.ok(operations.includes('onSelectModule("production",initialContext)'));
  assert.ok(operations.includes('onSelectModule("purchasing",initialContext)'));
  assert.ok(operations.includes('poLineId:line.id,componentId:line.componentId'));
  assert.ok(operations.includes('row.poLineId===initialContext.poLineId'));
});

test("Dashboard and Command Centre exceptions open the exact PO operation", () => {
  const dashboard = read("../src/DashboardWorkspace.tsx");
  const app = read("../src/App.tsx");
  assert.ok(dashboard.includes('onSelectModule("production",{companyId:po?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id'));
  assert.ok(dashboard.includes('onSelectModule("quality",{companyId:po?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id'));
  assert.ok(app.includes('onSelectModule("process-map",{companyId:po?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id'));
  assert.ok(app.includes('onSelectModule("contact360")'));
  assert.ok(!app.includes('<button onClick={() => onSelectModule("vendors")} aria-label="Open Contact 360">'));
  assert.ok(app.includes("Explore all {modules.length} modules"));
});

test("AI Insights destinations preserve the exact operation or PO line that generated the insight", () => {
  const insights = read("../src/IntelligenceWorkspaces.tsx");
  assert.ok(insights.includes('module:"production",context:{companyId:pos.find(po=>po.id===op.poId)?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id'));
  assert.ok(insights.includes('module:"quality",context:{companyId:pos.find(po=>po.id===op.poId)?.companyId,poId:op.poId,poLineId:op.poLineId,componentId:op.componentId,operationId:op.id'));
  assert.ok(insights.includes('module:"purchasing",context:{companyId:po.companyId,poId:po.id,poLineId:line.id,componentId:line.componentId}'));
  assert.ok(insights.includes("onSelectModule(item.module,item.context)"));
});

test("generic Production workspace route launchers require one exact PO component line", () => {
  const app = read("../src/App.tsx");
  assert.ok(app.includes("disabled={productionJobRows.length!==1}"));
  assert.ok(app.includes('poLineId:row.line.id,componentId:row.line.componentId'));
});



test("every literal in-app module navigation target resolves to a registered module", () => {
  const app = read("../src/App.tsx");
  const catalogueStart = app.indexOf("const modules: ModuleItem[] = [");
  const catalogueEnd = app.indexOf("\n];", catalogueStart);
  const catalogue = app.slice(catalogueStart, catalogueEnd);
  const moduleIds = [...catalogue.matchAll(/\{ id: "([^"]+)"/g)].map(match => match[1]);
  const validIds = new Set([...moduleIds, "dashboard", "command-centre", "process-map"]);
  const files = [
    "../src/App.tsx",
    "../src/DashboardWorkspace.tsx",
    "../src/IntelligenceWorkspaces.tsx",
    "../src/LinkedCostingWorkspace.tsx",
    "../src/LinkedProcessWorkspace.tsx",
    "../src/ManufacturingMasterWorkspace.tsx",
    "../src/OperationsWorkspaces.tsx",
    "../src/RelationshipWorkspaces.tsx",
    "../src/RouteFlowWorkspace.tsx",
    "../src/ManufacturingUniverseWorkspace.tsx",
    "../src/InventoryWorkspace.tsx",
    "../src/TransportDirectoryWorkspace.tsx",
    "../src/SpecializedDirectoryWorkspace.tsx",
    "../src/ProcessUniverse3D.tsx",
    "../src/FollowUpAssignments.tsx"
  ];
  const invalid = [];
  for (const path of files) {
    const source = read(path);
    for (const match of source.matchAll(/(?:onSelectModule|selectModule)\s*\(\s*["']([^"']+)["']/g)) {
      if (!validIds.has(match[1])) invalid.push(path + " -> " + match[1]);
    }
  }
  assert.deepEqual(invalid, [], "unregistered navigation targets: " + invalid.join(", "));
  assert.ok(read("../src/LinkedProcessWorkspace.tsx").includes('onSelectModule("dispatch"'));
});


test("Manufacturing Universe stat shortcuts and all 20 module directory links resolve to registered modules", () => {
  const app = read("../src/App.tsx");
  const catalogueStart = app.indexOf("const modules: ModuleItem[] = [");
  const catalogueEnd = app.indexOf("\n];", catalogueStart);
  const catalogue = app.slice(catalogueStart, catalogueEnd);
  const moduleIds = new Set([...catalogue.matchAll(/\{ id: "([^"]+)"/g)].map(match => match[1]));
  const validIds = new Set([...moduleIds, "dashboard", "command-centre", "process-map"]);
  const universe = read("../src/ManufacturingUniverseWorkspace.tsx");
  const linksStart = universe.indexOf("const linkModules=[");
  const linksEnd = universe.indexOf("\n  ];", linksStart);
  const linkBlock = universe.slice(linksStart, linksEnd);
  const shortcutIds = [...linkBlock.matchAll(/\{id:"([^"]+)"/g)].map(match => match[1]);
  assert.equal(shortcutIds.length, 20, "Manufacturing Universe should expose all 20 module shortcuts");
  assert.equal(new Set(shortcutIds).size, 20, "Manufacturing Universe shortcut IDs must be unique");
  const statsStart = universe.indexOf("const stats=[");
  const statsEnd = universe.indexOf("\n  ];", statsStart);
  const statsBlock = universe.slice(statsStart, statsEnd);
  const statsTargets = [...statsBlock.matchAll(/module:"([^"]+)"/g)].map(match => match[1]);
  const invalid = [...shortcutIds, ...statsTargets].filter(id => !validIds.has(id));
  assert.deepEqual(invalid, [], "unregistered Manufacturing Universe destinations: " + invalid.join(", "));
});


test("every declared Process Map visual mode is available in the visible view selector", () => {
  const flow = read("../src/LinkedProcessWorkspace.tsx");
  const typeMatch = flow.match(/const \[visualStyle,setVisualStyle\] = useState<([^>]+)>/);
  assert.ok(typeMatch, "visual style union must exist");
  const declared = [...typeMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  const buttonStart = flow.indexOf('aria-label="All Process Map viewing modes"');
  const buttonEnd = flow.indexOf(".map(option=><button", buttonStart);
  const buttonBlock = flow.slice(buttonStart, buttonEnd);
  const exposed = [...buttonBlock.matchAll(/\{id:"([^"]+)",label:/g)].map(match => match[1]);
  assert.deepEqual([...exposed].sort(), [...declared].sort(), "every declared visual style must be selectable exactly once");
  assert.equal(new Set(exposed).size, exposed.length, "view selector IDs must be unique");
  assert.ok(exposed.includes("digital-mesh"), "Digital Mesh must remain available");
});

test("all shared route layout modes are declared, persisted and selectable in the picker", () => {
  const picker = read("../src/RouteLayoutPicker.tsx");
  const typeMatch = picker.match(/export type RouteLayoutMode = ([^;]+);/);
  assert.ok(typeMatch, "shared route layout type must exist");
  const declared = [...typeMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  const validMatch = picker.match(/const VALID_LAYOUTS: RouteLayoutMode\[\] = \[([^\]]+)\]/);
  assert.ok(validMatch, "layout persistence allow-list must exist");
  const persisted = [...validMatch[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  const options = [...picker.matchAll(/<option value="([^"]+)">/g)].map(match => match[1]);
  assert.deepEqual([...persisted].sort(), [...declared].sort(), "all declared layouts must be accepted by persistence");
  assert.deepEqual([...options].sort(), [...declared].sort(), "all declared layouts must be selectable");
  assert.equal(new Set(options).size, options.length, "route layout option IDs must be unique");
});
