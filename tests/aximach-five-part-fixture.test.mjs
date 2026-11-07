import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-five-part-process-catalog.json", import.meta.url), "utf8"));

test("five-part AXIMACH fixture has five unique component records", () => {
  assert.equal(fixture.parts.length, 5);
  assert.equal(new Set(fixture.parts.map(part => part.partNumber)).size, 5);
});

test("each example part has linked category, process, sub-process and tolerance data", () => {
  for (const part of fixture.parts) {
    assert.ok(part.partNumber && part.name && part.revision && part.material);
    assert.ok(part.processes.length >= 4, part.partNumber + " needs a multi-operation route");
    for (const process of part.processes) {
      assert.ok(process.category, part.partNumber + " has a process without category");
      assert.ok(process.processType, part.partNumber + " has a process without type");
      assert.ok(process.subProcess, part.partNumber + " has a process without sub-process");
      assert.ok(["Standard", "Precision", "Ultra Precision"].includes(process.toleranceClass));
    }
  }
});

test("fixture covers multiple process categories and multiple sub-processes under a process type", () => {
  const allProcesses = fixture.parts.flatMap(part => part.processes);
  assert.ok(new Set(allProcesses.map(row => row.category)).size >= 8);
  const typeGroups = new Map();
  for (const row of allProcesses) {
    const key = row.category + "::" + row.processType;
    if (!typeGroups.has(key)) typeGroups.set(key, new Set());
    typeGroups.get(key).add(row.subProcess);
  }
  assert.ok([...typeGroups.values()].some(subProcesses => subProcesses.size > 1));
});

test("fixture includes Ultra Precision, Precision and Standard classifications", () => {
  const classes = new Set(fixture.parts.map(part => part.precisionClass));
  assert.ok(classes.has("Ultra Precision"));
  assert.ok(classes.has("Precision"));
  assert.ok(classes.has("Standard"));
});

test("Process Plan rejects stale process-definition IDs when the definition name or category changed", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('item.id === draft.processDefinitionId && item.processType === draft.name && item.category === draft.category'));
  assert.ok(workspace.includes('processDefinitionId: selectedProcessDefinition?.id || undefined'));
});

test("Process Directory prevents duplicate process type within the same category", () => {
  const workspace = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("row.id!==editingId&&row.category.trim().toLowerCase()===category.trim().toLowerCase()&&row.processType.trim().toLowerCase()===processType.trim().toLowerCase()"));
  assert.ok(workspace.includes("This process type already exists in the selected category"));
});

test("additional planned-cost process rows cascade by category and stable definition ID", () => {
  const workspace = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /processDefinitionId:\s*next\?\.id/);
  assert.match(workspace, /value=\{row\.processDefinitionId\}/);
  assert.match(workspace, /definitions\.filter\(item=>!row\.processCategory\|\|item\.category===row\.processCategory\)/);
  assert.match(workspace, /item=>item\.id===row\.processDefinitionId/);
});
