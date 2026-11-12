import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:4180";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
const seedKey = "aximach.manufacturingData.v1";
const seededData = {
  updatedAt: fixture.company.createdAt,
  companies: [fixture.company],
  factories: [fixture.factory],
  purchaseOrders: [fixture.purchaseOrder],
  components: [fixture.component],
  vendors: fixture.vendors,
  operations: fixture.operations,
  quotations: fixture.quotations || [],
  materials: fixture.materials,
  componentParts: fixture.parts,
  materialCostEntries: fixture.materialCostEntries,
  bomLines: fixture.bomLines,
  materialProcessLinks: fixture.materialProcessLinks,
  inventoryTransactions: fixture.inventoryTransactions || [],
  contactProfiles: fixture.contactProfiles || [],
  processDefinitions: fixture.processDefinitions,
  plannedCosts: fixture.plannedCosts || [],
  transportRoutes: fixture.transportRoutes,
  transportLegs: fixture.transportLegs,
  paymentTransactions: fixture.paymentTransactions || [],
  inspectionMeasurements: fixture.inspectionMeasurements || [],
  routeRelationships: fixture.routeRelationships,
  followUpAssignments: fixture.followUpAssignments || []
};
const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4180", "--strictPort"], {
  stdio: "inherit",
  env: { ...process.env, BROWSER: "none" }
});
let browser;
let scenarioCount = 0;
const suffix = "CRUD-" + Date.now().toString(36).toUpperCase();

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { const response = await fetch(baseURL); if (response.ok) return; } catch {}
    await delay(1000);
  }
  throw new Error("Vite did not become ready at " + baseURL);
}
async function newScenario() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, data }) => {
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem("aximach.storage.mode", "local-only");
    localStorage.setItem("aximach.legacy-demo-cleanup.v2", "done");
  }, { key: seedKey, data: seededData });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator(".app-shell").waitFor({ state: "visible", timeout: 12000 });
  if (pageErrors.length) throw new Error("App startup runtime error: " + pageErrors.join(" | "));
  return { context, page, pageErrors };
}
async function openModule(page, title) {
  const nav = page.locator('nav[aria-label="AXIMACH navigation"]');
  const button = nav.locator('button[title="' + title.replaceAll('"', '\\"') + '"]');
  await button.waitFor({ state: "attached", timeout: 10000 });
  await button.evaluate(element => element.click());
  await page.waitForTimeout(250);
  await page.locator(".page-content h1, .page-content h2").first().waitFor({ state: "visible", timeout: 10000 });
}
async function pick(page, id, query) {
  const input = page.locator("#" + id);
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill(query);
  const option = page.getByRole("option").filter({ hasText: query }).first();
  await option.waitFor({ state: "visible", timeout: 6000 });
  await option.click();
  await page.waitForTimeout(100);
}
async function customPick(page, id, value) {
  const input = page.locator("#" + id);
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill(value);
  await input.press("Enter");
  await page.waitForTimeout(100);
}
async function visible(locator, label) {
  await locator.waitFor({ state: "visible", timeout: 8000 }).catch(() => { throw new Error("Expected visible UI element: " + label); });
}
async function finishScenario(s, label) {
  if (s.pageErrors.length) throw new Error(label + " browser runtime errors: " + s.pageErrors.join(" | "));
  await s.context.close();
  scenarioCount++;
  console.log("PASS CRUD scenario: " + label);
}
async function companyCrud() {
  const s = await newScenario(), p = s.page;
  const name = suffix + " Company";
  await openModule(p, "Company Directory");
  await p.getByRole("button", { name: "Add Company" }).click();
  await p.getByPlaceholder("Enter your actual registered company name").fill(name);
  await p.getByRole("button", { name: "Save company" }).click();
  let row = p.locator(".module-record-card").filter({ hasText: name }).first();
  await visible(row, "new company row");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const edited = name + " Updated";
  await p.getByPlaceholder("Enter your actual registered company name").fill(edited);
  await p.getByRole("button", { name: "Save company" }).click();
  row = p.locator(".module-record-card").filter({ hasText: edited }).first();
  await visible(row, "updated company row");
  await row.getByRole("button", { name: "Archive", exact: true }).click();
  await p.waitForTimeout(200);
  if (await p.locator(".module-record-card").filter({ hasText: edited }).count()) throw new Error("Archived company remains in the active directory.");
  await finishScenario(s, "Company Directory Add/Edit/Save/Archive");
}
async function componentCrud() {
  const s = await newScenario(), p = s.page;
  const partNo = suffix + "-PART-01", compName = suffix + " Test Component";
  await openModule(p, "Component Directory");
  await p.getByRole("button", { name: "Add Component" }).click();
  await pick(p, "component-company", fixture.company.name);
  await p.getByPlaceholder("Customer or internal part number").fill(partNo);
  await p.getByPlaceholder("Actual component name").fill(compName);
  await p.getByRole("button", { name: "Save component" }).click();
  let row = p.locator(".module-record-card").filter({ hasText: partNo }).first();
  await visible(row, "new component row");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await p.getByPlaceholder("Actual component name").fill(compName + " Updated");
  await p.getByRole("button", { name: "Save component" }).click();
  row = p.locator(".module-record-card").filter({ hasText: compName + " Updated" }).first();
  await visible(row, "updated component row");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await p.waitForTimeout(250);
  if (await p.locator(".module-record-card").filter({ hasText: partNo }).count()) throw new Error("Deleted component remains in the active directory.");
  await finishScenario(s, "Component Directory Add/Edit/Save/Delete");
}
async function purchaseOrderCrud() {
  const s = await newScenario(), p = s.page;
  const poNo = suffix + "-PO-01";
  await openModule(p, "Purchase Orders");
  await p.getByRole("button", { name: "Create Purchase Order" }).click();
  await p.getByPlaceholder("Enter the customer's actual PO number").fill(poNo);
  await pick(p, "po-company", fixture.company.name);
  const componentPicker = p.locator('input[id^="po-line-component-"]').first();
  await componentPicker.waitFor({ state: "visible", timeout: 8000 });
  await componentPicker.fill(fixture.component.partNumber);
  await p.getByRole("option").filter({ hasText: fixture.component.partNumber }).first().click();
  const quantity = p.locator(".po-line-form input[type='number']").first();
  await quantity.fill("4");
  await p.getByRole("button", { name: "Save purchase order" }).click();
  let row = p.locator(".module-record-card").filter({ hasText: poNo }).first();
  await visible(row, "new PO row");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await p.getByPlaceholder("Enter the customer's actual PO number").fill(poNo + "-UPDATED");
  await p.getByRole("button", { name: "Save purchase order" }).click();
  row = p.locator(".module-record-card").filter({ hasText: poNo + "-UPDATED" }).first();
  await visible(row, "updated PO row");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await p.waitForTimeout(250);
  if (await p.locator(".module-record-card").filter({ hasText: poNo + "-UPDATED" }).count()) throw new Error("Deleted PO remains in the active directory.");
  await finishScenario(s, "Purchase Orders Add/Edit/Save/Delete with component line");
}
async function vendorCrud() {
  const s = await newScenario(), p = s.page;
  const vendorName = suffix + " Supplier", contactName = suffix + " Contact";
  await openModule(p, "Vendor Directory");
  await p.getByRole("button", { name: "Add vendor" }).click();
  await p.getByPlaceholder("Type company name; reuse an existing company where applicable").fill(vendorName);
  const contact = p.locator("#vendor-contact-person");
  await contact.fill(contactName);
  await contact.press("Enter");
  await p.getByRole("button", { name: "Save vendor master" }).click();
  await visible(p.locator(".vendor-detail-title").filter({ hasText: vendorName }), "saved vendor details");
  await p.locator(".vendor-detail-title").getByRole("button", { name: "Edit", exact: true }).click();
  const updatedVendor = vendorName + " Updated";
  await p.getByPlaceholder("Type company name; reuse an existing company where applicable").fill(updatedVendor);
  await p.getByRole("button", { name: "Save vendor master" }).click();
  await visible(p.locator(".vendor-detail-title").filter({ hasText: updatedVendor }), "updated vendor details");
  await p.locator(".vendor-actions").getByRole("button", { name: "Archive vendor" }).click();
  await p.waitForTimeout(250);
  if (await p.locator(".vendor-record").filter({ hasText: updatedVendor }).count()) throw new Error("Archived vendor remains in the active vendor list.");
  await finishScenario(s, "Vendor Directory Add/Edit/Save/Archive");
}
async function contact360Crud() {
  const s = await newScenario(), p = s.page;
  const person = suffix + " Contact360", edited = person + " Updated";
  await openModule(p, "Contact 360");
  await p.getByRole("button", { name: "Add contact" }).click();
  await pick(p, "contact-linked-record", fixture.company.name);
  await p.getByPlaceholder("Full name").fill(person);
  await p.getByRole("button", { name: "Save contact" }).click();
  let row = p.locator("article.contact360-row").filter({ hasText: person }).first();
  await visible(row, "new Contact 360 row");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await p.getByPlaceholder("Full name").fill(edited);
  await p.getByRole("button", { name: "Save contact" }).click();
  row = p.locator("article.contact360-row").filter({ hasText: edited }).first();
  await visible(row, "updated Contact 360 row");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await p.waitForTimeout(200);
  if (await p.locator("article.contact360-row").filter({ hasText: edited }).count()) throw new Error("Deleted contact remains in active Contact 360 results.");
  await finishScenario(s, "Contact 360 Add/Edit/Save/Delete");
}
async function transportCrud() {
  const s = await newScenario(), p = s.page;
  const from = suffix + " Pickup", to = suffix + " Delivery";
  await openModule(p, "Transport Directory");
  await pick(p, "transport-route-vendor", fixture.vendors[0].company);
  await p.getByPlaceholder("Pickup location").fill(from);
  await p.getByPlaceholder("Delivery location").fill(to);
  await p.getByPlaceholder("Enter agreed route rate").fill("987");
  await p.getByRole("button", { name: "Add route rate" }).click();
  let row = p.locator("tr").filter({ hasText: from }).filter({ hasText: to }).first();
  await visible(row, "new transport route row");
  await row.locator('button[title="Edit route"]').click();
  await p.getByPlaceholder("Enter agreed route rate").fill("1234");
  await p.getByRole("button", { name: "Save route rate" }).click();
  row = p.locator("tr").filter({ hasText: from }).filter({ hasText: to }).first();
  await visible(row, "updated transport route row");
  await row.locator('button[title="Archive route"]').click();
  await p.waitForTimeout(200);
  if (await p.locator("tr").filter({ hasText: from }).filter({ hasText: to }).count()) throw new Error("Archived transport route remains visible in the active register.");
  await finishScenario(s, "Transport Directory Add/Edit/Save/Archive");
}
async function processDirectoryCrud() {
  const s = await newScenario(), p = s.page;
  const category = suffix + " Category", process = suffix + " Process";
  await openModule(p, "Process Directory");
  await customPick(p, "process-category", category);
  await customPick(p, "process-type", process);
  await p.getByPlaceholder("Process scope or requirements").fill("Created by isolated CRUD browser acceptance.");
  await p.getByRole("button", { name: "Add process", exact: true }).click();
  let row = p.locator("article.specialized-record").filter({ hasText: process }).first();
  await visible(row, "new Process Directory row");
  await row.getByRole("button", { name: /Edit/ }).click();
  await p.getByPlaceholder("Process scope or requirements").fill("Updated by isolated CRUD browser acceptance.");
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  row = p.locator("article.specialized-record").filter({ hasText: process }).first();
  await visible(row, "updated Process Directory row");
  await row.getByRole("button", { name: /Delete/ }).click();
  await p.waitForTimeout(200);
  if (await p.locator("article.specialized-record").filter({ hasText: process }).count()) throw new Error("Deleted Process Directory record remains active.");
  await finishScenario(s, "Process Directory Add/Edit/Save/Archive");
}
async function plannedCostCrud() {
  const s = await newScenario(), p = s.page;
  const definition = fixture.processDefinitions[0];
  const note = suffix + " Planned cost update";
  await openModule(p, "Component Planned Cost");
  await pick(p, "planned-company", fixture.company.name);
  await pick(p, "planned-po", fixture.purchaseOrder.number);
  await pick(p, "planned-component", fixture.component.partNumber);
  await pick(p, "planned-process-category", definition.category);
  await pick(p, "planned-process-type", definition.processType);
  await p.getByLabel("Planned quantity *").fill("7");
  await p.getByPlaceholder("Rate per piece / set").fill("321");
  await p.getByPlaceholder("Assumptions or rate basis").fill(note);
  await p.getByRole("button", { name: /Save 1 process cost row/ }).click();
  let row = p.locator("tr").filter({ hasText: note }).first();
  await visible(row, "new planned cost row");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await p.getByPlaceholder("Rate per piece / set").fill("654");
  await p.getByPlaceholder("Assumptions or rate basis").fill(note + " Updated");
  await p.getByRole("button", { name: "Save changes", exact: true }).click();
  row = p.locator("tr").filter({ hasText: note + " Updated" }).first();
  await visible(row, "updated planned cost row");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await p.waitForTimeout(200);
  if (await p.locator("tr").filter({ hasText: note + " Updated" }).count()) throw new Error("Archived planned cost remains active.");
  await finishScenario(s, "Component Planned Cost Add/Edit/Update/Archive");
}
async function materialAndBomCrud() {
  const s = await newScenario(), p = s.page;
  const code = suffix + "-MAT", name = suffix + " Aluminium stock";
  await openModule(p, "Material Directory");
  await p.getByRole("button", { name: "Add material" }).click();
  await p.getByPlaceholder("e.g. EN8-ROUND-80").fill(code);
  await p.getByPlaceholder("Actual stock/material name").fill(name);
  await p.getByPlaceholder("Type or search material family…").fill("CRUD Aluminium");
  await p.getByPlaceholder(/Type to search saved \/ common grades/).fill(suffix + "-AL-GRADE");
  await p.getByLabel("Density (kg/m³)").fill("2700");
  await p.getByLabel("Rate per unit (₹)").fill("245");
  await p.getByRole("button", { name: "Save material" }).click();
  let materialRow = p.locator("tr").filter({ hasText: code }).first();
  await visible(materialRow, "new material row");
  await materialRow.getByRole("button", { name: "Edit", exact: true }).click();
  await p.getByPlaceholder("Actual stock/material name").fill(name + " Updated");
  await p.getByLabel("Rate per unit (₹)").fill("260");
  await p.getByRole("button", { name: "Save material" }).click();
  materialRow = p.locator("tr").filter({ hasText: code }).first();
  await visible(materialRow, "updated material row");

  await p.getByRole("button", { name: /BOM lines/ }).click();
  await p.getByRole("button", { name: "Add BOM line" }).click();
  await pick(p, "bom-component", fixture.component.partNumber);
  await pick(p, "bom-material", code);
  await p.getByPlaceholder("Revision identifier").fill(suffix + "-BOM-REV");
  await p.getByLabel("Quantity per part / component *").fill("1.75");
  await p.getByLabel("Scrap allowance (%)").fill("2");
  await p.getByRole("button", { name: "Save BOM line" }).click();
  let bomRow = p.locator("tr").filter({ hasText: suffix + "-BOM-REV" }).first();
  await visible(bomRow, "new BOM row");
  await bomRow.getByRole("button", { name: "Edit", exact: true }).click();
  await p.getByLabel("Quantity per part / component *").fill("2.25");
  await p.getByRole("button", { name: "Save BOM line" }).click();
  bomRow = p.locator("tr").filter({ hasText: suffix + "-BOM-REV" }).first();
  await visible(bomRow, "updated BOM row");
  await bomRow.getByRole("button", { name: /Archive/ }).click();
  await p.waitForTimeout(150);
  if (await p.locator("tr").filter({ hasText: suffix + "-BOM-REV" }).count()) throw new Error("Archived BOM line remains active.");
  await p.getByRole("button", { name: /Material catalogue/ }).click();
  materialRow = p.locator("tr").filter({ hasText: code }).first();
  await visible(materialRow, "material row before archive");
  await materialRow.getByRole("button", { name: /Delete/ }).click();
  await p.waitForTimeout(150);
  if (await p.locator("tr").filter({ hasText: code }).count()) throw new Error("Archived material remains active.");
  await finishScenario(s, "Material Directory and BOM Add/Edit/Save/Archive");
}


