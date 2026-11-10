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
  assert.ok(!operations.includes("const openTransport=(poId:string,lineId:string)"));
  assert.ok(!operations.includes("route.vendorId===draft.vendorId&&route.active!==false"));
  assert.ok(!operations.includes("<th>Transport</th>"));
  assert.ok(operations.includes('onSelectModule("transport-master")'));
  assert.ok(operations.includes("Attach a route before or after a process from Process Map"));
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

test("Transport route ownership stays in Transport Directory and Process Plan rejects inactive saved routes", () => {
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const production = operations.slice(operations.indexOf("export function ProductionPlanWorkspace"), operations.indexOf("export function TransportDispatchWorkspace"));
  const processPlan = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(!production.includes("transportLine"));
  assert.ok(!production.includes("openTransport("));
  assert.ok(!production.includes("jobTransportLegs"));
  assert.ok(production.includes('onSelectModule("transport-master")'));
  assert.ok(processPlan.includes("selectedTransportDirectoryRoute.active===false"));
  assert.ok(processPlan.includes("route.active!==false"));
  assert.ok(processPlan.includes("componentTransportLegs"));
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
  assert.ok(workspace.includes('subcategory:"",processSubcategoryId:"",vendorId:""'));
});

test("Process Plan rejects stale process-definition IDs when the definition name or category changed", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('stableDefinition.processType === processType') && workspace.includes('stableDefinition.category === category'));
  assert.ok(workspace.includes('return matches.length === 1 ? matches[0] : undefined'));
  assert.ok(workspace.includes('processDefinitionId: processDefinition?.id || undefined'));
  assert.ok(workspace.includes("const resolvedDefinition = selectedProcessDefinition || resolveProcessDefinition"));
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
  const core = orb.indexOf('className="ax-orb-core"');
  assert.ok(core >= 0 && core < depthOpen, "the spherical WebGL globe must remain a sphere rather than rotate as a flat canvas plane");
  assert.ok(orb.includes('<AXIMACHWebGLSphere rotationX={rotateX} rotationY={rotateY} />'), "manual drag orientation must rotate the WebGL surface texture");
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
  assert.ok(orb.includes("onClick={() => { if (!dragMoved.current) toggleZoom(); }}"), "dragging on the globe core must not trigger click-to-zoom");
  assert.ok(orb.includes("const startDrag ="));
  assert.ok(orb.includes("const startLowerDrag ="));
  assert.ok(orb.includes('onClick={() => { if (!dragMoved.current) onSelectModule(id); }}'));
  assert.ok(orb.includes("onPointerDown={startDrag}"));
  assert.ok(!orb.includes("onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick"));
  assert.ok(orb.includes('onClick={() => { if (!lowerDragMoved.current) onSelectModule(id); }}'));
  assert.ok(!orb.includes("useAnimationFrame"));
  assert.ok(!orb.includes("rotateY:360"));
  assert.ok(!orb.includes("rotate:360"));
  assert.ok(orb.includes('transform: "translate3d(" + x + "px," + y + "px," + z + "px)'));
  assert.ok(orb.includes("const goldenAngle = Math.PI * (3 - Math.sqrt(5))"));
  assert.ok(orb.includes("const unitY = 1 - 2 * ((index + 0.5) / satellites.length)"));
  assert.ok(orb.includes("const ringRadius = Math.sqrt(Math.max(0, 1 - unitY * unitY))"));
  assert.ok(orb.includes("const yaw = Math.atan2(unitX, unitZ) * 180 / Math.PI"));
  assert.ok(orb.includes("const pitch = -Math.asin(unitY) * 180 / Math.PI"));
  assert.ok(orb.includes("compactViewport ? 116 : 132"));
  assert.ok(orb.includes('rotateY(" + yaw + "deg) rotateX(" + pitch + "deg)'));
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.match(css, /\.ax-orb-module-shell \{[\s\S]*?pointer-events:none;[\s\S]*?transform-style:preserve-3d;/);
  assert.match(css, /\.ax-orb-module-shell \.ax-orb-satellite \{[\s\S]*?backface-visibility:hidden;/);
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
  assert.ok(master.includes('const blankLine = (): Omit<PurchaseOrderLine, "id"> => ({ componentId: "", quantity: 0, targetDelivery: "", notes: "", allocationLevel: "component", partId: "" })'));
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

test("shared searchable pickers support exact, partial and numeric searches plus select-all and clear", () => {
  const picker = readFileSync(new URL("../src/SearchablePicker.tsx", import.meta.url), "utf8");
  const multi = readFileSync(new URL("../src/SearchableMultiSelect.tsx", import.meta.url), "utf8");
  assert.ok(picker.includes("option.label.toLocaleLowerCase().includes(needle)"));
  assert.ok(picker.includes("startsWith(needle)"));
  assert.ok(picker.includes("exact or partial match"));
  assert.ok(multi.includes("option.label.toLocaleLowerCase().includes(needle)"));
  assert.ok(multi.includes('onChange(options.map(option => option.id))'));
  assert.ok(multi.includes("onChange([])"));
  assert.ok(multi.includes("Select all"));
  assert.ok(multi.includes("Clear"));
});

test("Component Master opens Logo Studio for each stable component ID and exposes mechanical logo inventory", () => {
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(master.includes('onOpenIconStudio?.(row.id)'));
  assert.ok(master.includes("Mechanical logo inventory"));
  assert.ok(master.includes("MECHANICAL_ICON_INVENTORY.length"));
  assert.ok(app.includes('targetType:"component",targetRecordId:componentId'));
  assert.ok(studio.includes('targetType: "process" | "component" | "subcategory"'));
});

test("component logos are rendered as standalone SVGs and embedded in Component Master and PO exports", () => {
  const glyphs = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(glyphs.includes("export function mechanicalComponentSvgForName(componentName: string): string"));
  assert.ok(glyphs.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(master.includes('import { mechanicalComponentSvgForName } from "./MechanicalOperationIcon"'));
  assert.ok(master.includes('assignments["component:" + component.id]?.customAsset'));
  assert.ok(master.includes("async function componentLogoPngBase64"));
  assert.ok(master.includes("sheet.addImage(imageId"));
  assert.ok(master.includes("<th>Logo</th>"));
  assert.ok(master.includes('header:"Logo",key:"logo"'));
  assert.ok(master.includes("componentLogoSource(row)"));
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
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("const catalogueOrbitNodes = useMemo"));
  assert.ok(universe.includes("const showCatalogueOrbit = operations.length === 0"));
  assert.ok(universe.includes("catalogue={showCatalogueOrbit ? processDefinitions : undefined}"));
  assert.ok(universe.includes("onAddCatalogue={onAddProcessDefinition}"));
  assert.ok(scene.includes("cataloguePoints.forEach"));
  assert.ok(scene.includes("projectedCatalogue.map"));
  assert.ok(scene.includes("onAddCatalogue?.(definition.id)"));
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

test("Production Plan routes transport entry through Process Plan and keeps transport legs separate", () => {
  const operations = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const production = operations.slice(operations.indexOf("export function ProductionPlanWorkspace"), operations.indexOf("export function TransportDispatchWorkspace"));
  const processPlan = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(!production.includes("jobTransportLegs"));
  assert.ok(!production.includes("<th>Transport</th>"));
  assert.ok(production.includes("Attach a route before or after a process from Process Map"));
  assert.ok(production.includes('onSelectModule("process-map"'));
  assert.ok(processPlan.includes("const componentTransportLegs = allTransportLegs.filter"));
  assert.ok(processPlan.includes("const operationTransportAmount = (operation: OperationRecord)"));
  assert.ok(processPlan.includes("Add transport between route nodes"));
  assert.ok(processPlan.includes("Create a new route here"));
  assert.ok(processPlan.includes("Save route to Transport Directory"));
  assert.ok(processPlan.includes("anchorOperationId: transportPlacement === \"start\" ? \"\" : transportAnchorOperationId"));
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
  assert.ok(workspace.includes('if (scope === "all") return routeOperations;'), "All routes must include every saved operation even when filters are active");
  assert.ok(workspace.includes('if (scope === "filtered") return source;'), "Filtered results must be the explicit filtered-only scope");
  assert.ok(workspace.includes('{ key: "all", label: "All routes", count: routeOperations.length }'), "All routes count must reflect the complete saved route graph");
  assert.ok(workspace.includes("operations={exportOperations} allOperations={routeOperations}"));
  assert.ok(workspace.includes("exportOperations.map(op=>"));
  assert.ok(workspace.includes("exportBranches.map(routeGroup=>"));
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
  assert.ok(workspace.includes('const routeColor=rework?REWORK_ROUTE_COLOR:branchRoot||branch!=="Main route"?ALTERNATE_ROUTE_COLOR:"#5a8fc4"'));
  assert.ok(workspace.includes('legRelation==="rework"?REWORK_ROUTE_COLOR:legRelation==="alternate"?ALTERNATE_ROUTE_COLOR:"#1cc8e5"'));
  assert.ok(workspace.includes('className={"process-route-flow-arrow is-transport "+'));
  assert.ok(workspace.includes("const processColor=processAccent(operation)"));
  assert.ok(workspace.includes("displayColor: draft.processColor"));
  assert.ok(universe.includes("processDefinition?.displayColor || operation.processColor"));
  assert.ok(css.includes(".process-universe-lane.is-branch.is-alternate .process-universe-connector"));
  assert.ok(css.includes(".process-universe-lane.is-branch.is-rework .process-universe-connector"));
  assert.ok(css.includes(".process-universe-branch-link.is-rework"));
});

test("Process Plan resolves stable Process Directory IDs before legacy labels in filters and editor validation", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const resolveProcessDefinition ="));
  assert.ok(workspace.includes("const stableDefinition = definitionId ? definitions.find(definition => definition.id === definitionId) : undefined;"));
  assert.ok(workspace.includes("return matches.length === 1 ? matches[0] : undefined;"), "legacy name fallback must not guess between ambiguous definitions");
  assert.ok(workspace.includes("const selectedProcessDefinition = resolveProcessDefinition(processDefinitions, draft.processDefinitionId, draft.name, draft.category);"));
  assert.ok(workspace.includes("const operationDefinition = resolveProcessDefinition(processDefinitions, op.processDefinitionId, op.name, op.category);"));
  assert.ok(workspace.includes("const effectiveCategory = operationDefinition?.category || op.category;"));
  assert.ok(workspace.includes("categoryFilters.includes(effectiveCategory)"), "category filtering must follow the stable Process Directory definition when legacy operation text is stale");
});

test("Process Directory PDF and Excel exports include per-process logo artwork", () => {
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const glyphs = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  assert.ok(glyphs.includes("export function mechanicalOperationSvgForName(operationName: string): string"));
  assert.ok(directory.includes("function processLogoSource("));
  assert.ok(directory.includes("async function processLogoPngBase64("));
  assert.ok(directory.includes('header:"Logo",key:"logo"'));
  assert.ok(directory.includes("sheet.addImage(imageId"));
  assert.ok(directory.includes("processLogoSource(row)"));
  assert.ok(directory.includes("<th>Logo</th>"));
});

test("Every process row can open Logo Studio for its own Process Directory record", () => {
  const workspace = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('title="Assign process logo"'));
  assert.ok(workspace.includes("Add / change process logo"));
  assert.ok(workspace.includes("onOpenIconStudio?.(row.id)"));
  assert.ok(app.includes("onOpenIconStudio={(processDefinitionId)=>"));
  assert.ok(app.includes("initialTarget={iconStudioTarget}"));
  assert.ok(studio.includes('initialTarget?: { targetType: "process" | "component" | "subcategory"; targetRecordId: string } | null'));
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
  assert.ok(workspace.includes("const effectivePoLineId = old?.poLineId || parentOperation?.poLineId || selectedLine.id"));
  assert.ok(workspace.includes("id: operationId, poId: effectivePoId, poLineId: effectivePoLineId, componentId: effectiveComponentId"));
  assert.ok(workspace.includes("op.poId === poId && op.componentId === selectedLine?.componentId"));
});

test("Dashboard spheres auto-rotate by default, preserve separate drag locks, and navigate to the correct workspaces", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const process = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(!orb.includes("useAnimationFrame"));
  assert.ok(!orb.includes("rotateY:360"));
  assert.ok(!orb.includes("rotate:360"));
  assert.ok(!orb.includes("window.setInterval"));
  assert.ok(orb.includes("const [moduleRotationEnabled, setModuleRotationEnabled]"));
  assert.ok(orb.includes("const [recordRotationEnabled, setRecordRotationEnabled]"));
  assert.ok(orb.includes("if (!moduleRotationEnabled) return"));
  assert.ok(orb.includes("if (!recordRotationEnabled) return"));
  assert.ok(orb.includes("Lock modules"));
  assert.ok(orb.includes("Enable module drag"));
  assert.ok(orb.includes("Lock records"));
  assert.ok(orb.includes("Enable record drag"));
  assert.ok(orb.includes("requestAnimationFrame"));
  assert.ok(orb.includes("cancelAnimationFrame"));
  assert.ok(orb.includes("autoRotate"));
  assert.ok(orb.includes("Pause auto-rotation"));
  assert.ok(orb.includes("Resume auto-rotation"));
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

test("WebGL sphere rotates its surface coordinates with the same manual globe orientation", () => {
  const sphere = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(sphere.includes("uniform vec2 globeRotation"));
  assert.ok(sphere.includes("rotateY * rotateX * normalize(q)"));
  assert.ok(sphere.includes('rotationX.on("change", applyRotation)'));
  assert.ok(sphere.includes('rotationY.on("change", applyRotation)'));
  assert.ok(sphere.includes("gl.uniform2f(globeRotation"));
});

test("WebGL globe redraws on parent motion updates without an independent animation loop", () => {
  const sphere = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(sphere.includes("const draw = () =>"));
  assert.ok(sphere.includes("const observer = typeof ResizeObserver"));
  assert.ok(sphere.includes("observer?.observe(canvas)"));
  assert.ok(sphere.includes("gl.uniform2f(resolution, width, height)"));
  assert.ok(!sphere.includes("requestAnimationFrame"));
  assert.ok(!sphere.includes("cancelAnimationFrame"));
});

test("WebGL globe surface follows the parent rotation for drag and idle auto-rotation", () => {
  const shader = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(shader.includes("vec3 q = hit;"));
  assert.ok(shader.includes("uniform vec2 globeRotation"));
  assert.ok(shader.includes("rotateY * rotateX * normalize(q)"));
  assert.ok(shader.includes('rotationX.on("change", applyRotation)'));
  assert.ok(shader.includes('rotationY.on("change", applyRotation)'));
  assert.ok(!shader.includes("uniform float time"));
  assert.ok(!shader.includes("elapsed +="));
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes("<AXIMACHWebGLSphere rotationX={rotateX} rotationY={rotateY} />"));
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
  assert.ok(orb.includes("className=\"ax-orb-drag-zone\""));
  assert.ok(orb.includes("onPointerDown={startDrag}"));
  assert.ok(orb.includes("onPointerMove={moveDrag}"));
  assert.ok(orb.includes("onPointerUp={endDrag}"));
  assert.ok(orb.includes("if (!dragMoved.current) onSelectModule(id)"));
  assert.ok(orb.includes("Both shells auto-rotate while idle. Manual pointer/touch drag takes over"));
  assert.ok(orb.includes("saved.current.moduleRotationEnabled !== false"));
  assert.ok(orb.includes("saved.current.recordRotationEnabled !== false"));
  assert.ok(!orb.includes("window.setInterval"));
  assert.ok(!orb.includes("rotate gently by default"));
  assert.ok(orb.includes("onPointerDown={startLowerDrag} onPointerMove={moveLowerDrag}"));
  assert.ok(orb.includes("if (!lowerDragMoved.current) onSelectModule(id)"));
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("{selectedOperationId && activeOperation && <button className=\"button-danger compact-button\""));
});

test("Process Directory stores a colour per process type and route exports share the selected scope", () => {
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(directory.includes("displayColor:processColor"));
  assert.ok(directory.includes('setProcessColor(row.displayColor||"#4b95eb")'));
  assert.ok(directory.includes('type="color" value={processColor}'));
  assert.ok(workspace.includes("const exportOperations = getRouteScopeOperations(exportScope)"));
  for (const exportName of ["exportCsv", "exportExcel", "exportVisual", "exportPowerPoint", "printExport"]) {
    const start = workspace.indexOf("const " + exportName);
    assert.ok(start >= 0, "missing route export handler " + exportName);
    const body = workspace.slice(start, start + 6000);
    assert.ok(body.includes("exportOperations"), exportName + " must use the selected route scope");
  }
});


test("Process Plan sub-processes inherit their Process Directory definition and persist stable subcategory IDs", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(workspace.includes("base.processDefinitionId = parent.processDefinitionId"));
  assert.ok(workspace.includes("base.name = parent.name"));
  assert.ok(workspace.includes("value={draft.processSubcategoryId}"));
  assert.ok(workspace.includes("options={processSubcategoryOptions}"));
  assert.ok(workspace.includes("subcategoryFilters.includes(operationSubcategoryId)"));
  assert.ok(workspace.includes("processSubcategoryId: draft.processSubcategoryId"));
  assert.ok(directory.includes("processSubcategoryId:stableSubcategoryId"));
  assert.ok(directory.includes("value={processSubcategoryId}"));
  assert.ok(directory.includes("value={row.processSubcategoryId}"));
  assert.ok(data.includes("subcategoryIds?: string[]"));
  assert.ok(data.includes("processSubcategoryId?: string;"));
});

