import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, acceptDownloads: true });
  await context.addInitScript(({ key, data }) => {
    // addInitScript runs in every tab and after every reload. Use an
    // origin-scoped localStorage sentinel so a fresh tab never reseeds and
    // overwrites the records whose persistence this scenario is verifying.
    if (localStorage.getItem("aximach.acceptance.seeded.v1") === "done") return;
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem("aximach.storage.mode", "local-only");
    localStorage.setItem("aximach.legacy-demo-cleanup.v2", "done");
    localStorage.setItem("aximach.acceptance.seeded.v1", "done");
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
  const picker = page.locator(".searchable-picker").filter({ has: input });
  const option = picker.locator('[role="listbox"] [role="option"]').filter({ hasText: query }).first();
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
async function chooseNativeScope(page, selector) {
  const values = [fixture.company.id, fixture.purchaseOrder.id, fixture.poLine.id];
  const selects = page.locator(selector + " select:visible");
  const count = await selects.count();
  if (count < 3) throw new Error("Expected at least three linked native scope selectors in " + selector + "; found " + count);
  for (let index = 0; index < values.length; index++) {
    await selects.nth(index).selectOption(values[index], { timeout: 8000 });
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(450);
}
const persistenceCollections = [
  "companies","factories","purchaseOrders","components","vendors","operations","quotations",
  "materials","componentParts","materialCostEntries","bomLines","materialProcessLinks",
  "inventoryTransactions","contactProfiles","processDefinitions","plannedCosts","transportRoutes",
  "transportLegs","paymentTransactions","inspectionMeasurements","routeRelationships","followUpAssignments"
];
const scenarioWorkspace = {
  "Company/Factory/Transport column filters": "Company Directory",
  "Company Directory Add/Edit/Save/Archive": "Company Directory",
  "Factory Directory Add/Edit/Save/Archive with parent company link": "Company Directory",
  "Component Directory Add/Edit/Save/Delete": "Component Directory",
  "Purchase Orders Add/Edit/Save/Delete with component line": "Purchase Orders",
  "Vendor Directory Add/Edit/Save/Archive": "Vendor Directory",
  "Contact 360 Add/Edit/Save/Delete": "Contact 360",
  "Transport Directory Add/Edit/Save/Archive": "Transport Directory",
  "Process Directory Add/Edit/Save/Archive": "Process Directory",
  "Component Planned Cost Add/Edit/Update/Archive": "Component Planned Cost",
  "Material Directory and BOM CRUD plus append-only Stock Receipt": "Material Directory",
  "Follow-up people assignment Add/Unlink": "Follow-up Centre",
  "Follow-up Centre server contact and schedule Create/Pause/Resume with opt-in": "Follow-up Centre",
  "Process Map Add/Edit/Payment ledger/Delete with history retention": "Production Plan & Process Plan",
  "Transport & Dispatch status Update": "Transport & Dispatch",
  "Quality Inspection measurement Add and linked operation Update": "Quality Inspection",
  "Costing & Payment quotation Add/Save/Select": "Costing & Payment",
  "Production Plan individual and bulk Finish/Reopen": "Production Plan & Process Plan",
  "Vendor Network capability filtering and vendor drill-through": "Vendor Network",
  "Route Flow typed relationship Add/Disable and PO-line persistence": "Route Flow & Relationships",
  "Data Exchange Centre validated import/export and JSON backup": "Data Exchange Centre",
  "Reports & Analytics saved-record metrics and CSV export": "Reports & Analytics",
  "AI Insights evidence rules and exact quality drill-through": "AI Insights"
};
async function readPersistenceSnapshot(page) {
  return page.evaluate(({ key, collections }) => {
    const raw = localStorage.getItem(key);
    if (!raw) return { error: "Manufacturing data key is missing after save.", state: null };
    let root;
    try { root = JSON.parse(raw); } catch { return { error: "Manufacturing data is not valid JSON.", state: null }; }
    const state = {};
    for (const name of collections) {
      const rows = Array.isArray(root[name]) ? root[name] : [];
      const ids = rows.map(row => String(row?.id || "")).filter(Boolean);
      if (ids.length !== new Set(ids).size) return { error: "Duplicate stable IDs found in " + name + ".", state: null };
      if (rows.some(row => !row?.id)) return { error: "A persisted " + name + " record has no stable ID.", state: null };
      state[name] = rows.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    }
    return { error: "", state };
  }, { key: seedKey, collections: persistenceCollections });
}
async function finishScenario(s, label) {
  if (s.pageErrors.length) throw new Error(label + " browser runtime errors: " + s.pageErrors.join(" | "));
  const moduleTitle = scenarioWorkspace[label];
  if (!moduleTitle) throw new Error("No persistence/reopen workspace configured for scenario: " + label);
  const before = await readPersistenceSnapshot(s.page);
  if (before.error) throw new Error(label + " persistence snapshot failed: " + before.error);
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await s.page.locator(".app-shell").waitFor({ state: "visible", timeout: 12000 });
  if (s.pageErrors.length) throw new Error(label + " browser runtime errors after reload: " + s.pageErrors.join(" | "));
  const afterReload = await readPersistenceSnapshot(s.page);
  if (afterReload.error) throw new Error(label + " persistence check after reload failed: " + afterReload.error);
  if (JSON.stringify(before.state) !== JSON.stringify(afterReload.state)) {
    throw new Error(label + " data changed or disappeared after page reload; stable IDs and full record values must persist.");
  }

  // Close the original tab and reopen the app in a new tab in the same isolated
  // browser context. This exercises origin storage rehydration independently
  // of the original page's in-memory React state and per-tab sessionStorage.
  await s.page.close();
  const reopenedPage = await s.context.newPage();
  reopenedPage.on("pageerror", error => s.pageErrors.push(error.message));
  reopenedPage.on("dialog", dialog => dialog.accept());
  await reopenedPage.goto(baseURL, { waitUntil: "domcontentloaded" });
  await reopenedPage.locator(".app-shell").waitFor({ state: "visible", timeout: 12000 });
  if (s.pageErrors.length) throw new Error(label + " browser runtime errors after fresh-tab reopen: " + s.pageErrors.join(" | "));
  const afterFreshTab = await readPersistenceSnapshot(reopenedPage);
  if (afterFreshTab.error) throw new Error(label + " fresh-tab persistence check failed: " + afterFreshTab.error);
  if (JSON.stringify(before.state) !== JSON.stringify(afterFreshTab.state)) {
    throw new Error(label + " data changed or disappeared after closing and reopening AXIMACH in a fresh tab.");
  }
  await openModule(reopenedPage, moduleTitle);
  if (s.pageErrors.length) throw new Error(label + " browser runtime errors after reopening " + moduleTitle + ": " + s.pageErrors.join(" | "));
  await s.context.close();
  scenarioCount++;
  console.log("PASS CRUD + reload + fresh-tab persistence: " + label + " → " + moduleTitle);
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

async function factoryCrud() {
  const s = await newScenario(), p = s.page;
  const factoryName = suffix + " Factory";
  await openModule(p, "Company Directory");
  await p.getByRole("button", { name: /Factories/ }).click();
  await p.getByRole("button", { name: "Add Factory" }).click();
  await pick(p, "factory-parent-company", fixture.company.name);
  await p.getByPlaceholder("Enter factory name").fill(factoryName);
  await p.getByRole("button", { name: "Save factory" }).click();
  let row = p.locator(".module-record-card").filter({ hasText: factoryName }).first();
  await visible(row, "new factory row");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const updatedFactory = factoryName + " Updated";
  await p.getByPlaceholder("Enter factory name").fill(updatedFactory);
  await p.getByRole("button", { name: "Save factory" }).click();
  row = p.locator(".module-record-card").filter({ hasText: updatedFactory }).first();
  await visible(row, "updated factory row");
  await row.getByRole("button", { name: "Archive", exact: true }).click();
  await p.waitForTimeout(200);
  if (await p.locator(".module-record-card").filter({ hasText: updatedFactory }).count()) {
    throw new Error("Archived factory remains in the active factory directory.");
  }
  const savedFactory = await p.evaluate(({ key, name }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.factories || []).find(item => item.name === name);
  }, { key: seedKey, name: updatedFactory });
  if (!savedFactory?.deletedAt || savedFactory.companyId !== fixture.company.id) {
    throw new Error("Factory archive must retain its record ID and parent company relationship.");
  }
  await finishScenario(s, "Factory Directory Add/Edit/Save/Archive with parent company link");
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
  await p.getByRole("button", { name: /Stock ledger/ }).click();
  await pick(p, "stock-item", code);
  await p.getByLabel("Transaction type").selectOption("Receipt");
  await p.getByLabel("Quantity *").fill("25");
  await pick(p, "stock-company", fixture.company.name);
  await pick(p, "stock-vendor", fixture.vendors[0].company);
  const receiptRef = suffix + "-GRN";
  await p.getByPlaceholder("Receipt, issue slip, challan, batch…").fill(receiptRef);
  await p.getByRole("button", { name: "Post movement" }).click();
  const movement = p.locator("tr").filter({ hasText: code }).filter({ hasText: receiptRef }).first();
  await visible(movement, "posted material receipt transaction");
  if (!(await movement.innerText()).includes("25")) throw new Error("Receipt quantity was not recorded in the stock ledger.");

  await p.getByRole("button", { name: /Material catalogue/ }).click();
  materialRow = p.locator("tr").filter({ hasText: code }).first();
  await visible(materialRow, "material row before archive");
  await materialRow.getByRole("button", { name: /Delete/ }).click();
  await p.waitForTimeout(150);
  if (await p.locator("tr").filter({ hasText: code }).count()) throw new Error("Archived material remains active.");
  const ledgerAfterArchive = await p.evaluate(({ key, code, receiptRef }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    const material = (root.materials || []).find(item => item.code === code);
    const receipt = (root.inventoryTransactions || []).find(item => item.reference === receiptRef);
    return { archived: Boolean(material?.deletedAt), receiptQuantity: receipt?.quantity, receiptType: receipt?.transactionType };
  }, { key: seedKey, code, receiptRef });
  if (!ledgerAfterArchive.archived || ledgerAfterArchive.receiptQuantity !== 25 || ledgerAfterArchive.receiptType !== "Receipt") {
    throw new Error("Material archive must retain its posted append-only stock receipt.");
  }
  await finishScenario(s, "Material Directory and BOM CRUD plus append-only Stock Receipt");
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
  await panel.getByRole("button", { name: "Close follow-up people" }).click();
  await panel.waitFor({ state: "detached", timeout: 5000 });
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
  // Re-select the linked masters explicitly before creating an operation. This
  // verifies the route selectors themselves and prevents a stale navigation
  // context from making the add action appear to do nothing.
  await pick(p, "route-company", fixture.company.name);
  await pick(p, "route-po", fixture.purchaseOrder.number);
  await pick(p, "route-component-line", fixture.component.partNumber);
  await visible(p.locator(".linked-component-summary").filter({ hasText: fixture.component.partNumber }), "selected Process Map component summary");
  // Open the menu from the toolbar that owns the rendered menu element;
  // the title-row Add Operation button is a separate toggle without a menu slot.
  await p.locator(".process-add-menu-anchor").first().locator('button[aria-label="Add operation ▾"]').click();
  const addMenu = p.locator(".process-add-menu-anchor").first().locator('[role="menu"]');
  await visible(addMenu, "Process Map add-operation menu");
  await addMenu.getByRole("menuitem", { name: "Blank process operation" }).click();
  const editor = p.getByRole("dialog", { name: "Add process operation" });
  try {
    await editor.waitFor({ state: "visible", timeout: 8000 });
  } catch {
    const noticeText = await p.locator(".notice-banner").allTextContents();
    const prerequisiteText = await p.locator(".process-add-prerequisite-note").allTextContents();
    const menuVisible = await addMenu.isVisible().catch(() => false);
    throw new Error("Process Map editor did not open. Notices: " + noticeText.join(" | ") + " Prerequisites: " + prerequisiteText.join(" | ") + " Add menu visible: " + menuVisible);
  }
  await customPick(p, "operation-category", category);
  await customPick(p, "operation-process-type", processName);
  await pick(p, "operation-execution-type", "Internal");
  await p.getByPlaceholder("Setup, process constraints, delivery instructions").fill("Initial synthetic operation record.");
  await editor.getByRole("button", { name: "Save operation", exact: true }).click();
  await p.waitForTimeout(250);
  let row = p.locator("tr.process-operation-row").filter({ hasText: processName }).first();
  if (!(await row.isVisible().catch(() => false))) {
    const notices = await p.locator(".notice-banner,[role=alert]").allTextContents();
    const editorVisible = await editor.isVisible().catch(() => false);
    const editorText = editorVisible ? (await editor.innerText()).slice(-1800) : "";
    throw new Error("Process Map save did not create operation row. Notices: " + notices.join(" | ") + " Editor still open: " + editorVisible + " Editor content: " + editorText);
  }
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
  await pick(p, "quote-actual-vendor", fixture.vendors.find(v => v.id === "mp-vendor-machining")?.company || "");
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

async function productionJobLifecycleCrud() {
  const s = await newScenario(), p = s.page;
  await openModule(p, "Production Plan & Process Plan");
  let row = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  await visible(row, "synthetic production job row");

  await row.getByRole("button", { name: "Finish", exact: true }).click();
  await p.waitForTimeout(150);
  row = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  if ((await row.locator(".record-state").innerText()).trim() !== "Job Finished") {
    throw new Error("Individual Finish did not mark the PO component job as Finished.");
  }
  await row.getByRole("button", { name: "Reopen", exact: true }).click();
  await p.waitForTimeout(150);
  row = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  if ((await row.locator(".record-state").innerText()).trim() !== "In Progress") {
    throw new Error("Individual Reopen did not restore the PO component job to In Progress.");
  }

  const jobCheckbox = row.getByRole("checkbox", { name: "Select " + fixture.purchaseOrder.number + " " + fixture.component.partNumber });
  await jobCheckbox.check();
  await p.getByRole("button", { name: "Finish selected jobs", exact: true }).click();
  await p.waitForTimeout(150);
  row = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  if ((await row.locator(".record-state").innerText()).trim() !== "Job Finished") {
    throw new Error("Bulk Finish selected jobs did not update the selected PO component job.");
  }

  await row.getByRole("checkbox", { name: "Select " + fixture.purchaseOrder.number + " " + fixture.component.partNumber }).check();
  await p.getByRole("button", { name: "Reopen selected jobs", exact: true }).click();
  await p.waitForTimeout(150);
  row = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  if ((await row.locator(".record-state").innerText()).trim() !== "In Progress") {
    throw new Error("Bulk Reopen selected jobs did not restore the PO component job.");
  }

  const lifecycle = await p.evaluate(({ key, poId, lineId }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    const po = (root.purchaseOrders || []).find(item => item.id === poId);
    const line = po?.lines.find(item => item.id === lineId);
    return {
      jobStatus: line?.jobStatus,
      operationStatuses: (root.operations || []).filter(item => item.poId === poId && item.poLineId === lineId).map(item => item.status)
    };
  }, { key: seedKey, poId: fixture.purchaseOrder.id, lineId: fixture.poLine.id });
  if (lifecycle.jobStatus !== "In progress") throw new Error("Final job lifecycle status was not persisted as In progress.");
  if (!lifecycle.operationStatuses.length || lifecycle.operationStatuses.some(status => status !== "Planned")) {
    throw new Error("Finishing/reopening the PO-line job must not rewrite individual process-operation statuses.");
  }
  await finishScenario(s, "Production Plan individual and bulk Finish/Reopen");
}

async function vendorNetworkFilterCrud() {
  const s = await newScenario(), p = s.page;
  await openModule(p, "Vendor Network");
  const table = p.locator("table.vendor-network-table");
  await visible(table, "Vendor Network capability table");
  const initialRows = await table.locator("tbody tr").count();
  if (initialRows !== fixture.vendors.length) {
    throw new Error("Vendor Network should initially show all six synthetic vendor records; found " + initialRows);
  }

  const search = p.getByPlaceholder("Search vendor company, contact, process, machine, material or assigned PO…");
  await search.fill(fixture.vendors[0].company);
  await p.waitForTimeout(100);
  if (await table.locator("tbody tr").count() !== 1 ||
      !(await table.locator("tbody tr").first().innerText()).includes(fixture.vendors[0].company)) {
    throw new Error("Vendor Network free-text search did not isolate the exact vendor record.");
  }

  await search.fill("");
  await p.getByLabel("Assigned vendors only").check();
  await p.waitForTimeout(100);
  const assignedRows = await table.locator("tbody tr").count();
  if (assignedRows !== 1 ||
      !(await table.locator("tbody tr").first().innerText()).includes("Synthetic CNC & VMC")) {
    throw new Error("Assigned vendors only must show the vendor with the fixture's linked Process Plan assignments.");
  }

  await p.getByRole("button", { name: "Clear filters", exact: true }).click();
  const machiningRow = table.locator("tbody tr").filter({ hasText: "Synthetic CNC & VMC" }).first();
  await visible(machiningRow, "assigned machining vendor row");
  await machiningRow.getByRole("button", { name: "Vendor", exact: true }).click();
  await visible(p.locator(".vendor-detail-title").filter({ hasText: "Synthetic CNC & VMC" }), "vendor-specific drill-through from Vendor Network");

  // Verify a real record-context round trip across Vendor Directory and Contact 360.
  await p.getByRole("button", { name: "Manage in Contact 360", exact: true }).click();
  const linkedVendorPicker = p.locator("#contact-linked-record");
  await visible(linkedVendorPicker, "Contact 360 preselected vendor link");
  const selectedVendorFixture = fixture.vendors.find(vendor => vendor.company === "Synthetic CNC & VMC");
  if (!selectedVendorFixture) throw new Error("Vendor Network fixture is missing the Synthetic CNC & VMC vendor.");
  const expectedVendorLabel = selectedVendorFixture.company + " · " + selectedVendorFixture.contact;
  if (await linkedVendorPicker.inputValue() !== expectedVendorLabel) {
    throw new Error("Vendor Directory → Contact 360 did not display the selected vendor's company and contact: " + await linkedVendorPicker.inputValue());
  }
  await linkedVendorPicker.click();
  const selectedVendorOption = p.locator('[role="option"][aria-selected="true"]').filter({ hasText: expectedVendorLabel });
  await visible(selectedVendorOption, "exact selected vendor option in Contact 360");
  if (await selectedVendorOption.getAttribute("aria-selected") !== "true") {
    throw new Error("Vendor Directory → Contact 360 displayed the vendor label but did not select the matching stable vendor ID.");
  }
  await linkedVendorPicker.press("Escape");
  if (await p.getByLabel("Relationship type").inputValue() !== "vendor") {
    throw new Error("Vendor Directory → Contact 360 did not preserve the vendor relationship type.");
  }

  const crossModuleContact = suffix + " Cross-module vendor contact";
  await p.getByPlaceholder("Full name").fill(crossModuleContact);
  await p.getByRole("button", { name: "Save contact", exact: true }).click();
  await visible(p.locator("article.contact360-row").filter({ hasText: crossModuleContact }), "new Contact 360 person linked to the selected vendor");

  const generatedVendorContact = p.locator("article.contact360-row").filter({ hasText: selectedVendorFixture.contact }).first();
  await visible(generatedVendorContact, "vendor master contact inside Contact 360");
  await generatedVendorContact.getByRole("button", { name: "Open master", exact: true }).click();
  await visible(p.locator(".vendor-detail-title").filter({ hasText: "Synthetic CNC & VMC" }), "Contact 360 → exact originating Vendor Directory record");
  const selectedVendorCard = p.locator(".vendor-record-active");
  await visible(selectedVendorCard.filter({ hasText: "Synthetic CNC & VMC" }), "same vendor remains selected after Contact 360 return");
  await finishScenario(s, "Vendor Network capability filtering and vendor drill-through");
}

async function dataExchangeCrud() {
  const s = await newScenario(), p = s.page;
  const importedName = suffix + " Imported Company";
  const importTab = p.getByRole("tab", { name: /Import and validate/ });
  await openModule(p, "Data Exchange Centre");
  await visible(importTab, "Data Exchange import tab");
  await importTab.click();

  await p.getByLabel("Import type").selectOption("companies");
  const fileInput = p.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "invalid-companies.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("gstin,phone\nINVALID-GST,9000000000\n")
  });
  await p.getByRole("button", { name: "Validate & preview", exact: true }).click();
  await visible(p.locator(".notice-banner").filter({ hasText: "required field missing" }), "failed import validation message");
  const commitButton = p.getByRole("button", { name: "Commit import", exact: true });
  if (!(await commitButton.isDisabled())) {
    throw new Error("Commit import remained enabled after required company fields failed validation.");
  }
  const beforeInvalidCommit = await p.evaluate(key => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.companies || []).length;
  }, seedKey);
  if (beforeInvalidCommit !== seededData.companies.length) {
    throw new Error("Invalid CSV validation changed the live company directory.");
  }

  const validCsv = [
    "name,gstin,contactPerson,phone,email,address",
    importedName + ",AXIMACH-" + suffix + ",Acceptance Contact,919900001111,acceptance@example.invalid,Synthetic Test Site",
    importedName + ",AXIMACH-" + suffix + ",Acceptance Contact,919900001111,acceptance@example.invalid,Synthetic Test Site"
  ].join("\n");
  await fileInput.setInputFiles({
    name: "valid-companies.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(validCsv)
  });
  await p.getByRole("button", { name: "Validate & preview", exact: true }).click();
  await visible(p.locator(".costing-table").filter({ hasText: importedName }), "valid company import preview");
  if (await commitButton.isDisabled()) throw new Error("A valid company CSV should enable Commit import.");
  await commitButton.click();
  await visible(p.locator(".notice-banner").filter({ hasText: "Import committed. Added 1 record(s); skipped 1 duplicate" }), "company CSV import result");
  const importedCompanies = await p.evaluate(({ key, name }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.companies || []).filter(item => item.name === name && !item.deletedAt);
  }, { key: seedKey, name: importedName });
  if (importedCompanies.length !== 1 || importedCompanies[0].gstin !== "AXIMACH-" + suffix) {
    throw new Error("CSV import must add one stable company and skip the duplicate row.");
  }

  await p.getByRole("tab", { name: /Export records/ }).click();
  await p.getByLabel("Module to export").selectOption("companies");
  const csvDownloadPromise = p.waitForEvent("download", { timeout: 12000 });
  await p.getByRole("button", { name: "CSV", exact: true }).click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = await csvDownload.path();
  if (!csvPath) throw new Error("Company CSV export did not produce a downloadable file.");
  const csvText = readFileSync(csvPath, "utf8");
  if (!csvText.includes(importedName) || !csvText.includes(fixture.company.name)) {
    throw new Error("Exported company CSV omitted the imported or pre-existing company record.");
  }

  const excelDownloadPromise = p.waitForEvent("download", { timeout: 12000 });
  await p.getByRole("button", { name: /Excel workbook/ }).click();
  const excelDownload = await excelDownloadPromise;
  const excelPath = await excelDownload.path();
  if (!excelPath) throw new Error("Company Excel export did not produce a downloadable file.");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(excelPath));
  const sheet = workbook.worksheets[0];
  if (!sheet || !JSON.stringify(sheet.getSheetValues()).includes(importedName)) {
    throw new Error("Exported XLSX workbook did not contain the imported company data.");
  }

  const jsonDownloadPromise = p.waitForEvent("download", { timeout: 12000 });
  await p.getByRole("button", { name: "Full JSON backup", exact: true }).click();
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  if (!jsonPath) throw new Error("Full JSON backup export did not produce a downloadable file.");
  const backupText = readFileSync(jsonPath, "utf8");
  if (backupText.charCodeAt(0) === 0xfeff) throw new Error("Full JSON backup must be exported without a UTF-8 BOM.");
  const backup = JSON.parse(backupText);
  if (!Array.isArray(backup.companies) ||
      !backup.companies.some(item => item.name === importedName) ||
      !Array.isArray(backup.purchaseOrders) ||
      !backup.moduleStores) {
    throw new Error("Full JSON backup omitted required manufacturing or module-store data.");
  }

  await p.getByRole("tab", { name: /Import and validate/ }).click();
  await p.getByLabel("Import type").selectOption("backup");
  await fileInput.setInputFiles({
    name: "AXIMACH-roundtrip-backup.json",
    mimeType: "application/json",
    // Import a BOM-prefixed copy to verify the JSON parser accepts common UTF-8 backup files.
    buffer: Buffer.concat([Buffer.from("\uFEFF", "utf8"), readFileSync(jsonPath)])
  });
  await p.getByRole("button", { name: "Validate & preview", exact: true }).click();
  await visible(p.locator(".costing-table").filter({ hasText: "moduleStores" }), "AXIMACH backup collection summary preview");
  await p.getByRole("button", { name: "Commit import", exact: true }).click();
  await visible(p.locator(".notice-banner").filter({ hasText: "AXIMACH backup merged by record ID" }), "AXIMACH JSON backup import result");
  const roundTrip = await p.evaluate(({ key, name }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return {
      importedCount: (root.companies || []).filter(item => item.name === name && !item.deletedAt).length,
      totalCompanies: (root.companies || []).filter(item => !item.deletedAt).length
    };
  }, { key: seedKey, name: importedName });
  if (roundTrip.importedCount !== 1 || roundTrip.totalCompanies !== seededData.companies.length + 1) {
    throw new Error("JSON backup merge did not remain ID-stable and duplicate-safe: " + JSON.stringify(roundTrip));
  }

  await finishScenario(s, "Data Exchange Centre validated import/export and JSON backup");
}

