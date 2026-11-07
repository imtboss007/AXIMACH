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


test("dashboard command globe exposes 18 unique, distinguishable module shortcuts", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const satelliteBlock = orb.match(/const satellites = \[([\s\S]*?)\n\];/);
  assert.ok(satelliteBlock, "command globe satellite registry exists");
  const ids = [...satelliteBlock[1].matchAll(/id: "([^"]+)"/g)].map(match => match[1]);
  const labels = [...satelliteBlock[1].matchAll(/label: "([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, 18);
  assert.equal(new Set(ids).size, 18, "module shortcut IDs must be unique");
  assert.equal(labels.length, 18);
  assert.equal(new Set(labels).size, 18, "module shortcut labels must be distinguishable");
  assert.ok(ids.includes("transport-master") && ids.includes("dispatch"));
});

test("all 18 sphere module buttons stay viewer-facing and the lower data shell is separate", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const depthClose = orb.indexOf("</motion.div>\\n        <div className=\"ax-orb-module-shell\"");
  const lowerShell = orb.indexOf('<div className="ax-orb-lower-shell"');
  assert.ok(depthClose >= 0, "module controls must sit outside the rotating 3D depth layer");
  assert.ok(lowerShell > depthClose, "lower data shell must follow the sphere and module layer");
  assert.ok(orb.includes('aria-label="18 clickable AXIMACH modules"'));
  assert.ok(orb.includes("const angle = (Math.PI * 2 * index) / satellites.length"));
  assert.ok(orb.includes('aria-label="Separate live record summary shell"'));
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.match(css, /\\.ax-orb-lower-shell \\{[\\s\\S]*?position:relative;[\\s\\S]*?bottom:auto;/);
  assert.match(css, /\\.ax-orb-module-shell \\{[\\s\\S]*?pointer-events:none;/);
});

test("3D command centre lower shell shows all six requested live record categories", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  for (const label of ["Companies", "Purchase orders", "PO component lines", "Components", "Vendors", "Open operations"]) {
    assert.ok(orb.includes('label: "' + label + '"'), "missing lower-shell metric: " + label);
  }
  assert.ok(orb.includes("activeRows(data.companies).length"));
  assert.ok(orb.includes("activeRows(data.purchaseOrders).length"));
  assert.ok(orb.includes("activeRows(data.components).length"));
  assert.ok(orb.includes("activeRows(data.vendors).length"));
  assert.ok(orb.includes("activeRows(data.operations).filter"));
  assert.ok(orb.includes("ax-orb-lower-rotator"));
  assert.ok(orb.includes("compactViewport ? 94 : 132"), "lower-shell orbit radius must shrink on mobile");
});

test("dashboard renders recent operations, exceptions, master records and production status from saved data", () => {
  const dashboard = readFileSync(new URL("../src/DashboardWorkspace.tsx", import.meta.url), "utf8");
  for (const label of ["Recent operations", "Recorded exceptions", "Master records", "Production status"]) {
    assert.ok(dashboard.includes(label), "missing dashboard section: " + label);
  }
  assert.ok(dashboard.includes("useManufacturingData()"));
  assert.ok(dashboard.includes("updatedAt"));
  assert.ok(dashboard.includes("overdue.length"));
  assert.ok(dashboard.includes("pendingJobs.length"));
});

test("Component Master supplies component-linked identity and PDF/Excel export for selected and all records", () => {
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  const icons = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(master.includes("<ComponentIcon componentId={row.id}"));
  assert.ok(master.includes("exportComponentsPdf"));
  assert.ok(master.includes("exportComponentsExcel"));
  assert.ok(master.includes("Selected PDF"));
  assert.ok(master.includes("Selected Excel"));
  assert.ok(master.includes("All PDF"));
  assert.ok(master.includes("All Excel"));
  assert.ok(icons.includes('assignments["component:" + componentId]'));
  assert.ok(icons.includes("MechanicalComponentIcon componentName={componentName}"));
});

test("AXIMACH globe uses a WebGL fragment shader to render a shaded spherical surface", () => {
  const sphere = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(sphere.includes('canvas.getContext("webgl"'));
  assert.ok(sphere.includes("gl_FragColor"));
  assert.ok(sphere.includes("vec3 ro = vec3(0.0, 0.0, 2.35)"));
  assert.ok(sphere.includes("float h = b*b - (dot(ro,ro) - 1.0)"));
  assert.ok(sphere.includes("gl.drawArrays(gl.TRIANGLES, 0, 6)"));
});


test("PC-hosted shared data exposes a protected LAN endpoint and Android permits the configured private-LAN transport", () => {
  const server = readFileSync(new URL("../server/index.mjs", import.meta.url), "utf8");
  const client = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const electron = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");
  const capacitor = JSON.parse(readFileSync(new URL("../capacitor.config.json", import.meta.url), "utf8"));
  const followUp = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.ok(server.includes('server.listen(PORT, "0.0.0.0"'));
  assert.ok(server.includes('url.pathname === "/api/connection-info"'));
  assert.ok(server.includes('req.headers["x-aximach-key"]'));
  assert.ok(server.includes('url.pathname === "/api/manufacturing-data" && req.method === "PUT"'));
  assert.ok(electron.includes('PORT: "8787"'));
  assert.ok(electron.includes('AXIMACH_DATA_FILE: path.join(serverDir, "aximach.json")'));
  assert.equal(capacitor.android.allowMixedContent, true);
  assert.ok(client.includes('window.localStorage.getItem("aximach.scheduler.url")'));
  assert.ok(client.includes('window.localStorage.getItem("aximach.scheduler.key")'));
  assert.ok(client.includes('window.setInterval(() => { void syncOnce(); }, 2500)'));
  assert.ok(followUp.includes("PC → Android private Wi-Fi connection"));
  assert.ok(followUp.includes("Use one shared server URL and API key on both devices"));
});


test("custom Process Directory category and process values are committed when the user taps Add Process", () => {
  const picker = readFileSync(new URL("../src/SearchablePicker.tsx", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(picker.includes("const typedValue = query.trim()"));
  assert.ok(picker.includes("if (allowCustom && typedValue)"));
  assert.ok(picker.includes("onChange(exact?.id || typedValue)"));
  assert.ok(directory.includes('allowCustom/>'));
  assert.ok(directory.includes('onClick={save}'));
  assert.ok(directory.includes('setCategory(value)'));
  assert.ok(directory.includes('setProcessType(value)'));
});
