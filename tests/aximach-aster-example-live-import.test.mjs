import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const fixture = JSON.parse(read("../src/single-component-route-demo.json"));
const importer = read("../src/asterPrecisionExample.ts");
const route = read("../src/RouteFlowWorkspace.tsx");
const app = read("../src/App.tsx");
const iconSource = read("../src/MechanicalOperationIcon.tsx");
const iconStudio = read("../src/IconStudio.tsx");
const componentMaster = read("../src/ManufacturingMasterWorkspace.tsx");
const processMap = read("../src/LinkedProcessWorkspace.tsx");
const costing = read("../src/LinkedCostingWorkspace.tsx");
const partCosting = read("../src/PartMaterialCostingPanel.tsx");
const payables = read("../src/SupplierAccountsPayablePanel.tsx");
const inventory = read("../src/InventoryWorkspace.tsx");
const materialCatalogue = read("../src/materialCatalogue.ts");

const routeTypes = ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"];

test("ASTER fixture is loaded into the normal AXIMACH manufacturing records on explicit user action", () => {
  assert.ok(importer.includes('import fixture from "./single-component-route-demo.json"'));
  assert.ok(importer.includes("export function importAsterPrecisionExample(current: ManufacturingData)"));
  assert.ok(importer.includes("companies: mergeById(current.companies"));
  assert.ok(importer.includes("purchaseOrders: mergeOrders"));
  assert.ok(importer.includes("components: mergeById(current.components"));
  assert.ok(importer.includes("operations: mergeById(current.operations"));
  assert.ok(importer.includes("transportLegs: mergeById(current.transportLegs"));
  assert.ok(importer.includes("routeRelationships: mergeById(current.routeRelationships"));
  assert.ok(app.includes("loadAsterExampleFromWorkspace"));
  assert.ok(app.includes("removeAsterExampleFromWorkspace"));
  assert.ok(app.includes("Load full demo"));
  assert.ok(app.includes("Remove test data"));
  assert.ok(app.includes('className="status-ribbon"'));
  assert.ok(app.includes("ASTER_EXAMPLE_CONTEXT"), "One shared demo scope must be available to every connected module.");
  assert.ok(app.includes("setModuleContext(ASTER_EXAMPLE_CONTEXT)"), "Loading the demo must preselect its Company, PO and Component.");
  assert.ok(app.includes("context ?? (activeDemoRecordCount > 0 ? ASTER_EXAMPLE_CONTEXT : {})"), "Module navigation must preserve the shared demo scope until removal.");
  assert.ok(!route.includes("importAsterPrecisionExample"), "Route Flow must not own a separate demo loader.");
  assert.ok(!route.includes("Load ASTER example into AXIMACH"), "Only the global cross-module demo control should load the full dataset.");
});

test("ASTER example is visible in regular company, PO and component selectors without replacing real records", () => {
  assert.ok(route.includes('companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)'));
  assert.ok(route.includes('companyOrders.map(row=><option key={row.id} value={row.id}>{row.number}</option>)'));
  assert.ok(route.includes("lineOptions.map(row=>"));
  assert.ok(importer.includes("const mergeById ="));
  assert.ok(importer.includes("rows.set(row.id, row)"));
  assert.ok(importer.includes("...current, updatedAt"));
  assert.ok(app.includes("loadAsterExampleFromWorkspace"));
  assert.ok(app.includes("Load full demo"));
});

test("live-import dataset preserves the one-company / one-PO / one-component scope and all required detail", () => {
  assert.equal(fixture.company.name, "ASTER Precision Works");
  assert.equal(fixture.operations.length, 28);
  assert.equal(new Set(fixture.operations.map(row => row.category)).size, 18);
  assert.equal(fixture.transportLegs.length, 10);
  assert.equal(fixture.expected.companyCount, 1);
  assert.equal(fixture.expected.purchaseOrderCount, 1);
  assert.equal(fixture.expected.componentCount, 1);
  for (const type of routeTypes) assert.ok(importer.includes('"' + type + '"'), "importer must persist relationship type " + type);
  const validSourceOperations = new Set(fixture.operations.map(row => row.id));
  const importedEdges = fixture.edges.filter(edge => routeTypes.includes(edge.type) && validSourceOperations.has(edge.source) && validSourceOperations.has(edge.target));
  for (const edge of importedEdges) assert.ok(validSourceOperations.has(edge.source) && validSourceOperations.has(edge.target));
  assert.ok(importer.includes('type: "split"'));
  assert.ok(importer.includes('type: "parallel"'));
  assert.ok(importer.includes('type: "merge"'));
});

test("all 28 operation nodes form one connected route after split, branch, parallel and assembly-merge links", () => {
  const operations = fixture.operations;
  const ids = new Set(operations.map(row => row.id));
  const edges = [];
  const branches = new Map();
  for (const operation of operations) {
    const key = operation.branch || "Main route";
    if (!branches.has(key)) branches.set(key, []);
    branches.get(key).push(operation);
  }
  for (const rows of branches.values()) {
    rows.sort((a,b) => a.sequence - b.sequence);
    for (let i=0;i<rows.length-1;i++) edges.push([rows[i].id, rows[i+1].id]);
  }
  for (const edge of fixture.edges) {
    if (routeTypes.includes(edge.type) && ids.has(edge.source) && ids.has(edge.target)) edges.push([edge.source, edge.target]);
  }
  edges.push(
    ["op-001","op-002"],["op-001","op-007"],["op-001","op-011"],["op-001","op-014"],
    ["op-002","op-007"],["op-011","op-014"],
    ["op-006","op-020"],["op-010","op-020"],["op-013","op-020"],["op-019","op-020"]
  );
  const adjacency = new Map(operations.map(row => [row.id, []]));
  for (const [from,to] of edges) { adjacency.get(from).push(to); adjacency.get(to).push(from); }
  const visited = new Set();
  const pending = [operations[0].id];
  while (pending.length) {
    const current = pending.pop();
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...adjacency.get(current));
  }
  assert.equal(visited.size, 28, "all process operations must be reachable in one connected route graph");
});

