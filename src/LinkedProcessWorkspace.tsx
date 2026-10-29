import { useMemo, useState } from "react";
import { Activity, ArrowRight, Boxes, CalendarClock, Check, CircleDollarSign, ClipboardCheck, FileText, GitBranch, Package, Plus, Search, ShieldAlert, ShieldCheck, Truck, Users, Workflow, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type LifecycleStatus, type OperationRecord, type PurchaseOrderLine, type PurchaseOrderRecord } from "./manufacturingData";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type DraftOperation = Pick<OperationRecord, "name" | "category" | "machine" | "vendorId" | "status" | "plannedStart" | "plannedEnd" | "quantity" | "completed" | "accepted" | "rejected" | "ratePerPart" | "actualRatePerPart" | "inspectionResult" | "transportCost" | "transportPickup" | "transportDelivery" | "qualityNotes" | "notes" | "branch">;
const blankOperation = (line?: PurchaseOrderLine): DraftOperation => ({
  name: "", category: "", machine: "", vendorId: "", status: "Queued", plannedStart: "", plannedEnd: line?.targetDelivery || "",
  quantity: line?.quantity || 0, completed: 0, accepted: 0, rejected: 0, ratePerPart: 0, actualRatePerPart: 0,
  transportCost: 0, transportPickup: "", transportDelivery: "", qualityNotes: "", inspectionResult: "", notes: "", branch: "Main route"
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
  const operations = activeRows(data.operations);

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

  const companyFactories = factories.filter(f => f.companyId === companyId);
  const companyOrders = purchaseOrders.filter(p => p.companyId === companyId && (!factoryId || p.factoryId === factoryId));
  const selectedPO = purchaseOrders.find(p => p.id === poId);
  const poLines = selectedPO ? selectedPO.lines.filter(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt)) : [];
  const selectedLine = poLines.find(line => line.id === poLineId);
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const routeOperations = operations.filter(op => op.poLineId === poLineId && op.poId === poId && op.componentId === selectedLine?.componentId).sort((a,b) => a.sequence - b.sequence);
  const visibleOperations = routeOperations.filter(op => (op.name + " " + op.category + " " + op.machine + " " + (vendors.find(v => v.id === op.vendorId)?.company || "") + " " + op.status).toLowerCase().includes(search.toLowerCase().trim()));
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
    const nextFactory = factories.find(f => f.companyId === nextCompanyId)?.id || "";
    setFactoryId(nextFactory);
    const nextPO = purchaseOrders.find(p => p.companyId === nextCompanyId && (!nextFactory || p.factoryId === nextFactory));
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
    if (transport) { base.name = "Transport / handover"; base.category = "Logistics"; base.branch = "Main route"; }
    if (branch && activeOperation) { base.branch = "Alternate / rework"; base.name = "Alternate / rework operation"; }
    setDraft(base);
    setEditingId("");
    setShowEditor(true);
  };
  const editActive = () => {
    if (!activeOperation) return;
    setDraft({
      name: activeOperation.name, category: activeOperation.category, machine: activeOperation.machine, vendorId: activeOperation.vendorId,
      status: activeOperation.status, plannedStart: activeOperation.plannedStart, plannedEnd: activeOperation.plannedEnd,
      quantity: activeOperation.quantity, completed: activeOperation.completed, accepted: activeOperation.accepted, rejected: activeOperation.rejected,
      ratePerPart: activeOperation.ratePerPart, actualRatePerPart: activeOperation.actualRatePerPart || 0, transportCost: activeOperation.transportCost, transportPickup: activeOperation.transportPickup,
      transportDelivery: activeOperation.transportDelivery, qualityNotes: activeOperation.qualityNotes, inspectionResult: activeOperation.inspectionResult || "", notes: activeOperation.notes, branch: activeOperation.branch
    });
    setEditingId(activeOperation.id); setShowEditor(true);
  };
  const saveOperation = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line first."); return; }
    if (!draft.name.trim()) { onNotice("Enter the operation name."); return; }
    if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) { onNotice("Target/end date cannot be before planned start date."); return; }
    if (draft.accepted + draft.rejected > draft.completed) { onNotice("Accepted plus rejected quantity cannot exceed completed quantity."); return; }
    const stamp = nowIso();
    update(current => {
      const currentRoute = current.operations.filter(op => op.poLineId === selectedLine.id && op.poId === selectedPO.id && op.componentId === selectedComponent.id && !op.deletedAt);
      const old = current.operations.find(op => op.id === editingId);
      const next: OperationRecord = {
        id: editingId || makeId("operation"), poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id,
        sequence: old?.sequence ?? (Math.max(0, ...currentRoute.map(op => op.sequence)) + 10),
        ...draft, vendorId: draft.vendorId || "", actualRatePerPart: draft.actualRatePerPart || 0, transportVendorId: old?.transportVendorId || "",
        createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined,
        actualStart: old?.actualStart || "", actualEnd: old?.actualEnd || "", parentId: old?.parentId || (draft.branch !== "Main route" ? activeOperation?.id || "" : "")
      };
      return { ...current, operations: [...current.operations.filter(op => op.id !== next.id), next] };
    });
    setSelectedOperationId(editingId || "");
    setShowEditor(false); setEditingId("");
    onNotice(editingId ? "Operation updated and linked to its PO line/component ID." : "Operation saved against the selected PO line. Cost and dates remain separate for this component.");
  };
  const updateOperation = (id: string, patch: Partial<OperationRecord>) => {
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(op => op.id === id ? { ...op, ...patch, updatedAt: stamp } : op) }));
  };
  const archiveOperation = (op: OperationRecord) => {
    if (!window.confirm("Archive this operation? Its history and quotations will be retained.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(item => item.id === op.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item), quotations: current.quotations.map(q => q.operationId === op.id && !q.deletedAt ? { ...q, deletedAt: stamp, updatedAt: stamp } : q) }));
    setSelectedOperationId(""); onNotice("Operation archived. Linked quotation history was retained as archived history.");
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
      <label>Company<select value={companyId} onChange={e => changeSelection(e.target.value)}><option value="">Select company…</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>{!companies.length && <button type="button" onClick={() => onSelectModule("companies")}>Add company</button>}</label>
      <label>Factory<select value={factoryId} onChange={e => { setFactoryId(e.target.value); const next = purchaseOrders.find(p => p.factoryId === e.target.value); setPoId(next?.id || ""); setPoLineId(next?.lines[0]?.id || ""); setSelectedOperationId(""); }}><option value="">Select factory…</option>{companyFactories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>{companyId && !companyFactories.length && <button type="button" onClick={() => onSelectModule("companies")}>Add factory</button>}</label>
      <label>Purchase order<select value={poId} onChange={e => changePO(e.target.value)}><option value="">Select purchase order…</option>{companyOrders.map(p => <option key={p.id} value={p.id}>{p.number} · {p.status}</option>)}</select>{companyId && !companyOrders.length && <button type="button" onClick={() => onSelectModule("purchasing")}>Add PO</button>}</label>
      <label>PO component line<select value={poLineId} onChange={e => changeLine(e.target.value)}><option value="">Select component line…</option>{poLines.map(line => { const component = components.find(c => c.id === line.componentId); return <option key={line.id} value={line.id}>{component ? component.partNumber + " · " + component.name : "Missing component"} · {line.quantity.toLocaleString("en-IN")} pcs</option>; })}</select>{poId && !poLines.length && <button type="button" onClick={() => onSelectModule("purchasing")}>Add PO lines</button>}</label>
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
    </> : <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>Start with your real master records</h3><p>No company, PO or component is preloaded. Add each master record once; then select a real purchase-order line and AXIMACH will load the component, quantity and delivery date for its route.</p><div className="linked-empty-actions"><button className="button-primary" onClick={() => onSelectModule("companies")}><Plus size={14}/> Add company / factory</button><button className="button-quiet" onClick={() => onSelectModule("components")}><Package size={14}/> Add component</button><button className="button-quiet" onClick={() => onSelectModule("purchasing")}><FileText size={14}/> Create PO</button></div></div></section>}
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
            <label>Operation name *<input value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="CNC turning, VMC milling, heat treatment…"/></label>
            <label>Process type<input value={draft.category} onChange={e => setDraft({...draft,category:e.target.value})} placeholder="Machining, treatment, quality…"/></label>
            <label>Machine / station<input value={draft.machine} onChange={e => setDraft({...draft,machine:e.target.value})} placeholder="Machine / work centre"/></label>
            <label>Vendor<select value={draft.vendorId} onChange={e => setDraft({...draft,vendorId:e.target.value})}><option value="">Assign vendor later</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.company} · {v.phone || "No phone"}{v.status.toLowerCase().includes("unverified") ? " · Unverified" : ""}</option>)}</select>{!vendors.length && <small className="field-hint">Scan/import contacts or add a vendor in Vendors first.</small>}</label>
            <label>Planned start<input type="date" value={draft.plannedStart} onChange={e => setDraft({...draft,plannedStart:e.target.value})}/></label>
            <label>Planned target/end<input type="date" min={draft.plannedStart || undefined} value={draft.plannedEnd} onChange={e => setDraft({...draft,plannedEnd:e.target.value})}/></label>
            <label>Duration (calendar days)<input readOnly value={daysBetween(draft.plannedStart,draft.plannedEnd) || "—"}/></label>
            <label>Quantity to process<input type="number" min="0" value={draft.quantity || ""} onChange={e => setDraft({...draft,quantity:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Completed quantity<input type="number" min="0" value={draft.completed || ""} onChange={e => setDraft({...draft,completed:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Accepted quantity<input type="number" min="0" value={draft.accepted || ""} onChange={e => setDraft({...draft,accepted:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Rejected quantity<input type="number" min="0" value={draft.rejected || ""} onChange={e => setDraft({...draft,rejected:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Quoted / planned rate per part (₹)<input type="number" min="0" step="0.01" value={draft.ratePerPart || ""} onChange={e => setDraft({...draft,ratePerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Actual rate per part (₹)<input type="number" min="0" step="0.01" value={draft.actualRatePerPart || ""} onChange={e => setDraft({...draft,actualRatePerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Planned process cost (₹)<input readOnly value={money(draft.quantity * draft.ratePerPart)}/></label>
            <label>Status<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as LifecycleStatus})}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
            <label>Route type<input value={draft.branch} onChange={e => setDraft({...draft,branch:e.target.value})} placeholder="Main route / Alternate / Rework"/></label>
            <label>Transport pickup date<input type="date" value={draft.transportPickup} onChange={e => setDraft({...draft,transportPickup:e.target.value})}/></label>
            <label>Transport delivery date<input type="date" value={draft.transportDelivery} onChange={e => setDraft({...draft,transportDelivery:e.target.value})}/></label>
            <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={draft.transportCost || ""} onChange={e => setDraft({...draft,transportCost:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label className="editor-wide">Quality / inspection requirement<input value={draft.qualityNotes} onChange={e => setDraft({...draft,qualityNotes:e.target.value})} placeholder="Required checks, acceptance criteria, gauges…"/></label>
            <label className="editor-wide">Inspection result<input value={draft.inspectionResult} onChange={e => setDraft({...draft,inspectionResult:e.target.value})} placeholder="Not inspected, accepted, rejected, actual results…"/></label>
            <label className="editor-wide">Operation notes<input value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})} placeholder="Setup, process constraints, delivery instructions"/></label>
            <div className="module-form-actions"><button className="button-primary" onClick={saveOperation}><Check size={14}/> {editingId ? "Save changes" : "Save operation"}</button><button className="button-quiet" onClick={() => setShowEditor(false)}>Cancel</button></div>
          </div>
        </section>}
        {routeOperations.length ? <div className={"linked-node-scroll " + (vertical ? "linked-node-vertical" : "")}><div className="linked-node-track" style={{transform:"scale(" + zoom + ")",transformOrigin:"top left"}}>{visibleOperations.map((op,index) => {
          const vendor = vendors.find(v => v.id === op.vendorId);
          const selected = op.id === activeOperation?.id;
          return <div className="linked-node-wrap" key={op.id}><button className={"linked-operation-node status-" + op.status.toLowerCase().replace(/\s+/g,"-") + (selected ? " linked-node-selected" : "")} onClick={() => {setSelectedOperationId(op.id);setShowEditor(false);}}><span className="linked-node-icon">{op.name.toLowerCase().includes("transport") || op.name.toLowerCase().includes("dispatch") ? <Truck size={19}/> : op.name.toLowerCase().includes("inspect") || op.name.toLowerCase().includes("quality") ? <ClipboardCheck size={19}/> : op.name.toLowerCase().includes("grind") ? <Wrench size={19}/> : <Workflow size={19}/>}</span><strong>{op.name}</strong><small>OP-{String(op.sequence).padStart(3,"0")}</small><span>{op.status}</span><small>{vendor?.company || "Vendor unassigned"}</small><small>{daysBetween(op.plannedStart,op.plannedEnd) || "—"} day(s)</small></button>{index < visibleOperations.length - 1 && <span className="linked-node-arrow"><ArrowRight size={18}/></span>}</div>;
        })}{!visibleOperations.length && <div className="module-empty-state">No operations match this search.</div>}</div></div> : <div className="module-empty-state linked-no-operations"><Workflow size={28}/><h3>No operations saved for this component</h3><p>Add only the operations this part actually requires. There is no fixed stage limit and no sample CNC or heat-treatment data.</p><button className="button-primary" disabled={!selectedLine} onClick={() => startAdd()}><Plus size={14}/> Add first operation</button></div>}
        <div className="route-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="route-scroll-note">Select any operation to inspect its schedule, vendor, quality and cost.</span></div>
      </section>
      <aside className="surface-panel linked-operation-side">
        {activeOperation ? <><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SELECTED OPERATION</div><h3>{activeOperation.name}</h3><p>{activeOperation.category || "Process type not specified"} · OP-{String(activeOperation.sequence).padStart(3,"0")}</p></div><button className="icon-control" aria-label="Edit selected operation" onClick={editActive}><Wrench size={14}/></button></div>
          <div className="linked-detail-grid"><div><small>VENDOR</small><strong>{selectedVendor?.company || "Not assigned"}</strong><span>{selectedVendor?.phone || "No vendor number linked"}</span></div><div><small>MACHINE / STATION</small><strong>{activeOperation.machine || "Not entered"}</strong></div><div><small>PLANNED SCHEDULE</small><strong>{shortDate(activeOperation.plannedStart)} – {shortDate(activeOperation.plannedEnd)}</strong><span>{daysBetween(activeOperation.plannedStart,activeOperation.plannedEnd) || "—"} calendar day(s)</span></div><div><small>ACTUAL SCHEDULE</small><strong>{shortDate(activeOperation.actualStart)} – {shortDate(activeOperation.actualEnd)}</strong></div><div><small>QUANTITY</small><strong>{activeOperation.quantity.toLocaleString("en-IN")} pcs</strong><span>{activeOperation.completed.toLocaleString("en-IN")} completed</span></div><div><small>ACCEPTED / REJECTED</small><strong>{activeOperation.accepted.toLocaleString("en-IN")} / {activeOperation.rejected.toLocaleString("en-IN")}</strong></div><div><small>QUOTED / PLANNED RATE</small><strong>{money(activeOperation.ratePerPart)}</strong></div><div><small>ACTUAL RATE / PART</small><strong>{activeOperation.actualRatePerPart ? money(activeOperation.actualRatePerPart) : "Not entered"}</strong></div><div><small>PROCESS + TRANSPORT COST</small><strong>{money(activeOperation.quantity * activeOperation.ratePerPart + activeOperation.transportCost)}</strong></div><div><small>TRANSPORT</small><strong>{activeOperation.transportPickup || activeOperation.transportDelivery ? shortDate(activeOperation.transportPickup) + " → " + shortDate(activeOperation.transportDelivery) : "Not scheduled"}</strong><span>{money(activeOperation.transportCost)}</span></div><div><small>STATUS</small><strong>{activeOperation.status}</strong></div><div className="linked-detail-wide"><small>QUALITY / INSPECTION REQUIREMENT</small><strong>{activeOperation.qualityNotes || "No quality notes recorded"}</strong></div><div className="linked-detail-wide"><small>INSPECTION RESULT</small><strong>{activeOperation.inspectionResult || "Not entered"}</strong></div><div className="linked-detail-wide"><small>NOTES</small><strong>{activeOperation.notes || "No operation notes entered"}</strong></div></div>
          <div className="linked-side-actions"><button className="button-primary" onClick={editActive}><Wrench size={14}/> Edit operation</button><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Quotes / costing</button><button className="button-quiet" onClick={() => archiveOperation(activeOperation)}><X size={14}/> Archive</button></div>
          <div className="linked-quote-preview"><div className="panel-heading"><div><h3>Vendor quotations</h3><p>{selectedOperationQuotations.length} quote(s) linked to this operation</p></div></div>{selectedOperationQuotations.length ? selectedOperationQuotations.map(q => <div key={q.id} className="linked-quote-mini"><strong>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</strong><span>{money(q.ratePerPart)}/part · {q.leadDays} lead day(s)</span><small>{q.quoteReference || "No quote reference"} · {q.status}</small></div>) : <div className="vendor-empty">No quotations recorded for this operation yet. Add a quote from Costing.</div>}</div>
        </> : <div className="module-empty-state"><Workflow size={28}/><h3>Select an operation</h3><p>Operation details, schedule, vendor link, quantities, quality and cost will appear here.</p></div>}
      </aside>
    </div>
    <div className="linked-bottom-grid">
      <section className="surface-panel linked-cost-card"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COST BREAKDOWN</div><h3>Entered route costs</h3><p>Only rates you entered or selected from quotations are counted.</p></div><CircleDollarSign size={18}/></div><div className="linked-cost-row"><span>Process cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.quantity*op.ratePerPart,0))}</strong></div><div className="linked-cost-row"><span>Transport cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.transportCost,0))}</strong></div><div className="linked-cost-row linked-cost-total"><span>Total entered</span><strong>{money(totalProcessCost)}</strong></div><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Open detailed costing</button></section>
      <section className="surface-panel linked-timeline-card" id="linked-timeline"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> TIMELINE & DELIVERY</div><h3>Planned progress</h3><p>Schedule is based on saved operation dates, not estimated samples.</p></div><CalendarClock size={18}/></div><div className="linked-timeline-facts"><div><small>FIRST PLANNED START</small><strong>{shortDate(timelineStart)}</strong></div><div><small>LAST OPERATION TARGET</small><strong>{shortDate(timelineEnd)}</strong></div><div><small>SUM OF OPERATION DAYS</small><strong>{durationDays || "—"} days</strong></div><div><small>PO DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div></div><div className={"linked-delivery-state " + (lateOps.length ? "linked-delivery-late" : "")}><span>{lateOps.length ? <ShieldAlert size={16}/> : <Activity size={16}/>}</span><div><strong>{lateOps.length ? "Delay risk detected" : allDone ? "All saved operations complete" : "Delivery forecast awaits schedule data"}</strong><small>{lateOps.length ? lateOps.length + " operation(s) are past their planned target date." : "ETA can be assessed once operation schedules and dependencies are entered."}</small></div></div></section>
    </div>
    <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> DETAILED OPERATION LIST</div><h3>Process list ({routeOperations.length} operations)</h3><p>Values remain component- and PO-line-specific.</p></div><span className="module-number">{routeOperations.length} ROWS</span></div>
      {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Seq</th><th>Operation</th><th>Type</th><th>Vendor</th><th>Machine / station</th><th>Planned start</th><th>Planned target</th><th>Days</th><th>Qty</th><th>Accepted</th><th>Status</th><th>Planned rate</th><th>Actual rate</th><th>Process + transport</th></tr></thead><tbody>{routeOperations.map(op => <tr key={op.id} className={activeOperation?.id === op.id ? "linked-table-selected" : ""} onClick={() => setSelectedOperationId(op.id)}><td>{op.sequence}</td><td><button className="inline-module-link" onClick={e=>{e.stopPropagation();setSelectedOperationId(op.id);}}>{op.name}</button></td><td>{op.category || "—"}</td><td>{vendors.find(v=>v.id===op.vendorId)?.company || "Unassigned"}</td><td>{op.machine || "—"}</td><td>{shortDate(op.plannedStart)}</td><td>{shortDate(op.plannedEnd)}</td><td>{daysBetween(op.plannedStart,op.plannedEnd) || "—"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{op.accepted.toLocaleString("en-IN")}</td><td><span className={"record-state state-" + op.status.toLowerCase().replace(/\s+/g,"-")}>{op.status}</span></td><td>{money(op.ratePerPart)}</td><td>{op.actualRatePerPart ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.quantity*op.ratePerPart+op.transportCost)}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No operation rows for the selected PO component.</div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Each route is keyed by PO line and component ID; no example company, PO, part number, quote or vendor is preloaded. Server-wide cross-device sync requires the existing AXIMACH server to be deployed with persistent storage and configured in Communication & Follow-up.</span></div>
  </section>;
}
