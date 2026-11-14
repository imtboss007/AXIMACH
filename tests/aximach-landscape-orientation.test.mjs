import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Route Flow, Process Map and Manufacturing Universe never force device orientation", () => {
  const app = read("../src/App.tsx");
  assert.doesNotMatch(app, /CapacitorScreenOrientation\.lock/);
  assert.doesNotMatch(app, /needsLandscapeOrientation/);
  assert.doesNotMatch(app, /Landscape view required/);
  assert.doesNotMatch(app, /retryLandscapeOrientation/);
  assert.match(app, /activeModuleId === "route-flow"/);
  assert.match(app, /activeModuleId === "process-map"/);
  assert.match(app, /activeModuleId === "manufacturing-universe"/);
});

test("Process Map full-screen control does not require landscape", () => {
  const processMap = read("../src/LinkedProcessWorkspace.tsx");
  const fullscreenControls = read("../src/ImmersiveWorkspaceControls.tsx");
  assert.doesNotMatch(processMap, /landscape lock/i);
  assert.doesNotMatch(processMap, /Landscape orientation stays active/i);
  assert.doesNotMatch(processMap, /full-screen landscape/i);
  assert.match(processMap, /Open route in full screen/);
  assert.doesNotMatch(fullscreenControls, /orientation\?\.unlock/);
  assert.doesNotMatch(fullscreenControls, /orientation\?\.lock/);
});

test("Portrait layouts exist for Process Map route nodes and Manufacturing Universe", () => {
  const css = read("../src/aximach-ui.css");
  assert.ok(css.includes("@media (orientation:portrait) and (max-width:900px)"));
  assert.ok(css.includes(".linked-process-page .linked-node-scroll"));
  assert.ok(css.includes(".process-universe-viewport"));
  assert.ok(css.includes(".process-route-flow-track"));
});

test("Landscape-only rotate prompt is no longer required by the application", () => {
  const app = read("../src/App.tsx");
  assert.doesNotMatch(app, /ax-landscape-rotate-prompt/);
  assert.doesNotMatch(app, /Continue in portrait/);
});
