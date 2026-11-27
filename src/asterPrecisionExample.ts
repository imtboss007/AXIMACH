import fixture from "./single-component-route-demo.json";
import { materialReferenceForGrade, materialDensityReference } from "./materialCatalogue";
import type {
  ManufacturingData, CompanyRecord, FactoryRecord, ComponentRecord, PurchaseOrderRecord,
  VendorRecord, CustomerRecord, ProcessDefinitionRecord, PlannedCostEntry, InspectionMeasurementRecord, MaterialRecord, BomLineRecord, MaterialCostEntryRecord, MaterialProcessLinkRecord,
  OperationRecord, TransportRouteRecord, ComponentTransportLegRecord, RouteRelationshipRecord,
  RouteRelationshipType
} from "./manufacturingData";

export const ASTER_EXAMPLE_IDS = {
  company: "ASTER-EXAMPLE-COMPANY",
  factory: "ASTER-EXAMPLE-FACTORY",
  purchaseOrder: "ASTER-EXAMPLE-PO",
  poLine: "ASTER-EXAMPLE-PO-LINE",
  component: "ASTER-EXAMPLE-COMPONENT"
} as const;

const PREFIX = ASTER_EXAMPLE_PREFIX;
const id = (kind: string, source = "") => PREFIX + kind + (source ? "-" + source.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toUpperCase() : "");
const source = fixture as any;
const createdAt = String(source.purchaseOrder.createdAt || "2026-11-25T09:00:00.000Z");
const date = createdAt.slice(0, 10);
const stamp = () => new Date().toISOString();
export const ASTER_EXAMPLE_PREFIX = "ASTER-EXAMPLE-";
const addDays = (value: string, days: number) => {
  const result = new Date(value + "T00:00:00.000Z");
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};
const companyId = ASTER_EXAMPLE_IDS.company;
const factoryId = ASTER_EXAMPLE_IDS.factory;
const poId = ASTER_EXAMPLE_IDS.purchaseOrder;
const poLineId = ASTER_EXAMPLE_IDS.poLine;
const componentId = ASTER_EXAMPLE_IDS.component;
const vendorId = id("VENDOR", "INTERNAL");
const materialId = (value: string) => id("MATERIAL", value);
const bomId = (value: string) => id("BOM", value);
const operationId = (value: string) => id("OPERATION", value);
const routeId = (value: string) => id("ROUTE", value);
const legId = (value: string) => id("TRANSPORT-LEG", value);
const linkId = (value: string) => id("MATERIAL-LINK", value);

const company: CompanyRecord = {
  id: companyId, name: source.company.name, gstin: "", contactPerson: "ASTER Example Contact",
  phone: "", email: "example@aster.invalid", address: "Bengaluru, Karnataka, India",
  notes: "SYNTHETIC TRAINING EXAMPLE ONLY — not a real customer or production company.",
  createdAt, updatedAt: createdAt
};
const factory: FactoryRecord = {
  id: factoryId, companyId, name: "ASTER Precision Works · Demonstration Works",
  address: "Bengaluru, Karnataka, India — synthetic example",
  contactPhone: "", createdAt, updatedAt: createdAt
};
const component: ComponentRecord = {
  id: componentId, companyId, partNumber: source.component.partNumber, name: source.component.name,
  revision: "A", material: source.component.material, drawingReference: "ASTER-EXAMPLE-DRAWING",
  notes: "SYNTHETIC EXAMPLE — planned rates and quantities are illustrative only.",
  salePrice: 0, salePriceUnit: "piece", orderUnit: "Piece", quantityPerUnit: 1,
  overhead: 0, toolingCost: 0, reworkCost: 0, scrapCost: 0, rejectedQty: 0, gstRate: 0,
  createdAt, updatedAt: createdAt
};
const customer: CustomerRecord = {
  id: id("CUSTOMER", "BUYER-01"), ownerCompanyId: companyId, customerCode: "ASTER-CUST-001",
  legalName: "ASTER Example Buyer Industries", displayName: "ASTER Example Buyer",
  industry: "Industrial equipment", primaryContact: "Example purchasing desk",
  phone: "", email: "buyer@example.invalid", billingAddress: "Bengaluru, Karnataka, India",
  shippingAddress: "Bengaluru, Karnataka, India", paymentTerms: "Net 30", creditLimit: 500000,
  currency: "INR", status: "Active",
  notes: "SYNTHETIC DEMONSTRATION BUYER ONLY — not a real customer or credit account.",
  createdAt, updatedAt: createdAt
};
const po: PurchaseOrderRecord = {
  id: poId, number: source.purchaseOrder.number, companyId, factoryId, customerId: customer.id,
  issueDate: date, targetDelivery: addDays(date, 30), status: "Open",
  notes: "SYNTHETIC ASTER ROUTE EXAMPLE — not a customer purchase order.",
  lines: [{
    id: poLineId, componentId, quantity: Number(source.component.quantity) || 250,
    targetDelivery: addDays(date, 30), unitPrice: 0,
    notes: "One component / one PO line synthetic example.", allocationLevel: "component"
  }],
  createdAt, updatedAt: createdAt
};
const vendor: VendorRecord = {
  id: vendorId, company: "ASTER Precision Works · Internal Logistics (Example)",
  contact: "Synthetic logistics desk", role: "Internal demonstration carrier",
  phone: "", whatsappNumber: "", email: "logistics@example.invalid",
  address: "Bengaluru, Karnataka, India", processes: "Internal logistics; material handling; dispatch",
  machines: "", materials: "", notes: "SYNTHETIC EXAMPLE ONLY — no real vendor or transport booking.",
  status: "Active", sourceContactId: "", whatsappSyncedAt: "",
  vendorType: "Transport / Internal", createdAt, updatedAt: createdAt
};

