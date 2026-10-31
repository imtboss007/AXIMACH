import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, CalendarClock, Check, ClipboardList, Factory, Gauge, MonitorCog, Plus, RefreshCw, ShieldCheck, Truck, Wrench, X } from "lucide-react";
import SearchablePicker from "./SearchablePicker";
import { activeRows, makeId, nowIso, useManufacturingData, type MachineResourceRecord, type OperationRecord } from "./manufacturingData";

type ProcessSelection = { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string };
type Props = {
  onBack: () => void; onNotice: (value: string) => void; notice: string;
  onSelectModule: (id: string) => void; onOpenOperation: (selection: ProcessSelection) => void; onOpenWipTransfer: (selection: ProcessSelection) => void;
  initialSelection?: ProcessSelection | null; onInitialSelectionApplied?: () => void;
};
type ResourceDraft = {
  factoryId: string; name: string; machineType: string; make: string; model: string;
  envelopeX: string; envelopeY: string; envelopeZ: string;
  capacityHoursPerShift: string; shiftsPerDay: string; workingDaysPerMonth: string;
  status: "Available" | "Maintenance" | "Inactive"; notes: string;
};
type ScheduleDraft = {
  plannedStart: string; plannedEnd: string; plannedStartTime: string; plannedEndTime: string;
  plannedHours: string; machineResourceId: string;
};
const todayMonth = () => new Date().toISOString().slice(0, 7);
const dateLabel = (value?: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not scheduled";
const number = (value: number) => (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 1 });
const blankResource = (factoryId = ""): ResourceDraft => ({
  factoryId, name: "", machineType: "", make: "", model: "", envelopeX: "", envelopeY: "", envelopeZ: "",
  capacityHoursPerShift: "8", shiftsPerDay: "1", workingDaysPerMonth: "26", status: "Available", notes: ""
});
const scheduleOf = (op: OperationRecord): ScheduleDraft => ({
  plannedStart: op.plannedStart || "", plannedEnd: op.plannedEnd || "",
  plannedStartTime: op.plannedStartTime || "", plannedEndTime: op.plannedEndTime || "",
  plannedHours: op.plannedHours == null ? "" : String(op.plannedHours),
  machineResourceId: op.machineResourceId || ""
});
const timeStart = (op: OperationRecord) => op.plannedStart ? new Date(op.plannedStart + "T" + (op.plannedStartTime || "00:00") + ":00").getTime() : NaN;
const timeEnd = (op: OperationRecord) => op.plannedEnd ? new Date(op.plannedEnd + "T" + (op.plannedEndTime || "23:59") + ":59").getTime() : NaN;
const overlaps = (a: OperationRecord, b: OperationRecord) => {
  const as = timeStart(a), ae = timeEnd(a), bs = timeStart(b), be = timeEnd(b);
  return Number.isFinite(as) && Number.isFinite(ae) && Number.isFinite(bs) && Number.isFinite(be) && as <= be && bs <= ae;
};
const statusClass = (status: string) => "record-state state-" + status.toLowerCase().replace(/\s+/g, "-");

