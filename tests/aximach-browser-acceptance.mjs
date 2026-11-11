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
  const button = page.locator('nav[aria-label="AXIMACH navigation"] button[title="' + title.replaceAll('"', '\\"') + '"]');
  await button.waitFor({ state: "visible", timeout: 8000 });
  await button.click();
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

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await context.addInitScript(({ key, data }) => {
    localStorage.setItem(key, JSON.stringify(data));
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
  const routeFlowText = await page.locator(".page-content").innerText();
  for (const expected of ["Material saw cutting", "VMC datum and port machining", "CNC shaft turning", "Port"]) {
    if (!routeFlowText.includes(expected)) throw new Error("Route Flow is missing seeded route content: " + expected);
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

  const legPopupButtons = page.locator('button[aria-label*="transport leg popup" i],button[aria-label="Open this transport popup"]');
  const legPopupCount = await legPopupButtons.count();
  let legPopupsOpened = 0;
  for (let i = 0; i < legPopupCount; i++) {
    const current = page.locator('button[aria-label*="transport leg popup" i],button[aria-label="Open this transport popup"]').nth(i);
    if (!(await current.isVisible().catch(() => false))) continue;
    await current.click();
    const dialog = page.getByRole("dialog", { name: "Transport and directory record details" });
    await dialog.waitFor({ state: "visible", timeout: 5000 });
    const dialogText = await dialog.innerText();
    if (!dialogText.includes("TRANSPORT RECORD") || !dialogText.includes("TRANSPORT ROUTE")) throw new Error("Transport popup did not show the linked route record");
    await dialog.getByRole("button", { name: "Close transport details" }).click();
    legPopupsOpened++;
  }
  if (legPopupsOpened === 0) throw new Error("No transport leg popup was available in Route Flow");

  // Material markers: each selected popup must disclose its BOM line, operation ID and part.
  const materialMarkers = page.locator(".material-flow-marker-button");
  const materialMarkerCount = await materialMarkers.count();
  if (materialMarkerCount < 6) throw new Error("Expected multiple part-scoped material-to-process markers; found " + materialMarkerCount);
  let materialPopupsOpened = 0;
  for (let i = 0; i < materialMarkerCount; i++) {
    const marker = page.locator(".material-flow-marker-button").nth(i);
    if (!(await marker.isVisible().catch(() => false))) continue;
    await marker.click();
    const popup = page.getByRole("dialog", { name: "Material to process link" });
    await popup.waitFor({ state: "visible", timeout: 4000 });
    const details = await popup.innerText();
    if (!details.includes("BOM line:") || !details.includes("Process operation:") || !details.includes("Part:")) {
      throw new Error("Material marker popup is missing exact BOM, operation or part identity: " + details);
    }
    await marker.click();
    materialPopupsOpened++;
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

  const materialMapMarkers = page.locator(".material-flow-marker-button");
  const processMapMaterialMarkerCount = await materialMapMarkers.count();
  if (processMapMaterialMarkerCount < 6) throw new Error("Process Map did not render the multi-part material links; found " + processMapMaterialMarkerCount);
  let processMapMaterialPopups = 0;
  for (let i = 0; i < processMapMaterialMarkerCount; i++) {
    const marker = page.locator(".material-flow-marker-button").nth(i);
    if (!(await marker.isVisible().catch(() => false))) continue;
    await marker.click();
    const popup = page.getByRole("dialog", { name: "Material to process link" });
    await popup.waitFor({ state: "visible", timeout: 4000 });
    const details = await popup.innerText();
    if (!details.includes("Part:") || !details.includes("BOM line:")) throw new Error("Process Map material popup lost its part/BOM identity");
    await marker.click();
    processMapMaterialPopups++;
  }

  // Manufacturing Universe: scope by exact company, PO and component line; cycle export formats.
  await openModule(page, "Manufacturing Universe");
  await chooseNativeScope(page, ".manufacturing-universe-scope");
  const exportFormat = page.getByLabel("Universe export format", { exact: true });
  const exportFormats = await exportFormat.locator("option").evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
  for (const format of exportFormats) {
    await exportFormat.selectOption(format);
    await assertWorkspace(page, "Universe export format " + format);
  }
  if (exportFormats.length !== 5) throw new Error("Expected SVG, PNG, PDF, CSV and JSON export format choices");
  const universeText = await page.locator(".page-content").innerText();
  for (const expected of ["Hydraulic control assembly", "Material saw cutting", "VMC datum and port machining"]) {
    if (!universeText.includes(expected)) throw new Error("Manufacturing Universe is missing " + expected);
  }

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

  // Inventory unambiguously safe navigation/view buttons in all remaining modules. Buttons
  // that save, delete, archive, send, dispatch, import or export business data are not blindly
  // fired; those require their own isolated CRUD scenario rather than accidental data mutation.
  const blocked = /\b(save|update|delete|remove|archive|submit|send|dispatch|approve|reject|complete|finish|import|export|download|upload|connect|disconnect|schedule|confirm|pay|post|create|add record|add vendor|add component|add company)\b/i;
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
      await button.click({ timeout: 3000 });
      clicked++;
      await page.waitForTimeout(40);
      await assertWorkspace(page, title + " button " + label);
      await page.keyboard.press("Escape").catch(() => {});
    }
    safeButtonResults.push({ title, visibleButtons: count, safeButtonsClicked: clicked });
  }

  if (pageErrors.length) throw new Error("Browser runtime exceptions: " + pageErrors.join(" | "));
  console.log(JSON.stringify({
    fixture: { parts: fixture.parts.length, materials: fixture.materials.length, operations: fixture.operations.length,
      materialProcessLinks: fixture.materialProcessLinks.length, relationshipTypes: relationshipResults.length,
      transportLegs: fixture.transportLegs.length, transportPopupsOpened: legPopupsOpened,
      materialPopupsOpened, processMapMaterialPopups, processMapViews: visualModes.length },
    modules: moduleResults,
    nativeOptions: nativeOptionResults,
    routeLayouts,
    relationships: relationshipResults,
    processMapViews: visualModes,
    safeButtons: safeButtonResults,
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
