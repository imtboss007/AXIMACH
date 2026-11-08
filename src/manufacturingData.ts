import { useCallback, useEffect, useState } from "react";

export const MANUFACTURING_DATA_KEY = "aximach.manufacturingData.v1";

export type DataStatus = "local" | "syncing" | "synced" | "error";
export type LifecycleStatus = "Planned" | "Queued" | "Running" | "Complete" | "Quality hold" | "Rejected" | "Delayed";

export type CompanyRecord = {
  id: string; name: string; gstin: string; contactPerson?: string; phone: string; email: string; address?: string;
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type FactoryRecord = {
  id: string; companyId: string; name: string; address: string; contactPhone: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ComponentRecord = {
  id: string; companyId?: string; partNumber: string; name: string; revision: string; material?: string;
  drawingReference: string; notes: string; salePrice: number; salePriceUnit: "piece" | "set";
  orderUnit?: "Piece" | "Set"; quantityPerUnit?: number;
  // Legacy values remain optional for old records/backups; they are no longer fields in Component Master.
  materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number; stockQty?: number;
  overhead: number; toolingCost: number; reworkCost: number; scrapCost: number;
  rejectedQty: number; gstRate: number; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type PurchaseOrderLine = {
  id: string; componentId: string; quantity: number; targetDelivery: string; unitPrice?: number; notes: string;
  jobStatus?: "In progress" | "Finished"; jobFinishedAt?: string; updatedAt?: string; deletedAt?: string;
  materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number;
  overhead?: number; toolingCost?: number; reworkCost?: number; scrapCost?: number; rejectedQty?: number; gstRate?: number;
};
export type PurchaseOrderRecord = {
  id: string; number: string; companyId: string; factoryId: string; issueDate: string;
  targetDelivery: string; status: string; notes: string; lines: PurchaseOrderLine[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type TransportTripDirection = "One-way" | "Two-way";
export type TransportRouteRecord = {
  id: string; vendorId: string; fromLocation: string; toLocation: string;
  tripDirection: TransportTripDirection; vehicleType: string; fixedAmount: number;
  currency: "INR"; active: boolean; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ComponentTransportLegRecord = {
  id: string; poId: string; poLineId: string; componentId: string; sequence: number;
  routeId: string; vendorId: string; fromLocation: string; toLocation: string;
  tripDirection: TransportTripDirection; vehicleType: string; fixedAmount: number;
  tripCount: number; anchorOperationId: string; placement?: "start" | "before" | "after"; pickupAt?: string; deliveryAt?: string; status?: LifecycleStatus; completedTrips?: number; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type VendorTransportRoute = { id: string; fromLocation: string; toLocation: string; fixedCost: number; vehicleType: string; notes?: string; tripDirection?: TransportTripDirection };
export type VendorRecord = {
  id: string; company: string; contact: string; role: string; phone: string; whatsappNumber: string;
  email: string; address: string; processes: string; processDefinitionIds?: string[]; machines: string; materials: string; notes: string;
  status: string; sourceContactId: string; whatsappSyncedAt: string; vendorType?: string; transportRoutes?: VendorTransportRoute[]; additionalPhones?: string[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ContactProfileRecord = {
  id: string; linkedType: "company" | "vendor"; linkedId: string; name: string; role: string; group?: string;
  phone: string; whatsapp: string; additionalPhones?: string[]; email: string; address: string; followUpDate: string; history: string;
  processCategories?: string[]; processTypes?: string[]; processSubcategories?: string[];
  /** Stable Process Directory references selected for this contact; separate from contact-entered text tags. */
  processDefinitionIds?: string[]; processSubcategoryIds?: string[];
  machineCapabilities?: string[]; materialCapabilities?: string[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type FollowUpAssignmentRecord = {
  id: string; moduleId: string; recordId: string; recordLabel: string;
  contactId: string; contactName: string; contactPhone: string; contactEmail: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ProcessDefinitionRecord = {
  id: string; processType: string; category: string; subcategories: string[]; subcategoryIds?: string[]; vendorIds: string[];
  /** User-selected identity colour applied consistently to every operation from this process type. */
  displayColor?: string;
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type PlannedCostEntry = {
  id: string; companyId?: string; poId?: string; componentId?: string; processDefinitionId?: string; processSubcategoryId?: string; companyName?: string; poNumber?: string; componentName: string; componentNumber: string; processType: string; processCategory: string; processSubcategory?: string;
  plannedQty: number; unit: "piece" | "set"; plannedRate: number; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type OperationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; processDefinitionId?: string; sequence: number; name: string;
  category: string; machine: string; vendorId: string; status: LifecycleStatus;
  plannedStart: string; plannedEnd: string; actualStart: string; actualEnd: string;
  quantity: number; completed: number; accepted: number; rejected: number;
  ratePerPart: number; actualRatePerPart: number; transportVendorId: string; transportPickup: string; transportDelivery: string;
  transportCost: number; qualityNotes: string; inspectionResult: string; notes: string;
  paymentStatus?: "Paid" | "Unpaid"; paidAmount?: number; paymentReference?: string; subcategory?: string; processSubcategoryId?: string;
  executionType?: "Internal" | "Outsourced"; toleranceCategory?: "Standard" | "Precision" | "Close" | "Ultra Precision"; inspectionRequired?: boolean;
  transportFrom?: string; transportTo?: string; transportVehicleType?: string; transportRouteId?: string;
  /** Snapshot of the Process Directory identity colour used by this saved operation. */
  processColor?: string;
  branch: string; parentId: string; relationType?: "subprocess" | "alternate" | "rework"; costIncluded?: boolean; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type QuotationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; operationId: string; vendorId: string;
  quoteReference: string; quotedAt: string; validUntil: string; quantity: number; ratePerPart: number;
  transportCost: number; leadDays: number; status: "Received" | "Selected" | "Rejected" | "Expired";
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type PaymentTransactionRecord = {
  id: string; operationId: string; poId: string; poLineId: string; componentId: string;
  amount: number; paidAt: string; reference: string; notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type InspectionMeasurementRecord = {
  id: string; operationId: string; poId: string; poLineId: string; componentId: string;
  characteristic: string; nominalValue: number | null; lowerLimit: number | null; upperLimit: number | null;
  measuredValue: number; unit: string; result: "Pass" | "Fail" | "Not assessed"; notes: string;
  inspectedAt: string; createdAt: string; updatedAt: string; deletedAt?: string;
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
export type InventoryTransactionRecord = {
  id: string; itemType: "material" | "component"; itemId: string; transactionType: StockTransactionKind;
  direction: "in" | "out"; quantity: number; occurredAt: string; reference: string; notes: string;
  companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string; vendorId: string;
  reversalOfId: string; createdAt: string; createdBy: string;
};
export type ManufacturingData = {
  updatedAt: string;
  companies: CompanyRecord[]; factories: FactoryRecord[]; purchaseOrders: PurchaseOrderRecord[];
  components: ComponentRecord[]; vendors: VendorRecord[]; operations: OperationRecord[];
  quotations: QuotationRecord[]; materials: MaterialRecord[]; bomLines: BomLineRecord[];
  inventoryTransactions: InventoryTransactionRecord[];
  contactProfiles: ContactProfileRecord[]; processDefinitions: ProcessDefinitionRecord[]; plannedCosts: PlannedCostEntry[];
  transportRoutes: TransportRouteRecord[]; transportLegs: ComponentTransportLegRecord[];
  paymentTransactions: PaymentTransactionRecord[]; inspectionMeasurements: InspectionMeasurementRecord[];
  followUpAssignments: FollowUpAssignmentRecord[];
};

export const nowIso = () => new Date().toISOString();
export function makeId(prefix: string): string {
  try { return prefix + "-" + crypto.randomUUID(); }
  catch { return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
}
export const activeRows = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter(row => !row.deletedAt);

export const emptyManufacturingData = (): ManufacturingData => ({
  updatedAt: "", companies: [], factories: [], purchaseOrders: [], components: [], vendors: [],
  operations: [], quotations: [], materials: [], bomLines: [], inventoryTransactions: [],
  contactProfiles: [], processDefinitions: [], plannedCosts: [], transportRoutes: [], transportLegs: [], paymentTransactions: [], inspectionMeasurements: [],
  followUpAssignments: []
});

function normaliseData(value: Partial<ManufacturingData> | null | undefined): ManufacturingData {
  const empty = emptyManufacturingData();
  return {
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : "",
    companies: Array.isArray(value?.companies) ? value.companies : empty.companies,
    factories: Array.isArray(value?.factories) ? value.factories : empty.factories,
    purchaseOrders: Array.isArray(value?.purchaseOrders) ? value.purchaseOrders : empty.purchaseOrders,
    components: Array.isArray(value?.components) ? value.components.map(component => ({
      ...component,
      salePriceUnit: component.salePriceUnit === "set" ? "set" as const : component.salePriceUnit === "piece" ? "piece" as const : component.orderUnit === "Set" ? "set" as const : "piece" as const
    })) : empty.components,
    vendors: Array.isArray(value?.vendors) ? value.vendors : empty.vendors,
    operations: Array.isArray(value?.operations) ? value.operations : empty.operations,
    quotations: Array.isArray(value?.quotations) ? value.quotations : empty.quotations,
    materials: Array.isArray(value?.materials) ? value.materials : empty.materials,
    bomLines: Array.isArray(value?.bomLines) ? value.bomLines : empty.bomLines,
    inventoryTransactions: Array.isArray(value?.inventoryTransactions) ? value.inventoryTransactions : empty.inventoryTransactions,
    contactProfiles: Array.isArray(value?.contactProfiles) ? value.contactProfiles : empty.contactProfiles,
    processDefinitions: Array.isArray(value?.processDefinitions) ? value.processDefinitions : empty.processDefinitions,
    plannedCosts: Array.isArray(value?.plannedCosts) ? value.plannedCosts : empty.plannedCosts,
    transportRoutes: Array.isArray(value?.transportRoutes) ? value.transportRoutes : empty.transportRoutes,
    transportLegs: Array.isArray(value?.transportLegs) ? value.transportLegs : empty.transportLegs,
    paymentTransactions: Array.isArray(value?.paymentTransactions) ? value.paymentTransactions : empty.paymentTransactions,
    inspectionMeasurements: Array.isArray(value?.inspectionMeasurements) ? value.inspectionMeasurements : empty.inspectionMeasurements,
    followUpAssignments: Array.isArray(value?.followUpAssignments) ? value.followUpAssignments : empty.followUpAssignments
  };
}

export function readManufacturingData(): ManufacturingData {
  if (typeof window === "undefined") return emptyManufacturingData();
  let data: ManufacturingData;
  try { data = normaliseData(JSON.parse(window.localStorage.getItem(MANUFACTURING_DATA_KEY) || "null")); }
  catch { data = emptyManufacturingData(); }

  // Read legacy directory stores into the canonical model without deleting or
  // rewriting the source keys. Existing record IDs and newer shared edits win.
  const mergeLegacy = <T extends { id: string; updatedAt?: string }>(current: T[], storageKey: string): T[] => {
    try {
      const value: unknown = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
      if (!Array.isArray(value)) return current;
      const rows = new Map(current.filter(row => row?.id).map(row => [row.id, row]));
      for (const incoming of value as T[]) {
        if (!incoming?.id) continue;
        const old = rows.get(incoming.id);
        const incomingTime = Date.parse(incoming.updatedAt || "") || 0;
        const oldTime = Date.parse(old?.updatedAt || "") || 0;
        if (!old || incomingTime > oldTime) rows.set(incoming.id, incoming);
      }
      return [...rows.values()];
    } catch { return current; }
  };

  return {
    ...data,
    contactProfiles: mergeLegacy(data.contactProfiles, "aximach.contact360.v1"),
    processDefinitions: mergeLegacy(data.processDefinitions, "aximach.processDirectory.v1"),
    plannedCosts: mergeLegacy(data.plannedCosts, "aximach.componentPlannedCost.v1")
  };
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
function mergePurchaseOrderRows(localRows: PurchaseOrderRecord[], remoteRows: PurchaseOrderRecord[]): PurchaseOrderRecord[] {
  const localById = new Map(localRows.filter(row => row?.id).map(row => [row.id, row]));
  const remoteById = new Map(remoteRows.filter(row => row?.id).map(row => [row.id, row]));
  const merged: PurchaseOrderRecord[] = [];
  for (const id of new Set([...remoteById.keys(), ...localById.keys()])) {
    const local = localById.get(id);
    const remote = remoteById.get(id);
    if (!local) { merged.push(remote!); continue; }
    if (!remote) { merged.push(local); continue; }
    const localTime = Date.parse(local.updatedAt || "") || 0;
    const remoteTime = Date.parse(remote.updatedAt || "") || 0;
    const preferred = localTime >= remoteTime ? local : remote;
    const lineMap = new Map<string, { line: PurchaseOrderLine; time: number }>();
    for (const [row, parentTime] of [[remote, remoteTime], [local, localTime]] as const) {
      for (const line of row.lines || []) {
        if (!line?.id) continue;
        const time = Date.parse(line.updatedAt || "") || parentTime;
        const previous = lineMap.get(line.id);
        if (!previous || time >= previous.time) lineMap.set(line.id, { line, time });
      }
    }
    merged.push({ ...preferred, lines: [...lineMap.values()].map(entry => entry.line) });
  }
  return merged;
}

export function mergeManufacturingData(localValue: Partial<ManufacturingData>, remoteValue: Partial<ManufacturingData>): ManufacturingData {
  const local = normaliseData(localValue);
  const remote = normaliseData(remoteValue);
  return {
    updatedAt: local.updatedAt >= remote.updatedAt ? local.updatedAt : remote.updatedAt,
    companies: mergeRows(local.companies, remote.companies),
    factories: mergeRows(local.factories, remote.factories),
    purchaseOrders: mergePurchaseOrderRows(local.purchaseOrders, remote.purchaseOrders),
    components: mergeRows(local.components, remote.components),
    vendors: mergeRows(local.vendors, remote.vendors),
    operations: mergeRows(local.operations, remote.operations),
    quotations: mergeRows(local.quotations, remote.quotations),
    materials: mergeRows(local.materials, remote.materials),
    bomLines: mergeRows(local.bomLines, remote.bomLines),
    inventoryTransactions: mergeRows(local.inventoryTransactions, remote.inventoryTransactions),
    contactProfiles: mergeRows(local.contactProfiles, remote.contactProfiles),
    processDefinitions: mergeRows(local.processDefinitions, remote.processDefinitions),
    plannedCosts: mergeRows(local.plannedCosts, remote.plannedCosts),
    transportRoutes: mergeRows(local.transportRoutes, remote.transportRoutes),
    transportLegs: mergeRows(local.transportLegs, remote.transportLegs),
    paymentTransactions: mergeRows(local.paymentTransactions, remote.paymentTransactions),
    inspectionMeasurements: mergeRows(local.inspectionMeasurements, remote.inspectionMeasurements),
    followUpAssignments: mergeRows(local.followUpAssignments, remote.followUpAssignments)
  };
}

function serverConfig() {
  if (typeof window === "undefined") return null;
  const base = (window.localStorage.getItem("aximach.scheduler.url") || "").trim().replace(/\/+$/, "");
  const key = window.localStorage.getItem("aximach.scheduler.key") || "";
  if (!base || !key) return null;
  try {
    const parsed = new URL(base);
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    const octets = host.split(".").map(Number);
    const privateIpv4 = octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255)
      && (octets[0] === 10
        || (octets[0] === 192 && octets[1] === 168)
        || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));
    const localHost = host === "localhost" || host === "127.0.0.1";
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && (localHost || privateIpv4))) return null;
  } catch {
    return null;
  }
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
    let syncPending = false;

    const syncOnce = async () => {
      if (busy) { syncPending = true; return; }
      const cfg = serverConfig();
      if (!cfg) { if (!cancelled) setSyncStatus("local"); return; }

      busy = true;
      try {
        do {
          syncPending = false;
          const localBeforeFetch = readManufacturingData();
          const remote = await getRemote(cfg);
          const localAfterFetch = readManufacturingData();

          // An edit made while the network request was in flight must be sent on
          // the next pass rather than being hidden by an older response.
          if (JSON.stringify(localAfterFetch) !== JSON.stringify(localBeforeFetch)) syncPending = true;

          const merged = mergeManufacturingData(localAfterFetch, remote);
          if (JSON.stringify(merged) !== JSON.stringify(remote)) {
            if (!cancelled) setSyncStatus("syncing");
            const saved = await putRemote(merged, cfg);
            const localAfterPut = readManufacturingData();
            if (JSON.stringify(localAfterPut) !== JSON.stringify(localAfterFetch)) syncPending = true;
            const finalData = mergeManufacturingData(localAfterPut, saved);
            writeLocal(finalData, false);
            if (!cancelled) setData(finalData);
          } else if (JSON.stringify(merged) !== JSON.stringify(localAfterFetch)) {
            writeLocal(merged, false);
            if (!cancelled) setData(merged);
          }
        } while (syncPending && !cancelled);

        if (!cancelled) setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally {
        busy = false;
        if (syncPending && !cancelled) void syncOnce();
      }
    };

    const refreshLocal = (event?: Event) => {
      const eventData = (event as CustomEvent<ManufacturingData> | undefined)?.detail;
      setData(eventData ? normaliseData(eventData) : readManufacturingData());
      // Same-window edits and other-tab edits sync immediately, not on the
      // next polling interval. The queue above coalesces overlapping changes.
      void syncOnce();
    };
    const syncWhenActive = () => {
      if (document.visibilityState !== "hidden") void syncOnce();
    };

    window.addEventListener("aximach-manufacturing-data-updated", refreshLocal as EventListener);
    window.addEventListener("storage", refreshLocal);
    window.addEventListener("focus", syncWhenActive);
    window.addEventListener("online", syncWhenActive);
    document.addEventListener("visibilitychange", syncWhenActive);

    void syncOnce();
    const timer = window.setInterval(() => { void syncOnce(); }, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("aximach-manufacturing-data-updated", refreshLocal as EventListener);
      window.removeEventListener("storage", refreshLocal);
      window.removeEventListener("focus", syncWhenActive);
      window.removeEventListener("online", syncWhenActive);
      document.removeEventListener("visibilitychange", syncWhenActive);
    };
  }, []);

  const update = useCallback((change: (current: ManufacturingData) => ManufacturingData) => {
    const current = readManufacturingData();
    const next = normaliseData(change(current));
    const stamp = nowIso();
    next.updatedAt = stamp;
    const previousOrders = new Map(current.purchaseOrders.map(po => [po.id, po]));
    next.purchaseOrders = next.purchaseOrders.map(po => {
      const previous = previousOrders.get(po.id);
      const previousLines = new Map((previous?.lines || []).map(line => [line.id, line]));
      let lineChanged = false;
      const lines = po.lines.map(line => {
        const old = previousLines.get(line.id);
        const withoutTime = (value: PurchaseOrderLine | undefined) => {
          if (!value) return null;
          const copy = { ...value };
          delete copy.updatedAt;
          return copy;
        };
        const changed = !old || JSON.stringify(withoutTime(old)) !== JSON.stringify(withoutTime(line));
        if (changed) lineChanged = true;
        return { ...line, updatedAt: changed ? stamp : (line.updatedAt || old?.updatedAt || previous?.updatedAt || stamp) };
      });
      return { ...po, ...(lineChanged ? { updatedAt: stamp } : {}), lines };
    });
    writeLocal(next);
    setData(next);
    setSyncStatus(serverConfig() ? "syncing" : "local");
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
