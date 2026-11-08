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
  assert.ok(workspace.includes('if (scope === "all") return routeOperations;'), "All routes must include every saved operation even when filters are active");
  assert.ok(workspace.includes('if (scope === "filtered") return source;'), "Filtered results must be the explicit filtered-only scope");
  assert.ok(workspace.includes('{ key: "all", label: "All routes", count: routeOperations.length }'), "All routes count must reflect the complete saved route graph");
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
  assert.ok(workspace.includes("id: operationId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id"));
});

test("Dashboard spheres auto-rotate by default, support pause and manual drag, and navigate to the correct workspaces", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const process = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(!orb.includes("useAnimationFrame"));
  assert.ok(!orb.includes("rotateY:360"));
  assert.ok(!orb.includes("rotate:360"));
  assert.ok(orb.includes("const [autoRotate, setAutoRotate]"));
  assert.ok(orb.includes("window.setInterval"));
  assert.ok(orb.includes("if ((!autoRotate && !autoRotateRecords) || reduceMotion || reducedMotion) return"));
  assert.ok(orb.includes("if (autoRotate && !drag.current) rotateY.set"));
  assert.ok(orb.includes("if (autoRotateRecords && !lowerDrag.current) lowerRotateY.set"));
  assert.ok(orb.includes("[autoRotate, autoRotateRecords, reduceMotion, reducedMotion, speed, rotateY, lowerRotateY]"));
  assert.ok(orb.includes("Pause modules"));
  assert.ok(orb.includes("Resume modules"));
  assert.ok(orb.includes("Pause records"));
  assert.ok(orb.includes("Resume records"));
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

test("static WebGL globe redraws only when resized and does not burn frames while idle", () => {
  const sphere = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(sphere.includes("const draw = () =>"));
  assert.ok(sphere.includes("const observer = typeof ResizeObserver"));
  assert.ok(sphere.includes("observer?.observe(canvas)"));
  assert.ok(sphere.includes("gl.uniform2f(resolution, width, height)"));
  assert.ok(!sphere.includes("requestAnimationFrame"));
  assert.ok(!sphere.includes("cancelAnimationFrame"));
});

test("WebGL globe surface follows manual drag orientation without independent auto-rotation", () => {
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
  assert.ok(orb.includes("rotate gently by default"));
  assert.ok(orb.includes("AUTO-ROTATING"));
  assert.ok(!orb.includes("Both spheres are stationary until the user drags them. No idle auto-rotation."));
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
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(universe.includes("const orbitConnections = useMemo"));
  assert.ok(universe.includes("orbitConnections.edges.map"));
  assert.ok(universe.includes("orbitConnections.anchors.map"));
  assert.ok(universe.includes('className={"process-orbit-connector is-"+edge.relation}'));
  assert.ok(universe.includes('className={"process-orbit-parent-anchor is-"+anchor.relation}'));
  assert.ok(styles.includes(".process-orbit-connector.is-alternate { color: #4b95eb; }"));
  assert.ok(styles.includes(".process-orbit-connector.is-rework { color: #e38b45; }"));
  assert.ok(styles.includes(".process-orbit-connector::after"));
});

test("Process route scope keeps original parent arrows visible and each 3D view opens its matching layout", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("const resolveBranchOrigin ="));
  assert.ok(workspace.includes("while (parent && (parent.branch || \"Main route\") === branch"));
  assert.ok(workspace.includes("const branchOrigin=resolveBranchOrigin(branch,lane)"));
  assert.ok(workspace.includes("const branchOrigin=resolveBranchOrigin(branch,laneOperations)"));
  for (const view of ["sphere","vortex","linear","horizontal","vertical","timeline","gantt","nodes","branch","combined"]) {
    assert.ok(workspace.includes('id:"' + view + '"'), "missing Process Plan view: " + view);
  }
  assert.ok(workspace.includes('initialLayout={visualStyle==="vortex"?"vortex":visualStyle==="combined"?"digital-mesh":"sphere"}'));
  assert.ok(universe.includes('initialLayout = "sphere"'));
  assert.ok(universe.includes("useState<ProcessLayoutMode>(initialLayout)"));
  assert.ok(universe.includes("while (ancestor && (ancestor.branch || \"Main route\") === name"));
  assert.ok(universe.includes("[parentOperations, lookupOperations]"));
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
  assert.ok(studio.includes("tablerIconCatalogue.filter((item) => isMechanicalStudioIcon(item.name))"));
  assert.ok(studio.includes('useState("outline:tools")'));
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

test("Process Plan shares field and arrow controls with Process Universe", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("visibleFields={exportFields} showArrows={exportArrows}"));
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
    const selectedPanel = /<details open(?=[^>]*className="surface-panel linked-operation-side")(?=[^>]*ref=\{selectedOperationPanelRef\})[^>]*>/;
    const expected = panel === "linked-operation-side" ? selectedPanel.test(workspace) : workspace.includes('<details open className="surface-panel ' + panel + '"');
    assert.ok(expected, "missing open/close panel " + panel);
  }
  assert.equal((workspace.match(/<details\b/g) || []).length, (workspace.match(/<\/details>/g) || []).length);
  assert.ok(workspace.includes("<summary className=\"panel-heading\">"));
});