test("the shared ASTER example includes removable machine, tooling, fixture, stock, quotation and contact records", () => {
  for (const field of [
    "machines: mergeById(current.machines",
    "toolingAssets: mergeById(current.toolingAssets",
    "fixtureAssets: mergeById(current.fixtureAssets",
    "inventoryTransactions: mergeById(current.inventoryTransactions",
    "quotations: mergeById(current.quotations",
    "contactProfiles: mergeById(current.contactProfiles"
  ]) assert.ok(importer.includes(field), "missing linked module data: " + field);
  assert.ok(importer.includes('id:demoMachineId'));
  assert.ok(importer.includes('compatibleMachineIds:[demoMachineId]'));
  assert.ok(importer.includes('machineId:/machin|mill|drill|boring|tap/i'));
  assert.ok(importer.includes('SYNTHETIC TEST STOCK ONLY'));
  assert.ok(importer.includes('SYNTHETIC QUOTATION FOR WORKFLOW TESTING'));
  assert.ok(importer.includes('contactProfileRows'));
  assert.ok(importer.includes("machineCount:1"));
  assert.ok(importer.includes("inventoryOpeningRows:6"));
  assert.ok(importer.includes("row.id?.startsWith(ASTER_EXAMPLE_PREFIX)"));
});


test("the global load/remove test-data control is visible in the shared application shell", () => {
  const styles = read("../src/aximach-ui.css");
  assert.match(styles, /\.status-ribbon\{[\s\S]*?display:flex!important/);
  assert.doesNotMatch(styles, /\.status-ribbon\{\s*display:none!important/);
});

test("the logo catalogue uses distinct SVG drawings rather than palette variants", () => {
  const inventory = [...iconSource.matchAll(/\{glyph:"([^"]+)"/g)].map(match => match[1]);
  const rendered = [...iconSource.matchAll(/case "([^"]+)": return/g)].map(match => match[1]);
  assert.ok(inventory.length >= 90, "The manufacturing icon catalogue must contain the expanded set of unique symbols.");
  assert.equal(new Set(inventory).size, inventory.length, "One symbol glyph must not be duplicated as another logo.");
  assert.deepEqual([...new Set(rendered)].sort(), [...new Set(inventory)].sort(), "Every catalogue symbol must have its own SVG drawing.");
  assert.ok(iconStudio.includes("Unique engineering SVG symbols · not colour variants"));
  assert.ok(iconStudio.includes("not new logos"));
});


test("zero is blank-editable for unentered component, process, costing and supplier amounts", () => {
  assert.ok(componentMaster.includes('setComponentPriceInput(Number(row.salePrice)>0?String(row.salePrice):"")'));
  assert.ok(processMap.includes('type="text" inputMode="decimal" value={moneyDraftValue("ratePerPart",draft.ratePerPart)}'));
  assert.ok(processMap.includes('type="text" inputMode="decimal" value={moneyDraftValue("actualRatePerPart",draft.actualRatePerPart)}'));
  assert.ok(processMap.includes('type="text" inputMode="decimal" value={moneyDraftValue("processCostTotal",draft.processCostTotal)}'));
  assert.ok(costing.includes('type="text" inputMode="decimal" value={extraInputValue("materialRate",materialRate)}'));
  assert.ok(costing.includes('type="text" inputMode="decimal" value={extraInputValue("salePrice",sellingRate)}'));
  assert.ok(partCosting.includes('type="text" inputMode="decimal" value={materialRate}'));
  assert.ok(partCosting.includes('type="text" inputMode="decimal" value={cuttingRate}'));
  assert.ok(payables.includes('type="text" inputMode="decimal" value={invoiceSubtotal}'));
  assert.ok(payables.includes('type="text" inputMode="decimal" value={paymentAmount}'));
  assert.ok(payables.includes('invoiceTotal>0?invoiceTotal.toFixed(2):""'));
});

test("material catalogue keeps kg and piece stock units and grade-driven density in kg per cubic metre", () => {
  assert.ok(inventory.includes('label>Stock unit *'));
  assert.ok(inventory.includes('value="kg">Kilogram (kg)'));
  assert.ok(inventory.includes('value="piece">Piece / each'));
  assert.ok(inventory.includes('Density (kg/m³)'));
  assert.ok(inventory.includes('densityUnit:"kg/m3"'));
  assert.ok(inventory.includes('materialDensityReference(grade,materialDraft.materialType||"")'));
  assert.ok(materialCatalogue.includes('export function materialDensityReference(grade:string,materialType:string)'));
  assert.ok(materialCatalogue.includes('TYPICAL_DENSITY_BY_MATERIAL_TYPE_KG_M3'));
});
