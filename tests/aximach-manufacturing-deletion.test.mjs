import test from "node:test";
import assert from "node:assert/strict";
import { removeComponentDependents, removePurchaseOrderDependents } from "../src/manufacturingDeletion.mjs";

const row = (id, extra = {}) => ({ id, ...extra });
const base = () => ({
  updatedAt: "2026-11-21T00:00:00.000Z",
  companies: [row("co-1"), row("co-2")],
  factories: [row("factory-1")],
  components: [
    row("component-1", { companyId: "co-1", partNumber: "P-100", name: "Housing" }),
    row("component-2", { companyId: "co-1", partNumber: "P-200", name: "Cover" }),
    row("component-3", { companyId: "co-2", partNumber: "P-100", name: "Housing" })
  ],
  purchaseOrders: [
    row("po-1", { lines: [row("line-1", { componentId: "component-1" }), row("line-2", { componentId: "component-2" })] }),
    row("po-2", { lines: [row("line-3", { componentId: "component-1" })] })
  ],
  operations: [
    row("op-1", { componentId: "component-1", poId: "po-1", poLineId: "line-1" }),
    row("op-2", { componentId: "component-2", poId: "po-1", poLineId: "line-2" }),
    row("op-3", { componentId: "component-1", poId: "po-2", poLineId: "line-3" })
  ],
  quotations: [row("quote-1", { componentId: "component-1", poLineId: "line-1" }), row("quote-2", { componentId: "component-2", poLineId: "line-2" })],
  transportLegs: [row("leg-1", { componentId: "component-1", poLineId: "line-1" }), row("leg-2", { componentId: "component-2", poLineId: "line-2" })],
  paymentTransactions: [row("payment-1", { componentId: "component-1", poLineId: "line-1" }), row("payment-2", { componentId: "component-2", poLineId: "line-2" })],
  inspectionMeasurements: [row("inspection-1", { componentId: "component-1", poLineId: "line-1" }), row("inspection-2", { componentId: "component-2", poLineId: "line-2" })],
  bomLines: [row("bom-1", { componentId: "component-1" }), row("bom-2", { componentId: "component-2" })],
  componentParts: [row("part-1", { componentId: "component-1" }), row("part-2", { componentId: "component-2" })],
  materialCostEntries: [row("cost-1", { componentId: "component-1", poId: "po-1", poLineId: "line-1" }), row("cost-2", { componentId: "component-2", poId: "po-1", poLineId: "line-2" })],
  materialProcessLinks: [
    row("material-link-1", { componentId: "component-1", poId: "po-1", poLineId: "line-1", operationId: "op-1", bomLineId: "bom-1" }),
    row("material-link-2", { componentId: "component-2", poId: "po-1", poLineId: "line-2", operationId: "op-2", bomLineId: "bom-2" })
  ],
  routeRelationships: [
    row("route-link-1", { componentId: "component-1", poId: "po-1", poLineId: "line-1", fromOperationId: "op-1", toOperationId: "op-1" }),
    row("route-link-2", { componentId: "component-2", poId: "po-1", poLineId: "line-2", fromOperationId: "op-2", toOperationId: "op-2" })
  ],
  inventoryTransactions: [
    row("stock-1", { itemType: "component", itemId: "component-1", poId: "po-1", poLineId: "line-1", operationId: "op-1" }),
    row("stock-2", { itemType: "material", itemId: "material-1", poId: "po-1", poLineId: "line-1", operationId: "op-1" }),
    row("stock-3", { itemType: "component", itemId: "component-2", poId: "po-1", poLineId: "line-2", operationId: "op-2" })
  ],
  plannedCosts: [
    row("planned-1", { componentId: "component-1", componentNumber: "P-100" }),
    row("planned-2", { componentId: "component-2", componentNumber: "P-200" }),
    row("legacy-ambiguous", { componentNumber: "P-100" })
  ],
  followUpAssignments: [
    row("follow-1", { recordId: "op-1" }),
    row("follow-2", { recordId: "po-1" }),
    row("follow-3", { recordId: "op-2" })
  ],
  materials: [row("material-1")],
  vendors: [row("vendor-1")],
  processDefinitions: [row("process-1")],
  transportRoutes: [row("route-master-1")]
});

test("component deletion removes all dependent PO, route, material and stock links without touching other components", () => {
  const result = removeComponentDependents(base(), ["component-1"]);
  assert.deepEqual(result.components.map((item) => item.id), ["component-2", "component-3"]);
  assert.deepEqual(result.purchaseOrders.map((po) => [po.id, po.lines.map((line) => line.id)]), [
    ["po-1", ["line-2"]]
  ]);
  for (const collection of ["operations", "quotations", "transportLegs", "paymentTransactions", "inspectionMeasurements", "bomLines", "componentParts", "materialCostEntries", "materialProcessLinks", "routeRelationships"]) {
    assert.deepEqual(result[collection].map((item) => item.id), collection === "operations" ? ["op-2"] : collection === "quotations" ? ["quote-2"] : collection === "transportLegs" ? ["leg-2"] : collection === "paymentTransactions" ? ["payment-2"] : collection === "inspectionMeasurements" ? ["inspection-2"] : collection === "bomLines" ? ["bom-2"] : collection === "componentParts" ? ["part-2"] : collection === "materialCostEntries" ? ["cost-2"] : collection === "materialProcessLinks" ? ["material-link-2"] : ["route-link-2"]);
  }
  assert.deepEqual(result.inventoryTransactions.map((item) => item.id), ["stock-3"]);
  assert.deepEqual(result.plannedCosts.map((item) => item.id), ["planned-2", "legacy-ambiguous"]);
  assert.deepEqual(result.followUpAssignments.map((item) => item.id), ["follow-2", "follow-3"]);
  assert.deepEqual(result.materials.map((item) => item.id), ["material-1"]);
  assert.deepEqual(result.vendors.map((item) => item.id), ["vendor-1"]);
  assert.deepEqual(result.processDefinitions.map((item) => item.id), ["process-1"]);
  assert.deepEqual(result.transportRoutes.map((item) => item.id), ["route-master-1"]);
});

test("purchase-order deletion removes PO-specific links and preserves shared component masters and other orders", () => {
  const result = removePurchaseOrderDependents(base(), ["po-1"]);
  assert.deepEqual(result.purchaseOrders.map((item) => item.id), ["po-2"]);
  assert.deepEqual(result.components.map((item) => item.id), ["component-1", "component-2"]);
  assert.deepEqual(result.operations.map((item) => item.id), ["op-3"]);
  assert.deepEqual(result.quotations, []);
  assert.deepEqual(result.transportLegs, []);
  assert.deepEqual(result.paymentTransactions, []);
  assert.deepEqual(result.inspectionMeasurements, []);
  assert.deepEqual(result.materialCostEntries, []);
  assert.deepEqual(result.materialProcessLinks, []);
  assert.deepEqual(result.routeRelationships, []);
  assert.deepEqual(result.inventoryTransactions, []);
  assert.deepEqual(result.plannedCosts.map((item) => item.id), ["planned-1", "planned-2", "legacy-ambiguous"]);
  assert.deepEqual(result.followUpAssignments.map((item) => item.id), ["follow-3"]);
});

test("empty deletion selection is a no-op", () => {
  const original = base();
  assert.equal(removeComponentDependents(original, []), original);
  assert.equal(removePurchaseOrderDependents(original, []), original);
});