test("Contact 360 resolves vendor capability subcategories by stable Process Directory IDs", () => {
  const workspace = readFileSync(new URL("../src/RelationshipWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("processSubcategoryFilterOptions=selectedCapabilityDefinitions.flatMap"));
  assert.ok(workspace.includes("definition.subcategoryIds?.[index]"));
  assert.ok(workspace.includes("customContactSubcategoryFilterOptions"));
  assert.ok(workspace.includes("capabilitySubcategoryIds.includes(id)"));
  assert.ok(workspace.includes('id="contact-process-subcategory" label="Process subcategory" options={subcategoryOptions}'));
});

test("Vendor Network resolves capability and assigned-operation subcategories through stable Process Directory IDs", () => {
  const workspace = readFileSync(new URL("../src/RelationshipWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("definition.subcategoryIds?.[index]"));
  assert.ok(workspace.includes("const stableSubcategoryIdsFor="));
  assert.ok(workspace.includes("capabilitySubcategoryIds=capabilityDefinitions.flatMap"));
  assert.ok(workspace.includes("operation.processSubcategoryId"));
  assert.ok(workspace.includes("subcategories.some(id=>capabilitySubcategoryIds.includes(id)||operationSubcategoryIds.includes(id))"));
  assert.ok(workspace.includes('id="network-subcategory" label="Subcategory" options={subcategoryOptions}'));
});

test("3D process orbit renders route arrows and preserves hidden parent origins for scoped branches", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("const orbitConnections = useMemo"));
  assert.ok(universe.includes("edges={orbitConnections.edges}"));
  assert.ok(universe.includes("coordinateOperations={coordinateOperations}"));
  assert.ok(universe.includes("anchors={orbitConnections.anchors}"));
  assert.ok(scene.includes("const pointById=new Map(geometryPoints.map"));
  assert.ok(scene.includes("routeEdges.forEach"));
  assert.ok(scene.includes("arrowHeadMesh(tip,q,.095)"));
  assert.ok(scene.includes("const a0p={x:a.x+r0.x*r,y:a.y+r0.y*r,z:a.z+r0.z*r}"));
  assert.ok(scene.includes("const b0p={x:b.x+r0.x*r,y:b.y+r0.y*r,z:b.z+r0.z*r}"), "route cylinders must connect both source and target points");
  assert.ok(scene.includes("SPHERE_GUIDE_MESH"), "Sphere mode must render a full 3D globe guide");
  assert.ok(scene.includes("anchorPoints.forEach"));
});

test("Process route scope keeps original parent arrows visible and each 3D view opens its matching layout", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const resolveBranchOrigin ="));
  assert.ok(workspace.includes("while (parent && parent.poLineId===poLineId && (parent.branch || \"Main route\") === branch"));
  assert.ok(workspace.includes("const branchOrigin=resolveBranchOrigin(branch,lane)"));
  assert.ok(workspace.includes("const branchOrigin=resolveBranchOrigin(branch,laneOperations)"));
  for (const view of ["sphere","vortex","linear","horizontal","vertical","timeline","gantt","nodes","branch","combined"]) {
    assert.ok(workspace.includes('id:"' + view + '"'), "missing Process Plan view: " + view);
  }
  assert.ok(workspace.includes("initialLayout={visualStyle}"));
  assert.ok(universe.includes('initialLayout = "sphere"'));
  assert.ok(universe.includes("useState<ProcessLayoutMode>(initialLayout)"));
  assert.ok(universe.includes("while (ancestor && routeGroupKey(ancestor) === key"));
  assert.ok(universe.includes("[parentOperations, lookupOperations, routeLabels]"));
});

test("mechanical icon inventory covers process stages beyond cutting and machining", () => {
  const source = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  for (const glyph of ["heat-treatment-furnace","powder-coating-gun","assembly-tool","transport-truck","material-stock"]) {
    assert.ok(source.includes('"' + glyph + '"'), "missing mechanical process logo family: " + glyph);
  }
  for (const pattern of ["heat treatment","powder coating","assembly","transport","raw material"]) {
    assert.ok(source.toLowerCase().includes(pattern), "missing process-name matching rule: " + pattern);
  }
  assert.ok(source.includes('label:"Heat-treatment furnace"'));
  assert.ok(source.includes('label:"Coating / finishing gun"'));
});

test("five synthetic component names resolve to the intended mechanical logo families", () => {
  const iconSource = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  const rulesStart = iconSource.indexOf("const componentRules:");
  const rulesEnd = iconSource.indexOf("\n];", rulesStart);
  assert.ok(rulesStart >= 0 && rulesEnd > rulesStart, "component logo rules must remain discoverable");
  const rules = iconSource.slice(rulesStart, rulesEnd).split("\n").flatMap(line => {
    const value = line.trim();
    if (!value.startsWith("[/")) return [];
    const patternStart = 2;
    const patternEnd = value.indexOf("/", patternStart);
    const glyphStart = value.indexOf('"', patternEnd) + 1;
    const glyphEnd = value.indexOf('"', glyphStart);
    return [{ pattern: new RegExp(value.slice(patternStart, patternEnd)), glyph: value.slice(glyphStart, glyphEnd) }];
  });
  const glyphFor = name => {
    const value = name.toLowerCase().replace(/[_-]+/g, " ");
    return rules.find(rule => rule.pattern.test(value))?.glyph || "component-block";
  };
  const expected = new Map([
    ["AX-1001", "turning-insert"],
    ["AX-1002", "press-tool"],
    ["AX-1003", "hob"],
    ["AX-1004", "boring-bar"],
    ["AX-1005", "fixture-jig"]
  ]);
  for (const part of fixture.parts) {
    assert.equal(glyphFor(part.name + " " + part.partNumber), expected.get(part.partNumber), part.partNumber + " mechanical logo family");
  }
  assert.ok(iconSource.indexOf("gear|sprocket|rack|worm wheel|splined") < iconSource.indexOf("shaft|spindle|axle|pinion shaft|drive shaft"), "gear identity must take priority over the generic shaft rule");
});


test("Main dashboard sphere uses native 3D module hit targets with stable transforms", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes('aria-label="18 clickable AXIMACH modules"'));
  assert.ok(orb.includes('return <button key={id} type="button" className="ax-orb-satellite ax-orb-satellite-3d"'));
  assert.ok(orb.includes('translate3d(" + x + "px," + y + "px," + z + "px)'));
  assert.ok(orb.includes("onPointerDown={startDrag}"));
  assert.ok(orb.includes("onPointerMove={moveDrag}"));
  assert.ok(!orb.includes("return <motion.button key={id}"));
});

test("Process Universe supports field visibility, vendor identity and arrow visibility without auto-animation", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("visibleFields?: string[]"));
  assert.ok(universe.includes("vendors?: Array<{ id: string; company: string }>"));
  assert.ok(universe.includes("showArrows?: boolean"));
  assert.ok(universe.includes('fieldVisible("plannedEnd")'));
  assert.ok(universe.includes('fieldVisible("vendor")'));
  assert.ok(universe.includes('fieldVisible("price")'));
  assert.ok(universe.includes('fieldVisible("amount")'));
  assert.ok(universe.includes("{showArrows && index < lane.rows.length - 1"));
  assert.ok(universe.includes('useEffect(() => setLayoutMode(initialLayout), [initialLayout])'));
});

test("Logo Studio limits selectable and persisted symbols to mechanical and transport families", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  const mechanical = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("MECHANICAL_ICON_NAME_PATTERN"));
  assert.ok(studio.includes("const ICONS: IconMeta[] = engineeredMechanicalIcons;"));
  assert.ok(!studio.includes("tablerIconCatalogue"));
  assert.ok(studio.includes("useState(() => iconKey(ICONS[0]))"));
  assert.ok(studio.includes("Mechanical &amp; transport logos"));
  assert.ok(studio.includes("!isMechanicalStudioIcon(assignment.iconName)"));
  assert.ok(mechanical.includes('mechanicalGlyphForOperation(operation) || "component-block"'));
});


test("Process Plan route scopes stay selectable, and simulation follows the selected scope", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(!workspace.includes("disabled={scope.count===0}"));
  assert.ok(workspace.includes("const exportOperations = getRouteScopeOperations(exportScope)"));
  assert.ok(workspace.includes("const simulationOperations = exportOperations.filter(operation => operation.relationType !== \"subprocess\")"));
  assert.ok(workspace.includes("simulationOperations.length - 1"));
  assert.ok(workspace.includes("No saved operations in this route scope"));
});

