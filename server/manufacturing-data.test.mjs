import test from "node:test";
import assert from "node:assert/strict";
import { manufacturingCollections, mergeManufacturingData } from "./manufacturing-data.mjs";

const oldTime = "2026-11-01T09:00:00.000Z";
const newTime = "2026-11-04T09:00:00.000Z";

test("server merge covers every manufacturing collection, including follow-up assignments", () => {
  assert.deepEqual(manufacturingCollections, [
    "companies", "factories", "purchaseOrders", "components", "vendors", "operations",
    "quotations", "materials", "bomLines", "inventoryTransactions", "contactProfiles",
    "processDefinitions", "plannedCosts", "paymentTransactions", "inspectionMeasurements",
    "followUpAssignments"
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
