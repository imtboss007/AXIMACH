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
 
…[1 chars truncated — re-run with head/grep/tail for full output]…
route-flow-scope-bar");
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
      await button.click({ timeout: 8000 });
      const dialog = page.getByRole("dialog", { name: "Transport and directory record details" });
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      const details = await dialog.innerText();
      const match = details.match(/Transport leg:\s*(mp-leg-[A-Za-z0-9-]+)/);
      if (!details.includes("TRANSPORT RECORD") || !details.includes("TRANSPORT ROUTE") || !match) {
        throw new Error("Transport popup must expose its exact transport leg and directory route identity: " + details);
      }
      visitedTransportIds.add(match[1]);
      await dialog.getByRole("button", { name: "Close transport details" }).click();
    }
    const branchMaterialMarkers = page.locator(".material-flow-marker-button");
    const branchMarkerCount = await branchMaterialMarkers.count();
    for (let i = 0; i < branchMarkerCount; i++) {
      const button = page.locator(".material-flow-marker-button").nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      await scrollGraphNodeIntoView(page, button);
      await button.click({ timeout: 8000 });
      const popup = page.getByRole("dialog", { name: "Material to process link" });
      await popup.waitFor({ state: "visible", timeout: 4000 });
      const details = await popup.innerText();
      const bomMatch = details.match(/BOM line:\s*(mp-bom-[A-Za-z0-9-]+)/);
      const operationMatch = details.match(/Process operation:\s*(mp-op-[A-Za-z0-9-]+)/);
      if (!details.includes("Part:") || !bomMatch || !operationMatch) {
        throw new Error("Material popup lost part, BOM or process-operation identity: " + details);
      }
      visitedMaterialLinks.add(bomMatch[1] + ":" + operationMatch[1]);
      await button.click();
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
  const matrixClasses = await matrixRows.locator(".route-flow-matrix-arrow").evaluateAll(nodes => nodes.flatMap(node => [...node.classList]));
  for (const type of ["main","alternate","rework","dependency","parallel","merge","split","follow-on","feedback","conditional","successor"]) {
    if (!matrixClasses.includes("route-flow-curve-" + type)) throw new Error("Route Flow relationship edge type is missing from the rendered matrix: " + type);
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
    if (!(await button.isVisible().catch(() => false))) continue;
    const isMaterialTransport = await button.evaluate(el => el.classList.contains("process-orbit-material-transport"));
    await button.click();
    if (isMaterialTransport) {
      const dialog = page.getByRole("dialog", { name: "Inbound material transport details" });
      await dialog.waitFor({ state: "visible", timeout: 5000 });
      const details = await dialog.innerText();
      const match = details.match(/Material allocation ID:\s*(mp-cost-[A-Za-z0-9-]+)/);
      if (!match || !details.includes("MATERIAL MOVEMENT ROUTE")) throw new Error("Inbound material transport popup lost its exact material allocation record: " + details);
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
  for (const format of exportFormats) {
    await exportFormat.selectOption(format);
    await assertWorkspace(page, "Universe export format " + format);
  }
  if (exportFormats.length !== 5) throw new Error("Expected SVG, PNG, PDF, CSV and JSON export format choices");
  const universeText = await page.locator(".page-content").innerText();
  for (const expected of ["Multi-part hydraulic control assembly", "Material saw cutting", "VMC datum and port machining"]) {
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
      materialPopupsOpened, processMapMaterialPopups, processMapViews: visualModes.length, universeVisualModes: universeModeResults.length, universeRouteLayouts: universeRouteLayouts.length, universeTransportRecords: universeTransportIds.size, inboundMaterialTransportRecords: universeMaterialTransportIds.size },
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