test("Transport leg action is a dropdown, and process and transport costs remain separate", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("transport-leg-menu-anchor"));
  assert.ok(workspace.includes("Open Transport Directory"));
  assert.ok(workspace.includes('case "transportLegCost"'));
  assert.ok(workspace.includes('case "combinedAmount"'));
  assert.ok(workspace.includes("<th>Transport amount</th>"));
  assert.ok(workspace.includes("operationTransportAmount"));
});

test("Process Plan shares multi-select route card fields and arrow controls with Process Universe", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("visibleFields={cardVisibleFields} showArrows={exportArrows}"));
  assert.ok(workspace.includes("PROCESS_CARD_FIELDS"));
  assert.ok(workspace.includes("setCardVisibleFields"));
  assert.ok(universe.includes('fieldVisible("plannedEnd")'));
  assert.ok(universe.includes('fieldVisible("vendor")'));
  assert.ok(universe.includes('fieldVisible("price")'));
  assert.ok(universe.includes('fieldVisible("amount")'));
  assert.ok(universe.includes("{showArrows && index < lane.rows.length - 1"));
});

test("All non-3D Process Plan views expose the same Process Directory definitions without inventing operations", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("process-view-directory-catalog-grid"));
  assert.ok(workspace.includes("AVAILABLE PROCESS DEFINITIONS"));
  assert.ok(workspace.includes("These are engineering definitions, not saved production steps"));
  for (const view of ["sphere","vortex","linear","horizontal","vertical","timeline","gantt","nodes","branch","combined"]) {
    assert.ok(workspace.includes('id:"' + view + '"'), "missing Process Plan view: " + view);
  }
});


test("Process Plan panels expose independent native expand/collapse sections", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const panels = [
    "component-transport-map-strip","process-map-filter-panel","process-route-scope-panel",
    "linked-route-canvas","process-operation-table-panel","linked-operation-side",
    "linked-cost-card","linked-timeline-card","linked-process-table"
  ];
  for (const panel of panels) {
    const selectedPanel = /<details(?=[^>]*className="surface-panel linked-operation-side")(?=[^>]*ref=\{selectedOperationPanelRef\})[^>]*>/;
    const expected = panel === "linked-operation-side" ? selectedPanel.test(workspace) : workspace.includes('<details className="surface-panel ' + panel + '"');
    assert.ok(expected, "missing open/close panel " + panel);
  }
  assert.equal((workspace.match(/<details\b/g) || []).length, (workspace.match(/<\/details>/g) || []).length);
  assert.ok(!workspace.includes("<details open"), "Process Map panels must start collapsed");
  assert.ok(workspace.includes("selectedOperationPanelRef.current.open=true") || workspace.includes("selectedOperationPanelRef.current.open = true"), "Selecting an operation may open only its selected detail panel");
  assert.ok(workspace.includes("<summary className=\"panel-heading\">"));
});


test("Main Dashboard and 3D Command Centre center the 18-module orb on mobile", () => {
  const dashboardStyles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  const appStyles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.ok(dashboardStyles.includes(".dashboard-welcome-orb .ax-orb-drag-zone"));
  assert.ok(appStyles.includes("@media(max-width:760px)"));
  assert.ok(appStyles.includes(".hero-command {"));
  assert.ok(appStyles.includes("grid-template-columns:minmax(0,1fr)"));
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes("useMotionValue(compactViewport ? -7 : -15)"));
  assert.ok(orb.includes("useMotionValue(compactViewport ? 0 : 22)"));
  assert.ok(orb.includes("useMotionValue(compactViewport ? -5 : -8)"));
});


test("Process Universe receives route-card visibility and diagram arrow state from Process Plan", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("visibleFields={cardVisibleFields} showArrows={exportArrows}"));
  assert.ok(workspace.includes("PROCESS_CARD_FIELDS"));
  assert.ok(workspace.includes("setCardVisibleFields"));
  assert.ok(workspace.includes("showArrows={exportArrows}"));
  assert.ok(workspace.includes("PROCESS_EXPORT_FIELDS.map(field=>"));
  assert.ok(workspace.includes("visibleFields={cardVisibleFields} showArrows={exportArrows}"));
  assert.ok(workspace.includes("PROCESS_CARD_FIELDS"));
  assert.ok(workspace.includes("setCardVisibleFields"));
  for (const field of ["status", "execution", "tolerance", "paymentStatus", "machine"]) assert.ok(universe.includes(`fieldVisible("${field}")`));
});


test("mobile and desktop command sphere orbit controls sit outside the core radius", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(orb.includes("const radius = compactViewport ? 116 : 132"));
  assert.ok(css.includes(".process-map-visible-fields"));
  assert.ok(css.includes("@media(max-width:620px){.ax-orb-module-shell .ax-orb-satellite-3d"));
});

test("Process Map route scopes intersect active filters before diagram and export selection", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const scopeStart = workspace.indexOf("const getRouteScopeOperations =");
  const scopeEnd = workspace.indexOf("const exportScopeLabel =", scopeStart);
  const scope = workspace.slice(scopeStart, scopeEnd);
  assert.ok(scope.includes("const source = visibleOperations"));
  assert.ok(scope.includes('if (scope === "all") return routeOperations'), "All routes must retain the complete saved route graph");
  assert.ok(scope.includes('if (scope === "filtered") return source'), "Filtered results must remain filter-scoped");
  assert.ok(scope.includes('if (scope === "main") return source.filter'));
  assert.ok(scope.includes('if (scope === "rework") return source.filter'));
  assert.ok(workspace.includes("const exportOperations = getRouteScopeOperations(exportScope)"));
  assert.ok(workspace.includes("operations={exportOperations}"));
});


test("Process Plan panels are independently collapsed until the user opens each section", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  for (const panel of ["component-transport-map-strip","process-operation-table-panel","linked-cost-card","process-route-scope-panel","linked-route-canvas"]) {
    assert.ok(workspace.includes('<details className="surface-panel ' + panel + '"'), "missing independently expandable panel " + panel);
  }
  assert.ok(!workspace.includes("<details open"));
});


test("Process Plan process-type filters use stable Process Directory definition IDs", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const processFilterTypes = processDefinitions.map(definition => ({ id: definition.id"));
  assert.ok(workspace.includes('const stableProcessDefinitionId = operationDefinition?.id || op.processDefinitionId || ""'));
  assert.ok(workspace.includes("processTypeFilters.includes(stableProcessDefinitionId)"));
  assert.ok(workspace.includes("options={processFilterTypes} selected={processTypeFilters}"));
});


test("Icon Studio catalogue is restricted to mechanical and transport identities", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("MECHANICAL_ICON_NAME_PATTERN.test(iconBaseName(name))"));
  for (const unwanted of ["building-warehouse", "|box|", "|package|", "|container|", "|ship|"]) assert.ok(!studio.includes(unwanted));
  assert.ok(studio.includes("truck-delivery"));
  assert.ok(studio.includes("automatic-gearbox"));
  assert.ok(studio.includes("ruler-measure"));
});


test("process glyph lookup uses the full Process Directory definition and renders that exact mechanical glyph", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  const mechanical = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("{ processName, fallback, processId, category, subcategory }"));
  assert.ok(studio.includes("mechanicalGlyphForOperation([processName, category, subcategory].filter(Boolean).join"));
  assert.ok(studio.includes("MechanicalIconGlyph glyph={knownMechanicalGlyph}"));
  assert.ok(studio.includes("(fallback || <Workflow size={16} />)"));
  assert.ok(mechanical.includes('/\\bmilling\\b|mill operation|milling operation/, "end-mill"'));
});


test("Process Universe field visibility is applied to both orbit and connected route nodes", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  for (const field of ["status", "execution", "tolerance", "paymentStatus", "machine"]) {
    assert.equal((universe.match(new RegExp('fieldVisible\\("' + field + '"\\)', "g")) || []).length, 1, field + " remains in the compact route-node view; expanded records always show the full data");
  }
  assert.ok(universe.includes('fieldVisible("machine") && <small>Machine · {operation.machine || "Not set"}</small>'));
});


test("saved mechanical icon assignments with outline/filled prefixes resolve correctly", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes('name.slice(name.lastIndexOf(":") + 1)'));
  assert.ok(studio.includes("MECHANICAL_ICON_NAME_PATTERN.test"));
  assert.ok(studio.includes("isMechanicalStudioIcon(assignment.iconName)"));
});

test("selected-operation and selected-branch route scopes require an explicit selection", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const explicitlySelectedOperation = routeOperations.find(op => op.id === selectedOperationId)"));
  assert.ok(workspace.includes('if (scope === \"selected-operation\") return explicitlySelectedOperation'));
  assert.ok(workspace.includes('if (scope === \"selected-branch\") return explicitlySelectedOperation'));
});

test("Process Universe payment visibility uses the Process Plan export field ID", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.equal(universe.split('fieldVisible("paymentStatus")').length - 1, 1);
});

test("Icon Studio strips saved outline/filled prefixes before rendering Tabler class names", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("const iconBaseName = (name: string) =>"));
  assert.ok(studio.includes("const resolvedVariant = name.startsWith(\"filled:\") ? \"filled\""));
  assert.ok(studio.includes("ti ti-" + "${baseName}"));
});

test("CI skips Electron binary download for frontend and Android jobs only", () => {
  const workflow = readFileSync(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
  assert.equal((workflow.match(/ELECTRON_SKIP_BINARY_DOWNLOAD: "1"/g) || []).length, 2);
  const windows = workflow.slice(workflow.indexOf("windows-installer:"), workflow.indexOf("android-apk:"));
  assert.ok(!windows.includes("ELECTRON_SKIP_BINARY_DOWNLOAD"));
});

test("Dashboard module and live-record spheres are independently draggable with idle auto-rotation", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes("moduleRotationEnabled"));
  assert.ok(orb.includes("recordRotationEnabled"));
  assert.ok(orb.includes("setModuleRotationEnabled"));
  assert.ok(orb.includes("setRecordRotationEnabled"));
  assert.ok(orb.includes("saved.current.moduleRotationEnabled !== false"));
  assert.ok(orb.includes("saved.current.recordRotationEnabled !== false"));
  assert.ok(!orb.includes("window.setInterval"));
  const sphere = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(sphere.includes("float h = b*b - (dot(ro,ro) - 1.0)"));
  assert.ok(sphere.includes("The parent drives this true spherical surface during idle rotation and drag."));
});

test("Logo Studio lists and renders the authored mechanical tool and transport glyph inventory", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  const mechanical = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("MECHANICAL_ICON_INVENTORY.map"));
  assert.ok(studio.includes('name:"mechanical:"+item.glyph'));
  assert.ok(studio.includes("MechanicalIconGlyph glyph={item.glyph}"));
  assert.ok(studio.includes("mechanicalGlyphForStudioName(assignment.iconName)"));
  assert.ok(mechanical.includes('{glyph:"transport-truck",label:"Transport / dispatch"'));
  assert.ok(mechanical.includes('[/\\bvmc\\b|vertical machining centre|vertical machining center/, "vmc-machine"]'));
  assert.ok(mechanical.includes('[/\\bhmc\\b|horizontal machining centre|horizontal machining center/, "cnc-machine"]'));
  assert.ok(studio.includes("const ICONS: IconMeta[] = engineeredMechanicalIcons;"));
  assert.ok(studio.includes("useState(() => iconKey(ICONS[0]))"));
  assert.ok(studio.includes("Mechanical &amp; transport logos"));
  assert.ok(studio.includes("Search mechanical process, machine, tool or transport logo"));
  assert.ok(!studio.includes("tablerIconCatalogue"));
});

test("Process Universe shows selectable transport cost and combined cost values from Process Plan", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("operationTransportAmounts={Object.fromEntries(exportOperations.map"));
  assert.ok(workspace.includes("quantityUnit={quantityUnit}"));
  assert.ok(universe.includes('fieldVisible("transportLegCost")'));
  assert.ok(universe.includes('fieldVisible("combinedAmount")'));
});

test("Dashboard and Command Centre keep independent persisted sphere preferences", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const dashboard = readFileSync(new URL("../src/DashboardWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes('surface === "command-centre" ? "aximach.command-centre.orb.preferences.v1" : "aximach.orb.preferences.v1"'));
  assert.ok(orb.includes("window.localStorage.setItem(preferenceKey"));
  assert.ok(app.includes('<AXIMACHOrb surface="command-centre"'));
  assert.ok(dashboard.includes('<AXIMACHOrb surface="dashboard"'));
});

test("Selecting an already active process row or Process Universe node reopens the selected-operation panel", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("if(selectedOperationPanelRef.current)selectedOperationPanelRef.current.open=true"));
  assert.ok(workspace.includes("onSelectOperation={id => { setSelectedOperationId(id); setShowEditor(false); if(selectedOperationPanelRef.current)selectedOperationPanelRef.current.open=true; }}"));
});

