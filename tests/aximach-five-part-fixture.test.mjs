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

test("all 18 module shortcuts rotate with the manually draggable globe and the lower live-data sphere remains separate", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const depthOpen = orb.indexOf('<motion.div className="ax-orb-depth"');
  const moduleShell = orb.indexOf('className="ax-orb-module-shell"');
  const moduleClose = orb.indexOf("</motion.div>", moduleShell);
  const depthClose = orb.indexOf("</motion.div>", moduleClose + 1);
  const lowerShell = orb.indexOf('<div className="ax-orb-lower-shell"');
  assert.ok(depthOpen >= 0 && depthOpen < moduleShell && moduleShell < moduleClose && moduleClose < depthClose,
    "module controls must be children of the same draggable 3D globe");
  assert.ok(lowerShell > depthClose, "live-data shell must be separate and below the globe");
  assert.ok(orb.includes('aria-label="18 clickable AXIMACH modules"'));
  assert.ok(orb.includes('aria-label="Separate live record summary shell"'));
  assert.ok(orb.includes('style={{rotateX,rotateY,transformStyle:"preserve-3d",transformPerspective:950}}'));
  assert.ok(orb.includes('className="ax-orb-core"'));
  assert.ok(orb.includes('style={{ transformStyle: "preserve-3d", scale: sphereSize * (zoomed ? 1.2 : 1) }}'));
  assert.ok(orb.includes('style={{ transformStyle: "preserve-3d", scale: sphereSize * (zoomed ? 1.2 : 1) }}'));
  assert.ok(orb.includes("const startDrag ="));
  assert.ok(orb.includes("const startLowerDrag ="));
  assert.ok(orb.includes('onClick={() => onSelectModule(id)}'));
  assert.ok(orb.includes('onClick={() => { if (!lowerDragMoved.current) onSelectModule(id); }}'));
  assert.ok(!orb.includes("useAnimationFrame"));
  assert.ok(!orb.includes("rotateY:360"));
  assert.ok(!orb.includes("rotate:360"));
  assert.ok(orb.includes('transform: "translate3d(" + x + "px," + y + "px," + z + "px)'));
  assert.ok(orb.includes("Math.sqrt(Math.max(0.08, 1 - radialX * radialX - radialY * radialY))"));
  assert.ok(orb.includes('{ count: 4, radial: 0.40'));
  assert.ok(orb.includes('{ count: 6, radial: 0.65'));
  assert.ok(orb.includes('{ count: 8, radial: 0.90'));
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.match(css, /\.ax-orb-module-shell \{[\s\S]*?pointer-events:none;[\s\S]*?transform-style:preserve-3d;/);
  assert.match(css, /\.ax-orb-lower-shell \{[\s\S]*?position:relative;[\s\S]*?bottom:auto;/);
});

test("Process Directory process-type options use category-scoped unique record keys", () => {
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(directory.includes('id:row.category+"::"+row.processType'));
  assert.ok(directory.includes('row.category+"::"+row.processType===value'));
  assert.ok(directory.includes('value={rows.some(row=>row.category===category&&row.processType===processType)?category+"::"+processType:processType}'));
});

test("linked Process Map context survives async shared-data hydration and is not replaced by auto-restore", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /initialContext\?\.vendorId, data, companies\]\);/);
  assert.ok(workspace.includes("appliedLinkedContext.current === contextKey"));
  assert.match(workspace, /if \(initialContext\?\.poId \|\| initialContext\?\.poLineId \|\| initialContext\?\.componentId \|\| initialContext\?\.operationId \|\| initialContext\?\.vendorId\) return;/);
});

