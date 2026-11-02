import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUp, Boxes, CalendarClock, Check, CircleDollarSign, ClipboardCheck, Download, Eye, FileText, GitBranch, Package, Plus, Printer, Search, ShieldAlert, ShieldCheck, SlidersHorizontal, Truck, Users, Workflow, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, vendorSupportsProcessType, type LifecycleStatus, type OperationRecord, type PurchaseOrderLine } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import ProcessMap3DViewer from "./ProcessMap3DViewer";
import { saveBlobFile } from "./fileDownload";

type ProcessSelection = { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string };
type ProcessExportField = "process" | "description" | "givenDate" | "deliveryDate" | "quantity" | "vendor" | "price" | "amount";
const PROCESS_EXPORT_COLUMNS: { key: ProcessExportField; label: string }[] = [
  { key: "process", label: "Process" },
  { key: "description", label: "Process description" },
  { key: "givenDate", label: "Given date" },
  { key: "deliveryDate", label: "Delivery date" },
  { key: "quantity", label: "Quantity" },
  { key: "vendor", label: "Vendor" },
  { key: "price", label: "Price / piece" },
  { key: "amount", label: "Process + transport amount" }
];
const processExportValue = (operation: OperationRecord, field: ProcessExportField, vendorName: string) => {
  switch (field) {
    case "process": return operation.category ? operation.category + " · " + operation.name : operation.name;
    case "description": return operation.notes || "";
    case "givenDate": return operation.plannedStart || "";
    case "deliveryDate": return operation.plannedEnd || "";
    case "quantity": return operation.quantity;
    case "vendor": return vendorName;
    case "price": return operation.ratePerPart > 0 ? operation.ratePerPart : "";
    case "amount": return operation.quantity * operation.ratePerPart + operation.transportCost;
  }
};
type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void; initialSelection?: ProcessSelection | null; onInitialSelectionApplied?: () => void; onOpenQuality?: (operationId: string) => void; onOpenWipTransfer?: (selection: ProcessSelection) => void };
type DraftOperation = Pick<OperationRecord, "name" | "category" | "machine" | "machineResourceId" | "vendorId" | "status" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd" | "transportVendorId" | "quantity" | "completed" | "accepted" | "rejected" | "setupHours" | "cycleTimeSeconds" | "ratePerPart" | "actualRatePerPart" | "vendorPaymentStatus" | "inspectionResult" | "transportCost" | "transportPickup" | "transportDelivery" | "qualityNotes" | "notes" | "branch"> & { plannedStartTime: string; plannedEndTime: string };
const blankOperation = (line?: PurchaseOrderLine): DraftOperation => ({
  name: "", category: "", machine: "", machineResourceId: "", vendorId: "", status: "Queued", plannedStart: "", plannedEnd: line?.targetDelivery || "", plannedStartTime: "", plannedEndTime: "", actualStart: "", actualEnd: "",
  quantity: line?.quantity || 0, completed: 0, accepted: 0, rejected: 0, setupHours: 0, cycleTimeSeconds: 0, ratePerPart: 0, actualRatePerPart: 0, vendorPaymentStatus: "Not Paid",
  transportVendorId: "", transportCost: 0, transportPickup: "", transportDelivery: "", qualityNotes: "", inspectionResult: "", notes: "", branch: "Main route"
});
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const shortDate = (value?: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";
const shortTime = (value?: string) => value ? (/^\d{2}:\d{2}$/.test(value)?value:new Date(value).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})) : "Time not set";
const daysBetween = (start?: string, end?: string) => start && end ? Math.max(1, Math.round((new Date(end + "T12:00:00").getTime() - new Date(start + "T12:00:00").getTime()) / 86400000) + 1) : 0;