async function followUpSchedulerUiCrud() {
  const s = await newScenario(), p = s.page;
  const base = baseURL;
  const mockContacts = [
    { id: "mock-contact-no-opt-in", name: "Synthetic Contact Without Consent", phone: "919000001111", company: "Synthetic Test Vendor", optedIn: false, createdAt: "2026-01-01T09:00:00.000Z" },
    { id: "mock-contact-opted-in", name: "Synthetic Existing Opted-in Contact", phone: "919000001234", company: "Synthetic Test Vendor", optedIn: true, createdAt: "2026-01-01T09:00:00.000Z" }
  ];
  const mockSchedules = [];
  let mockManufacturingData = seededData;
  let scheduleCounter = 0;

  // Use a same-origin mock scheduler API: this tests the real Follow-up Centre
  // connection and form handlers without contacting Meta, WhatsApp or a real
  // contact. Server persistence and consent are separately covered by the
  // isolated server/index.test.mjs integration test.
  await s.context.route("**/health", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, storage: "test" })
  }));
  await s.context.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const respond = (status, value) => route.fulfill({
      status, contentType: "application/json", body: JSON.stringify(value)
    });
    if (url.pathname === "/api/manufacturing-data") {
      if (method === "GET") return respond(200, { data: mockManufacturingData });
      if (method === "PUT") {
        const body = JSON.parse(request.postData() || "{}");
        mockManufacturingData = body.data || mockManufacturingData;
        return respond(200, { data: mockManufacturingData });
      }
    }
    if (url.pathname === "/api/contacts" && method === "GET") return respond(200, { contacts: mockContacts });
    if (url.pathname === "/api/contacts" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      const contact = {
        id: "mock-contact-created-" + (mockContacts.length + 1),
        name: body.name, phone: String(body.phone || "").replace(/\D/g, ""),
        company: body.company || "", optedIn: body.optedIn === true,
        createdAt: new Date().toISOString()
      };
      mockContacts.push(contact);
      return respond(201, { contact });
    }
    if (url.pathname === "/api/schedules" && method === "GET") return respond(200, { schedules: mockSchedules, logs: [] });
    if (url.pathname === "/api/schedules" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      const schedule = {
        id: "mock-schedule-" + (++scheduleCounter),
        to: String(body.to || "").replace(/\D/g, ""),
        message: body.message || "", nextRunAt: body.nextRunAt || null,
        repeat: body.repeat || "once", enabled: true, lastRunAt: null, lastError: "",
        vendorId: body.vendorId || "", operationId: body.operationId || "",
        process: body.process || "", company: body.company || ""
      };
      mockSchedules.unshift(schedule);
      return respond(201, { schedule });
    }
    const scheduleMatch = url.pathname.match(/^\/api\/schedules\/([\w-]+)$/);
    if (scheduleMatch && method === "PATCH") {
      const schedule = mockSchedules.find(row => row.id === scheduleMatch[1]);
      if (!schedule) return respond(404, { error: "Schedule not found." });
      const body = JSON.parse(request.postData() || "{}");
      if (typeof body.enabled === "boolean") schedule.enabled = body.enabled;
      if (body.nextRunAt) schedule.nextRunAt = body.nextRunAt;
      return respond(200, { schedule });
    }
    return route.continue();
  });

  await p.evaluate(({ base, key }) => {
    localStorage.setItem("aximach.storage.mode", "shared-server");
    localStorage.setItem("aximach.scheduler.url", base);
    localStorage.setItem("aximach.scheduler.key", key);
  }, { base, key: "synthetic-acceptance-key" });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.locator(".app-shell").waitFor({ state: "visible", timeout: 12000 });
  await openModule(p, "Follow-up Centre");
  const connect = p.getByRole("button", { name: "Connect / refresh shared data", exact: true });
  await visible(connect, "Follow-up Centre scheduler connection action");
  await connect.click();
  await p.getByText("CONNECTED", { exact: true }).waitFor({ state: "visible", timeout: 8000 });

  const addContactPanel = p.locator("section.scheduler-form-panel").filter({ hasText: "Add contact" }).first();
  await visible(addContactPanel, "server contact form");
  await addContactPanel.getByLabel("Contact name").fill("Synthetic New Opted-in Contact");
  await addContactPanel.getByLabel("Phone with country code").fill("919000001555");
  await addContactPanel.getByLabel("Company").fill("Synthetic Test Vendor");
  const consent = addContactPanel.getByLabel("I have verified this person opted in to WhatsApp messages.");
  const saveContact = addContactPanel.getByRole("button", { name: "Save server contact", exact: true });
  if (await saveContact.isEnabled()) throw new Error("Follow-up Centre allowed saving a server contact before opt-in confirmation.");
  await consent.check();
  await saveContact.click();
  await visible(addContactPanel.locator(".scheduler-contact").filter({ hasText: "Synthetic New Opted-in Contact" }), "saved opted-in server contact");

  const automationPanel = p.locator("section.scheduler-form-panel").filter({ hasText: "Message automation" }).first();
  await visible(automationPanel, "server-backed message automation form");
  const recipient = automationPanel.getByLabel("Recipient");
  const unconsented = recipient.locator("option").filter({ hasText: "Synthetic Contact Without Consent" });
  if (await unconsented.count()) throw new Error("A contact without opt-in was offered as an individual schedule recipient.");
  await recipient.selectOption("919000001555");
  await automationPanel.getByPlaceholder("Write the message to send…").fill("Synthetic AXIMACH operation status check.");
  const due = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const localDue = new Date(due.getTime() - due.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await automationPanel.getByLabel("First send time").fill(localDue);
  await automationPanel.getByLabel("Repeat").selectOption("weekly");
  await automationPanel.getByRole("button", { name: "Save schedule on server", exact: true }).click();

  const scheduleRow = p.locator(".followup-table tbody tr").filter({ hasText: "919000001555" }).first();
  await visible(scheduleRow, "created weekly follow-up schedule");
  if (!(await scheduleRow.innerText()).includes("weekly") ||
      !(await scheduleRow.innerText()).includes("Synthetic AXIMACH operation status check.")) {
    throw new Error("Follow-up Centre did not display the saved schedule recurrence and message.");
  }
  const savedSchedule = mockSchedules.find(row => row.to === "919000001555");
  if (!savedSchedule || savedSchedule.enabled !== true || savedSchedule.repeat !== "weekly") {
    throw new Error("Follow-up Centre schedule create action did not POST the expected recipient, recurrence and enabled state.");
  }

  await scheduleRow.getByRole("button", { name: "Pause", exact: true }).click();
  if (mockSchedules[0].enabled !== false) throw new Error("Follow-up Centre Pause action did not update the scheduler API.");
  await scheduleRow.getByRole("button", { name: "Enable", exact: true }).click();
  if (mockSchedules[0].enabled !== true) throw new Error("Follow-up Centre Enable action did not resume the scheduler API.");

  await finishScenario(s, "Follow-up Centre server contact and schedule Create/Pause/Resume with opt-in");
}

