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
    const followUpDockCount = await page.locator(".ax-followup-assignment-dock").count();
    if (id === "companies" && followUpDockCount !== 1) throw new Error("Follow-up launcher should remain available in Company Directory.");
    if ((id === "route-flow" || id === "manufacturing-universe") && followUpDockCount !== 0) throw new Error("Follow-up launcher must not cover immersive workspace: " + id);
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

  // Seed the browser-only workspace with isolated synthetic records so the
  // Process Map visual acceptance check cannot silently pass with an empty scene.
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Data Exchange Centre"]').click();
  await page.getByRole("button", { name: "Import Demo Factory" }).waitFor({ timeout: 10000 });
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Import Demo Factory" }).click();
  await page.locator(".demo-pill").filter({ hasText: "DEMO LOADED" }).waitFor({ timeout: 10000 });
  // The selected company, PO line and visible process labels below are the
  // authoritative proof that this import supplied usable manufacturing records.
  console.log("PASS isolated Demo Factory fixture loaded for populated Process Map visual checks");

  // Verify that an Android-sized phone starts in portrait layout with a full-width
  // workspace and a drawer; spatial workspaces offer landscape only on request.
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobileErrors = [];
  mobilePage.on("pageerror", error => mobileErrors.push(error.message));
  await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });
  await mobilePage.locator("nav.command-rail").waitFor({ state: "attached" });
  const mobileGeometry = await mobilePage.evaluate(() => {
    const page = document.querySelector("main.page-content");
    const rect = page?.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      pageLeft: rect?.left ?? -1,
      pageWidth: rect?.width ?? 0,
      headerHeight: document.querySelector(".command-deck")?.getBoundingClientRect().height ?? 0
    };
  });
  if (mobileGeometry.documentWidth > mobileGeometry.viewportWidth + 1) {
    throw new Error("Portrait mobile shell has horizontal page overflow: " + JSON.stringify(mobileGeometry));
  }
  if (mobileGeometry.pageLeft > 1 || mobileGeometry.pageWidth < mobileGeometry.viewportWidth - 2 || mobileGeometry.headerHeight < 50) {
    throw new Error("Portrait mobile shell does not use the full viewport: " + JSON.stringify(mobileGeometry));
  }
  await mobilePage.getByRole("button", { name: "Open navigation menu" }).click();
  const mobileNavigation = mobilePage.locator("nav.command-rail");
  await mobileNavigation.locator('button[title="Route Flow & Relationships"]').waitFor({ state: "visible" });
  await mobileNavigation.locator('button[title="Route Flow & Relationships"]').click();
  const landscapeToggle = mobilePage.getByRole("button", { name: "Open landscape canvas" });
  await landscapeToggle.waitFor({ state: "visible", timeout: 10000 });
  // Route Flow is lazy-loaded; wait for the workspace shell before measuring
  // its actual portrait viewport bounds.
  await mobilePage.locator(".route-flow-workspace").waitFor({ state: "visible", timeout: 15000 });
  if (await landscapeToggle.getAttribute("aria-pressed") !== "false") {
    throw new Error("Route Flow must start in portrait with landscape mode off.");
  }
  if (await mobilePage.locator(".ax-landscape-rotate-prompt").count() !== 0) {
    throw new Error("Portrait-first Route Flow must not show a blocking landscape prompt.");
  }
  const routePortraitGeometry = await mobilePage.evaluate(() => {
    const page = document.querySelector("main.page-content");
    const canvas = document.querySelector(".route-flow-workspace");
    const rect = canvas?.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      pageLeft: page?.getBoundingClientRect().left ?? -1,
      canvasLeft: rect?.left ?? -1,
      canvasRight: rect?.right ?? Number.POSITIVE_INFINITY,
      canvasWidth: rect?.width ?? 0
    };
  });
  if (routePortraitGeometry.documentWidth > routePortraitGeometry.viewportWidth + 1 || routePortraitGeometry.pageLeft > 1 || routePortraitGeometry.canvasLeft < 0 || routePortraitGeometry.canvasRight > routePortraitGeometry.viewportWidth + 1 || routePortraitGeometry.canvasWidth < 250) {
    throw new Error("Route Flow does not fit portrait width: " + JSON.stringify(routePortraitGeometry));
  }
  console.log("PASS portrait-first Android viewport, full-width Route Flow, mobile drawer and opt-in landscape control");
  await mobilePage.close();

  // A landscape tablet can expose both a precise primary pointer and a touch
  // pointer. It must still use the compact touch shell rather than the desktop
  // header that previously squeezed workspace controls into overlapping rows.
  const hybridTouchPage = await browser.newPage({
    viewport: { width: 1365, height: 620 },
    hasTouch: true,
    isMobile: false
  });
  const hybridErrors = [];
  hybridTouchPage.on("pageerror", error => hybridErrors.push(error.message));
  await hybridTouchPage.goto(baseUrl, { waitUntil: "networkidle" });
  await hybridTouchPage.locator("nav.command-rail").waitFor({ state: "attached" });
  const hybridShell = await hybridTouchPage.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      const bounds = element?.getBoundingClientRect();
      return bounds ? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width } : null;
    };
    const display = selector => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).display : "missing";
    };
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      anyCoarse: matchMedia("(any-pointer: coarse)").matches,
      primaryCoarse: matchMedia("(pointer: coarse)").matches,
      mobileMenuDisplay: display(".mobile-nav-trigger"),
      desktopSwitcherDisplay: display(".factory-switcher"),
      ribbonDisplay: display(".status-ribbon"),
      header: rect(".command-deck"),
      page: rect("main.page-content"),
      phoneViewport: document.querySelector(".app-shell")?.getAttribute("data-phone-viewport")
    };
  });
  if (!hybridShell.anyCoarse || hybridShell.phoneViewport !== "true") {
    throw new Error("Hybrid touch viewport was not identified: " + JSON.stringify(hybridShell));
  }
  if (hybridShell.mobileMenuDisplay === "none" || hybridShell.desktopSwitcherDisplay !== "none" || hybridShell.ribbonDisplay !== "none") {
    throw new Error("Hybrid touch viewport retained the crowded desktop header or status ribbon: " + JSON.stringify(hybridShell));
  }
  if (hybridShell.documentWidth > hybridShell.viewportWidth + 1 ||
      !hybridShell.header || !hybridShell.page ||
      hybridShell.page.top < hybridShell.header.bottom - 1 ||
      hybridShell.page.right > hybridShell.viewportWidth + 1) {
    throw new Error("Hybrid touch shell has viewport overflow or header/content collision: " + JSON.stringify(hybridShell));
  }

  const hybridNavigation = hybridTouchPage.locator("nav.command-rail");
  await hybridTouchPage.getByRole("button", { name: "Open navigation menu" }).click();
  await hybridNavigation.locator('button[title="Route Flow & Relationships"]').click();
  await hybridTouchPage.locator(".route-flow-workspace").waitFor({ state: "visible", timeout: 15000 });
  const routeTouchLayout = await hybridTouchPage.evaluate(() => {
    const head = document.querySelector(".route-flow-workspace-head");
    const title = head?.firstElementChild?.getBoundingClientRect();
    const actions = head?.querySelector(".route-flow-head-actions")?.getBoundingClientRect();
    const scope = document.querySelector(".route-flow-scope-bar")?.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      headDirection: head ? getComputedStyle(head).flexDirection : "missing",
      titleBottom: title?.bottom ?? -1,
      actionsTop: actions?.top ?? -1,
      scopeLeft: scope?.left ?? -1,
      scopeRight: scope?.right ?? Number.POSITIVE_INFINITY
    };
  });
  if (routeTouchLayout.headDirection !== "column" ||
      routeTouchLayout.actionsTop < routeTouchLayout.titleBottom - 1 ||
      routeTouchLayout.documentWidth > routeTouchLayout.viewportWidth + 1 ||
      routeTouchLayout.scopeLeft < 0 ||
      routeTouchLayout.scopeRight > routeTouchLayout.viewportWidth + 1) {
    throw new Error("Route Flow header, controls or selectors collide on a hybrid touch tablet: " + JSON.stringify(routeTouchLayout));
  }

  await hybridTouchPage.getByRole("button", { name: "Open navigation menu" }).click();
  await hybridNavigation.locator('button[title="Manufacturing Universe"]').click();
  await hybridTouchPage.locator(".manufacturing-universe-workspace").waitFor({ state: "visible", timeout: 15000 });
  const universeTouchLayout = await hybridTouchPage.evaluate(() => {
    const head = document.querySelector(".manufacturing-universe-head");
    const title = head?.firstElementChild?.getBoundingClientRect();
    const actions = head?.querySelector(".manufacturing-universe-actions")?.getBoundingClientRect();
    const scope = document.querySelector(".manufacturing-universe-scope")?.getBoundingClientRect();
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      headDirection: head ? getComputedStyle(head).flexDirection : "missing",
      titleBottom: title?.bottom ?? -1,
      actionsTop: actions?.top ?? -1,
      scopeLeft: scope?.left ?? -1,
      scopeRight: scope?.right ?? Number.POSITIVE_INFINITY,
      landscapeToggle: document.querySelector(".ax-orientation-toggle")?.getAttribute("aria-label") || "missing"
    };
  });
  if (universeTouchLayout.headDirection !== "column" ||
      universeTouchLayout.actionsTop < universeTouchLayout.titleBottom - 1 ||
      universeTouchLayout.documentWidth > universeTouchLayout.viewportWidth + 1 ||
      universeTouchLayout.scopeLeft < 0 ||
      universeTouchLayout.scopeRight > universeTouchLayout.viewportWidth + 1 ||
      universeTouchLayout.landscapeToggle === "missing") {
    throw new Error("Manufacturing Universe header, controls or selectors collide on a hybrid touch tablet: " + JSON.stringify(universeTouchLayout));
  }
  if (hybridErrors.length) throw new Error("Hybrid touch viewport runtime errors: " + hybridErrors.join(" | "));
  console.log("PASS hybrid-touch tablet: compact navigation, non-overlapping Route Flow and Manufacturing Universe workspaces");
  await hybridTouchPage.close();

  // Verify both module discovery surfaces open exact workspaces.
  await page.locator(".deck-action").filter({ hasText: "Modules" }).click();
  await page.getByRole("heading", { name: /module universe/i }).waitFor();
  if (!(await page.locator(".universe-footer").innerText()).includes("22 of 22 modules")) {
    throw new Error("Module Universe does not report all 22 modules.");
  }
  await page.locator(".universe-search input").fill("Route Flow");
  await page.locator(".universe-card").filter({ hasText: "Route Flow & Relationships" }).click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Route Flow & Relationships");
  const routeGraphToggle = page.getByRole("button", { name: "Interactive graph" });
  await routeGraphToggle.waitFor({ timeout: 10000 });
  await routeGraphToggle.click();
  await page.getByRole("button", { name: "Stage cards" }).waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: "Stage cards" }).click();
  await page.getByRole("button", { name: "Interactive graph" }).waitFor({ timeout: 10000 });
  console.log("PASS Route Flow graph/stage-card view toggle");
  await page.getByRole("button", { name: "Open Process Plan" }).click();
  await page.locator(".linked-process-page > .workspace-title-row h1").waitFor({ timeout: 10000 });

  // Select a real synthetic PO line with five or more operation labels, material and transport.
  const companyPicker = page.getByRole("combobox", { name: "Company" });
  await companyPicker.fill("ASTER MOTION COMPONENTS");
  await page.getByRole("option", { name: /ASTER MOTION COMPONENTS PVT LTD/ }).click();
  const poPicker = page.getByRole("combobox", { name: "Purchase order" });
  await poPicker.fill("DEMO-PO-001");
  await page.getByRole("option", { name: /DEMO-PO-001/ }).click();
  const linePicker = page.getByRole("combobox", { name: "PO component line" });
  await linePicker.fill("AST-1001");
  await page.getByRole("option", { name: /AST-1001/ }).click();
  await page.waitForFunction(() => document.querySelectorAll(".ax-full3d-label-layer .ax-full3d-label, .ax-full3d-label-layer .ax-full3d-core-label, .ax-full3d-label-layer .ax-full3d-transport-icon").length >= 5, null, { timeout: 10000 });

  if (await page.locator(".ax-followup-assignment-dock").count() !== 0) throw new Error("Follow-up launcher must not overlay Process Map.");
  const sceneLabels = page.locator(".ax-full3d-label-layer .ax-full3d-label, .ax-full3d-label-layer .ax-full3d-core-label, .ax-full3d-label-layer .ax-full3d-transport-icon");
  const readSceneRects = () => sceneLabels.evaluateAll(elements => elements.map(element => { const r = element.getBoundingClientRect(); return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}; }).filter(r => r.width > 0 && r.height > 0));
  const assertCollisionFreeScene = async label => {
    const rects = await readSceneRects();
    if (rects.length < 5) throw new Error("Populated Process Map rendered too few visible 3D labels (" + rects.length + ") for a meaningful collision check.");
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      if (a.x < b.right + 4 && a.right + 4 > b.x && a.y < b.bottom + 4 && a.bottom + 4 > b.y) {
        throw new Error(label + " — rendered 3D process labels overlap: " + JSON.stringify({a,b}));
      }
    }
    console.log("PASS", label, "collision-free rendered 3D label rectangles:", rects.length);
  };
  await assertCollisionFreeScene("desktop Process Map");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(350);
  await page.waitForFunction(() => document.querySelectorAll(".ax-full3d-label-layer .ax-full3d-label, .ax-full3d-label-layer .ax-full3d-core-label, .ax-full3d-label-layer .ax-full3d-transport-icon").length >= 5, null, { timeout: 10000 });
  await assertCollisionFreeScene("short-landscape mobile-sized Process Map");
  const processGraphMode = page.getByRole("button", { name: "Interactive Graph" });
  await processGraphMode.waitFor({ timeout: 10000 });
  await processGraphMode.click();
  if (await processGraphMode.getAttribute("aria-pressed") !== "true") {
    throw new Error("Process Map Interactive Graph view did not become active.");
  }
  console.log("PASS Process Map Interactive Graph view selection");
  // Return to the desktop shell before desktop-only command search assertions.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(200);
  await page.locator(".command-search").click();
  await page.locator(".command-palette input").fill("Quality Inspection");
  await page.locator(".command-palette .palette-results button").filter({ hasText: "Quality Inspection" }).click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Quality Inspection");
  console.log("PASS module universe and global command-search navigation");

  // Verify the new cross-module Manufacturing Universe graph and its preserved PO route mode.
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Manufacturing Universe"]').click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Manufacturing Universe");
  await page.locator(".ax-ecosystem-graph").waitFor({ timeout: 15000 });
  await page.locator('[data-testid="ecosystem-flow-canvas"] .react-flow__renderer').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="ecosystem-flow-canvas"] .react-flow__controls').waitFor({ timeout: 10000 });
  await page.locator('[data-testid="ecosystem-flow-canvas"] .react-flow__minimap').waitFor({ timeout: 10000 });
  if (await page.locator('[data-testid="ecosystem-flow-canvas"] .react-flow__node-hub').count() !== 1) {
    throw new Error("Manufacturing Universe React Flow canvas is missing its AXIMACH graph hub.");
  }
  console.log("PASS Manufacturing Universe React Flow canvas, viewport controls and minimap");
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
