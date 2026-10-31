import { useCallback, useEffect, useState } from "react";

export const MANUFACTURING_DATA_KEY = "aximach.manufacturingData.v1";

export type DataStatus = "local" | "syncing" | "synced" | "error";
export type LifecycleStatus = "Queued" | "Running" | "Complete" | "Quality hold";

export type CompanyRecord = {
  id: string; name: string; gstin: string; phone: string; email: string;
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type FactoryRecord = {
  id: string; companyId: string; name: string; address: string; contactPhone: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ComponentRecord = {
  id: string; partNumber: string; name: string; revision: string; material: string;
  drawingReference: string; notes: string; salePrice: number; materialQty: number;
  materialRate: number; benchmarkMaterialRate: number; stockQty: number;
  overhead: number; toolingCost: number; reworkCost: number; scrapCost: number;
  rejectedQty: number; gstRate: number; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type PurchaseOrderLine = {
  id: string; componentId: string; quantity: number; targetDelivery: string; unitPrice: number; notes: string;
  materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number;
  overhead?: number; toolingCost?: number; reworkCost?: number; scrapCost?: number; rejectedQty?: number; gstRate?: number;
};
export type PurchaseOrderRecord = {
  id: string; number: string; companyId: string; factoryId: string; issueDate: string;
  targetDelivery: string; status: string; notes: string; lines: PurchaseOrderLine[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type VendorContactRecord = {
  id: string; name: string; role: string; phone: string; email: string;
};
export type VendorDocumentRecord = {
  id: string; title: string; reference: string; notes: string;
};
export type VendorRecord = {
  id: string; company: string; contact: string; role: string; phone: string; whatsappNumber: string;
  email: string; address: string; processes: string; machines: string; materials: string; notes: string;
  status: string; sourceContactId: string; whatsappSyncedAt: string;
  gstin?: string; contacts?: VendorContactRecord[]; documents?: VendorDocumentRecord[]; verificationStatus?: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ProcessDefinitionStatus = "Draft" | "Under review" | "Validated" | "Released" | "Retired";
export type ProcessDefinitionRecord = {
  id: string; code: string; name: string; category: string; revision: string; description: string;
  applicableMaterials: string; equipmentRequirements: string; parameters: string; acceptanceCriteria: string;
  status: ProcessDefinitionStatus; owner: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type VendorCapabilityStatus = "Unverified" | "Evidence requested" | "Under evaluation" | "Approved" | "Expired" | "Rejected";
export type VendorCapabilityRecord = {
  id: string; vendorId: string; processDefinitionId: string; machineModel: string;
  envelopeX: number; envelopeY: number; envelopeZ: number; materialRange: string;
  toleranceCapability: string; capacityPerMonth: number; certificationScope: string;
  evidenceDocumentIds: string[]; status: VendorCapabilityStatus; validFrom: string; validUntil: string;
  assessedBy: string; assessedAt: string; notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type OperationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; processDefinitionId?: string; sequence: number; name: string;
  category: string; machine: string; vendorId: string; status: LifecycleStatus;
  plannedStart: string; plannedEnd: string; actualStart: string; actualEnd: string;
  quantity: number; completed: number; accepted: number; rejected: number;
  ratePerPart: number; actualRatePerPart: number; transportVendorId: string; transportPickup: string; transportDelivery: string;
  transportCost: number; qualityNotes: string; inspectionResult: string; notes: string;
  branch: string; parentId: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type InspectionMeasurementResult = "Not measured" | "Pass" | "Fail";
export type InspectionMeasurementRecord = {
  id: string; characteristic: string; nominal: string; lowerLimit: string; upperLimit: string;
  actual: string; unit: string; gaugeReference: string; result: InspectionMeasurementResult;
};
export type QualityInspectionStatus = "Pending" | "Accepted" | "Rejected" | "Conditional" | "Hold";
export type QualityInspectionRecord = {
  id: string; companyId: string; factoryId: string; poId: string; poLineId: string;
  componentId: string; operationId: string; stage: string; inspectionDate: string; inspector: string;
  instrument: string; sampleSize: number; inspectedQty: number; acceptedQty: number; rejectedQty: number;
  status: QualityInspectionStatus; measurements: InspectionMeasurementRecord[];
  nonConformanceReference: string; correctiveAction: string; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type QuotationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; operationId: string; vendorId: string;
  quoteReference: string; quotedAt: string; validUntil: string; quantity: number; ratePerPart: number;
  transportCost: number; leadDays: number; status: "Received" | "Selected" | "Rejected" | "Expired";
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type MaterialRecord = {
  id: string; code: string; name: string; grade: string; unit: string; specification: string;
  preferredVendorId: string; ratePerUnit: number; notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type BomLineRecord = {
  id: string; componentId: string; materialId: string; revision: string; quantityPerPart: number;
  scrapPercent: number; notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type StockTransactionKind = "Opening balance" | "Receipt" | "Issue to production" | "WIP transfer" | "Return" | "Rejected" | "Scrap" | "Finished goods receipt" | "Dispatch" | "Adjustment";
export type StockLocationType = "factory" | "vendor" | "transit";
export type InventoryTransactionRecord = {
  id: string; itemType: "material" | "component"; itemId: string; transactionType: StockTransactionKind;
  direction: "in" | "out"; quantity: number; occurredAt: string; reference: string; notes: string;
  companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string; vendorId: string;
  reversalOfId: string; createdAt: string; createdBy: string;
  locationType?: StockLocationType; locationId?: string; movementId?: string; movementKind?: "WIP transfer" | "Customer dispatch";
};
export type WipTransferStatus = "Prepared" | "In transit" | "Partially received" | "Received" | "Cancelled";
export type WipTransferRecord = {
  id: string; companyId: string; factoryId: string; poId: string; poLineId: string; componentId: string;
  fromOperationId: string; toOperationId: string;
  sourceLocationType: "factory" | "vendor"; sourceLocationId: string; destinationLocationType: "factory" | "vendor"; destinationLocationId: string;
  sourceVendorId: string; destinationVendorId: string; quantity: number; dispatchedQuantity: number; receivedQuantity: number;
  status: WipTransferStatus; preparedAt: string; dispatchedAt: string; lastReceivedAt: string;
  challanReference: string; vehicleNumber: string; transporterVendorId: string; lrNumber: string;
  receivedBy: string; discrepancyNotes: string; notes: string; stockTransactionIds: string[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type CustomerDispatchStatus = "Prepared" | "In transit" | "Partially delivered" | "Delivered" | "Cancelled";
export type CustomerDispatchRecord = {
  id: string; companyId: string; factoryId: string; poId: string; poLineId: string; componentId: string;
  quantity: number; dispatchedQuantity: number; deliveredQuantity: number; status: CustomerDispatchStatus;
  deliveryChallan: string; eWayBill: string; transporterVendorId: string; vehicleNumber: string; lrNumber: string;
  destination: string; dispatchDate: string; lastDeliveryDate: string; receivedBy: string; proofReference: string;
  discrepancyNotes: string; notes: string; stockTransactionIds: string[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ManufacturingData = {
  updatedAt: string;
  companies: CompanyRecord[]; factories: FactoryRecord[]; purchaseOrders: PurchaseOrderRecord[];
  components: ComponentRecord[]; vendors: VendorRecord[]; operations: OperationRecord[];
  quotations: QuotationRecord[]; materials: MaterialRecord[]; bomLines: BomLineRecord[];
  qualityInspections: QualityInspectionRecord[];
  processDefinitions: ProcessDefinitionRecord[]; vendorCapabilities: VendorCapabilityRecord[];
  inventoryTransactions: InventoryTransactionRecord[]; wipTransfers: WipTransferRecord[]; customerDispatches: CustomerDispatchRecord[];
};

export const nowIso = () => new Date().toISOString();
export function makeId(prefix: string): string {
  try { return prefix + "-" + crypto.randomUUID(); }
  catch { return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
}
export const activeRows = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter(row => !row.deletedAt);

export const emptyManufacturingData = (): ManufacturingData => ({
  updatedAt: "", companies: [], factories: [], purchaseOrders: [], components: [], vendors: [],
  operations: [], quotations: [], materials: [], bomLines: [], qualityInspections: [], processDefinitions: [], vendorCapabilities: [], inventoryTransactions: [], wipTransfers: [], customerDispatches: []
});

function normaliseData(value: Partial<ManufacturingData> | null | undefined): ManufacturingData {
  const empty = emptyManufacturingData();
  return {
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : "",
    companies: Array.isArray(value?.companies) ? value.companies : empty.companies,
    factories: Array.isArray(value?.factories) ? value.factories : empty.factories,
    purchaseOrders: Array.isArray(value?.purchaseOrders) ? value.purchaseOrders : empty.purchaseOrders,
    components: Array.isArray(value?.components) ? value.components : empty.components,
    vendors: Array.isArray(value?.vendors) ? value.vendors : empty.vendors,
    operations: Array.isArray(value?.operations) ? value.operations : empty.operations,
    quotations: Array.isArray(value?.quotations) ? value.quotations : empty.quotations,
    materials: Array.isArray(value?.materials) ? value.materials : empty.materials,
    bomLines: Array.isArray(value?.bomLines) ? value.bomLines : empty.bomLines,
    qualityInspections: Array.isArray(value?.qualityInspections) ? value.qualityInspections : empty.qualityInspections,
    processDefinitions: Array.isArray(value?.processDefinitions) ? value.processDefinitions : empty.processDefinitions,
    vendorCapabilities: Array.isArray(value?.vendorCapabilities) ? value.vendorCapabilities : empty.vendorCapabilities,
    inventoryTransactions: Array.isArray(value?.inventoryTransactions) ? value.inventoryTransactions : empty.inventoryTransactions,
    wipTransfers: Array.isArray(value?.wipTransfers) ? value.wipTransfers : empty.wipTransfers,
    customerDispatches: Array.isArray(value?.customerDispatches) ? value.customerDispatches : empty.customerDispatches
  };
}

export function readManufacturingData(): ManufacturingData {
  if (typeof window === "undefined") return emptyManufacturingData();
  try { return normaliseData(JSON.parse(window.localStorage.getItem(MANUFACTURING_DATA_KEY) || "null")); }
  catch { return emptyManufacturingData(); }
}
function writeLocal(data: ManufacturingData, broadcast = true) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(MANUFACTURING_DATA_KEY, JSON.stringify(data)); } catch { /* storage may be unavailable */ }
  if (broadcast) window.dispatchEvent(new CustomEvent("aximach-manufacturing-data-updated", { detail: data }));
}

function mergeRows<T extends { id: string; updatedAt?: string }>(localRows: T[], remoteRows: T[]): T[] {
  const rows = new Map<string, T>();
  for (const row of remoteRows) if (row?.id) rows.set(row.id, row);
  for (const row of localRows) {
    if (!row?.id) continue;
    const old = rows.get(row.id);
    const localTime = Date.parse(row.updatedAt || "") || 0;
    const remoteTime = Date.parse(old?.updatedAt || "") || 0;
    if (!old || localTime >= remoteTime) rows.set(row.id, row);
  }
  return [...rows.values()];
}
export function mergeManufacturingData(localValue: Partial<ManufacturingData>, remoteValue: Partial<ManufacturingData>): ManufacturingData {
  const local = normaliseData(localValue);
  const remote = normaliseData(remoteValue);
  return {
    updatedAt: local.updatedAt >= remote.updatedAt ? local.updatedAt : remote.updatedAt,
    companies: mergeRows(local.companies, remote.companies),
    factories: mergeRows(local.factories, remote.factories),
    purchaseOrders: mergeRows(local.purchaseOrders, remote.purchaseOrders),
    components: mergeRows(local.components, remote.components),
    vendors: mergeRows(local.vendors, remote.vendors),
    operations: mergeRows(local.operations, remote.operations),
    quotations: mergeRows(local.quotations, remote.quotations),
    materials: mergeRows(local.materials, remote.materials),
    bomLines: mergeRows(local.bomLines, remote.bomLines),
    qualityInspections: mergeRows(local.qualityInspections, remote.qualityInspections),
    processDefinitions: mergeRows(local.processDefinitions, remote.processDefinitions),
    vendorCapabilities: mergeRows(local.vendorCapabilities, remote.vendorCapabilities),
    inventoryTransactions: mergeRows(local.inventoryTransactions, remote.inventoryTransactions),
    wipTransfers: mergeRows(local.wipTransfers, remote.wipTransfers),
    customerDispatches: mergeRows(local.customerDispatches, remote.customerDispatches)
  };
}

function serverConfig() {
  if (typeof window === "undefined") return null;
  const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
  const key = window.localStorage.getItem("aximach.scheduler.key") || "";
  if (!base || !key) return null;
  if (!base.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) return null;
  return { base, key };
}
async function putRemote(data: ManufacturingData, cfg: { base: string; key: string }): Promise<ManufacturingData> {
  const response = await fetch(cfg.base + "/api/manufacturing-data", {
    method: "PUT",
    headers: { "content-type": "application/json", "x-aximach-key": cfg.key },
    body: JSON.stringify({ data })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Manufacturing data sync failed.");
  return normaliseData(body.data || data);
}
async function getRemote(cfg: { base: string; key: string }): Promise<ManufacturingData> {
  const response = await fetch(cfg.base + "/api/manufacturing-data", { headers: { "x-aximach-key": cfg.key } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not refresh shared manufacturing data.");
  return normaliseData(body.data || emptyManufacturingData());
}

export function useManufacturingData() {
  const [data, setData] = useState<ManufacturingData>(() => readManufacturingData());
  const [syncStatus, setSyncStatus] = useState<DataStatus>("local");

  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const refreshLocal = (event?: Event) => {
      const eventData = (event as CustomEvent<ManufacturingData> | undefined)?.detail;
      setData(eventData ? normaliseData(eventData) : readManufacturingData());
    };
    window.addEventListener("aximach-manufacturing-data-updated", refreshLocal as EventListener);
    window.addEventListener("storage", refreshLocal);
    const syncOnce = async () => {
      if (busy) return;
      const cfg = serverConfig();
      if (!cfg) { if (!cancelled) setSyncStatus("local"); return; }
      busy = true;
      try {
        const local = readManufacturingData();
        const remote = await getRemote(cfg);
        const merged = mergeManufacturingData(local, remote);
        const remoteAlreadyHasMergedData = JSON.stringify(merged) === JSON.stringify(remote);
        if (!remoteAlreadyHasMergedData) {
          if (!cancelled) setSyncStatus("syncing");
          const saved = await putRemote(merged, cfg);
          const finalData = mergeManufacturingData(merged, saved);
          writeLocal(finalData, false);
          if (!cancelled) setData(finalData);
        } else if (JSON.stringify(merged) !== JSON.stringify(local)) {
          writeLocal(merged, false);
          if (!cancelled) setData(merged);
        }
        if (!cancelled) setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally { busy = false; }
    };
    void syncOnce();
    const timer = window.setInterval(() => { void syncOnce(); }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("aximach-manufacturing-data-updated", refreshLocal as EventListener);
      window.removeEventListener("storage", refreshLocal);
    };
  }, []);

  const update = useCallback((change: (current: ManufacturingData) => ManufacturingData) => {
    const current = readManufacturingData();
    const next = normaliseData(change(current));
    next.updatedAt = nowIso();
    writeLocal(next);
    setData(next);
    const cfg = serverConfig();
    if (!cfg) { setSyncStatus("local"); return; }
    setSyncStatus("syncing");
    void putRemote(next, cfg).then(remote => {
      const currentLocal = readManufacturingData();
      const merged = mergeManufacturingData(currentLocal, remote);
      writeLocal(merged, false);
      setData(merged);
      setSyncStatus("synced");
    }).catch(() => setSyncStatus("error"));
  }, []);

  return { data, update, syncStatus };
}

/** Remove only known AXIMACH demo seeds; preserve user-edited and user-entered records. */
export function removeLegacyDemoData() {
  if (typeof window === "undefined") return;
  const marker = "aximach.legacy-demo-cleanup.v2";
  if (window.localStorage.getItem(marker) === "done") return;
  const safeRead = (key: string) => {
    try { return JSON.parse(window.localStorage.getItem(key) || "null"); } catch { return null; }
  };
  const route = safeRead("aximach.processRoute.v2");
  if (Array.isArray(route)) {
    const knownVendors = new Set(["Steel Mart", "Ramesh CNC", "Tech Mach", "HeatTreat Co", "Precision Grind", "TapTech", "SurfacePro", "CoatWell"]);
    const demoVendorCount = route.filter((step: any) => knownVendors.has(String(step?.vendor || ""))).length;
    const demoDateCount = route.filter((step: any) => String(step?.startDate || "").startsWith("2025-12-")).length;
    if (route.length >= 8 && demoVendorCount >= 3 && demoDateCount >= 3) window.localStorage.removeItem("aximach.processRoute.v2");
  }
  const costing = safeRead("aximach.costing.components.v1");
  if (Array.isArray(costing)) {
    const clean = costing.filter((row: any) => !(row?.id === "cmp-1001" && row?.code === "CMP-1001" && row?.name === "Hydraulic Shaft"));
    if (clean.length !== costing.length) window.localStorage.setItem("aximach.costing.components.v1", JSON.stringify(clean));
  }
  const templates = safeRead("aximach.processMaster.v1");
  if (Array.isArray(templates)) {
    const exactDefaults: Record<string, { name: string; notes: string }> = {
      "pm-turn": { name: "CNC Turning", notes: "Record drawing revision and first-off approval." },
      "pm-vmc": { name: "VMC Milling", notes: "Confirm workholding, tool offsets and datum." },
      "pm-grind": { name: "Cylindrical Grinding", notes: "Record wheel specification and dressing interval." },
      "pm-wire": { name: "Wire EDM", notes: "Confirm wire diameter and cut strategy." },
      "pm-heat": { name: "Heat Treatment", notes: "Capture batch certificate and process parameters." },
      "pm-coat": { name: "Surface Coating", notes: "Record specification, thickness and certificate." },
      "pm-inspect": { name: "Final Inspection", notes: "Record accepted, rejected and rework quantities." },
      "pm-transport": { name: "Transport / Handover", notes: "Capture dispatch and receipt timestamps." }
    };
    const clean = templates.filter((row: any) => {
      const seed = exactDefaults[String(row?.id || "")];
      return !(seed && row?.name === seed.name && row?.vendor === "" && row?.notes === seed.notes);
    });
    if (clean.length !== templates.length) window.localStorage.setItem("aximach.processMaster.v1", JSON.stringify(clean));
  }
  const contacts = safeRead("aximach.vendorContacts.v1");
  if (Array.isArray(contacts)) {
    const clean = contacts.filter((row: any) => !(["demo-v1", "demo-v2"].includes(String(row?.id || "")) && /demo|example|sample/i.test(String(row?.company || "")) && !String(row?.phone || "").trim()));
    if (clean.length !== contacts.length) window.localStorage.setItem("aximach.vendorContacts.v1", JSON.stringify(clean));
  }
  const po = safeRead("aximach.poMeta.v1");
  if (po && (po.company === "ABC Precision Pvt Ltd" || po.poNumber === "PO-2026-001" || String(po.component || "").includes("CMP-1001 - Hydraulic Shaft"))) {
    window.localStorage.removeItem("aximach.poMeta.v1");
  }
  window.localStorage.setItem(marker, "done");
}