async function routeFlowRelationshipCrud() {
  const s = await newScenario(), p = s.page;
  await openModule(p, "Route Flow & Relationships");
  await chooseNativeScope(p, ".route-flow-scope-bar");
  await p.getByRole("button", { name: "Add relationship", exact: true }).click();
  const editor = p.locator(".route-flow-editor-panel");
  await visible(editor, "Route Flow relationship editor");

  const fromOperation = fixture.operations[0];
  const toOperation = fixture.operations[1];
  await p.getByLabel("From process").selectOption(fromOperation.id);
  await p.getByLabel("To process").selectOption(toOperation.id);
  await p.getByLabel("Relationship type").selectOption("conditional");
  await p.getByLabel("Link status").selectOption("Planned");
  const condition = suffix + " inspection accepted";
  await p.getByLabel("Condition / rule").fill(condition);
  const notes = suffix + " conditional route link";
  await p.getByLabel("Notes").fill(notes);
  await editor.getByRole("button", { name: "Save relationship", exact: true }).click();

  const savedLink = p.locator(".route-flow-saved-link")
    .filter({ hasText: fromOperation.name })
    .filter({ hasText: toOperation.name })
    .filter({ hasText: condition })
    .first();
  await visible(savedLink, "saved conditional relationship in Route Flow");
  const saved = await p.evaluate(({ key, fromId, toId }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    return (root.routeRelationships || []).find(row =>
      row.fromOperationId === fromId &&
      row.toOperationId === toId &&
      row.relationshipType === "conditional" &&
      row.notes.includes("conditional route link")
    ) || null;
  }, { key: seedKey, fromId: fromOperation.id, toId: toOperation.id });
  if (!saved ||
      saved.poId !== fixture.purchaseOrder.id ||
      saved.poLineId !== fixture.poLine.id ||
      saved.componentId !== fixture.component.id ||
      saved.status !== "Planned" ||
      saved.condition !== condition) {
    throw new Error("Route Flow did not persist the typed relationship against the exact PO-line and operation IDs: " + JSON.stringify(saved));
  }

  await savedLink.getByRole("button", { name: "Disable", exact: true }).click();
  const disabled = await p.evaluate(({ key, id }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    const row = (root.routeRelationships || []).find(item => item.id === id);
    return row ? { id: row.id, status: row.status, fromOperationId: row.fromOperationId, toOperationId: row.toOperationId } : null;
  }, { key: seedKey, id: saved.id });
  if (!disabled || disabled.id !== saved.id || disabled.status !== "Disabled" ||
      disabled.fromOperationId !== fromOperation.id || disabled.toOperationId !== toOperation.id) {
    throw new Error("Disabling a Route Flow relationship must retain the same historical record ID and operation endpoints.");
  }
  await visible(savedLink.getByText(/Disabled/), "disabled relationship state retained in Route Flow");

  await finishScenario(s, "Route Flow typed relationship Add/Disable and PO-line persistence");
}

