import assert from "node:assert/strict";
import test from "node:test";
import {
  getFinalProductionOperation,
  getProductionRouteMetrics,
  getRequiredRouteOperations
} from "../src/productionRouteMetrics.mjs";

const operation = (id, extra = {}) => ({
  id,
  poId: "po-1",
  poLineId: "line-1",
  componentId: "component-1",
  branch: "Main route",
  sequence: 10,
  category: "Machining",
  relationType: undefined,
  costIncluded: true,
  quantity: 100,
  completed: 100,
  accepted: 0,
  rejected: 0,
  status: "Complete",
  ...extra
});

test("optional alternate and rework branches do not block the main production route", () => {
  const rows = [
    operation("main-1"),
    operation("main-2", { sequence: 20 }),
    operation("alternate-1", {
      branch: "Alternate route · OP-010",
      relationType: "alternate",
      parentId: "main-1",
      costIncluded: false,
      status: "Planned"
    }),
    operation("alternate-2", {
      branch: "Alternate route · OP-010",
      relationType: "alternate",
      parentId: "alternate-1",
      costIncluded: false,
      status: "Planned",
      sequence: 20
    }),
    operation("rework-1", {
      branch: "Rework · OP-020",
      relationType: "rework",
      parentId: "main-2",
      costIncluded: false,
      status: "Planned"
    })
  ];

  const required = getRequiredRouteOperations(rows);
  assert.deepEqual(required.map(row => row.id), ["main-1", "main-2"]);
  assert.equal(getProductionRouteMetrics(rows, 100).allRequiredOperationsComplete, true);
});

test("including one operation activates its whole branch but not a same-named branch on another PO line", () => {
  const rows = [
    operation("main-1"),
    operation("alternate-1", {
      branch: "Alternate route · OP-010",
      relationType: "alternate",
      parentId: "main-1",
      costIncluded: true
    }),
    operation("alternate-2", {
      branch: "Alternate route · OP-010",
      relationType: "alternate",
      parentId: "alternate-1",
      costIncluded: false,
      sequence: 20,
      status: "Planned"
    }),
    operation("other-line-alt", {
      poId: "po-2",
      poLineId: "line-2",
      componentId: "component-1",
      branch: "Alternate route · OP-010",
      relationType: "alternate",
      parentId: "other-line-main",
      costIncluded: false
    })
  ];

  const required = getRequiredRouteOperations(rows);
  assert.deepEqual(required.map(row => row.id), ["main-1", "alternate-1", "alternate-2"]);
  assert.equal(getProductionRouteMetrics(rows, 100).allRequiredOperationsComplete, false);
});

test("final accepted output is taken from the last top-level production operation, not a subprocess or logistics row", () => {
  const rows = [
    operation("main-1", { sequence: 10 }),
    operation("main-subprocess", {
      sequence: 90,
      relationType: "subprocess",
      parentId: "main-1",
      accepted: 0
    }),
    operation("final-machining", { sequence: 20, accepted: 72 }),
    operation("legacy-transport", {
      sequence: 110,
      category: "Logistics",
      accepted: 0,
      status: "Running"
    })
  ];

  assert.equal(getFinalProductionOperation(rows).id, "final-machining");
  const metrics = getProductionRouteMetrics(rows, 100);
  assert.equal(metrics.finalOperation.id, "final-machining");
  assert.equal(metrics.finalAcceptedQuantity, 72);
});

test("subprocesses on an active main route remain required, while optional branch subprocesses remain optional", () => {
  const rows = [
    operation("main-1"),
    operation("main-subprocess", {
      relationType: "subprocess",
      parentId: "main-1",
      sequence: 20,
      status: "Planned"
    }),
    operation("alt-1", {
      branch: "Alternate route · OP-010",
      relationType: "alternate",
      parentId: "main-1",
      costIncluded: false
    }),
    operation("alt-subprocess", {
      branch: "Alternate route · OP-010",
      relationType: "subprocess",
      parentId: "alt-1",
      costIncluded: false,
      sequence: 20,
      status: "Planned"
    })
  ];

  const required = getRequiredRouteOperations(rows);
  assert.deepEqual(required.map(row => row.id), ["main-1", "main-subprocess"]);
});

test("in-progress quantity is a non-additive estimate and pending completes the PO-line quantity partition", () => {
  const rows = [
    operation("main-1", { status: "Running", completed: 40 }),
    operation("main-2", { sequence: 20, status: "Running", completed: 70, accepted: 30 }),
    operation("main-subprocess", {
      relationType: "subprocess",
      parentId: "main-1",
      sequence: 90,
      status: "Running",
      completed: 90
    })
  ];

  const metrics = getProductionRouteMetrics(rows, 100);
  assert.equal(metrics.finalAcceptedQuantity, 30);
  assert.equal(metrics.inProgressEstimate, 60);
  assert.equal(metrics.pendingQuantity, 10);
  assert.equal(metrics.finalAcceptedQuantity + metrics.inProgressEstimate + metrics.pendingQuantity, 100);
});