const vendorRows: VendorRecord[] = [vendor];

const materialRows: MaterialRecord[] = (source.materials as any[]).map(row => {
  const reference = materialReferenceForGrade(String(row.grade || row.name || ""));
  const materialType = reference?.[3] || (/aluminium/i.test(String(row.name)+" "+String(row.grade)) ? "Aluminium" : "Other");
  return {
    id: materialId(row.id), code: row.code, name: row.name, grade: row.grade, unit: row.unit === "piece" ? "piece" : "kg",
    specification: row.specification || "", preferredVendorId: vendorId, materialType,
    densityKgM3: reference?.[2] ?? materialDensityReference(String(row.grade || ""), materialType),
    densityUnit: "kg/m3" as const,
    ratePerUnit: Number(row.ratePerUnit) || 0,
    notes: "SYNTHETIC ASTER EXAMPLE MATERIAL — density is a kg/m³ reference; verify the exact grade and supplier certificate before production use.",
    createdAt, updatedAt: createdAt
  };
});
const materialBySource = new Map((source.materials as any[]).map(row => [row.id, row]));
const bomRows: BomLineRecord[] = (source.bomLines as any[]).map(row => ({
  id: bomId(row.id), componentId, materialId: materialId(row.materialId), revision: row.revision || "A",
  quantityPerPart: Number(row.quantityPerPart) || 0, unit: materialBySource.get(row.materialId)?.unit || "kg",
  scrapPercent: Number(row.scrapPercent) || 0,
  notes: "SYNTHETIC BOM ALLOCATION — " + (row.subComponent || "component material"),
  createdAt, updatedAt: createdAt
}));
const materialLinks: MaterialProcessLinkRecord[] = (source.materialProcessLinks as any[]).map(row => ({
  id: linkId(row.id), companyId, poId, poLineId, componentId, bomLineId: bomId(row.bomLineId),
  materialId: materialId(row.materialId), operationId: operationId(row.operationId),
  quantityPerPart: Number(row.quantityPerPart) || 0, unit: row.unit || "kg",
  flowType: row.flowType === "Consumable" ? "Consumable" : row.flowType === "WIP transfer" ? "WIP transfer" : row.flowType === "Output" ? "Output" : "Material input",
  placement: row.placement === "after" ? "after" : "before",
  notes: "SYNTHETIC ASTER EXAMPLE — " + (row.notes || "material-to-process link"),
  createdAt, updatedAt: createdAt
}));
const linkForMaterial = new Map((source.materialProcessLinks as any[]).map(row => [row.materialId, row]));
const materialCostRows: MaterialCostEntryRecord[] = (source.bomLines as any[]).map(row => {
  const material = materialBySource.get(row.materialId) || {};
  const perPart = Number(row.quantityPerPart) || 0;
  const rate = Number(material.ratePerUnit) || 0;
  const totalQuantity = perPart * (Number(source.component.quantity) || 250) * (1 + (Number(row.scrapPercent) || 0) / 100);
  const linked = linkForMaterial.get(row.materialId);
  return {
    id: id("MATERIAL-ENTRY", row.id), scope: "process-map", companyId, poId, poLineId, componentId,
    partNumber: source.component.partNumber, partName: source.component.name,
    materialId: materialId(row.materialId), materialName: material.name || "Example material",
    materialGrade: material.grade || "", densityKgM3: material.densityKgM3 || 0, anchorOperationId: linked ? operationId(linked.operationId) : "",
    shapeType: "", dimensions: {}, dimensionUnits: {}, quantity: totalQuantity,
    weightPerPieceKg: material.unit === "kg" ? perPart : 0,
    totalWeightKg: material.unit === "kg" ? totalQuantity : 0,
    priceUnit: material.unit === "lb" ? "lb" : "kg", materialRate: rate, materialCost: rate * totalQuantity,
    cuttingType: "", cuttingBasis: "", cuttingRate: 0, cutsPerPiece: 0, cuttingHours: 0,
    cuttingCost: 0, wastagePercent: Number(row.scrapPercent) || 0,
    vendorId, givenDate: date, deliveryDate: addDays(date, 2), actualDeliveryDate: "",
    poReference: source.purchaseOrder.number, notes: "SYNTHETIC ASTER EXAMPLE — illustrative material requirement.",
    currency: "INR", createdAt, updatedAt: createdAt
  };
});
const processDefinitionSources = Array.from(new Map((source.operations as any[]).map(row => [
  String(row.category || "General") + "|" + String(row.processType || row.name), row
])).values());
const processDefinitionRows: ProcessDefinitionRecord[] = processDefinitionSources.map(row => {
  const processType = String(row.processType || row.name);
  const category = String(row.category || "General");
  const related = (source.operations as any[]).filter(item => String(item.category || "General") === category && String(item.processType || item.name) === processType);
  const subcategories = [...new Set(related.map(item => String(item.subProcess || "").trim()).filter(Boolean))];
  return {
    id: id("PROCESS", category + "-" + processType), processType, category, subcategories,
    subcategoryIds: subcategories.map(sub => id("PROCESS-SUBCATEGORY", category + "-" + processType + "-" + sub)),
    vendorIds: [vendorId], notes: "SYNTHETIC ASTER EXAMPLE PROCESS DEFINITION — test only.",
    createdAt, updatedAt: createdAt
  };
});
const processDefinitionByKey = new Map(processDefinitionRows.map(item => [item.category + "|" + item.processType, item]));
const operations: OperationRecord[] = (source.operations as any[]).map(row => ({
  id: operationId(row.id), poId, poLineId, componentId,
  processDefinitionId: processDefinitionByKey.get(String(row.category || "General") + "|" + String(row.processType || row.name))?.id,
  processSubcategoryId: processDefinitionByKey.get(String(row.category || "General") + "|" + String(row.processType || row.name))?.subcategoryIds?.[processDefinitionByKey.get(String(row.category || "General") + "|" + String(row.processType || row.name))?.subcategories.indexOf(String(row.subProcess || "")) ?? -1],
  sequence: Number(row.sequence) || 0, name: row.name, category: row.category,
  machine: row.processType || row.category, vendorId, status: "Planned",
  plannedStart: "", plannedEnd: "", actualStart: "", actualEnd: "",
  quantity: Number(row.quantity) || Number(source.component.quantity) || 250,
  completed: 0, accepted: 0, rejected: 0,
  ratePerPart: Number(row.ratePerPartINR ?? row.rate) || 0, actualRatePerPart: 0,
  transportVendorId: "", transportPickup: "", transportDelivery: "", transportCost: 0,
  qualityNotes: "", inspectionResult: "Not assessed",
  notes: "SYNTHETIC ASTER EXAMPLE — " + [row.subProcess, row.subComponent].filter(Boolean).join(" · "),
  paymentStatus: "Unpaid", paidAmount: 0, paymentReference: "",
  subcategory: row.subProcess || "", executionType: "Internal",
  toleranceCategory: "Precision",
  inspectionRequired: /quality|metrology/i.test(row.category || ""),
  transportFrom: "", transportTo: "", transportVehicleType: "", transportRouteId: "",
  branch: row.branch || "Main route", parentId: row.parentId ? operationId(row.parentId) : "",
  relationType: row.relationType === "alternate" || row.relationType === "rework" ? row.relationType : undefined,
  costIncluded: Boolean(row.costIncluded), createdAt, updatedAt: createdAt
}));
const plannedCostRows: PlannedCostEntry[] = operations.map(operation => ({
  id: id("PLANNED-COST", operation.id), companyId, poId, componentId,
  processDefinitionId: operation.processDefinitionId, processSubcategoryId: operation.processSubcategoryId,
  companyName: company.name, poNumber: po.number,
  componentName: component.name, componentNumber: component.partNumber,
  processType: operation.name, processCategory: operation.category, processSubcategory: operation.subcategory,
  plannedQty: operation.quantity || Number(source.component.quantity) || 250, unit: "piece",
  plannedRate: operation.ratePerPart, notes: "SYNTHETIC ASTER EXAMPLE — planned comparison only, not an actual quote.",
  createdAt, updatedAt: createdAt
}));
const inspectionMeasurementRows: InspectionMeasurementRecord[] = operations.filter(operation => operation.inspectionRequired).map(operation => ({
  id: id("INSPECTION", operation.id), operationId: operation.id, poId, poLineId, componentId,
  characteristic: "Demo inspection characteristic — replace with drawing requirement",
  nominalValue: null, lowerLimit: null, upperLimit: null, measuredValue: 0, unit: "mm",
  result: "Not assessed", notes: "SYNTHETIC EXAMPLE PLACEHOLDER — no physical measurement has been performed.",
  inspectedAt: createdAt, createdAt, updatedAt: createdAt
}));