test("new PO lines do not copy Component Master selling prices into editable line prices", () => {
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const costing = readFileSync(new URL("../src/LinkedCostingWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(master.includes('const blankLine = (): Omit<PurchaseOrderLine, "id"> => ({ componentId: "", quantity: 0, targetDelivery: "", notes: "" })'));
  assert.ok(master.includes("delete clean.unitPrice"));
  assert.ok(data.includes("unitPrice?: number"));
  assert.ok(costing.includes("const sellingRate = selectedComponent?.salePrice ?? 0"));
  assert.ok(!costing.includes("unitPrice"), "Costing must not read or write retired PO-line selling prices");
  assert.ok(costing.includes("if (key === \"salePrice\")"));
  assert.ok(costing.includes("components: current.components.map(component => component.id === selectedComponent.id ? { ...component, salePrice: amount, updatedAt } : component)"));
});

test("Process Map shows clickable Process Directory stage nodes before production operations are saved", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.match(workspace, /processDefinitions\.length > 0/);
  assert.match(workspace, /onAddProcessDefinition=\{startAddDefinition\}/);
  assert.match(universe, /process-directory-map-catalog/);
  assert.match(universe, /onAddProcessDefinition\?\.\(definition\.id\)/);
  assert.match(universe, /not yet saved as production operations/);
  assert.match(workspace, /Save it to create the real operation for this PO component line/);
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


test("Component Master price unit migration preserves legacy set records", () => {
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(data.includes('salePriceUnit: "piece" | "set"'));
  assert.ok(data.includes('component.salePriceUnit === "set" ? "set" as const : component.salePriceUnit === "piece" ? "piece" as const : component.orderUnit === "Set" ? "set" as const : "piece" as const'));
});


test("Process Directory maintains permanent sub-process IDs through in-place renames and Logo Studio assigns by ID", () => {
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  const map = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(data.includes("subcategoryIds?: string[]"));
  assert.ok(directory.includes("const nextSubcategoryIds=nextSubcategories.map"));
  assert.ok(directory.includes("old?.subcategoryIds?.[index]"));
  assert.ok(studio.includes('"subcategory:" + targetSubcategoryId'));
  assert.ok(studio.includes('assignments["subcategory:" + subcategoryId]'));
  assert.ok(studio.includes('targetType === "subcategory"'));
  assert.ok(map.includes('subcategory={operation.subcategory}'));
});

test("3D Process Map places unsaved Process Directory definitions on the interactive orbit", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("const catalogueOrbitNodes = useMemo"));
  assert.ok(universe.includes("const showCatalogueOrbit = operations.length === 0"));
  assert.ok(universe.includes("onAddProcessDefinition?.(definition.id)"));
  assert.ok(universe.includes('className="process-orbit-node status-planned process-orbit-node-catalog"'));
  assert.ok(universe.includes("DIRECTORY STAGES"));
});

test("Mechanical icon inventory covers cutting tools, production machines, workholding and metrology", () => {
  const mechanical = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  for (const glyph of ["cnc-machine", "vmc-machine", "lathe-machine", "edm-machine", "grinding-machine", "laser-cutter", "welding-station", "fixture-jig", "cmm-machine", "caliper"]) {
    assert.ok(mechanical.includes('glyph:"' + glyph + '"'), "missing mechanical symbol: " + glyph);
  }
  assert.ok(mechanical.includes("export const MECHANICAL_ICON_INVENTORY"));
  assert.ok(directory.includes("Mechanical Icon Inventory"));
  assert.ok(directory.includes("MECHANICAL_ICON_INVENTORY.map"));
});

test("Component Master exposes column-wise searchable filters for company, part number, name, revision, drawing and unit", () => {
  const workspace = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  for (const key of ["componentCompanyFilters", "componentNumberFilters", "componentNameFilters", "componentRevisionFilters", "componentDrawingFilters", "componentUnitFilters"]) {
    assert.ok(workspace.includes(key), "missing Component Master filter: " + key);
  }
  assert.ok(workspace.includes("componentNumberFilters.includes(c.partNumber)"));
  assert.ok(workspace.includes("componentNameFilters.includes(c.name)"));
  assert.ok(workspace.includes("componentDrawingFilters.includes(c.drawingReference||\"—\")"));
  assert.ok(workspace.includes('id="component-master-number-filter"'));
  assert.ok(workspace.includes('id="component-master-name-filter"'));
  assert.ok(workspace.includes('id="component-master-drawing-filter"'));
});

test("Purchase Orders exposes column-wise searchable filters and guarded delete-all controls", () => {
  const workspace = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  for (const key of ["poCompanyFilters", "poNumberFilters", "poIssueDateFilters", "poDeliveryFilters", "poComponentFilters", "poStatusFilters"]) {
    assert.ok(workspace.includes(key), "missing Purchase Orders filter: " + key);
  }
  assert.ok(workspace.includes("poNumberFilters.includes(p.number)"));
  assert.ok(workspace.includes("poIssueDateFilters.includes(p.issueDate||\"—\")"));
  assert.ok(workspace.includes("poDeliveryFilters.includes(p.targetDelivery||\"—\")"));
  assert.ok(workspace.includes("p.lines.some(line=>poComponentFilters.includes(line.componentId))"));
  assert.ok(workspace.includes("Delete all Purchase Orders"));
  assert.ok(workspace.includes("Delete all components"));
});

test("Production Plan renders saved transport legs with route, anchor, vendor and trip details", () => {
  const production = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(production.includes("jobTransportLegs.map(leg=>"));
  assert.ok(production.includes('leg.placement==="start"?"At component start":leg.placement==="before"?"Before":"After"'));
  assert.ok(production.includes("leg.fromLocation} → {leg.toLocation}"));
  assert.ok(production.includes("leg.tripCount} trip(s)"));
  assert.ok(production.includes("leg.status||\"Queued\""));
});

test("Process Plan Add operation dropdown exposes working operation and route actions", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  for (const option of [
    "Add operation ▾",
    "Blank process operation",
    "Process Directory stage",
    "Add selected stage",
    "Add sub-process under selected",
    "Create alternate route from selected",
    "Create rework branch from selected",
    "Add step inside selected branch"
  ]) assert.ok(workspace.includes(option), "missing Add Operation menu option: " + option);
  assert.ok(workspace.includes("const toggleAddMenu = () =>"));
  assert.ok(workspace.includes("const openAddMenu = () =>"));
  assert.ok(workspace.includes("onClick={()=>startAddDefinition(addMenuDefinitionId)}"));
  assert.ok(workspace.includes("onClick={()=>activeOperation&&startAddSubprocess(activeOperation.id)}"));
  assert.ok(workspace.includes("onClick={()=>startAddBranch(\"alternate\")}"));
  assert.ok(workspace.includes("onClick={()=>startAddBranch(\"rework\")}"));
});

