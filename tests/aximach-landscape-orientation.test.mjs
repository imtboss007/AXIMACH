import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("AXIMACH includes the Capacitor 7 screen-orientation plugin", () => {
  const pkg = JSON.parse(read("../package.json"));
  assert.equal(pkg.dependencies["@capacitor/screen-orientation"], "7.0.4");
  assert.ok(pkg.scripts["test:server"].includes("tests/aximach-landscape-orientation.test.mjs"));
});

test("all touch devices default to portrait instead of forcing landscape on workspace entry", () => {
  const app = read("../src/App.tsx");
  assert.ok(app.includes('const [landscapeCanvasOpen,setLandscapeCanvasOpen] = useState(false)'));
  assert.ok(app.includes('const targetOrientation = needsLandscapeOrientation && landscapeCanvasOpen ? "landscape-primary" : "portrait-primary"'));
  assert.ok(app.includes('setLandscapeCanvasOpen(false)'));
  assert.ok(app.includes('if (!isTouchViewport)'));
});

test("only Process Map, Route Flow and Manufacturing Universe expose the optional landscape canvas control", () => {
  const app = read("../src/App.tsx");
  assert.ok(app.includes('activeModuleId === "process-map"'));
  assert.ok(app.includes('activeModuleId === "route-flow"'));
  assert.ok(app.includes('activeModuleId === "manufacturing-universe"'));
  assert.ok(app.includes('needsLandscapeOrientation && isTouchViewport && <button type="button" className="ax-orientation-toggle"'));
  assert.ok(app.includes('onClick={() => void toggleLandscapeCanvas()}'));
  assert.ok(app.includes('aria-label={landscapeCanvasOpen ? "Return to portrait layout" : "Open landscape canvas"}'));
  assert.ok(app.includes('requestDeviceOrientation(next ? "landscape-primary" : "portrait-primary")'));
});

test("phone Process Map defaults to the compact graph and restores 3D in landscape", () => {
  const workspace = read("../src/LinkedProcessWorkspace.tsx");
  assert.ok(workspace.includes('window.matchMedia("(pointer:coarse)").matches && window.matchMedia("(orientation:portrait)").matches ? "graph" : "sphere"'));
  assert.ok(workspace.includes('window.addEventListener("orientationchange",syncResponsiveProcessView)'));
  assert.ok(workspace.includes('portrait && current === "sphere" ? "graph" : !portrait && current === "graph" ? "sphere" : current'));
  assert.ok(workspace.includes('["graph","sphere","cube"'));
  assert.ok(workspace.includes('className={"linked-node-scroll process-visual-"+visualStyle'));
});

test("leaving a spatial workspace resets the optional landscape mode and restores portrait", () => {
  const app = read("../src/App.tsx");
  assert.ok(app.includes('setLandscapeCanvasOpen(false);\n    setOrientationLockUnavailable(false);\n    setModuleContext(context ?? (activeDemoRecordCount > 0 ? ASTER_EXAMPLE_CONTEXT : {}));'));
  assert.ok(app.includes('needsLandscapeOrientation && landscapeCanvasOpen ? "landscape-primary" : "portrait-primary"'));
  assert.ok(app.includes('void CapacitorScreenOrientation.unlock().catch(() => undefined)'));
});

test("orientation-lock failure is non-blocking and preserves the portrait workspace", () => {
  const app = read("../src/App.tsx");
  const css = read("../src/aximach-ui.css");
  assert.ok(app.includes("Automatic rotation is unavailable."));
  assert.ok(app.includes("portrait remains available."));
  assert.ok(app.includes('className="ax-orientation-fallback"'));
  assert.ok(css.includes(".ax-orientation-fallback"));
  assert.ok(!app.includes("Landscape view required"));
  assert.ok(!app.includes("orientationHintDismissed"));
});

test("mobile navigation uses a full-width page and off-canvas drawer rather than a permanent 52px rail", () => {
  const css = read("../src/aximach-ui.css");
  assert.ok(css.includes("AXIMACH phone-first shell"));
  assert.ok(css.includes(".app-shell:has(.linked-process-page) .page-content"));
  assert.ok(css.includes("inset:calc(58px + env(safe-area-inset-top)) 0 0 0!important"));
  assert.ok(css.includes(".app-shell .command-rail.mobile-nav-open"));
  assert.ok(css.includes(".rail-appearance-setting"));
  assert.ok(css.includes(".ax-orientation-toggle"));
});

test("portrait Route Flow uses a vertical stage list and all graph canvases fit the phone viewport", () => {
  const css = read("../src/aximach-ui.css");
  assert.ok(css.includes(".route-flow-stage-track{\n    display:flex!important;flex-direction:column!important"));
  assert.ok(css.includes(".route-flow-graph-canvas,.process-map-graph-canvas,.ax-ecosystem-flow-canvas"));
  assert.ok(css.includes("height:clamp(320px,52dvh,500px)!important"));
  assert.ok(css.includes(".process-map-graph-canvas .react-flow__minimap,.route-flow-graph-canvas .react-flow__minimap,.ax-ecosystem-flow-canvas .react-flow__minimap"));
});

test("landscape expansion gives the three spatial canvases the available viewport height", () => {
  const app = read("../src/App.tsx");
  const css = read("../src/aximach-ui.css");
  assert.ok(app.includes('data-landscape-canvas-open={landscapeCanvasOpen ? "true" : "false"}'));
  assert.ok(css.includes('.app-shell[data-phone-viewport="true"][data-landscape-canvas-open="true"] .ax-full3d-scene'));
  assert.ok(css.includes('.app-shell[data-phone-viewport="true"][data-landscape-canvas-open="true"] .route-flow-graph-canvas'));
});

test("Exiting only the Process Map graph fullscreen does not unlock the workspace orientation", () => {
  const processMap = read("../src/LinkedProcessWorkspace.tsx");
  const fullscreenControls = read("../src/ImmersiveWorkspaceControls.tsx");
  assert.ok(processMap.includes("The app-level landscape lock remains active until Process Map is closed."));
  assert.ok(!processMap.includes("orientation?.unlock?.()"));
  assert.ok(!processMap.includes('orientation?.lock("landscape")'));
  assert.ok(!fullscreenControls.includes("orientation?.unlock?.()"));
});

test("short-landscape workspaces retain compact graph canvas sizing after an explicit orientation switch", () => {
  const css = read("../src/aximach-ui.css");
  assert.ok(css.includes("@media (orientation:landscape) and (max-height:600px) and (max-width:1100px)"));
  assert.ok(css.includes(".route-flow-graph-canvas"));
  assert.ok(css.includes(".process-map-graph-canvas"));
  assert.ok(css.includes(".ax-ecosystem-flow-canvas"));
  assert.ok(css.includes("min-height:220px"));
});
