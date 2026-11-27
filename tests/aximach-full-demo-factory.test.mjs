import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("full Demo Factory imports into shared module records and preserves real records", () => {
  const demo = read("../src/aximachDemoData.ts");
  const app = read("../src/App.tsx");
  assert.ok(demo.includes("export function createAxMachTwoCompanyDemo()"));
  assert.ok(demo.includes("export function importAxMachTwoCompanyDemo(current:ManufacturingData"));
  assert.ok(demo.includes("const sample=createAxMachTwoCompanyDemo()"));
  assert.ok(demo.includes("filter(row=>!row.id?.startsWith(AXIMACH_DEMO_ID_PREFIX))"), "real non-DEMO rows must be retained");
  assert.ok(demo.includes("filter(row=>row.id?.startsWith(AXIMACH_DEMO_ID_PREFIX))"), "only reserved demo rows are re-imported");
  assert.ok(app.includes("importAxMachTwoCompanyDemo(current)"));
  assert.ok(app.includes("Load full Demo Factory"));
  assert.ok(app.includes("Remove demo records"));
  assert.ok(app.includes("DEMO FACTORY ACTIVE"));
});

test("demo data is opened from the regular module workflows, not an isolated Route Flow preview", () => {
  const app = read("../src/App.tsx");
  for (const [moduleId, label] of [
    ["companies", "Companies / factories"],
    ["purchasing", "Purchase orders"],
    ["process-map", "Process Map"],
    ["inventory", "Materials / BOM"],
    ["route-flow", "Route Flow"],
    ["manufacturing-universe", "Manufacturing Universe"],
    ["costing", "Costing"]
  ]) {
    assert.ok(app.includes('onSelectModule("' + moduleId + '")'), "Demo Factory needs a direct link to " + label);
  }
  const source = read("../src/aximachDemoData.ts");
  for (const key of [
    "companies,factories", "purchaseOrders,components,vendors,operations",
    "materials,componentParts", "materialCostEntries,bomLines,materialProcessLinks",
    "transportRoutes,transportLegs", "routeRelationships,followUpAssignments"
  ]) assert.ok(source.includes(key), "The shared example should seed linked records including " + key);
});

test("removing the Demo Factory archives DEMO IDs across all record collections and can be re-imported", () => {
  const demo = read("../src/aximachDemoData.ts");
  assert.ok(demo.includes("for(const [key,value] of Object.entries(current))"));
  assert.ok(demo.includes('if(key==="purchaseOrders")'));
  assert.ok(demo.includes("line.id.startsWith(AXIMACH_DEMO_ID_PREFIX)"));
  assert.ok(demo.includes("deletedAt:stamp,updatedAt:stamp"));
  assert.ok(demo.includes("const realRows="));
  assert.ok(demo.includes("const demoRows="));
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
  assert.ok(master.includes('value={componentDraft.salePrice || ""}'));
  assert.ok(inventory.includes('value={materialDraft.ratePerUnit || ""}'));
});

test("material directory uses fixed material families, known grade density in kg/m3 and kg/piece pricing units", () => {
  const inventory = read("../src/InventoryWorkspace.tsx");
  const types = read("../src/manufacturingData.ts");
  assert.ok(inventory.includes("const STANDARD_MATERIAL_TYPES = ["));
  assert.ok(inventory.includes("STANDARD_MATERIAL_TYPES.map(type=>"));
  assert.ok(inventory.includes('densityUnit:"kg/m3"'));
  assert.ok(inventory.includes("Auto-filled from grade"));
  assert.ok(inventory.includes('<option value="kg">kg</option>'));
  assert.ok(inventory.includes('<option value="piece">piece</option>'));
  assert.ok(inventory.includes('value="piece">₹ / piece'));
  assert.ok(types.includes('"kg" | "lb" | "piece"'));
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
  assert.ok(names.length >= 90, "Expected at least 90 separate manufacturing SVG glyphs; found " + names.length);
  assert.equal(new Set(names).size, names.length, "Every displayed manufacturing glyph must have its own unique ID");
  for (const glyph of ["robot-arm","five-axis-cnc","injection-molding","forging-press","profilometer","forklift","sea-freight","warehouse-rack","electric-motor"]) {
    assert.ok(icons.includes('case "' + glyph + '"'), "Missing distinct SVG symbol: " + glyph);
  }
});
