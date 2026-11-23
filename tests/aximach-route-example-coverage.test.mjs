import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const demo = read("../src/aximachDemoData.ts");
const route = read("../src/RouteFlowWorkspace.tsx");
const main = read("../src/main.tsx");
const visual = read("../src/aximach-visual-fixes.css");

const relationshipTypes = [
  "main", "alternate", "rework", "dependency", "parallel", "merge",
  "split", "follow-on", "feedback", "conditional", "successor"
];

test("removable manufacturing demo seeds all eleven persisted Route Flow relationship types", () => {
  for (const type of relationshipTypes) {
    assert.ok(demo.includes('type:"' + type + '"'), "demo relationship example missing: " + type);
  }
  assert.ok(demo.includes('routeRelationships.push(...examples.map'));
  assert.ok(demo.includes('routeRelationships,followUpAssignments'));
  assert.ok(demo.includes("SYNTHETIC DEMO RELATIONSHIP"));
});

test("Route Flow graph contains all PO-line operations and renders saved relationship edges", () => {
  assert.ok(route.includes('const lineOperations=routeOperations.filter'));
  assert.ok(route.includes('relationships.filter(link=>link.status!=="Disabled")'));
  assert.ok(route.includes('addEdge(link.fromOperationId,link.toOperationId,link.relationshipType'));
  assert.ok(route.includes('const existing=rows.findIndex(row=>row.fromId===fromId&&row.toId===toId&&row.type===type)'));
  assert.ok(route.includes('useState<"cards"|"graph">("graph")'));
  assert.ok(route.includes('sourceHandle:handles.source,targetHandle:handles.target'));
  for (const handle of ["source-right","source-left","source-top","source-bottom","target-right","target-left","target-top","target-bottom"]) {
    assert.ok(route.includes('id="' + handle + '"'), "missing distinct graph handle " + handle);
  }
  assert.ok(route.includes('parallel:{source:"source-bottom",target:"target-bottom"}'));
  assert.ok(route.includes('split:{source:"source-top",target:"target-right"}'));
});

test("global appearance fix is imported after the older AXIMACH stylesheet and enforces readable light text", () => {
  assert.ok(main.indexOf('import "./aximach-ui.css";') < main.indexOf('import "./aximach-visual-fixes.css";'));
  assert.ok(visual.includes('.app-shell[data-theme="light"]{'), "Theme tokens must be attached to the actual themed app shell.");
  assert.ok(!visual.includes(':root[data-theme="light"]'), "Theme tokens must not be scoped to an attribute the root element does not receive.");
  assert.ok(visual.includes('color:#12263f'), "Default body contrast must remain readable.");
  assert.ok(visual.includes('.app-shell[data-theme="light"] .workspace-title-row h1'));
  assert.ok(visual.includes('.route-flow-graph-node>strong'));
  assert.ok(visual.includes('.ax-full3d-label strong'));
  assert.ok(visual.includes("height:var(--ax-scene-label-content-height)!important"));
  assert.ok(visual.includes("height:var(--ax-scene-label-content-height,520px)!important"), "The WebGL scene must grow with the packed phone label plane.");
});
