import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:4179";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/aximach-one-component-multipart-route.json", import.meta.url), "utf8"));
const now = fixture.company.createdAt;
const seededData = {
  updatedAt: now,
  companies: [fixture.company],
  factories: [fixture.factory],
  purchaseOrders: [fixture.purchaseOrder],
  components: [fixture.component],
  vendors: fixture.vendors.map((vendor,index)=>({
    ...vendor,
    phone:"91987654000"+(index+1),
    whatsappNumber:"91987654000"+(index+1)
  })),
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

const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4179", "--strictPort"], {
  stdio: "inherit",
  env: { ...process.env, BROWSER: "none" }
});
let browser;

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(baseURL);
      if (response.ok) return;
    } catch {}
    await delay(1000);
  }
  throw new Error("Vite did not become ready at " + baseURL);
}

async function assertWorkspace(page, label) {
  await page.locator(".app-shell").waitFor({ state: "visible", timeout: 12000 });
  const result = await page.evaluate(name => {
    const root = document.querySelector("#root");
    const shell = document.querySelector(".app-shell");
    const fatal = document.querySelector('[data-aximach-startup-error="true"]');
    const text = (root?.innerText || "").trim();
    if (!root || !shell || fatal || text.length < 10) throw new Error(name + ": blank screen or application startup error");
    return { textLength: text.length, heading: document.querySelector(".page-content h1,.page-content h2")?.textContent?.trim() || "" };
  }, label);
  if (!result.textLength) throw new Error(label + ": no workspace content");
  return result;
}

async function openModule(page, title) {
  const nav = page.locator('nav[aria-label="AXIMACH navigation"]');
  const button = nav.locator('button[title="' + title.replaceAll('"', '\\"') + '"]');
  await button.waitFor({ state: "attached", timeout: 8000 });
  // Some immersive workspaces deliberately cover the navigation rail. Dispatch the
  // actual registered navigation control rather than relying on pointer visibility.
  await button.evaluate(element => element.click());
  await page.waitForTimeout(300);
  await assertWorkspace(page, title);
}

