import { useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUp, Boxes, CalendarClock, Check, CircleDollarSign, ClipboardCheck, FileText, GitBranch, Package, Plus, Search, ShieldAlert, ShieldCheck, Truck, Users, Workflow, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type LifecycleStatus, type OperationRecord, type PurchaseOrderLine } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type DraftOperation = Pick<OperationRecord, "name" | "category" | "machine" | "machineResourceId" | "vendorId" | "status" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd" | "transportVendorId" | "quantity" | "completed" | "accepted" | "rejected" | "setupHours" | "cycleTimeSeconds" | "ratePerPart" | "actualRatePerPart" | "vendorPaymentStatus" | "inspectionResult" | "transportCost" | "transportPickup" | "transportDelivery" | "qualityNotes" | "notes" | "branch">;
const blankOperation = (line?: PurchaseOrderLine): DraftOperation => ({
  name: "", category: "", machine: "", machineResourceId: "", vendorId: "", status: "Queued", plannedStart: "", plannedEnd: line?.targetDelivery || "", actualStart: "", actualEnd: "",
  quantity: line?.quantity || 0, completed: 0, accepted: 0, rejected: 0, setupHours: 0, cycleTimeSeconds: 0, ratePerPart: 0, actualRatePerPart: 0, vendorPaymentStatus: "Not Paid",
  transportVendorId: "", transportCost: 0, transportPickup: "", transportDelivery: "", qualityNotes: "", inspectionResult: "", notes: "", branch: "Main route"
});
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const shortDate = (value?: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";
const daysBetween = (start?: string, end?: string) => start && end ? Math.max(1, Math.round((new Date(end + "T12:00:00").getTime() - new Date(start + "T12:00:00").getTime()) / 86400000) + 1) : 0;

export default function LinkedProcessWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
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

  const [companyId, setCompanyId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [poId, setPoId] = useState("");
  const [poLineId, setPoLineId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<DraftOperation>(() => blankOperation());
  const [processTypeId, setProcessTypeId] = useState("");

  const companyFactories = factories.filter(f => f.companyId === companyId);
  // Factory remains an internal legacy relationship only; users select POs directly by Company.
  const companyOrders = purchaseOrders.filter(p => p.companyId === companyId);
  const selectedPO = purchaseOrders.find(p => p.id === poId);
  const poLines = selectedPO ? selectedPO.lines.filter(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt)) : [];
  const selectedLine = poLines.find(line => line.id === poLineId);
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const routeOperations = operations.filter(op => op.poLineId === poLineId && op.poId === poId && op.componentId === selectedLine?.componentId).sort((a,b) => a.sequence - b.sequence);
  const visibleOperations = routeOperations.filter(op => (op.name + " " + op.category + " " + op.machine + " " + (machineResources.find(m=>m.id===op.machineResourceId)?.name || "") + " " + (vendors.find(v => v.id === op.vendorId)?.company || "") + " " + op.status + " " + (op.branch || "Main route")).toLowerCase().includes(search.toLowerCase().trim()));
  const visibleBranches = [...new Set(visibleOperations.map(op => op.branch || "Main route"))];
  const activeOperation = routeOperations.find(op => op.id === selectedOperationId) || routeOperations[0];
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
    const nextFactory = nextPO?.factoryId || "";
    setFactoryId(nextFactory);
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
    setProcessTypeId("");
    if (transport) { base.name = "Transport / handover"; base.category = "Logistics"; base.branch = "Main route"; }
    if (branch && activeOperation) { base.branch = "Alternate / rework"; base.name = "Alternate / rework operation"; }
    setDraft(base);
    setEditingId("");
    setShowEditor(true);
  };
  const editActive = () => {
    if (!activeOperation) return;
    setProcessTypeId(activeOperation.processTypeId || "");
    setDraft({
      name: activeOperation.name, category: activeOperation.category, machine: activeOperation.machine, machineResourceId: activeOperation.machineResourceId || "", vendorId: activeOperation.vendorId,
      status: activeOperation.status, plannedStart: activeOperation.plannedStart, plannedEnd: activeOperation.plannedEnd, actualStart: activeOperation.actualStart || "", actualEnd: activeOperation.actualEnd || "",
      quantity: activeOperation.quantity, completed: activeOperation.completed, accepted: activeOperation.accepted, rejected: activeOperation.rejected, setupHours: activeOperation.setupHours || 0, cycleTimeSeconds: activeOperation.cycleTimeSeconds || 0,
      ratePerPart: activeOperation.ratePerPart, actualRatePerPart: activeOperation.actualRatePerPart || 0, vendorPaymentStatus: activeOperation.vendorPaymentStatus || "Not Paid", transportVendorId: activeOperation.transportVendorId || "", transportCost: activeOperation.transportCost, transportPickup: activeOperation.transportPickup,
      transportDelivery: activeOperation.transportDelivery, qualityNotes: activeOperation.qualityNotes, inspectionResult: activeOperation.inspectionResult || "", notes: activeOperation.notes, branch: activeOperation.branch
    });
    setEditingId(activeOperation.id); setShowEditor(true);
  };
  const saveOperation = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line first."); return; }
    if (!draft.name.trim()) { onNotice("Select a process type from Process Directory."); return; }
    if (!editingId && !processTypeId) { onNotice("Select a process type from Process Directory."); return; }
    if (processTypeId && !processTypes.some(item => item.id === processTypeId)) { onNotice("The selected process type is no longer active in Process Directory."); return; }
    if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) { onNotice("Target/end date cannot be before planned start date."); return; }
    if (draft.accepted + draft.rejected > draft.completed) { onNotice("Accepted plus rejected quantity cannot exceed completed quantity."); return; }
    if ((draft.setupHours || 0) < 0 || (draft.cycleTimeSeconds || 0) < 0) { onNotice("Setup hours and cycle time cannot be negative."); return; }
    const stamp = nowIso();
    const operationId = editingId || makeId("operation");
    update(current => {
      const currentRoute = current.operations.filter(op => op.poLineId === selectedLine.id && op.poId === selectedPO.id && op.componentId === selectedComponent.id && !op.deletedAt);
      const old = current.operations.find(op => op.id === operationId);
      const next: OperationRecord = {
        id: operationId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id,
        sequence: old?.sequence ?? (Math.max(0, ...currentRoute.map(op => op.sequence)) + 10),
        ...draft, processTypeId: processTypeId || old?.processTypeId, vendorId: draft.vendorId || "", actualRatePerPart: draft.actualRatePerPart || 0, transportVendorId: draft.transportVendorId || "",
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
        <button className="route-kpi kpi-cost" onClick={() => onSelectModule("costing")}><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>ENTERED PROCESS + TRANSPORT COST</small><strong>{money(routeCost)}</strong><em>Rates from this component route only</em></span></button>
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
    <div className="linked-process-layout">
      <section className="surface-panel linked-route-canvas">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / LIVE RECORDS</div><h3>{selectedLine ? (selectedComponent?.partNumber || "Component") + " · Route graph" : "Route graph"}</h3><p>{routeOperations.length} saved operations · branches and rework remain attached to this PO line</p></div><span className="module-number">{routeOperations.length} OPS</span></div>
        {showEditor && <section className="route-editor-panel linked-operation-editor"><div className="route-editor-heading"><div><strong><Plus size={15}/> {editingId ? "Edit operation" : "Add operation"}</strong><small>All saved changes are linked to this selected PO line and component.</small></div><button className="icon-control" onClick={() => setShowEditor(false)} aria-label="Close editor"><X size={14}/></button></div>
          <div className="route-editor-form">
            <label>Process type {editingId ? "(legacy name retained if unlinked)" : "*"}<select value={processTypeId} onChange={e=>{const selected=processTypes.find(item=>item.id===e.target.value);const category=processCategories.find(item=>item.id===selected?.categoryId);setProcessTypeId(e.target.value);if(selected)setDraft(current=>({...current,name:selected.name,category:category?.name||current.category}));}}>
              <option value="">{editingId ? "Keep legacy process name" : "Select from Process Directory…"}</option>
              {processCategories.map(category=><optgroup key={category.id} label={category.name}>{processTypes.filter(item=>item.categoryId===category.id).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}
            </select></label>
            {!processTypes.length && <small className="field-hint">Create process categories and types in Process Directory first.</small>}
            <label>Machine / station (text)<input value={draft.machine} onChange={e => setDraft({...draft,machine:e.target.value})} placeholder="Machine / work centre"/></label>
            <label>Linked machine resource<select value={draft.machineResourceId || ""} onChange={e => { const resource=machineResources.find(m=>m.id===e.target.value); setDraft({...draft,machineResourceId:e.target.value,machine:resource?resource.code+" · "+resource.name:draft.machine}); }}><option value="">Not linked to a registered machine</option>{machineResources.filter(m=>!selectedPO || m.factoryId===selectedPO.factoryId).map(m=><option key={m.id} value={m.id}>{m.code} · {m.name}</option>)}</select></label>{!machineResources.length&&<small className="field-hint">Register machine resources in Maintenance & Downtime to link operations to machine capacity.</small>}
            <SearchablePicker id="operation-vendor-picker" label="Vendor" value={draft.vendorId} placeholder="Type vendor name or phone…" options={vendors.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")+(v.status.toLowerCase().includes("unverified")?" · Unverified":"")}))} onChange={vendorId=>setDraft({...draft,vendorId})}/>{!vendors.length && <small className="field-hint">Scan/import contacts or add a vendor in Vendors first.</small>}
            <label>Vendor payment status<select value={draft.vendorPaymentStatus || "Not Paid"} onChange={e=>setDraft({...draft,vendorPaymentStatus:e.target.value as "Paid" | "Not Paid"})}><option value="Not Paid">Not Paid</option><option value="Paid">Paid</option></select></label>
            <label>Planned start<input type="date" value={draft.plannedStart} onChange={e => setDraft({...draft,plannedStart:e.target.value})}/></label>
            <label>Planned target/end<input type="date" min={draft.plannedStart || undefined} value={draft.plannedEnd} onChange={e => setDraft({...draft,plannedEnd:e.target.value})}/></label>
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
              return <div className="linked-node-wrap" key={op.id}><button className={"linked-operation-node status-" + op.status.toLowerCase().replaceAll(" ","-") + (alternate ? " linked-node-alternate" : "") + (selected ? " linked-node-selected" : "")} onClick={() => {setSelectedOperationId(op.id);setShowEditor(false);}}><span className="linked-node-icon">{op.name.toLowerCase().includes("transport") || op.name.toLowerCase().includes("dispatch") ? <Truck size={19}/> : op.name.toLowerCase().includes("inspect") || op.name.toLowerCase().includes("quality") ? <ClipboardCheck size={19}/> : op.name.toLowerCase().includes("grind") ? <Wrench size={19}/> : <Workflow size={19}/>}</span><strong>{op.name}</strong><small>OP-{String(op.sequence).padStart(3,"0")}</small><span>{op.status}</span><small>{vendor?.company || "Vendor unassigned"}</small><small>{daysBetween(op.plannedStart,op.plannedEnd) || "—"} day(s)</small></button>{index < laneOperations.length - 1 && <span className="linked-node-arrow"><ArrowRight size={18}/></span>}</div>;
            })}</div>
          </section>;
        })}{!visibleOperations.length && <div className="module-empty-state">No operations match this search.</div>}</div></div> : <div className="module-empty-state linked-no-operations"><Workflow size={28}/><h3>No operations saved for this component</h3><p>Add only the operations this part actually requires. There is no fixed stage limit and no sample CNC or heat-treatment data.</p><button className="button-primary" disabled={!selectedLine} onClick={() => startAdd()}><Plus size={14}/> Add first operation</button></div>}
        <div className="route-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="route-scroll-note">Select any operation to inspect its schedule, vendor, quality and cost.</span></div>
      </section>
      <aside className="surface-panel linked-operation-side">
        {activeOperation ? <><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SELECTED OPERATION</div><h3>{activeOperation.name}</h3><p>{activeOperation.category || "Process type not specified"} · OP-{String(activeOperation.sequence).padStart(3,"0")}</p></div><button className="icon-control" aria-label="Edit selected operation" onClick={editActive}><Wrench size={14}/></button></div>
          <div className="linked-detail-grid"><div><small>APPROVED MACHINE SLOT</small><strong>{activeOperation.plannedSlotStartAt ? new Date(activeOperation.plannedSlotStartAt).toLocaleString("en-IN")+" – "+new Date(activeOperation.plannedSlotEndAt || activeOperation.plannedSlotStartAt).toLocaleString("en-IN") : "Not scheduled into a machine shift"}</strong><span>Generated by Production Capacity planner; review before release</span></div><div><small>VENDOR</small><strong>{selectedVendor?.company || "Not assigned"}</strong><span>{selectedVendor?.phone || "No vendor number linked"}</span></div><div><small>VENDOR PAYMENT</small><strong>{selectedVendor ? (activeOperation.vendorPaymentStatus || "Not Paid") : "—"}</strong><span>Updated in Process Map · source of truth for Costing</span></div><div><small>MACHINE / STATION</small><strong>{activeOperation.machine || "Not entered"}</strong></div><div><small>PLANNED SCHEDULE</small><strong>{shortDate(activeOperation.plannedStart)} – {shortDate(activeOperation.plannedEnd)}</strong><span>{daysBetween(activeOperation.plannedStart,activeOperation.plannedEnd) || "—"} calendar day(s)</span></div><div><small>ACTUAL SCHEDULE</small><strong>{shortDate(activeOperation.actualStart)} – {shortDate(activeOperation.actualEnd)}</strong></div><div><small>QUANTITY</small><strong>{activeOperation.quantity.toLocaleString("en-IN")} pcs</strong><span>{activeOperation.completed.toLocaleString("en-IN")} completed</span></div><div><small>ACCEPTED / REJECTED</small><strong>{activeOperation.accepted.toLocaleString("en-IN")} / {activeOperation.rejected.toLocaleString("en-IN")}</strong></div><div><small>QUOTED / PLANNED RATE</small><strong>{money(activeOperation.ratePerPart)}</strong></div><div><small>ACTUAL RATE / PART</small><strong>{activeOperation.actualRatePerPart ? money(activeOperation.actualRatePerPart) : "Not entered"}</strong></div><div><small>PROCESS + TRANSPORT COST</small><strong>{money(activeOperation.quantity * activeOperation.ratePerPart + activeOperation.transportCost)}</strong></div><div><small>TRANSPORT</small><strong>{vendors.find(v=>v.id===activeOperation.transportVendorId)?.company || "No transporter assigned"}</strong><span>{activeOperation.transportPickup || activeOperation.transportDelivery ? shortDate(activeOperation.transportPickup) + " → " + shortDate(activeOperation.transportDelivery) : "Not scheduled"} · {money(activeOperation.transportCost)}</span></div><div><small>STATUS</small><strong>{activeOperation.status}</strong></div><div className="linked-detail-wide"><small>QUALITY / INSPECTION REQUIREMENT</small><strong>{activeOperation.qualityNotes || "No quality notes recorded"}</strong></div><div className="linked-detail-wide"><small>INSPECTION RESULT</small><strong>{activeOperation.inspectionResult || "Not entered"}</strong></div><div className="linked-detail-wide"><small>NOTES</small><strong>{activeOperation.notes || "No operation notes entered"}</strong></div></div>
          <div className="linked-side-actions"><button className="button-primary" onClick={editActive}><Wrench size={14}/> Edit operation</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)<=0} onClick={()=>moveOperation(activeOperation.id,-1)}><ArrowUp size={14}/> Move earlier</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)>=routeOperations.length-1} onClick={()=>moveOperation(activeOperation.id,1)}><ArrowDown size={14}/> Move later</button><button className="button-quiet" disabled={activeOperation.status !== "Queued" || activeOperation.completed > 0 || activeOperation.accepted > 0 || activeOperation.rejected > 0 || Boolean(activeOperation.actualStart) || Boolean(activeOperation.plannedSlotStartAt) || activeOperation.quantity < 2} onClick={() => splitOperationIntoBatches(activeOperation)}><Boxes size={14}/> Split into batches</button><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Quotes / costing</button><button className="button-quiet" onClick={() => archiveOperation(activeOperation)}><X size={14}/> Archive</button></div>
          <div className="linked-quote-preview"><div className="panel-heading"><div><h3>Vendor quotations</h3><p>{selectedOperationQuotations.length} quote(s) linked to this operation</p></div></div>{selectedOperationQuotations.length ? selectedOperationQuotations.map(q => <div key={q.id} className="linked-quote-mini"><strong>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</strong><span>{money(q.ratePerPart)}/part · {q.leadDays} lead day(s)</span><small>{q.quoteReference || "No quote reference"} · {q.status}</small></div>) : <div className="vendor-empty">No quotations recorded for this operation yet. Add a quote from Costing.</div>}</div>
        </> : <div className="module-empty-state"><Workflow size={28}/><h3>Select an operation</h3><p>Operation details, schedule, vendor link, quantities, quality and cost will appear here.</p></div>}
      </aside>
    </div>
    <div className="linked-bottom-grid">
      <section className="surface-panel linked-cost-card"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COST BREAKDOWN</div><h3>Entered route costs</h3><p>Only rates you entered or selected from quotations are counted.</p></div><CircleDollarSign size={18}/></div><div className="linked-cost-row"><span>Process cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.quantity*op.ratePerPart,0))}</strong></div><div className="linked-cost-row"><span>Transport cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.transportCost,0))}</strong></div><div className="linked-cost-row linked-cost-total"><span>Total entered</span><strong>{money(totalProcessCost)}</strong></div><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Open detailed costing</button></section>
      <section className="surface-panel linked-timeline-card" id="linked-timeline"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> TIMELINE & DELIVERY</div><h3>Planned progress</h3><p>Schedule is based on saved operation dates, not estimated samples.</p></div><CalendarClock size={18}/></div><div className="linked-timeline-facts"><div><small>FIRST PLANNED START</small><strong>{shortDate(timelineStart)}</strong></div><div><small>LAST OPERATION TARGET</small><strong>{shortDate(timelineEnd)}</strong></div><div><small>SUM OF OPERATION DAYS</small><strong>{durationDays || "—"} days</strong></div><div><small>PO DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div></div><div className={"linked-delivery-state " + (lateOps.length ? "linked-delivery-late" : "")}><span>{lateOps.length ? <ShieldAlert size={16}/> : <Activity size={16}/>}</span><div><strong>{lateOps.length ? "Delay risk detected" : allDone ? "All saved operations complete" : "Delivery forecast awaits schedule data"}</strong><small>{lateOps.length ? lateOps.length + " operation(s) are past their planned target date." : "ETA can be assessed once operation schedules and dependencies are entered."}</small></div></div></section>
    </div>
    <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> DETAILED OPERATION LIST</div><h3>Process list ({routeOperations.length} operations)</h3><p>Values remain component- and PO-line-specific.</p></div><span className="module-number">{routeOperations.length} ROWS</span></div>
      {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Seq</th><th>Operation</th><th>Type</th><th>Vendor</th><th>Machine / station</th><th>Planned start</th><th>Planned target</th><th>Days</th><th>Qty</th><th>Accepted</th><th>Status</th><th>Vendor payment</th><th>Planned rate</th><th>Actual rate</th><th>Process + transport</th></tr></thead><tbody>{routeOperations.map(op => <tr key={op.id} className={activeOperation?.id === op.id ? "linked-table-selected" : ""} onClick={() => setSelectedOperationId(op.id)}><td>{op.sequence}</td><td><button className="inline-module-link" onClick={e=>{e.stopPropagation();setSelectedOperationId(op.id);}}>{op.name}</button></td><td>{op.category || "—"}</td><td>{vendors.find(v=>v.id===op.vendorId)?.company || "Unassigned"}</td><td>{op.machine || "—"}</td><td>{shortDate(op.plannedStart)}</td><td>{shortDate(op.plannedEnd)}</td><td>{daysBetween(op.plannedStart,op.plannedEnd) || "—"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{op.accepted.toLocaleString("en-IN")}</td><td><span className={"record-state state-" + op.status.toLowerCase().replace(/\s+/g,"-")}>{op.status}</span></td><td>{op.vendorId ? (op.vendorPaymentStatus || "Not Paid") : "—"}</td><td>{money(op.ratePerPart)}</td><td>{op.actualRatePerPart ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.quantity*op.ratePerPart+op.transportCost)}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No operation rows for the selected PO component.</div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Each route is keyed by PO line and component ID; no example company, PO, part number, quote or vendor is preloaded. Server-wide cross-device sync requires the existing AXIMACH server to be deployed with persistent storage and configured in Communication & Follow-up.</span></div>
  </section>;
}
