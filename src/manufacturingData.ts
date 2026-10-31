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
export type VendorRecord = {
  id: string; company: string; contact: string; role: string; phone: string; whatsappNumber: string;
  email: string; address: string; processes: string; machines: string; materials: string; notes: string;
  status: string; sourceContactId: string; whatsappSyncedAt: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type OperationRecord = {
  id: string; poId: string; poLineId: string; componentId: string; sequence: number; processTypeId?: string; name: string;
  category: string; machine: string; machineResourceId?: string; vendorId: string; status: LifecycleStatus;
  plannedStart: string; plannedEnd: string; actualStart: string; actualEnd: string; plannedSlotStartAt?: string; plannedSlotEndAt?: string;
  quantity: number; completed: number; accepted: number; rejected: number;
  /** Planned setup time in machine hours; explicit estimate, never inferred. */
  setupHours?: number; /** Planned cycle time per piece in seconds; explicit estimate, never inferred. */
  cycleTimeSeconds?: number;
  ratePerPart: number; actualRatePerPart: number; vendorPaymentStatus?: "Paid" | "Not Paid"; transportVendorId: string; transportPickup: string; transportDelivery: string;
  transportCost: number; qualityNotes: string; inspectionResult: string; notes: string;
  branch: string; parentId: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ProcessCategoryRecord = { id: string; name: string; code: string; description: string; sortOrder: number; createdAt: string; updatedAt: string; deletedAt?: string; };
export type ProcessTypeRecord = { id: string; categoryId: string; name: string; code: string; description: string; legacyData?: Record<string, unknown>; createdAt: string; updatedAt: string; deletedAt?: string; };
export type ProcessVendorRateRecord = { id: string; processTypeId: string; vendorId: string; quoteReference: string; quotedAt: string; validFrom: string; validUntil: string; ratePerPart: number; currency: string; leadDays: number; notes: string; status: "Received" | "Approved" | "Rejected" | "Expired"; createdAt: string; updatedAt: string; deletedAt?: string; };
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
export type InventoryTransactionRecord = {
  id: string; itemType: "material" | "component"; itemId: string; transactionType: StockTransactionKind;
  direction: "in" | "out"; quantity: number; occurredAt: string; reference: string; notes: string;
  companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string; vendorId: string;
  reversalOfId: string; createdAt: string; createdBy: string;
};
export type MachineResourceRecord = {
  id: string; factoryId: string; code: string; name: string; category: string; makeModel: string;
  workingHoursPerDay: number; shiftStartTime: string; workingDays: number[]; status: "Available" | "Restricted" | "Retired";
  notes: string; createdAt: string; updatedAt: string; deletedAt?: string;
};
export type MaintenanceEventRecord = {
  id: string; resourceId: string; type: "Preventive" | "Breakdown" | "Inspection" | "Setup / Calibration" | "Other";
  title: string; reason: string; priority: "Low" | "Medium" | "High" | "Critical";
  status: "Scheduled" | "In progress" | "Completed" | "Cancelled";
  plannedStartAt: string; plannedEndAt: string; actualStartAt: string; actualEndAt: string;
  assignedTo: string; workOrderRef: string; notes: string;
  createdAt: string; updatedAt: string; deletedAt?: string;
};
export type ManufacturingData = {
  updatedAt: string;
  companies: CompanyRecord[]; factories: FactoryRecord[]; purchaseOrders: PurchaseOrderRecord[];
  components: ComponentRecord[]; vendors: VendorRecord[]; operations: OperationRecord[];
  quotations: QuotationRecord[]; processCategories: ProcessCategoryRecord[]; processTypes: ProcessTypeRecord[]; processVendorRates: ProcessVendorRateRecord[]; materials: MaterialRecord[]; bomLines: BomLineRecord[];
  inventoryTransactions: InventoryTransactionRecord[];
  machineResources: MachineResourceRecord[]; maintenanceEvents: MaintenanceEventRecord[];
};

export const nowIso = () => new Date().toISOString();
export function makeId(prefix: string): string {
  try { return prefix + "-" + crypto.randomUUID(); }
  catch { return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9); }
}
export const activeRows = <T extends { deletedAt?: string }>(rows: T[]) => rows.filter(row => !row.deletedAt);

export const emptyManufacturingData = (): ManufacturingData => ({
  updatedAt: "", companies: [], factories: [], purchaseOrders: [], components: [], vendors: [],
  operations: [], quotations: [], processCategories: [], processTypes: [], processVendorRates: [], materials: [], bomLines: [], inventoryTransactions: [], machineResources: [], maintenanceEvents: []
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
    processCategories: Array.isArray(value?.processCategories) ? value.processCategories : empty.processCategories,
    processTypes: Array.isArray(value?.processTypes) ? value.processTypes : empty.processTypes,
    processVendorRates: Array.isArray(value?.processVendorRates) ? value.processVendorRates : empty.processVendorRates,
    materials: Array.isArray(value?.materials) ? value.materials : empty.materials,
    bomLines: Array.isArray(value?.bomLines) ? value.bomLines : empty.bomLines,
    inventoryTransactions: Array.isArray(value?.inventoryTransactions) ? value.inventoryTransactions : empty.inventoryTransactions,
    machineResources: Array.isArray(value?.machineResources) ? value.machineResources : empty.machineResources,
    maintenanceEvents: Array.isArray(value?.maintenanceEvents) ? value.maintenanceEvents : empty.maintenanceEvents
  };
}

export function readManufacturingData(): ManufacturingData {
  if (typeof window === "undefined") return emptyManufacturingData();
  try { return normaliseData(JSON.parse(window.localStorage.getItem(MANUFACTURING_DATA_KEY) || "null")); }
  catch { return emptyManufacturingData(); }
}

/** Non-destructive migration of legacy process-master rows; the original localStorage key remains a backup. */
export function migrateLegacyProcessDirectory(data: ManufacturingData): ManufacturingData {
  if (typeof window === "undefined") return data;
  const migrationDone = window.localStorage.getItem("aximach.processDirectory.migration.v1") === "done";
  const categories = [...data.processCategories];
  const types = [...data.processTypes];
  const stamp = nowIso();
  const standardNames = ["Milling","Turning","Grinding","Welding","Surface Treatment","Heat Treatment","Cutting","EDM","Drilling","Fabrication","Casting","Forging","Finishing","Assembly"];
  for (const name of standardNames) {
    if (categories.some(row => row.name.toLowerCase() === name.toLowerCase())) continue;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
    categories.push({id:"process-category-standard-"+slug,name,code:"",description:"Standard manufacturing process category.",sortOrder:categories.length+1,createdAt:stamp,updatedAt:stamp});
  }
  if (!migrationDone) {
    let legacy: unknown;
    try { legacy = JSON.parse(window.localStorage.getItem("aximach.processMaster.v1") || "null"); } catch { legacy = null; }
    if (Array.isArray(legacy)) {
      const seeds: Record<string,{name:string;notes:string}> = {
        "pm-turn":{name:"CNC Turning",notes:"Record drawing revision and first-off approval."},
        "pm-vmc":{name:"VMC Milling",notes:"Confirm workholding, tool offsets and datum."},
        "pm-grind":{name:"Cylindrical Grinding",notes:"Record wheel specification and dressing interval."},
        "pm-wire":{name:"Wire EDM",notes:"Confirm wire diameter and cut strategy."},
        "pm-heat":{name:"Heat Treatment",notes:"Capture batch certificate and process parameters."},
        "pm-coat":{name:"Surface Coating",notes:"Record specification, thickness and certificate."},
        "pm-inspect":{name:"Final Inspection",notes:"Record accepted, rejected and rework quantities."},
        "pm-transport":{name:"Transport / Handover",notes:"Capture dispatch and receipt timestamps."}
      };
      for (const item of legacy as Array<Record<string,unknown>>) {
        const id=String(item?.id||"").trim(), name=String(item?.name||"").trim();
        if (!id || !name || types.some(row=>row.id===id)) continue;
        const seed=seeds[id];
        if (seed && name===seed.name && String(item?.vendor||"")==="" && String(item?.notes||"")===seed.notes) continue;
        const categoryName=String(item?.category||item?.type||"").trim();
        let category=categoryName?categories.find(row=>row.name.toLowerCase()===categoryName.toLowerCase()):undefined;
        if (categoryName && !category) { category={id:makeId("process-category"),name:categoryName,code:"",description:"Migrated from legacy Process Master.",sortOrder:categories.length+1,createdAt:stamp,updatedAt:stamp}; categories.push(category); }
        if (!category && !categories.some(row=>row.id==="legacy-uncategorized")) categories.push({id:"legacy-uncategorized",name:"Uncategorized (legacy)",code:"",description:"Legacy process type without a category; review and assign one.",sortOrder:categories.length+1,createdAt:stamp,updatedAt:stamp});
        types.push({id,categoryId:category?.id||"legacy-uncategorized",name,code:String(item?.code||""),description:String(item?.notes||""),legacyData:{...item},createdAt:String(item?.createdAt||stamp),updatedAt:String(item?.updatedAt||stamp)});
      }
    }
    window.localStorage.setItem("aximach.processDirectory.migration.v1","done");
  }
  const changed = categories.length!==data.processCategories.length || types.length!==data.processTypes.length;
  if (!changed) return data;
  const migrated={...data,processCategories:categories,processTypes:types};
  writeLocal(migrated);
  return migrated;
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
    processCategories: mergeRows(local.processCategories, remote.processCategories),
    processTypes: mergeRows(local.processTypes, remote.processTypes),
    processVendorRates: mergeRows(local.processVendorRates, remote.processVendorRates),
    materials: mergeRows(local.materials, remote.materials),
    bomLines: mergeRows(local.bomLines, remote.bomLines),
    inventoryTransactions: mergeRows(local.inventoryTransactions, remote.inventoryTransactions),
    machineResources: mergeRows(local.machineResources, remote.machineResources),
    maintenanceEvents: mergeRows(local.maintenanceEvents, remote.maintenanceEvents)
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
  const [data, setData] = useState<ManufacturingData>(() => migrateLegacyProcessDirectory(readManufacturingData()));
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
        const local = migrateLegacyProcessDirectory(readManufacturingData());
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
    const current = migrateLegacyProcessDirectory(readManufacturingData());
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