async function chooseSearchablePicker(page, id, text) {
  const input = page.locator("#" + id);
  await input.waitFor({ state: "visible", timeout: 8000 });
  await input.fill(text);
  const option = page.getByRole("option", { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).first();
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();
}

async function chooseProcessMapScope(page) {
  await chooseSearchablePicker(page, "route-company", fixture.company.name);
  await chooseSearchablePicker(page, "route-po", fixture.purchaseOrder.number);
  await chooseSearchablePicker(page, "route-component-line", fixture.component.partNumber);
  await page.waitForTimeout(450);
}

async function chooseNativeScope(page, scopeSelector) {
  const values = [fixture.company.id, fixture.purchaseOrder.id, fixture.poLine.id];
  const selects = page.locator(scopeSelector + " select:visible");
  const count = await selects.count();
  if (count < 3) throw new Error("Expected at least three linked native scope selectors in " + scopeSelector + "; found " + count);
  for (let i = 0; i < values.length; i++) {
    await selects.nth(i).selectOption(values[i], { timeout: 8000 });
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(450);
}


async function assertVendorContactLinks(dialog, vendorId, label) {
  const vendor = seededData.vendors.find(row => row.id === vendorId);
  if (!vendor) throw new Error(label + " references an unknown vendor ID: " + vendorId);
  const links = await dialog.locator(".ax-transport-contact-links a").evaluateAll(nodes =>
    nodes.map(node => ({
      href: node.getAttribute("href") || "",
      target: node.getAttribute("target") || "",
      rel: node.getAttribute("rel") || ""
    }))
  );
  const expected = [
    "tel:" + vendor.phone,
    "https://wa.me/" + vendor.whatsappNumber.replace(/[^0-9]/g, ""),
    "mailto:" + vendor.email
  ];
  for (const href of expected) {
    if (!links.some(link => link.href === href)) {
      throw new Error(label + " is missing the expected contact link " + href + ": " + JSON.stringify(links));
    }
  }
  const whatsapp = links.find(link => link.href === expected[1]);
  const rel = new Set(whatsapp.rel.split(/\s+/).filter(Boolean));
  if (whatsapp.target !== "_blank" || !rel.has("noopener") || !rel.has("noreferrer")) {
    throw new Error(label + " WhatsApp link must open safely in a new tab: " + JSON.stringify(whatsapp));
  }
  return { label, vendorId, links: expected.length, whatsappTarget: whatsapp.target, rel: whatsapp.rel };
}

async function verifyPrintPopup(page, label, action, expectedTitle, expectedText) {
  const popupPromise = page.context().waitForEvent("page", { timeout: 7000 });
  await action();
  const popup = await popupPromise;
  try {
    await popup.locator("body").waitFor({ state: "visible", timeout: 7000 });
    await popup.waitForFunction(() =>
      document.title.trim().length > 0 && document.body && document.body.textContent.trim().length > 0,
      null,
      { timeout: 7000 }
    );
    const result = await popup.evaluate(() => ({ title: document.title, body: document.body.textContent || "" }));
    if (result.title !== expectedTitle) {
      throw new Error(label + " opened the wrong print window title: " + result.title);
    }
    for (const phrase of expectedText) {
      if (!result.body.includes(phrase)) {
        throw new Error(label + " print window did not contain expected content " + phrase + ": " + result.body.slice(0, 600));
      }
    }
    return { label, title: result.title, contentChecks: expectedText.length };
  } finally {
    await popup.close().catch(() => {});
  }
}

async function scrollGraphNodeIntoView(page, locator) {
  await locator.evaluate(el => {
    const scroller = el.closest(".route-flow-stage-scroll");
    if (scroller) {
      const item = el.getBoundingClientRect();
      const frame = scroller.getBoundingClientRect();
      const targetLeft = scroller.scrollLeft + item.left - frame.left - (scroller.clientWidth - item.width) / 2;
      const targetTop = scroller.scrollTop + item.top - frame.top - (scroller.clientHeight - item.height) / 2;
      scroller.scrollLeft = Math.max(0, Math.min(scroller.scrollWidth - scroller.clientWidth, targetLeft));
      scroller.scrollTop = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, targetTop));
    }
    el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
  });
  await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(60);
}

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1, acceptDownloads: true });
  await context.addInitScript(({ key, data }) => {
    // Seed a clean isolated context only once. Re-seeding on every navigation
    // or reload would erase the mutations that persistence acceptance must verify.
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem("aximach.storage.mode", "local-only");
    localStorage.setItem("aximach.legacy-demo-cleanup.v2", "done");
  }, { key: "aximach.manufacturingData.v1", data: seededData });

  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await assertWorkspace(page, "initial dashboard");

  // First pass: actually open every registered module and ensure its workspace mounts.
  const moduleButtons = page.locator('nav[aria-label="AXIMACH navigation"] button[title]');
  const moduleCount = await moduleButtons.count();
  if (moduleCount !== 22) throw new Error("Expected two command centres plus all 20 module destinations; found " + moduleCount);
  const moduleTitles = [];
  for (let index = 0; index < moduleCount; index++) {
    const title = await moduleButtons.nth(index).getAttribute("title");
    if (title) moduleTitles.push(title);
  }
  const moduleResults = [];
  for (const title of moduleTitles) {
    await openModule(page, title);
    const text = await page.locator(".page-content").innerText();
    moduleResults.push({ title, contentCharacters: text.length });
  }

  // Sweep all native dropdown options in every module. No business record is saved.
  const nativeOptionResults = [];
  for (const title of moduleTitles) {
    await openModule(page, title);
    const selects = page.locator(".page-content select:visible");
    const selectCount = await selects.count();
    let tested = 0;
    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      const values = await select.locator("option").evaluateAll(nodes => nodes.map(node => node.value).filter(value => value !== ""));
      for (const value of values) {
        await select.selectOption(value, { timeout: 3000 });
        tested++;
        await page.waitForTimeout(25);
        await assertWorkspace(page, title + " selector " + i + " option " + value);
      }
    }
    nativeOptionResults.push({ title, selects: selectCount, optionsClicked: tested });
  }

  // Route Flow: one component, three part records, five materials, nine material/process links,
  // eleven relationship types, eight independently identified transport legs.
  await openModule(page, "Route Flow & Relationships");
  await chooseNativeScope(page, ".route-flow-scope-bar");
  // The in-app demo must exercise the same multipart fixture in the actual Route Flow workspace.
  await page.getByRole("button", { name: "Open multi-part demo" }).click();
  const multipartDemo = page.getByRole("region", { name: "One component multi-part route and transport demonstration" });
  await multipartDemo.waitFor({ state: "visible", timeout: 5000 });
  for (const phrase of ["One assembly", "three part routes", "ASSY-MP-01-BODY", "ASSY-MP-01-SHAFT", "ASSY-MP-01-COVER"]) {
    if (!(await multipartDemo.innerText()).includes(phrase)) throw new Error("Route Flow multipart demo omitted " + phrase);
  }
  const partFilter = multipartDemo.getByLabel("Filter demo by part");
  const expectedPartRoutes = [
    ["ASSY-MP-01-BODY", "Insert installation", "Seal installation"],
    ["ASSY-MP-01-SHAFT", "CNC shaft turning", "Shaft heat treatment", "Shaft cylindrical grinding"],
    ["ASSY-MP-01-COVER", "Cover machining and assembly"]
  ];
  for (const [partNumber, ...expectedProcesses] of expectedPartRoutes) {
    const option = partFilter.locator("option").filter({ hasText: partNumber }).first();
    await partFilter.selectOption(await option.getAttribute("value"));
    const partRouteText = await multipartDemo.innerText();
    for (const processName of expectedProcesses) {
      if (!partRouteText.includes(processName)) throw new Error(partNumber + " demo route omitted " + processName);
    }
  }
  await partFilter.selectOption("all");
  await multipartDemo.getByRole("tab", { name: "Relationship types" }).click();
  const relationshipDemoText = await multipartDemo.innerText();
  for (const relationship of ["Main", "Alternate", "Rework", "Dependency", "Parallel", "Merge", "Split", "Follow-on", "Feedback", "Conditional", "Successor"]) {
    if (!relationshipDemoText.includes(relationship)) throw new Error("Multipart demo omitted relationship type " + relationship);
  }
  await multipartDemo.getByRole("tab", { name: "Transport legs" }).click();
  if (!(await multipartDemo.innerText()).includes("VMC subcontractor")) throw new Error("Multipart demo did not render VMC transport fan-out.");
  await multipartDemo.getByRole("tab", { name: "Carrier options" }).click();
  await multipartDemo.getByRole("button", { name: "Add alternative 4-wheeler carrier leg" }).click();
  if (!(await multipartDemo.innerText()).includes("SIMULATED-ALT-CARRIER") && !(await multipartDemo.innerText()).includes("second carrier leg")) {
    throw new Error("Multipart demo did not simulate the second carrier option.");
  }
  await page.getByRole("button", { name: "Close multi-part demo" }).click();
  await chooseNativeScope(page, ".route-flow-scope-bar");
  const branchPicker = page.locator(".route-flow-scope-bar select").nth(3);
  const branchOptions = await branchPicker.locator("option").evaluateAll(nodes => nodes.map(node => node.value || node.textContent?.trim()).filter(Boolean));
  const expectedBranchOperations = {
    "Main route": ["Material saw cutting", "VMC datum and port machining", "Final CMM and pressure inspection"],
    "Shaft branch": ["CNC shaft turning", "Shaft heat treatment", "Shaft cylindrical grinding"],
    "Body branch": ["Insert installation", "Seal installation"],
    "Cover branch": ["Cover machining and assembly"]
  };
  const visitedTransportIds = new Set();
  const visitedMaterialLinks = new Set();
  const contactLinkResults = [];
  const branchResults = [];
  for (const branchName of branchOptions) {
    await branchPicker.selectOption({ label: branchName }).catch(async () => branchPicker.selectOption(branchName));
    await page.waitForTimeout(200);
    const branchText = await page.locator(".page-content").innerText();
    for (const expected of expectedBranchOperations[branchName] || []) {
      if (!branchText.includes(expected)) throw new Error("Route Flow branch " + branchName + " is missing operation " + expected);
    }
    const branchLegButtons = page.locator('button[aria-label="Open transport leg popup"]');
    const branchLegCount = await branchLegButtons.count();
    for (let i = 0; i < branchLegCount; i++) {
      const button = page.locator('button[aria-label="Open transport leg popup"]').nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      await scrollGraphNodeIntoView(page, button);
      await button.evaluate(element => element.click());
      const dialog = page.getByRole("dialog", { name: "Transport and directory record details" });
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      const details = await dialog.innerText();
      const match = details.match(/Transport leg:\s*(mp-leg-[A-Za-z0-9-]+)/);
      if (!details.includes("TRANSPORT RECORD") || !details.includes("TRANSPORT ROUTE") || !match) {
        throw new Error("Transport popup must expose its exact transport leg and directory route identity: " + details);
      }
      const transportRecord = fixture.transportLegs.find(row => row.id === match[1]);
      contactLinkResults.push(await assertVendorContactLinks(dialog, transportRecord?.vendorId, "Route Flow " + match[1]));
      visitedTransportIds.add(match[1]);
      await dialog.getByRole("button", { name: "Close transport details" }).evaluate(element => element.click());
    }
    const branchMaterialMarkers = page.locator(".material-flow-marker-button");
    const branchMarkerCount = await branchMaterialMarkers.count();
    for (let i = 0; i < branchMarkerCount; i++) {
      const button = page.locator(".material-flow-marker-button").nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      await scrollGraphNodeIntoView(page, button);
      await button.evaluate(element => element.click());
      const popup = page.getByRole("dialog", { name: "Material to process link" });
      await popup.waitFor({ state: "visible", timeout: 4000 });
      const details = await popup.innerText();
      const bomMatch = details.match(/BOM line:\s*(mp-bom-[A-Za-z0-9-]+)/);
      const operationMatch = details.match(/Process operation:\s*(mp-op-[A-Za-z0-9-]+)/);
      if (!details.includes("Part:") || !bomMatch || !operationMatch) {
        throw new Error("Material popup lost part, BOM or process-operation identity: " + details);
      }
      visitedMaterialLinks.add(bomMatch[1] + ":" + operationMatch[1]);
      await button.evaluate(element => element.click());
    }
    branchResults.push({ branch: branchName, visibleTransportIcons: branchLegCount, visibleMaterialLinks: branchMarkerCount });
  }
  const expectedLegIds = new Set(fixture.transportLegs.map(row => row.id));
  if (visitedTransportIds.size !== fixture.transportLegs.length ||
      [...expectedLegIds].some(id => !visitedTransportIds.has(id))) {
    throw new Error("Route Flow did not independently open every transport record. Visited: " + [...visitedTransportIds].join(", "));
  }
  const expectedMaterialLinkIds = new Set(fixture.materialProcessLinks.map(row => row.bomLineId + ":" + row.operationId));
  if (visitedMaterialLinks.size !== expectedMaterialLinkIds.size ||
      [...expectedMaterialLinkIds].some(id => !visitedMaterialLinks.has(id))) {
    throw new Error("Route Flow did not independently expose every part-scoped BOM-to-operation material link. Visited: " + [...visitedMaterialLinks].join(", "));
  }
  const matrixRows = page.locator(".route-flow-matrix-row");
  if (await matrixRows.count() < fixture.routeRelationships.length) {
    throw new Error("Route Flow relationship matrix did not render all seeded cross-route edges");
  }
  const matrixTypes = await matrixRows.locator(".route-flow-matrix-arrow").evaluateAll(nodes => nodes.map(node => node.getAttribute("data-relationship-type") || ""));
  for (const type of ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"]) {
    if (!matrixTypes.includes(type)) throw new Error("Route Flow relationship edge type is missing from the rendered matrix: " + type + ". Rendered types: " + matrixTypes.join(", ") + ". Rows: " + JSON.stringify(await matrixRows.allInnerTexts()));
  }
  const relationshipMatrixText = await matrixRows.allInnerTexts();
  for (const [target, type] of [
    ["CNC shaft turning", "Split route"],
    ["Insert installation", "Parallel route"],
    ["Cover machining and assembly", "Alternate route"]
  ]) {
    if (!relationshipMatrixText.some(row => row.includes("VMC datum and port machining") && row.includes(target) && row.includes(type))) {
      throw new Error("Route Flow matrix is missing the second-stage VMC fan-out link to " + target + " (" + type + ").");
    }
  }

  const layoutPicker = page.getByLabel("Choose route flow layout", { exact: true });
  const routeLayouts = await layoutPicker.locator("option").evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
  if (routeLayouts.length !== 9) throw new Error("Expected 9 Route Flow layouts; found " + routeLayouts.length);
  for (const layout of routeLayouts) {
    await layoutPicker.selectOption(layout);
    const rendered = await page.locator("[data-route-layout]").count();
    if (!rendered) throw new Error("Route Flow layout " + layout + " did not render a graph");
  }

  const relationshipButtons = page.locator(".route-flow-relationship-types button");
  const relationshipCount = await relationshipButtons.count();
  if (relationshipCount !== 11) throw new Error("Expected 11 relationship type tools; found " + relationshipCount);
  const relationshipResults = [];
  for (let i = 0; i < relationshipCount; i++) {
    const button = relationshipButtons.nth(i);
    const label = (await button.innerText()).trim();
    await button.click();
    if (!(await button.evaluate(el => el.classList.contains("is-selected")))) throw new Error("Relationship type did not select: " + label);
    relationshipResults.push(label);
  }

  const legPopupCount = visitedTransportIds.size;
  const legPopupsOpened = visitedTransportIds.size;
  const materialMarkerCount = visitedMaterialLinks.size;
  const materialPopupsOpened = visitedMaterialLinks.size;
  if (legPopupsOpened !== fixture.transportLegs.length || materialPopupsOpened !== fixture.materialProcessLinks.length) {
    throw new Error("Route Flow did not verify every expected transport/material popup");
  }

  const routeExportResults = [];
  await page.locator(".route-flow-scope-bar select").nth(3).selectOption("Main route");
  const routeExportFormat = page.getByLabel("Route export format", { exact: true });
  for (const format of ["svg","png","csv","json"]) {
    await routeExportFormat.selectOption(format);
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.locator(".route-flow-export-controls").getByRole("button", { name: "Download", exact: true }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    if (!filePath) throw new Error("Route Flow " + format + " export did not produce a download.");
    const bytes = readFileSync(filePath);
    if (format === "svg") {
      const svg = bytes.toString("utf8");
      if (!svg.includes("<svg") || !svg.includes("Material saw cutting") || !svg.includes("VMC datum and port machining")) {
        throw new Error("Route Flow SVG export omitted its selected branch process stages.");
      }
    } else if (format === "png") {
      if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("Route Flow PNG export has an invalid PNG signature.");
    } else if (format === "csv") {
      const csv = bytes.toString("utf8");
      for (const expected of ["Material process link","Transport","Relationship","ASSY-MP-01-BODY","mp-bom-body-al"]) {
        if (!csv.includes(expected)) throw new Error("Route Flow CSV export omitted " + expected);
      }
    } else {
      const json = JSON.parse(bytes.toString("utf8"));
      if (json.materialProcessLinks?.length !== fixture.materialProcessLinks.length
          || json.relationships?.length !== fixture.routeRelationships.length
          || !fixture.transportLegs.filter(row => row.anchorOperationId === "mp-op-vmc").every(row => json.transportLegs?.some(item => item.id === row.id))) {
        throw new Error("Route Flow JSON export omitted the part links, typed relationships or VMC fan-out transport records.");
      }
    }
    routeExportResults.push({ format, filename: await download.suggestedFilename(), bytes: bytes.length });
  }

  // Process Map: exercise every one of its nineteen selectable views against the same fixture.
  await openModule(page, "3D Command Centre");
  await page.getByRole("button", { name: /Open process universe/i }).click();
  await page.waitForTimeout(250);
  await chooseProcessMapScope(page);
  const modeButtons = page.locator('[aria-label="All Process Map viewing modes"] button');
  const modeCount = await modeButtons.count();
  if (modeCount !== 19) throw new Error("Expected 19 Process Map visual modes; found " + modeCount);
  const visualModes = [];
  for (let i = 0; i < modeCount; i++) {
    const button = modeButtons.nth(i);
    const label = (await button.innerText()).trim();
    await button.click();
    if ((await button.getAttribute("aria-pressed")) !== "true") throw new Error("Process Map visual mode failed to activate: " + label);
    await page.waitForTimeout(75);
    await assertWorkspace(page, "Process Map " + label);
    visualModes.push(label);
  }

  // Open the collapsed 3D route disclosure before selecting an operation node.
  await modeButtons.first().click();
  const processUniverseDisclosure = page.locator("details.process-universe-collapsible").first();
  await processUniverseDisclosure.waitFor({ state: "attached", timeout: 5000 });
  const processUniverseIsOpen = await processUniverseDisclosure.evaluate(element => element.open);
  if (!processUniverseIsOpen) await processUniverseDisclosure.locator("summary").click();
  // Open an operation node's expanded record, launch its Edit dialog, and close both surfaces.
  const operationDetailButtons = page.locator('button[aria-label^="Open details for "]');
  const operationDetailButton = operationDetailButtons.first();
  await operationDetailButton.waitFor({ state: "visible", timeout: 7000 });
  const operationDetailCount = await operationDetailButtons.count();
  if (operationDetailCount < 1) throw new Error("Process Map did not render a selectable operation detail node.");
  const operationLabel = await operationDetailButton.getAttribute("aria-label");
  await operationDetailButton.evaluate(element => element.click());
  const operationDetails = page.locator("#process-orbit-selected-details");
  await operationDetails.waitFor({ state: "visible", timeout: 5000 });
  const operationDetailsText = await operationDetails.innerText();
  if (!operationDetailsText.includes("SELECTED PROCESS") || !operationDetailsText.includes("PART / PO LINE")) {
    throw new Error("Expanded Process Map operation details omitted its saved record fields: " + operationDetailsText.slice(0, 500));
  }
  await operationDetails.getByRole("button", { name: /Edit process/ }).click();
  const operationEditDialog = page.getByRole("dialog", { name: "Edit process operation" });
  await operationEditDialog.waitFor({ state: "visible", timeout: 5000 });
  await operationEditDialog.getByRole("button", { name: "Close editor" }).click();
  await operationEditDialog.waitFor({ state: "detached", timeout: 5000 });
  await operationDetails.getByRole("button", { name: /Collapse details/ }).click();
  await operationDetails.waitFor({ state: "detached", timeout: 5000 });
  const processOperationDetails = { node: operationLabel, opened: true, editDialogOpened: true, bothClosed: true };

  const materialMapMarkers = page.locator(".material-flow-marker-button");
  const processMapMaterialMarkerCount = await materialMapMarkers.count();
  if (processMapMaterialMarkerCount < 6) throw new Error("Process Map did not render the multi-part material links; found " + processMapMaterialMarkerCount);
  let processMapMaterialPopups = 0;
  for (let i = 0; i < processMapMaterialMarkerCount; i++) {
    const marker = page.locator(".material-flow-marker-button").nth(i);
    if (!(await marker.isVisible().catch(() => false))) continue;
    await marker.evaluate(element => element.click());
    const popup = page.getByRole("dialog", { name: "Material to process link" });
    await popup.waitFor({ state: "visible", timeout: 4000 });
    const details = await popup.innerText();
    if (!details.includes("Part:") || !details.includes("BOM line:")) throw new Error("Process Map material popup lost its part/BOM identity");
    await marker.evaluate(element => element.click());
    processMapMaterialPopups++;
  }

  // Manufacturing Universe: scope by exact company, PO and component line; cycle export formats.
  await openModule(page, "Manufacturing Universe");
  await chooseNativeScope(page, ".manufacturing-universe-scope");
  const universeLayoutPicker = page.getByLabel("Choose route flow layout", { exact: true });
  const universeRouteLayouts = await universeLayoutPicker.locator("option").evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
  if (universeRouteLayouts.length !== 9) throw new Error("Manufacturing Universe expected all nine shared route layouts");
  for (const layout of universeRouteLayouts) {
    await universeLayoutPicker.selectOption(layout);
    if (!(await page.locator(".process-universe-3d.mode-" + layout).count())) throw new Error("Manufacturing Universe route layout did not activate: " + layout);
  }

  const universeModes = page.locator('[aria-label="Process map visualisation modes"] button');
  const universeModeCount = await universeModes.count();
  if (universeModeCount !== 15) throw new Error("Expected all 15 Manufacturing Universe visualisation modes; found " + universeModeCount);
  const universeModeResults = [];
  for (let i = 0; i < universeModeCount; i++) {
    const button = universeModes.nth(i);
    const label = (await button.innerText()).trim();
    await button.click();
    if ((await button.getAttribute("aria-pressed")) !== "true") throw new Error("Manufacturing Universe visual mode failed to activate: " + label);
    await page.waitForTimeout(80);
    await assertWorkspace(page, "Manufacturing Universe " + label);
    universeModeResults.push(label);
  }

  const universeTransportButtons = page.locator('button[aria-label*="transport record" i]');
  const universeTransportCount = await universeTransportButtons.count();
  const expectedInboundCount = fixture.materialCostEntries.length;
  if (universeTransportCount < fixture.transportLegs.length + expectedInboundCount) {
    throw new Error("Manufacturing Universe did not expose all outbound legs and inbound material transport records; found " + universeTransportCount);
  }
  const universeTransportIds = new Set();
  const universeMaterialTransportIds = new Set();
  for (let i = 0; i < universeTransportCount; i++) {
    const button = page.locator('button[aria-label*="transport record" i]').nth(i);
    const isMaterialTransport = await button.evaluate(el => el.classList.contains("process-orbit-material-transport"));
    // Scene geometry can place controls outside the browser hit-test viewport after visual-mode sweeps.
    // Invoke the rendered button's own click handler; popup content and record identity are still asserted below.
    await button.evaluate(element => element.click());
    if (isMaterialTransport) {
      const dialog = page.getByRole("dialog", { name: "Inbound material transport details" });
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      const details = await dialog.innerText();
      const match = details.match(/Material allocation ID:\s*(mp-cost-[A-Za-z0-9-]+)/);
      if (!match || !details.includes("MATERIAL MOVEMENT ROUTE")) throw new Error("Inbound material transport popup lost its exact material allocation record: " + details);
      const materialRecord = fixture.materialCostEntries.find(row => row.id === match[1]);
      contactLinkResults.push(await assertVendorContactLinks(dialog, materialRecord?.vendorId, "Manufacturing Universe material " + match[1]));
      universeMaterialTransportIds.add(match[1]);
      await dialog.getByRole("button", { name: "Close transport details" }).click();
    } else {
      const dialog = page.getByRole("dialog", { name: "Transport and directory record details" });
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      const details = await dialog.innerText();
      const match = details.match(/Transport leg:\s*(mp-leg-[A-Za-z0-9-]+)/);
      if (!match || !details.includes("TRANSPORT ROUTE")) throw new Error("Universe transport popup lost its exact route leg record: " + details);
      universeTransportIds.add(match[1]);
      await dialog.getByRole("button", { name: "Close transport details" }).click();
    }
  }
  if (universeTransportIds.size !== fixture.transportLegs.length ||
      fixture.transportLegs.some(row => !universeTransportIds.has(row.id))) {
    throw new Error("Manufacturing Universe did not open all exact component transport legs: " + [...universeTransportIds].join(", "));
  }
  if (universeMaterialTransportIds.size !== expectedInboundCount ||
      fixture.materialCostEntries.some(row => !universeMaterialTransportIds.has(row.id))) {
    throw new Error("Manufacturing Universe did not open all exact inbound material transport records: " + [...universeMaterialTransportIds].join(", "));
  }

  const exportFormat = page.getByLabel("Universe export format", { exact: true });
  const exportFormats = await exportFormat.locator("option").evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
  const universeExportResults = [];
  for (const format of exportFormats) {
    await exportFormat.selectOption(format);
    await assertWorkspace(page, "Universe export format " + format);
    if (format === "pdf") continue; // The PDF print popup is checked in the dedicated popup sweep.
    const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
    await page.locator(".manufacturing-universe-actions .route-flow-export-controls").getByRole("button", { name: "Download", exact: true }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    if (!filePath) throw new Error("Manufacturing Universe " + format + " export did not produce a download.");
    const bytes = readFileSync(filePath);
    if (format === "svg") {
      const svg = bytes.toString("utf8");
      if (!svg.includes("<svg") || !svg.includes("CNC shaft turning") || !svg.includes("Material saw cutting")) {
        throw new Error("Manufacturing Universe SVG export omitted saved process stages.");
      }
    } else if (format === "png") {
      if (!bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error("Manufacturing Universe PNG export has an invalid PNG signature.");
    } else if (format === "csv") {
      const csv = bytes.toString("utf8");
      for (const expected of ["Material allocation","Material inbound transport","Material process link","Transport leg","Relationship","ASSY-MP-01-SHAFT","mp-leg-09","mp-rel-12","EN24 shaft blank"]) {
        if (!csv.includes(expected)) throw new Error("Manufacturing Universe CSV export omitted " + expected);
      }
    } else {
      const json = JSON.parse(bytes.toString("utf8"));
      if (json.stages?.length !== fixture.operations.length
          || json.materials?.length !== fixture.materialCostEntries.length
          || json.materialProcessLinks?.length !== fixture.materialProcessLinks.length
          || json.transportLegs?.length !== fixture.transportLegs.length
          || json.relationships?.length !== fixture.routeRelationships.length) {
        throw new Error("Manufacturing Universe JSON export omitted one or more saved process, material, transport or relationship records.");
      }
    }
    universeExportResults.push({ format, filename: await download.suggestedFilename(), bytes: bytes.length });
  }
  if (exportFormats.length !== 5) throw new Error("Expected SVG, PNG, PDF, CSV and JSON export format choices");
  const universeText = await page.locator(".page-content").innerText();
  for (const expected of ["Multi-part hydraulic control assembly", "Material saw cutting", "VMC datum and port machining"]) {
    if (!universeText.includes(expected)) throw new Error("Manufacturing Universe is missing " + expected);
  }

  // Route simulation is a visual aid only; it must not mutate saved production data.
  const simulationResults = [];
  const operationsBeforeSimulation = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("aximach.manufacturingData.v1") || "{}").operations || []));
  await page.getByRole("button", { name: "Simulate route", exact: true }).click();
  await page.waitForFunction(() => /STEP 2\//.test(document.body.innerText), null, { timeout: 5000 });
  await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  const operationsAfterSimulation = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("aximach.manufacturingData.v1") || "{}").operations || []));
  if (operationsAfterSimulation !== operationsBeforeSimulation) {
    throw new Error("Manufacturing Universe visual route simulation changed saved operation records.");
  }
  simulationResults.push({ reachedStepTwo: true, paused: true, reset: true, persistedOperationsUnchanged: true });

  // Mutating acceptance: add one conditional relationship and a second carrier leg,
  // then prove both survive a full reload and remain linked across workspaces.
  const persistenceResults = [];
  await openModule(page, "Route Flow & Relationships");
  await chooseNativeScope(page, ".route-flow-scope-bar");

  const relationshipEditor = page.locator(".route-flow-editor-panel").filter({ hasText: "Add a typed process relationship" });
  if (!(await relationshipEditor.isVisible().catch(() => false))) {
    // The relationship-type test sweep may already have opened this editor.
    // Use the idempotent "Add selected relationship" action instead of a toggle.
    await page.locator(".route-flow-relationship-panel").getByRole("button", { name: "Add selected relationship", exact: true }).click();
  }
  await relationshipEditor.waitFor({ state: "visible", timeout: 5000 });
  // These native controls are wrapped in nested label elements; address them
  // by their stable form order to avoid Chromium accessible-name differences.
  const relationshipSelects = relationshipEditor.locator("select");
  await relationshipSelects.nth(0).selectOption("mp-op-turn");
  await relationshipSelects.nth(1).selectOption("mp-op-grind");
  await relationshipSelects.nth(2).selectOption("conditional");
  await relationshipSelects.nth(3).selectOption("Conditional");
  const relationshipInputs = relationshipEditor.locator("input");
  await relationshipInputs.nth(0).fill("QA_PERSISTENCE_ROUTE_FANOUT_RULE");
  await relationshipInputs.nth(1).fill("Browser persistence acceptance relationship");
  await relationshipEditor.getByRole("button", { name: "Save relationship", exact: true }).click();

  const transportEditor = page.locator(".route-flow-editor-panel").filter({ hasText: "Add a transport leg between two process stages" });
  if (!(await transportEditor.isVisible().catch(() => false))) {
    await page.locator(".route-flow-canvas-tools button").filter({ hasText: "Add transport leg" }).click();
  }
  await transportEditor.waitFor({ state: "visible", timeout: 5000 });
  const transportSelects = transportEditor.locator("select");
  await transportSelects.nth(0).selectOption("mp-op-vmc");
  await transportSelects.nth(2).selectOption("mp-op-turn");
  await transportSelects.nth(3).selectOption("mp-vendor-material");
  await transportSelects.nth(4).selectOption("mp-route-12");
  await transportEditor.getByRole("button", { name: "Save transport leg", exact: true }).click();
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem("aximach.manufacturingData.v1") || "{}");
    return state.routeRelationships?.some(row => row.condition === "QA_PERSISTENCE_ROUTE_FANOUT_RULE")
      && state.transportLegs?.some(row => row.routeId === "mp-route-12" && row.anchorOperationId === "mp-op-vmc" && row.targetOperationId === "mp-op-turn" && row.poLineId === "mp-line");
  }, null, { timeout: 7000 });
  const persistedBeforeReload = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("aximach.manufacturingData.v1") || "{}");
    return {
      relationship: state.routeRelationships.find(row => row.condition === "QA_PERSISTENCE_ROUTE_FANOUT_RULE"),
      transportLeg: state.transportLegs.find(row => row.routeId === "mp-route-12" && row.anchorOperationId === "mp-op-vmc" && row.targetOperationId === "mp-op-turn" && row.poLineId === "mp-line")
    };
  });
  if (!persistedBeforeReload.relationship || !persistedBeforeReload.transportLeg) {
    throw new Error("Route Flow did not save both new cross-branch records before reload.");
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await assertWorkspace(page, "reload after Route Flow relationship and transport save");
  await openModule(page, "Route Flow & Relationships");
  await chooseNativeScope(page, ".route-flow-scope-bar");
  const shaftBranch = page.locator(".route-flow-scope-bar select").nth(3);
  await shaftBranch.selectOption("Shaft branch");
  const savedRelationship = page.locator(".route-flow-saved-link").filter({ hasText: "QA_PERSISTENCE_ROUTE_FANOUT_RULE" });
  await savedRelationship.waitFor({ state: "visible", timeout: 5000 });
  const persistedLegMarker = page.locator('button[aria-label="Open transport leg popup"][title="4-wheeler · VMC subcontractor → CNC shaft turning supplier"]');
  await persistedLegMarker.waitFor({ state: "visible", timeout: 5000 });
  await scrollGraphNodeIntoView(page, persistedLegMarker);
  await persistedLegMarker.evaluate(element => element.click());
  const persistedLegDialog = page.getByRole("dialog", { name: "Transport and directory record details" });
  await persistedLegDialog.waitFor({ state: "visible", timeout: 5000 });
  const persistedLegDetails = await persistedLegDialog.innerText();
  if (!persistedLegDetails.includes("Transport leg: " + persistedBeforeReload.transportLeg.id)
      || !persistedLegDetails.includes("VMC subcontractor → CNC shaft turning supplier")
      || !persistedLegDetails.includes("VMC datum and port machining")
      || !persistedLegDetails.includes("CNC shaft turning")) {
    throw new Error("Reloaded Route Flow popup lost the saved carrier or exact sending/receiving operation IDs: " + persistedLegDetails);
  }
  await persistedLegDialog.getByRole("button", { name: "Close transport details" }).click();
  await savedRelationship.getByRole("button", { name: "Disable", exact: true }).click();
  await page.waitForFunction((condition) => {
    const state = JSON.parse(localStorage.getItem("aximach.manufacturingData.v1") || "{}");
    return state.routeRelationships?.some(row => row.condition === condition && row.status === "Disabled");
  }, "QA_PERSISTENCE_ROUTE_FANOUT_RULE", { timeout: 7000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await assertWorkspace(page, "reload after disabling a Route Flow relationship");
  await openModule(page, "Route Flow & Relationships");
  await chooseNativeScope(page, ".route-flow-scope-bar");
  const disabledRelationship = page.locator(".route-flow-saved-link").filter({ hasText: "QA_PERSISTENCE_ROUTE_FANOUT_RULE" });
  await disabledRelationship.waitFor({ state: "visible", timeout: 5000 });
  if (!(await disabledRelationship.innerText()).includes("Disabled")) {
    throw new Error("Disabled route relationship did not remain disabled after reload.");
  }
  persistenceResults.push({
    relationshipId: persistedBeforeReload.relationship.id,
    transportLegId: persistedBeforeReload.transportLeg.id,
    secondCarrierRouteId: "mp-route-12",
    savedAndReloaded: true,
    relationshipDisableAndReload: true
  });

  await openModule(page, "Transport & Dispatch");
  const dispatchText = await page.locator(".page-content").innerText();
  if (!dispatchText.includes("VMC subcontractor → CNC shaft turning supplier")) {
    throw new Error("Transport & Dispatch did not show the new VMC-to-shaft carrier leg after Route Flow reload.");
  }

  await openModule(page, "Manufacturing Universe");
  await chooseNativeScope(page, ".manufacturing-universe-scope");
  // Sphere View intentionally hides rear-facing labels. Use Network View to
  // acceptance-test every branch transport marker without relying on rotation.
  await page.locator(".process-universe-layouts").getByRole("button", { name: "Network View", exact: true }).click();
  const universeBranchTransfers = [
    { title: "2-wheeler · VMC subcontractor → CNC shaft turning supplier", legId: "mp-leg-09", target: "CNC shaft turning" },
    { title: "3-wheeler · VMC subcontractor → Body insert installation cell", legId: "mp-leg-10", target: "Insert installation" },
    { title: "Light commercial vehicle · VMC subcontractor → Cover machining supplier", legId: "mp-leg-11", target: "Cover machining and assembly" },
    { title: "4-wheeler · VMC subcontractor → CNC shaft turning supplier", legId: persistedBeforeReload.transportLeg.id, target: "CNC shaft turning" }
  ];
  for (const transfer of universeBranchTransfers) {
    const exactMarker = page.locator('.process-universe-transport-marker[title="' + transfer.title.replaceAll('"', '\\"') + '"]');
    // 3D camera projection can keep a correct marker outside the visible hit-test
    // region even in Network View. Invoke the actual rendered button handler and
    // verify the exact transport record in its inspector below.
    await exactMarker.waitFor({ state: "attached", timeout: 5000 });
    await exactMarker.evaluate(element => element.click());
    const dialog = page.getByRole("dialog", { name: "Transport and directory record details" });
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    const details = await dialog.innerText();
    if (!details.includes("Transport leg: " + transfer.legId)
        || !details.includes("VMC datum and port machining → " + transfer.target)) {
      throw new Error("Manufacturing Universe did not resolve the exact source/target branch for " + transfer.title + ": " + details);
    }
    await dialog.getByRole("button", { name: "Close transport details" }).click();
  }
  const universeFanoutDetails = "VMC step 2 → three part branches + independent second shaft carrier";
  await page.waitForFunction(() => document.querySelectorAll(".process-universe-transport-marker").length >= 4, null, { timeout: 5000 });
  const persistedUniverseExportPromise = page.waitForEvent("download", { timeout: 15000 });
  await page.getByLabel("Universe export format", { exact: true }).selectOption("json");
  await page.locator(".manufacturing-universe-actions .route-flow-export-controls").getByRole("button", { name: "Download", exact: true }).click();
  const persistedUniverseDownload = await persistedUniverseExportPromise;
  const persistedUniversePath = await persistedUniverseDownload.path();
  if (!persistedUniversePath) throw new Error("Manufacturing Universe could not export the persisted second carrier.");
  const persistedUniverseJson = JSON.parse(readFileSync(persistedUniversePath, "utf8"));
  const exportedSecondCarrier = persistedUniverseJson.transportLegs?.find(row => row.id === persistedBeforeReload.transportLeg.id);
  if (!exportedSecondCarrier || exportedSecondCarrier.vehicleType !== "4-wheeler" || exportedSecondCarrier.routeId !== "mp-route-12") {
    throw new Error("Manufacturing Universe JSON export omitted the persisted 4-wheeler second carrier.");
  }
  universeExportResults.push({ format: "json-after-persistence", transportLegId: exportedSecondCarrier.id, vehicle: exportedSecondCarrier.vehicleType });
  await page.locator(".manufacturing-universe-links-grid").getByRole("button", { name: /Route Flow & Relationships/ }).click();
  await chooseNativeScope(page, ".route-flow-scope-bar");
  const branchRelationAfterNavigation = page.locator(".route-flow-saved-link").filter({ hasText: "QA_PERSISTENCE_ROUTE_FANOUT_RULE" });
  await branchRelationAfterNavigation.waitFor({ state: "visible", timeout: 5000 });
  if (!(await branchRelationAfterNavigation.innerText()).includes("Disabled")) {
    throw new Error("Manufacturing Universe → Route Flow navigation lost the saved PO-line route relationship.");
  }
  persistenceResults.push({ dispatchShowsLeg: true, universeReopensExactLeg: true, universeToRouteFlowContext: true });

  // Recheck key workspaces at Android phone dimensions in portrait and landscape.
  const responsiveResults = [];
  for (const size of [
    { name: "Android portrait", width: 393, height: 873 },
    { name: "Android landscape", width: 873, height: 393 }
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const title of ["Route Flow & Relationships", "Manufacturing Universe"]) {
      await openModule(page, title);
      const metrics = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const canvas = document.querySelector(".page-content");
        const rect = canvas?.getBoundingClientRect();
        return {
          viewportWidth: viewport,
          documentWidth: document.documentElement.scrollWidth,
          workspaceWidth: rect?.width || 0,
          workspaceHeight: rect?.height || 0,
          hasVisibleWorkspace: Boolean(rect && rect.width > 0 && rect.height > 0)
        };
      });
      if (!metrics.hasVisibleWorkspace) throw new Error(size.name + " " + title + " produced an empty or hidden workspace");
      if (metrics.documentWidth > metrics.viewportWidth + 12) throw new Error(size.name + " " + title + " overflowed the screen: " + JSON.stringify(metrics));
      responsiveResults.push({ ...size, module: title, ...metrics });
    }
  }

  // The compact dashboard must show its separate rotating live-record shell.
  // The legacy desktop shell is intentionally hidden on phones; the mobile shell
  // must use its own class and remain visible and interactive at Android width.
  await page.setViewportSize({ width: 393, height: 873 });
  const dashboardTitle = moduleTitles.find(title => /dashboard/i.test(title));
  if (!dashboardTitle) throw new Error("Dashboard navigation entry is missing.");
  await openModule(page, dashboardTitle);
  const mobileRecordShell = page.locator(".dashboard-welcome-orb .ax-orb-lower-shell-mobile");
  await mobileRecordShell.waitFor({ state: "visible", timeout: 6000 });
  const mobileShellMetrics = await mobileRecordShell.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { display: style.display, pointerEvents: style.pointerEvents, width: rect.width, height: rect.height, buttons: element.querySelectorAll("button").length };
  });
  if (mobileShellMetrics.display === "none" || mobileShellMetrics.pointerEvents === "none" ||
      mobileShellMetrics.width < 200 || mobileShellMetrics.height < 60 || mobileShellMetrics.buttons !== 6) {
    throw new Error("Android dashboard live-record shell is missing, hidden or non-interactive: " + JSON.stringify(mobileShellMetrics));
  }
  responsiveResults.push({ name: "Android portrait", module: "Dashboard live-record shell", ...mobileShellMetrics });

  // Pause the record shell's idle rotation so the Android tap target is stable.
  // Then exercise a real pointer click on a read-only navigation target.
  await page.locator(".ax-orb-record-pause").click({ timeout: 5000 });
  await page.waitForTimeout(250);
  await mobileRecordShell.locator('button[title="Open Companies"]').click({ timeout: 5000 });
  await page.locator(".page-content h1").filter({ hasText: "Company Directory" }).waitFor({ state: "visible", timeout: 6000 });
  responsiveResults.push({ name: "Android portrait", module: "Dashboard live-record shell click", destination: "Company Directory", clickable: true });
  await page.locator('button[aria-label="Open AXIMACH dashboard"]').click();
  await mobileRecordShell.waitFor({ state: "visible", timeout: 6000 });

  // Inventory unambiguously safe navigation/view buttons in all remaining modules. Buttons
  // that save, delete, archive, send, dispatch, import or export business data are not blindly
  // fired; those require their own isolated CRUD scenario rather than accidental data mutation.
  const blocked = /\b(save|update|delete|remove|archive|submit|send|dispatch|approve|reject|complete|finish|import|export|download|upload|connect|disconnect|schedule|confirm|pay|post|create|add record|add vendor|add component|add company|pdf|print|whatsapp)\b/i;
  const safeButtonResults = [];
  for (const title of moduleTitles) {
    await openModule(page, title);
    const buttons = page.locator(".page-content button:visible:not(:disabled)");
    const count = await buttons.count();
    const labels = [];
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const label = ((await button.innerText().catch(() => "")) + " " + (await button.getAttribute("aria-label") || "") + " " + (await button.getAttribute("title") || "")).trim();
      if (!label || blocked.test(label)) continue;
      labels.push(label);
    }
    let clicked = 0;
    for (const label of [...new Set(labels)]) {
      const button = page.getByRole("button", { name: label, exact: true }).first();
      if (!(await button.isVisible().catch(() => false)) || !(await button.isEnabled().catch(() => false))) continue;
      // Some workspace launchers sit beneath animated / immersive canvas layers.
      // Invoke the real DOM click handler after confirming the control is present,
      // enabled and visible; this tests the registered action without a flaky
      // pointer-stability wait against the moving WebGL scene.
      await button.evaluate(element => element.click());
      clicked++;
      await page.waitForTimeout(120);
      await assertWorkspace(page, title + " button " + label);
      await page.keyboard.press("Escape").catch(() => {});
    }
    safeButtonResults.push({ title, visibleButtons: count, safeButtonsClicked: clicked });
  }

  // Verify each print/PDF popup by checking its real generated document, then close it.
  const printPopupResults = [];
  await openModule(page, "Data Exchange Centre");
  printPopupResults.push(await verifyPrintPopup(
    page, "Data Exchange Centre PDF",
    () => page.getByRole("button", { name: "Print / Save PDF", exact: true }).click(),
    "AXIMACH Export",
    ["AXIMACH · Company Directory", fixture.company.name]
  ));

  await openModule(page, "Purchase Orders");
  printPopupResults.push(await verifyPrintPopup(
    page, "Purchase Orders PDF",
    () => page.getByRole("button", { name: "All PDF", exact: true }).click(),
    "AXIMACH Purchase Orders",
    [fixture.purchaseOrder.number, fixture.company.name]
  ));

  await openModule(page, "Component Directory");
  printPopupResults.push(await verifyPrintPopup(
    page, "Component Directory PDF",
    () => page.getByRole("button", { name: "All PDF", exact: true }).click(),
    "AXIMACH Components",
    [fixture.component.partNumber, fixture.component.name]
  ));

  await openModule(page, "Process Directory");
  printPopupResults.push(await verifyPrintPopup(
    page, "Process Directory PDF",
    () => page.getByRole("button", { name: "All PDF", exact: true }).click(),
    "AXIMACH Process Directory",
    [fixture.processDefinitions[0].processType]
  ));

  await openModule(page, "3D Command Centre");
  await page.getByRole("button", { name: /Open process universe/i }).click();
  await page.waitForTimeout(250);
  await chooseProcessMapScope(page);
  printPopupResults.push(await verifyPrintPopup(
    page, "Process Map diagram PDF",
    () => page.getByRole("button", { name: "Diagram PDF", exact: true }).click(),
    "AXIMACH Process Map",
    [fixture.component.partNumber]
  ));

  await openModule(page, "Route Flow & Relationships");
  await chooseNativeScope(page, ".route-flow-scope-bar");
  await page.getByLabel("Route export format", { exact: true }).selectOption("pdf");
  printPopupResults.push(await verifyPrintPopup(
    page, "Route Flow PDF",
    () => page.getByRole("button", { name: "Download", exact: true }).click(),
    fixture.component.partNumber + " · " + fixture.component.name + " · " + fixture.purchaseOrder.number,
    [fixture.component.partNumber, fixture.purchaseOrder.number]
  ));

  await openModule(page, "Manufacturing Universe");
  await chooseNativeScope(page, ".manufacturing-universe-scope");
  await page.getByLabel("Universe export format", { exact: true }).selectOption("pdf");
  printPopupResults.push(await verifyPrintPopup(
    page, "Manufacturing Universe PDF",
    () => page.getByRole("button", { name: "Download", exact: true }).click(),
    "AXIMACH Universe",
    ["AXIMACH · MANUFACTURING UNIVERSE", fixture.purchaseOrder.number, fixture.component.name]
  ));

  // Global modal audit: Module Universe, Command Search and 3D Icon Studio.
  const modalResults = [];

  const moduleButton = page.locator(".command-deck .deck-action").filter({ hasText: "Modules" }).first();
  await moduleButton.click();
  const moduleUniverse = page.getByRole("dialog", { name: /Module universe/i });
  await moduleUniverse.waitFor({ state: "visible", timeout: 5000 });
  const moduleSearch = moduleUniverse.getByPlaceholder("Find any module or capability…");
  await moduleSearch.fill("Vendor Directory");
  const vendorModuleCard = moduleUniverse.locator(".universe-card").filter({ hasText: "Vendor Directory" });
  await vendorModuleCard.waitFor({ state: "visible", timeout: 5000 });
  if (await moduleUniverse.locator(".universe-card:visible").count() !== 1) {
    throw new Error("Module Universe search did not narrow to the single Vendor Directory card.");
  }
  await vendorModuleCard.click();
  await assertWorkspace(page, "Module Universe navigation to Vendor Directory");
  modalResults.push({ modal: "Module Universe", search: "Vendor Directory", navigation: "Vendor Directory", closedAfterSelect: await moduleUniverse.count() === 0 });

  await page.getByRole("button", { name: "Open command search", exact: true }).click();
  const commandPalette = page.getByRole("dialog", { name: "Command search" });
  await commandPalette.waitFor({ state: "visible", timeout: 5000 });
  await commandPalette.getByPlaceholder("Search modules, vendors, contacts, jobs, references…").fill("Synthetic Material Logistics");
  const vendorSearchResult = commandPalette.locator(".palette-results button").filter({ hasText: "Synthetic Material Logistics" }).first();
  await vendorSearchResult.waitFor({ state: "visible", timeout: 5000 });
  await vendorSearchResult.click();
  await assertWorkspace(page, "Command Search navigation to Vendor Directory");
  if (await page.locator(".command-palette").count()) throw new Error("Command Search remained open after selecting a vendor result.");
  modalResults.push({ modal: "Command Search", query: "Synthetic Material Logistics", navigation: "Vendor Directory", closedAfterSelect: true });

  const logoStudioButton = page.locator(".command-deck .deck-action").filter({ hasText: "Logo Studio" }).first();
  await logoStudioButton.click();
  const iconStudio = page.getByRole("dialog", { name: "3D Icon Studio" });
  await iconStudio.waitFor({ state: "visible", timeout: 8000 });
  const iconSearch = iconStudio.getByPlaceholder("Search mechanical process, machine, tool or transport logo…");
  await iconSearch.fill("truck");
  const iconOptions = iconStudio.locator(".ax-icon-option-main");
  await iconOptions.first().waitFor({ state: "visible", timeout: 5000 });
  const iconSearchCount = await iconOptions.count();
  if (iconSearchCount < 1) throw new Error("3D Icon Studio search returned no truck icons.");
  const selectedIconLabel = await iconOptions.first().getAttribute("aria-label");
  await iconOptions.first().click();
  if (!(await iconOptions.first().locator("xpath=ancestor::div[contains(@class,'ax-icon-option')]").getAttribute("class"))?.includes("selected")) {
    throw new Error("3D Icon Studio did not select the requested preview icon.");
  }
  const iconTabs = iconStudio.locator(".ax-icon-tabs button");
  for (const tabName of ["Saved favourites", "Assigned", "All icons"]) {
    const tab = iconTabs.filter({ hasText: tabName }).first();
    await tab.click();
    if (!(await tab.getAttribute("class") || "").includes("active")) {
      throw new Error("3D Icon Studio tab did not activate: " + tabName);
    }
  }
  const iconPagination = iconStudio.locator(".ax-icon-pagination");
  const pageLabel = (await iconPagination.innerText()).match(/(\d+)\s*\/\s*(\d+)/);
  if (pageLabel && Number(pageLabel[2]) > 1) {
    await iconStudio.getByRole("button", { name: "Next icons" }).click();
    await iconStudio.getByRole("button", { name: "Previous icons" }).click();
  }
  await iconStudio.getByRole("button", { name: "Close icon studio", exact: true }).click();
  await iconStudio.waitFor({ state: "detached", timeout: 5000 });
  modalResults.push({ modal: "3D Icon Studio", search: "truck", matchingIcons: iconSearchCount, selectedIcon: selectedIconLabel, tabs: ["Saved favourites", "Assigned", "All icons"], closed: true });

  // Verify the Vendor Directory external action without opening WhatsApp.
  await openModule(page, "Vendor Directory");
  // Block the external request; the test checks that the intended WhatsApp URL opens.
  await openModule(page, "Vendor Directory");
  const whatsappVendor = fixture.vendors[0];
  const vendorRow = page.locator(".vendor-record").filter({ hasText: whatsappVendor.company }).first();
  await vendorRow.waitFor({ state: "visible", timeout: 5000 });
  await vendorRow.click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Phone with country code").fill("919876543210");
  await page.getByLabel("WhatsApp number").fill("919876543210");
  await page.getByRole("button", { name: "Save vendor master", exact: true }).click();
  const whatsappButton = page.getByRole("button", { name: "Open WhatsApp", exact: true });
  await whatsappButton.waitFor({ state: "visible", timeout: 5000 });
  await page.evaluate(() => {
    const calls = [];
    Object.defineProperty(window, "__aximachOpenCalls", { value: calls, configurable: true });
    window.open = (url, target, features) => {
      calls.push({ url: String(url || ""), target: String(target || ""), features: String(features || "") });
      return null;
    };
  });
  await whatsappButton.click();
  const whatsappOpenCalls = await page.evaluate(() => window.__aximachOpenCalls || []);
  const whatsappCall = whatsappOpenCalls.find(call =>
    call.url === "https://wa.me/919876543210" &&
    call.target === "_blank" &&
    call.features.includes("noopener") &&
    call.features.includes("noreferrer")
  );
  if (!whatsappCall) {
    throw new Error("Vendor WhatsApp action did not request the expected secure external URL: " + JSON.stringify(whatsappOpenCalls));
  }

  if (pageErrors.length) throw new Error("Browser runtime exceptions: " + pageErrors.join(" | "));
  console.log(JSON.stringify({
    fixture: { parts: fixture.parts.length, materials: fixture.materials.length, operations: fixture.operations.length,
      materialProcessLinks: fixture.materialProcessLinks.length, relationshipTypes: relationshipResults.length,
      transportLegs: fixture.transportLegs.length, transportPopupsOpened: legPopupsOpened,
      materialPopupsOpened, processMapMaterialPopups, processMapViews: visualModes.length, universeVisualModes: universeModeResults.length, universeRouteLayouts: universeRouteLayouts.length, universeTransportRecords: universeTransportIds.size, inboundMaterialTransportRecords: universeMaterialTransportIds.size },
    modules: moduleResults,
    nativeOptions: nativeOptionResults,
    routeLayouts,
    relationships: relationshipResults,
    processMapViews: visualModes,
    safeButtons: safeButtonResults,
    contactLinks: contactLinkResults,
    printPopups: printPopupResults,
    globalModals: modalResults,
    processOperationDetails,
    routeExports: routeExportResults,
    universeExports: universeExportResults,
    simulation: simulationResults,
    persistence: persistenceResults,
    responsive: responsiveResults,
    pageErrors
  }, null, 2));
}

try {
  await main();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
