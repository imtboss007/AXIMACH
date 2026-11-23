import test from "node:test";
import assert from "node:assert/strict";
import { reconcilePurchaseOrderCosts } from "../src/costReconciliation.mjs";

function costData(tripCount, completedTrips) {
  return {
    companies: [{ id: "co-1", name: "Factory Co" }],
    factories: [{ id: "factory-1", name: "Plant 1" }],
    components: [{ id: "component-1", partNumber: "AX-100", name: "Precision shaft" }],
    purchaseOrders: [{
      id: "po-1", number: "PO-100", companyId: "co-1", factoryId: "factory-1",
      lines: [{ id: "line-1", componentId: "component-1", quantity: 10 }]
    }],
    operations: [],
    materialCostEntries: [],
    plannedCosts: [],
    paymentTransactions: [],
    transportLegs: [{
      id: "leg-1", poId: "po-1", poLineId: "line-1", componentId: "component-1",
      tripCount, completedTrips, fixedAmount: 100
    }]
  };
}

test("PO-line cost reconciliation excludes invalid planned transport trip counts", () => {
  for (const invalidTripCount of [0, -1, 1.5, Number.NaN]) {
    const [line] = reconcilePurchaseOrderCosts(costData(invalidTripCount, 1));
    assert.equal(line.transportRoutePlannedCost, 0, String(invalidTripCount));
    assert.equal(line.transportRouteCompletedTripCost, 0, String(invalidTripCount));
    assert.ok(
      line.warnings.some(warning => warning.includes("invalid planned trip count")),
      "invalid planned trip count must be disclosed"
    );
  }
});

test("PO-line cost reconciliation retains valid whole-trip planned and completed costs", () => {
  const [line] = reconcilePurchaseOrderCosts(costData(2, 1));
  assert.equal(line.transportRoutePlannedCost, 200);
  assert.equal(line.transportRouteCompletedTripCost, 100);
  assert.equal(line.warnings.length, 0);
});
