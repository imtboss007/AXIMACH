import test from "node:test";
import assert from "node:assert/strict";
import { manufacturingCollections, mergeManufacturingData } from "./manufacturing-data.mjs";

const oldTime = "2026-11-01T09:00:00.000Z";
const newTime = "2026-11-04T09:00:00.000Z";

test("server merge covers every manufacturing collection, including follow-up assignments", () => {
  assert.deepEqual(manufacturingCollections, [
    "companies", "customers", "prospects", "factories", "machines", "toolingAssets", "fixtureAssets", "resourceUsageEvents", "maintenancePlans", "maintenanceWorkOrders", "machineDowntime", "purchaseOrders", "components", "vendors", "operations",
    "quotations", "materials", "componentParts", "materialCostEntries", "bomLines", "materialProcessLinks", "materialConsumptions", "inventoryTransactions", "contactProfiles",
    "processDefinitions", "plannedCosts", "paymentTransactions", "inspectionMeasurements",
    "supplierInvoices", "supplierPayments", "supplierFinanceApprovals", "supplierPaymentAllocations",
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


test("supplier invoices, finance approvals, supplier payments and allocations sync by stable ID and preserve tombstones", () => {
  const invoice = { id:"invoice-1", companyId:"company-1", vendorId:"vendor-1", invoiceNumber:"SUP-001", totalAmount:118, status:"Submitted", updatedAt:newTime };
  const payment = { id:"supplier-payment-1", companyId:"company-1", vendorId:"vendor-1", amount:80, status:"Submitted", updatedAt:newTime };
  const approval = { id:"finance-approval-1", targetType:"invoice", targetId:"invoice-1", decision:"Approved", decidedBy:"manager-1", decidedAt:newTime, updatedAt:newTime };
  const allocation = { id:"ap-allocation-1", paymentId:"supplier-payment-1", invoiceId:"invoice-1", amount:80, updatedAt:newTime };
  const first = mergeManufacturingData({}, {
    supplierInvoices:[invoice],supplierPayments:[payment],
    supplierFinanceApprovals:[approval],supplierPaymentAllocations:[allocation],updatedAt:newTime
  });
  assert.equal(first.supplierInvoices[0].invoiceNumber,"SUP-001");
  assert.equal(first.supplierPayments[0].amount,80);
  assert.equal(first.supplierFinanceApprovals[0].decision,"Approved");
  assert.equal(first.supplierPaymentAllocations[0].amount,80);

  const deletedAt = "2026-11-05T09:00:00.000Z";
  const second = mergeManufacturingData(first, {
    supplierInvoices:[{...invoice,notes:"Corrected reference",updatedAt:deletedAt,deletedAt}],
    supplierPaymentAllocations:[{...allocation,updatedAt:deletedAt,deletedAt}],
    updatedAt:deletedAt
  });
  assert.equal(second.supplierInvoices.length,1);
  assert.equal(second.supplierInvoices[0].notes,"Corrected reference");
  assert.equal(second.supplierInvoices[0].deletedAt,deletedAt);
  assert.equal(second.supplierPaymentAllocations[0].deletedAt,deletedAt);
  assert.equal(second.supplierPayments.length,1);
  assert.equal(second.supplierFinanceApprovals.length,1);
});


test("customer records sync by stable ID and preserve soft-delete tombstones",()=>{
 const customer={id:"customer-1",customerCode:"CUST-001",legalName:"Example Industrial Systems Pvt Ltd",displayName:"Example Industrial",currency:"INR",status:"Active",updatedAt:newTime};
 const first=mergeManufacturingData({}, {customers:[customer],updatedAt:newTime});
 assert.equal(first.customers.length,1);
 assert.equal(first.customers[0].customerCode,"CUST-001");
 const deletedAt="2026-11-05T09:00:00.000Z";
 const second=mergeManufacturingData(first,{customers:[{...customer,displayName:"Example IS",updatedAt:deletedAt,deletedAt}],updatedAt:deletedAt});
 assert.equal(second.customers.length,1);
 assert.equal(second.customers[0].displayName,"Example IS");
 assert.equal(second.customers[0].deletedAt,deletedAt);
});

test("machine assets sync by stable ID and preserve soft-delete tombstones", () => {
  const machine = {
    id:"machine-1",companyId:"company-1",factoryId:"factory-1",assetCode:"CNC-VMC-01",
    name:"Vertical machining centre 01",machineType:"VMC",model:"VMC-850",
    processDefinitionIds:["process-vmc"],materialCapabilities:["Aluminium","EN24"],
    status:"Available",notes:"3-axis production machine",createdAt:oldTime,updatedAt:oldTime
  };
  const first=mergeManufacturingData({}, {machines:[machine],updatedAt:oldTime});
  assert.equal(first.machines.length,1);
  assert.equal(first.machines[0].assetCode,"CNC-VMC-01");
  assert.deepEqual(first.machines[0].processDefinitionIds,["process-vmc"]);
  const deletedAt=newTime;
  const second=mergeManufacturingData(first,{
    machines:[{...machine,status:"Under maintenance",updatedAt:deletedAt,deletedAt}],
    updatedAt:deletedAt
  });
  assert.equal(second.machines.length,1);
  assert.equal(second.machines[0].status,"Under maintenance");
  assert.equal(second.machines[0].deletedAt,deletedAt);
});
