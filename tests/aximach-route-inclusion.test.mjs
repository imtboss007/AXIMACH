import assert from "node:assert/strict";
import test from "node:test";
import { getRequiredRouteOperations, inheritsRouteInclusion } from "../src/productionRouteMetrics.mjs";

const operation = (id, branch, costIncluded, relationType = "alternate") => ({
  id,
  poId: "po-1",
  poLineId: "line-1",
  componentId: "component-1",
  sequence: 10,
  category: "Machining",
  branch,
  relationType,
  costIncluded,
  status: "Planned",
  quantity: 10,
  completed: 0,
  accepted: 0,
  rejected: 0
});

test("new alternate-route sub-process inherits an included parent branch", () => {
  const parent = operation("alternate-parent", "Alternate route · OP-010", true);
  const operations = [operation("main", "Main route", true), parent];
  assert.equal(inheritsRouteInclusion(parent, operations), true);
});

test("new rework branch step remains excluded when its parent branch is excluded", () => {
  const parent = operation("rework-parent", "Rework · OP-020", false, "rework");
  const operations = [operation("main", "Main route", true), parent];
  assert.equal(inheritsRouteInclusion(parent, operations), false);
});

test("branch inclusion does not leak from a different active alternate/rework lane", () => {
  const excluded = operation("alternate-excluded", "Alternate route · OP-010", false);
  const included = operation("rework-included", "Rework · OP-020", true, "rework");
  const operations = [operation("main", "Main route", true), excluded, included];
  const required = getRequiredRouteOperations(operations);
  assert.equal(required.some(item => item.id === excluded.id), false);
  assert.equal(required.some(item => item.id === included.id), true);
  assert.equal(inheritsRouteInclusion(excluded, operations), false);
  assert.equal(inheritsRouteInclusion(included, operations), true);
});

test("new nested step follows the selected branch parent's current inclusion state", () => {
  for (const included of [true, false]) {
    const parent = operation("nested-parent-" + included, "Alternate route · OP-030", included);
    const operations = [operation("main-" + included, "Main route", true), parent];
    const childCostIncluded = inheritsRouteInclusion(parent, operations);
    assert.equal(childCostIncluded, included);
  }
});