test("Route simulation advances the selected operation through the currently selected route scope", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const stepOperation = simulationOperations[simulationIndex]"));
  assert.ok(workspace.includes("if (stepOperation) setSelectedOperationId(stepOperation.id)"));
  assert.ok(workspace.includes("[simulationActive, simulationIndex, simulationOperations]"));
});

test("Process Directory milling definitions resolve to machining tools using type, category and subcategory context", () => {
  const icons = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  assert.ok(icons.includes('/\\bmilling\\b|mill operation|milling operation/, "end-mill"'));
  assert.ok(studio.includes("mechanicalGlyphForOperation([processName, category, subcategory].filter(Boolean).join(\" \"))"));
  assert.ok(icons.includes('{glyph:"end-mill",label:"End mill"'));
  assert.ok(icons.includes('{glyph:"transport-truck",label:"Transport / dispatch"'));
});

test("Android packaging rewrites the generated Gradle wrapper to verified distribution mirrors and retries", () => {
  const workflow = readFileSync(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
  const android = workflow.slice(workflow.indexOf("android-apk:"));
  assert.ok(android.includes("mirrors.huaweicloud.com/gradle/gradle-8.11.1-all.zip"));
  assert.ok(android.includes("mirrors.aliyun.com/gradle/distributions/v8.11.1/gradle-8.11.1-all.zip"));
  assert.ok(android.includes("for attempt in 1 2 3; do"));
  assert.ok(android.includes("Expected Gradle 8.11.1 wrapper URL was not found"));
});

test("Windows packaging retries Electron downloads through a configured mirror", () => {
  const workflow = readFileSync(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
  const windows = workflow.slice(workflow.indexOf("windows-installer:"), workflow.indexOf("android-apk:"));
  assert.ok(windows.includes("ELECTRON_MIRROR: https://npmmirror.com/mirrors/electron/"));
  assert.ok(windows.includes("for ($attempt = 1; $attempt -le 3; $attempt++)"))
  assert.ok(windows.includes("if ($LASTEXITCODE -eq 0) { exit 0 }"));
  const android = workflow.slice(workflow.indexOf("android-apk:"));
  assert.ok(android.includes("for attempt in 1 2 3; do"));
});

test("Windows installer uses mirrors for Electron and electron-builder binaries", () => {
  const workflow = readFileSync(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
  const windows = workflow.slice(workflow.indexOf("windows-installer:"), workflow.indexOf("android-apk:"));
  assert.ok(windows.includes("ELECTRON_BUILDER_BINARIES_MIRROR: https://npmmirror.com/mirrors/electron-builder-binaries/"));
});

test("Android Gradle wrapper uses primary and fallback distribution mirrors", () => {
  const workflow = readFileSync(new URL("../.github/workflows/build.yml", import.meta.url), "utf8");
  const android = workflow.slice(workflow.indexOf("android-apk:"));
  assert.ok(android.includes("mirrors.huaweicloud.com/gradle/gradle-8.11.1-all.zip"));
  assert.ok(android.includes("mirrors.aliyun.com/gradle/distributions/v8.11.1/gradle-8.11.1-all.zip"));
});

test("Upcoming delivery rows open their exact saved PO component line and clear stale route filters", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("className=\"process-upcoming-delivery-row\""));
  assert.ok(workspace.includes("setCompanyId(item.po.companyId);setPoId(item.po.id);setPoLineId(item.line.id)"));
  assert.ok(workspace.includes("operation.poId===item.po.id&&operation.poLineId===item.line.id&&operation.componentId===item.line.componentId"));
  assert.ok(workspace.includes('setExportScope("all");setSearch("");setCategorySearch("")'));
  assert.ok(workspace.includes('onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openLine();}}}'));
});

test("Component-start transport remains visible inside Process List before a process operation exists", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("!firstMainRouteOperation && unanchoredTransportCost>0"));
  assert.ok(workspace.includes("Component-start transport cost"));
  assert.ok(workspace.includes("Saved transport leg is not assigned to a process operation."));
  assert.ok(workspace.includes("{money(unanchoredTransportCost)}"));
});

test("Process Universe connectors and simulation highlight do not run autonomous animation", () => {
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  const connector = styles.slice(styles.indexOf(".process-universe-connector::before"), styles.indexOf(".process-universe-connector::before") + 320);
  const current = styles.slice(styles.indexOf(".process-universe-node.simulation-current"), styles.indexOf(".process-universe-node.simulation-current") + 420);
  assert.ok(!connector.includes("animation:"));
  assert.ok(!current.includes("animation:"));
  assert.ok(!styles.includes("@keyframes processUniverseFlow"));
  assert.ok(!styles.includes("@keyframes processUniversePulse"));
});

test("Small-phone sphere container stays within viewport width", () => {
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(styles.includes(".ax-orb-drag-zone { width: min(100%,360px); max-width: 100%; margin-inline: auto; }"));
  assert.ok(!styles.includes(".ax-orb-drag-zone { width: 110%; margin-left: -5%; }"));
});


test("Process Universe sphere nodes reveal a real linked detail panel and can collapse it", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(scene.includes('aria-controls="process-orbit-selected-details"'));
  assert.ok(scene.includes("aria-expanded={expandedOperationId===op.id}"));
  assert.ok(universe.includes('id="process-orbit-selected-details"'));
  assert.ok(universe.includes("{expandedOrbitOperation && <section"));
  assert.ok(universe.includes('onClick={() => setExpandedOperationId("")}'));
  assert.ok(universe.includes("const expandedOrbitOperation = lookupOperations.find(operation => operation.id === expandedOperationId) || displayOperations.find(operation => operation.id === expandedOperationId);"));
  assert.ok(styles.includes(".process-orbit-selected-details{"));
});


test("Expanded Process Universe records always show full schedule, vendor, quantity, rate, costing and production details", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const start = universe.indexOf('<div className="process-orbit-selected-grid">');
  const details = universe.slice(start, universe.indexOf('{(expandedOrbitSubprocesses', start));
  for (const field of ["PLANNED START · DATE &amp; TIME","PLANNED DELIVERY · DATE &amp; TIME","VENDOR","PLANNED QUANTITY","PRICE / PART","PROCESS AMOUNT","PAYMENT STATUS","TRANSPORT VENDOR","INSPECTION RESULT"]) {
    assert.ok(details.includes(field), "expanded process details must include "+field);
  }
  assert.ok(!details.includes("fieldVisible("), "CSV export field selection must not hide operational record fields");
  assert.ok(universe.includes("lookupOperations.find(operation => operation.id === expandedOperationId)"), "subprocess records must also be expandable");
});

test("Sphere view is a full 3D globe with visible route cylinders and distinct alternate/rework node identifiers", () => {
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(scene.includes("const SPHERE_GUIDE_MESH = sphereWireMesh(1.025)"));
  assert.ok(scene.includes("draw(SPHERE_GUIDE_MESH"));
  assert.ok(scene.includes("function operationCode(operation:OperationRecord)"));
  assert.ok(scene.includes('"ALT"'));
  assert.ok(scene.includes('"REWORK"'));
  assert.ok(scene.includes("const drawOperationFlow=(p:P,q:P,offset:number,rgb:number[],relation:string=\"main\")=>"));
  assert.ok(scene.includes("const pointAt=(t:number):P=>"));
  assert.ok(scene.includes("draw(lineMesh(a,b,relation===\"parallel\"?.026:.035),rgb)"));
  assert.ok(scene.includes("drawOperationFlow(p,q,edgeIndex,rgb,edge.relation)"));
});

test("3D Gantt view uses saved planned/actual date ranges as volumetric duration bars and preserves time scale controls", () => {
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(scene.includes('function ganttSegment(index:number,rows:OperationRecord[],scale:"day"|"week"|"month"="week")'));
  assert.ok(scene.includes("draw(lineMesh(segment.start,segment.end,.071),rgb)"));
  assert.ok(universe.includes('layoutMode === "gantt"'));
  assert.ok(universe.includes('value={ganttScale}'));
  assert.ok(workspace.includes("ganttScale={ganttScale} onGanttScaleChange={setGanttScale}"));
});


test("Process Universe route sections can independently expand and collapse", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(universe.includes("const [collapsedLaneNames, setCollapsedLaneNames] = useState<string[]>([]);"));
  assert.ok(universe.includes("const collapsed = collapsedLaneNames.includes(lane.key);"));
  assert.ok(universe.includes('className="process-universe-lane-toggle"'));
  assert.ok(universe.includes("aria-expanded={!collapsed}"));
  assert.ok(universe.includes('className="process-universe-lane-content" hidden={collapsed}'));
  assert.ok(universe.includes('onClick={() => setCollapsedLaneNames(current => current.includes(lane.key)'));
  assert.ok(styles.includes(".process-universe-lane-content[hidden]{display:none!important}"));
});

test("Process Universe route nodes expose expandable linked subprocess and alternate/rework controls", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes('aria-controls={"process-universe-node-details-"+operation.id}'));
  assert.ok(universe.includes('id={"process-universe-node-details-"+operation.id} className="process-node-subprocess-dropdown"'));
  assert.ok(universe.includes("childOperations.map(child =>"));
  assert.ok(universe.includes("linkedBranches.map(child =>"));
});


test("Clear filters resets every active Process Plan filter through the visible control", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const handlerStart = workspace.indexOf("const clearAllFilters =");
  const handlerEnd = workspace.indexOf("const toggleOperationSelection", handlerStart);
  const handler = workspace.slice(handlerStart, handlerEnd);
  for (const reset of [
    'setExportScope("all")', "setZoom(1)", 'setSearch("")',
    "setStatusFilters([])", "setExecutionFilters([])", "setCategoryFilters([])",
    "setToleranceFilters([])", "setPaymentFilters([])", "setVendorFilters([])",
    "setProcessTypeFilters([])", "setSubcategoryFilters([])", 'setCategorySearch("")',
    'setDateFrom("")', 'setDateTo("")', 'setMinQuantity("")', 'setMaxQuantity("")',
    'setMinPrice("")', 'setMaxPrice("")', 'setMinAmount("")', 'setMaxAmount("")',
    "setSelectedOperationIds([])"
  ]) assert.ok(handler.includes(reset), "Clear-all handler must reset " + reset);
  const labelIndex = workspace.indexOf("Clear filters");
  const buttonStart = workspace.lastIndexOf("<button", labelIndex);
  const buttonEnd = workspace.indexOf("</button>", labelIndex);
  assert.ok(buttonStart >= 0 && buttonEnd > buttonStart);
  assert.ok(workspace.slice(buttonStart, buttonEnd).includes("onClick={clearAllFilters}"));
});