async function reportsAnalyticsReadOnly() {
  const s = await newScenario(), p = s.page;
  await openModule(p, "Reports & Analytics");

  const assertMetric = async (label, expected) => {
    const card = p.locator("article.metric-card").filter({ hasText: label }).first();
    await visible(card, "Reports & Analytics metric: " + label);
    const actual = (await card.locator(".metric-number").innerText()).trim();
    if (actual !== String(expected)) {
      throw new Error("Reports & Analytics " + label + " should reflect " + expected + " saved record(s); found " + actual + ".");
    }
  };
  await assertMetric("Companies", seededData.companies.length);
  await assertMetric("Purchase orders", seededData.purchaseOrders.length);
  await assertMetric("PO component lines", seededData.purchaseOrders.reduce((sum, po) => sum + po.lines.length, 0));
  await assertMetric("Vendors", seededData.vendors.length);
  await assertMetric("Process operations", seededData.operations.length);

  // Reporting drill-through must open the live production register, not a
  // generic module-local record list.
  await p.getByRole("button", { name: /Open Production Plan/ }).click();
  await p.locator(".page-content h1").filter({ hasText: "Production Plan" }).waitFor({ state: "visible", timeout: 8000 });
  const job = p.locator("tr").filter({ hasText: fixture.purchaseOrder.number }).filter({ hasText: fixture.component.partNumber }).first();
  await visible(job, "production job reached from Reports & Analytics");

  await openModule(p, "Reports & Analytics");
  await p.locator(".intelligence-export-row select").selectOption("purchaseOrders");
  const csvPromise = p.waitForEvent("download", { timeout: 12000 });
  await p.getByRole("button", { name: "Export CSV", exact: true }).click();
  const csv = await csvPromise;
  const csvPath = await csv.path();
  if (!csvPath) throw new Error("Reports & Analytics did not produce a CSV download.");
  const csvText = readFileSync(csvPath, "utf8");
  if (!csvText.includes(fixture.purchaseOrder.number) || !csvText.includes(fixture.component.partNumber)) {
    throw new Error("PO component report omitted its saved PO or component identity.");
  }

  await finishScenario(s, "Reports & Analytics saved-record metrics and CSV export");
}

