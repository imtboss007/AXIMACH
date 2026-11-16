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
  if (await page.locator("[data-aximach-startup-error='true']").count()) {
    throw new Error("AXIMACH renderer startup error: " + await page.locator("[data-aximach-startup-error='true']").innerText());
  }

  const modules = [
    ["Company Directory", "companies"],
    ["Component Directory", "components"],
    ["Purchase Orders", "purchasing"],
    ["Vendor Directory", "vendors"],
    ["Transport Directory", "transport-master"],
    ["Contact 360", "contact360"],
    ["Process Directory", "process-master"],
    ["Component Planned Cost", "planned-cost"],
    ["Vendor Network", "vendor-capability"],
    ["Material Directory", "inventory"],
    ["Production Plan", "production"],
    ["Process Map", "process-map"],
    ["Route Flow & Relationships", "route-flow"],
    ["Manufacturing Universe", "manufacturing-universe"],
    ["Transport & Dispatch", "dispatch"],
    ["Quality Inspection", "quality"],
    ["Costing & Payment", "costing"],
    ["Follow-up Centre", "communications"],
    ["Reports & Analytics", "reports"],
    ["AI Insights", "ai-insights"],
    ["Data Exchange Centre", "export"]
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

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Purchase Orders"]').click();
  await page.waitForFunction(() => document.querySelector('nav[aria-label="AXIMACH navigation"] .rail-active')?.getAttribute("title") === "Purchase Orders");
  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  console.log("PASS responsive mobile navigation and Purchase Orders workspace");

  // Verify the Process Map, Route Flow and Manufacturing Universe links in both directions.
  await page.locator('nav[aria-label="AXIMACH navigation"] button[title="Process Map"]').click();
  await page.locator("h1").filter({ hasText: "Process Map" }).waitFor({ timeout: 15000 });
  const processTabs = page.locator('nav[aria-label="Linked component workspaces"]');
  await processTabs.getByRole("button", { name: "Route Flow" }).click();
  await page.locator("h1").filter({ hasText: "Route Flow" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator("h1").filter({ hasText: "Process Map" }).waitFor({ timeout: 15000 });

  await processTabs.getByRole("button", { name: "Manufacturing Universe" }).click();
  await page.locator("h1").filter({ hasText: "Manufacturing" }).waitFor({ timeout: 15000 });
  const universeLinks = page.locator(".manufacturing-universe-links-grid");
  await universeLinks.getByRole("button", { name: /Route Flow & Relationships/ }).click();
  await page.locator("h1").filter({ hasText: "Route Flow" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator("h1").filter({ hasText: "Manufacturing" }).waitFor({ timeout: 15000 });
  await universeLinks.getByRole("button", { name: "Process Map" }).click();
  await page.locator("h1").filter({ hasText: "Process Map" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator("h1").filter({ hasText: "Manufacturing" }).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Back" }).click();
  await page.locator("h1").filter({ hasText: "Process Map" }).waitFor({ timeout: 15000 });

  if (pageErrors.length) throw new Error("Browser runtime errors: " + pageErrors.join(" | "));
  console.log("PASS route workspace links: Process Map ↔ Route Flow ↔ Manufacturing Universe, navigation history and Back controls");
  console.log("PASS browser smoke: 21 module routes, desktop navigation, mobile navigation, route workspace links, no renderer page errors");
} finally {
  if (browser) await browser.close();
  preview.kill("SIGTERM");
}