test("Contact 360 saves Process Directory references by stable IDs and keeps manual tags separate", () => {
  const workspace = readFileSync(new URL("../src/RelationshipWorkspaces.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(data.includes("processDefinitionIds?: string[]; processSubcategoryIds?: string[];"));
  assert.ok(workspace.includes('id:"directory:"+definition.id'));
  assert.ok(workspace.includes('materials:v.materials||"",processCategories:[],processTypes:[],processSubcategories:[],processDefinitionIds:[],processSubcategoryIds:[]'));
  assert.ok(workspace.includes("processDefinitionIds:contactProcessDefinitionIds(row)"));
  assert.ok(workspace.includes("processDefinitionIds:row.processDefinitionIds,processSubcategoryIds:row.processSubcategoryIds||[]"));
  assert.ok(workspace.includes('selected={draft.processDefinitionIds||[]}'));
  assert.ok(workspace.includes('selected={draft.processSubcategoryIds||[]}'));
  assert.ok(workspace.includes("id:stableContactSubcategoryId(definition,index)"));
  assert.ok(workspace.includes("contactSubcategoryIds.includes(id)"));
  assert.ok(workspace.includes('!processFilters.length||processFilters.includes("directory:"+definition.id)'));
  assert.ok(workspace.includes("const linkedNames=processDefinitions.filter(definition=>contactProcessDefinitionIds(row).includes(definition.id)"));
  assert.ok(workspace.includes("const legacyProcessNames=[...(row.processTypes||[]).filter(value=>!contactDefinitionNames.includes(value.trim().toLowerCase()))"));
  assert.ok(workspace.includes('Manual contact capability tags (separate from Process Directory)'));
  assert.ok(workspace.includes('id:"contact:"+name.trim().toLowerCase()'));
  assert.ok(!workspace.includes('selected={draft.processSubcategories||[]} onChange={values=>setDraft(current=>({...current,processSubcategories:values}))}'));
});

test("Contact 360 resolves legacy process names only when one Process Directory definition matches", () => {
  const workspace = readFileSync(new URL("../src/RelationshipWorkspaces.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("if(Array.isArray(row.processDefinitionIds))return [...new Set(row.processDefinitionIds)]"));
  assert.ok(workspace.includes("if(matches.length===1)resolved.push(matches[0].id)"));
  assert.ok(workspace.includes("const direct=processDefinitions.filter(definition=>definition.id===value)"));
});


test("Vendor Network process filters use stable Process Directory IDs and keep legacy vendor text separate", () => {
  const workspace = readFileSync(new URL("../src/RelationshipWorkspaces.tsx", import.meta.url), "utf8");
  const start = workspace.indexOf("export function VendorNetworkWorkspace");
  const network = workspace.slice(start);
  assert.ok(network.includes('id:"directory:"+definition.id'));
  assert.ok(network.includes('id:"text:"+name.trim().toLowerCase()'));
  assert.ok(network.includes('label:"Vendor / legacy text · "+name'));
  assert.ok(network.includes('value==="directory:"+definition.id'));
  assert.ok(network.includes("const capabilityDefinitionIds=capabilityDefinitions.map(definition=>definition.id)"));
  assert.ok(network.includes("const processAssignedOperations=assigned.filter(operation=>operation.vendorId===v.id)"));
  assert.ok(network.includes('const assignedDefinitionIds=processAssignedOperations.map(operation=>resolveOperationDefinition(operation)?.id||"").filter(Boolean)'));
  assert.ok(network.includes("const operationSubcategoryIds=processAssignedOperations.map(operation=>{"));
  assert.ok(network.includes('value.startsWith("directory:")'));
  assert.ok(network.includes('value.startsWith("text:")&&legacyProcessNamesForVendor.includes(value.slice(5))'));
  assert.ok(network.includes('id="network-process-type" label="Process type" options={processOptions}'));
  assert.ok(!network.includes('matchesAny(processTypes,capabilityTypes+" "+v.processes+" "+operationTypes)'));
});


test("AXIMACH sphere core supports drag while clickable module buttons retain normal clicks", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const start = orb.slice(orb.indexOf("const startDrag"), orb.indexOf("const moveDrag"));
  const guard = start.indexOf("if (interactiveTarget) return;");
  const capture = start.indexOf("setPointerCapture(event.pointerId)");
  assert.ok(guard >= 0 && capture > guard, "real child controls must be ignored before drag pointer capture");
  assert.ok(start.includes('event.target.closest("button, a, input, select, textarea")'));
  assert.ok(!start.includes("[role='button']"), "the sphere core's role=button must not block pointer dragging");
  assert.ok(start.includes("const captureTarget = event.target instanceof HTMLElement ? event.target : event.currentTarget;"));
  assert.ok(start.includes("captureTarget.setPointerCapture(event.pointerId)"), "capture the actual hit element so a core click still reaches its zoom handler");
  assert.ok(orb.includes('className="ax-orb-core"'));
  assert.ok(orb.includes('onClick={() => { if (!dragMoved.current) toggleZoom(); }}'));
  assert.ok(orb.includes('onClick={() => { if (!dragMoved.current) onSelectModule(id); }}'));
});


test("Process Map permits saving a planned outsourced operation before vendor assignment", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const saveStart = workspace.indexOf("const saveOperation =");
  const saveEnd = workspace.indexOf("const deleteOperation =", saveStart);
  const saveHandler = workspace.slice(saveStart, saveEnd);
  assert.ok(saveHandler.includes("if (draft.vendorId && !vendors.some"), "A supplied vendor must still resolve to an active vendor record");
  assert.ok(!saveHandler.includes('draft.executionType === "Outsourced" && !draft.vendorId'), "Vendor assignment must not block saving a planned outsourced process");
  assert.ok(saveHandler.includes("operations: [...current.operations.filter(op => op.id !== next.id), next]"));
});


test("Process Map explains missing company, PO or component prerequisites when Add Operation is unavailable", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('className="process-add-prerequisite-note" role="status"'));
  assert.ok(workspace.includes("Select a saved company, purchase order and active PO component line above"));
  assert.ok(workspace.includes('onSelectModule("companies")'));
  assert.ok(workspace.includes('onSelectModule("purchasing")'));
  assert.ok(workspace.includes('onSelectModule("components")'));
  assert.ok(workspace.includes('selectedLine && !selectedComponent'));
});


test("Process Map operation editor accepts a new process type as well as Process Directory definitions", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const pickerStart = workspace.indexOf('<SearchablePicker id="operation-process-type"');
  const pickerEnd = workspace.indexOf("/>", pickerStart);
  const picker = workspace.slice(pickerStart, pickerEnd);
  assert.ok(picker.includes("Search or enter a new process type"));
  assert.ok(picker.includes("name:definition?.processType||value"));
  assert.ok(picker.includes("processDefinitionId:definition?.id||\"\""));
  assert.ok(picker.includes("allowCustom"));
});


test("New Process Map process types are saved into Process Directory with stable IDs", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('const proposedProcessDefinitionId = makeId("process-definition")'));
  assert.ok(workspace.includes("const resolvedDefinition = selectedProcessDefinition || resolveProcessDefinition"));
  assert.ok(workspace.includes("id: proposedProcessDefinitionId, processType: draft.name.trim(), category: draft.category.trim()"));
  assert.ok(workspace.includes("subcategories: [], subcategoryIds: [], vendorIds: []"));
  assert.ok(workspace.includes("processDefinitionId: processDefinition?.id || undefined"));
  assert.ok(workspace.includes(": [...current.processDefinitions, processDefinition]"));
});


test("Process Map validates category and process type before saving an operation", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const start = workspace.indexOf("const saveOperation =");
  const end = workspace.indexOf("const deleteOperation =", start);
  const handler = workspace.slice(start, end);
  assert.ok(handler.includes('if (!draft.category.trim()) { onNotice("Select or enter a process category.")'));
  assert.ok(handler.includes('if (!draft.name.trim()) { onNotice("Select or enter a process type.")'));
});


test("Production Plan no longer owns the component transport registry or inline transport editor", () => {
  const workspace = readFileSync(new URL("../src/OperationsWorkspaces.tsx", import.meta.url), "utf8");
  const production = workspace.slice(workspace.indexOf("export function ProductionPlanWorkspace"), workspace.indexOf("export function TransportDispatchWorkspace"));
  assert.ok(!production.includes("transportLine"));
  assert.ok(!production.includes("saveTransport"));
  assert.ok(!production.includes("jobTransportLegs"));
  assert.ok(!production.includes("<th>Transport</th>"));
  assert.ok(production.includes('onSelectModule("transport-master")'));
  assert.ok(production.includes('onSelectModule("process-map"'));
});


test("Process Operations table and bulk controls use the same selected route scope as the graph and exports", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const exportOperations = getRouteScopeOperations(exportScope)"));
  assert.ok(workspace.includes("const selectedVisibleOperations = exportOperations.filter(op => selectedOperationIds.includes(op.id))"));
  assert.ok(workspace.includes("...exportOperations.map(op => op.id)"));
  assert.ok(workspace.includes("checked={exportOperations.length>0&&exportOperations.every(op=>selectedOperationIds.includes(op.id))}"));
  assert.ok(workspace.includes("tbody>{exportOperations.map((op,index)=>"));
  assert.ok(workspace.includes("Selected route scope · {exportOperations.length} of {routeOperations.length} operation(s)."));
  assert.ok(!workspace.includes("tbody>{visibleOperations.map((op,index)=>"));
});


test("Process Universe node offers real alternate and rework creation from the selected parent", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("onAddAlternateRoute?: (parentId: string) => void"));
  assert.ok(universe.includes("onAddReworkRoute?: (parentId: string) => void"));
  assert.ok(universe.includes("onAddAlternateRoute, onAddReworkRoute, onAddProcessDefinition }: Props)"));
  assert.ok(universe.includes("onAddAlternateRoute(expandedOrbitOperation.id)"));
  assert.ok(universe.includes("onAddReworkRoute(expandedOrbitOperation.id)"));
  assert.ok(workspace.includes('onAddAlternateRoute={parentId=>startAddBranch("alternate",parentId)}'));
  assert.ok(workspace.includes('onAddReworkRoute={parentId=>startAddBranch("rework",parentId)}'));
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(css.includes(".process-orbit-selected-links>button.process-orbit-add-alternate"));
  assert.ok(css.includes(".process-orbit-selected-links>button.process-orbit-add-rework"));
  assert.ok(css.includes("background:#eaf4ff;color:#155fa4"));
  assert.ok(css.includes("background:#fff3e8;color:#a95c20"));
});


test("Costing rollup has linked searchable process and payment filters with one clear-all action", () => {
  const costing = readFileSync(new URL("../src/LinkedCostingWorkspace.tsx", import.meta.url), "utf8");
  for (const id of ["costing-filter-process-category", "costing-filter-process-type", "costing-filter-process-subcategory", "costing-filter-execution", "costing-filter-payment"]) {
    assert.ok(costing.includes('id="'+id+'"'), "missing costing filter: "+id);
  }
  assert.ok(costing.includes("row.linkedOperations.some(op=>rollupCategoryFilters.includes"));
  assert.ok(costing.includes("row.linkedOperations.some(op=>rollupProcessFilters.includes(op.name))"));
  assert.ok(costing.includes("row.linkedOperations.some(op=>rollupPaymentFilters.includes(op.paymentStatus||\"Unpaid\"))"));
  assert.ok(costing.includes("setRollupCategoryFilters([])"));
  assert.ok(costing.includes("setRollupPaymentFilters([])"));
});


test("Component Planned Cost subcategory filter is linked to the saved planned-cost records and clears with the other filters", () => {
  const directory = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const planned = directory.slice(directory.indexOf("function PlannedCostDirectory"), directory.indexOf("export default function SpecializedDirectoryWorkspace"));
  assert.ok(planned.includes('id="planned-cost-subcategory-filter"'));
  assert.ok(planned.includes("selected={subcategoryFilters} onChange={setSubcategoryFilters}"));
  assert.ok(planned.includes("subcategoryFilters.includes(row.processSubcategory||\"\")"));
  assert.ok(planned.includes("setSubcategoryFilters([])"));
});


test("Add Operation menu remains clickable and explains the required PO component selection", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const buttonIndex = workspace.indexOf('aria-label="Add operation ▾"');
  const buttonStart = workspace.lastIndexOf("<button", buttonIndex);
  const buttonEnd = workspace.indexOf(">", buttonIndex);
  const button = workspace.slice(buttonStart, buttonEnd + 1);
  assert.ok(button.includes("onClick={toggleAddMenu}"));
  assert.ok(!button.includes("disabled="));
  assert.ok(workspace.includes('"Select a PO component line first"'));
  assert.ok(workspace.includes("saving an operation requires a valid PO component line"));
});


test("390px mobile layout keeps the spherical command centre and Process Map controls responsive", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const appCss = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const uiCss = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  const process = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(html.includes('name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"'));
  assert.ok(appCss.includes("@media(max-width:820px)"));
  assert.ok(appCss.includes(".command-rail {"));
  assert.ok(appCss.includes("overflow-x: auto"));
  assert.ok(appCss.includes(".hero-command { grid-template-columns:minmax(0,1fr)"));
  assert.ok(appCss.includes(".hero-graphic .ax-orb-drag-zone { width:min(100%,360px)"));
  assert.ok(appCss.includes(".linked-process-page .linked-master-selectors,.linked-costing-page .linked-cost-selectors{grid-template-columns:minmax(0,1fr)}"));
  assert.ok(uiCss.includes("@media (max-width: 600px)"));
  assert.ok(uiCss.includes(".ax-orb-satellite small { font-size: 7px"));
  assert.ok(uiCss.includes(".process-route-scope-buttons { display:flex; flex-wrap:wrap"));
  assert.ok(uiCss.includes(".process-table-bulkbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap"));
  assert.ok(uiCss.includes(".process-export-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap"));
  assert.ok(uiCss.includes("@media(max-width:700px){.process-map-filter-grid{grid-template-columns:repeat(2,minmax(115px,1fr))"));
  assert.ok(uiCss.includes(".process-visual-style-buttons button { min-height: 38px"));
  assert.ok(uiCss.includes(".process-visual-style-buttons button { min-height: 42px"));
  assert.ok(process.includes('<details className="surface-panel process-route-scope-panel">'));
  assert.ok(process.includes('<details className="surface-panel linked-route-canvas">'));
  assert.ok(!process.includes("<details open"));
});