async function aiInsightsEvidenceDrillThrough() {
  const s = await newScenario(), p = s.page;
  const qualityOperation = fixture.operations[0];
  const unassignedOperation = fixture.operations[1];
  const completedOperation = fixture.operations[2];

  // Create isolated synthetic evidence for each deterministic insight rule.
  // This changes only this browser context's local acceptance fixture.
  await p.evaluate(({ key, qualityId, unassignedId, completedId, poId, lineId }) => {
    const root = JSON.parse(localStorage.getItem(key) || "{}");
    const quality = (root.operations || []).find(row => row.id === qualityId);
    const unassigned = (root.operations || []).find(row => row.id === unassignedId);
    const completed = (root.operations || []).find(row => row.id === completedId);
    const po = (root.purchaseOrders || []).find(row => row.id === poId);
    const line = po?.lines?.find(row => row.id === lineId);
    if (!quality || !unassigned || !completed || !po || !line) {
      throw new Error("AI Insights synthetic fixture is missing a linked operation, PO or PO line.");
    }
    quality.status = "Quality hold";
    unassigned.vendorId = "";
    unassigned.transportVendorId = "";
    completed.status = "Complete";
    completed.actualEnd = "2026-01-08";
    po.targetDelivery = "";
    line.targetDelivery = "";
    localStorage.setItem(key, JSON.stringify(root));
  }, {
    key: seedKey,
    qualityId: qualityOperation.id,
    unassignedId: unassignedOperation.id,
    completedId: completedOperation.id,
    poId: fixture.purchaseOrder.id,
    lineId: fixture.poLine.id
  });
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.locator(".app-shell").waitFor({ state: "visible", timeout: 12000 });
  await openModule(p, "AI Insights");

  const findings = p.locator("article.specialized-record");
  await visible(findings.filter({ hasText: "Operation is past its planned target" }).first(), "overdue-operation insight");
  const qualityFinding = findings.filter({ hasText: "Quality hold requires disposition" }).first();
  await visible(qualityFinding, "quality-hold insight");
  await visible(findings.filter({ hasText: "Process operation has no vendor assigned" }).first(), "unassigned-vendor insight");
  await visible(findings.filter({ hasText: "PO component line has no delivery target" }).first(), "missing-delivery-target insight");
  await visible(findings.filter({ hasText: "All or some process steps are complete; job closure not confirmed" }).first(), "job-closure insight");

  // The finding must preserve the exact PO-line and operation IDs into Quality.
  await qualityFinding.getByRole("button", { name: /Open quality inspection/ }).click();
  await p.locator(".page-content h1").filter({ hasText: "Quality Inspection" }).waitFor({ state: "visible", timeout: 8000 });
  const operationPicker = p.getByLabel("PO component / operation");
  await visible(operationPicker, "context-filtered quality operation picker");
  if (await operationPicker.inputValue() !== qualityOperation.id) {
    throw new Error("AI Insights → Quality Inspection did not retain the exact originating operation ID.");
  }
  const visibleOperations = p.locator(".operations-workspace .costing-table tbody tr");
  if (await visibleOperations.count() !== 1) {
    throw new Error("AI Insights → Quality Inspection should filter to the one originating operation; found " + await visibleOperations.count() + ".");
  }
  const operationRow = visibleOperations.first();
  const rowText = await operationRow.innerText();
  if (!rowText.includes(fixture.purchaseOrder.number) || !rowText.includes(fixture.component.partNumber) || !rowText.includes(qualityOperation.name)) {
    throw new Error("AI Insights → Quality Inspection lost the source PO, component or operation identity.");
  }

  await finishScenario(s, "AI Insights evidence rules and exact quality drill-through");
}

