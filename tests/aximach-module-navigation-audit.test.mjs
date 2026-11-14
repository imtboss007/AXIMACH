import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("enterprise Manufacturing Universe preserves saved cross-PO relationship edges", () => {
  const graph = read("../src/ProcessUniverse3D.tsx");
  const universe = read("../src/ManufacturingUniverseWorkspace.tsx");
  assert.ok(graph.includes('sceneScopeLabel!=="ENTERPRISE-WIDE"&&(from.poLineId||from.componentId)!==(to.poLineId||to.componentId)'), "cross-line relationship filtering must apply only to a selected PO-line scene");
  assert.ok(universe.includes('universeScope==="enterprise"?relationships.filter(link=>link.status!=="Disabled"):routeRelationships'), "enterprise scene must receive every active saved relationship");
});

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

test("20 modules remain the only visible catalogue and stale 18-module labels are absent", () => {
  const app = read("../src/App.tsx");
  const start = app.indexOf("const modules: ModuleItem[] = [");
  const end = app.indexOf("\n];", start);
  const catalogue = app.slice(start, end);
  const ids = [...catalogue.matchAll(/\{ id: "([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, 20);
  assert.ok(app.includes("{filteredModules.length} of {modules.length} modules"));
  assert.ok(app.includes("View all {modules.length} modules"));
  assert.ok(app.includes("Browse all {modules.length} modules"));
  assert.doesNotMatch(app, /(?:of|all) 18 modules/i);
});

test("generic workspace profiles contain no retired destinations outside the 20-module catalogue", () => {
  const app = read("../src/App.tsx");
  const catalogueStart = app.indexOf("const modules: ModuleItem[] = [");
  const catalogueEnd = app.indexOf("\n];", catalogueStart);
  const profileStart = app.indexOf("const moduleProfiles: Record<string, ModuleProfile> = {");
  const profileEnd = app.indexOf("\n};", profileStart);
  const catalogueIds = new Set([...app.slice(catalogueStart, catalogueEnd).matchAll(/\{ id: "([^"]+)"/g)].map(match => match[1]));
  const profileIds = [...app.slice(profileStart, profileEnd).matchAll(/^\s*"([^"]+)"\s*:/gm)].map(match => match[1]);
  assert.ok(profileIds.length > 0);
  assert.equal(profileIds.filter(id => !catalogueIds.has(id)).length, 0, "retired module profiles must not remain");
});

test("Factory management remains nested under Company Directory, not a 21st module", () => {
  const master = read("../src/ManufacturingMasterWorkspace.tsx");
  assert.ok(master.includes('{moduleId === "companies" && <div className="costing-tabs">'));
  assert.ok(master.includes('tab === "companies" ? "Add Company" : "Add Factory"'));
  assert.ok(master.includes("filteredFactories"));
});

test("Transport Directory is included in Data Exchange exports", () => {
  const intelligence = read("../src/IntelligenceWorkspaces.tsx");
  assert.ok(intelligence.includes('["transport-master","Transport Directory"]'));
  assert.ok(intelligence.includes('if(moduleId==="transport-master")return activeRows(data.transportRoutes||[])'));
});

test("AI Insights joins PO context when evaluating completed process lines", () => {
  const intelligence = read("../src/IntelligenceWorkspaces.tsx");
  assert.ok(intelligence.includes('lines.filter(({po,line})=>line.jobStatus!=="Finished"&&ops.some(op=>op.poId===po.id&&op.poLineId===line.id&&op.status==="Complete"))'));
});

test("3D Command Centre exposes exactly the same 20 shortcuts as the main catalogue", () => {
  const app = read("../src/App.tsx");
  const orb = read("../src/AXIMACHOrb.tsx");
  const dashboard = read("../src/DashboardWorkspace.tsx");
  const catalogueStart = app.indexOf("const modules: ModuleItem[] = [");
  const catalogueEnd = app.indexOf("\n];", catalogueStart);
  const catalogueIds = [...app.slice(catalogueStart, catalogueEnd).matchAll(/\{ id: "([^"]+)"/g)].map(match => match[1]);
  const sphereStart = orb.indexOf("const satellites = [");
  const sphereEnd = orb.indexOf("\n];", sphereStart);
  const sphereIds = [...orb.slice(sphereStart, sphereEnd).matchAll(/id: "([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual([...sphereIds].sort(), [...catalogueIds].sort(), "the sphere must contain every official module exactly once");
  assert.equal(new Set(sphereIds).size, 20);
  assert.ok(orb.includes('aria-label={`${satellites.length} clickable AXIMACH modules`}'));
  assert.ok(dashboard.includes("View all {moduleCount} modules"));
  assert.ok(dashboard.includes("All {moduleCount} modules"));
  assert.ok(app.includes("moduleCount={modules.length}"));
});

test("master directories expose their actual Add, Edit, Save and archive/delete actions", () => {
  const master = read("../src/ManufacturingMasterWorkspace.tsx");
  const vendors = read("../src/App.tsx");
  const transport = read("../src/TransportDirectoryWorkspace.tsx");
  const contacts = read("../src/RelationshipWorkspaces.tsx");

  for (const action of ["saveCompany", "saveFactory", "saveComponent", "savePO", "editCompany", "editFactory", "editComponent", "editPO", "deleteComponents", "deletePurchaseOrders"]) {
    assert.ok(master.includes(action), "missing master-data CRUD handler: " + action);
  }
  assert.ok(master.includes('archive("companies", row.id)'));
  assert.ok(master.includes('archive("factories", row.id)'));
  assert.ok(vendors.includes("const beginNew=") && vendors.includes("const beginEdit=") && vendors.includes("const saveContact=") && vendors.includes("const archive="));
  assert.ok(transport.includes("const save = () =>") && transport.includes("const edit = (route:") && transport.includes("const archive = (route:"));
  assert.ok(contacts.includes("const beginNew=") && contacts.includes("const edit=(row:ContactRecord)") && contacts.includes("const save=()") && contacts.includes("const remove=(id:string)"));
});

test("component and purchase-order hard deletes remove dependent route, material, stock and history links safely", () => {
  const master = read("../src/ManufacturingMasterWorkspace.tsx");
  const componentStart = master.indexOf("const deleteComponents =");
  const purchaseStart = master.indexOf("const deletePurchaseOrders =", componentStart);
  const exportStart = master.indexOf("const exportComponentsExcel =", purchaseStart);
  const componentDelete = master.slice(componentStart, purchaseStart);
  const purchaseDelete = master.slice(purchaseStart, exportStart);

  for (const field of ["routeRelationships", "materialProcessLinks", "inventoryTransactions", "followUpAssignments", "operations", "quotations", "transportLegs", "paymentTransactions", "inspectionMeasurements"]) {
    assert.ok(componentDelete.includes(field), "component deletion must handle " + field);
    assert.ok(purchaseDelete.includes(field), "purchase-order deletion must handle " + field);
  }
  assert.ok(componentDelete.includes("row.itemType===\"component\"&&targetIds.has(row.itemId)"));
  assert.ok(componentDelete.includes("!row.componentId||!targetIds.has(row.componentId)"), "unlinked legacy planned-cost rows must be retained");
  assert.ok(componentDelete.includes("purchaseOrders:current.purchaseOrders.map"));
  assert.ok(!componentDelete.includes(".filter(po=>po.lines.length>0)"), "deleting the final component line must not silently delete the PO header");
  assert.ok(purchaseDelete.includes("plannedCosts:current.plannedCosts.filter"));
  assert.ok(purchaseDelete.includes("operationIds.has(row.operationId)"));
});

test("Process Directory, Planned Cost, Material Directory and Process Map expose their update/archive pathways", () => {
  const directories = read("../src/SpecializedDirectoryWorkspace.tsx");
  const inventory = read("../src/InventoryWorkspace.tsx");
  const processMap = read("../src/LinkedProcessWorkspace.tsx");

  assert.ok(directories.includes("const save=()=>{") && directories.includes("const edit=(row:ProcessEntry)=>") && directories.includes("const remove=(id:string)=>"));
  assert.ok(directories.includes("const save=()=>{\n  const primaryDefinition=") && directories.includes("const remove=(id:string)=>{if(!window.confirm(\"Delete this planned-cost record?\"))"));
  for (const action of ["saveMaterial", "saveBom", "saveMaterialLink", "editMaterial", "editBom", "editMaterialLink", "archiveMaterial", "archiveBom", "archiveMaterialLink"]) {
    assert.ok(inventory.includes(action), "missing Material Directory action: " + action);
  }
  for (const action of ["saveOperation", "updateOperation", "deleteOperation", "archiveOperation"]) {
    assert.ok(processMap.includes(action), "missing Process Map action: " + action);
  }
});

test("operational modules update their source records instead of creating duplicate module-local copies", () => {
  const operations = read("../src/OperationsWorkspaces.tsx");
  const costing = read("../src/LinkedCostingWorkspace.tsx");
  const routeFlow = read("../src/RouteFlowWorkspace.tsx");
  const followUps = read("../src/FollowUpAssignments.tsx");
  const vendorApp = read("../src/App.tsx");

  assert.ok(operations.includes("const updateProductionJob =") || vendorApp.includes("const updateProductionJob ="));
  assert.ok(operations.includes("const updateStatus="));
  assert.ok(operations.includes("const patch=(id:string,key:") && operations.includes("const saveMeasurement=()=>"));
  assert.ok(costing.includes("const saveQuote =") && costing.includes("const selectQuote ="));
  assert.ok(routeFlow.includes("const saveRelationship=") && routeFlow.includes("const saveTransportLeg="));
  assert.ok(followUps.includes("const addContact =") && followUps.includes("const removeContact ="));
});

test("Process Map archive and delete also archive dependent route and material links while retaining audit ledgers", () => {
  const processMap = read("../src/LinkedProcessWorkspace.tsx");
  const deleteStart = processMap.indexOf("const deleteOperation =");
  const deleteEnd = processMap.indexOf("const finishSelectedOperations", deleteStart);
  const archiveStart = processMap.indexOf("const archiveOperation =");
  const archiveEnd = processMap.indexOf("const finishJob =", archiveStart);
  const deleteBlock = processMap.slice(deleteStart, deleteEnd);
  const archiveBlock = processMap.slice(archiveStart, archiveEnd);
  for (const block of [deleteBlock, archiveBlock]) {
    assert.ok(block.includes("routeRelationships"));
    assert.ok(block.includes("materialProcessLinks"));
    assert.ok(block.includes("quotations"));
    assert.ok(block.includes("payment"));
    assert.ok(block.includes("inspection"));
  }
});

test("Component Planned Cost supports Add, Edit, Update and archive on the same stable record ID", () => {
  const directories = read("../src/SpecializedDirectoryWorkspace.tsx");
  const plannedStart = directories.indexOf("function PlannedCostDirectory");
  const planned = directories.slice(plannedStart);
  assert.ok(planned.includes("const [editingId,setEditingId]=useState(\"\")"));
  assert.ok(planned.includes("const edit=(row:PlannedCostEntry)=>"));
  assert.ok(planned.includes("id:old?.id||makeId(\"planned-cost\")"));
  assert.ok(planned.includes("createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined"));
  assert.ok(planned.includes("const savedIds=new Set(created.map(row=>row.id))"));
  assert.ok(planned.includes("onClick={()=>edit(row)}>Edit</button>"));
  assert.ok(planned.includes("editingId?\"Save changes\""));
  assert.ok(planned.includes("Planned-cost record archived."));
});

test("Manufacturing Universe renders start-placement transport legs in the primary route lane", () => {
  const scene = read("../src/ProcessUniverse3D.tsx");
  assert.ok(scene.includes('!lane.alternate&&lane.rows[0]'));
  assert.ok(scene.includes('leg.placement==="start"'));
  assert.ok(scene.includes('leg.anchorOperationId===lane.rows[0].id'));
  assert.ok(scene.includes(".map(renderTransportLeg)"));
});

test("Process Directory bulk archive preserves records and their stable IDs for historical operations", () => {
  const directories = read("../src/SpecializedDirectoryWorkspace.tsx");
  const processStart = directories.indexOf("function ProcessDirectory");
  const processEnd = directories.indexOf("function PlannedCostDirectory", processStart);
  const processDirectory = directories.slice(processStart, processEnd);
  assert.ok(processDirectory.includes("Archive selected"));
  assert.ok(processDirectory.includes("const ids=new Set(selectedProcessIds)"));
  assert.ok(processDirectory.includes("processDefinitions:current.processDefinitions.map(row=>ids.has(row.id)?{...row,deletedAt:stamp,updatedAt:stamp}:row)"));
  assert.ok(processDirectory.includes("Historical operations were retained."));
});