const routeRows: TransportRouteRecord[] = (source.transportRoutes as any[]).map(row => ({
  id: routeId(row.id), vendorId, fromLocation: row.fromLocation, toLocation: row.toLocation,
  tripDirection: row.tripDirection === "Two-way" ? "Two-way" : "One-way",
  vehicleType: row.vehicleType, fixedAmount: Number(row.fixedAmount) || 0,
  currency: "INR", active: true,
  notes: "SYNTHETIC ASTER EXAMPLE ROUTE — not a booking. " + (row.notes || ""),
  createdAt, updatedAt: createdAt
}));
const transportLegRows: ComponentTransportLegRecord[] = (source.transportLegs as any[]).map(row => ({
  id: legId(row.id), poId, poLineId, componentId, sequence: Number(row.sequence) || 0,
  routeId: routeId(row.routeId), vendorId, fromLocation: row.fromLocation, toLocation: row.toLocation,
  tripDirection: row.tripDirection === "Two-way" ? "Two-way" : "One-way",
  vehicleType: row.vehicleType, fixedAmount: Number(row.fixedAmount) || 0,
  tripCount: Number(row.tripCount) || 1,
  anchorOperationId: row.anchorOperationId ? operationId(row.anchorOperationId) : "",
  targetOperationId: row.targetOperationId ? operationId(row.targetOperationId) : undefined,
  placement: row.placement === "start" || row.placement === "before" ? row.placement : "after",
  pickupAt: date, deliveryAt: addDays(date, 1), status: "Planned", completedTrips: 0,
  notes: "SYNTHETIC ASTER EXAMPLE TRANSPORT — not a real dispatch.",
  createdAt, updatedAt: createdAt
}));

