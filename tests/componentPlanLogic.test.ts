import test from "node:test";
import assert from "node:assert/strict";
import { findComponentPlanFor, calculateFinishedJobProcessCost } from "../src/componentPlanLogic.ts";

test("component plan lookup matches component number without any PO requirement", () => {
  const plan = { id: "p1", componentName: "Body Bracket", componentNumber: "CB-120", updatedAt: "2026-10-01T10:00:00Z" };
  assert.equal(findComponentPlanFor([plan], { componentNumber: " cb 120 ", componentName: "Another label" })?.id, "p1");
});

test("component plan lookup falls back to manually created component name", () => {
  const plan = { id: "p2", componentName: "Pump Housing", componentNumber: "", updatedAt: "2026-10-01T10:00:00Z" };
  assert.equal(findComponentPlanFor([plan], { componentNumber: "", componentName: " pump housing " })?.id, "p2");
});

test("component plan lookup chooses the newest matching plan and ignores case and spaces", () => {
  const plans = [
    { id: "old", componentName: "Body Bracket", componentNumber: "CB120", updatedAt: "2026-09-01T10:00:00Z" },
    { id: "new", componentName: "BRACKET", componentNumber: "CB 120", updatedAt: "2026-10-01T10:00:00Z" }
  ];
  assert.equal(findComponentPlanFor(plans, { componentNumber: "cb-120", componentName: "Body Bracket" })?.id, "new");
});

test("job-finish snapshot separates route estimate from actual process rates", () => {
  const snapshot = calculateFinishedJobProcessCost([
    { quantity: 100, ratePerPart: 12, actualRatePerPart: 10, transportCost: 250 },
    { quantity: 100, ratePerPart: 3, actualRatePerPart: 0, transportCost: 50 }
  ]);
  assert.deepEqual(snapshot, {
    processCost: 1800,
    actualProcessCost: 1300,
    missingActualRates: 1,
    operationCount: 2
  });
});

test("job-finish snapshot handles empty route without inventing a cost", () => {
  assert.deepEqual(calculateFinishedJobProcessCost([]), {
    processCost: 0, actualProcessCost: 0, missingActualRates: 0, operationCount: 0
  });
});

test("direct transport contributes to finished total without requiring a manufacturing actual rate", () => {
  const snapshot = calculateFinishedJobProcessCost([
    { quantity: 100, ratePerPart: 0, actualRatePerPart: 0, transportCost: 500, name: "Transport / Dispatch", category: "Logistics" }
  ]);
  assert.deepEqual(snapshot, {
    processCost: 500,
    actualProcessCost: 500,
    missingActualRates: 0,
    operationCount: 1
  });
});