test("bundled two-company five-part demo is opt-in, fully linked and removable", () => {
  const demo = readFileSync(new URL("../src/aximachDemoData.ts", import.meta.url), "utf8");
  const importer = readFileSync(new URL("../src/IntelligenceWorkspaces.tsx", import.meta.url), "utf8");
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  for (const company of ["ASTER MOTION COMPONENTS PVT LTD", "MERIDIAN FLUID SYSTEMS PVT LTD"]) {
    assert.ok(demo.includes(company), "missing demo company: " + company);
  }
  const partKeys = [...demo.matchAll(/key:"(AST-1001|AST-1002|AST-1003|MER-2001|MER-2002)"/g)].map(match => match[1]);
  assert.equal(partKeys.length, 5, "bundled demo must include exactly five component examples");
  assert.equal(new Set(partKeys).size, 5, "demo component IDs must be unique");
  for (const collection of ["companies", "factories", "purchaseOrders", "components", "vendors", "operations", "quotations", "materials", "bomLines", "inventoryTransactions", "contactProfiles", "processDefinitions", "plannedCosts", "transportRoutes", "transportLegs", "paymentTransactions", "inspectionMeasurements", "followUpAssignments"]) {
    assert.ok(demo.includes(collection), "demo dataset must include " + collection);
  }
  assert.ok(demo.includes('processSubcategoryId:def.subcategoryIds?.[def.subcategories.indexOf(s.sub)]'));
  assert.ok(demo.includes('relationType:"alternate"'));
  assert.ok(demo.includes('relationType:"rework"'));
  assert.ok(demo.includes('branch:"Main route"'));
  assert.ok(demo.includes('branch:"Alternate route"'));
  assert.ok(demo.includes('branch:"Rework route"'));
  assert.ok(demo.includes('materialCostEntries.push({id:id("MATERIAL-ALLOCATION"'));
  assert.ok(demo.includes('scope:"process-map"'));
  assert.ok(demo.includes('transportVendorId:id("VENDOR","LOG")'));
  assert.ok(demo.includes('return {updatedAt:stamp,companies,factories,purchaseOrders,components,vendors,operations,quotations,materials,componentParts:[],materialCostEntries,bomLines'));
  assert.ok(demo.includes('export function archiveAxMachTwoCompanyDemo'));
  assert.ok(demo.includes('row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)'));
  assert.ok(importer.includes('onClick={loadTwoCompanyDemo}'));
  assert.ok(importer.includes('onClick={removeTwoCompanyDemo}'));
  assert.ok(importer.includes('mergeManufacturingData(current,createAxMachTwoCompanyDemo())'));
  assert.ok(importer.includes('archiveAxMachTwoCompanyDemo(current)'));
  assert.ok(importer.includes('window.confirm("Archive all AXIMACH DEMO records'));
  assert.ok(inventory.includes('const inventoryTransactions = activeRows(data.inventoryTransactions);'));
  assert.ok(!inventory.includes('data.inventoryTransactions.filter('), "archived demo stock movements must not remain visible");
});


test("AXIMACH spheres auto-rotate by default with an explicit pause control while manual drag remains available", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes('useState(saved.current.autoRotate !== false)'), "auto-rotation should be enabled unless the operator has paused it");
  assert.ok(orb.includes("requestAnimationFrame"), "rotation should be driven by a frame loop");
  assert.ok(orb.includes("cancelAnimationFrame"), "the animation frame must be cleaned up");
  assert.ok(orb.includes("Pause auto-rotation"));
  assert.ok(orb.includes("Resume auto-rotation"));
  assert.ok(orb.includes("moduleRotationEnabled") && orb.includes("recordRotationEnabled"), "manual drag locks must remain independent");
  assert.ok(!orb.includes("NO IDLE ROTATION"));
});

test("every Process Plan view uses the interactive 3D universe and volumetric WebGL core", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const core = readFileSync(new URL("../src/ProcessUniverseWebGLCore.tsx", import.meta.url), "utf8");
  for (const view of ["sphere","vortex","linear","horizontal","vertical","timeline","gantt","nodes","branch","combined"]) {
    assert.ok(workspace.includes('id:"' + view + '"'), "missing Process Plan view: " + view);
  }
  assert.ok(workspace.includes('initialLayout={visualStyle}'), "selected view must be passed directly to the 3D renderer");
  assert.ok(universe.includes("ProcessUniverseWebGLCore"));
  assert.ok(universe.includes("getLayoutPoint"));
  assert.ok(universe.includes("transformStyle3d"));
  assert.ok(universe.includes("autoRotateEnabled"));
  assert.ok(universe.includes("Pause rotation"));
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  for (const view of ["linear","horizontal","vertical","timeline","gantt","nodes","branch","combined"]) {
    assert.ok(styles.includes(".process-universe-3d.mode-" + view + " .process-universe-viewport"), "2D fallback viewport must be hidden for " + view);
  }
  assert.ok(core.includes('canvas.getContext("webgl"'));
  assert.ok(core.includes("raymarch"));
  assert.ok(core.includes("gl.drawArrays(gl.TRIANGLES"));
});


test("3D process arrows visibly identify source and destination operations", () => {
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(scene.includes("const projectedEdges=useMemo"));
  assert.ok(scene.includes("{edge.from} → {edge.to}"));
  assert.ok(scene.includes("arrowHeadMesh(tip,q,.095)"));
  assert.ok(styles.includes(".ax-full3d-route-arrow::after"));
  assert.ok(styles.includes(".ax-full3d-route-arrow.rework"));
});

test("expanded process record provides edit and linked custom colour controls with protected lifecycle colours", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes('onEditOperation?.(expandedOrbitOperation.id)'));
  assert.ok(universe.includes('onChangeProcessColor?.(expandedOrbitOperation.id,event.target.value)'));
  assert.ok(universe.includes('disabled={expandedOrbitOperation.status==="Complete"||expandedOrbitOperation.relationType==="rework"||expandedOrbitOperation.relationType==="alternate"}'));
  assert.ok(workspace.includes("onEditOperation={id=>editActive(id)}"));
  assert.ok(workspace.includes("onChangeProcessColor={(id,color)=>updateOperation(id,{processColor:color})}"));
  assert.ok(scene.includes('if(operation.relationType==="rework")return [.9,.43,.12]'));
  assert.ok(scene.includes('if(operation.status==="Complete")return [.12,.64,.4]'));
  assert.ok(scene.includes("return hexRgb(operation.processColor)"));
});


test("Material Directory calculator supports engineering shapes, units, grade density and separate costs", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  for (const shape of ["plate", "round-bar", "hex-bar", "round-tube", "square-tube", "rectangular-tube", "angle", "channel", "i-beam", "t-section", "custom-profile"]) {
    assert.ok(panel.includes('id: "' + shape + '"'), "missing shape " + shape);
  }
  for (const unit of ['"mm"', '"cm"', '"m"', '"ft"', '"inch"']) assert.ok(panel.includes(unit));
  assert.ok(panel.includes("densityKgM3(material"));
  assert.ok(panel.includes("volumeMm3*densityKgM3"));
  assert.ok(panel.includes("const materialCost=priceUnit==="));
  assert.ok(panel.includes('const cuttingCost=!cuttingType?0:'));
  assert.ok(panel.includes('"Bandsaw"') && panel.includes('"Laser"') && panel.includes('"Gas cut"') && panel.includes('"Waterjet"'));
  assert.ok(panel.includes('"Per piece"') && panel.includes('"Per cut"') && panel.includes('"Per kg"') && panel.includes('"Per metre"') && panel.includes('"Per hour"') && panel.includes('"Fixed job"'));
  assert.ok(inventory.includes("densityKgM3") && inventory.includes("priceUnit"));
});

test("Material calculator is available in Process Map and Component Planned Cost with separate scopes", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const plannedCost = readFileSync(new URL("../src/SpecializedDirectoryWorkspace.tsx", import.meta.url), "utf8");
  const costing = readFileSync(new URL("../src/LinkedCostingWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes('<PartMaterialCostingPanel') && processMap.includes('scope="process-map"'));
  assert.ok(plannedCost.includes('<PartMaterialCostingPanel') && plannedCost.includes('scope="planned-cost"'));
  assert.ok(costing.includes("plannedMaterialCostEntries") && costing.includes("processMapMaterialCostEntries"));
  assert.ok(costing.includes("Unassigned material/cutting") || costing.includes("not assigned to a PO line"));
  assert.ok(costing.includes("plannedCuttingCost") && costing.includes("processMapCuttingCost"));
});

test("PO lines support component-only, part-only and mixed component-plus-part allocations", () => {
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const purchasing = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(data.includes('allocationLevel?: "component" | "part"; partId?: string;'));
  assert.ok(purchasing.includes('value="component">Component-level'));
  assert.ok(purchasing.includes('value="part">Part-level'));
  assert.ok(purchasing.includes("componentParts.filter(part=>part.componentId===line.componentId)"));
  assert.ok(purchasing.includes('line.allocationLevel === "part" && !componentParts.some'));
  assert.ok(processMap.includes("selectedPart?.id"));
});

test("component part and independent material cost records are included in shared sync", () => {
  const schema = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/manufacturing-data.mjs", import.meta.url), "utf8");
  const serverTests = readFileSync(new URL("../server/manufacturing-data.test.mjs", import.meta.url), "utf8");
  assert.ok(schema.includes("componentParts: ComponentPartRecord[]"));
  assert.ok(schema.includes("materialCostEntries: MaterialCostEntryRecord[]"));
  assert.ok(server.includes('"componentParts"') && server.includes('"materialCostEntries"'));
  assert.ok(serverTests.includes("component parts and material cost streams sync independently"));
});


test("client-side shared data merge keeps saved parts and both cost scopes by record ID", () => {
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(data.includes("componentParts: mergeRows(local.componentParts, remote.componentParts)"));
  assert.ok(data.includes("materialCostEntries: mergeRows(local.materialCostEntries, remote.materialCostEntries)"));
  assert.ok(data.includes("componentParts: Array.isArray(value?.componentParts)"));
  assert.ok(data.includes("materialCostEntries: Array.isArray(value?.materialCostEntries)"));
});

test("purchase-order deletion retains stand-alone material budgets but removes entries attached to that PO", () => {
  const master = readFileSync(new URL("../src/ManufacturingMasterWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(master.includes("(!row.poId||!targetIds.has(row.poId))&&(!row.poLineId||!lineIds.has(row.poLineId))"));
  assert.ok(master.includes("componentParts:(current.componentParts||[]).filter(row=>!targetIds.has(row.componentId))"));
  assert.ok(master.includes("materialCostEntries:(current.materialCostEntries||[]).filter(row=>!targetIds.has(row.componentId))"));
});


test("Process Map keeps route lines visible independently of arrowhead visibility and recalculates Gantt scale", () => {
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(scene.includes("routeEdges.forEach(edge=>{"));
  assert.ok(scene.includes("if(showArrows){"));
  assert.ok(scene.includes("ganttSegment(i,geometryRows,ganttScale).center"));
  assert.ok(scene.includes("[geometryRows,mode,ganttScale]"));
  assert.ok(scene.includes("ganttDomain(geometryRows,ganttScale)"));
});

test("Selecting a collapsed Process Map node opens its full operation detail record", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("onExpandOperation={(id)=>setExpandedOperationId(id)}"));
  assert.ok(scene.includes("onExpandOperation?.(op.id)"));
  assert.ok(scene.includes('aria-controls="process-orbit-selected-details"'));
  assert.ok(universe.includes('id="process-orbit-selected-details"'));
  for (const field of ["PLANNED START · DATE &amp; TIME", "PLANNED DELIVERY · DATE &amp; TIME", "PLANNED QUANTITY", "PRICE / PART", "MACHINE / STATION", "TRANSPORT VENDOR"]) {
    assert.ok(universe.includes(field), "operation details missing " + field);
  }
});

test("Material allocations save supplier-linked inbound transport and appear in the Process Map", () => {
  const materialPanel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(materialPanel.includes("transportVendorId,transportFrom:transportFrom.trim(),transportTo:transportTo.trim()"));
  assert.ok(materialPanel.includes("transportCost:Math.max(0,Number(transportCost)||0)"));
  assert.ok(materialPanel.includes("Material inbound transport"));
  assert.ok(materialPanel.includes("Material transport route"));
  assert.ok(materialPanel.includes('label="Supplier / material vendor (optional until assigned)"'));
  assert.ok(!materialPanel.includes('if(!vendorId){reportError("Link this material entry to its supplier/vendor before saving.")'));
  assert.ok(materialPanel.includes("transportVendorId,transportFrom:transportFrom.trim(),transportTo:transportTo.trim()"));
  assert.ok(schema.includes("transportVendorId?: string; transportFrom?: string; transportTo?: string;"));
  assert.ok(processMap.includes("const materialRouteEntries ="));
  assert.ok(processMap.includes("materialRoutes={materialRouteEntries.map(entry=>"));
  assert.ok(universe.includes("MATERIAL PROCUREMENT &amp; INBOUND TRANSPORT"));
  assert.ok(universe.includes("route.materialLabel"));
  assert.ok(universe.includes("route.transporter"));
  assert.ok(processMap.includes("materialInboundTransportCost"));
});


test("Every PO part keeps its own main, alternate and rework process route group", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes('const routeGroupKey = (operation:OperationRecord) => (operation.poLineId || operation.componentId) + "::" + (operation.branch || "Main route")'));
  assert.ok(universe.includes("const byBranch = new Map<string, OperationRecord[]>()"));
  assert.ok(processMap.includes('op.poId === poId && op.componentId === selectedLine?.componentId'));
  assert.ok(processMap.includes('op.poLineId===current.poLineId'));
  assert.ok(processMap.includes('setBranchCostIncluded(branch, !laneOperations.some(op => op.costIncluded !== false), laneOperations[0]?.poLineId)'));
});

