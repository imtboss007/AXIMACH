import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readSource = (path) => readFile(resolve(root, path), "utf8");

test("the main module catalogue and 3D command sphere expose the same 20 unique workspaces", async () => {
  const [app, orb] = await Promise.all([
    readSource("src/App.tsx"),
    readSource("src/AXIMACHOrb.tsx")
  ]);

  const moduleBlock = app.match(/const modules: ModuleItem\[\] = \[([\s\S]*?)\n\];/);
  const satelliteBlock = orb.match(/const satellites = \[([\s\S]*?)\n\];/);
  assert.ok(moduleBlock, "main module catalogue must exist");
  assert.ok(satelliteBlock, "3D sphere module catalogue must exist");

  const moduleIds = [...moduleBlock[1].matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*title:/g)].map((match) => match[1]);
  const satelliteIds = [...satelliteBlock[1].matchAll(/\{\s*id:\s*"([^"]+)"\s*,\s*label:/g)].map((match) => match[1]);

  assert.equal(moduleIds.length, 20, "the main catalogue must contain 20 modules");
  assert.equal(new Set(moduleIds).size, 20, "main module IDs must be unique");
  assert.equal(satelliteIds.length, 20, "the 3D sphere must expose all 20 module controls");
  assert.equal(new Set(satelliteIds).size, 20, "3D sphere module IDs must be unique");
  assert.deepEqual([...satelliteIds].sort(), [...moduleIds].sort(), "the 3D sphere and navigation rail must expose identical module IDs");
});


test("Company Directory exposes both company and factory registers", async () => {
  const source = await readSource("src/ManufacturingMasterWorkspace.tsx");
  assert.match(source, /\{moduleId === "companies" && <div className="costing-tabs">/);
  assert.match(source, /setTab\("companies"\)/);
  assert.match(source, /setTab\("factories"\)/);
  assert.doesNotMatch(source, /\{false && moduleId === "companies"/);
});


test("Data Exchange import and export workspaces forward real cross-module navigation", async () => {
  const source = await readSource("src/App.tsx");
  assert.match(source, /<ExportCentreWorkspace[^>]*onSelectModule=\{onSelectModule\}/);
  assert.match(source, /<ImportCentreWorkspace[^>]*onSelectModule=\{onSelectModule\}/);
  assert.match(source, /<DataExchangeWorkspace[^>]*onSelectModule=\{selectModule\}/);
  assert.doesNotMatch(source, /<ExportCentreWorkspace[^>]*onSelectModule=\{\(\)\s*=>\s*\{\}\}/);
  assert.doesNotMatch(source, /<ImportCentreWorkspace[^>]*onSelectModule=\{\(\)\s*=>\s*\{\}\}/);
});