test("Process Plan route scope drives displayed visuals and every export format", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const exportOperations = getRouteScopeOperations(exportScope)"));
  assert.ok(workspace.includes("operations={exportOperations} allOperations={routeOperations}"));
  assert.ok(workspace.includes("exportOperations.map(op=>"));
  assert.ok(workspace.includes("exportBranches.map(branch =>"));
  assert.ok(workspace.includes('aria-label="Selected route arrow diagram"'));
  assert.ok(workspace.includes("route.addRows(exportOperations.map(op =>"));
  assert.ok(workspace.includes("nextInSameRoute"));
  for (const field of ['header: "Relation"', 'header: "Parent process"', 'header: "Next process"', 'header: "Next operation ID"']) {
    assert.ok(workspace.includes(field), "missing branch-aware Excel route field: " + field);
  }
  assert.ok(workspace.includes('next: exportArrows && nextInSameRoute ? "→ " + nextInSameRoute.name : ""'));
  assert.ok(workspace.includes('const rows=exportOperations.filter(op=>(op.branch||"Main route")===branch)'));
  assert.ok(workspace.includes("const buildExportSvg = () =>"));
  assert.ok(workspace.includes("Choose the route to display and export"));
});

test("Alternate and rework routes use different arrow colours while process types retain their own identity colour", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(workspace.includes('const ALTERNATE_ROUTE_COLOR = "#4b95eb"'));
  assert.ok(workspace.includes('const REWORK_ROUTE_COLOR = "#e38b45"'));
  assert.ok(workspace.includes("const routeArrowColor=rework?REWORK_ROUTE_COLOR:branchRoot||branch!==\"Main route\"?ALTERNATE_ROUTE_COLOR:processColor"));
  assert.ok(workspace.includes("const processColor=processAccent(operation)"));
  assert.ok(workspace.includes("displayColor: draft.processColor"));
  assert.ok(universe.includes("processDefinition?.displayColor || operation.processColor"));
  assert.ok(css.includes(".process-universe-lane.is-branch.is-alternate .process-universe-connector"));
  assert.ok(css.includes(".process-universe-lane.is-branch.is-rework .process-universe-connector"));
  assert.ok(css.includes(".process-universe-branch-link.is-rework"));
});

test("Every process row can open Logo Studio for its own Process Directory record", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('title="Assign process logo"'));
  assert.ok(workspace.includes("Add / change process logo"));
  assert.ok(app.includes("onOpenIconStudio={(processDefinitionId)=>"));
  assert.ok(app.includes("initialTarget={iconStudioTarget}"));
  assert.ok(studio.includes('initialTarget?: { targetType: "process"; targetRecordId: string } | null'));
  assert.ok(studio.includes("setTargetRecordId(initialTarget.targetRecordId)"));
});