async function followUpAssignmentCrud() {
  const s = await newScenario(), p = s.page;
  await openModule(p, "Company Directory");
  const dock = p.locator(".ax-followup-assignment-dock");
  await visible(dock, "Follow-up assignment dock");
  await dock.getByRole("button", { name: /Follow-up people/ }).click();
  const panel = p.getByRole("dialog", { name: "Follow-up people for Company Directory" });
  await visible(panel, "Follow-up assignment panel");
  const selects = panel.locator("select");
  await selects.nth(0).selectOption(fixture.company.id);
  await selects.nth(1).selectOption("company:" + fixture.company.id);
  await panel.getByRole("button", { name: "Add", exact: true }).click();
  const person = panel.locator(".ax-followup-person").filter({ hasText: fixture.company.contactPerson }).first();
  await visible(person, "assigned follow-up person");
  await person.getByRole("button", { name: "Unlink " + fixture.company.contactPerson }).click();
  await p.waitForTimeout(150);
  if (await panel.locator(".ax-followup-person").filter({ hasText: fixture.company.contactPerson }).count()) {
    throw new Error("Unlinked follow-up person remains assigned to the company.");
  }
  await finishScenario(s, "Follow-up people assignment Add/Unlink");
}


async function processMapOperationCrud() {
  const s = await newScenario(), p = s.page;
  const category = suffix + " Operation Category";
  const processName = suffix + " Operation";
  await openModule(p, "Production Plan & Process Plan");
  const job = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  await visible(job, "synthetic production job");
  await job.getByRole("button", { name: "Process Plan", exact: true }).click();
  await visible(p.locator("#route-company"), "Process Map company scope");
  await p.locator('button[aria-label="Add operation ▾"]').click();
  await p.getByRole("menuitem", { name: "Blank process operation" }).click();
  const editor = p.getByRole("dialog", { name: "Add process operation" });
  await visible(editor, "new Process Map operation editor");
  await customPick(p, "operation-category", category);
  await customPick(p, "operation-process-type", processName);
  await pick(p, "operation-execution-type", "Internal");
  await p.getByPlaceholder("Setup, process constraints, delivery instructions").fill("Initial synthetic operation record.");
  await editor.getByRole("button", { name: "Save operation", exact: true }).click();
  await p.waitForTimeout(250);
  let row = p.locator("tr.process-operation-row").filter({ hasText: processName }).first();
  await visible(row, "new saved process operation row");
  await row.locator('button[title="Edit process"]').click();
  const editDialog = p.getByRole("dialog", { name: "Edit process operation" });
  await visible(editDialog, "edit Process Map operation editor");
  await p.getByPlaceholder("Setup, process constraints, delivery instructions").fill("Updated synthetic operation record.");
  await pick(p, "operation-payment-status", "Paid");
  await p.getByLabel("Total amount paid (₹)").fill("125");
  await p.getByPlaceholder("Voucher / UTR / receipt number").fill(suffix + "-PAYMENT");
  await editDialog.getByRole("button", { name: "Save changes", exact: true }).click();
  row = p.locator("tr.process-operation-row").filter({ hasText: processName }).first();
  await visible(row, "updated Process Map operation row");
  if (!(await row.innerText()).includes("Updated synthetic operation record.")) throw new Error("Process Map edit did not update the saved operation notes.");
  const operationId = await p.evaluate(({ key, name }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.operations || []).find(item => item.name === name && !item.deletedAt)?.id || "";
  }, { key: seedKey, name: processName });
  if (!operationId) throw new Error("Updated operation was not persisted under its stable record ID.");
  const recordedPayment = await p.evaluate(({ key, operationId }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.paymentTransactions || []).filter(item => item.operationId === operationId && !item.deletedAt)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, { key: seedKey, operationId });
  if (recordedPayment !== 125) throw new Error("Process Plan payment total did not append the exact 125-unit ledger entry; found " + recordedPayment);
  await row.locator('button[title="Delete process"]').click();
  await p.waitForTimeout(250);
  if (await p.locator("tr.process-operation-row").filter({ hasText: processName }).count()) {
    throw new Error("Archived Process Map operation remains in the active route register.");
  }
  const retainedHistory = await p.evaluate(({ key, operationId }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      archived: Boolean((root.operations || []).find(item => item.id === operationId)?.deletedAt),
      payment: (root.paymentTransactions || []).filter(item => item.operationId === operationId).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    };
  }, { key: seedKey, operationId });
  if (!retainedHistory.archived || retainedHistory.payment !== 125) throw new Error("Process archive must retain its archived operation and immutable payment history.");
  await finishScenario(s, "Process Map Add/Edit/Payment ledger/Delete with history retention");
}