const relationshipTypes = new Set<RouteRelationshipType>([
  "main", "alternate", "rework", "dependency", "parallel", "merge", "split",
  "follow-on", "feedback", "conditional", "successor"
]);
const operationSourceIds = new Set((source.operations as any[]).map(row => row.id));
const edgeRows = (source.edges as any[])
  .filter(row => relationshipTypes.has(row.type) && operationSourceIds.has(row.source) && operationSourceIds.has(row.target))
  .map(row => ({ id: row.id, from: row.source, to: row.target, type: row.type as RouteRelationshipType, label: row.label || row.type }));
// The original drawing uses visual gate nodes for the four-way split and assembly merge.
// Route Flow persists operation-to-operation links, so preserve those same route semantics
// with explicit operation endpoints rather than importing non-operation drawing nodes.
edgeRows.push(
  { id: "aster-split-shaft", from: "op-001", to: "op-002", type: "split", label: "SHAFT WORKSTREAM" },
  { id: "aster-split-bracket", from: "op-001", to: "op-007", type: "split", label: "BRACKET WORKSTREAM" },
  { id: "aster-split-base", from: "op-001", to: "op-011", type: "split", label: "BASE PLATE WORKSTREAM" },
  { id: "aster-split-manifold", from: "op-001", to: "op-014", type: "split", label: "MANIFOLD WORKSTREAM" },
  { id: "aster-parallel-shaft-bracket", from: "op-002", to: "op-007", type: "parallel", label: "PARALLEL BOM WORKSTREAMS" },
  { id: "aster-parallel-base-manifold", from: "op-011", to: "op-014", type: "parallel", label: "PARALLEL MACHINING" },
  { id: "aster-merge-shaft", from: "op-006", to: "op-020", type: "merge", label: "SHAFT TO FINAL ASSEMBLY" },
  { id: "aster-merge-bracket", from: "op-010", to: "op-020", type: "merge", label: "BRACKET TO FINAL ASSEMBLY" },
  { id: "aster-merge-base", from: "op-013", to: "op-020", type: "merge", label: "BASE PLATE TO FINAL ASSEMBLY" },
  { id: "aster-merge-manifold", from: "op-019", to: "op-020", type: "merge", label: "MANIFOLD TO FINAL ASSEMBLY" }
);
const routeRelationships: RouteRelationshipRecord[] = edgeRows.map(row => ({
  id: id("RELATIONSHIP", row.id), poId, poLineId, componentId,
  fromOperationId: operationId(row.from), toOperationId: operationId(row.to),
  relationshipType: row.type, status: row.type === "conditional" ? "Conditional" : "Planned",
  condition: row.type === "conditional" ? "Synthetic pass/fail or acceptance example; confirm before production use." : "",
  label: row.label, notes: "SYNTHETIC ASTER EXAMPLE RELATIONSHIP — " + row.label,
  createdAt, updatedAt: createdAt
}));