export default function ProductionPlanningWorkspace({ onBack, onNotice, notice, onSelectModule, onOpenOperation, onOpenWipTransfer, initialSelection, onInitialSelectionApplied }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const resources = activeRows(data.machineResources);
  const capabilities = activeRows(data.vendorCapabilities);
  const [tab, setTab] = useState<"schedule" | "resources" | "capacity">("schedule");
  const [companyId, setCompanyId] = useState(initialSelection?.companyId || "");
  const [factoryId, setFactoryId] = useState(initialSelection?.factoryId || "");
  const [poId, setPoId] = useState(initialSelection?.poId || "");
  const [poLineId, setPoLineId] = useState(initialSelection?.poLineId || "");
  const [selectedOperationId, setSelectedOperationId] = useState(initialSelection?.operationId || "");
  const [month, setMonth] = useState(todayMonth());
  const [search, setSearch] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null);
  const [resourceDraft, setResourceDraft] = useState<ResourceDraft>(() => blankResource(initialSelection?.factoryId || ""));
  const [editingResourceId, setEditingResourceId] = useState("");
  const [resourceFormOpen, setResourceFormOpen] = useState(false);

  useEffect(() => { if (initialSelection) onInitialSelectionApplied?.(); }, []);

  const companyFactories = factories.filter(row => !companyId || row.companyId === companyId);
  const companyOrders = orders.filter(row => (!companyId || row.companyId === companyId) && (!factoryId || row.factoryId === factoryId));
  const selectedPO = orders.find(row => row.id === poId);
  const selectedLine = selectedPO?.lines.find(row => row.id === poLineId);
  const selectedOperation = operations.find(row => row.id === selectedOperationId);
  const selectedResource = resources.find(row => row.id === selectedOperation?.machineResourceId);
  const selectedComponent = components.find(row => row.id === selectedOperation?.componentId);
  const selectedOrder = orders.find(row => row.id === selectedOperation?.poId);
  const selectedOrderLine = selectedOrder?.lines.find(row => row.id === selectedOperation?.poLineId);
  const selectedVendor = vendors.find(row => row.id === selectedOperation?.vendorId);
  const selectedCapability = selectedOperation?.vendorId && selectedOperation.processDefinitionId
    ? capabilities.filter(row => row.vendorId === selectedOperation.vendorId && row.processDefinitionId === selectedOperation.processDefinitionId)
      .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0]
    : undefined;
  const selectedCapabilityCurrentlyValid = !!selectedCapability && selectedCapability.status === "Approved"
    && (!selectedCapability.validFrom || selectedCapability.validFrom <= (selectedOperation?.plannedStart || new Date().toISOString().slice(0, 10)))
    && (!selectedCapability.validUntil || selectedCapability.validUntil >= (selectedOperation?.plannedStart || new Date().toISOString().slice(0, 10)));

  const visibleOperations = useMemo(() => operations.filter(op => {
    const po = orders.find(row => row.id === op.poId);
    const line = po?.lines.find(row => row.id === op.poLineId);
    const component = components.find(row => row.id === op.componentId);
    const vendor = vendors.find(row => row.id === op.vendorId);
    if (companyId && po?.companyId !== companyId) return false;
    if (factoryId && po?.factoryId !== factoryId) return false;
    if (poId && op.poId !== poId) return false;
    if (poLineId && op.poLineId !== poLineId) return false;
    const query = search.toLowerCase().trim();
    return !query || [po?.number, component?.partNumber, component?.name, op.name, op.machine, vendor?.company].join(" ").toLowerCase().includes(query);
  }).sort((a, b) => (a.plannedStart || "9999-99-99").localeCompare(b.plannedStart || "9999-99-99") || a.sequence - b.sequence), [operations, orders, components, vendors, companyId, factoryId, poId, poLineId, search]);

  const startSchedule = (op: OperationRecord) => {
    setSelectedOperationId(op.id);
    setScheduleDraft(scheduleOf(op));
  };
  const scheduleConflicts = (op: OperationRecord, draft: ScheduleDraft) => {
    if (!draft.machineResourceId || !draft.plannedStart || !draft.plannedEnd) return [];
    const candidate: OperationRecord = { ...op, plannedStart: draft.plannedStart, plannedEnd: draft.plannedEnd,
      plannedStartTime: draft.plannedStartTime, plannedEndTime: draft.plannedEndTime, machineResourceId: draft.machineResourceId };
    return operations.filter(other => other.id !== op.id && !other.deletedAt && other.machineResourceId === draft.machineResourceId && overlaps(candidate, other));
  };
  const conflicts = selectedOperation && scheduleDraft ? scheduleConflicts(selectedOperation, scheduleDraft) : [];
  const saveSchedule = () => {
    if (!selectedOperation || !scheduleDraft) return;
    const hours = Number(scheduleDraft.plannedHours);
    if (scheduleDraft.plannedStart && scheduleDraft.plannedEnd && scheduleDraft.plannedEnd < scheduleDraft.plannedStart) {
      onNotice("Planned end date cannot be before the planned start date."); return;
    }
    if ((scheduleDraft.plannedStart && !scheduleDraft.plannedEnd) || (!scheduleDraft.plannedStart && scheduleDraft.plannedEnd)) {
      onNotice("Enter both planned dates or leave both unscheduled."); return;
    }
    if (scheduleDraft.plannedHours.trim() && (!Number.isFinite(hours) || hours <= 0)) {
      onNotice("Planned machine hours must be greater than zero."); return;
    }
    const resource = resources.find(row => row.id === scheduleDraft.machineResourceId);
    if (resource && resource.factoryId !== selectedOrder?.factoryId) {
      onNotice("Select a machine resource belonging to the PO factory."); return;
    }
    if (selectedOperation.vendorId && scheduleDraft.machineResourceId) {
      onNotice("This operation is assigned to an outside vendor. Remove the internal machine assignment and review vendor capability instead."); return;
    }
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(op => op.id === selectedOperation.id ? {
      ...op, plannedStart: scheduleDraft.plannedStart, plannedEnd: scheduleDraft.plannedEnd,
      plannedStartTime: scheduleDraft.plannedStartTime, plannedEndTime: scheduleDraft.plannedEndTime,
      plannedHours: scheduleDraft.plannedHours.trim() ? hours : undefined,
      machineResourceId: scheduleDraft.machineResourceId || "",
      machine: resource ? resource.name : (scheduleDraft.machineResourceId ? op.machine : op.machine),
      updatedAt: stamp
    } : op) }));
    setScheduleDraft(null);
    onNotice(conflicts.length ? "Schedule saved. Machine overlap warning retained for planner review; no job was blocked." : "Schedule saved against the existing PO component operation. Production quantities and cost records were not changed.");
  };

  const openNewResource = () => {
    setEditingResourceId("");
    setResourceDraft(blankResource(factoryId || selectedPO?.factoryId || initialSelection?.factoryId || ""));
    setResourceFormOpen(true);
  };
  const editResource = (resource: MachineResourceRecord) => {
    setEditingResourceId(resource.id);
    setResourceDraft({
      factoryId: resource.factoryId, name: resource.name, machineType: resource.machineType, make: resource.make, model: resource.model,
      envelopeX: resource.envelopeX == null ? "" : String(resource.envelopeX),
      envelopeY: resource.envelopeY == null ? "" : String(resource.envelopeY),
      envelopeZ: resource.envelopeZ == null ? "" : String(resource.envelopeZ),
      capacityHoursPerShift: String(resource.capacityHoursPerShift), shiftsPerDay: String(resource.shiftsPerDay),
      workingDaysPerMonth: String(resource.workingDaysPerMonth), status: resource.status, notes: resource.notes || ""
    });
    setResourceFormOpen(true);
  };
  const saveResource = () => {
    const name = resourceDraft.name.trim();
    const hours = Number(resourceDraft.capacityHoursPerShift), shifts = Number(resourceDraft.shiftsPerDay), days = Number(resourceDraft.workingDaysPerMonth);
    if (!resourceDraft.factoryId || !name) { onNotice("Select a factory and enter the machine / work-centre name."); return; }
    if (![hours, shifts, days].every(value => Number.isFinite(value) && value > 0)) { onNotice("Enter positive shift hours, shifts per day and working days per month."); return; }
    const stamp = nowIso(), id = editingResourceId || makeId("machine");
    const row: MachineResourceRecord = {
      id, factoryId: resourceDraft.factoryId, name, machineType: resourceDraft.machineType.trim(), make: resourceDraft.make.trim(), model: resourceDraft.model.trim(),
      envelopeX: Number(resourceDraft.envelopeX) || 0, envelopeY: Number(resourceDraft.envelopeY) || 0, envelopeZ: Number(resourceDraft.envelopeZ) || 0,
      capacityHoursPerShift: hours, shiftsPerDay: shifts, workingDaysPerMonth: days, status: resourceDraft.status,
      notes: resourceDraft.notes.trim(), createdAt: resources.find(item => item.id === id)?.createdAt || stamp, updatedAt: stamp
    };
    update(current => ({ ...current, machineResources: [...current.machineResources.filter(item => item.id !== id), row] }));
    setResourceFormOpen(false); setEditingResourceId("");
    onNotice(editingResourceId ? "Machine resource updated. Existing operation links remain on the same resource ID." : "Machine resource added. It is available for manual assignment to internal operations at this factory.");
  };
  const setResourceStatus = (resource: MachineResourceRecord, status: MachineResourceRecord["status"]) => {
    const stamp = nowIso();
    update(current => ({ ...current, machineResources: current.machineResources.map(row => row.id === resource.id ? { ...row, status, updatedAt: stamp } : row) }));
  };

  const monthlyPlanHours = (resourceId: string) => operations.filter(op => op.machineResourceId === resourceId && !op.deletedAt && (op.plannedStart || "").slice(0, 7) === month)
    .reduce((sum, op) => sum + (Number(op.plannedHours) || 0), 0);
  const monthlyVendorRows = capabilities.filter(cap => !cap.deletedAt).map(cap => {
    const vendor = vendors.find(row => row.id === cap.vendorId);
    const process = data.processDefinitions.find(row => row.id === cap.processDefinitionId);
    const planned = operations.filter(op => op.vendorId === cap.vendorId && op.processDefinitionId === cap.processDefinitionId && !op.deletedAt && (op.plannedStart || "").slice(0, 7) === month)
      .reduce((sum, op) => sum + Math.max(0, op.quantity - op.completed), 0);
    const valid = cap.status === "Approved" && (!cap.validFrom || cap.validFrom <= month + "-31") && (!cap.validUntil || cap.validUntil >= month + "-01");
    return { cap, vendor, process, planned, valid };
  }).filter(row => row.planned > 0 || row.cap.status !== "Approved");

  const componentName = (id: string) => {
    const item = components.find(row => row.id === id);
    return item ? item.partNumber + " · " + item.name : "Component record missing";
  };
  const companyName = (id: string) => companies.find(row => row.id === id)?.name || "Company";
  const factoryName = (id: string) => factories.find(row => row.id === id)?.name || "Factory";
  const routeSelection = (op: OperationRecord): ProcessSelection | null => {
    const po = orders.find(row => row.id === op.poId);
    if (!po) return null;
    return { companyId: po.companyId, factoryId: po.factoryId, poId: po.id, poLineId: op.poLineId, operationId: op.id };
  };
  const locationBalance = (op: OperationRecord) => {
    const po = orders.find(row => row.id === op.poId);
    if (!po) return null;
    const locationType = op.vendorId ? "vendor" : "factory";
    const locationId = op.vendorId || po.factoryId;
    const transactions = data.inventoryTransactions.filter(row => row.itemType === "component" && row.itemId === op.componentId);
    const matching = transactions.filter(row => {
      const effectiveType = row.locationType || (row.factoryId ? "factory" : row.vendorId ? "vendor" : undefined);
      const effectiveId = row.locationId || (effectiveType === "vendor" ? row.vendorId : effectiveType === "factory" ? row.factoryId : "");
      return effectiveType === locationType && effectiveId === locationId;
    });
    return matching.length ? matching.reduce((sum, row) => sum + (row.direction === "in" ? row.quantity : -row.quantity), 0) : null;
  };
  const linkedWipReceipts = selectedOperation ? data.wipTransfers.filter(row => row.toOperationId === selectedOperation.id && !row.deletedAt && row.receivedQuantity > 0) : [];
  const recordedWipReceived = linkedWipReceipts.reduce((sum, row) => sum + row.receivedQuantity, 0);
  const recordedStock = selectedOperation ? locationBalance(selectedOperation) : null;
  const selectedOperationWarnings = selectedOperation ? [
    selectedOperation.vendorId && !selectedCapabilityCurrentlyValid ? "No current Approved vendor capability valid for the planned start date is recorded for this vendor/process pair." : "",
    selectedOrderLine?.targetDelivery && selectedOperation.plannedEnd && selectedOperation.plannedEnd > selectedOrderLine.targetDelivery ? "Operation target is later than the PO component delivery commitment." : "",
    selectedOperation.machineResourceId && resources.find(row => row.id === selectedOperation.machineResourceId)?.status !== "Available" ? "Assigned machine is not marked Available." : ""
  ].filter(Boolean) : [];

  const resourceRows = resources.filter(row => (!factoryId || row.factoryId === factoryId) && (!companyId || factories.find(factory => factory.id === row.factoryId)?.companyId === companyId));
  const activeResources = resourceRows.filter(row => row.status !== "Inactive");
  const monthLabel = new Date(month + "-01T12:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return <section className="workspace-page production-planning-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED DATA CONNECTED" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL / SERVER SYNC CONFIGURATION"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / FINITE CAPACITY</div><h1>Production Planning<span>.</span></h1><p>Schedule only saved PO component operations. Machine and vendor capacity warnings are evidence-led; no route, quantity or delivery promise is generated automatically.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("process-map")}><ClipboardList size={15}/> Process Map</button><button className="button-primary" onClick={openNewResource}><Plus size={15}/> Add machine resource</button></div></div>

    <div className="production-summary-grid">
      <div className="surface-panel production-summary"><small>SAVED OPERATIONS</small><strong>{number(operations.length)}</strong><span>PO-line scoped records</span></div>
      <div className="surface-panel production-summary"><small>INTERNAL RESOURCES</small><strong>{number(activeResources.length)}</strong><span>Machine / work-centre master</span></div>
      <div className="surface-panel production-summary"><small>OUTSIDE OPERATIONS</small><strong>{number(operations.filter(op => !!op.vendorId).length)}</strong><span>Vendor-assigned saved operations</span></div>
      <div className="surface-panel production-summary"><small>UNSCHEDULED</small><strong>{number(operations.filter(op => !op.plannedStart || !op.plannedEnd).length)}</strong><span>Dates not entered</span></div>
    </div>

    <nav className="production-tabs">
      <button className={tab === "schedule" ? "production-tab-active" : ""} onClick={() => setTab("schedule")}><CalendarClock size={15}/> Operation schedule</button>
      <button className={tab === "capacity" ? "production-tab-active" : ""} onClick={() => setTab("capacity")}><Gauge size={15}/> Capacity review</button>
      <button className={tab === "resources" ? "production-tab-active" : ""} onClick={() => setTab("resources")}><MonitorCog size={15}/> Machine resources ({resources.length})</button>
    </nav>

    <div className="production-filter-bar">
      <SearchablePicker id="production-company" label="Company" value={companyId} placeholder="All companies" options={companies.map(row => ({ id: row.id, label: row.name }))} onChange={id => { setCompanyId(id); setFactoryId(""); setPoId(""); setPoLineId(""); }}/>
      <SearchablePicker id="production-factory" label="Factory" value={factoryId} placeholder="All factories" options={companyFactories.map(row => ({ id: row.id, label: row.name }))} onChange={id => { setFactoryId(id); setPoId(""); setPoLineId(""); }}/>
      <SearchablePicker id="production-po" label="Purchase order" value={poId} placeholder="All purchase orders" options={companyOrders.map(row => ({ id: row.id, label: row.number }))} onChange={id => { setPoId(id); setPoLineId(""); }}/>
      <label>Planning month<input type="month" value={month} onChange={event => setMonth(event.target.value)}/></label>
    </div>

    {tab === "schedule" && <>
      <div className="production-toolbar"><label className="linked-search"><span>⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search PO, component, operation, vendor…"/></label><span>{visibleOperations.length} saved operation(s)</span></div>
      <section className="surface-panel production-operation-table">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PRODUCTION / OPERATION REGISTER</div><h3>Schedule board</h3><p>Each row points to one operation on a specific customer PO component line.</p></div><span className="module-number">{visibleOperations.length} OPS</span></div>
        {visibleOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Customer / PO</th><th>Component</th><th>Operation</th><th>Machine / vendor</th><th>Planned dates</th><th>Hours</th><th>Progress</th><th>Status</th><th>Plan</th></tr></thead><tbody>{visibleOperations.map(op => {
          const po = orders.find(row => row.id === op.poId), line = po?.lines.find(row => row.id === op.poLineId);
          const resource = resources.find(row => row.id === op.machineResourceId);
          const vendor = vendors.find(row => row.id === op.vendorId);
          const overlapCount = op.machineResourceId ? operations.filter(other => other.id !== op.id && !other.deletedAt && other.machineResourceId === op.machineResourceId && overlaps(op, other)).length : 0;
          return <tr key={op.id} className={selectedOperationId === op.id ? "linked-table-selected" : ""} onClick={() => startSchedule(op)}>
            <td><strong>{po?.number || "PO not found"}</strong><small>{companyName(po?.companyId || "")} · {factoryName(po?.factoryId || "")}</small></td>
            <td>{componentName(op.componentId)}<small>Line qty: {number(line?.quantity || op.quantity)} pcs · Due {dateLabel(line?.targetDelivery || po?.targetDelivery)}</small></td>
            <td><strong>{op.name}</strong><small>OP-{String(op.sequence).padStart(3, "0")} · {op.category || "Type not set"}</small></td>
            <td>{vendor ? <><strong>{vendor.company}</strong><small>Outside process</small></> : <><strong>{resource?.name || op.machine || "Not assigned"}</strong><small>{resource ? resource.machineType || "Internal resource" : "Machine not linked"}</small></>}</td>
            <td>{dateLabel(op.plannedStart)}<small>to {dateLabel(op.plannedEnd)}</small></td>
            <td>{op.plannedHours ? number(op.plannedHours) + " h" : "Not entered"}</td>
            <td>{number(op.completed)} / {number(op.quantity)}<small>{number(op.accepted)} accepted · {number(op.rejected)} rejected</small></td>
            <td><span className={statusClass(op.status)}>{op.status}</span>{overlapCount > 0 && <small className="production-warning-text">Overlap review ({overlapCount})</small>}</td>
            <td><button className="inline-module-link" onClick={event => { event.stopPropagation(); startSchedule(op); }}>Schedule / view</button></td>
          </tr>;
        })}</tbody></table></div> : <div className="module-empty-state"><Activity size={28}/><h3>No saved operation records in this selection</h3><p>Create a real company, factory, purchase order, component line and its actual process operations first. Production planning will not create example routes.</p><button className="button-primary" onClick={() => onSelectModule("process-map")}>Open Process Map</button></div>}
      </section>

      {selectedOperation && scheduleDraft && <section className="surface-panel production-editor">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SCHEDULE / EDIT SELECTED RECORD</div><h3>{selectedOperation.name}</h3><p>{selectedOrder?.number || "PO"} · {componentName(selectedOperation.componentId)} · Operation ID {selectedOperation.id}</p></div><button className="icon-control" onClick={() => setScheduleDraft(null)} aria-label="Close schedule editor"><X size={14}/></button></div>
        <div className="production-editor-grid">
          <label>Planned start date<input type="date" value={scheduleDraft.plannedStart} onChange={event => setScheduleDraft({ ...scheduleDraft, plannedStart: event.target.value })}/></label>
          <label>Planned end date<input type="date" min={scheduleDraft.plannedStart || undefined} value={scheduleDraft.plannedEnd} onChange={event => setScheduleDraft({ ...scheduleDraft, plannedEnd: event.target.value })}/></label>
          <label>Start time<input type="time" value={scheduleDraft.plannedStartTime} onChange={event => setScheduleDraft({ ...scheduleDraft, plannedStartTime: event.target.value })}/></label>
          <label>End time<input type="time" value={scheduleDraft.plannedEndTime} onChange={event => setScheduleDraft({ ...scheduleDraft, plannedEndTime: event.target.value })}/></label>
          <label>Planned machine hours (manual)<input type="number" min="0" step="0.25" value={scheduleDraft.plannedHours} onChange={event => setScheduleDraft({ ...scheduleDraft, plannedHours: event.target.value })} placeholder="Enter actual estimate"/></label>
          {!selectedOperation.vendorId ? <SearchablePicker id="production-machine-assignment" label="Internal machine / work centre (optional)" value={scheduleDraft.machineResourceId} placeholder="No machine assigned" options={resources.filter(row => row.factoryId === selectedOrder?.factoryId && row.status !== "Inactive").map(row => ({ id: row.id, label: row.name + " · " + row.status }))} onChange={id => setScheduleDraft({ ...scheduleDraft, machineResourceId: id })}/> : <div className="production-outsource-note"><Truck size={16}/><span><strong>Outside process</strong><small>{selectedVendor?.company || "Vendor not found"} · machine capacity is reviewed from Vendor Capability Master.</small></span></div>}
        </div>
        {conflicts.length > 0 && <div className="production-warning-box"><AlertTriangle size={16}/><div><strong>Potential machine schedule overlap</strong><small>{conflicts.map(op => op.name + " (" + (orders.find(po => po.id === op.poId)?.number || "PO") + ", " + dateLabel(op.plannedStart) + ")").join(" · ")}. Resolve or retain with a documented planning decision. This is a warning, not a hard block.</small></div></div>}
        {selectedOperation.vendorId && <div className="production-capability-note"><strong>Vendor capability status: {selectedCapability?.status || "No capability record"}</strong><span>{selectedCapability ? "Recorded monthly capacity: " + number(selectedCapability.capacityPerMonth) + " pcs · Valid " + (selectedCapability.validFrom || "date not set") + " to " + (selectedCapability.validUntil || "date not set") : "No vendor/process capacity is assumed. Open Vendor Capability Master to record verified capacity."}</span><button className="button-quiet compact-button" onClick={() => onSelectModule("vendor-capability")}>Open vendor capability</button></div>}
        <div className="production-editor-actions"><button className="button-primary" onClick={saveSchedule}><Check size={14}/> Save schedule</button><button className="button-quiet" onClick={() => { const selection = routeSelection(selectedOperation); if (selection) onOpenOperation(selection); }}>Open exact operation in Process Map</button><button className="button-quiet" onClick={() => { const selection = routeSelection(selectedOperation); if (selection) onOpenWipTransfer(selection); }}>WIP handover</button></div>
        <div className="production-linked-facts">
          <div><small>PO COMPONENT DELIVERY</small><strong>{dateLabel(selectedOrderLine?.targetDelivery || selectedOrder?.targetDelivery)}</strong></div>
          <div><small>RECORDED INBOUND WIP</small><strong>{number(recordedWipReceived)} pcs</strong><span>{linkedWipReceipts.length} linked receipt(s); no receipt is inferred.</span></div>
          <div><small>LOCATION STOCK LEDGER</small><strong>{recordedStock == null ? "No location balance" : number(recordedStock) + " pcs"}</strong><span>Posted component stock at this operation's factory / vendor location.</span></div>
          <div><small>PRODUCTION / QUALITY</small><strong>{number(selectedOperation.completed)} completed · {number(selectedOperation.accepted)} accepted</strong><span>Schedule edits do not change completed, accepted or rejected quantities.</span></div>
        </div>
        {selectedOperationWarnings.length > 0 && <div className="production-warning-box"><AlertTriangle size={16}/><div><strong>Planning review required</strong><small>{selectedOperationWarnings.join(" ")}</small></div></div>}
      </section>}
    </>}

    {tab === "capacity" && <div className="production-capacity-grid">
      <section className="surface-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> INTERNAL / MACHINE HOURS</div><h3>{monthLabel} machine loading</h3><p>Only manually entered planned hours are counted. Monthly capacity is calculated from each resource's declared shift pattern.</p></div><Gauge size={18}/></div>
        {resourceRows.length ? resourceRows.map(resource => {
          const used = monthlyPlanHours(resource.id), capacity = resource.capacityHoursPerShift * resource.shiftsPerDay * resource.workingDaysPerMonth;
          const pct = capacity > 0 ? used / capacity * 100 : 0;
          return <div className="production-capacity-row" key={resource.id}><div><strong>{resource.name}</strong><small>{factoryName(resource.factoryId)} · {resource.machineType || "Machine / station"} · {resource.status}</small></div><strong>{number(used)} / {number(capacity)} h</strong><div className="production-capacity-track"><i style={{ width: Math.min(100, Math.max(0, pct)) + "%" }}/></div><small>{number(pct)}% planned utilisation{pct > 100 ? " · exceeds declared monthly hours" : ""}</small></div>;
        }) : <div className="module-empty-state"><MonitorCog size={24}/><p>No machine resources have been recorded. Add a real machine master before capacity is calculated.</p></div>}
      </section>
      <section className="surface-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> OUTSIDE / VENDOR CAPACITY</div><h3>Vendor process loading</h3><p>Compared with recorded capability capacity for the same vendor and process definition. Other vendor commitments are not visible here.</p></div><Truck size={18}/></div>
        {monthlyVendorRows.length ? monthlyVendorRows.map(row => <div className="production-capacity-row" key={row.cap.id}><div><strong>{row.vendor?.company || "Vendor record missing"} · {row.process?.name || "Process definition missing"}</strong><small>{row.cap.status} · {row.cap.machineModel || "Machine model not entered"}</small></div><strong>{number(row.planned)} / {number(row.cap.capacityPerMonth)} pcs</strong><div className="production-capacity-track"><i style={{ width: (row.cap.capacityPerMonth > 0 ? Math.min(100, row.planned / row.cap.capacityPerMonth * 100) : row.planned > 0 ? 100 : 0) + "%" }}/></div><small>{!row.valid ? "Not currently Approved / outside validity · review required" : row.planned > row.cap.capacityPerMonth ? "Recorded capacity exceeded by AXIMACH planned load" : "Within recorded capability capacity; other vendor commitments unknown"}</small></div>) : <div className="module-empty-state"><Truck size={24}/><p>No vendor capability capacity records are available for the selected month. No outside capacity is assumed.</p><button className="button-quiet" onClick={() => onSelectModule("vendor-capability")}>Open Vendor Capability Master</button></div>}
      </section>
    </div>}

    {tab === "resources" && <section className="surface-panel production-resource-register">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> RESOURCE MASTER / FACTORY EQUIPMENT</div><h3>Machine & work-centre resources</h3><p>Resources are factory-scoped. Enter actual capacity and working envelope; no sample machines are preloaded.</p></div><button className="button-primary" onClick={openNewResource}><Plus size={14}/> Add resource</button></div>
      {resourceFormOpen && <div className="production-resource-form">
        <label>Factory *<SearchablePicker id="resource-factory" label="" value={resourceDraft.factoryId} placeholder="Select factory…" options={factories.filter(row => !companyId || row.companyId === companyId).map(row => ({ id: row.id, label: factoryName(row.id) + " · " + companyName(row.companyId) }))} onChange={id => setResourceDraft({ ...resourceDraft, factoryId: id })}/></label>
        <label>Machine / work-centre name *<input value={resourceDraft.name} onChange={event => setResourceDraft({ ...resourceDraft, name: event.target.value })} placeholder="Enter actual machine or station"/></label>
        <label>Machine type<input value={resourceDraft.machineType} onChange={event => setResourceDraft({ ...resourceDraft, machineType: event.target.value })} placeholder="CNC turning, VMC, grinder…"/></label>
        <label>Make<input value={resourceDraft.make} onChange={event => setResourceDraft({ ...resourceDraft, make: event.target.value })}/></label>
        <label>Model<input value={resourceDraft.model} onChange={event => setResourceDraft({ ...resourceDraft, model: event.target.value })}/></label>
        <label>X travel / envelope (mm)<input type="number" min="0" value={resourceDraft.envelopeX} onChange={event => setResourceDraft({ ...resourceDraft, envelopeX: event.target.value })}/></label>
        <label>Y travel / envelope (mm)<input type="number" min="0" value={resourceDraft.envelopeY} onChange={event => setResourceDraft({ ...resourceDraft, envelopeY: event.target.value })}/></label>
        <label>Z travel / envelope (mm)<input type="number" min="0" value={resourceDraft.envelopeZ} onChange={event => setResourceDraft({ ...resourceDraft, envelopeZ: event.target.value })}/></label>
        <label>Hours per shift *<input type="number" min="0.25" step="0.25" value={resourceDraft.capacityHoursPerShift} onChange={event => setResourceDraft({ ...resourceDraft, capacityHoursPerShift: event.target.value })}/></label>
        <label>Shifts per day *<input type="number" min="1" step="1" value={resourceDraft.shiftsPerDay} onChange={event => setResourceDraft({ ...resourceDraft, shiftsPerDay: event.target.value })}/></label>
        <label>Working days / month *<input type="number" min="1" max="31" step="1" value={resourceDraft.workingDaysPerMonth} onChange={event => setResourceDraft({ ...resourceDraft, workingDaysPerMonth: event.target.value })}/></label>
        <label>Availability<select value={resourceDraft.status} onChange={event => setResourceDraft({ ...resourceDraft, status: event.target.value as ResourceDraft["status"] })}><option>Available</option><option>Maintenance</option><option>Inactive</option></select></label>
        <label className="production-resource-notes">Notes<input value={resourceDraft.notes} onChange={event => setResourceDraft({ ...resourceDraft, notes: event.target.value })} placeholder="Setup, restrictions, maintenance notes…"/></label>
        <div className="production-editor-actions"><button className="button-primary" onClick={saveResource}><Check size={14}/> {editingResourceId ? "Save resource" : "Create resource"}</button><button className="button-quiet" onClick={() => { setResourceFormOpen(false); setEditingResourceId(""); }}>Cancel</button></div>
      </div>}
      {resourceRows.length ? <div className="production-resource-grid">{resourceRows.map(resource => {
        const assigned = operations.filter(op => op.machineResourceId === resource.id && !op.deletedAt).length;
        const capacity = resource.capacityHoursPerShift * resource.shiftsPerDay * resource.workingDaysPerMonth;
        return <article className="production-resource-card" key={resource.id}><div className="production-resource-card-top"><MonitorCog size={20}/><span className={statusClass(resource.status)}>{resource.status}</span></div><h3>{resource.name}</h3><p>{resource.machineType || "Machine type not entered"} · {resource.make} {resource.model}</p><div className="production-resource-specs"><span>Envelope <b>{[resource.envelopeX, resource.envelopeY, resource.envelopeZ].some(Boolean) ? [resource.envelopeX, resource.envelopeY, resource.envelopeZ].map(value => number(value)).join(" × ") + " mm" : "Not entered"}</b></span><span>Capacity <b>{number(capacity)} h / month</b></span><span>Linked operations <b>{assigned}</b></span></div><div className="production-resource-actions"><button className="button-quiet compact-button" onClick={() => editResource(resource)}><Wrench size={13}/> Edit</button><select value={resource.status} onChange={event => setResourceStatus(resource, event.target.value as MachineResourceRecord["status"])}><option>Available</option><option>Maintenance</option><option>Inactive</option></select></div></article>;
      })}</div> : <div className="module-empty-state"><MonitorCog size={28}/><h3>No machine resources entered</h3><p>Add machines and stations for each factory. No factory assets are assumed or seeded.</p></div>}
    </section>}

    <div className="module-safety-note"><ShieldCheck size={15}/><span>Capacity is a planning reference, not a machine telemetry feed or confirmed vendor reservation. Schedule overlap and vendor-capacity exceptions are warnings. No operation route, production quantity, quality result, rate, stock movement or customer delivery promise is modified by this workspace.</span></div>
  </section>;
}
