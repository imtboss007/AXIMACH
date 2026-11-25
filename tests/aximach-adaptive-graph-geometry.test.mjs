import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { routeRelationshipEdgeGeometry, routeRelationshipHandles } from "../src/manufacturingGraphLayout.mjs";

const types = ["main", "alternate", "rework", "dependency", "parallel", "merge", "split", "follow-on", "feedback", "conditional", "successor", "transport"];

test("relationship handles follow the actual geometry, including reversed and vertical links", () => {
  assert.deepEqual(routeRelationshipHandles("main", { x: 0, y: 0 }, { x: 300, y: 20 }), ["source-right", "target-left"]);
  assert.deepEqual(routeRelationshipHandles("feedback", { x: 300, y: 20 }, { x: 0, y: 0 }), ["source-left", "target-right"]);
  assert.deepEqual(routeRelationshipHandles("alternate", { x: 40, y: 0 }, { x: 70, y: 300 }), ["source-bottom", "target-top"]);
  assert.deepEqual(routeRelationshipHandles("rework", { x: 70, y: 300 }, { x: 40, y: 0 }), ["source-top", "target-bottom"]);
  assert.deepEqual(routeRelationshipHandles("transport", { x: 0, y: 0 }, { x: 300, y: 0 }), ["source-right", "target-left"]);
  const transportEdge = routeRelationshipEdgeGeometry("transport", { x: 0, y: 0 }, { x: 300, y: 0 }, "orthogonal");
  assert.equal(transportEdge.sourceHandle, "source-right-transport");
  assert.equal(transportEdge.targetHandle, "target-left-transport");
});

test("every manufacturing relationship has an explicit, renderable adaptive edge geometry", () => {
  for (const type of types) {
    const geometry = routeRelationshipEdgeGeometry(type, { x: 0, y: 0 }, { x: 300, y: 30 }, "s-curve");
    assert.equal(geometry.edgeType, "manufacturing", type + " must use the shared manufacturing edge renderer");
    const expectedHandles = type === "transport"
      ? ["source-right-transport", "target-left-transport"]
      : ["source-right", "target-left"];
    assert.deepEqual([geometry.sourceHandle, geometry.targetHandle], expectedHandles, type + " source/target direction");
    assert.ok(geometry.pathOptions && Object.keys(geometry.pathOptions).length > 0, type + " path options");
  }
});

test("curved layouts use Bezier paths rather than straight connectors", () => {
  for (const layout of ["s-curve", "horizontal", "timeline", "radial", "circular", "organic"]) {
    const geometry = routeRelationshipEdgeGeometry("main", { x: 0, y: 0 }, { x: 300, y: 0 }, layout);
    assert.equal(geometry.pathOptions.mode, "bezier", layout + " must use a Bezier curve");
    assert.ok(Number.isFinite(geometry.pathOptions.curvature));
    assert.ok(geometry.pathOptions.curvature > 0, layout + " curvature must be positive");
  }
});

test("orthogonal and swimlane layouts use rounded routed connectors", () => {
  for (const layout of ["orthogonal", "vertical", "swimlane"]) {
    const geometry = routeRelationshipEdgeGeometry("main", { x: 0, y: 0 }, { x: 0, y: 300 }, layout);
    assert.equal(geometry.pathOptions.mode, "smoothstep", layout + " must use an orthogonal route");
    assert.ok(geometry.pathOptions.borderRadius > 0, layout + " corners must be rounded");
    assert.ok(geometry.pathOptions.offset > 0, layout + " must have routing clearance");
  }
});

test("multiple semantic links between the same endpoints receive distinct path geometry", () => {
  const geometries = types.map(type => routeRelationshipEdgeGeometry(type, { x: 0, y: 0 }, { x: 300, y: 0 }, "orthogonal"));
  const signatures = geometries.map(geometry => JSON.stringify(geometry.pathOptions));
  assert.equal(new Set(signatures).size, types.length, "parallel relationship types must not share the same route offset");
  const first = routeRelationshipEdgeGeometry("main", { x: 0, y: 0 }, { x: 300, y: 0 }, "s-curve", 0);
  const second = routeRelationshipEdgeGeometry("main", { x: 0, y: 0 }, { x: 300, y: 0 }, "s-curve", 1);
  assert.notEqual(first.pathOptions.curvature, second.pathOptions.curvature, "same-type parallel edges need separate curves");
});

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("Route Flow, Process Map and Manufacturing Universe share the adaptive edge geometry", () => {
  const route = read("../src/RouteFlowWorkspace.tsx");
  const process = read("../src/LinkedProcessWorkspace.tsx");
  const universe = read("../src/ManufacturingEcosystemGraph.tsx");
  for (const [name, source] of [["Route Flow", route], ["Process Map", process], ["Manufacturing Universe", universe]]) {
    assert.ok(source.includes("routeRelationshipEdgeGeometry"), name + " must consume the shared edge geometry");
  }
  assert.ok(process.includes("buildRouteFlowOperationPositions(exportOperations,routeLayout,compactViewport)"),
    "Process Map must apply the selected layout to the actual graph nodes");
  assert.ok(process.includes("branchAccent,routeLayout]"),
    "The Process Map graph memo must rebuild when the selected layout changes");
  assert.ok(!route.includes("const graphEdgeType=routeLayout==="),
    "Route Flow must not force one edge shape across the whole graph");
  const canvas = read("../src/ManufacturingGraphCanvas.tsx");
  const edgeRenderer = read("../src/ManufacturingRelationshipEdge.tsx");
  assert.ok(canvas.includes("DEFAULT_MANUFACTURING_EDGE_TYPES"), "Shared canvas must register the custom edge renderer.");
  assert.ok(edgeRenderer.includes("getBezierPath") && edgeRenderer.includes("getSmoothStepPath"),
    "Custom edge renderer must use supported React Flow path utilities.");
});
