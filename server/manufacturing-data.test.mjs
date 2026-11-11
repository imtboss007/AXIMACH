import test from "node:test";
import assert from "node:assert/strict";
import { manufacturingCollections, mergeManufacturingData } from "./manufacturing-data.mjs";

const oldTime = "2026-11-01T09:00:00.000Z";
const newTime = "2026-11-04T09:00:00.000Z";

test("server merge covers every manufacturing collection, including follow-up assignments", () => {
  assert.deepEqual(manufacturingCollections, [
    "companies", "factories", "purchaseOrders", "components", "vendors", "operations",
    "quotations", "materials", "componentParts", "materialCostEntries", "bomLines", "materialProcessLinks", "inventoryTransactions", "contactProfiles",
    "processDefinitions", "plannedCosts", "paymentTransactions", "inspectionMeasurements",
    "routeRelationships", "followUpAssignments", "transportRoutes", "transportLegs"
  ]);
});

test("follow-up assignments sync by stable ID and preserve soft-delete tombstones", () => {
  const existing = {
    updatedAt: oldTime,
    followUpAssignments: [
      { id: "link-1", moduleId: "companies", recordId: "company-1", contactId: "profile-1", contactName: "Old name", updatedAt: oldTime },
      { id: "link-keep", moduleId: "vendors", recordId: "vendor-1", contactId: "profile-2", contactName: "Keep me", updatedAt: oldTime }
    ]
  };
  const incoming = {
    updatedAt: newTime,
    followUpAssignments: [
      { id: "link-1", moduleId: "companies", recordId: "company-1", contactId: "profile-1", contactName: "Updated name", updatedAt: newTime, deletedAt: newTime },
      { id: "link-new", moduleId: "production", recordId: "po-1", contactId: "profile-3", contactName: "New person", updatedAt: newTime }
    ]
  };

  const merged = mergeManufacturingData(existing, incoming);
  assert.equal(merged.followUpAssignments.length, 3);
  assert.equal(merged.followUpAssignments.find(row => row.id === "link-1").contactName, "Updated name");
  assert.equal(merged.followUpAssignments.find(row => row.id === "link-1").deletedAt, newTime);
  assert.equal(merged.followUpAssignments.some(row => row.id === "link-keep"), true);
  assert.equal(merged.followUpAssignments.some(row => row.id === "link-new"), true);
});

test("transport routes and component transport legs sync as separate collections by stable ID", () => {
  const route = { id: "route-1", vendorId: "vendor-1", fromLocation: "Factory", toLocation: "Plater", tripDirection: "One-way", vehicleType: "4-wheeler", fixedAmount: 850, updatedAt: newTime };
  const leg = { id: "leg-1", poId: "po-1", poLineId: "line-1", componentId: "component-1", routeId: "route-1", fixedAmount: 850, tripCount: 2, updatedAt: newTime };
  const merged = mergeManufacturingData(
    { transportRoutes: [{ ...route, fixedAmount: 700, updatedAt: oldTime }], transportLegs: [] },
    { transportRoutes: [route], transportLegs: [leg] }
  );
  assert.equal(merged.transportRoutes.length, 1);
  assert.equal(merged.transportRoutes[0].fixedAmount, 850);
  assert.equal(merged.transportLegs.length, 1);
  assert.equal(merged.transportLegs[0].fixedAmount * merged.transportLegs[0].tripCount, 1700);
});

test("purchase-order merge keeps independently updated component lines", () => {
  const merged = mergeManufacturingData(
    { purchaseOrders: [{ id: "po-1", number: "PO-1", updatedAt: oldTime, lines: [
      { id: "line-1", quantity: 100, updatedAt: oldTime },
      { id: "line-2", quantity: 20, updatedAt: oldTime }
    ] }] },
    { purchaseOrders: [{ id: "po-1", number: "PO-1 amended", updatedAt: newTime, lines: [
      { id: "line-1", quantity: 125, updatedAt: newTime },
      { id: "line-3", quantity: 5, updatedAt: newTime }
    ] }] }
  );

  const po = merged.purchaseOrders[0];
  assert.equal(po.number, "PO-1 amended");
  assert.deepEqual(Object.fromEntries(po.lines.map(line => [line.id, line.quantity])), {
    "line-1": 125, "line-2": 20, "line-3": 5
  });
});

test("an empty or older device payload cannot erase records from the shared server", () => {
  const shared = {
    updatedAt: newTime,
    companies: [{ id: "company-1", name: "Saved company", updatedAt: newTime }],
    followUpAssignments: [{ id: "link-1", contactName: "Saved contact", updatedAt: newTime }]
  };
  const merged = mergeManufacturingData(shared, { updatedAt: oldTime, companies: [], followUpAssignments: [] });

  assert.equal(merged.companies.length, 1);
  assert.equal(merged.companies[0].name, "Saved company");
  assert.equal(merged.followUpAssignments.length, 1);
  assert.equal(merged.followUpAssignments[0].contactName, "Saved contact");
});


test("component parts and material cost streams sync independently by stable ID", () => {
  const componentPart = { id: "part-1", componentId: "component-1", partNumber: "P-01", name: "Laser rib", updatedAt: newTime };
  const processMapCost = { id: "mat-cost-process", scope: "process-map", componentId: "component-1", partId: "part-1", materialCost: 1000, cuttingCost: 59, updatedAt: newTime };
  const plannedCost = { id: "mat-cost-planned", scope: "planned-cost", componentId: "component-1", partId: "part-1", materialCost: 1100, cuttingCost: 65, updatedAt: newTime };
  const merged = mergeManufacturingData(
    { componentParts: [], materialCostEntries: [processMapCost] },
    { componentParts: [componentPart], materialCostEntries: [plannedCost] }
  );
  assert.equal(merged.componentParts.length, 1);
  assert.equal(merged.componentParts[0].componentId, "component-1");
  assert.equal(merged.materialCostEntries.length, 2);
  assert.equal(merged.materialCostEntries.find(row => row.scope === "process-map").cuttingCost, 59);
  assert.equal(merged.materialCostEntries.find(row => row.scope === "planned-cost").cuttingCost, 65);
});

test("material-to-process links sync independently by stable ID and preserve deletion tombstones", () => {
  const first = { id: "material-process-1", materialId: "material-1", bomLineId: "bom-1", operationId: "op-1", poLineId: "line-1", quantityPerPart: 2.5, placement: "before", updatedAt: oldTime };
  const updated = { ...first, operationId: "op-2", quantityPerPart: 1.25, updatedAt: newTime, deletedAt: newTime };
  const second = { id: "material-process-2", materialId: "material-2", bomLineId: "bom-2", operationId: "op-3", poLineId: "line-1", quantityPerPart: 4, placement: "before", updatedAt: newTime };
  const merged = mergeManufacturingData(
    { materialProcessLinks: [first] },
    { materialProcessLinks: [updated, second] }
  );
  assert.equal(merged.materialProcessLinks.length, 2);
  assert.equal(merged.materialProcessLinks.find(row => row.id === first.id).operationId, "op-2");
  assert.equal(merged.materialProcessLinks.find(row => row.id === first.id).deletedAt, newTime);
  assert.equal(merged.materialProcessLinks.find(row => row.id === second.id).materialId, "material-2");
});
