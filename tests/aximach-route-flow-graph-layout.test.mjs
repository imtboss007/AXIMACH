import test from "node:test";
import assert from "node:assert/strict";
import { loadRouteFlowGraphLayout, saveRouteFlowGraphPosition } from "../src/routeFlowGraphLayout.mjs";

test("Route Flow graph layout loads valid saved node coordinates", () => {
  assert.deepEqual(
    loadRouteFlowGraphLayout(JSON.stringify({ "operation-a": { x: 120, y: 240 } })),
    { "operation-a": { x: 120, y: 240 } }
  );
});

test("Route Flow graph layout ignores malformed JSON, invalid IDs and invalid coordinates", () => {
  assert.deepEqual(loadRouteFlowGraphLayout("{broken"), {});
  assert.deepEqual(
    loadRouteFlowGraphLayout(JSON.stringify({
      "": { x: 1, y: 2 },
      "operation-b": { x: Number.NaN, y: 2 },
      "operation-c": { x: 10, y: 30 }
    })),
    { "operation-c": { x: 10, y: 30 } }
  );
});

test("Route Flow graph layout clamps extreme coordinates and preserves other nodes", () => {
  const updated = saveRouteFlowGraphPosition(
    JSON.stringify({ "operation-a": { x: 10, y: 20 } }),
    "operation-b",
    { x: 250000, y: -250000 }
  );
  assert.deepEqual(loadRouteFlowGraphLayout(updated), {
    "operation-a": { x: 10, y: 20 },
    "operation-b": { x: 100000, y: -100000 }
  });
});

test("Route Flow graph layout rejects invalid writes without losing existing positions", () => {
  const existing = JSON.stringify({ "operation-a": { x: 10, y: 20 } });
  assert.deepEqual(
    loadRouteFlowGraphLayout(saveRouteFlowGraphPosition(existing, "", { x: 1, y: 2 })),
    { "operation-a": { x: 10, y: 20 } }
  );
  assert.deepEqual(
    loadRouteFlowGraphLayout(saveRouteFlowGraphPosition(existing, "operation-b", { x: Infinity, y: 2 })),
    { "operation-a": { x: 10, y: 20 } }
  );
});
