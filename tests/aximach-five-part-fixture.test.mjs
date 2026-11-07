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

test("Process Plan enforces whole-number operation and production quantities", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("operationQuantities.some(value=>!Number.isSafeInteger(Number(value))||Number(value)<0)"));
  assert.ok(workspace.includes("draft.quantity<1"));
  assert.ok(workspace.includes("draft.completed>draft.quantity"));
  assert.ok(workspace.includes("draft.accepted + draft.rejected > draft.completed"));
});

test("Inventory ledger enforces transaction direction, source references and live linked records", () => {
  const workspace = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('"Issue to production": "out"'));
  assert.ok(workspace.includes('"Finished goods receipt": "in"'));
  assert.ok(workspace.includes("const requiredDirection = fixedStockDirections[transactionType]"));
  assert.ok(workspace.includes('if (!reference.trim())'));
  assert.ok(workspace.includes("The selected operation does not belong to the chosen PO line"));
  assert.ok(workspace.includes("op.id === bomIssueOperationId && op.poId === po.id && op.poLineId === line.id && !op.deletedAt"));
});
test("BOM and material masters reject invalid quantities, scrap limits and inactive links", () => {
  const workspace = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("Number.isFinite(Number(materialDraft.ratePerUnit))"));
  assert.ok(workspace.includes("!components.some(component => component.id === bomDraft.componentId)"));
  assert.ok(workspace.includes("bomDraft.scrapPercent > 100"));
});
test("Costing validates quotation amounts, dates, active vendors and process capability links", () => {
  const workspace = readFileSync(new URL("../src/LinkedCostingWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("Number.isSafeInteger(qty)"));
  assert.ok(workspace.includes("Number.isFinite(quoteTransport)"));
  assert.ok(workspace.includes("validUntil < quotedAt"));
  assert.ok(workspace.includes("operationDefinition?.vendorIds?.length"));
  assert.ok(workspace.includes("quote.validUntil && quote.validUntil < stamp()"));
});
test("Completed operations record an actual end date in Process Plan and Quality Inspection", () => {
  const processPlan = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const quality = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(processPlan.includes('actualEnd: draft.status === "Complete" ? (draft.actualEnd || stamp.slice(0,10)) : draft.actualEnd'));
  assert.ok(quality.includes('actualEnd:op.actualEnd||stamp.slice(0,10)'));
});

test("Process Plan bulk update validates dates and vendor capabilities, and synchronizes completion", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const scheduleConflict = selected.find(op =>"));
  assert.ok(workspace.includes("definition?.vendorIds?.length && !definition.vendorIds.includes(bulkVendorId)"));
  assert.ok(workspace.includes('bulkStatus === "Complete" ? { completed: Math.max(op.completed || 0, op.quantity || 0), actualEnd: op.actualEnd || stamp }'));
  assert.ok(workspace.includes('jobStatus: "In progress" as const, jobFinishedAt: undefined'));
});
test("Process Plan rejects archived vendors, reversed actual dates and incomplete Complete status", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("draft.vendorId && !vendors.some(vendor => vendor.id === draft.vendorId)"));
  assert.ok(workspace.includes("draft.actualEnd < draft.actualStart"));
  assert.ok(workspace.includes('draft.status === "Complete" && draft.completed !== draft.quantity'));
});
test("Quality Inspection limits the measurement selector to search-visible operations and validates nominal tolerance", () => {
  const workspace = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("{filtered.map(op=><option key={op.id} value={op.id}>"));
  assert.ok(workspace.includes("nominal<lower"));
  assert.ok(workspace.includes("nominal>upper"));
  assert.ok(workspace.includes('key==="status"&&value==="Complete"&&currentOperation.completed!==currentOperation.quantity'));
});
test("Production Plan hides inactive transport routes and Transport Directory rejects archived vendors", () => {
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const transport = readFileSync(new URL("../src/TransportDirectoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(operations.includes("route.vendorId===draft.vendorId&&route.active!==false"));
  assert.ok(transport.includes("!vendors.some(vendor => vendor.id === vendorId)"));
});

test("Quality measurement save uses only the currently filtered selected operation", () => {
  const workspace = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const operation=selectedMeasurementOperation;"));
  assert.ok(workspace.includes("value={selectedMeasurementOperation?.id||\"\"}"));
  assert.ok(!workspace.includes("ops.find(op=>op.id===(measurementOperationId||selectedMeasurementOperation?.id))"));
});

test("Quality Inspection enforces whole-number quantity balance and operation quantity limits", () => {
  const workspace = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("!Number.isSafeInteger(quantity)||quantity<0"));
  assert.ok(workspace.includes("nextCompleted>currentOperation.quantity"));
  assert.ok(workspace.includes("nextAccepted+nextRejected>nextCompleted"));
});

test("Production Plan bulk finish checks incomplete operations against exact PO and PO-line pairs", () => {
  const workspace = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("new Set(selectedVisibleJobs.map(row=>row.po.id+\":\"+row.line.id))"));
  assert.ok(workspace.includes("selectedIds.has(op.poId+\":\"+op.poLineId)"));
});

test("Transport assignment rejects inactive directory routes in both creation workflows", () => {
  const production = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const processPlan = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(production.includes("if(route.active===false)"));
  assert.ok(production.includes("route.active!==false"));
  assert.ok(processPlan.includes("selectedTransportDirectoryRoute.active===false"));
  assert.ok(processPlan.includes("route.active!==false"));
});

test("Process Plan transport assignment rejects missing vendors and invalid master rates", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("vendors.some(vendor=>vendor.id===selectedTransportDirectoryRoute.vendorId)"));
  assert.ok(workspace.includes("!Number.isFinite(Number(selectedTransportDirectoryRoute.fixedAmount))"));
  assert.ok(workspace.includes("Number(selectedTransportDirectoryRoute.fixedAmount)<0"));
});

test("Process Plan enforces Process Directory vendor assignments", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('selectedProcessDefinition?.vendorIds?.length && draft.vendorId && !selectedProcessDefinition.vendorIds.includes(draft.vendorId)'));
  assert.ok(workspace.includes('vendorStillAssigned=!definition?.vendorIds?.length||definition.vendorIds.includes(draft.vendorId)'));
  assert.ok(workspace.includes('subcategory:"",vendorId:""'));
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