test("Material transport is separately costed from raw material and cutting", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(panel.includes("transportCost:Math.max(0,Number(transportCost)||0)"));
  assert.ok(panel.includes("money(entry.transportCost||0)"));
  assert.ok(panel.includes("money(entry.materialCost+entry.cuttingCost+(entry.transportCost||0))"));
  assert.ok(processMap.includes("materialInboundTransportCost"));
});


test("Editing or extending a part route retains its source PO line and payment allocation", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("const parentOperation = draft.parentId ? current.operations.find(op=>op.id===draft.parentId && !op.deletedAt) : undefined"));
  assert.ok(processMap.includes("const effectivePoLineId = old?.poLineId || parentOperation?.poLineId || selectedLine.id"));
  assert.ok(processMap.includes("poLineId: effectivePoLineId, componentId: effectiveComponentId"));
  assert.ok(processMap.includes("poLineId:effectivePoLineId,componentId:effectiveComponentId"));
  assert.ok(processMap.includes("const selectedLineOperations = operations.filter(op=>op.poId===poId && op.poLineId===poLineId"));
  assert.ok(processMap.includes("const sameRoute=routeOperations.filter(op=>op.poLineId===current.poLineId"));
});


test("Process Map drill-down respects the selected route-card visibility fields", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(universe.includes("const fieldVisible = (field: string) => visibleFields.includes(field);"));
  assert.ok(workspace.includes("PROCESS_CARD_FIELDS"));
  assert.ok(workspace.includes("Show all"));
  assert.ok(workspace.includes("Clear optional fields"));
  for (const field of ["category", "subcategory", "plannedStart", "plannedEnd", "vendor", "quantity", "amount"]) assert.ok(universe.includes(`fieldVisible("${field}")`), "missing selectable field " + field);
});

test("Process Map material allocations include every part under the selected PO component", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const materialPanel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes('entry.componentId === selectedLine?.componentId && entry.poId === selectedPO?.id'));
  assert.ok(processMap.includes('entry.poId===poId && entry.componentId===selectedLine?.componentId'));
  assert.ok(materialPanel.includes('entry.scope===scope&&entry.componentId===componentId&&(!poId||entry.poId===poId)'));
  assert.ok(processMap.includes('poLineId:entry.poLineId||""'));
  assert.ok(scene.includes("const materialPlacements=useMemo"));
  assert.ok(scene.includes("projectedMaterials.map"));
  assert.ok(scene.includes("projectedTransports.map"));
  assert.ok(!processMap.includes('entry.poId===poId && entry.componentId===selectedLine?.componentId && (!entry.poLineId || entry.poLineId===poLineId)'));
});

test("Process Map exposes material rate and cutting cost separately in route views", () => {
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(processMap.includes("money(entry.materialRate)} / {entry.priceUnit}"));
  assert.ok(processMap.includes("money(entry.cuttingCost)} cutting"));
  assert.ok(universe.includes("route.materialRate"));
  assert.ok(universe.includes("route.cuttingType"));
  assert.ok(universe.includes("route.cuttingCost"));
});

test("3D Gantt does not fabricate schedule dates for operations without date-time values", () => {
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(scene.includes("const hasEvents=events.length>0"));
  assert.ok(scene.includes("domain.hasEvents?1.34:"));
  assert.ok(scene.includes("if(!domain.hasEvents)return[]"));
  assert.ok(scene.includes("NO SCHEDULE DATES"));
  assert.ok(!scene.includes("events.length?Math.min(...events):Date.now()"));
});

test("Manufacturing Universe uses compact 3D nodes and keeps full operation details in the selected-record panel", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('const REQUIRED_PROCESS_CARD_FIELDS: ProcessCardField[] = ["category","subcategory","quantity","plannedStart","plannedEnd","vendor","amount"]'));
  assert.ok(workspace.includes('checked={REQUIRED_PROCESS_CARD_FIELDS.includes(field.key)||cardVisibleFields.includes(field.key)}'));
  assert.ok(workspace.includes('disabled={REQUIRED_PROCESS_CARD_FIELDS.includes(field.key)}'));
  assert.ok(workspace.includes("Clear optional fields · keep essential route details"));
  assert.ok(scene.includes("<small>{operationCode(op)}</small><strong>{op.name}</strong>"));
  assert.ok(scene.includes('Qty {op.quantity.toLocaleString("en-IN")} {quantityUnit}'));
  assert.ok(scene.includes('visibleFields.includes("category")'));
  assert.ok(scene.includes("const cardHeight=width<600?76:92;"));
  assert.ok(universe.includes('className="process-orbit-selected-details"'));
  for (const field of [
    '<small>CATEGORY</small><strong>{expandedOrbitOperation.category || "Not set"}</strong>',
    '<small>PROCESS / SUBCATEGORY</small>',
    '<small>PLANNED START · DATE &amp; TIME</small>',
    '<small>PLANNED DELIVERY · DATE &amp; TIME</small>',
    '<small>VENDOR</small><strong>{vendors.find(vendor => vendor.id === expandedOrbitOperation.vendorId)?.company || "Vendor not assigned"}</strong>',
    '<small>PLANNED QUANTITY</small>',
    '<small>PROCESS AMOUNT</small>',
    '<small>STATUS</small>'
  ]) assert.ok(universe.includes(field), "missing expanded process detail field: "+field);
});

test("Material Directory saves each material allocation directly into its selected PO-component Process Map route", () => {
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  const materialPanel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const processMap = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes('import PartMaterialCostingPanel from "./PartMaterialCostingPanel"'));
  assert.ok(inventory.includes('scope="process-map"'));
  assert.ok(inventory.includes('companyId={directoryCompanyId}'));
  assert.ok(inventory.includes('poId={directoryPoId}'));
  assert.ok(inventory.includes('componentId={directoryComponentId}'));
  assert.ok(inventory.includes('requirePoLine'));
  assert.ok(inventory.includes('startExpanded'));
  assert.ok(inventory.includes('defaultNewPart'));
  assert.ok(materialPanel.includes('defaultNewPart=false'));
  assert.ok(materialPanel.includes('useState(defaultNewPart&&!initialPartId)'));
  assert.ok(materialPanel.includes('New part allocation is selected.'));
  assert.ok(materialPanel.includes('role="alert"'));
  assert.ok(materialPanel.includes('if(requirePoLine&&!effectivePoLineId)'));
  assert.ok(materialPanel.includes('materialCostEntries:[entry,...(current.materialCostEntries||[]).filter(row=>row.id!==entry.id)]'));
  assert.ok(materialPanel.includes('shapeType:shape'));
  assert.ok(materialPanel.includes('dimensions:Object.fromEntries(Object.entries(dimensions)'));
  assert.ok(materialPanel.includes('useEffect(()=>{if(!poLineId)return;setSelectedPoLineId(poLineId)'));
  assert.ok(processMap.includes('materialRoutes={materialRouteEntries.map(entry=>'));
});

test("Material procurement defaults to a part draft and does not block an unassigned supplier", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const inventory = readFileSync(new URL("../src/InventoryWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(inventory.includes("defaultNewPart"));
  assert.ok(panel.includes('initialPartId||defaultNewPart?"part":"component"'));
  assert.ok(panel.includes("setNewPartMode(defaultNewPart&&!initialPartId)"));
  assert.ok(panel.includes('Choose an existing part or “Component only — no parts”'));
  assert.ok(panel.includes('label="Supplier / material vendor (optional until assigned)"'));
  assert.ok(!panel.includes('if(!vendorId){onNotice?.("Link this material entry to its supplier/vendor before saving.")'));
  assert.ok(panel.includes('const reportError=(message:string)=>{setFormError(message);onNotice?.(message);}'));
  assert.ok(panel.includes('formError&&<div className="ax-material-form-error" role="alert">{formError}</div>'));
});

test("Process Map routes integrate material and saved transport legs before and between operations", () => {
  const process = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  assert.ok(process.includes('routeNodes.push({kind:"material"'));
  assert.ok(process.includes('kind:"material-transport"'));
  assert.ok(process.includes('kind:"transport",id:"transport-"+leg.id'));
  assert.ok(process.includes('onClick={()=>editTransportLeg(leg)}'));
  assert.ok(process.includes('onSelectTransportLeg={id=>'));
  assert.ok(universe.includes("transportLegs?: TransportLegRouteNode[]"));
  assert.ok(universe.includes("transportLegs={transportLegs} onSelectTransportLeg={onSelectTransportLeg}"));
  assert.ok(scene.includes("const transportLegPlacements=useMemo"));
  assert.ok(scene.includes("projectedTransportLegs.map"));
  assert.ok(scene.includes('TRANSPORT HAND-OFF · {index+1}/{transportLegs.length}'));
  assert.ok(scene.includes('{leg.vehicleType||"Vehicle not set"}'));
  assert.ok(scene.includes('"operation-transport-"+item.leg.id'));
});

test("Process route graph preserves stage order, independent collapse state, and legacy Transport Directory routes", () => {
  const process = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(process.includes('routeTransportLegs.filter(leg=>(leg.placement||(!leg.anchorOperationId?"start":"after"))==="start").sort((a,b)=>a.sequence-b.sequence)'));
  assert.ok(process.includes('routeMaterials.filter(entry=>!entry.anchorOperationId).forEach(appendMaterial)'));
  assert.ok(process.includes('routeMaterials.filter(entry=>entry.anchorOperationId===operation.id).forEach(appendMaterial)'));
  assert.ok(process.includes('const selectedTransportRoutes = transportRouteOptions.filter(route=>route.active!==false || route.id===draft.transportRouteId || route.sourceRouteId===draft.transportRouteId)'));
  assert.ok(process.includes('const selectedLegacyDraftRoute = selectedTransportRoutes.find(route=>route.id===draft.transportRouteId||route.sourceRouteId===draft.transportRouteId)'));
  assert.ok(process.includes('transportTripDirection:route?.tripDirection||"One-way"'));
  assert.ok(process.includes('Legacy / Transport Directory saved route'));
  assert.ok(process.includes('const dateTimeInput = (value?: string) => {'));
  assert.ok(process.includes('targetLegacyRoute=transportRouteOptions.find'));
  assert.ok(process.includes('Legacy / Transport Directory saved route'));
  assert.ok(panel.includes('if(linkedLine)setSelectedPoLineId(linkedLine.line.id)'));
  assert.ok(process.includes('className="process-route-flow process-route-flow-collapsible"'));
  assert.ok(process.includes('className="process-material-route-panel process-material-route-collapsible"'));
  assert.ok(process.includes('className="process-universe-collapsible"'));
  assert.ok(css.includes('.process-route-flow-collapsible,.process-material-route-collapsible,.process-universe-collapsible'));
});

test("Dedicated full-screen Route Flow and Manufacturing Universe modules are wired to shared data", () => {
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const route = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx", import.meta.url), "utf8");
  const data = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  assert.ok(app.includes('id: "route-flow"'));
  assert.ok(app.includes('id: "manufacturing-universe"'));
  assert.ok(app.includes('<RouteFlowWorkspace'));
  assert.ok(app.includes('<ManufacturingUniverseWorkspace'));
  assert.ok(route.includes('const RELATIONSHIPS:Array<{id:RouteRelationshipType;label:string;description:string;symbol:string}>'));
  assert.ok(route.includes('routeRelationships:[...(current.routeRelationships||[]),record]'));
  assert.ok(route.includes('targetOperationId:to.id'));
  assert.ok(route.includes('<RouteCurve type={connector.type}'));
  assert.ok(universe.includes('<ProcessUniverse3D'));
  assert.ok(universe.includes('routeRelationships={routeRelationships}'));
  assert.ok(universe.includes('onNavigate("route-flow"'));
  assert.ok(data.includes('routeRelationships: RouteRelationshipRecord[]'));
  assert.ok(data.includes('mergeRows(local.routeRelationships, remote.routeRelationships)'));
});

test("All eleven route relationship types have persisted styling and separate route workspace controls", () => {
  const route = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  for (const type of ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"]) {
    assert.ok(route.includes('id:"' + type + '"'), "missing relationship option " + type);
    assert.ok(css.includes('.route-flow-curve-' + type), "missing route curve style " + type);
  }
  assert.ok(universe.includes('routeRelationships?: RouteRelationshipRecord[]'));
  assert.ok(universe.includes('edges.push({id:"relationship-"+link.id'));
  assert.ok(scene.includes('relation==="feedback"'));
  assert.ok(scene.includes('relation==="conditional"'));
});

test("Process Definition catalogue headings span the full grid instead of leaving an empty left column", () => {
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(css.includes('.process-view-directory-catalog-grid{display:grid;grid-template-columns:minmax(0,1fr)!important'));
  assert.ok(css.includes('.process-view-directory-catalog-grid>.process-directory-map-nodes'));
});

test("Process Map offers legacy vendor transport routes alongside the current Transport Directory", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('...vendors.flatMap(vendor=>(vendor.transportRoutes||[]).map(route=>({'));
  assert.ok(workspace.includes('id:"legacy-"+vendor.id+"-"+route.id'));
  assert.ok(workspace.includes('legacy:true'));
  assert.ok(workspace.includes('route.sourceRouteId===leg?.routeId'));
  assert.ok(workspace.includes('(route.legacy?"Legacy · ":"")'));
  assert.ok(workspace.includes('options={transportRouteOptions.filter'));
});

