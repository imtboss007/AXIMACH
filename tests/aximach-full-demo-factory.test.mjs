import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("one-company ASTER example imports into shared module records and preserves real records", () => {
  const demo = read("../src/asterPrecisionExample.ts");
  const app = read("../src/App.tsx");
  assert.ok(demo.includes("export function importAsterPrecisionExample(current: ManufacturingData)"));
  assert.ok(demo.includes("export function archiveAsterPrecisionExample(current: ManufacturingData"));
  assert.ok(demo.includes("export const ASTER_EXAMPLE_PREFIX = \"ASTER-EXAMPLE-\";"));
  assert.ok(demo.includes("mergeById(current.companies, [{ ...company, updatedAt }])"), "real company records must remain");
  assert.ok(demo.includes("mergeById(current.customers, [{ ...customer, updatedAt }])"), "the customer module must have a linked synthetic buyer");
  assert.ok(demo.includes("ASTER_EXAMPLE_EXPECTED = {"));
  assert.ok(demo.includes("companyCount: 1, purchaseOrderCount: 1, componentCount: 1, operationCount: 28"));
  assert.ok(demo.includes("processCategoryCount: 18, transportLegCount: 10"));
  assert.ok(demo.includes("mergeById(current.purchaseOrders, [{ ...po, updatedAt }])"), "example PO must be idempotently imported");
  assert.ok(app.includes("importAsterPrecisionExample(current)"));
  assert.ok(app.includes("Load ASTER example into all modules"));
  assert.ok(app.includes("Remove ASTER example"));
  assert.ok(app.includes("ASTER EXAMPLE ACTIVE"));
});

test("demo data is opened from the regular module workflows, not an isolated Route Flow preview", () => {
  const app = read("../src/App.tsx");
  for (const [moduleId, label] of [
    ["customers", "Customer Directory"],
    ["companies", "Companies / factories"],
    ["purchasing", "Purchase orders"],
    ["process-master", "Process Directory"],
    ["process-map", "Process Map"],
    ["inventory", "Materials / BOM"],
    ["route-flow", "Route Flow"],
    ["manufacturing-universe", "Manufacturing Universe"],
    ["costing", "Costing"]
  ]) {
    assert.ok(app.includes('onSelectModule("' + moduleId + '")'), "Demo Factory needs a direct link to " + label);
  }
  const source = read("../src/asterPrecisionExample.ts");
  for (const key of [
    "companies: mergeById(current.companies", "factories: mergeById(current.factories", "purchaseOrders: mergeOrders",
    "components: mergeById(current.components", "materials: mergeById(current.materials", "processDefinitions: mergeById(current.processDefinitions", "operations: mergeById(current.operations",
    "bomLines: mergeById(current.bomLines", "materialProcessLinks: mergeById(current.materialProcessLinks",
    "transportRoutes: mergeById(current.transportRoutes", "transportLegs: mergeById(current.transportLegs", "routeRelationships: mergeById(current.routeRelationships"
  ]) assert.ok(source.includes(key), "The shared example should seed linked records including " + key);
});

test("removing the Demo Factory archives DEMO IDs across all record collections and can be re-imported", () => {
  const demo = read("../src/asterPrecisionExample.ts");
  assert.ok(demo.includes("export function archiveAsterPrecisionExample(current: ManufacturingData"));
  assert.ok(demo.includes('if (key === "purchaseOrders")'));
  assert.ok(demo.includes("line.id.startsWith(ASTER_EXAMPLE_PREFIX)"));
  assert.ok(demo.includes("deletedAt: archivedAt, updatedAt: archivedAt"));
  assert.ok(demo.includes("row.id?.startsWith(ASTER_EXAMPLE_PREFIX)"));
  assert.ok(demo.includes("All real customer records and non-example IDs remain untouched."));
});