async function masterColumnFilterAcceptance() {
  const s = await newScenario(), p = s.page;
  const companyName = suffix + " Filter Company";
  const gstin = "29FILTER1234A1Z5";
  const contactName = suffix + " Filter Contact";
  const phone = "+91 9876501234";
  const email = "filters@aximach.invalid";
  const address = suffix + " Filter Address";
  await openModule(p, "Company Directory");

  await p.getByRole("button", { name: "Add Company" }).click();
  await p.getByPlaceholder("Enter your actual registered company name").fill(companyName);
  await p.getByPlaceholder("Optional", { exact: true }).fill(gstin);
  await p.getByPlaceholder("Primary contact person").fill(contactName);
  await p.getByPlaceholder("Country code + number").fill(phone);
  await p.getByPlaceholder("Accounts / contact email").fill(email);
  await p.getByPlaceholder("Registered / business address").fill(address);
  await p.getByRole("button", { name: "Save company" }).click();
  await visible(p.locator(".module-record-card").filter({ hasText: companyName }), "second company for column-filter acceptance");

  async function excludeMultiOption(id, label, excludedValue) {
    const trigger = p.locator("#" + id);
    await visible(trigger, label + " filter trigger");
    await trigger.click();
    const menu = p.locator(".ax-search-multi-menu").last();
    await visible(menu, label + " filter menu");
    const search = menu.getByRole("textbox", { name: "Search " + label });
    await search.fill(excludedValue);
    const options = menu.locator("label").filter({ hasText: excludedValue });
    const optionCount = await options.count();
    if (!optionCount) throw new Error(label + " option not found: " + excludedValue);
    for (let index = 0; index < optionCount; index++) {
      const checkbox = options.nth(index).locator('input[type="checkbox"]');
      if (await checkbox.isChecked()) await checkbox.uncheck();
    }
    await menu.getByRole("button", { name: "Done", exact: true }).click();
    await p.waitForTimeout(100);
  }
  async function clearMultiOption(id, label) {
    await p.locator("#" + id).click();
    const menu = p.locator(".ax-search-multi-menu").last();
    await visible(menu, label + " filter menu for clear");
    await menu.getByRole("button", { name: "Clear", exact: true }).click();
    await menu.getByRole("button", { name: "Done", exact: true }).click();
    await p.waitForTimeout(100);
  }
  async function assertOnlyCard(expected, label) {
    const cards = p.locator(".module-record-card");
    const count = await cards.count();
    if (count !== 1 || !(await cards.first().innerText()).includes(expected)) {
      throw new Error(label + " did not isolate " + expected + "; found " + count + " record card(s).");
    }
  }

  await excludeMultiOption("company-filter-name", "Company name", fixture.company.name);
  await assertOnlyCard(companyName, "Company name filter");
  await clearMultiOption("company-filter-name", "Company name");
  await excludeMultiOption("company-filter-gstin", "GSTIN", "—");
  await assertOnlyCard(companyName, "GSTIN filter");
  await clearMultiOption("company-filter-gstin", "GSTIN");
  await excludeMultiOption("company-filter-contact", "Contact person", fixture.company.contactPerson || "—");
  await assertOnlyCard(companyName, "Company contact filter");
  await clearMultiOption("company-filter-contact", "Contact person");
  await excludeMultiOption("company-filter-phone", "Phone", "—");
  await assertOnlyCard(companyName, "Company phone filter");
  await clearMultiOption("company-filter-phone", "Phone");
  await excludeMultiOption("company-filter-email", "Email", fixture.company.email || "—");
  await assertOnlyCard(companyName, "Company email filter");
  await clearMultiOption("company-filter-email", "Email");
  await excludeMultiOption("company-filter-address", "Address", fixture.company.address || "—");
  await assertOnlyCard(companyName, "Company address filter");
  await clearMultiOption("company-filter-address", "Address");

  await p.getByRole("button", { name: /Factories/ }).click();
  const factoryName = suffix + " Filter Factory";
  const factoryAddress = suffix + " Factory Address";
  const factoryPhone = "+91 9876505678";
  await p.getByRole("button", { name: "Add Factory" }).click();
  await pick(p, "factory-parent-company", companyName);
  await p.getByPlaceholder("Enter factory name").fill(factoryName);
  await p.getByPlaceholder("Factory address").fill(factoryAddress);
  await p.getByRole("textbox", { name: "Factory contact phone" }).fill(factoryPhone);
  await p.getByRole("button", { name: "Save factory" }).click();
  await visible(p.locator(".module-record-card").filter({ hasText: factoryName }), "second factory for column-filter acceptance");
  await excludeMultiOption("factory-filter-name", "Factory name", fixture.factory.name);
  await assertOnlyCard(factoryName, "Factory name filter");
  await clearMultiOption("factory-filter-name", "Factory name");
  await excludeMultiOption("factory-filter-company", "Parent company", fixture.company.name);
  await assertOnlyCard(factoryName, "Factory parent-company filter");
  await clearMultiOption("factory-filter-company", "Parent company");
  await excludeMultiOption("factory-filter-address", "Address", fixture.factory.address || "—");
  await assertOnlyCard(factoryName, "Factory address filter");
  await clearMultiOption("factory-filter-address", "Address");
  await excludeMultiOption("factory-filter-phone", "Contact phone", "—");
  await assertOnlyCard(factoryName, "Factory contact-phone filter");
  await clearMultiOption("factory-filter-phone", "Contact phone");

  await openModule(p, "Transport Directory");
  const routeOneFrom = suffix + " Route One Pickup", routeOneTo = suffix + " Route One Delivery";
  const routeTwoFrom = suffix + " Route Two Pickup", routeTwoTo = suffix + " Route Two Delivery";
  for (const [from, to, amount] of [[routeOneFrom, routeOneTo, "101"], [routeTwoFrom, routeTwoTo, "202"]]) {
    await pick(p, "transport-route-vendor", fixture.vendors[5].company);
    await p.getByPlaceholder("Pickup location").fill(from);
    await p.getByPlaceholder("Delivery location").fill(to);
    await p.getByPlaceholder("Enter agreed route rate").fill(amount);
    await p.getByRole("button", { name: "Add route rate" }).click();
    await visible(p.locator("tr").filter({ hasText: from }).filter({ hasText: to }), "saved route " + from);
  }
  const routeRows = p.locator("table.costing-table tbody tr");
  const initialRouteCount = await routeRows.count() - 2;
  const excludedRoutes = [
    ...fixture.transportRoutes.map(route => route.fromLocation + " → " + route.toLocation),
    routeTwoFrom + " → " + routeTwoTo
  ];
  for (const routeLabel of excludedRoutes) {
    await excludeMultiOption("transport-filter-route", "Route (from → to)", routeLabel);
  }
  if (await routeRows.count() !== 1 || !(await routeRows.first().innerText()).includes(routeOneFrom)) {
    throw new Error("Transport route selector did not isolate the selected from/to route; found " + await routeRows.count() + " row(s).");
  }
  await clearMultiOption("transport-filter-route", "Route (from → to)");
  if (await routeRows.count() !== initialRouteCount + 2) throw new Error("Clearing the route selector did not restore all original and newly saved transport routes.");

  await openModule(p, "Company Directory");
  await finishScenario(s, "Company/Factory/Transport column filters");
}

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  await masterColumnFilterAcceptance();
  await companyCrud();
  await factoryCrud();
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
  await productionJobLifecycleCrud();
  await vendorNetworkFilterCrud();
  await followUpSchedulerUiCrud();
  await routeFlowRelationshipCrud();
  await dataExchangeCrud();
  await reportsAnalyticsReadOnly();
  await aiInsightsEvidenceDrillThrough();
  console.log("AXIMACH CRUD browser acceptance passed: " + scenarioCount + " isolated scenarios.");
}
try {
  await main();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}