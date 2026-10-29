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
  id: string; componentId: string; quantity: number; targetDelivery: string; unitPrice: number;
  notes: string;
  // Optional line-specific overrides prevent cost/reject values from bleeding across different orders for the same part.
  materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number;
  overhead?: number; toolingCost?: number; reworkCost?: number; scrapCost?: number;
  rejectedQty?: number; gstRate?: number;
};
export type PurchaseOrderRecord = {
  id: string; number: string; companyId: string; factoryId: string; issueDate: string;
  targetDelivery: string; status: string; notes: string; lines: PurchaseOrderLine[];
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type VendorRecord = {
  id: string; company: string; contact: string; role: string; phone: string; whatsappNumber: string;
  email: string; address: string; processes: string; machines: string; materials: string; notes: string;
  status: string; sourceContactId: string; whatsappSyncedAt: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type OperationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; sequence: number; name: string;
  category: string; machine: string; vendorId: string; status: LifecycleStatus;
  plannedStart: string; plannedEnd: string; actualStart: string; actualEnd: string;
  quantity: number; completed: number; accepted: number; rejected: number;
  ratePerPart: number; actualRatePerPart: number; transportVendorId: string; transportPickup: string; transportDelivery: string;
  transportCost: number; qualityNotes: string; inspectionResult: string; notes: string;
  branch: string; parentId: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type QuotationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; operationId: string; vendorId: string;
  quoteReference: string; quotedAt: string; validUntil: string; quantity: number; ratePerPart: number;
  transportCost: number; leadDays: number; status: "Received" | "Selected" | "Rejected" | "Expired";
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type MaterialRecord = {
  id: string; code: string; name: string; grade: string; unit: string; specification: string;
  preferredVendorId: string; ratePerUnit: number; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
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
  companies: CompanyRecord[];
  factories: FactoryRecord[];
  purchaseOrders: PurchaseOrderRecord[];
  components: ComponentRecord[];
  vendors: VendorRecord[];
  operations: OperationRecord[];
  quotations: QuotationRecord[];
  materials: MaterialRecord[];
  bomLines: BomLineRecord[];
  inventoryTransactions: InventoryTransactionRecord[];
};

export const emptyManufacturingData = (): ManufacturingData => ({
  updatedAt: nowIso(),
  companies: [], factories: [], purchaseOrders: [], components: [], vendors: [], operations: [], quotations: [],
  materials: [], bomLines: [], inventoryTransactions: []
});

function normaliseData(value: Partial<ManufacturingData> | null | undefined): ManufacturingData {
  const empty = emptyManufacturingData();
  return {
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : nowIso(),
    companies: Array.isArray(value?.companies) ? value.companies : empty.companies,
    factories: Array.isArray(value?.factories) ? value.factories : empty.factories,
    purchaseOrders: Array.isArray(value?.purchaseOrders) ? value.purchaseOrders : empty.purchaseOrders,
    components: Array.isArray(value?.components) ? value.components : empty.components,
    vendors: Array.isArray(value?.vendors) ? value.vendors : empty.vendors,
    operations: Array.isArray(value?.operations) ? value.operations : empty.operations,
    quotations: Array.isArray(value?.quotations) ? value.quotations : empty.quotations,
    materials: Array.isArray(value?.materials) ? value.materials : empty.materials,
    bomLines: Array.isArray(value?.bomLines) ? value.bomLines : empty.bomLines,
    inventoryTransactions: Array.isArray(value?.inventoryTransactions) ? value.inventoryTransactions : empty.inventoryTransactions
  };
}

function mergeManufacturingData(localValue: ManufacturingData, remoteValue: ManufacturingData): ManufacturingData {
  const local = normaliseData(localValue);
  const remote = normaliseData(remoteValue);
  const mergeRows = <T extends { id: string; updatedAt?: string }>(localRows: T[], remoteRows: T[]) => {
    const rows = new Map<string, T>();
    for (const row of remoteRows) rows.set(row.id, row);
    for (const row of localRows) {
      const existing = rows.get(row.id);
      if (!existing || String(row.updatedAt || "") >= String(existing.updatedAt || "")) rows.set(row.id, row);
    }
    return [...rows.values()];
  };
  return {
    updatedAt: [local.updatedAt, remote.updatedAt].sort().at(-1) || nowIso(),
    companies: mergeRows(local.companies, remote.companies),
    factories: mergeRows(local.factories, remote.factories),
    purchaseOrders: mergeRows(local.purchaseOrders, remote.purchaseOrders),
    components: mergeRows(local.components, remote.components),
    vendors: mergeRows(local.vendors, remote.vendors),
    operations: mergeRows(local.operations, remote.operations),
    quotations: mergeRows(local.quotations, remote.quotations),
    materials: mergeRows(local.materials, remote.materials),
    bomLines: mergeRows(local.bomLines, remote.bomLines),
    inventoryTransactions: mergeRows(local.inventoryTransactions, remote.inventoryTransactions)
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

/**
 * Shared browser state with optional cross-device sync to the existing AXIMACH server.
 * Server sync activates after the scheduler URL/API key have been configured in the app.
 */
export function useManufacturingData() {
  const [data, setData] = useState<ManufacturingData>(() => readManufacturingData());
  const [syncStatus, setSyncStatus] = useState<DataStatus>("local");

  useEffect(() => {
    let cancelled = false;
    const refreshLocal = (event?: Event) => {
      const eventData = (event as CustomEvent<ManufacturingData> | undefined)?.detail;
      setData(eventData ? normaliseData(eventData) : readManufacturingData());
    };
    window.addEventListener("aximach-manufacturing-data-updated", refreshLocal as EventListener);
    window.addEventListener("storage", refreshLocal);
    const cfg = serverConfig();
    if (cfg) {
      setSyncStatus("syncing");
      void (async () => {
        try {
          const response = await fetch(cfg.base + "/api/manufacturing-data", { headers: { "x-aximach-key": cfg.key } });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || "Could not read shared manufacturing data.");
          const local = readManufacturingData();
          const remote = normaliseData(body.data || emptyManufacturingData());
          const merged = mergeManufacturingData(local, remote);
          merged.updatedAt = nowIso();
          writeLocal(merged, false);
          if (cancelled) return;
          setData(merged);
          await putRemote(merged, cfg);
          if (!cancelled) setSyncStatus("synced");
        } catch {
          if (!cancelled) setSyncStatus("error");
        }
      })();
    }
    return () => {
      cancelled = true;
      window.removeEventListener("aximach-manufacturing-data-updated", refreshLocal as EventListener);
      window.removeEventListener("storage", refreshLocal);
    };
  }, []);

  // Pull remote changes periodically so a second signed-in device sees updates without reopening the app.
  // The server URL/key are read on every poll because users may connect the scheduler after this hook mounts.
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    const pollRemote = async () => {
      if (busy) return;
      const cfg = serverConfig();
      if (!cfg) { if (!cancelled) setSyncStatus("local"); return; }
      busy = true;
      try {
        const response = await fetch(cfg.base + "/api/manufacturing-data", { headers: { "x-aximach-key": cfg.key } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "Could not refresh shared manufacturing data.");
        const local = readManufacturingData();
        const remote = normaliseData(body.data || emptyManufacturingData());
        const merged = mergeManufacturingData(local, remote);
        // Push local rows that were created/edited while offline instead of falsely marking them synced.
        if (JSON.stringify(merged) !== JSON.stringify(remote)) await putRemote(merged, cfg);
        if (JSON.stringify(merged) !== JSON.stringify(local)) {
          writeLocal(merged, false);
          if (!cancelled) setData(merged);
        }
        if (!cancelled) setSyncStatus("synced");
      } catch {
        if (!cancelled) setSyncStatus("error");
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => { void pollRemote(); }, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
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
      merged.updatedAt = nowIso();
      writeLocal(merged, false);
      setData(merged);
      setSyncStatus("synced");
    }).catch(() => setSyncStatus("error"));
  }, []);

  return { data, update, syncStatus };
}

/** Remove only known AXIMACH demo seeds; preserve anything the user added themselves. */
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
    const looksLikeSeed = route.length >= 8 && demoVendorCount >= 3 && demoDateCount >= 3;
    if (looksLikeSeed) window.localStorage.removeItem("aximach.processRoute.v2");
  }
  const costing = safeRead("aximach.costing.components.v1");
  if (Array.isArray(costing)) {
    const clean = costing.filter((row: any) => !(row?.id === "cmp-1001" && row?.code === "CMP-1001" && row?.name === "Hydraulic Shaft"));
    if (clean.length !== costing.length) window.localStorage.setItem("aximach.costing.components.v1", JSON.stringify(clean));
  }
  const templates = safeRead("aximach.processMaster.v1");
  if (Array.isArray(templates)) {
    const exactDefaultTemplates: Record<string, { name: string; notes: string }> = {
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
      const seed = exactDefaultTemplates[String(row?.id || "")];
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
