import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const app = read("../src/App.tsx");
const universe = read("../src/ManufacturingUniverseWorkspace.tsx");
const importer = read("../src/asterPrecisionExample.ts");
const inventory = read("../src/InventoryWorkspace.tsx");
const catalogue = read("../src/materialCatalogue.ts");
const quickCreate = read("../src/OperationQuickCreate.tsx");
const componentMaster = read("../src/ManufacturingMasterWorkspace.tsx");
const inlineEditor = read("../src/OperationInlineEditor.tsx");
const icons = read("../src/MechanicalOperationIcon.tsx");
const iconStudio = read("../src/IconStudio.tsx");

test("one reversible shared example can be loaded and archived from the global workspace ribbon", () => {
  assert.ok(app.includes("loadAsterExampleFromWorkspace"));
  assert.ok(app.includes("updateAppData(current => importAsterPrecisionExample(current))"));
  assert.ok(app.includes("removeAsterExampleFromWorkspace"));
  assert.ok(app.includes("updateAppData(current => archiveAsterPrecisionExample(current))"));
  assert.ok(app.includes("Load full demo"));
  assert.ok(app.includes("Remove test data"));
  assert.ok(app.includes("Only ASTER-EXAMPLE records will be archived"));
});

test("Manufacturing Universe has no isolated static preview masquerading as shared live records", () => {
  assert.ok(!universe.includes("SingleComponentRouteGraphDemo"));
  assert.ok(!universe.includes("One Component Preview"));
  assert.ok(universe.includes("ManufacturingEcosystemGraph data={data}"));
  assert.ok(universe.includes("ProcessUniverse3D"));
});

test("material master uses permanent family groups, kg/piece units and kg/m3 density references", () => {
  assert.ok(inventory.includes('MATERIAL_TYPE_GROUPS.map(group=><optgroup'));
  assert.ok(inventory.includes('value={materialDraft.unit==="kg"?"kg":"piece"}'));
  assert.ok(inventory.includes('<option value="kg">Kilogram (kg)</option><option value="piece">Piece / each</option>'));
  assert.ok(inventory.includes("Density (kg/m³)"));
  assert.ok(inventory.includes('densityUnit:"kg/m3"'));
  assert.ok(catalogue.includes('export function materialReferenceForGrade'));
  assert.ok(catalogue.includes('export function materialDensityReference'));
  assert.ok(catalogue.includes('["Carbon steel","EN8",7850'));
  assert.ok(catalogue.includes('["Aluminium","Aluminium 6082",2700'));
  assert.ok(catalogue.includes("kg/m³"));
});

test("new/edit amount fields stay blank and remain editable with the mobile decimal keyboard", () => {
  assert.ok(quickCreate.includes('const [rate,setRate]=useState("")'));
  assert.ok(quickCreate.includes('type="text" inputMode="decimal" value={rate}'));
  assert.ok(quickCreate.includes("setCategory(categories[0])"));
  assert.ok(componentMaster.includes('type="text" inputMode="decimal" value={componentPriceInput}'));
  for (const field of ["draft.ratePerPart","draft.actualRatePerPart","draft.paidAmount","draft.transportCost"]) {
    assert.ok(inlineEditor.includes('type="text" inputMode="decimal" value={' + field));
  }
});

test("Logo Studio counts actual distinct manufacturing pictograms rather than style combinations", () => {
  const entries = [...icons.matchAll(/\{glyph:"([^"]+)",label:"([^"]+)",application:"([^"]+)"\}/g)];
  const glyphs = new Set(entries.map(match=>match[1]));
  assert.ok(glyphs.size >= 97);
  assert.equal(glyphs.size, entries.length);
  assert.ok(iconStudio.includes("Distinct manufacturing pictograms"));
  assert.ok(iconStudio.includes("Visual styling combinations · same symbols"));
  assert.ok(iconStudio.includes("Drilling / Boring"));
  assert.ok(iconStudio.includes("Gear Manufacturing"));
  assert.ok(icons.includes('glyph:"component-block"'));
  assert.ok(icons.includes('glyph:"material-stock"'));
});