async function dispatchStatusCrud() {
  const s = await newScenario(), p = s.page;
  await openModule(p, "Transport & Dispatch");
  const row = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  await visible(row, "synthetic transport dispatch row");
  const status = row.locator("select");
  await status.selectOption("Running");
  if (await status.inputValue() !== "Running") throw new Error("Dispatch status did not update to Running.");
  await status.selectOption("Complete");
  if (await status.inputValue() !== "Complete") throw new Error("Dispatch status did not update to Complete.");
  await finishScenario(s, "Transport & Dispatch status Update");
}
async function qualityInspectionCrud() {
  const s = await newScenario(), p = s.page;
  const operation = fixture.operations[0];
  const characteristic = suffix + " Bore diameter";
  await openModule(p, "Quality Inspection");
  await p.getByLabel("PO component / operation").selectOption(operation.id);
  await p.getByPlaceholder("Bore diameter, flatness, length…").fill(characteristic);
  await p.getByLabel("Nominal value").fill("10");
  await p.getByLabel("Lower limit").fill("9.9");
  await p.getByLabel("Upper limit").fill("10.1");
  await p.getByPlaceholder("Actual reading").fill("10.02");
  await p.getByRole("button", { name: "Save measurement" }).click();
  const row = p.locator("tr").filter({ hasText: operation.name }).first();
  await visible(row, "quality inspection operation row");
  await visible(row.locator(".inspection-history-cell").filter({ hasText: characteristic }), "saved immutable inspection measurement");
  if (!(await row.locator(".inspection-history-cell").innerText()).includes("Pass")) throw new Error("Tolerance pass result was not calculated for the saved measurement.");
  const quantities = row.locator('input[type="number"]');
  await quantities.nth(0).fill("3");
  await quantities.nth(1).fill("2");
  await quantities.nth(2).fill("1");
  await row.locator("select").selectOption("Running");
  if (await quantities.nth(0).inputValue() !== "3" || await quantities.nth(1).inputValue() !== "2" || await quantities.nth(2).inputValue() !== "1") {
    throw new Error("Quality quantities did not update on the linked operation record.");
  }
  await finishScenario(s, "Quality Inspection measurement Add and linked operation Update");
}
async function costingQuoteCrud() {
  const s = await newScenario(), p = s.page;
  const quoteRef = suffix + "-QUOTE";
  await openModule(p, "Costing & Payment");
  await pick(p, "cost-company", fixture.company.name);
  await pick(p, "cost-po", fixture.purchaseOrder.number);
  await pick(p, "cost-po-line", fixture.component.partNumber);
  await pick(p, "cost-operation", fixture.operations[0].name);
  await p.getByRole("button", { name: "Add process quotation" }).click();
  const form = p.locator(".linked-quote-form");
  await visible(form, "new supplier quotation form");
  await form.getByLabel("Vendor / supplier *").selectOption("mp-vendor-machining");
  await form.getByPlaceholder("Supplier quote / email / RFQ reference").fill(quoteRef);
  await form.getByPlaceholder("Enter quote received").fill("456");
  await form.getByPlaceholder("Scope, exclusions, taxes, delivery terms, validity…").fill("Synthetic immutable quote history.");
  await form.getByRole("button", { name: "Save quotation" }).click();
  const row = p.locator("tr").filter({ hasText: quoteRef }).first();
  await visible(row, "saved supplier quotation");
  await row.getByRole("button", { name: "Use this rate" }).click();
  await p.waitForTimeout(150);
  if (!(await row.innerText()).includes("Selected")) throw new Error("Quotation was not marked Selected after applying its rate to the operation.");
  const quoteHistory = await p.evaluate(({ key, quoteRef }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.quotations || []).find(item => item.quoteReference === quoteRef);
  }, { key: seedKey, quoteRef });
  if (!quoteHistory || quoteHistory.status !== "Selected" || quoteHistory.ratePerPart !== 456) {
    throw new Error("Selected quotation was not persisted with the exact rate and status.");
  }
  await finishScenario(s, "Costing & Payment quotation Add/Save/Select");
}

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  await companyCrud();
  await componentCrud();
  await purchaseOrderCrud();
  await vendorCrud();
  await contact360Crud();
  await transportCrud();
  await processDirectoryCrud();
  await plannedCostCrud();
  await materialAndBomCrud();
  await followUpAssignmentCrud();
  await processMapOperationCrud();
  await dispatchStatusCrud();
  await qualityInspectionCrud();
  await costingQuoteCrud();
  console.log("AXIMACH CRUD browser acceptance passed: " + scenarioCount + " isolated scenarios.");
}
try {
  await main();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
