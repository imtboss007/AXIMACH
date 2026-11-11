import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const baseURL = "http://127.0.0.1:4179";
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

function assertNoBlankOrCrash(page, label) {
  return page.evaluate((name) => {
    const root = document.querySelector("#root");
    const shell = document.querySelector(".app-shell");
    const fatal = document.querySelector('[data-aximach-startup-error="true"]');
    const bodyText = (root?.innerText || "").trim();
    if (!root || !shell || fatal || bodyText.length < 10) {
      throw new Error(name + ": blank screen or startup failure");
    }
    return { textLength: bodyText.length, title: document.title };
  }, label);
}

async function main() {
  await waitForServer();
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    localStorage.setItem("aximach.storage.mode", "local-only");
    localStorage.setItem("aximach.legacy-demo-cleanup.v2", "done");
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.locator(".app-shell").waitFor({ state: "visible", timeout: 20000 });
  await assertNoBlankOrCrash(page, "initial dashboard");

  const moduleButtons = page.locator('nav[aria-label="AXIMACH navigation"] button[title]');
  const moduleCount = await moduleButtons.count();
  if (moduleCount !== 22) throw new Error("Expected 22 command-centre/module navigation entries (dashboard, command centre, 20 modules); found " + moduleCount);
  const moduleTitles = [];
  for (let index = 0; index < moduleCount; index++) {
    const title = await moduleButtons.nth(index).getAttribute("title");
    if (title) moduleTitles.push(title);
  }

  const moduleResults = [];
  for (const title of moduleTitles) {
    const button = page.locator('nav[aria-label="AXIMACH navigation"] button[title="' + title.replaceAll('"', '\\"') + '"]');
    await button.click();
    await page.waitForTimeout(350);
    const result = await assertNoBlankOrCrash(page, title);
    const active = await button.evaluate(el => el.classList.contains("rail-active"));
    if (!active) throw new Error(title + ": navigation item did not become active");
    const workspaceText = await page.locator(".page-content").innerText();
    if (!workspaceText.trim()) throw new Error(title + ": empty workspace content");
    moduleResults.push({ title, chars: result.textLength });
  }

  // Exercise every visible select option in each module without submitting forms.
  // This validates option rendering and controlled-state changes; destructive writes are
  // deliberately isolated to dedicated CRUD tests, never clicked blindly.
  const optionResults = [];
  for (const title of moduleTitles) {
    await page.locator('nav[aria-label="AXIMACH navigation"] button[title="' + title.replaceAll('"', '\\"') + '"]').click();
    await page.waitForTimeout(250);
    const selects = page.locator(".page-content select:visible");
    const count = await selects.count();
    let optionsChecked = 0;
    for (let i = 0; i < count; i++) {
      const select = selects.nth(i);
      const values = await select.locator("option").evaluateAll(nodes => nodes.map(node => node.value).filter(value => value !== ""));
      for (const value of values) {
        await select.selectOption(value).catch(async error => {
          // Disabled/filtered dependent options are recorded as a test failure, not ignored.
          throw new Error(title + ": select " + i + " option " + value + " failed: " + error.message);
        });
        optionsChecked++;
        await page.waitForTimeout(30);
      }
    }
    await assertNoBlankOrCrash(page, title + " after selector sweep");
    optionResults.push({ title, selects: count, optionsChecked });
  }

  // Exercise safe buttons (navigation, open/close, view toggles, filters and tabs).
  // Buttons that persist, delete, send, dispatch, approve, or otherwise mutate business
  // records are excluded from this blind sweep and are covered by explicit CRUD fixtures.
  const blocked = /\b(save|update|delete|remove|archive|submit|send|dispatch|approve|reject|complete|finish|import|export|download|upload|connect|disconnect|schedule|confirm|pay|post|create|add record)\b/i;
  const safeButtonResults = [];
  for (const title of moduleTitles) {
    await page.locator('nav[aria-label="AXIMACH navigation"] button[title="' + title.replaceAll('"', '\\"') + '"]').click();
    await page.waitForTimeout(200);
    const buttons = page.locator(".page-content button:visible:not(:disabled)");
    const count = await buttons.count();
    let clicked = 0;
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const label = ((await button.innerText().catch(() => "")) + " " + (await button.getAttribute("aria-label") || "") + " " + (await button.getAttribute("title") || "")).trim();
      if (blocked.test(label)) continue;
      if (!label) continue;
      await button.click({ timeout: 2500 }).catch(error => {
        throw new Error(title + ": visible button '" + label + "' could not be clicked: " + error.message);
      });
      clicked++;
      await page.waitForTimeout(50);
      await assertNoBlankOrCrash(page, title + " after button " + label);
      await page.keyboard.press("Escape").catch(() => {});
    }
    safeButtonResults.push({ title, visible: count, clicked });
  }

  // Responsive viewport acceptance: route workspaces must render without page-level
  // horizontal overflow or a clipped/blank canvas in both portrait and landscape sizes.
  const responsiveResults = [];
  for (const size of [{ name: "Android portrait", width: 393, height: 873 }, { name: "Android landscape", width: 873, height: 393 }]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const title of ["Process Plan", "Manufacturing Universe", "Route Flow & Relationships"]) {
      const target = title === "Process Plan" ? "Process Map" : title;
      const navButton = page.locator('nav[aria-label="AXIMACH navigation"] button[title="' + target + '"]');
      if (await navButton.count()) {
        await navButton.click();
        await page.waitForTimeout(450);
        const metrics = await page.evaluate(() => ({
          viewportWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          viewportHeight: document.documentElement.clientHeight,
          bodyHeight: document.documentElement.scrollHeight,
          visibleCanvas: Boolean(document.querySelector(".page-content")?.getBoundingClientRect().width)
        }));
        if (!metrics.visibleCanvas) throw new Error(size.name + " " + target + ": canvas is not visible");
        if (metrics.scrollWidth > metrics.viewportWidth + 8) throw new Error(size.name + " " + target + ": unexpected horizontal page overflow " + JSON.stringify(metrics));
        responsiveResults.push({ ...size, module: target, ...metrics });
      }
    }
  }

  if (pageErrors.length) throw new Error("Browser runtime exceptions: " + pageErrors.join(" | "));
  console.log(JSON.stringify({ modules: moduleResults, selectors: optionResults, safeButtons: safeButtonResults, responsive: responsiveResults, pageErrors }, null, 2));
}

try {
  await main();
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