test("Main Dashboard and 3D Command Centre center the 18-module orb on mobile", () => {
  const dashboardStyles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  const appStyles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.ok(dashboardStyles.includes(".dashboard-welcome-orb .ax-orb-drag-zone"));
  assert.ok(appStyles.includes("@media(max-width:760px)"));
  assert.ok(appStyles.includes(".hero-command {"));
  assert.ok(appStyles.includes("grid-template-columns:minmax(0,1fr)"));
});


test("Process Universe receives shared visibility controls, vendor labels and diagram arrow state from Process Plan", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes("visibleFields={exportFields} showArrows={exportArrows}"));
  assert.ok(workspace.includes("showArrows={exportArrows}"));
  assert.ok(workspace.includes("PROCESS_EXPORT_FIELDS.map(field=>"));
  assert.ok(workspace.includes("visibleFields={exportFields} showArrows={exportArrows}"));
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


test("secondary Process Plan workspaces are user-expandable while route filters and graph stay open", () => {
  const workspace = readFileSync(new URL("../src/LinkedProcessWorkspace.tsx", import.meta.url), "utf8");
  assert.ok(workspace.includes('<details open className="surface-panel component-transport-map-strip">'));
  assert.ok(workspace.includes('<details open className="surface-panel process-operation-table-panel">'));
  assert.ok(workspace.includes('<details open className="surface-panel linked-cost-card">'));
  assert.ok(workspace.includes('<details open className="surface-panel process-route-scope-panel">'));
  assert.ok(workspace.includes('<details open className="surface-panel linked-route-canvas">'));
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
    assert.equal((universe.match(new RegExp('fieldVisible\\("' + field + '"\\)', "g")) || []).length, 2, field + " must be rendered in both layouts");
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
  assert.equal(universe.split('fieldVisible("paymentStatus")').length - 1, 2);
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

test("Dashboard module and live-record spheres rotate and pause independently", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  assert.ok(orb.includes("autoRotateRecords"));
  assert.ok(orb.includes("setAutoRotateRecords"));
  assert.ok(orb.includes("autoRotateRecords && !lowerDrag.current"));
  assert.ok(orb.includes("ax-orb-record-pause"));
  assert.ok(orb.includes("saved.current.manualRotationPreferenceSet === true && saved.current.autoRotate === true"));
  assert.ok(orb.includes("saved.current.manualRotationPreferenceSet === true && saved.current.autoRotateRecords === true"));
  assert.ok(orb.includes("manualRotationPreferenceSet:true"));
  const sphere = readFileSync(new URL("../src/AXIMACHWebGLSphere.tsx", import.meta.url), "utf8");
  assert.ok(sphere.includes("float h = b*b - (dot(ro,ro) - 1.0)"));
  assert.ok(sphere.includes("The globe remains spherical and never auto-rotates while idle."));
});

test("Logo Studio lists and renders the authored mechanical tool and transport glyph inventory", () => {
  const studio = readFileSync(new URL("../src/IconStudio.tsx", import.meta.url), "utf8");
  const mechanical = readFileSync(new URL("../src/MechanicalOperationIcon.tsx", import.meta.url), "utf8");
  assert.ok(studio.includes("MECHANICAL_ICON_INVENTORY.map"));
  assert.ok(studio.includes('name:"mechanical:"+item.glyph'));
  assert.ok(studio.includes("MechanicalIconGlyph glyph={item.glyph}"));
  assert.ok(studio.includes("mechanicalGlyphForStudioName(assignment.iconName)"));
  assert.ok(mechanical.includes('{glyph:"transport-truck",label:"Transport / dispatch"'));
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
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(universe.includes('aria-controls="process-orbit-selected-details"'));
  assert.ok(universe.includes('aria-expanded={expanded}'));
  assert.ok(universe.includes('id="process-orbit-selected-details"'));
  assert.ok(universe.includes('{layoutMode !== "route" && expandedOrbitOperation && <section'));
  assert.ok(universe.includes('onClick={() => setExpandedOperationId("")}'));
  assert.ok(universe.includes("const expandedOrbitOperation = displayOperations.find(operation => operation.id === expandedOperationId);"));
  assert.ok(styles.includes(".process-orbit-selected-details{"));
});

test("Process Universe route sections can independently expand and collapse", () => {
  const universe = readFileSync(new URL("../src/ProcessUniverse3D.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/aximach-ui.css", import.meta.url), "utf8");
  assert.ok(universe.includes("const [collapsedLaneNames, setCollapsedLaneNames] = useState<string[]>([]);"));
  assert.ok(universe.includes("const collapsed = collapsedLaneNames.includes(lane.name);"));
  assert.ok(universe.includes('className="process-universe-lane-toggle"'));
  assert.ok(universe.includes("aria-expanded={!collapsed}"));
  assert.ok(universe.includes('className="process-universe-lane-content" hidden={collapsed}'));
  assert.ok(universe.includes('onClick={() => setCollapsedLaneNames(current => current.includes(lane.name)'));
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


test("AXIMACH sphere drag does not capture pointer input from clickable module controls", () => {
  const orb = readFileSync(new URL("../src/AXIMACHOrb.tsx", import.meta.url), "utf8");
  const start = orb.slice(orb.indexOf("const startDrag"), orb.indexOf("const moveDrag"));
  const guard = start.indexOf("if (interactiveTarget) return;");
  const capture = start.indexOf("setPointerCapture(event.pointerId)");
  assert.ok(guard >= 0 && capture > guard, "interactive controls must be ignored before drag pointer capture");
  assert.ok(start.includes('event.target.closest("button, a, input, select, textarea, [role=\'button\']")'));
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