test("Material allocation saves the selected part onto its PO line for an independent route", () => {
  const panel = readFileSync(new URL("../src/PartMaterialCostingPanel.tsx", import.meta.url), "utf8");
  assert.ok(panel.includes('allocationLevel:"part" as const,partId:part.id'));
  assert.ok(panel.includes("purchaseOrders:nextPurchaseOrders"));
  assert.ok(panel.includes("effectivePoLine?.line.partId&&effectivePoLine.line.partId!==partId"));
});

test("3D route arrows stay enabled and narrow-screen process metadata is not hidden", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessScene3D.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(workspace.includes('showArrows={exportArrows}'));
  assert.ok(workspace.includes('checked={exportArrows} disabled /> Connection arrows'));
  assert.ok(scene.includes("const hasTransport=hasMaterialTransport(placement.route)"));
  assert.ok(scene.includes('if(hasTransport){'));
  assert.ok(scene.includes("if(startLegs.length)startLegs.forEach"));
  assert.ok(scene.includes('if(mat&&trans)add("material-transport-"'));
  assert.ok(scene.includes('else if(exit&&to&&!trans)add("material-process-"'));
  assert.ok(scene.includes('if(node&&to)add("transport-operation-"'));
  assert.ok(css.includes('.ax-full3d-label .ax-full3d-node-meta{display:block!important'));
});


test("Route Flow draws vehicle-specific transport icons on curved connectors and supports multiple vehicle types", () => {
  const route = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  for (const icon of ["Bike", "Bus", "CarFront", "Plane", "Ship", "TrainFront", "Truck"]) assert.ok(route.includes(icon));
  assert.ok(route.includes("vehicleType={connector.vehicleType}"));
  assert.ok(route.includes("tripCount={connector.tripCount}"));
  assert.ok(route.includes("route-flow-vehicle-marker"));
  assert.ok(route.includes("Add another leg to show another carrier or vehicle on the same connection."));
  assert.ok(css.includes(".route-flow-vehicle-marker"));
});

test("Manufacturing Universe lets the operator choose live scene fields and connected module shortcuts", () => {
  const universe = readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx", import.meta.url), "utf8");
  const scene = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(universe.includes("UNIVERSE DISPLAY CONTROLS"));
  assert.ok(universe.includes("visibleUniverseFields"));
  assert.ok(universe.includes("visibleUniverseModules"));
  assert.ok(universe.includes("visibleFields={visibleUniverseFields}"));
  assert.ok(universe.includes("linkModules.filter(item=>visibleUniverseModules.includes(item.id))"));
  assert.ok(universe.includes("These are view preferences only. They do not delete or change source records."));
  assert.ok(scene.includes("fieldVisible"));
  assert.ok(css.includes(".manufacturing-universe-customizer"));
});


test("Manufacturing Universe exposes every AXIMACH module and renders material-first PO lines", () => {
  const universe = readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx", import.meta.url), "utf8");
  const moduleBlock = universe.match(/const linkModules=\[([\s\S]*?)\n  \];/);
  assert.ok(moduleBlock, "missing Manufacturing Universe module directory");
  const ids = [...moduleBlock[1].matchAll(/id:"([^"]+)"/g)].map(match => match[1]);
  const expected = ["companies","components","purchasing","vendors","transport-master","contact360","process-master","planned-cost","vendor-capability","inventory","production","route-flow","manufacturing-universe","dispatch","quality","costing","communications","reports","ai-insights","export"];
  assert.deepEqual([...new Set(ids)].sort(), [...expected].sort());
  assert.equal(ids.length, 20, "module shortcuts must not contain duplicate entries");
  assert.ok(universe.includes('routeOperations.length>0||routeMaterials.length>0||routeLegs.length>0||definitions.length>0'));
  assert.ok(universe.includes('materialRoutes={materialRouteNodes}'));
});

test("Route Flow draws saved non-adjacent relationships as responsive curved cross-links", () => {
  const route = readFileSync(new URL("../src/RouteFlowWorkspace.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(route.includes('const routeViewportRef=useRef<HTMLDivElement|null>(null)'));
  assert.ok(route.includes('data-route-operation-id={node.kind==="operation"?node.operation.id:undefined}'));
  assert.ok(route.includes('const fromIndex=ordered.findIndex(operation=>operation.id===link.fromOperationId)'));
  assert.ok(route.includes('if(fromIndex>=0&&toIndex===fromIndex+1)continue'));
  assert.ok(route.includes('const pathData="M "+startX+" "+startY+" C "'));
  assert.ok(route.includes('className="route-flow-relationship-overlay"'));
  assert.ok(route.includes('ResizeObserver(measure)'));
  assert.ok(css.includes('.route-flow-relationship-overlay{position:absolute'));
});


test("Immersive Route Flow and Manufacturing Universe expose full-screen controls and export formats", () => {
  const route=readFileSync(new URL("../src/RouteFlowWorkspace.tsx",import.meta.url),"utf8");
  const universe=readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx",import.meta.url),"utf8");
  const controls=readFileSync(new URL("../src/ImmersiveWorkspaceControls.tsx",import.meta.url),"utf8");
  for(const source of [route,universe]) {
    assert.ok(source.includes("ImmersiveWorkspaceControls"));
    for(const format of ["svg","png","pdf","csv","json"]) assert.ok(source.includes('option value="'+format+'"'));
  }
  assert.ok(controls.includes("requestFullscreen"));
  assert.ok(controls.includes('lockOrientation("portrait")'));
  assert.ok(controls.includes('lockOrientation("landscape")'));
  assert.ok(controls.includes("exitFullscreen"));
});

test("Route Flow and Manufacturing Universe support local operation editing and process creation", () => {
  const route=readFileSync(new URL("../src/RouteFlowWorkspace.tsx",import.meta.url),"utf8");
  const universe=readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx",import.meta.url),"utf8");
  const editor=readFileSync(new URL("../src/OperationInlineEditor.tsx",import.meta.url),"utf8");
  const create=readFileSync(new URL("../src/OperationQuickCreate.tsx",import.meta.url),"utf8");
  assert.ok(route.includes("onClick={()=>setEditingOperation(node.operation)}"));
  assert.ok(universe.includes("onEditOperation={id=>{const op=allRouteOperations.find(row=>row.id===id);if(op)setEditingOperation(op);}}"));
  for(const source of [route,universe]) {
    assert.ok(source.includes("OperationInlineEditor"));
    assert.ok(source.includes("OperationQuickCreate"));
    assert.ok(source.includes("saveNewOperation"));
  }
  for(const field of ["plannedStart","plannedEnd","actualStart","actualEnd","transportVendorId","transportVehicleType","inspectionResult","paidAmount","qualityNotes"]) assert.ok(editor.includes(field));
  assert.ok(create.includes('status:"Planned"'));
});

test("Manufacturing Universe has touch pinch zoom and clearly typed visible graph arrows", () => {
  const universe=readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx",import.meta.url),"utf8");
  const scene=readFileSync(new URL("../src/ProcessUniverse3D.tsx",import.meta.url),"utf8");
  const webgl=readFileSync(new URL("../src/ProcessScene3D.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../src/aximach-ui.css",import.meta.url),"utf8");
  assert.ok(universe.includes("onZoomChange={setZoom}"));
  assert.ok(scene.includes("onPinchMove"));
  assert.ok(scene.includes("process-universe-zoom-controls"));
  assert.ok(scene.includes("process-scene-zoom-viewport"));
  assert.ok(webgl.includes('"+edge.relation+"'));
  assert.ok(css.includes(".process-universe-zoom-controls"));
  assert.ok(css.includes(".ax-full3d-route-arrow.dependency"));
  assert.ok(css.includes(".route-flow-workspace:fullscreen"));
  assert.ok(css.includes("orientation:landscape"));
});


test("Route Flow and Manufacturing Universe keep normal view fitted and use explicit corner full-screen only", () => {
  const route=readFileSync(new URL("../src/RouteFlowWorkspace.tsx",import.meta.url),"utf8");
  const universe=readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx",import.meta.url),"utf8");
  const controls=readFileSync(new URL("../src/ImmersiveWorkspaceControls.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../src/aximach-ui.css",import.meta.url),"utf8");
  for(const source of [route,universe]) assert.ok(source.includes("ax-workspace-expand-toggle")||source.includes("ImmersiveWorkspaceControls"));
  assert.ok(controls.includes("requestFullscreen"));
  assert.ok(controls.includes("exitFullscreen"));
  assert.ok(controls.includes("ArrowLeft"));
  assert.ok(!controls.includes("orientation.lock"));
  assert.ok(!controls.includes("lockOrientation"));
  assert.ok(!controls.includes("Portrait"));
  assert.ok(!controls.includes("Landscape"));
  assert.ok(css.lastIndexOf("/* Restore standard AXIMACH navigation")>css.lastIndexOf("/* Default-open behavior"));
  assert.ok(css.includes(".route-flow-workspace:fullscreen"));
  assert.ok(css.includes(".app-shell:has(.route-flow-workspace) .command-rail"));
});

test("Manufacturing Universe uses gesture-only pinch zoom and compact screen-fitted scene", () => {
  const scene=readFileSync(new URL("../src/ProcessUniverse3D.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../src/aximach-ui.css",import.meta.url),"utf8");
  assert.ok(scene.includes("onPinchStart"));
  assert.ok(scene.includes("onPinchMove"));
  assert.ok(scene.includes("onPinchEnd"));
  assert.ok(scene.includes("process-scene-zoom-viewport"));
  assert.ok(!scene.includes('className="process-universe-zoom-controls"'));
  assert.ok(css.includes(".process-universe-3d,.process-scene-zoom-viewport{touch-action:none"));
  assert.ok(css.includes(".ax-full3d-label{width:min(148px,41vw)"));
});

test("Transport icon opens the linked directory route and full transporter profile in both workspaces", () => {
  const route=readFileSync(new URL("../src/RouteFlowWorkspace.tsx",import.meta.url),"utf8");
  const universe=readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx",import.meta.url),"utf8");
  const scene=readFileSync(new URL("../src/ProcessScene3D.tsx",import.meta.url),"utf8");
  const inspector=readFileSync(new URL("../src/TransportRecordInspector.tsx",import.meta.url),"utf8");
  const css=readFileSync(new URL("../src/aximach-ui.css",import.meta.url),"utf8");
  assert.ok(route.includes("setInspectedTransportId(node.leg.id)"));
  assert.ok(route.includes("TransportRecordInspector"));
  assert.ok(universe.includes("onSelectTransportLeg={id=>setInspectedTransportId(id)}"));
  assert.ok(universe.includes("TransportRecordInspector"));
  assert.ok(scene.includes("TRANSPORT DIRECTORY"));
  for(const field of ["vendor?.contact","vendor?.phone","vendor?.whatsappNumber","vendor?.email","vendor?.address","vendor?.notes","leg.fromLocation","leg.toLocation","leg.tripCount","leg.fixedAmount","leg.pickupAt","leg.deliveryAt"]) assert.ok(inspector.includes(field));
  for(const tone of ["bike","bus","car","air","ship","rail","truck"]) assert.ok(css.includes(".ax-full3d-transport-leg-label.vehicle-"+tone));
});

test("Both engineering workspaces share persistent light, medium, dark and ocean palettes", () => {
  const route=readFileSync(new URL("../src/RouteFlowWorkspace.tsx",import.meta.url),"utf8");
  const universe=readFileSync(new URL("../src/ManufacturingUniverseWorkspace.tsx",import.meta.url),"utf8");
  const picker=readFileSync(new URL("../src/WorkspaceThemePicker.tsx",import.meta.url),"utf8");
  const hook=readFileSync(new URL("../src/workspaceTheme.ts",import.meta.url),"utf8");
  const css=readFileSync(new URL("../src/aximach-ui.css",import.meta.url),"utf8");
  for(const source of [route,universe]) assert.ok(source.includes("useWorkspaceTheme"));
  for(const theme of ["light","medium","dark","ocean"]) {
    assert.ok(picker.includes('value="'+theme+'"'));
    assert.ok(css.includes('data-workspace-theme="'+theme+'"'));
  }
  assert.ok(hook.includes("aximach.workspaceTheme.v1"));
  assert.ok(hook.includes("localStorage.setItem"));
});
