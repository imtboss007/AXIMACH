import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:4173";
const preview = spawn(process.execPath, [
  resolve("node_modules/vite/bin/vite.js"), "preview",
  "--host", "127.0.0.1", "--port", "4173", "--strictPort"
], { stdio: "ignore", env: { ...process.env, BROWSER: "none" } });

let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) { ready = true; break; }
    } catch { /* Vite preview is still starting. */ }
    await delay(500);
  }
  if (!ready) throw new Error("Vite preview did not become ready on port 4173.");

  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("navigation", { name: "AXIMACH navigation" }).waitFor();
  await page.getByRole("heading", { name: /main dashboard/i }).waitFor({ timeout: 15000 }).catch(() => {});
  const sphereModules = page.locator(".ax-orb-module-shell .ax-orb-satellite");
  await page.waitForFunction(() => document.querySelectorAll(".ax-orb-module-shell .ax-orb-satellite").length === 22, null, { timeout: 15000 });
  if (await sphereModules.count() !== 22) throw new Error("The 3D command sphere does not expose all 22 module controls.");
  if (await page.locator("[data-aximach-startup-error='true']").count()) {
    throw new Error("AXIMACH renderer startup error: " + await page.locator("[data-aximach-startup-error='true']").innerText());
  }

  const modules = [
    ["Company Directory", "companies"],
    ["Customer Directory", "customers"],
    ["Component Directory", "components"],
    ["Purchase Orders", "purchasing"],
    ["Vendor Directory", "vendors"],
    ["Transport Directory", "transport-master"],
    ["Contact 360", "contact360"],
    ["Process Directory", "process-master"],
    ["Component Planned Cost", "planned-cost"],
    ["Vendor Network", "vendor-capability"],
    ["Material Directory", "inventory"],
    ["Production Plan & Process Plan", "production"],
    ["Route Flow & Relationships", "route-flow"],
    ["Manufacturing Universe", "manufacturing-universe"],
    ["Transport & Dispatch", "dispatch"],
    ["Quality Inspection", "quality"],
    ["Costing & Payment", "costing"],
    ["Follow-up Centre", "communications"],
    ["Reports & Analytics", "reports"],
    ["AI Insights", "ai-insights"],
    ["Data Exchange Centre", "export"],
    ["Integrations & API", "integrations"]
  ];

  for (const [title, id] of modules) {
    const button = page.locator('nav[aria-label="AXIMACH navigation"] button[title="' + title + '"]');
    await button.click();
    await page.waitForFunction(expected => {
      const active = document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active');
      return active?.getAttribute("title") === expected;
    }, title, { timeout: 10000 });
    await page.locator("main.page-content").waitFor();
    await page.waitForFunction(() => !document.querySelector(".workspace-loading-state"), null, { timeout: 15000 });
    const bodyText = await page.locator("main.page-content").innerText();
    if (!bodyText.trim()) throw new Error("Module rendered empty content: " + id);
    if (await page.locator("[data-aximach-startup-error='true']").count()) {
      throw new Error("Renderer crashed while opening module: " + id);
    }
    console.log("PASS module navigation:", id);
  }

  // Verify supplier AP is available even when no component master has been created yet.
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Costing & Payment"]').click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Costing & Payment");
  await page.getByRole("heading", { name: "Supplier invoices & accounts payable" }).waitFor({ timeout: 10000 });
  await page.getByLabel("Supplier invoice number").waitFor({ timeout: 10000 });
  console.log("PASS supplier AP register is visible without component master records");

  // Exercise Company Directory's factory tab, which was previously hidden.
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Company Directory"]').click();
  await page.locator(".costing-tabs").waitFor();
  const factoryTab = page.locator(".costing-tabs button").filter({ hasText: "Factories" });
  await factoryTab.click();
  if (!(await factoryTab.getAttribute("class") || "").includes("costing-tab-active")) {
    throw new Error("Company Directory did not switch to the Factories register.");
  }
  const companyTab = page.locator(".costing-tabs button").filter({ hasText: "Companies" });
  await companyTab.click();
  if (!(await companyTab.getAttribute("class") || "").includes("costing-tab-active")) {
    throw new Error("Company Directory did not return to the Companies register.");
  }
  console.log("PASS Company Directory company/factory tab navigation");
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Customer Directory"]').click();
  const leadsTab = page.getByRole("tab", { name: /Lead Discovery/ });
  await leadsTab.click();
  await page.getByRole("heading", { name: "Lead Discovery" }).waitFor();
  await page.locator(".lead-discovery-safety").waitFor();
  console.log("PASS Customer Directory Lead Discovery panel");


  // Verify both module discovery surfaces open exact workspaces.
  await page.locator(".deck-action").filter({ hasText: "Modules" }).click();
  await page.getByRole("heading", { name: /module universe/i }).waitFor();
  if (!(await page.locator(".universe-footer").innerText()).includes("22 of 22 modules")) {
    throw new Error("Module Universe does not report all 22 modules.");
  }
  await page.locator(".universe-search input").fill("Route Flow");
  await page.locator(".universe-card").filter({ hasText: "Route Flow & Relationships" }).click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Route Flow & Relationships");
  await page.locator(".command-search").click();
  await page.locator(".command-palette input").fill("Quality Inspection");
  await page.locator(".command-palette .palette-results button").filter({ hasText: "Quality Inspection" }).click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Quality Inspection");
  console.log("PASS module universe and global command-search navigation");

  // Verify the new cross-module Manufacturing Universe graph and its preserved PO route mode.
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Manufacturing Universe"]').click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Manufacturing Universe");
  await page.locator(".ax-ecosystem-graph").waitFor({ timeout: 15000 });
  if (await page.locator(".ax-ecosystem-filters button").count() !== 13) {
    throw new Error("Manufacturing ecosystem graph does not expose all 12 entity filters.");
  }
  const sampleNote = await page.locator(".ax-ecosystem-sample-note").innerText();
  if (!sampleNote.includes("Show more") || !sampleNote.includes("Search results can select records beyond the current canvas limit")) {
    throw new Error("Manufacturing ecosystem graph must disclose progressive expansion and search beyond the visible canvas.");
  }
  if (!(await page.locator(".ax-ecosystem-graph-count").innerText()).includes("saved records in these groups")) {
    throw new Error("Manufacturing ecosystem graph header must distinguish rendered nodes from saved-record totals.");
  }
  const graphSearch = page.getByRole("searchbox", { name: "Search all manufacturing ecosystem records" });
  await graphSearch.fill("record-that-does-not-exist");
  await page.locator(".ax-ecosystem-search-results p").waitFor({ timeout: 5000 });
  if (!(await page.locator(".ax-ecosystem-search-results p").innerText()).includes("No matching saved records.")) {
    throw new Error("Manufacturing Universe did not show the no-match search state.");
  }
  const clearGraphSearch = page.getByRole("button", { name: "Clear graph search" });
  await clearGraphSearch.evaluate(element => element.scrollIntoView({ block: "center", inline: "center" }));
  await clearGraphSearch.click();
  if (await page.locator(".ax-ecosystem-search-results").count() !== 0) {
    throw new Error("Clearing Manufacturing Universe graph search did not close the results panel.");
  }
  await page.locator('select[aria-label="Ecosystem export format"]').selectOption("csv");
  const ecosystemDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export graph" }).click();
  const ecosystemDownload = await ecosystemDownloadPromise;
  if (ecosystemDownload.suggestedFilename() !== "aximach-manufacturing-ecosystem.csv") {
    throw new Error("Manufacturing ecosystem CSV export returned an unexpected filename: " + ecosystemDownload.suggestedFilename());
  }
  console.log("PASS Manufacturing Universe CSV graph export");
  const companiesFilter = page.locator(".ax-ecosystem-filters button").filter({ hasText: "Companies" });
  await companiesFilter.click();
  if (await companiesFilter.getAttribute("aria-pressed") !== "false") {
    throw new Error("Manufacturing ecosystem entity filter did not toggle off.");
  }
  await companiesFilter.click();
  await page.getByRole("button", { name: /PO route/i }).click();
  if (await page.locator(".manufacturing-universe-empty").count() !== 1 && await page.locator(".process-universe-3d").count() !== 1) {
    throw new Error("Manufacturing Universe did not preserve its PO route scene.");
  }
  await page.getByRole("button", { name: /Ecosystem/i }).click();
  await page.locator(".ax-ecosystem-graph").waitFor();
  console.log("PASS Manufacturing Universe ecosystem graph, 12 filters and preserved PO route view");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  // Verify the mobile Dashboard keeps its separate live six-record 3D shell visible.
  const mobileRecordShell = page.locator(".ax-orb-lower-shell");
  await mobileRecordShell.waitFor({ state: "attached", timeout: 10000 });
  await mobileRecordShell.scrollIntoViewIfNeeded();
  const mobileRecordShellState = await mobileRecordShell.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return {
      display: style.display,
      width: bounds.width,
      height: bounds.height,
      bottomGap: window.innerHeight - bounds.bottom,
      nodeCount: element.querySelectorAll(".ax-orb-lower-node").length
    };
  });
  if (mobileRecordShellState.display === "none" || mobileRecordShellState.width <= 0 || mobileRecordShellState.height <= 0 || mobileRecordShellState.nodeCount !== 6 || mobileRecordShellState.bottomGap < 0) {
    throw new Error("Mobile live 3D record shell is not visible or does not expose all six nodes: " + JSON.stringify(mobileRecordShellState));
  }
  console.log("PASS mobile live 3D record shell:", JSON.stringify(mobileRecordShellState));

  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Purchase Orders"]').click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Purchase Orders");
  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  console.log("PASS responsive mobile navigation and Purchase Orders workspace");
  console.log("PASS browser smoke: 22 module routes, Company/Factory tabs, module explorer, global search, desktop and mobile navigation, no renderer page errors");
} finally {
  if (browser) await browser.close();
  preview.kill("SIGTERM");
}