export default function LinkedProcessWorkspace({ onBack, onNotice, notice, onSelectModule, initialSelection, onInitialSelectionApplied, onOpenQuality, onOpenWipTransfer }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const purchaseOrders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const machineResources = activeRows(data.machineResources).filter(m => m.status !== "Retired");
  const operations = activeRows(data.operations);
  const processTypes = activeRows(data.processTypes);
  const processCategories = activeRows(data.processCategories);

  const [companyId, setCompanyId] = useState(initialSelection?.companyId || "");
  const [factoryId, setFactoryId] = useState(initialSelection?.factoryId || "");
  const [poId, setPoId] = useState(initialSelection?.poId || "");
  const [poLineId, setPoLineId] = useState(initialSelection?.poLineId || "");
  const [selectedOperationId, setSelectedOperationId] = useState(initialSelection?.operationId || "");
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showVendorOnMap, setShowVendorOnMap] = useState(false);
  const [showPriceOnMap, setShowPriceOnMap] = useState(false);
  const [exportFields, setExportFields] = useState<ProcessExportField[]>(["process", "givenDate", "deliveryDate", "quantity"]);
  const [exportScope, setExportScope] = useState<"visible" | "selected-branch">("visible");
  const [exportIncludeArrows, setExportIncludeArrows] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<DraftOperation>(() => blankOperation());
  const [processTypeId, setProcessTypeId] = useState("");
  const [processCategoryId, setProcessCategoryId] = useState("");

  useEffect(() => {
    if (!initialSelection) return;
    setCompanyId(initialSelection.companyId); setFactoryId(initialSelection.factoryId);
    setPoId(initialSelection.poId); setPoLineId(initialSelection.poLineId);
    setSelectedOperationId(initialSelection.operationId); setShowEditor(false);
    onInitialSelectionApplied?.();
  }, [initialSelection]);

  const companyFactories = factories.filter(f => f.companyId === companyId);
  // Keep factoryId only for legacy machine-resource compatibility; PO selection is company-first.
  const companyOrders = purchaseOrders.filter(p => p.companyId === companyId);
  const selectedPO = purchaseOrders.find(p => p.id === poId);
  const poLines = selectedPO ? selectedPO.lines.filter(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt)) : [];
  const selectedLine = poLines.find(line => line.id === poLineId);
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const routeOperations = operations.filter(op => op.poLineId === poLineId && op.poId === poId && op.componentId === selectedLine?.componentId).sort((a,b) => a.sequence - b.sequence);
  const visibleOperations = routeOperations.filter(op => (op.name + " " + op.category + " " + op.machine + " " + (machineResources.find(m=>m.id===op.machineResourceId)?.name || "") + " " + (vendors.find(v => v.id === op.vendorId)?.company || "") + " " + op.status + " " + (op.branch || "Main route")).toLowerCase().includes(search.toLowerCase().trim()));
  const visibleBranches = [...new Set(visibleOperations.map(op => op.branch || "Main route"))];
  const activeOperation = routeOperations.find(op => op.id === selectedOperationId) || routeOperations[0];
  const editingOperation = editingId ? operations.find(op => op.id === editingId) : undefined;
  const operationVendorOptions = vendors.filter(v => vendorSupportsProcessType(v, processTypeId) || (editingOperation?.vendorId === v.id && (editingOperation.processTypeId || "") === (processTypeId || "")));
  const totalProcessCost = routeOperations.reduce((sum, op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const expectedQuantity = selectedLine?.quantity || 0;
  const completedQuantity = routeOperations.length ? Math.min(...routeOperations.map(op => op.accepted || 0)) : 0;
  const lateOps = routeOperations.filter(op => op.plannedEnd && op.status !== "Complete" && op.plannedEnd < new Date().toISOString().slice(0, 10));
  const transportCount = routeOperations.filter(op => op.transportCost > 0 || op.transportVendorId).length;
  const totalAccepted = routeOperations.reduce((sum, op) => sum + op.accepted, 0);
  const allDone = routeOperations.length > 0 && routeOperations.every(op => op.status === "Complete");
  const finalDelivery = selectedLine?.targetDelivery || selectedPO?.targetDelivery || "";
  const routeCost = routeOperations.reduce((sum, op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const durationDays = routeOperations.reduce((sum, op) => sum + daysBetween(op.plannedStart, op.plannedEnd), 0);
  const timelineStart = routeOperations.map(op => op.plannedStart).filter(Boolean).sort()[0] || "";
  const timelineEnd = routeOperations.map(op => op.plannedEnd).filter(Boolean).sort().at(-1) || finalDelivery;

  const changeSelection = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    const nextPO = purchaseOrders.find(p => p.companyId === nextCompanyId);
    setFactoryId(nextPO?.factoryId || "");
    setPoId(nextPO?.id || "");
    const firstLine = nextPO?.lines.find(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt));
    setPoLineId(firstLine?.id || "");
    setSelectedOperationId("");
  };
  const changePO = (nextPoId: string) => {
    const next = purchaseOrders.find(p => p.id === nextPoId);
    setPoId(nextPoId);
    setFactoryId(next?.factoryId || factoryId);
    setCompanyId(next?.companyId || companyId);
    const firstLine = next?.lines.find(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt));
    setPoLineId(firstLine?.id || "");
    setSelectedOperationId("");
  };
  const changeLine = (nextLineId: string) => { setPoLineId(nextLineId); setSelectedOperationId(""); setSearch(""); setShowEditor(false); };

  const startAdd = (branch = false, transport = false) => {
    if (!selectedPO || !selectedLine || !selectedComponent) {
      onNotice("Select a saved company, purchase order and PO component line first. AXIMACH will then link every operation to that line.");
      return;
    }
    const base = blankOperation(selectedLine);
    setProcessTypeId(""); setProcessCategoryId("");
    if (transport) { base.name = "Transport / handover"; base.category = "Logistics"; base.branch = "Main route"; }
    if (branch && activeOperation) { base.branch = "Alternate / rework"; base.name = "Alternate / rework operation"; }
    setDraft(base);
    setEditingId("");
    setShowEditor(true);
  };
  const editActive = (operation: OperationRecord | undefined = activeOperation) => {
    if (!operation) return;
    setProcessTypeId(operation.processTypeId || "");
    setProcessCategoryId(processTypes.find(item=>item.id===operation.processTypeId)?.categoryId || "");
    setDraft({
      name: operation.name, category: operation.category, machine: operation.machine, machineResourceId: operation.machineResourceId || "", vendorId: operation.vendorId,
      status: operation.status, plannedStart: operation.plannedStart, plannedEnd: operation.plannedEnd, plannedStartTime: operation.plannedSlotStartAt?new Date(operation.plannedSlotStartAt).toTimeString().slice(0,5):"", plannedEndTime: operation.plannedSlotEndAt?new Date(operation.plannedSlotEndAt).toTimeString().slice(0,5):"", actualStart: operation.actualStart || "", actualEnd: operation.actualEnd || "",
      quantity: operation.quantity, completed: operation.completed, accepted: operation.accepted, rejected: operation.rejected, setupHours: operation.setupHours || 0, cycleTimeSeconds: operation.cycleTimeSeconds || 0,
      ratePerPart: operation.ratePerPart, actualRatePerPart: operation.actualRatePerPart || 0, vendorPaymentStatus: operation.vendorPaymentStatus || "Not Paid", transportVendorId: operation.transportVendorId || "", transportCost: operation.transportCost, transportPickup: operation.transportPickup,
      transportDelivery: operation.transportDelivery, qualityNotes: operation.qualityNotes, inspectionResult: operation.inspectionResult || "", notes: operation.notes, branch: operation.branch
    });
    setEditingId(operation.id); setShowEditor(true);
  };
  const saveOperation = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line first."); return; }
    if (!draft.name.trim()) { onNotice("Select a process type from Process Directory."); return; }
    if (!editingId && !processTypeId) { onNotice("Select a process type from Process Directory."); return; }
    if (processTypeId && !processTypes.some(item => item.id === processTypeId)) { onNotice("The selected process type is no longer active in Process Directory."); return; }
    const oldOperation = operations.find(op => op.id === editingId);
    const effectiveProcessTypeId = processTypeId || oldOperation?.processTypeId || "";
    if (draft.vendorId) {
      const assignedVendor = vendors.find(vendor => vendor.id === draft.vendorId);
      if (!assignedVendor) { onNotice("Select an active Vendor Master record."); return; }
      const retainingHistoricalAssignment = oldOperation?.vendorId === draft.vendorId && (oldOperation.processTypeId || "") === (processTypeId || "");
      if (!effectiveProcessTypeId && !retainingHistoricalAssignment) { onNotice("Select a Process Directory type before assigning a vendor."); return; }
      if (effectiveProcessTypeId && !vendorSupportsProcessType(assignedVendor,effectiveProcessTypeId) && !retainingHistoricalAssignment) { onNotice("This vendor is assigned to a different process type. Select a vendor registered for this operation’s process."); return; }
    }
    if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) { onNotice("Enter a positive quantity to process for this operation."); return; }
    if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) { onNotice("Target/end date cannot be before planned start date."); return; }
    if (draft.accepted + draft.rejected > draft.completed) { onNotice("Accepted plus rejected quantity cannot exceed completed quantity."); return; }
    if ((draft.setupHours || 0) < 0 || (draft.cycleTimeSeconds || 0) < 0) { onNotice("Setup hours and cycle time cannot be negative."); return; }
    const stamp = nowIso();
    const {plannedStartTime,plannedEndTime,...operationDraft}=draft;
    const operationId = editingId || makeId("operation");
    update(current => {
      const currentRoute = current.operations.filter(op => op.poLineId === selectedLine.id && op.poId === selectedPO.id && op.componentId === selectedComponent.id && !op.deletedAt);
      const old = current.operations.find(op => op.id === operationId);
      const next: OperationRecord = {
        id: operationId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id,
        sequence: old?.sequence ?? (Math.max(0, ...currentRoute.map(op => op.sequence)) + 10),
        ...operationDraft, processTypeId: processTypeId || old?.processTypeId, vendorId: draft.vendorId || "", actualRatePerPart: draft.actualRatePerPart || 0, transportVendorId: draft.transportVendorId || "",
        plannedStartTime: plannedStartTime || "", plannedEndTime: plannedEndTime || "",
        plannedSlotStartAt: old && old.machineResourceId === draft.machineResourceId && old.plannedStart === draft.plannedStart && old.plannedEnd === draft.plannedEnd ? old.plannedSlotStartAt : undefined,
        plannedSlotEndAt: old && old.machineResourceId === draft.machineResourceId && old.plannedStart === draft.plannedStart && old.plannedEnd === draft.plannedEnd ? old.plannedSlotEndAt : undefined,
        createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined,
        parentId: old?.parentId || (draft.branch !== "Main route" ? activeOperation?.id || "" : "")
      };
      return { ...current, operations: [...current.operations.filter(op => op.id !== next.id), next] };
    });
    setSelectedOperationId(operationId);
    setShowEditor(false); setEditingId("");
    onNotice(editingId ? "Operation updated and linked to its PO line/component ID." : "Operation saved against the selected PO line. Cost and dates remain separate for this component.");
  };
  const updateOperation = (id: string, patch: Partial<OperationRecord>) => {
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(op => op.id === id ? { ...op, ...patch, updatedAt: stamp } : op) }));
  };
  const moveOperation = (id: string, direction: -1 | 1) => {
    const index = routeOperations.findIndex(op => op.id === id);
    const current = routeOperations[index];
    const neighbor = routeOperations[index + direction];
    if (!current || !neighbor) return;
    const stamp = nowIso();
    update(data => ({ ...data, operations: data.operations.map(op =>
      op.id === current.id ? { ...op, sequence: neighbor.sequence, updatedAt: stamp } :
      op.id === neighbor.id ? { ...op, sequence: current.sequence, updatedAt: stamp } : op
    ) }));
    onNotice("Operation sequence updated for this PO component route.");
  };

  const archiveOperation = (op: OperationRecord) => {
    if (!window.confirm("Archive this operation? Its history and quotations will be retained.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(item => item.id === op.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item), quotations: current.quotations.map(q => q.operationId === op.id && !q.deletedAt ? { ...q, deletedAt: stamp, updatedAt: stamp } : q) }));
    setSelectedOperationId(""); onNotice("Operation archived. Linked quotation history was retained as archived history.");
  };

  const splitOperationIntoBatches = (operation: OperationRecord) => {
    if (operation.status !== "Queued" || operation.completed > 0 || operation.accepted > 0 || operation.rejected > 0 || operation.actualStart || operation.plannedSlotStartAt) {
      onNotice("Only a queued operation with no production progress or approved machine slot can be split. Preserve started work as its own production history.");
      return;
    }
    if (!Number.isInteger(operation.quantity) || operation.quantity < 2) {
      onNotice("The operation quantity must be at least 2 whole pieces before it can be split.");
      return;
    }
    const raw = window.prompt("Enter the maximum pieces per batch. AXIMACH will create equal-sized batches plus a final balance batch.", String(Math.ceil(operation.quantity / 2)));
    if (raw === null) return;
    const batchSize = Number(raw);
    if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize >= operation.quantity) {
      onNotice("Enter a whole-number batch size greater than zero and smaller than the operation quantity.");
      return;
    }
    const batches = Math.ceil(operation.quantity / batchSize);
    if (!window.confirm("Create " + batches + " batches from " + operation.quantity.toLocaleString("en-IN") + " pieces? The original queued operation will be archived for history.")) return;
    const stamp = nowIso();
    const children: OperationRecord[] = [];
    let remaining = operation.quantity;
    for (let index = 0; index < batches; index++) {
      const quantity = Math.min(batchSize, remaining);
      remaining -= quantity;
      children.push({
        ...operation,
        id: makeId("operation"),
        sequence: operation.sequence,
        name: operation.name + " · Batch " + (index + 1) + "/" + batches,
        quantity,
        completed: 0,
        accepted: 0,
        rejected: 0,
        status: "Queued",
        actualStart: "",
        actualEnd: "",
        plannedSlotStartAt: undefined,
        plannedSlotEndAt: undefined,
        // Keep one setup allowance and one transport charge; do not multiply costs silently.
        setupHours: index === 0 ? operation.setupHours || 0 : 0,
        transportCost: index === 0 ? operation.transportCost : 0,
        parentId: operation.id,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: undefined,
        notes: [operation.notes, "Batch " + (index + 1) + "/" + batches + " split from " + operation.name + ". Setup allowance and transport charge retained on batch 1 only."].filter(Boolean).join("\n")
      });
    }
    update(current => ({
      ...current,
      operations: current.operations.flatMap(item => item.id === operation.id
        ? [{ ...item, deletedAt: stamp, updatedAt: stamp }, ...children]
        : [item])
    }));
    setSelectedOperationId(children[0]?.id || "");
    onNotice("Operation split into " + batches + " queued batches. Total quantity is preserved; setup hours and transport cost remain on batch 1 only. Review and schedule each batch.");
  };

  const componentQuotes = data.quotations.filter(q => q.poLineId === poLineId && q.componentId === selectedComponent?.id && !q.deletedAt);
  const selectedVendor = vendors.find(v => v.id === activeOperation?.vendorId);
  const selectedOperationQuotations = componentQuotes.filter(q => q.operationId === activeOperation?.id);
  const deliveryState = !finalDelivery ? "No delivery date" : allDone ? "Route complete" : lateOps.length ? "At risk" : "Scheduled";
  const selectedExportColumns = PROCESS_EXPORT_COLUMNS.filter(column => exportFields.includes(column.key));
  const exportVendorName = (operation: OperationRecord) => vendors.find(vendor => vendor.id === operation.vendorId)?.company || "";
  const exportCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
  const exportOperations = exportScope === "selected-branch" && activeOperation
    ? visibleOperations.filter(operation => (operation.branch || "Main route") === (activeOperation.branch || "Main route"))
    : visibleOperations;
  const exportBaseName = [selectedComponent?.partNumber || "Component", selectedPO?.number || "Process-Map"]
    .join("-").replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  const toggleExportField = (field: ProcessExportField) => setExportFields(current =>
    current.includes(field) ? current.filter(item => item !== field) : [...current, field]
  );
  const downloadProcessRoute = async () => {
    if (!exportOperations.length) { onNotice("There are no visible operation rows to export. Clear or change the search filter."); return; }
    if (!selectedExportColumns.length) { onNotice("Choose at least one export field."); return; }
    const rows = [
      selectedExportColumns.map(column => exportCell(column.label)).join(","),
      ...exportOperations.map(operation => selectedExportColumns
        .map(column => exportCell(processExportValue(operation, column.key, exportVendorName(operation))))
        .join(","))
    ];
    try {
      const result = await saveBlobFile("AXIMACH-" + exportBaseName + "-Process-Map.csv", new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
      onNotice(result === "cancelled" ? "CSV download cancelled." : "Process Map CSV prepared with " + selectedExportColumns.length + " selected field(s) and " + exportOperations.length + " operation(s).");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not prepare the Process Map CSV.");
    }
  };
  const escapeSvg = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  const buildProcessMapSvg = () => {
    const branches = [...new Set(exportOperations.map(operation => operation.branch || "Main route"))]
      .sort((a, b) => a === "Main route" ? -1 : b === "Main route" ? 1 : a.localeCompare(b));
    const nodeWidth = 246, nodeHeight = Math.max(142, 88 + Math.max(0, selectedExportColumns.length - 1) * 18);
    const gap = 58, left = 48, top = 78, laneHeight = nodeHeight + 66;
    const maxNodes = Math.max(1, ...branches.map(branch => exportOperations.filter(operation => (operation.branch || "Main route") === branch).length));
    const width = Math.max(920, left * 2 + maxNodes * nodeWidth + Math.max(0, maxNodes - 1) * gap);
    const height = Math.max(270, top + branches.length * laneHeight + 44);
    const svgText = (x: number, y: number, value: unknown, size = 12, colour = "#d9edf6", weight = 500) =>
      "<text x=\"" + x + "\" y=\"" + y + "\" fill=\"" + colour + "\" font-family=\"Arial, sans-serif\" font-size=\"" + size + "\" font-weight=\"" + weight + "\">" + escapeSvg(value) + "</text>";
    const laneMarkup = branches.map((branch, laneIndex) => {
      const laneRows = exportOperations.filter(operation => (operation.branch || "Main route") === branch);
      const y = top + laneIndex * laneHeight;
      const cards = laneRows.map((operation, index) => {
        const x = left + index * (nodeWidth + gap), cardY = y + 23;
        const details = selectedExportColumns
          .filter(column => column.key !== "process")
          .map(column => ({ label: column.label, value: processExportValue(operation, column.key, exportVendorName(operation)) }))
          .filter(item => item.value !== "" && item.value !== null && item.value !== undefined)
          .slice(0, 7);
        const statusColour = operation.status === "Complete" ? "#5bd5b0" : operation.status === "Running" ? "#68c9ed" : operation.status === "Quality hold" ? "#f0a3a9" : "#a9bfd0";
        const detailMarkup = details.map((detail, detailIndex) =>
          svgText(x + 14, cardY + 72 + detailIndex * 17, detail.label + ": " + detail.value, 10, "#a9c6d6", 400)
        ).join("");
        const arrow = exportIncludeArrows && index < laneRows.length - 1
          ? "<path d=\"M " + (x + nodeWidth + 3) + " " + (cardY + 52) + " H " + (x + nodeWidth + gap - 13) + "\" stroke=\"#55cfe0\" stroke-width=\"2.5\" fill=\"none\" marker-end=\"url(#routeArrow)\"/>"
          : "";
        return arrow +
          "<g><rect x=\"" + x + "\" y=\"" + cardY + "\" width=\"" + nodeWidth + "\" height=\"" + nodeHeight + "\" rx=\"13\" fill=\"#0d2b40\" stroke=\"#2e7893\" stroke-width=\"1.2\"/><rect x=\"" + x + "\" y=\"" + cardY + "\" width=\"" + nodeWidth + "\" height=\"4\" rx=\"2\" fill=\"#45c7db\"/>" +
          svgText(x + 14, cardY + 25, "STAGE " + String(index + 1).padStart(2, "0") + " · OP-" + String(operation.sequence).padStart(3, "0"), 9, "#76b6ca", 600) +
          svgText(x + 14, cardY + 50, operation.name || "Unnamed process", 14, "#effaff", 700) +
          svgText(x + nodeWidth - 14, cardY + 25, operation.status, 9, statusColour, 600) +
          detailMarkup + "</g>";
      }).join("");
      return svgText(left, y + 12, branch.toUpperCase() + " · " + laneRows.length + " STAGE(S)", 10, "#76b6ca", 700) + cards;
    }).join("");
    const title = (selectedComponent?.partNumber || "AXIMACH") + " · " + (selectedPO?.number || "PROCESS MAP");
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"0 0 " + width + " " + height + "\"><defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#071b2b\"/><stop offset=\"1\" stop-color=\"#0d3047\"/></linearGradient><marker id=\"routeArrow\" markerWidth=\"9\" markerHeight=\"9\" refX=\"7\" refY=\"4\" orient=\"auto\"><path d=\"M0 0 L8 4 L0 8 Z\" fill=\"#55cfe0\"/></marker></defs><rect width=\"100%\" height=\"100%\" fill=\"url(#bg)\"/>" + svgText(left, 38, title, 20, "#f0fbff", 700) + svgText(left, 58, "AXIMACH · DATA-LINKED PROCESS MAP · " + exportOperations.length + " SAVED OPERATION(S)", 9, "#7ca6bb", 500) + laneMarkup + "</svg>";
  };
  const downloadVisualProcessMap = async (format: "svg" | "png") => {
    if (!exportOperations.length) { onNotice("There are no visible operation rows to export."); return; }
    if (!selectedExportColumns.length) { onNotice("Choose at least one export field."); return; }
    const svgBlob = new Blob([buildProcessMapSvg()], { type: "image/svg+xml;charset=utf-8" });
    if (format === "svg") {
      try {
        const result = await saveBlobFile("AXIMACH-" + exportBaseName + "-Process-Map.svg", svgBlob);
        onNotice(result === "cancelled" ? "SVG download cancelled." : "Process Map SVG exported from saved operation records.");
      } catch (error) { onNotice(error instanceof Error ? error.message : "Could not export SVG."); }
      return;
    }
    const objectUrl = URL.createObjectURL(svgBlob);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("The process map image could not be rendered."));
        image.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas rendering is unavailable on this device.");
      context.drawImage(image, 0, 0);
      const pngBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed.")), "image/png")
      );
      const result = await saveBlobFile("AXIMACH-" + exportBaseName + "-Process-Map.png", pngBlob);
      onNotice(result === "cancelled" ? "PNG download cancelled." : "Process Map PNG exported from saved operation records.");
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not export PNG.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  const printProcessRoute = () => {
    if (!exportOperations.length) { onNotice("There are no visible operation rows to print."); return; }
    if (!selectedExportColumns.length) { onNotice("Choose at least one print field."); return; }
    window.print();
  };
  const tab = (id: string, title: string, Icon: typeof Workflow) => <button key={id} className={"route-tab " + (id === "process-map" ? "route-tab-current" : "")} onClick={() => id === "process-map" ? undefined : onSelectModule(id === "components" ? "components" : id === "purchasing" ? "purchasing" : id === "inventory" ? "inventory" : id === "costing" ? "costing" : id === "documents" ? "engineering-change" : id === "history" ? "reports" : "quality")}><Icon size={14}/>{title}</button>;

  return <section className="workspace-page linked-process-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED DATA CONNECTED" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO DATA · LOCAL UNTIL SERVER SYNC"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / LINKED PROCESS ROUTE</div><h1>Process Map<span>.</span></h1><p>Choose existing master records once; operation schedules, rates, vendor assignments, quality and quotations attach to the selected PO component line.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendors</button><button className="button-primary" onClick={() => startAdd()} disabled={!selectedLine}><Plus size={15}/> Add Operation</button></div></div>
    <div className="linked-master-selectors">
      <SearchablePicker id="route-company" label="Company" value={companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={changeSelection}/>
      <div className="route-master-picker"><SearchablePicker id="route-po" label="Purchase order" value={poId} placeholder="Type PO number…" options={companyOrders.map(po=>({id:po.id,label:po.number+" · "+po.status}))} onChange={changePO}/>{companyId&&!companyOrders.length&&<button type="button" onClick={()=>onSelectModule("purchasing")}>Add PO</button>}</div>
      <div className="route-master-picker"><SearchablePicker id="route-component-line" label="PO component line" value={poLineId} placeholder="Type part number or name…" options={poLines.map(line=>{const component=components.find(item=>item.id===line.componentId);return {id:line.id,label:(component?component.partNumber+" · "+component.name:"Missing component")+" · "+line.quantity.toLocaleString("en-IN")+" pcs"};})} onChange={changeLine}/>{poId&&!poLines.length&&<button type="button" onClick={()=>onSelectModule("purchasing")}>Add PO lines</button>}</div>
    </div>
    {selectedLine && selectedComponent ? <>
      <div className="linked-component-summary"><div><small>SELECTED COMPONENT</small><strong>{selectedComponent.partNumber} · {selectedComponent.name}</strong><span>Revision {selectedComponent.revision || "—"} · {selectedComponent.material || "Material not entered"} · PO {selectedPO?.number}</span></div><div><small>ORDER QUANTITY</small><strong>{expectedQuantity.toLocaleString("en-IN")} pcs</strong></div><div><small>LINE DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div><div><small>DRAWING / REFERENCE</small><strong>{selectedComponent.drawingReference || "Not entered"}</strong></div><button className="button-quiet compact-button" onClick={() => onSelectModule("components")}>Edit component master</button></div>
      <div className="linked-kpis">
        <button className="route-kpi kpi-delivery" onClick={() => document.getElementById("linked-timeline")?.scrollIntoView({behavior:"smooth",block:"nearest"})}><span className="kpi-icon"><CalendarClock size={19}/></span><span><small>DELIVERY FORECAST</small><strong>{deliveryState}</strong><em>{finalDelivery ? "Target " + shortDate(finalDelivery) : "Enter PO line delivery date"}</em></span></button>
        <button className={"route-kpi kpi-risk " + (lateOps.length ? "linked-kpi-alert" : "")} onClick={() => setSearch("Quality hold")}><span className="kpi-icon"><ShieldAlert size={19}/></span><span><small>BOTTLENECK / LATE OPERATIONS</small><strong>{lateOps.length}</strong><em>{lateOps.length ? "Late or overdue target dates" : "No overdue targets recorded"}</em></span></button>
        <button className="route-kpi kpi-wip"><span className="kpi-icon"><Boxes size={19}/></span><span><small>WORK IN PROGRESS</small><strong>{routeOperations.filter(op => op.status === "Running").reduce((sum,op) => sum + Math.max(0,op.quantity-op.completed),0).toLocaleString("en-IN")} pcs</strong><em>{routeOperations.filter(op => op.status === "Running").length} operations running</em></span></button>
        {showPriceOnMap && <button className="route-kpi kpi-cost" onClick={() => onSelectModule("costing")}><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>ENTERED PROCESS + TRANSPORT COST</small><strong>{money(routeCost)}</strong><em>Rates from this component route only</em></span></button>}
        <button className="route-kpi kpi-transport"><span className="kpi-icon"><Truck size={19}/></span><span><small>TRANSPORT ACTIVITIES</small><strong>{transportCount}</strong><em>Operations with transport cost/vendor</em></span></button>
        <button className="route-kpi kpi-quality"><span className="kpi-icon"><ClipboardCheck size={19}/></span><span><small>ACCEPTED / ORDER QTY</small><strong>{totalAccepted.toLocaleString("en-IN")} pcs</strong><em>Sum of accepted quantities entered per operation</em></span></button>
      </div>
    </> : <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>Start with your real master records</h3><p>No company, PO or component is preloaded. Add each master record once; then select a real purchase-order line and AXIMACH will load the component, quantity and delivery date for its route.</p><div className="linked-empty-actions"><button className="button-primary" onClick={() => onSelectModule("companies")}><Plus size={14}/> Add company</button><button className="button-quiet" onClick={() => onSelectModule("components")}><Package size={14}/> Add component</button><button className="button-quiet" onClick={() => onSelectModule("purchasing")}><FileText size={14}/> Create PO</button></div></div></section>}
    <nav className="linked-route-tabs" aria-label="Linked component workspaces">
      {tab("process-map","Process Map",Workflow)}
      {tab("components","Component Details",Package)}
      {tab("purchasing","PO Components",FileText)}
      {tab("inventory","BOM & Material",Boxes)}
      {tab("costing","Costing",CircleDollarSign)}
      {tab("documents","Documents",FileText)}
      {tab("history","History",Activity)}
    </nav>
    <div className="linked-route-toolbar"><div className="linked-route-actions"><button className="button-primary compact-button" disabled={!selectedLine} onClick={() => startAdd()}><Plus size={14}/> Add operation</button><button className="button-quiet compact-button" disabled={!selectedLine} onClick={() => startAdd(false, true)}><Truck size={14}/> Add transport</button><button className="button-quiet compact-button" disabled={!selectedLine || !activeOperation} onClick={() => startAdd(true)}><GitBranch size={14}/> Add branch / rework</button><button className="button-quiet compact-button" onClick={() => { setZoom(1); setSearch(""); }}><Search size={14}/> Clear search / fit</button></div><div className="linked-route-actions"><label className="linked-search"><Search size={14}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search operation, vendor, machine…"/></label><button className={"button-quiet compact-button " + (vertical ? "control-active" : "")} onClick={() => setVertical(v => !v)}>{vertical ? "Vertical layout" : "Horizontal layout"}</button><input aria-label="Route zoom" type="range" min="0.65" max="1.25" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))}/><span className="zoom-readout">{Math.round(zoom * 100)}%</span></div></div>
    <section className="pm-export-panel surface-panel">
      <div className="pm-export-heading">
        <div><div className="eyebrow">VIEW & DOWNLOAD CONTROLS</div><h3><SlidersHorizontal size={15}/> Choose what appears and what gets exported</h3><p>Vendor and price are hidden by default. Display toggles affect this Process Map only; export checkboxes independently control the downloaded file.</p></div>
        <span className="module-number">{visibleOperations.length} VISIBLE ROWS</span>
      </div>
      <div className="pm-export-control-grid">
        <div className="pm-export-control-block">
          <strong><Eye size={14}/> MAP DISPLAY</strong>
          <label><input type="checkbox" checked={showVendorOnMap} onChange={event=>setShowVendorOnMap(event.target.checked)}/> Show vendor names and payment info</label>
          <label><input type="checkbox" checked={showPriceOnMap} onChange={event=>setShowPriceOnMap(event.target.checked)}/> Show price and operation cost details</label>
          <small>These switches do not change the saved records or Costing & Payments.</small>
        </div>
        <div className="pm-export-control-block pm-export-field-block">
          <strong><FileText size={14}/> DOWNLOAD / PRINT FIELDS</strong>
          <div className="pm-export-checkboxes">
            {PROCESS_EXPORT_COLUMNS.map(column=><label key={column.key}><input type="checkbox" checked={exportFields.includes(column.key)} onChange={()=>toggleExportField(column.key)}/>{column.label}</label>)}
          </div>
          <div className="pm-export-checkboxes">
            <label><input type="checkbox" checked={exportIncludeArrows} onChange={event=>setExportIncludeArrows(event.target.checked)}/> Connection arrows</label>
            <label>Export scope<select value={exportScope} onChange={event=>setExportScope(event.target.value as "visible" | "selected-branch")}><option value="visible">Full visible map</option><option value="selected-branch" disabled={!activeOperation}>Selected branch</option></select></label>
          </div>
          <small>Vendor, price and process description are optional. Scope applies to CSV and visual exports; arrows apply to SVG and PNG.</small>
        </div>
        <div className="pm-export-actions">
          <button type="button" className="button-primary compact-button" onClick={downloadProcessRoute} disabled={!exportOperations.length || !selectedExportColumns.length}><Download size={14}/> CSV</button>
          <button type="button" className="button-quiet compact-button" onClick={()=>downloadVisualProcessMap("svg")} disabled={!exportOperations.length || !selectedExportColumns.length}><Download size={14}/> SVG</button>
          <button type="button" className="button-quiet compact-button" onClick={()=>downloadVisualProcessMap("png")} disabled={!exportOperations.length || !selectedExportColumns.length}><Download size={14}/> PNG</button>
          <button type="button" className="button-quiet compact-button" onClick={printProcessRoute} disabled={!exportOperations.length || !selectedExportColumns.length}><Printer size={14}/> Print / Save PDF</button>
          <span>{selectedExportColumns.length} field(s) · {exportOperations.length} operation(s)</span>
        </div>
      </div>
    </section>
    <ProcessMap3DViewer key={poLineId} operations={visibleOperations} vendors={vendors.map(vendor=>({id:vendor.id,company:vendor.company}))} selectedOperationId={selectedOperationId} showVendor={showVendorOnMap} showPrice={showPriceOnMap} onSelectOperation={setSelectedOperationId}/>
    <div className="linked-process-layout">
      <section className="surface-panel linked-route-canvas">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / LIVE RECORDS</div><h3>{selectedLine ? (selectedComponent?.partNumber || "Component") + " · Route graph" : "Route graph"}</h3><p>{routeOperations.length} saved operations · branches and rework remain attached to this PO line</p></div><span className="module-number">{routeOperations.length} OPS</span></div>
        {showEditor && <section className="route-editor-panel linked-operation-editor"><div className="route-editor-heading"><div><strong><Plus size={15}/> {editingId ? "Edit operation" : "Add operation"}</strong><small>All saved changes are linked to this selected PO line and component.</small></div><button className="icon-control" onClick={() => setShowEditor(false)} aria-label="Close editor"><X size={14}/></button></div>
          <div className="route-editor-form">
            <label>Process category *<select value={processCategoryId} onChange={e=>{setProcessCategoryId(e.target.value);setProcessTypeId("");setDraft(current=>({...current,name:"",category:processCategories.find(item=>item.id===e.target.value)?.name||"",vendorId:""}));}}><option value="">Choose category…</option>{processCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>Process / subcategory *<select value={processTypeId} onChange={e=>{const selected=processTypes.find(item=>item.id===e.target.value);setProcessTypeId(e.target.value);if(selected)setDraft(current=>({...current,name:selected.name,category:processCategories.find(item=>item.id===selected.categoryId)?.name||current.category,vendorId:vendors.some(vendor=>vendorSupportsProcessType(vendor,selected.id))?current.vendorId:""}));}}><option value="">{editingId&&!processTypeId?"Keep legacy process name":"Choose process…"}</option>{processTypes.filter(item=>!processCategoryId||item.categoryId===processCategoryId).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            {!processTypes.length && <small className="field-hint">Create process categories and types in Process Directory first.</small>}
            <label>Machine / station (text)<input value={draft.machine} onChange={e => setDraft({...draft,machine:e.target.value})} placeholder="Machine / work centre"/></label>
            <label>Linked machine resource<select value={draft.machineResourceId || ""} onChange={e => { const resource=machineResources.find(m=>m.id===e.target.value); setDraft({...draft,machineResourceId:e.target.value,machine:resource?resource.code+" · "+resource.name:draft.machine}); }}><option value="">Not linked to a registered machine</option>{machineResources.filter(m=>!selectedPO || m.factoryId===selectedPO.factoryId).map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select></label>{!machineResources.length&&<small className="field-hint">Register machine resources in Maintenance & Downtime to link operations to machine capacity.</small>}
            <SearchablePicker id="operation-vendor-picker" label="Vendor (capable of this process)" value={draft.vendorId} placeholder="Search vendors for the selected process…" options={operationVendorOptions.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")+(v.status.toLowerCase().includes("unverified")?" · Unverified":"")}))} onChange={vendorId=>setDraft({...draft,vendorId})}/>{processTypeId&&!operationVendorOptions.length && <small className="field-hint">No vendor capability is assigned to this process yet. Add the vendor to this process in Vendor Master or Process Directory.</small>}
            <label>Vendor payment status<select value={draft.vendorPaymentStatus || "Not Paid"} onChange={e=>setDraft({...draft,vendorPaymentStatus:e.target.value as "Paid" | "Not Paid"})}><option value="Not Paid">Not Paid</option><option value="Paid">Paid</option></select></label>
            <label>Planned start<input type="date" value={draft.plannedStart} onChange={e => setDraft({...draft,plannedStart:e.target.value})}/></label>
            <label>Planned target/end<input type="date" min={draft.plannedStart || undefined} value={draft.plannedEnd} onChange={e => setDraft({...draft,plannedEnd:e.target.value})}/></label>
            <label>Planned start time<input type="time" value={draft.plannedStartTime} onChange={e=>setDraft({...draft,plannedStartTime:e.target.value})}/></label>
            <label>Planned delivery time<input type="time" value={draft.plannedEndTime} onChange={e=>setDraft({...draft,plannedEndTime:e.target.value})}/></label>
            <label>Actual start date<input type="date" value={draft.actualStart} onChange={e => setDraft({...draft,actualStart:e.target.value})}/></label>
            <label>Actual completion date<input type="date" min={draft.actualStart || undefined} value={draft.actualEnd} onChange={e => setDraft({...draft,actualEnd:e.target.value})}/></label>
            <label>Duration (calendar days)<input readOnly value={daysBetween(draft.plannedStart,draft.plannedEnd) || "—"}/></label>
            <label>Quantity to process<input type="number" min="0" value={draft.quantity || ""} onChange={e => setDraft({...draft,quantity:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Setup time (machine hours)<input type="number" min="0" step="0.25" value={draft.setupHours || ""} onChange={e => setDraft({...draft,setupHours:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Cycle time per piece (seconds)<input type="number" min="0" step="0.1" value={draft.cycleTimeSeconds || ""} onChange={e => setDraft({...draft,cycleTimeSeconds:Math.max(0,Number(e.target.value)||0)})}/></label>
            <small className="field-hint">Machine-hour requirement = setup hours + (quantity × cycle seconds ÷ 3,600). Enter actual process estimates; zero means not yet estimated.</small>
            <label>Completed quantity<input type="number" min="0" value={draft.completed || ""} onChange={e => setDraft({...draft,completed:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Accepted quantity<input type="number" min="0" value={draft.accepted || ""} onChange={e => setDraft({...draft,accepted:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Rejected quantity<input type="number" min="0" value={draft.rejected || ""} onChange={e => setDraft({...draft,rejected:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Quoted / planned rate per part (₹)<input type="number" min="0" step="0.01" value={draft.ratePerPart || ""} onChange={e => setDraft({...draft,ratePerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Actual rate per part (₹)<input type="number" min="0" step="0.01" value={draft.actualRatePerPart || ""} onChange={e => setDraft({...draft,actualRatePerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Planned process cost (₹)<input readOnly value={money(draft.quantity * draft.ratePerPart)}/></label>
            <label>Status<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as LifecycleStatus})}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
            <label>Route type<input value={draft.branch} onChange={e => setDraft({...draft,branch:e.target.value})} placeholder="Main route / Alternate / Rework"/></label>
            <SearchablePicker id="operation-transport-vendor-picker" label="Transport vendor" value={draft.transportVendorId} placeholder="Type transporter name or phone…" options={vendors.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")}))} onChange={transportVendorId=>setDraft({...draft,transportVendorId})}/>
            <label>Transport pickup date<input type="date" value={draft.transportPickup} onChange={e => setDraft({...draft,transportPickup:e.target.value})}/></label>
            <label>Transport delivery date<input type="date" value={draft.transportDelivery} onChange={e => setDraft({...draft,transportDelivery:e.target.value})}/></label>
            <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={draft.transportCost || ""} onChange={e => setDraft({...draft,transportCost:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label className="editor-wide">Quality / inspection requirement<input value={draft.qualityNotes} onChange={e => setDraft({...draft,qualityNotes:e.target.value})} placeholder="Required checks, acceptance criteria, gauges…"/></label>
            <label className="editor-wide">Inspection result<input value={draft.inspectionResult} onChange={e => setDraft({...draft,inspectionResult:e.target.value})} placeholder="Not inspected, accepted, rejected, actual results…"/></label>
            <label className="editor-wide">Operation notes<input value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})} placeholder="Setup, process constraints, delivery instructions"/></label>
            <div className="module-form-actions"><button className="button-primary" onClick={saveOperation}><Check size={14}/> {editingId ? "Save changes" : "Save operation"}</button><button className="button-quiet" onClick={() => setShowEditor(false)}>Cancel</button></div>
          </div>
        </section>}
        {routeOperations.length ? <div className={"linked-node-scroll " + (vertical ? "linked-node-vertical" : "")}><div className="linked-route-lanes" style={{transform:"scale(" + zoom + ")",transformOrigin:"top left"}}>{visibleBranches.map(branch => {
          const laneOperations = visibleOperations.filter(op => (op.branch || "Main route") === branch);
          const alternate = branch !== "Main route";
          const branchParents = [...new Set(laneOperations.map(op => op.parentId ? routeOperations.find(parent => parent.id === op.parentId)?.name : "").filter(Boolean))];
          return <section className={"linked-route-lane " + (alternate ? "linked-route-lane-alternate" : "")} key={branch}>
            <div className="linked-route-lane-heading"><strong>{branch}</strong><small>{laneOperations.length} operation(s) · {alternate ? "alternate / rework route" : "primary route"}{branchParents.length ? " · branches from " + branchParents.join(", ") : ""}</small></div>
            <div className="linked-node-track">{laneOperations.map((op,index) => {
              const vendor = vendors.find(v => v.id === op.vendorId);
              const selected = op.id === activeOperation?.id;
              return <div className="linked-node-wrap" key={op.id}><button className={"linked-operation-node status-" + op.status.toLowerCase().replaceAll(" ","-") + (alternate ? " linked-node-alternate" : "") + (selected ? " linked-node-selected" : "")} onClick={() => {setSelectedOperationId(op.id);editActive(op);}}><span className="linked-node-icon">{op.name.toLowerCase().includes("transport") || op.name.toLowerCase().includes("dispatch") ? <Truck size={19}/> : op.name.toLowerCase().includes("inspect") || op.name.toLowerCase().includes("quality") ? <ClipboardCheck size={19}/> : op.name.toLowerCase().includes("grind") ? <Wrench size={19}/> : <Workflow size={19}/>}</span><strong>{op.name}</strong><small>OP-{String(op.sequence).padStart(3,"0")}</small><span>{op.status}</span>{showVendorOnMap && <small>{vendor?.company || "Vendor unassigned"}</small>}<small>Given: {shortDate(op.plannedStart)} · {shortTime(op.plannedStartTime || op.plannedSlotStartAt)}</small><small>Qty: {op.quantity.toLocaleString("en-IN")} pcs</small><small>Delivery: {shortDate(op.plannedEnd)} · {shortTime(op.plannedEndTime || op.plannedSlotEndAt)}</small>{showVendorOnMap && <small>Vendor payment: {vendor ? (op.vendorPaymentStatus || "Not Paid") : "—"}</small>}{showPriceOnMap && <small>Route rate: {money(op.ratePerPart)} / pc</small>}</button>{index < laneOperations.length - 1 && <span className="linked-node-arrow"><ArrowRight size={18}/></span>}</div>;
            })}</div>
          </section>;
        })}{!visibleOperations.length && <div className="module-empty-state">No operations match this search.</div>}</div></div> : <div className="module-empty-state linked-no-operations"><Workflow size={28}/><h3>No operations saved for this component</h3><p>Add only the operations this part actually requires. There is no fixed stage limit and no sample CNC or heat-treatment data.</p><button className="button-primary" disabled={!selectedLine} onClick={() => startAdd()}><Plus size={14}/> Add first operation</button></div>}
        <div className="route-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="route-scroll-note">Select any operation to inspect its schedule, vendor, quality and cost.</span></div>
      </section>
      <aside className="surface-panel linked-operation-side">
        {activeOperation ? <><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SELECTED OPERATION</div><h3>{activeOperation.name}</h3><p>{activeOperation.category || "Process type not specified"} · OP-{String(activeOperation.sequence).padStart(3,"0")}</p></div><button className="icon-control" aria-label="Edit selected operation" onClick={() => editActive()}><Wrench size={14}/></button></div>
          <div className="linked-detail-grid"><div><small>APPROVED MACHINE SLOT</small><strong>{activeOperation.plannedSlotStartAt ? new Date(activeOperation.plannedSlotStartAt).toLocaleString("en-IN")+" – "+new Date(activeOperation.plannedSlotEndAt || activeOperation.plannedSlotStartAt).toLocaleString("en-IN") : "Not scheduled into a machine shift"}</strong><span>Generated by Production Capacity planner; review before release</span></div>{showVendorOnMap && <div><small>VENDOR</small><strong>{selectedVendor?.company || "Not assigned"}</strong><span>{selectedVendor?.phone || "No vendor number linked"}</span></div>}{showVendorOnMap && <div><small>VENDOR PAYMENT</small><strong>{selectedVendor ? (activeOperation.vendorPaymentStatus || "Not Paid") : "—"}</strong><span>Updated in Process Map · source of truth for Costing</span></div>}<div><small>MACHINE / STATION</small><strong>{activeOperation.machine || "Not entered"}</strong></div><div><small>PLANNED SCHEDULE</small><strong>{shortDate(activeOperation.plannedStart)} · {shortTime(activeOperation.plannedStartTime || activeOperation.plannedSlotStartAt)} – {shortDate(activeOperation.plannedEnd)} · {shortTime(activeOperation.plannedEndTime || activeOperation.plannedSlotEndAt)}</strong><span>{daysBetween(activeOperation.plannedStart,activeOperation.plannedEnd) || "—"} calendar day(s)</span></div><div><small>ACTUAL SCHEDULE</small><strong>{shortDate(activeOperation.actualStart)} – {shortDate(activeOperation.actualEnd)}</strong></div><div><small>QUANTITY</small><strong>{activeOperation.quantity.toLocaleString("en-IN")} pcs</strong><span>{activeOperation.completed.toLocaleString("en-IN")} completed</span></div><div><small>ACCEPTED / REJECTED</small><strong>{activeOperation.accepted.toLocaleString("en-IN")} / {activeOperation.rejected.toLocaleString("en-IN")}</strong></div>{showPriceOnMap && <div><small>QUOTED / PLANNED RATE</small><strong>{money(activeOperation.ratePerPart)}</strong></div>}{showPriceOnMap && <div><small>ACTUAL RATE / PART</small><strong>{activeOperation.actualRatePerPart ? money(activeOperation.actualRatePerPart) : "Not entered"}</strong></div>}{showPriceOnMap && <div><small>PROCESS + TRANSPORT COST</small><strong>{money(activeOperation.quantity * activeOperation.ratePerPart + activeOperation.transportCost)}</strong></div>}{(showVendorOnMap || showPriceOnMap) && <div><small>TRANSPORT</small><strong>{showVendorOnMap ? (vendors.find(v=>v.id===activeOperation.transportVendorId)?.company || "No transporter assigned") : "Vendor hidden"}</strong><span>{showPriceOnMap ? money(activeOperation.transportCost) : "Transport cost hidden"} · {activeOperation.transportPickup || activeOperation.transportDelivery ? shortDate(activeOperation.transportPickup) + " → " + shortDate(activeOperation.transportDelivery) : "Not scheduled"}</span></div>}<div><small>STATUS</small><strong>{activeOperation.status}</strong></div><div className="linked-detail-wide"><small>QUALITY / INSPECTION REQUIREMENT</small><strong>{activeOperation.qualityNotes || "No quality notes recorded"}</strong></div><div className="linked-detail-wide"><small>INSPECTION RESULT</small><strong>{activeOperation.inspectionResult || "Not entered"}</strong></div><div className="linked-detail-wide"><small>NOTES</small><strong>{activeOperation.notes || "No operation notes entered"}</strong></div></div>
          <div className="linked-side-actions"><button className="button-primary" onClick={() => editActive()}><Wrench size={14}/> Edit operation</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)<=0} onClick={()=>moveOperation(activeOperation.id,-1)}><ArrowUp size={14}/> Move earlier</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)>=routeOperations.length-1} onClick={()=>moveOperation(activeOperation.id,1)}><ArrowDown size={14}/> Move later</button><button className="button-quiet" disabled={activeOperation.status !== "Queued" || activeOperation.completed > 0 || activeOperation.accepted > 0 || activeOperation.rejected > 0 || Boolean(activeOperation.actualStart) || Boolean(activeOperation.plannedSlotStartAt) || activeOperation.quantity < 2} onClick={() => splitOperationIntoBatches(activeOperation)}><Boxes size={14}/> Split into batches</button><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Quotes / costing</button><button className="button-quiet" onClick={() => onOpenQuality ? onOpenQuality(activeOperation.id) : onSelectModule("quality")}><ClipboardCheck size={14}/> Quality inspection</button><button className="button-quiet" disabled={!selectedPO || !selectedLine || !onOpenWipTransfer} onClick={() => selectedPO && selectedLine && onOpenWipTransfer?.({companyId:selectedPO.companyId,factoryId:selectedPO.factoryId,poId:selectedPO.id,poLineId:selectedLine.id,operationId:activeOperation.id})}><Truck size={14}/> WIP handover</button><button className="button-quiet" onClick={() => archiveOperation(activeOperation)}><X size={14}/> Archive</button></div>
          <div className="linked-quote-preview"><div className="panel-heading"><div><h3>Vendor quotations</h3><p>{selectedOperationQuotations.length} quote(s) linked to this operation</p></div></div>{selectedOperationQuotations.length ? selectedOperationQuotations.map(q => <div key={q.id} className="linked-quote-mini"><strong>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</strong><span>{money(q.ratePerPart)}/part · {q.leadDays} lead day(s)</span><small>{q.quoteReference || "No quote reference"} · {q.status}</small></div>) : <div className="vendor-empty">No quotations recorded for this operation yet. Add a quote from Costing.</div>}</div>
        </> : <div className="module-empty-state"><Workflow size={28}/><h3>Select an operation</h3><p>Operation details, schedule, vendor link, quantities, quality and cost will appear here.</p></div>}
      </aside>
    </div>
    <div className="linked-bottom-grid">
      {showPriceOnMap &&       <section className="surface-panel linked-cost-card"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COST BREAKDOWN</div><h3>Entered route costs</h3><p>Only rates you entered or selected from quotations are counted.</p></div><CircleDollarSign size={18}/></div><div className="linked-cost-row"><span>Process cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.quantity*op.ratePerPart,0))}</strong></div><div className="linked-cost-row"><span>Transport cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.transportCost,0))}</strong></div><div className="linked-cost-row linked-cost-total"><span>Total entered</span><strong>{money(totalProcessCost)}</strong></div><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Open detailed costing</button></section>}
      <section className="surface-panel linked-timeline-card" id="linked-timeline"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> TIMELINE & DELIVERY</div><h3>Planned progress</h3><p>Schedule is based on saved operation dates, not estimated samples.</p></div><CalendarClock size={18}/></div><div className="linked-timeline-facts"><div><small>FIRST PLANNED START</small><strong>{shortDate(timelineStart)}</strong></div><div><small>LAST OPERATION TARGET</small><strong>{shortDate(timelineEnd)}</strong></div><div><small>SUM OF OPERATION DAYS</small><strong>{durationDays || "—"} days</strong></div><div><small>PO DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div></div><div className={"linked-delivery-state " + (lateOps.length ? "linked-delivery-late" : "")}><span>{lateOps.length ? <ShieldAlert size={16}/> : <Activity size={16}/>}</span><div><strong>{lateOps.length ? "Delay risk detected" : allDone ? "All saved operations complete" : "Delivery forecast awaits schedule data"}</strong><small>{lateOps.length ? lateOps.length + " operation(s) are past their planned target date." : "ETA can be assessed once operation schedules and dependencies are entered."}</small></div></div></section>
    </div>
    <section className="surface-panel linked-process-table">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SELECTED PROCESS FIELDS</div><h3>Process list ({visibleOperations.length} filtered operations)</h3><p>This table uses the same checked fields as CSV and Print / Save PDF. Use the search box above to narrow the rows.</p></div><span className="module-number">{selectedExportColumns.length} FIELDS · {visibleOperations.length} ROWS</span></div>
      {visibleOperations.length && selectedExportColumns.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr>{selectedExportColumns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{visibleOperations.map(operation=><tr key={operation.id} className={activeOperation?.id === operation.id ? "linked-table-selected" : ""} onClick={() => setSelectedOperationId(operation.id)}>{selectedExportColumns.map(column=><td key={column.key}>{String(processExportValue(operation,column.key,exportVendorName(operation)) ?? "—")}</td>)}</tr>)}</tbody></table></div> : <div className="vendor-empty">{visibleOperations.length ? "Choose at least one field above to show the process list." : "No operation rows match the current search for this PO component."}</div>}
    </section>
    <section className="process-map-print-only">
      <h1>AXIMACH · PROCESS MAP</h1>
      <p>{selectedComponent?.partNumber || "Component"} · {selectedComponent?.name || ""} · {selectedPO?.number || "No PO"} · {exportOperations.length} exported operation(s)</p>
      <table>
        <thead><tr>{selectedExportColumns.map(column=><th key={column.key}>{column.label}</th>)}</tr></thead>
        <tbody>{exportOperations.map(operation=><tr key={operation.id}>{selectedExportColumns.map(column=><td key={column.key}>{String(processExportValue(operation,column.key,exportVendorName(operation)) ?? "")}</td>)}</tr>)}</tbody>
      </table>
      <small>Generated from the current AXIMACH Process Map filter and export scope. Only checked fields are included.</small>
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Each route is keyed by PO line and component ID; no example company, PO, part number, quote or vendor is preloaded. Server-wide cross-device sync requires the existing AXIMACH server to be deployed with persistent storage and configured in Communication & Follow-up.</span></div>
  </section>;
}