const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const rows = new Map(existing.map(row => [row.id, row]));
  incoming.forEach(row => rows.set(row.id, row));
  return [...rows.values()];
};

/** Idempotently imports the one-company / one-PO / one-component example into normal AXIMACH data. */
export function importAsterPrecisionExample(current: ManufacturingData): ManufacturingData {
  const updatedAt = stamp();
  const mergeOrders = mergeById(current.purchaseOrders, [{ ...po, updatedAt }]);
  return {
    ...current, updatedAt,
    companies: mergeById(current.companies, [{ ...company, updatedAt }]),
    customers: mergeById(current.customers, [{ ...customer, updatedAt }]),
    factories: mergeById(current.factories, [{ ...factory, updatedAt }]),
    components: mergeById(current.components, [{ ...component, updatedAt }]),
    purchaseOrders: mergeOrders,
    vendors: mergeById(current.vendors, vendorRows.map(row => ({ ...row, updatedAt }))),
    materials: mergeById(current.materials, materialRows.map(row => ({ ...row, updatedAt }))),
    bomLines: mergeById(current.bomLines, bomRows.map(row => ({ ...row, updatedAt }))),
    materialCostEntries: mergeById(current.materialCostEntries, materialCostRows.map(row => ({ ...row, updatedAt }))),
    materialProcessLinks: mergeById(current.materialProcessLinks, materialLinks.map(row => ({ ...row, updatedAt }))),
    processDefinitions: mergeById(current.processDefinitions, processDefinitionRows.map(row => ({ ...row, updatedAt }))),
    operations: mergeById(current.operations, operations.map(row => ({ ...row, updatedAt }))),
    transportRoutes: mergeById(current.transportRoutes, routeRows.map(row => ({ ...row, updatedAt }))),
    transportLegs: mergeById(current.transportLegs, transportLegRows.map(row => ({ ...row, updatedAt }))),
    routeRelationships: mergeById(current.routeRelationships, routeRelationships.map(row => ({ ...row, updatedAt }))),
    plannedCosts: mergeById(current.plannedCosts, plannedCostRows.map(row => ({ ...row, updatedAt }))),
    inspectionMeasurements: mergeById(current.inspectionMeasurements, inspectionMeasurementRows.map(row => ({ ...row, updatedAt })))
  };
}

/**
 * Soft-archives only the reversible ASTER example namespace, including nested PO lines.
 * All real customer records and non-example IDs remain untouched.
 */
export function archiveAsterPrecisionExample(current: ManufacturingData, archivedAt = new Date().toISOString()): ManufacturingData {
  const next = { ...current, updatedAt: archivedAt } as ManufacturingData;
  for (const [key, value] of Object.entries(current)) {
    if (!Array.isArray(value)) continue;
    if (key === "purchaseOrders") {
      next.purchaseOrders = (value as ManufacturingData["purchaseOrders"]).map(po => ({
        ...po,
        ...(po.id.startsWith(ASTER_EXAMPLE_PREFIX) ? { deletedAt: archivedAt, updatedAt: archivedAt } : {}),
        lines: po.lines.map(line => line.id.startsWith(ASTER_EXAMPLE_PREFIX) ? { ...line, deletedAt: archivedAt, updatedAt: archivedAt } : line)
      }));
      continue;
    }
    (next as unknown as Record<string, unknown>)[key] = (value as Array<{id?:string;updatedAt?:string;deletedAt?:string}>).map(row =>
      row.id?.startsWith(ASTER_EXAMPLE_PREFIX) ? { ...row, deletedAt: archivedAt, updatedAt: archivedAt } : row
    );
  }
  return next;
}

export const ASTER_EXAMPLE_EXPECTED = {
  companyCount: 1, purchaseOrderCount: 1, componentCount: 1, operationCount: 28,
  processCategoryCount: 18, transportLegCount: 10,
  relationshipTypes: [...relationshipTypes]
} as const;
