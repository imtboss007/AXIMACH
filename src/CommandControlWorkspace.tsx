import { Activity, AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardCheck, Package, ShieldAlert, ShieldCheck, Truck, Workflow } from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";

type Props = { onBack: () => void; onSelectModule: (id: string) => void };
const dayKey = (value: string) => value ? value.slice(0,10) : "";
const todayKey = () => new Date().toISOString().slice(0,10);
const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0,10);
};

export default function CommandControlWorkspace({ onBack, onSelectModule }: Props) {
  const { data, syncStatus } = useManufacturingData();
  const today = todayKey();
  const nextWeek = addDays(7);
  const companies = activeRows(data.companies);
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const operations = activeRows(data.operations);
  const vendors = activeRows(data.vendors);
  const inspections = activeRows(data.qualityInspections);
  const transfers = activeRows(data.wipTransfers);
  const dispatches = activeRows(data.customerDispatches);

  const overdue = operations.filter(op => op.status !== "Complete" && !!op.plannedEnd && dayKey(op.plannedEnd) < today);
  const unpaid = operations.filter(op => !!op.vendorId && (op.vendorPaymentStatus || "Not Paid") !== "Paid");
  const qualityHolds = operations.filter(op => op.status === "Quality hold");
  const pendingInspections = inspections.filter(row => row.status === "Pending" || row.status === "Hold" || row.status === "Conditional");
  const upcoming = orders.flatMap(po => po.lines
    .filter(line => !("deletedAt" in line && (line as typeof line & { deletedAt?: string }).deletedAt))
    .map(line => ({
      po,
      line,
      component: components.find(component => component.id === line.componentId),
      due: dayKey(line.targetDelivery || po.targetDelivery)
    }))
  ).filter(row => !!row.due && row.due >= today && row.due <= nextWeek).sort((a,b) => a.due.localeCompare(b.due));
  const activeTransfers = transfers.filter(row => row.status === "In transit" || row.status === "Partially received");
  const activeDispatches = dispatches.filter(row => row.status === "In transit" || row.status === "Partially delivered");
  const syncLabel = syncStatus === "synced" ? "Shared server connected"
    : syncStatus === "syncing" ? "Syncing saved records"
    : syncStatus === "error" ? "Sync error · local data retained" : "Local records only";

  return <section className="workspace-page module-functional-page">
    <div className="workspace-topline">
      <button className="back-link" onClick={onBack}><ArrowRight size={15}/> Dashboard</button>
      <span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncLabel.toUpperCase()}</span>
    </div>
    <div className="workspace-title-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / CONTROL & EXCEPTIONS</div>
        <h1>Command Centre<span>.</span></h1>
        <p>Live priorities derived only from saved AXIMACH company, order, operation, inspection, payment and movement records.</p>
      </div>
      <div className="workspace-title-actions">
        <button className="button-quiet" onClick={() => onSelectModule("reports")}>Reports & Analytics</button>
        <button className="button-primary" onClick={() => onSelectModule("production")}><Workflow size={15}/> Production Planning</button>
      </div>
    </div>

    <section className="metric-grid">
      <article className="metric-card">
        <div className="metric-card-top"><span>Open operations</span><span className="metric-icon blue"><Activity size={17}/></span></div>
        <strong className="metric-number">{operations.filter(op => op.status !== "Complete").length}</strong>
        <div className="metric-card-bottom"><span>Saved routes</span><span>Production</span></div>
      </article>
      <article className="metric-card">
        <div className="metric-card-top"><span>Overdue operations</span><span className="metric-icon amber"><AlertTriangle size={17}/></span></div>
        <strong className="metric-number">{overdue.length}</strong>
        <div className="metric-card-bottom"><span>Target date passed</span><span>Not complete</span></div>
      </article>
      <article className="metric-card">
        <div className="metric-card-top"><span>Unpaid vendor operations</span><span className="metric-icon violet"><CircleDollarSign size={17}/></span></div>
        <strong className="metric-number">{unpaid.length}</strong>
        <div className="metric-card-bottom"><span>Paid / Not Paid</span><span>Process Map</span></div>
      </article>
      <article className="metric-card">
        <div className="metric-card-top"><span>Quality holds</span><span className="metric-icon green"><ShieldAlert size={17}/></span></div>
        <strong className="metric-number">{qualityHolds.length}</strong>
        <div className="metric-card-bottom"><span>Operation status</span><span>Quality</span></div>
      </article>
    </section>

    <div className="dashboard-grid actual-data-dashboard">
      <section className="surface-panel attention-panel">
        <div className="panel-heading"><div><div className="eyebrow">EXCEPTION QUEUE</div><h3>Overdue operations ({overdue.length})</h3><p>Saved planned target dates compared with today.</p></div><AlertTriangle size={18}/></div>
        {overdue.length ? overdue.slice(0,8).map(operation => <button className="attention-row" key={operation.id} onClick={() => onSelectModule("production")}>
          <span className="attention-symbol red-symbol"><AlertTriangle size={16}/></span>
          <span className="attention-copy"><strong>{operation.name}</strong><small>{data.purchaseOrders.find(po => po.id === operation.poId)?.number || "PO"} · {components.find(component => component.id === operation.componentId)?.partNumber || "Component"} · Due {operation.plannedEnd}</small><em>Open Production Planning / Process Map</em></span>
          <ArrowRight size={15}/>
        </button>) : <div className="vendor-empty"><CheckCircle2 size={17}/> No overdue operations are recorded.</div>}
      </section>

      <section className="surface-panel attention-panel">
        <div className="panel-heading"><div><div className="eyebrow">PAYMENT QUEUE</div><h3>Vendor payments to review ({unpaid.length})</h3><p>Payment status is read from Process Map; no payment is initiated here.</p></div><CircleDollarSign size={18}/></div>
        {unpaid.length ? unpaid.slice(0,8).map(operation => <button className="attention-row" key={operation.id} onClick={() => onSelectModule("production")}>
          <span className="attention-symbol"><CircleDollarSign size={16}/></span>
          <span className="attention-copy"><strong>{vendors.find(vendor => vendor.id === operation.vendorId)?.company || "Vendor unavailable"} · {operation.name}</strong><small>{data.purchaseOrders.find(po => po.id === operation.poId)?.number || "PO"} · {operation.vendorPaymentStatus || "Not Paid"}</small><em>Open Process Map to update the source status</em></span>
          <ArrowRight size={15}/>
        </button>) : <div className="vendor-empty"><CheckCircle2 size={17}/> No unpaid vendor-assigned operations are recorded.</div>}
      </section>

      <section className="surface-panel attention-panel">
        <div className="panel-heading"><div><div className="eyebrow">QUALITY QUEUE</div><h3>Quality actions ({qualityHolds.length + pendingInspections.length})</h3><p>Inspection statuses do not silently change production quantities.</p></div><ClipboardCheck size={18}/></div>
        {qualityHolds.length + pendingInspections.length ? <>
          <p className="module-number">{qualityHolds.length} operation hold(s) · {pendingInspections.length} pending / held inspection(s)</p>
          <button className="button-primary compact-button" onClick={() => onSelectModule("quality")}>Open Quality & Inspection <ArrowRight size={14}/></button>
        </> : <div className="vendor-empty"><CheckCircle2 size={17}/> No quality holds or pending/held inspections are recorded.</div>}
      </section>

      <section className="surface-panel attention-panel">
        <div className="panel-heading"><div><div className="eyebrow">DELIVERY WINDOW</div><h3>Due in the next 7 days ({upcoming.length})</h3><p>PO component line dates from saved orders.</p></div><CalendarClock size={18}/></div>
        {upcoming.length ? upcoming.slice(0,8).map(row => <button className="attention-row" key={row.po.id + ":" + row.line.id} onClick={() => onSelectModule("production")}>
          <span className="attention-symbol"><Package size={16}/></span>
          <span className="attention-copy"><strong>{row.po.number} · {row.component?.partNumber || "Component"}</strong><small>{row.line.quantity.toLocaleString("en-IN")} pcs · {row.due}</small><em>Open Production Planning</em></span>
          <ArrowRight size={15}/>
        </button>) : <div className="vendor-empty">No PO component lines have a delivery date in the next 7 days.</div>}
      </section>

      <section className="surface-panel attention-panel">
        <div className="panel-heading"><div><div className="eyebrow">CUSTODY / SHIPMENTS</div><h3>Movements in transit ({activeTransfers.length + activeDispatches.length})</h3><p>WIP and customer shipments awaiting recorded receipt.</p></div><Truck size={18}/></div>
        <div className="movement-facts"><div><small>WIP IN TRANSIT</small><strong>{activeTransfers.length}</strong></div><div><small>CUSTOMER SHIPMENTS</small><strong>{activeDispatches.length}</strong></div></div>
        <button className="button-quiet compact-button" onClick={() => onSelectModule("dispatch")}>Open Dispatch & Delivery <ArrowRight size={14}/></button>
      </section>

      <section className="surface-panel attention-panel">
        <div className="panel-heading"><div><div className="eyebrow">LIVE DATA COVERAGE</div><h3>Connected master records</h3><p>Counts reflect active saved records; empty values are not backfilled.</p></div><ShieldCheck size={18}/></div>
        <div className="movement-facts"><div><small>COMPANIES</small><strong>{companies.length}</strong></div><div><small>ORDERS</small><strong>{orders.length}</strong></div><div><small>COMPONENTS</small><strong>{components.length}</strong></div><div><small>VENDORS</small><strong>{vendors.length}</strong></div></div>
        <button className="button-quiet compact-button" onClick={() => onSelectModule("companies")}>Open master records <ArrowRight size={14}/></button>
      </section>
    </div>

    <section className="surface-panel module-safety-note"><ShieldCheck size={16}/><span>Command Centre uses deterministic checks over saved records. It does not claim predictive accuracy, does not execute actions, and does not replace an AI inference service or a human approval.</span></section>
  </section>;
}
