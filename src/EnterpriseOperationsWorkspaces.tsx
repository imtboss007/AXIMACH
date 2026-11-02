import { useMemo, useState } from "react";
import {
  Activity, ArrowRight, BadgeCheck, CalendarClock, Check, CircleAlert, CircleDollarSign,
  ClipboardList, FileText, Package, Plus, Receipt, RotateCcw, Search, ShieldCheck,
  Truck, Wallet, X, Factory
} from "lucide-react";
import { motion } from "motion/react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type DispatchRecord, type DispatchStatus, type InvoiceKind, type InvoiceRecord,
  type InvoiceStatus, type OperationRecord, type PaymentRecord
} from "./manufacturingData";

type WorkspaceProps = {
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  onSelectModule: (id: string) => void;
};

const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const prettyDate = (value?: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Not set";
const lineLabel = (po: { number: string; lines: Array<{ id: string; componentId: string; quantity: number; targetDelivery: string }> }, line: { id: string; componentId: string; quantity: number; targetDelivery: string }, component?: { partNumber: string; name: string }) =>
  po.number + " · " + (component?.partNumber || "Part") + " · " + line.quantity.toLocaleString("en-IN") + " pcs";

function WorkspaceHero({ eyebrow, title, description, onBack, onSelectModule, actionLabel, actionModule, icon }: {
  eyebrow: string; title: string; description: string; onBack: () => void; onSelectModule: (id: string) => void;
  actionLabel: string; actionModule: string; icon: "production" | "dispatch" | "finance";
}) {
  const Icon = icon === "production" ? Activity : icon === "dispatch" ? Truck : Wallet;
  return <motion.div className="workspace-title-row ax-enterprise-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
    <div className="ax-enterprise-title">
      <button className="back-link" onClick={onBack}><ArrowRight size={14} /> Command centre</button>
      <div className="eyebrow"><span className="eyebrow-mark" /> {eyebrow}</div>
      <h1>{title}<span>.</span></h1>
      <p>{description}</p>
    </div>
    <div className="ax-enterprise-actions"><span className="ax-enterprise-emblem"><Icon size={23} /></span><button className="button-quiet" onClick={() => onSelectModule(actionModule)}>{actionLabel} <ArrowRight size={14} /></button></div>
  </motion.div>;
}

function StatCard({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: "activity" | "clock" | "alert" | "check" | "rupee" | "truck" }) {
  const Icon = icon === "activity" ? Activity : icon === "clock" ? CalendarClock : icon === "alert" ? CircleAlert : icon === "check" ? BadgeCheck : icon === "rupee" ? CircleDollarSign : Truck;
  return <motion.div className="ax-enterprise-stat" whileHover={{ y: -2 }} transition={{ duration: .16 }}>
    <span className="ax-enterprise-stat-icon"><Icon size={17} /></span>
    <small>{label}</small><strong>{value}</strong><span>{detail}</span>
  </motion.div>;
}

function WorkspaceNotice({ notice, onNotice }: { notice: string; onNotice: (value: string) => void }) {
  if (!notice) return null;
  return <div className="notice-banner"><ShieldCheck size={15} /><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={14} /></button></div>;
}

export function ProductionPlanningWorkspace({ onBack, onNotice, notice, onSelectModule }: WorkspaceProps) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const purchaseOrders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const operations = activeRows(data.operations);
  const [query, setQuery] = useState("");
  const [machineFilter, setMachineFilter] = useState("All machines");
  const [editing, setEditing] = useState<OperationRecord | null>(null);

  const rows = useMemo(() => operations.map(operation => {
    const po = purchaseOrders.find(item => item.id === operation.poId);
    const line = po?.lines.find(item => item.id === operation.poLineId);
    const component = components.find(item => item.id === operation.componentId);
    const company = po ? companies.find(item => item.id === po.companyId) : undefined;
    return { operation, po, line, component, company };
  }).filter(row => row.po && row.line), [operations, purchaseOrders, components, companies]);

  const machineNames = useMemo(() => ["All machines", ...Array.from(new Set(rows.map(row => row.operation.machine.trim()).filter(Boolean))).sort()], [rows]);
  const filtered = rows.filter(row => {
    const text = [row.operation.name, row.operation.category, row.operation.machine, row.po?.number, row.component?.partNumber, row.component?.name, row.company?.name].join(" ").toLowerCase();
    return text.includes(query.toLowerCase().trim()) && (machineFilter === "All machines" || row.operation.machine === machineFilter);
  });
  const queued = operations.filter(row => row.status === "Queued").length;
  const running = operations.filter(row => row.status === "Running").length;
  const held = operations.filter(row => row.status === "Quality hold").length;
  const complete = operations.filter(row => row.status === "Complete").length;

  const updateOperation = (next: OperationRecord) => {
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(row => row.id === next.id ? { ...next, updatedAt: stamp } : row) }));
    setEditing(null);
    onNotice("Production operation updated. The PO line, component and process links remain unchanged.");
  };
  const changeStatus = (row: OperationRecord, status: OperationRecord["status"]) => {
    const stamp = nowIso();
    const next = { ...row, status, updatedAt: stamp };
    if (status === "Running" && !next.actualStart) next.actualStart = stamp.slice(0, 16);
    if (status === "Complete" && !next.actualEnd) next.actualEnd = stamp.slice(0, 16);
    update(current => ({ ...current, operations: current.operations.map(item => item.id === row.id ? next : item) }));
    onNotice("Operation status changed to " + status + ". Actual quantity fields were not auto-filled.");
  };
  const updateJob = (poId: string, lineId: string, finished: boolean) => {
    const po = purchaseOrders.find(item => item.id === poId);
    const line = po?.lines.find(item => item.id === lineId);
    if (!po || !line) return;
    const incomplete = operations.filter(item => item.poId === poId && item.poLineId === lineId && item.status !== "Complete");
    if (finished && incomplete.length && !window.confirm(incomplete.length + " operation(s) are not Complete. Mark the PO-line job Finished anyway? Operation statuses and quantities will remain unchanged.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      purchaseOrders: current.purchaseOrders.map(order => order.id !== poId ? order : {
        ...order, updatedAt: stamp,
        lines: order.lines.map(item => item.id !== lineId ? item : { ...item, jobStatus: finished ? "Finished" : "In progress", jobFinishedAt: finished ? stamp : undefined, updatedAt: stamp })
      })
    }));
    onNotice(finished ? "PO-line job marked Finished separately from operation completion." : "PO-line job reopened; all operation history was retained.");
  };

  const machineLoad = machineNames.slice(1).map(machine => ({ machine, count: rows.filter(row => row.operation.machine === machine && row.operation.status !== "Complete").length }));

  return <section className="workspace-page ax-enterprise-page">
    <WorkspaceNotice notice={notice} onNotice={onNotice} />
    <WorkspaceHero eyebrow="OPERATIONS / PLANNING + SHOP-FLOOR CONTROL" title="Production planning" description="Schedule and release the real PO-linked operations already in AXIMACH. Planned dates, machine assignment, status and actual quantities remain attached to their original route records." onBack={onBack} onSelectModule={onSelectModule} actionLabel="Open process route" actionModule="process-map" icon="production" />
    <div className="ax-enterprise-sync"><span className={syncStatus === "synced" ? "is-synced" : ""} /> {syncStatus === "synced" ? "Shared manufacturing data synced" : syncStatus === "syncing" ? "Syncing manufacturing data" : syncStatus === "error" ? "Sync issue · local edits retained" : "Local manufacturing data · server sync not configured"}</div>
    <div className="ax-enterprise-stats">
      <StatCard label="QUEUED OPERATIONS" value={queued} detail="Waiting to be released" icon="clock" />
      <StatCard label="RUNNING" value={running} detail="Marked in progress" icon="activity" />
      <StatCard label="QUALITY HOLDS" value={held} detail="Require disposition" icon="alert" />
      <StatCard label="COMPLETED OPERATIONS" value={complete} detail="Route operation status" icon="check" />
    </div>
    <section className="surface-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> JOB CONTROL / PO-LINE SIGN-OFF</div><h3>Production jobs</h3><p>Finishing a job does not silently mark its operations complete or change accepted/rejected quantities.</p></div><span className="demo-pill"><i /> SEPARATE JOB STATUS</span></div>
      {purchaseOrders.some(po => po.lines.some(line => !line.deletedAt)) ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO / company</th><th>Component</th><th>Quantity</th><th>Due</th><th>Operations</th><th>Job status</th><th>Action</th></tr></thead><tbody>
        {purchaseOrders.flatMap(po => po.lines.filter(line => !line.deletedAt).map(line => {
          const component = components.find(item => item.id === line.componentId);
          const count = operations.filter(item => item.poId === po.id && item.poLineId === line.id).length;
          const finished = line.jobStatus === "Finished";
          return <tr key={po.id + ":" + line.id}><td><strong>{po.number}</strong><small>{companies.find(item => item.id === po.companyId)?.name || "Company not found"}</small></td><td><strong>{component?.partNumber || "Part master missing"}</strong><small>{component?.name || "PO line retained"}</small></td><td>{line.quantity.toLocaleString("en-IN")} pcs</td><td>{line.targetDelivery || po.targetDelivery || "—"}</td><td>{count} route steps</td><td><span className={"record-state " + (finished ? "state-selected" : "state-open")}>{finished ? "Job Finished" : "In Progress"}</span>{finished && line.jobFinishedAt && <small>{prettyDate(line.jobFinishedAt.slice(0, 10))}</small>}</td><td><button className={finished ? "button-quiet compact-button" : "button-primary compact-button"} onClick={() => updateJob(po.id, line.id, !finished)}>{finished ? <RotateCcw size={12} /> : <Check size={12} />} {finished ? "Reopen job" : "Finish job"}</button></td></tr>;
        }))}
      </tbody></table></div> : <div className="module-empty-state"><Package size={25} /><h3>No PO component lines yet</h3><p>Create a real purchase order and add component lines before scheduling production.</p><button className="button-primary" onClick={() => onSelectModule("purchasing")}>Open purchase orders</button></div>}
    </section>
    <section className="surface-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> RESOURCE PLAN / OPERATION SCHEDULE</div><h3>Scheduled operations ({filtered.length})</h3><p>Machine demand is shown as a count of non-complete operations. Working-hour capacity is not inferred when machine calendars or cycle times are missing.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><ClipboardList size={13} /> Add route operations</button></div>
      <div className="ax-enterprise-toolbar"><label className="module-record-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search PO, part, process or machine…" /></label><select value={machineFilter} onChange={event => setMachineFilter(event.target.value)}>{machineNames.map(name => <option key={name}>{name}</option>)}</select></div>
      {filtered.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Operation / route</th><th>Machine / resource</th><th>Vendor</th><th>Planned start</th><th>Planned target</th><th>Qty / completed</th><th>Status</th><th>Control</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.operation.id}><td><strong>{row.operation.name}</strong><small>{row.po?.number || "PO"} · {row.component?.partNumber || "Component"} · OP-{row.operation.sequence}</small></td><td>{row.operation.machine || "Not assigned"}</td><td>{data.vendors.find(vendor => vendor.id === row.operation.vendorId)?.company || "Internal / not assigned"}</td><td>{row.operation.plannedStart || "—"}</td><td>{row.operation.plannedEnd || "—"}</td><td>{row.operation.quantity.toLocaleString("en-IN")} / {row.operation.completed.toLocaleString("en-IN")}</td><td><span className={"record-state " + (row.operation.status === "Complete" ? "state-complete" : row.operation.status === "Running" ? "state-selected" : row.operation.status === "Quality hold" ? "state-hold" : "state-open")}>{row.operation.status}</span></td><td><div className="ax-enterprise-row-actions"><button className="button-quiet compact-button" onClick={() => setEditing({ ...row.operation })}>Edit plan</button>{row.operation.status !== "Running" && row.operation.status !== "Complete" && <button className="button-primary compact-button" onClick={() => changeStatus(row.operation, "Running")}>Start</button>}{row.operation.status === "Running" && <button className="button-primary compact-button" onClick={() => changeStatus(row.operation, "Complete")}>Complete</button>}{row.operation.status === "Quality hold" && <button className="button-quiet compact-button" onClick={() => setEditing({ ...row.operation })}>Disposition</button>}</div></td></tr>)}
      </tbody></table></div> : <div className="module-empty-state"><Activity size={26} /><h3>{operations.length ? "No matching operations" : "No route operations planned"}</h3><p>{operations.length ? "Adjust the search or machine filter." : "The production planner does not invent process steps. Add the required real route in Process Map, then plan each operation here."}</p>{!operations.length && <button className="button-primary" onClick={() => onSelectModule("process-map")}>Open process map</button>}</div>}
    </section>
    <section className="surface-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> MACHINE LOAD / OPEN WORK</div><h3>Machine allocation</h3><p>Current assigned workload by resource name.</p></div></div>
      {machineLoad.length ? <div className="ax-enterprise-machine-grid">{machineLoad.map(item => <div className="ax-enterprise-machine" key={item.machine}><Factory size={16} /><span><strong>{item.machine}</strong><small>{item.count} non-complete operation(s) allocated</small></span><b>{item.count}</b></div>)}</div> : <div className="vendor-empty">Machine allocation appears after a machine or resource is entered on a route operation.</div>}
    </section>
    {editing && <div className="overlay-shell" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="new-job-modal ax-enterprise-editor">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> EDIT OPERATION PLAN</div><h3>{editing.name}</h3><p>PO and component link: {purchaseOrders.find(po => po.id === editing.poId)?.number || "PO"} · {components.find(component => component.id === editing.componentId)?.partNumber || "Component"}</p></div><button className="icon-control" onClick={() => setEditing(null)} aria-label="Close editor"><X size={15} /></button></div>
      <div className="module-record-form">
        <label>Machine / work centre<input value={editing.machine} onChange={event => setEditing({ ...editing, machine: event.target.value })} placeholder="CNC / VMC / Wire EDM / Grinding…" /></label>
        <label>Supplier / subcontractor<select value={editing.vendorId} onChange={event => setEditing({ ...editing, vendorId: event.target.value })}><option value="">Internal / not assigned</option>{data.vendors.filter(vendor => !vendor.deletedAt).map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.company}</option>)}</select></label>
        <label>Planned start<input type="date" value={editing.plannedStart} onChange={event => setEditing({ ...editing, plannedStart: event.target.value })} /></label>
        <label>Planned target<input type="date" value={editing.plannedEnd} onChange={event => setEditing({ ...editing, plannedEnd: event.target.value })} /></label>
        <label>Planned quantity<input type="number" min="0" value={editing.quantity} onChange={event => setEditing({ ...editing, quantity: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label>Completed quantity<input type="number" min="0" value={editing.completed} onChange={event => setEditing({ ...editing, completed: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label>Accepted quantity<input type="number" min="0" value={editing.accepted} onChange={event => setEditing({ ...editing, accepted: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label>Rejected quantity<input type="number" min="0" value={editing.rejected} onChange={event => setEditing({ ...editing, rejected: Math.max(0, Number(event.target.value) || 0) })} /></label>
        <label>Operation status<select value={editing.status} onChange={event => setEditing({ ...editing, status: event.target.value as OperationRecord["status"] })}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
        <label>Actual start<input type="datetime-local" value={editing.actualStart} onChange={event => setEditing({ ...editing, actualStart: event.target.value })} /></label>
        <label>Actual end<input type="datetime-local" value={editing.actualEnd} onChange={event => setEditing({ ...editing, actualEnd: event.target.value })} /></label>
        <label className="module-form-wide">Planner / production notes<input value={editing.notes} onChange={event => setEditing({ ...editing, notes: event.target.value })} placeholder="Setup, fixture, shift, queue or constraint notes…" /></label>
        <div className="module-form-actions"><button className="button-primary" onClick={() => {
          if (editing.accepted + editing.rejected > editing.completed) { onNotice("Accepted plus rejected quantity cannot exceed completed quantity."); return; }
          if (editing.completed > editing.quantity && editing.quantity > 0 && !window.confirm("Completed quantity exceeds planned quantity. Save this actual overrun?")) return;
          if (editing.plannedStart && editing.plannedEnd && editing.plannedEnd < editing.plannedStart) { onNotice("Planned target date cannot be earlier than planned start."); return; }
          updateOperation(editing);
        }}><Check size={14} /> Save schedule</button><button className="button-quiet" onClick={() => setEditing(null)}>Cancel</button></div>
      </div>
    </section></div>}
    <div className="module-safety-note"><ShieldCheck size={14} /><span>Production schedules use saved route operations. Capacity is not presented as hours or utilisation until machine calendars, shifts, cycle times and maintenance downtime are configured. Job completion remains a separate sign-off from operation status.</span></div>
  </section>;
}

const dispatchStatuses: DispatchStatus[] = ["Packing", "Ready", "Dispatched", "In transit", "Delivered pending confirmation", "Received", "Exception", "Cancelled"];
const emptyDispatchDraft = (): Omit<DispatchRecord, "id" | "createdAt" | "updatedAt"> => ({
  poId: "", poLineId: "", componentId: "", quantity: 0, challanNumber: "", carrier: "", carrierVendorId: "",
  vehicleNumber: "", trackingReference: "", pickupDate: today(), expectedDelivery: "", dispatchedAt: "",
  receivedAt: "", receivedBy: "", status: "Packing", freightCost: 0, notes: ""
});

export function DispatchWorkspace({ onBack, onNotice, notice, onSelectModule }: WorkspaceProps) {
  const { data, update, syncStatus } = useManufacturingData();
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const dispatches = activeRows(data.dispatches);
  const lines = orders.flatMap(po => po.lines.filter(line => !line.deletedAt).map(line => ({ po, line, component: components.find(item => item.id === line.componentId) })));
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDispatchDraft);
  const [search, setSearch] = useState("");
  const available = draft.poLineId ? (() => {
    const row = lines.find(item => item.line.id === draft.poLineId);
    return row ? Math.max(0, row.line.quantity - dispatches.filter(item => item.poLineId === draft.poLineId && item.status !== "Cancelled").reduce((sum, item) => sum + item.quantity, 0)) : 0;
  })() : 0;
  const filtered = dispatches.filter(item => {
    const po = orders.find(order => order.id === item.poId);
    const component = components.find(row => row.id === item.componentId);
    return [item.challanNumber, item.carrier, item.vehicleNumber, item.trackingReference, item.status, po?.number, component?.partNumber].join(" ").toLowerCase().includes(search.toLowerCase().trim());
  });
  const pending = dispatches.filter(item => !["Received", "Cancelled"].includes(item.status)).length;
  const inTransit = dispatches.filter(item => ["Dispatched", "In transit", "Delivered pending confirmation"].includes(item.status)).length;
  const freight = dispatches.reduce((sum, item) => sum + item.freightCost, 0);
  const saveDispatch = () => {
    const poLine = lines.find(item => item.line.id === draft.poLineId);
    if (!poLine) { onNotice("Select the purchase order component line before creating a dispatch."); return; }
    if (!draft.challanNumber.trim()) { onNotice("Enter the delivery challan or shipment reference."); return; }
    if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) { onNotice("Enter a dispatch quantity greater than zero."); return; }
    if (draft.quantity > available) { onNotice("Dispatch quantity exceeds the remaining undelivered PO-line quantity (" + available.toLocaleString("en-IN") + " pcs)."); return; }
    const stamp = nowIso();
    const record: DispatchRecord = { ...draft, poId: poLine.po.id, componentId: poLine.line.componentId, challanNumber: draft.challanNumber.trim(), id: makeId("dispatch"), createdAt: stamp, updatedAt: stamp };
    update(current => ({ ...current, dispatches: [record, ...current.dispatches] }));
    setDraft(emptyDispatchDraft());
    setShowForm(false);
    onNotice("Dispatch record saved against " + poLine.po.number + ". The inventory ledger was not changed automatically.");
  };
  const changeStatus = (record: DispatchRecord, status: DispatchStatus) => {
    let receiver = record.receivedBy;
    if (status === "Received") {
      if (!window.confirm("Confirm that the consignee has physically received this quantity? This closes the dispatch record but does not post an inventory receipt.")) return;
      receiver = window.prompt("Receiving person / consignee name (optional):", record.receivedBy || "") ?? record.receivedBy;
    }
    const stamp = nowIso();
    update(current => ({ ...current, dispatches: current.dispatches.map(item => item.id !== record.id ? item : {
      ...item, status, updatedAt: stamp,
      dispatchedAt: ["Dispatched", "In transit", "Delivered pending confirmation", "Received"].includes(status) ? item.dispatchedAt || stamp : item.dispatchedAt,
      receivedAt: status === "Received" ? stamp : item.receivedAt,
      receivedBy: status === "Received" ? receiver : item.receivedBy
    }) }));
    onNotice(status === "Received" ? "Receipt confirmation saved. Post a separate stock receipt only when the actual stock transaction is verified." : "Dispatch status updated to " + status + ".");
  };

  return <section className="workspace-page ax-enterprise-page">
    <WorkspaceNotice notice={notice} onNotice={onNotice} />
    <WorkspaceHero eyebrow="OPERATIONS / LOGISTICS + HANDOVER" title="Transport & dispatch" description="Create partial or full shipments against actual PO component lines. Record challans, transporter, vehicle, tracking, freight and confirmed receipt without silently altering stock balances." onBack={onBack} onSelectModule={onSelectModule} actionLabel="Open inventory ledger" actionModule="inventory" icon="dispatch" />
    <div className="ax-enterprise-sync"><span className={syncStatus === "synced" ? "is-synced" : ""} /> {syncStatus === "synced" ? "Dispatch records sync with manufacturing data" : "Dispatches are stored with manufacturing data · " + (syncStatus === "error" ? "last sync reported an error" : "local/server status is shown here")}</div>
    <div className="ax-enterprise-stats">
      <StatCard label="OPEN DISPATCHES" value={pending} detail="Not yet receipt-confirmed" icon="truck" />
      <StatCard label="IN TRANSIT" value={inTransit} detail="Handed to the carrier" icon="activity" />
      <StatCard label="RECEIPT CONFIRMED" value={dispatches.filter(item => item.status === "Received").length} detail="Consignee confirmation entered" icon="check" />
      <StatCard label="RECORDED FREIGHT" value={money(freight)} detail="Freight entered on dispatch records" icon="rupee" />
    </div>
    <section className="surface-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> CONSIGNMENT REGISTER</div><h3>Dispatch records ({filtered.length})</h3><p>Each dispatch has its own challan/tracking reference and can represent a partial delivery.</p></div><button className="button-primary" onClick={() => { setDraft(emptyDispatchDraft()); setShowForm(value => !value); }}><Plus size={14} /> New dispatch</button></div>
      <div className="ax-enterprise-toolbar"><label className="module-record-search"><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search challan, PO, vehicle or tracking…" /></label></div>
      {filtered.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Challan / PO</th><th>Part / quantity</th><th>Carrier / vehicle</th><th>Pickup / due</th><th>Tracking</th><th>Freight</th><th>Status</th><th>Control</th></tr></thead><tbody>{filtered.map(row => {
        const po = orders.find(item => item.id === row.poId);
        const component = components.find(item => item.id === row.componentId);
        const next: DispatchStatus | undefined = row.status === "Packing" ? "Ready" : row.status === "Ready" ? "Dispatched" : row.status === "Dispatched" ? "In transit" : row.status === "In transit" ? "Delivered pending confirmation" : row.status === "Delivered pending confirmation" ? "Received" : undefined;
        return <tr key={row.id}><td><strong>{row.challanNumber}</strong><small>{po?.number || "PO archived"}</small></td><td><strong>{component?.partNumber || "Component archived"}</strong><small>{row.quantity.toLocaleString("en-IN")} pcs</small></td><td>{row.carrier || vendors.find(item => item.id === row.carrierVendorId)?.company || "Not entered"}<small>{row.vehicleNumber || "Vehicle not entered"}</small></td><td>{prettyDate(row.pickupDate)}<small>Due {prettyDate(row.expectedDelivery)}</small></td><td>{row.trackingReference || "Not entered"}</td><td>{money(row.freightCost)}</td><td><span className={"record-state " + (row.status === "Received" ? "state-complete" : row.status === "Exception" ? "state-hold" : "state-open")}>{row.status}</span>{row.receivedBy && <small>Received by {row.receivedBy}</small>}</td><td><div className="ax-enterprise-row-actions">{!["Received", "Cancelled"].includes(row.status) && <><select aria-label="Dispatch status" value={row.status} onChange={event => changeStatus(row, event.target.value as DispatchStatus)}>{dispatchStatuses.map(status => <option key={status}>{status}</option>)}</select>{next && <button className="button-primary compact-button" onClick={() => changeStatus(row, next)}>{next === "Received" ? "Confirm receipt" : next}</button>}</>}</div></td></tr>;
      })}</tbody></table></div> : <div className="module-empty-state"><Truck size={28} /><h3>No dispatch records</h3><p>Shipment records appear only after you create them from a saved purchase order component line. No placeholder consignments are preloaded.</p><button className="button-primary" disabled={!lines.length} onClick={() => setShowForm(true)}><Plus size={14} /> Create first dispatch</button></div>}
    </section>
    {showForm && <section className="surface-panel module-record-form-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> NEW CONSIGNMENT</div><h3>Dispatch details</h3><p>Select the real PO line. Remaining quantity is calculated from existing non-cancelled dispatches.</p></div><button className="icon-control" onClick={() => setShowForm(false)} aria-label="Close dispatch editor"><X size={15} /></button></div>
      <div className="module-record-form">
        <label className="module-form-wide">PO / component line *<select value={draft.poLineId} onChange={event => {
          const selected = lines.find(item => item.line.id === event.target.value);
          setDraft(current => ({ ...current, poId: selected?.po.id || "", poLineId: event.target.value, componentId: selected?.line.componentId || "", quantity: selected ? Math.min(current.quantity || selected.line.quantity, Math.max(0, selected.line.quantity - dispatches.filter(item => item.poLineId === selected.line.id && item.status !== "Cancelled").reduce((sum, item) => sum + item.quantity, 0))) : 0, expectedDelivery: selected?.line.targetDelivery || selected?.po.targetDelivery || "" }));
        }}><option value="">Select a PO line…</option>{lines.map(item => <option key={item.po.id + ":" + item.line.id} value={item.line.id}>{lineLabel(item.po, item.line, item.component)}</option>)}</select></label>
        <label>Dispatch quantity (pcs) *<input type="number" min="1" max={available} value={draft.quantity || ""} onChange={event => setDraft(current => ({ ...current, quantity: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label>Remaining PO quantity<input readOnly value={available.toLocaleString("en-IN") + " pcs"} /></label>
        <label>Delivery challan / shipment no. *<input value={draft.challanNumber} onChange={event => setDraft(current => ({ ...current, challanNumber: event.target.value }))} /></label>
        <label>Carrier / transporter name<input value={draft.carrier} onChange={event => setDraft(current => ({ ...current, carrier: event.target.value }))} placeholder="Transport company" /></label>
        <label>Transport vendor record<select value={draft.carrierVendorId} onChange={event => setDraft(current => ({ ...current, carrierVendorId: event.target.value }))}><option value="">Not linked</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.company}</option>)}</select></label>
        <label>Vehicle number<input value={draft.vehicleNumber} onChange={event => setDraft(current => ({ ...current, vehicleNumber: event.target.value.toUpperCase() }))} placeholder="KA 00 AB 0000" /></label>
        <label>LR / tracking reference<input value={draft.trackingReference} onChange={event => setDraft(current => ({ ...current, trackingReference: event.target.value }))} /></label>
        <label>Pickup date<input type="date" value={draft.pickupDate} onChange={event => setDraft(current => ({ ...current, pickupDate: event.target.value }))} /></label>
        <label>Expected delivery<input type="date" value={draft.expectedDelivery} onChange={event => setDraft(current => ({ ...current, expectedDelivery: event.target.value }))} /></label>
        <label>Freight cost (₹)<input type="number" min="0" step="0.01" value={draft.freightCost} onChange={event => setDraft(current => ({ ...current, freightCost: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label>Initial status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as DispatchStatus }))}>{dispatchStatuses.filter(status => status !== "Received" && status !== "Cancelled").map(status => <option key={status}>{status}</option>)}</select></label>
        <label className="module-form-wide">Dispatch notes<input value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Package count, weight, handover notes, documents…" /></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveDispatch}><Check size={14} /> Save dispatch</button><button className="button-quiet" onClick={() => setShowForm(false)}>Cancel</button></div>
      </div>
    </section>}
    <div className="module-safety-note"><ShieldCheck size={14} /><span>Dispatch quantities are checked against the PO line’s undispatched quantity. Dispatch confirmation and stock ledger movements are deliberately separate to avoid double-posting stock. Reconcile actual movement in Material & Inventory.</span></div>
  </section>;
}

type InvoiceDraft = Omit<InvoiceRecord, "id" | "createdAt" | "updatedAt">;
const emptyInvoiceDraft = (): InvoiceDraft => ({
  kind: "Payable", invoiceNumber: "", counterparty: "", companyId: "", factoryId: "", vendorId: "",
  poId: "", poLineId: "", componentId: "", invoiceDate: today(), dueDate: "", taxableAmount: 0,
  taxAmount: 0, currency: "INR", status: "Draft", notes: ""
});

export function InvoicePaymentWorkspace({ onBack, onNotice, notice, onSelectModule }: WorkspaceProps) {
  const { data, update, syncStatus } = useManufacturingData();
  const invoices = activeRows(data.invoices);
  const payments = activeRows(data.payments);
  const vendors = activeRows(data.vendors);
  const companies = activeRows(data.companies);
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [draft, setDraft] = useState(emptyInvoiceDraft);
  const [paymentFor, setPaymentFor] = useState("");
  const [paymentDraft, setPaymentDraft] = useState({ paymentDate: today(), amount: "", mode: "Bank transfer", reference: "", notes: "" });
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"All" | InvoiceKind>("All");

  const paidFor = (invoiceId: string) => payments.filter(payment => payment.invoiceId === invoiceId).reduce((sum, payment) => sum + payment.amount, 0);
  const gross = (invoice: InvoiceRecord) => invoice.taxableAmount + invoice.taxAmount;
  const due = (invoice: InvoiceRecord) => Math.max(0, gross(invoice) - paidFor(invoice.id));
  const approved = invoices.filter(invoice => invoice.status === "Approved");
  const payable = approved.filter(invoice => invoice.kind === "Payable");
  const receivable = approved.filter(invoice => invoice.kind === "Receivable");
  const openPayables = payable.reduce((sum, invoice) => sum + due(invoice), 0);
  const openReceivables = receivable.reduce((sum, invoice) => sum + due(invoice), 0);
  const overdue = approved.filter(invoice => invoice.dueDate && invoice.dueDate < today() && due(invoice) > 0);
  const filtered = invoices.filter(invoice => {
    const searchText = [invoice.invoiceNumber, invoice.counterparty, invoice.status, invoice.kind, orders.find(po => po.id === invoice.poId)?.number].join(" ").toLowerCase();
    return searchText.includes(query.toLowerCase().trim()) && (kindFilter === "All" || invoice.kind === kindFilter);
  }).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

  const saveInvoice = () => {
    if (!draft.invoiceNumber.trim() || !draft.counterparty.trim()) { onNotice("Invoice number and customer/supplier name are required."); return; }
    if (draft.taxableAmount <= 0 || draft.taxAmount < 0) { onNotice("Enter a positive taxable amount and a non-negative tax amount."); return; }
    if (!draft.invoiceDate) { onNotice("Enter the invoice date."); return; }
    if (draft.dueDate && draft.dueDate < draft.invoiceDate) { onNotice("Payment due date cannot be earlier than the invoice date."); return; }
    if (draft.kind === "Payable" && !draft.vendorId && !draft.counterparty.trim()) { onNotice("Link a supplier or enter its name."); return; }
    const stamp = nowIso();
    const invoice: InvoiceRecord = { ...draft, invoiceNumber: draft.invoiceNumber.trim(), counterparty: draft.counterparty.trim(), id: makeId("invoice"), createdAt: stamp, updatedAt: stamp };
    update(current => ({ ...current, invoices: [invoice, ...current.invoices] }));
    setDraft(emptyInvoiceDraft());
    setShowInvoiceForm(false);
    onNotice("Invoice record saved separately from supplier quotations. It is still a Draft until approved.");
  };
  const changeInvoiceStatus = (invoice: InvoiceRecord, status: InvoiceStatus) => {
    if (status === "Void" && paidFor(invoice.id) > 0) { onNotice("An invoice with posted payments cannot be voided. Record a reconciled adjustment outside this basic register."); return; }
    if (status === "Void" && !window.confirm("Void this invoice record? The record and its link history will be retained.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, invoices: current.invoices.map(item => item.id === invoice.id ? { ...item, status, updatedAt: stamp } : item) }));
    onNotice("Invoice " + invoice.invoiceNumber + " status changed to " + status + ".");
  };
  const openPayment = (invoice: InvoiceRecord) => {
    if (invoice.status !== "Approved") { onNotice("Approve the invoice before posting a payment."); return; }
    setPaymentFor(invoice.id);
    setPaymentDraft({ paymentDate: today(), amount: String(due(invoice)), mode: "Bank transfer", reference: "", notes: "" });
  };
  const savePayment = () => {
    const invoice = invoices.find(item => item.id === paymentFor);
    const amount = Number(paymentDraft.amount);
    if (!invoice) { onNotice("Select a valid invoice."); return; }
    if (invoice.status !== "Approved") { onNotice("Only an approved invoice can receive a payment posting."); return; }
    if (!Number.isFinite(amount) || amount <= 0) { onNotice("Enter a payment amount greater than zero."); return; }
    if (amount > due(invoice) + .005) { onNotice("Payment exceeds the remaining invoice balance of " + money(due(invoice)) + "."); return; }
    if (!paymentDraft.paymentDate || !paymentDraft.reference.trim()) { onNotice("Payment date and bank / UPI / cheque / cash reference are required for traceability."); return; }
    const stamp = nowIso();
    const payment: PaymentRecord = { id: makeId("payment"), invoiceId: invoice.id, paymentDate: paymentDraft.paymentDate, amount, mode: paymentDraft.mode, reference: paymentDraft.reference.trim(), notes: paymentDraft.notes, createdAt: stamp, updatedAt: stamp };
    update(current => ({ ...current, payments: [payment, ...current.payments] }));
    setPaymentFor("");
    onNotice("Payment posted to invoice " + invoice.invoiceNumber + ". Payment history is append-only in this workspace.");
  };
  const exportLedger = () => {
    const payload = { exportedAt: nowIso(), currency: "INR", invoices, payments: payments };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "aximach-invoice-payment-ledger.json"; link.click(); URL.revokeObjectURL(url);
    onNotice("Invoice and payment ledger exported as JSON.");
  };

  return <section className="workspace-page ax-enterprise-page">
    <WorkspaceNotice notice={notice} onNotice={onNotice} />
    <WorkspaceHero eyebrow="FINANCE / RECEIVABLES + PAYABLES + CASH CONTROL" title="Invoices, payments & cash flow" description="Maintain customer receivables, supplier payables and traceable payment entries. Supplier quotations stay separate from approved invoices and actual payment postings." onBack={onBack} onSelectModule={onSelectModule} actionLabel="Open job costing" actionModule="costing" icon="finance" />
    <div className="ax-enterprise-sync"><span className={syncStatus === "synced" ? "is-synced" : ""} /> {syncStatus === "synced" ? "Financial records synced with manufacturing data" : syncStatus === "error" ? "Server sync issue · local finance records retained" : syncStatus === "syncing" ? "Syncing finance records" : "Local finance ledger · configure the AXIMACH server for shared sync"}</div>
    <div className="ax-enterprise-stats">
      <StatCard label="OPEN PAYABLES" value={money(openPayables)} detail="Approved supplier invoices less posted payments" icon="rupee" />
      <StatCard label="OPEN RECEIVABLES" value={money(openReceivables)} detail="Approved customer invoices less receipts" icon="rupee" />
      <StatCard label="OVERDUE INVOICES" value={overdue.length} detail="Past due date with outstanding balance" icon="alert" />
      <StatCard label="PAYMENTS POSTED" value={payments.length} detail="Append-only payment entries" icon="check" />
    </div>
    <section className="surface-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> ACCOUNTS REGISTER</div><h3>Invoices ({filtered.length})</h3><p>Amount, tax, due date, approval status and payment balance are kept as separate, auditable values.</p></div><div className="ax-enterprise-row-actions"><button className="button-quiet compact-button" onClick={exportLedger}><FileText size={13} /> Export ledger</button><button className="button-primary" onClick={() => setShowInvoiceForm(value => !value)}><Plus size={14} /> Add invoice</button></div></div>
      <div className="ax-enterprise-toolbar"><label className="module-record-search"><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search invoice number, counterparty or PO…" /></label><select value={kindFilter} onChange={event => setKindFilter(event.target.value as "All" | InvoiceKind)}><option>All</option><option>Payable</option><option>Receivable</option></select></div>
      {filtered.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Invoice / counterparty</th><th>Type</th><th>Invoice / due date</th><th>Taxable value</th><th>Tax</th><th>Gross</th><th>Paid</th><th>Balance</th><th>Status</th><th>Action</th></tr></thead><tbody>{filtered.map(invoice => {
        const amountPaid = paidFor(invoice.id);
        const balance = due(invoice);
        const isOverdue = invoice.status === "Approved" && invoice.dueDate && invoice.dueDate < today() && balance > 0;
        const po = orders.find(item => item.id === invoice.poId);
        return <tr key={invoice.id}><td><strong>{invoice.invoiceNumber}</strong><small>{invoice.counterparty}{po ? " · " + po.number : ""}</small></td><td><span className={"record-state " + (invoice.kind === "Payable" ? "state-open" : "state-selected")}>{invoice.kind}</span></td><td>{prettyDate(invoice.invoiceDate)}<small>Due {prettyDate(invoice.dueDate)}</small></td><td>{money(invoice.taxableAmount)}</td><td>{money(invoice.taxAmount)}</td><td><strong>{money(gross(invoice))}</strong></td><td>{money(amountPaid)}</td><td><strong>{money(balance)}</strong>{isOverdue && <small className="ax-enterprise-overdue">Overdue</small>}</td><td><span className={"record-state " + (invoice.status === "Approved" ? "state-complete" : invoice.status === "Void" ? "state-hold" : "state-open")}>{invoice.status}</span>{balance === 0 && invoice.status === "Approved" && <small>Paid in full</small>}</td><td><div className="ax-enterprise-row-actions">{invoice.status === "Draft" && <button className="button-primary compact-button" onClick={() => changeInvoiceStatus(invoice, "Approved")}>Approve</button>}{invoice.status === "Approved" && balance > 0 && <button className="button-primary compact-button" onClick={() => openPayment(invoice)}>Post payment</button>}{invoice.status !== "Void" && invoice.status !== "On hold" && <button className="button-quiet compact-button" onClick={() => changeInvoiceStatus(invoice, "On hold")}>Hold</button>}{invoice.status === "On hold" && <button className="button-quiet compact-button" onClick={() => changeInvoiceStatus(invoice, "Approved")}>Resume</button>}{invoice.status !== "Void" && invoice.status !== "Approved" && balance === gross(invoice) && <button className="button-quiet compact-button" onClick={() => changeInvoiceStatus(invoice, "Void")}>Void</button>}</div></td></tr>;
      })}</tbody></table></div> : <div className="module-empty-state"><Receipt size={28} /><h3>No invoice records</h3><p>Invoice records are created from actual customer or supplier invoices. No quotation is converted into an invoice automatically.</p><button className="button-primary" onClick={() => setShowInvoiceForm(true)}><Plus size={14} /> Create first invoice</button></div>}
    </section>
    {showInvoiceForm && <section className="surface-panel module-record-form-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> NEW FINANCIAL DOCUMENT</div><h3>Invoice entry</h3><p>Save as Draft first. Approval is a separate action before payment posting.</p></div><button className="icon-control" onClick={() => setShowInvoiceForm(false)} aria-label="Close invoice editor"><X size={15} /></button></div>
      <div className="module-record-form">
        <label>Invoice type<select value={draft.kind} onChange={event => setDraft(current => ({ ...current, kind: event.target.value as InvoiceKind, vendorId: event.target.value === "Receivable" ? "" : current.vendorId }))}><option>Payable</option><option>Receivable</option></select></label>
        <label>Invoice number *<input value={draft.invoiceNumber} onChange={event => setDraft(current => ({ ...current, invoiceNumber: event.target.value }))} /></label>
        <label>Supplier record<select value={draft.vendorId} disabled={draft.kind === "Receivable"} onChange={event => setDraft(current => ({ ...current, vendorId: event.target.value, counterparty: vendors.find(vendor => vendor.id === event.target.value)?.company || current.counterparty }))}><option value="">Not linked</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.company}</option>)}</select></label>
        <label>Customer / supplier name *<input value={draft.counterparty} onChange={event => setDraft(current => ({ ...current, counterparty: event.target.value }))} placeholder="Actual invoice issuer / recipient" /></label>
        <label>Company<select value={draft.companyId} onChange={event => setDraft(current => ({ ...current, companyId: event.target.value, factoryId: "" }))}><option value="">Not linked</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Factory<select value={draft.factoryId} onChange={event => setDraft(current => ({ ...current, factoryId: event.target.value }))}><option value="">Not linked</option>{data.factories.filter(factory => !factory.deletedAt && (!draft.companyId || factory.companyId === draft.companyId)).map(factory => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></label>
        <label>Purchase order<select value={draft.poId} onChange={event => {
          const po = orders.find(item => item.id === event.target.value);
          setDraft(current => ({ ...current, poId: event.target.value, poLineId: "", componentId: "", companyId: po?.companyId || current.companyId, factoryId: po?.factoryId || current.factoryId }));
        }}><option value="">Not linked</option>{orders.map(po => <option key={po.id} value={po.id}>{po.number}</option>)}</select></label>
        <label>PO component line<select value={draft.poLineId} disabled={!draft.poId} onChange={event => {
          const po = orders.find(item => item.id === draft.poId);
          const line = po?.lines.find(item => item.id === event.target.value);
          setDraft(current => ({ ...current, poLineId: event.target.value, componentId: line?.componentId || "" }));
        }}><option value="">Not linked</option>{orders.find(po => po.id === draft.poId)?.lines.filter(line => !line.deletedAt).map(line => {
          const part = components.find(component => component.id === line.componentId);
          return <option key={line.id} value={line.id}>{part?.partNumber || "Part"} · {line.quantity.toLocaleString("en-IN")} pcs</option>;
        })}</select></label>
        <label>Invoice date<input type="date" value={draft.invoiceDate} onChange={event => setDraft(current => ({ ...current, invoiceDate: event.target.value }))} /></label>
        <label>Payment due date<input type="date" value={draft.dueDate} onChange={event => setDraft(current => ({ ...current, dueDate: event.target.value }))} /></label>
        <label>Taxable amount (₹) *<input type="number" min="0" step="0.01" value={draft.taxableAmount || ""} onChange={event => setDraft(current => ({ ...current, taxableAmount: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label>Tax amount (₹)<input type="number" min="0" step="0.01" value={draft.taxAmount || ""} onChange={event => setDraft(current => ({ ...current, taxAmount: Math.max(0, Number(event.target.value) || 0) }))} /></label>
        <label>Gross invoice value (₹)<input readOnly value={money(draft.taxableAmount + draft.taxAmount)} /></label>
        <label className="module-form-wide">Invoice notes / terms<input value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Payment terms, GST reference, credit note explanation…" /></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveInvoice}><Check size={14} /> Save draft invoice</button><button className="button-quiet" onClick={() => setShowInvoiceForm(false)}>Cancel</button></div>
      </div>
    </section>}
    <section className="surface-panel ax-enterprise-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> CASH MOVEMENT / PAYMENT TRACE</div><h3>Payment history ({payments.length})</h3><p>Every entry references an invoice and has a payment date, method and external reference.</p></div></div>
      {payments.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Payment date</th><th>Invoice</th><th>Counterparty</th><th>Direction</th><th>Mode</th><th>Reference</th><th>Amount</th></tr></thead><tbody>{payments.map(payment => {
        const invoice = invoices.find(item => item.id === payment.invoiceId);
        return <tr key={payment.id}><td>{prettyDate(payment.paymentDate)}</td><td><strong>{invoice?.invoiceNumber || "Invoice archived"}</strong></td><td>{invoice?.counterparty || "—"}</td><td>{invoice?.kind === "Receivable" ? "Received" : "Paid"}</td><td>{payment.mode}</td><td>{payment.reference}</td><td><strong>{money(payment.amount)}</strong></td></tr>;
      })}</tbody></table></div> : <div className="vendor-empty">No payments have been posted.</div>}
    </section>
    {paymentFor && <div className="overlay-shell" onMouseDown={event => { if (event.target === event.currentTarget) setPaymentFor(""); }}><section className="new-job-modal ax-enterprise-editor">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark" /> PAYMENT POSTING</div><h3>{invoices.find(item => item.id === paymentFor)?.invoiceNumber}</h3><p>Outstanding balance: {money(due(invoices.find(item => item.id === paymentFor)!))}</p></div><button className="icon-control" onClick={() => setPaymentFor("")} aria-label="Close payment editor"><X size={15} /></button></div>
      <div className="module-record-form">
        <label>Payment date<input type="date" value={paymentDraft.paymentDate} onChange={event => setPaymentDraft(current => ({ ...current, paymentDate: event.target.value }))} /></label>
        <label>Amount (₹)<input type="number" min="0.01" max={due(invoices.find(item => item.id === paymentFor)!)} step="0.01" value={paymentDraft.amount} onChange={event => setPaymentDraft(current => ({ ...current, amount: event.target.value }))} /></label>
        <label>Payment mode<select value={paymentDraft.mode} onChange={event => setPaymentDraft(current => ({ ...current, mode: event.target.value }))}><option>Bank transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option><option>Card</option><option>Other</option></select></label>
        <label>UTR / cheque / receipt reference *<input value={paymentDraft.reference} onChange={event => setPaymentDraft(current => ({ ...current, reference: event.target.value }))} /></label>
        <label className="module-form-wide">Notes<input value={paymentDraft.notes} onChange={event => setPaymentDraft(current => ({ ...current, notes: event.target.value }))} /></label>
        <div className="module-form-actions"><button className="button-primary" onClick={savePayment}><Check size={14} /> Post payment</button><button className="button-quiet" onClick={() => setPaymentFor("")}>Cancel</button></div>
      </div>
    </section></div>}
    <div className="module-safety-note"><ShieldCheck size={14} /><span>This is a linked operational invoice/payment register, not a statutory accounting, GST return or bank reconciliation system. Payments are append-only here; reconcile bank statements and approved credit/debit notes in your accounting system. No amounts are generated from supplier quotes or guessed.</span></div>
  </section>;
}