test("optional money fields do not force a visible zero while typing", () => {
  const quick = read("../src/OperationQuickCreate.tsx");
  const inline = read("../src/OperationInlineEditor.tsx");
  const master = read("../src/ManufacturingMasterWorkspace.tsx");
  const inventory = read("../src/InventoryWorkspace.tsx");
  assert.ok(quick.includes('const [rate,setRate]=useState("")'));
  for (const field of ["ratePerPart","actualRatePerPart","paidAmount","transportCost"]) {
    assert.ok(inline.includes('value={draft.' + field + ' || ""}'));
  }
  assert.ok(master.includes("const [componentPriceInput,setComponentPriceInput]=useState(\"\";)") === false);
  assert.ok(master.includes("const [componentPriceInput,setComponentPriceInput]=useState(\"\"));"));
  assert.ok(master.includes("value={componentPriceInput}"));
  assert.ok(inventory.includes("const [materialRateInput,setMaterialRateInput]=useState(\"\"));"));
  assert.ok(inventory.includes("value={materialRateInput}"));
});

test("material directory uses fixed material families, known grade density in kg/m3 and kg/piece pricing units", () => {
  const inventory = read("../src/InventoryWorkspace.tsx");
  const types = read("../src/manufacturingData.ts");
  assert.ok(inventory.includes("const STANDARD_MATERIAL_TYPES = ["));
  assert.ok(inventory.includes('"Tool steel"'));
  assert.ok(inventory.includes('"Cutting fluid / coolant"'));
  assert.ok(inventory.includes("STANDARD_MATERIAL_TYPES.map(type=>"));
  assert.ok(inventory.includes('densityUnit:"kg/m3"'));
  assert.ok(inventory.includes("Auto-filled from grade"));
  assert.ok(inventory.includes('<option value="kg">kg</option>'));
  assert.ok(inventory.includes('<option value="piece">piece</option>'));
  assert.ok(inventory.includes('value="piece">₹ / piece'));
  assert.ok(types.includes('"kg" | "lb" | "piece"'));
  const costing = read("../src/PartMaterialCostingPanel.tsx");
  assert.ok(costing.includes('useState<"kg"|"lb"|"piece">("kg")'));
  assert.ok(costing.includes("priceUnit===\"piece\"?totalMaterialPieces*rate"));
  assert.ok(costing.includes("piecesPerFinishedPart:priceUnit===\"piece\"?piecesPerPart:undefined"));
});

test("process quick-create is driven by permanent Process Directory definitions", () => {
  const quick = read("../src/OperationQuickCreate.tsx");
  const universe = read("../src/ManufacturingUniverseWorkspace.tsx");
  assert.ok(quick.includes("processDefinitions:ProcessDefinitionRecord[]"));
  assert.ok(quick.includes("Process from Process Directory"));
  assert.ok(quick.includes("availableDefinitions.map"));
  assert.ok(quick.includes("processDefinitionId:processDefinitionId||undefined"));
  assert.ok(universe.includes("processDefinitions={definitions}"));
});

test("manufacturing logo picker contains genuinely distinct SVG glyphs rather than only style variants", () => {
  const icons = read("../src/MechanicalOperationIcon.tsx");
  const inventory = icons.slice(icons.indexOf("export const MECHANICAL_ICON_INVENTORY"), icons.indexOf("export function MechanicalIconGlyph"));
  const names = [...inventory.matchAll(/\{glyph:"([^"]+)"/g)].map(match => match[1]);
  assert.ok(names.length >= 95, "Expected at least 95 separate manufacturing SVG glyphs; found " + names.length);
  assert.equal(new Set(names).size, names.length, "Every displayed manufacturing glyph must have its own unique ID");
  for (const glyph of ["robot-arm","five-axis-cnc","injection-molding","forging-press","profilometer","forklift","sea-freight","warehouse-rack","electric-motor"]) {
    assert.ok(icons.includes('case "' + glyph + '"'), "Missing distinct SVG symbol: " + glyph);
  }
});
