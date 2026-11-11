import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("AXIMACH includes the Capacitor 7 screen-orientation plugin", () => {
  const pkg = JSON.parse(read("../package.json"));
  assert.equal(pkg.dependencies["@capacitor/screen-orientation"], "7.0.4");
  assert.ok(pkg.scripts["test:server"].includes("tests/aximach-landscape-orientation.test.mjs"));
});

test("Route Graph, Route Flow and Manufacturing Universe lock the phone to landscape on entry", () => {
  const app = read("../src/App.tsx");
  assert.ok(app.includes('activeModuleId === "process-map"'));
  assert.ok(app.includes('activeModuleId === "route-flow"'));
  assert.ok(app.includes('activeModuleId === "manufacturing-universe"'));
  assert.ok(app.includes('ScreenOrientation.lock({ orientation: "landscape-primary" })'));
  assert.ok(app.includes('window.matchMedia("(max-width: 900px)")'));
});

test("Landscape orientation is released when leaving the three route workspaces", () => {
  const app = read("../src/App.tsx");
  assert.ok(app.includes("void ScreenOrientation.unlock().catch(() => undefined)"));
  assert.ok(app.includes("return () => {\n      disposed = true;"));
});

test("A browser that cannot lock orientation shows a rotate-device fallback", () => {
  const app = read("../src/App.tsx");
  const css = read("../src/aximach-ui.css");
  assert.ok(app.includes("orientationLockUnavailable"));
  assert.ok(app.includes("Landscape view required"));
  assert.ok(app.includes("Try landscape again"));
  assert.ok(css.includes(".ax-landscape-rotate-prompt"));
  assert.ok(css.includes("@media (orientation:portrait) and (max-width:900px)"));
});

test("Exiting only the Process Map graph fullscreen does not unlock the workspace orientation", () => {
  const processMap = read("../src/LinkedProcessWorkspace.tsx");
  const fullscreenControls = read("../src/ImmersiveWorkspaceControls.tsx");
  assert.ok(processMap.includes("The app-level landscape lock remains active until Process Map is closed."));
  assert.ok(!processMap.includes("orientation?.unlock?.()"));
  assert.ok(!processMap.includes("orientation?.lock(\"landscape\")"));
  assert.ok(!fullscreenControls.includes("orientation?.unlock?.()"));
});

test("Route Flow, Route Graph and Manufacturing Universe have compact short-landscape canvas rules", () => {
  const css = read("../src/aximach-ui.css");
  assert.ok(css.includes("@media (orientation:landscape) and (max-height:600px) and (max-width:1100px)"));
  assert.ok(css.includes(".route-flow-stage-scroll{min-height:0;max-height:calc(100dvh - 190px)"));
  assert.ok(css.includes(".linked-process-page .process-route-flow-track{max-height:calc(100dvh - 190px)"));
  assert.ok(css.includes(".manufacturing-universe-live-panel .process-orbit-scene,.manufacturing-universe-live-panel .process-scene-stage{min-height:280px!important}"));
});
