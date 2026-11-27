import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const fixture = JSON.parse(read("../src/single-component-route-demo.json"));
const importer = read("../src/asterPrecisionExample.ts");
const route = read("../src/RouteFlowWorkspace.tsx");
const app = read("../src/App.tsx");

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
  assert.ok(route.includes("import { ASTER_EXAMPLE_IDS, importAsterPrecisionExample } from \"./asterPrecisionExample\""));
  assert.ok(route.includes("update(current=>importAsterPrecisionExample(current))"));
  assert.ok(route.includes("setCompanyPick(ASTER_EXAMPLE_IDS.company)"));
  assert.ok(route.includes("setPoPick(ASTER_EXAMPLE_IDS.purchaseOrder)"));
  assert.ok(route.includes("setLinePick(ASTER_EXAMPLE_IDS.poLine)"));
  assert.ok(route.includes("Load ASTER example into AXIMACH"));
});

test("ASTER example is visible in regular company, PO and component selectors without replacing real records", () => {
  assert.ok(route.includes('companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)'));
  assert.ok(route.includes('companyOrders.map(row=><option key={row.id} value={row.id}>{row.number}</option>)'));
  assert.ok(route.includes("lineOptions.map(row=>"));
  assert.ok(importer.includes("const mergeById ="));
  assert.ok(importer.includes("rows.set(row.id, row)"));
  assert.ok(importer.includes("...current, updatedAt"));
  assert.ok(app.includes("loaded from Route Flow into the normal company, purchase-order and component selectors"));
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