test("Delete process archives the selected node and all descendants without destroying payment or inspection history", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const deleteOperation = (target: OperationRecord) =>"));
  assert.ok(workspace.includes("while (frontier.length)"));
  assert.ok(workspace.includes("child.parentId === parentId"));
  assert.ok(workspace.includes("quotations: current.quotations.map(quote => ids.has(quote.operationId)"));
  assert.ok(workspace.includes("payment, inspection and production history are retained for audit"));
  assert.ok(workspace.includes('title="Delete process"'));
  assert.ok(workspace.includes("Delete process</button>"));
});

test("Five fixture parts create independent multi-process routes linked by stable PO, line and component IDs", () => {
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-five-part-process-catalog.json", import.meta.url), "utf8"));
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.equal(fixture.parts.length, 5);
  const linked = fixture.parts.flatMap(part => {
    const componentId = "component:" + part.partNumber;
    const poId = "po:" + part.partNumber;
    const poLineId = "line:" + part.partNumber;
    return part.processes.map((process, index) => ({
      id: "operation:" + part.partNumber + ":" + index,
      componentId, poId, poLineId, sequence: (index + 1) * 10,
      name: process.processType, category: process.category, subcategory: process.subProcess
    }));
  });
  for (const part of fixture.parts) {
    const route = linked.filter(row => row.componentId === "component:" + part.partNumber);
    assert.equal(route.length, part.processes.length);
    assert.ok(route.length >= 4);
    assert.ok(route.every(row => row.poId === "po:" + part.partNumber && row.poLineId === "line:" + part.partNumber));
    assert.equal(new Set(route.map(row => row.id)).size, route.length);
  }
  assert.equal(new Set(linked.map(row => row.componentId)).size, 5);
  assert.ok(workspace.includes("id: operationId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id"));
});

test("Dashboard spheres only rotate on direct drag and dashboard navigation buttons select the correct views", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const process = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(!orb.includes("useAnimationFrame"));
  assert.ok(!orb.includes("rotateY:360"));
  assert.ok(!orb.includes("rotate:360"));
  assert.ok(orb.includes("const startDrag ="));
  assert.ok(orb.includes('className="ax-orb-depth" style={{rotateX,rotateY'));
  assert.ok(orb.includes("const dragSensitivity = speed ==="));
  assert.ok(orb.includes("const startLowerDrag ="));
  assert.ok(orb.includes("onPointerDown={startLowerDrag}"));
  assert.ok(orb.includes("onPointerDown={event=>{event.stopPropagation();startLowerDrag(event);}}"));
  assert.ok(!process.includes("useAnimationFrame"));
  assert.ok(app.includes('onClick={() => selectModule("dashboard")}'));
  assert.ok(app.includes('onClick={() => selectModule("command-centre")}'));
  assert.ok(app.includes('activeModuleId === "dashboard"'));
  assert.ok(app.includes('activeModuleId === "command-centre"'));
});

test("WebGL globe texture itself has no independent auto-rotation", () => {
  const shader = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(shader.includes("vec3 q = hit;"), "sphere texture must remain fixed relative to its draggable parent");
  assert.ok(!shader.includes("uniform float time"));
  assert.ok(!shader.includes("uniform float motionOn"));
  assert.ok(!shader.includes("float angle ="));
  assert.ok(!shader.includes("elapsed +="));
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes("<AXIMACHWebGLSphere />"));
  assert.ok(!orb.includes("paused={"));
});

test("Process Map exposes mobile route scope, process delete, logo assignment and branch-specific arrows", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('id="process-map-route-scope-mobile"'));
  assert.ok(workspace.includes("Delete selected process"));
  assert.ok(workspace.includes("Add process logo"));
  assert.ok(workspace.includes("REWORK_ROUTE_COLOR:ALTERNATE_ROUTE_COLOR"));
  assert.ok(universe.includes('lane.branchRelation==="rework"?"#e38b45":"#4b95eb"'));
  assert.ok(universe.includes('lane.branchRelation==="alternate"?"#4b95eb":accent'));
});

test("AXIMACH command sphere module buttons can be dragged without losing click navigation", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes("onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}"));
  assert.ok(orb.includes("if (!dragMoved.current) onSelectModule(id)"));
  assert.ok(orb.includes("Both spheres are stationary until the user drags them. No idle auto-rotation."));
});
