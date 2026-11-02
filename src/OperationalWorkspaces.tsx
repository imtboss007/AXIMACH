import { useMemo, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck,
  FileText, Plus, Search, Truck, Wallet, X
} from "lucide-react";
import { ProcessIcon } from "./IconStudio";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type InvoiceRecord, type PaymentRecord, type LifecycleStatus, type OperationRecord
} from "./manufacturingData";

type Props = {
  moduleId: "production" | "dispatch" | "invoices";
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  onSelectModule: (id: string) => void;
};

const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dateValue = (value: string) => value ? value.slice(0, 10) : "";
const operationStatuses: LifecycleStatus[] = ["Queued", "Running", "Complete", "Quality hold"];
const dispatchStatuses = ["Awaiting pickup", "Collected", "In transit", "Delivered", "Exception"] as const;

type InvoiceDraft = {
  direction: "Payable" | "Receivable";
  number: string;
  counterpartyType: "vendor" | "company" | "other";
  counterpartyId: string;
  counterpartyName: string;
  poId: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  status: "Draft" | "Approved" | "Disputed";
  notes: string;
};

const blankInvoice = (): InvoiceDraft => ({
  direction: "Payable", number: "", counterpartyType: "vendor", counterpartyId: "", counterpartyName: "",
  poId: "", invoiceDate: new Date().toISOString().slice(0, 10),
  dueDate: "", subtotal: "", taxAmount: "0", status: "Draft", notes: ""
});

function statusClass(value: string) {
  const name = value.toLowerCase().replace(/[^a-z]+/g, "-");
  return "ow-status ow-status-" + name;
}

export default function OperationalWorkspaces({ moduleId, onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const [search, setSearch] = useState("");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>(blankInvoice());
  const [paymentFor, setPaymentFor] = useState("");
  const [paymentDraft, setPaymentDraft] = useState({ date: new Date().toISOString().slice(0, 10), amount: "", reference: "", method: "Bank transfer", notes: "" });

  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const companies = activeRows(data.companies);
  const operations = activeRows(data.operations);
  const jobRows = useMemo(() => orders.flatMap(po => activeRows(po.lines || []).map(line => ({
    po, line,
    component: components.find(item => item.id === line.componentId),
    company: companies.find(item => item.id === po.companyId),
    operations: operations.filter(item => item.poId === po.id && item.poLineId === line.id)
  }))), [orders, components, companies, operations]);

  const machineConflicts = useMemo(() => {
    const planned = operations.filter(op => op.status !== "Complete" && op.machine.trim() && op.plannedStart && op.plannedEnd);
    const conflicts: Array<{ first: OperationRecord; second: OperationRecord }> = [];
    for (let i = 0; i < planned.length; i += 1) {
      for (let j = i + 1; j < planned.length; j += 1) {
        const first = planned[i];
        const second = planned[j];
        if (first.machine.trim().toLowerCase() !== second.machine.trim().toLowerCase()) continue;
        const startA = Date.parse(first.plannedStart);
        const endA = Date.parse(first.plannedEnd);
        const startB = Date.parse(second.plannedStart);
        const endB = Date.parse(second.plannedEnd);
        if ([startA, endA, startB, endB].every(Number.isFinite) && startA <= endB && startB <= endA) {
          conflicts.push({ first, second });
        }
      }
    }
    return conflicts;
  }, [operations]);

  const updateProductionJob = (poId: string, lineId: string, finished: boolean) => {
    const stamp = nowIso();
    const po = data.purchaseOrders.find(item => item.id === poId);
    const line = po?.lines.find(item => item.id === lineId);
    if (!po || !line) return;
    const incomplete = operations.filter(operation => operation.poId === poId && operation.poLineId === lineId && operation.status !== "Complete");
    if (finished && incomplete.length && !window.confirm(incomplete.length + " route operation(s) are not marked Complete. Mark the job Finished anyway? Operation statuses and history will remain unchanged.")) return;
    update(current => ({
      ...current,
      purchaseOrders: current.purchaseOrders.map(order => order.id !== poId ? order : {
        ...order, updatedAt: stamp,
        lines: order.lines.map(item => item.id !== lineId ? item : {
          ...item, jobStatus: finished ? "Finished" : "In progress", jobFinishedAt: finished ? stamp : undefined
        })
      })
    }));
    onNotice(finished
      ? "PO-line job marked Finished. Operation status and quantity history were not changed."
      : "PO-line job reopened as In progress. Existing operation history was retained.");
  };

  const updateOperation = (id: string, patch: Partial<OperationRecord>) => {
    const stamp = nowIso();
    update(current => ({
      ...current,
      operations: current.operations.map(operation => operation.id === id ? { ...operation, ...patch, updatedAt: stamp } : operation)
    }));
  };

  const dispatchRows = operations.filter(op =>
    op.transportVendorId || op.transportCost > 0 || op.transportPickup || op.transportDelivery || op.dispatchStatus || op.dispatchReference
  ).filter(op => {
    const component = components.find(item => item.id === op.componentId);
    const po = orders.find(item => item.id === op.poId);
    const text = [op.name, op.machine, op.dispatchReference, op.dispatchNotes, component?.partNumber, component?.name, po?.number].join(" ").toLowerCase();
    return text.includes(search.toLowerCase().trim());
  });

  const invoices = activeRows(data.invoices || []);
  const payments = activeRows(data.payments || []);
  const invoiceTotal = invoices.filter(row => row.status !== "Void").reduce((sum, row) => sum + row.totalAmount, 0);
  const paidTotal = payments.reduce((sum, row) => sum + row.amount, 0);
  const balanceTotal = invoices.filter(row => row.status !== "Void").reduce((sum, row) => {
    const paid = payments.filter(payment => payment.invoiceId === row.id).reduce((value, payment) => value + payment.amount, 0);
    return sum + Math.max(0, row.totalAmount - paid);
  }, 0);

  const saveInvoice = () => {
    const subtotal = Number(invoiceDraft.subtotal);
    const taxAmount = Number(invoiceDraft.taxAmount || 0);
    if (!invoiceDraft.number.trim() || (invoiceDraft.counterpartyType === "other" ? !invoiceDraft.counterpartyName.trim() : !invoiceDraft.counterpartyId) || !Number.isFinite(subtotal) || subtotal <= 0 ||
      !Number.isFinite(taxAmount) || taxAmount < 0 || !invoiceDraft.invoiceDate) {
      onNotice("Enter an invoice number, counterparty, valid invoice date and positive subtotal before saving.");
      return;
    }
    if (invoiceDraft.dueDate && invoiceDraft.dueDate < invoiceDraft.invoiceDate) {
      onNotice("The due date cannot be earlier than the invoice date.");
      return;
    }
    const row: InvoiceRecord = {
      id: makeId("inv"), direction: invoiceDraft.direction, number: invoiceDraft.number.trim(),
      counterpartyType: invoiceDraft.counterpartyType, counterpartyId: invoiceDraft.counterpartyId,
      counterpartyName: invoiceDraft.counterpartyType === "other" ? invoiceDraft.counterpartyName.trim() : invoiceDraft.counterpartyType === "vendor" ? (vendors.find(item => item.id === invoiceDraft.counterpartyId)?.company || "") : (companies.find(item => item.id === invoiceDraft.counterpartyId)?.name || ""),
      poId: invoiceDraft.poId, invoiceDate: invoiceDraft.invoiceDate, dueDate: invoiceDraft.dueDate,
      subtotalAmount: subtotal, taxAmount, totalAmount: subtotal + taxAmount,
      status: invoiceDraft.status, notes: invoiceDraft.notes.trim(), createdAt: nowIso(), updatedAt: nowIso()
    };
    update(current => ({ ...current, invoices: [...(current.invoices || []), row] }));
    setInvoiceDraft(blankInvoice());
    setShowInvoiceForm(false);
    onNotice("Invoice saved to the AXIMACH financial ledger. Payment status will be calculated from recorded payment entries.");
  };

  const savePayment = (invoice: InvoiceRecord) => {
    const amount = Number(paymentDraft.amount);
    const alreadyPaid = payments.filter(row => row.invoiceId === invoice.id).reduce((sum, row) => sum + row.amount, 0);
    const outstanding = Math.max(0, invoice.totalAmount - alreadyPaid);
    if (!Number.isFinite(amount) || amount <= 0 || amount > outstanding + 0.00001 || !paymentDraft.date || !paymentDraft.reference.trim()) {
      onNotice("Enter a valid payment amount and reference. A payment cannot exceed the invoice's outstanding balance.");
      return;
    }
    const payment: PaymentRecord = {
      id: makeId("pay"), invoiceId: invoice.id, paymentDate: paymentDraft.date,
      amount, reference: paymentDraft.reference.trim(), method: paymentDraft.method,
      notes: paymentDraft.notes.trim(), createdAt: nowIso(), updatedAt: nowIso()
    };
    update(current => ({ ...current, payments: [...(current.payments || []), payment] }));
    setPaymentDraft({ date: new Date().toISOString().slice(0, 10), amount: "", reference: "", method: "Bank transfer", notes: "" });
    setPaymentFor("");
    onNotice("Payment entry saved. The invoice balance has been recalculated from the payment ledger.");
  };

  const title = moduleId === "production" ? "Production Planning & Capacity"
    : moduleId === "dispatch" ? "Transport & Dispatch Control" : "Invoices, Payments & Cash Flow";
  const description = moduleId === "production"
    ? "Schedule the existing purchase-order operations against machine resources, review overlaps and record execution status."
    : moduleId === "dispatch"
      ? "Control transport assignments, pickup and delivery commitments, shipment references and delivery exceptions."
      : "Maintain payable and receivable invoices, apply payment entries and review outstanding balances linked to existing AXIMACH counterparties.";

  return (
    <section className={"workspace-page operational-workspace operational-" + moduleId}>
      <div className="workspace-topline">
        <button className="back-link" onClick={onBack}><ArrowRight size={15} /> Command centre</button>
        <span className="demo-pill"><i /> {syncStatus === "synced" ? "SERVER SYNCED" : syncStatus === "error" ? "SYNC ERROR" : "LIVE DATA"}</span>
      </div>
      <div className="module-hero">
        <div className="module-hero-icon animated-module-icon">
          {moduleId === "production" ? <Activity size={27}/> : moduleId === "dispatch" ? <Truck size={27}/> : <Wallet size={27}/>}
        </div>
        <div className="module-hero-copy">
          <div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / AXIMACH WORKSPACE</div>
          <h1>{title}<span>.</span></h1>
          <p>{description}</p>
        </div>
        {moduleId === "production" && <button className="button-primary" onClick={() => onSelectModule("process-map")}><ClipboardCheck size={15}/> Open process planner</button>}
      </div>
      {notice && <div className="notice-banner">{notice}</div>}

      {moduleId === "production" && <>
        <div className="ow-kpis">
          <div className="ow-kpi"><span>PO-line jobs</span><strong>{jobRows.length}</strong><small>Existing purchase-order lines</small></div>
          <div className="ow-kpi"><span>Scheduled operations</span><strong>{operations.filter(op => op.status !== "Complete" && op.plannedStart).length}</strong><small>Not marked complete</small></div>
          <div className="ow-kpi"><span>Machine overlaps</span><strong className={machineConflicts.length ? "ow-warning-number" : ""}>{machineConflicts.length}</strong><small>Same machine and overlapping dates</small></div>
          <div className="ow-kpi"><span>Jobs finished</span><strong>{jobRows.filter(row => row.line.jobStatus === "Finished").length}</strong><small>Separate from operation completion</small></div>
        </div>
        <div className="ow-panel">
          <div className="ow-panel-heading"><div><div className="eyebrow">FINITE-RESOURCE REVIEW</div><h3>Machine schedule & operation register</h3><p>Uses actual process operations and PO-line links; no synthetic capacity figures are generated.</p></div><span className="ow-pill"><CalendarDays size={13}/> {machineConflicts.length ? "Review conflicts" : "No detected overlaps"}</span></div>
          {machineConflicts.length > 0 && <div className="ow-alert"><AlertTriangle size={17}/><div><strong>{machineConflicts.length} machine schedule overlap(s) detected</strong><small>Review the matching machine and planned date ranges below before releasing work.</small></div></div>}
          <div className="ow-job-table-heading"><h4><CheckCircle2 size={14}/> PO-line job close-out</h4><small>Job Finished is independent of each route operation's Complete status.</small></div>
          <div className="ow-table-wrap"><table className="ow-table ow-job-table"><thead><tr><th>Purchase order</th><th>Component</th><th>Quantity</th><th>Route steps</th><th>Job state</th><th>Close-out action</th></tr></thead><tbody>
            {jobRows.map(({ po, line, component, operations: lineOperations }) => {
              const finished = line.jobStatus === "Finished";
              return <tr key={po.id + ":" + line.id}>
                <td><strong>{po.number}</strong><small>{po.targetDelivery || "No PO target"}</small></td>
                <td><strong>{component?.partNumber || "Component not linked"}</strong><small>{component?.name || "PO line retained"}</small></td>
                <td>{line.quantity.toLocaleString("en-IN")} pcs</td>
                <td>{lineOperations.length} operations</td>
                <td><span className={statusClass(finished ? "Job Finished" : "In Progress")}>{finished ? "Job Finished" : "In Progress"}</span></td>
                <td><button className={finished ? "button-quiet compact-button" : "button-primary compact-button"} onClick={() => updateProductionJob(po.id, line.id, !finished)}>
                  <ProcessIcon processName="Finished Job" fallback={<CheckCircle2 size={13}/>} /> {finished ? "Reopen job" : "Mark finished"}
                </button></td>
              </tr>;
            })}
          </tbody></table></div>
          <div className="ow-table-heading"><h4><CalendarDays size={14}/> Machine schedule & operation register</h4></div>
          <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>PO / part</th><th>Operation</th><th>Machine / cell</th><th>Planned start</th><th>Planned end</th><th>Status</th><th>Actual good / reject</th></tr></thead><tbody>
            {jobRows.flatMap(row => row.operations.map(op => ({ ...row, op }))).map(({ po, line, component, company, op }) => (
              <tr key={op.id}>
                <td><strong>{po.number}</strong><small>{component?.partNumber || "Component not linked"} · {company?.name || "Company"}</small></td>
                <td><strong>{op.sequence}. {op.name}</strong><small>{line.quantity.toLocaleString("en-IN")} pcs ordered</small></td>
                <td><input className="ow-inline-input" aria-label={"Machine for " + op.name} value={op.machine} placeholder="Assign machine" onChange={event => updateOperation(op.id, { machine: event.target.value })}/></td>
                <td><input className="ow-inline-input" type="date" aria-label={"Planned start for " + op.name} value={dateValue(op.plannedStart)} onChange={event => updateOperation(op.id, { plannedStart: event.target.value })}/></td>
                <td><input className="ow-inline-input" type="date" aria-label={"Planned end for " + op.name} value={dateValue(op.plannedEnd)} onChange={event => updateOperation(op.id, { plannedEnd: event.target.value })}/></td>
                <td><select className="ow-inline-input" aria-label={"Status for " + op.name} value={op.status} onChange={event => updateOperation(op.id, { status: event.target.value as LifecycleStatus })}>{operationStatuses.map(value => <option key={value}>{value}</option>)}</select></td>
                <td>{op.accepted.toLocaleString("en-IN")} / {op.rejected.toLocaleString("en-IN")}</td>
              </tr>
            ))}
          </tbody></table></div>
          {!operations.length && <div className="module-empty-state"><Activity size={25}/><h3>No process operations yet</h3><p>Start from a purchase order and create the route operations in Process Map. This planner will read the same linked records.</p><button className="button-primary" onClick={() => onSelectModule("process-map")}>Open Process Map</button></div>}
          {jobRows.length > 0 && operations.length === 0 && <p className="ow-empty-hint">Purchase-order jobs exist, but routes have not yet been created. PO-line records are preserved.</p>}
          <div className="ow-footnote">Planning limitation: current operation records contain planned dates and machine names, but not validated shift calendars, standard cycle times or available machine-hour capacity. This view detects date overlaps; it does not claim full finite-capacity optimisation.</div>
        </div>
      </>}

      {moduleId === "dispatch" && <>
        <div className="ow-kpis">
          <div className="ow-kpi"><span>Transport-linked operations</span><strong>{dispatchRows.length}</strong><small>Existing route operation records</small></div>
          <div className="ow-kpi"><span>In transit</span><strong>{dispatchRows.filter(op => op.dispatchStatus === "In transit").length}</strong><small>Shipment status</small></div>
          <div className="ow-kpi"><span>Delivered</span><strong>{dispatchRows.filter(op => op.dispatchStatus === "Delivered").length}</strong><small>Marked delivered</small></div>
          <div className="ow-kpi"><span>Transport cost</span><strong>{money(dispatchRows.reduce((sum, op) => sum + (Number(op.transportCost) || 0), 0))}</strong><small>From linked process operations</small></div>
        </div>
        <div className="ow-panel">
          <div className="ow-panel-heading"><div><div className="eyebrow">LOGISTICS / OUTSIDE PROCESS MOVEMENT</div><h3>Transport register</h3><p>Each dispatch entry remains connected to its source PO line, component and process operation.</p></div><label className="ow-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search PO, part or shipment"/></label></div>
          <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>PO / component</th><th>Route operation</th><th>Carrier</th><th>Pickup</th><th>Delivery target</th><th>Dispatch status</th><th>Reference / cost</th></tr></thead><tbody>
            {dispatchRows.map(op => {
              const vendor = vendors.find(item => item.id === op.transportVendorId);
              const po = orders.find(item => item.id === op.poId);
              const component = components.find(item => item.id === op.componentId);
              return <tr key={op.id}>
                <td><strong>{po?.number || "PO not linked"}</strong><small>{component?.partNumber || component?.name || "Component not linked"}</small></td>
                <td><strong>{op.name}</strong><small>{op.machine}</small></td>
                <td><select className="ow-inline-input" aria-label={"Transport vendor for " + op.name} value={op.transportVendorId} onChange={event => updateOperation(op.id, { transportVendorId: event.target.value })}><option value="">Select carrier</option>{vendors.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></td>
                <td><input className="ow-inline-input" type="date" value={dateValue(op.transportPickup)} aria-label={"Pickup date for " + op.name} onChange={event => updateOperation(op.id, { transportPickup: event.target.value })}/></td>
                <td><input className="ow-inline-input" type="date" value={dateValue(op.transportDelivery)} aria-label={"Delivery date for " + op.name} onChange={event => updateOperation(op.id, { transportDelivery: event.target.value })}/></td>
                <td><select className="ow-inline-input" value={op.dispatchStatus || "Awaiting pickup"} aria-label={"Dispatch status for " + op.name} onChange={event => updateOperation(op.id, { dispatchStatus: event.target.value as typeof dispatchStatuses[number] })}>{dispatchStatuses.map(value => <option key={value}>{value}</option>)}</select></td>
                <td><input className="ow-inline-input" value={op.dispatchReference || ""} placeholder="Challan / LR no." aria-label={"Shipment reference for " + op.name} onChange={event => updateOperation(op.id, { dispatchReference: event.target.value })}/><small>{money(op.transportCost)} · {vendor?.company || "No carrier"}</small></td>
              </tr>;
            })}
          </tbody></table></div>
          {dispatchRows.length === 0 && <div className="module-empty-state"><Truck size={25}/><h3>No transport records found</h3><p>Transport assignments are created on process operations. Open Process Map, add a transport operation, and assign a carrier and movement dates.</p><button className="button-primary" onClick={() => onSelectModule("process-map")}>Open Process Map</button></div>}
          <div className="ow-footnote">Shipment status and reference fields are additive to existing transport vendor, pickup, delivery and cost data. Existing route operation records are not replaced.</div>
        </div>
      </>}

      {moduleId === "invoices" && <>
        <div className="ow-kpis">
          <div className="ow-kpi"><span>Invoices</span><strong>{invoices.length}</strong><small>Payable and receivable</small></div>
          <div className="ow-kpi"><span>Invoice value</span><strong>{money(invoiceTotal)}</strong><small>Excludes void entries</small></div>
          <div className="ow-kpi"><span>Payments recorded</span><strong>{money(paidTotal)}</strong><small>Posted payment entries</small></div>
          <div className="ow-kpi"><span>Outstanding</span><strong>{money(balanceTotal)}</strong><small>Calculated from payment ledger</small></div>
        </div>
        <div className="ow-panel">
          <div className="ow-panel-heading"><div><div className="eyebrow">FINANCE / AUDITABLE LEDGER</div><h3>Invoices & payment register</h3><p>Invoice, counterparty, PO link, tax and individual payment entries are stored as separate records.</p></div><button className="button-primary" onClick={() => setShowInvoiceForm(value => !value)}>{showInvoiceForm ? <X size={15}/> : <Plus size={15}/>} {showInvoiceForm ? "Close form" : "New invoice"}</button></div>
          {showInvoiceForm && <div className="ow-form">
            <label>Direction<select value={invoiceDraft.direction} onChange={event => setInvoiceDraft(value => ({ ...value, direction: event.target.value as InvoiceDraft["direction"], counterpartyType: event.target.value === "Receivable" ? "other" : "vendor", counterpartyId: "", counterpartyName: "" }))}><option>Payable</option><option>Receivable</option></select></label>
            <label>Invoice number<input value={invoiceDraft.number} onChange={event => setInvoiceDraft(value => ({ ...value, number: event.target.value }))} placeholder="Supplier / customer invoice no."/></label>
            <label>Counterparty type<select value={invoiceDraft.counterpartyType} onChange={event => setInvoiceDraft(value => ({ ...value, counterpartyType: event.target.value as InvoiceDraft["counterpartyType"], counterpartyId: "", counterpartyName: "" }))}><option value="vendor">Vendor / supplier</option><option value="company">AXIMACH company / intercompany</option><option value="other">Customer / other party</option></select></label>
            {invoiceDraft.counterpartyType === "other" ? <label>Customer / counterparty name<input value={invoiceDraft.counterpartyName} onChange={event => setInvoiceDraft(value => ({ ...value, counterpartyName: event.target.value }))} placeholder="Enter customer or other party"/></label> : <label>Counterparty<select value={invoiceDraft.counterpartyId} onChange={event => setInvoiceDraft(value => ({ ...value, counterpartyId: event.target.value }))}><option value="">Select counterparty</option>{(invoiceDraft.counterpartyType === "vendor" ? vendors.map(item => ({ id: item.id, label: item.company })) : companies.map(item => ({ id: item.id, label: item.name }))).map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
            <label>Linked purchase order<select value={invoiceDraft.poId} onChange={event => setInvoiceDraft(value => ({ ...value, poId: event.target.value }))}><option value="">No PO link</option>{orders.map(item => <option key={item.id} value={item.id}>{item.number}</option>)}</select></label>
            <label>Invoice date<input type="date" value={invoiceDraft.invoiceDate} onChange={event => setInvoiceDraft(value => ({ ...value, invoiceDate: event.target.value }))}/></label>
            <label>Due date<input type="date" value={invoiceDraft.dueDate} onChange={event => setInvoiceDraft(value => ({ ...value, dueDate: event.target.value }))}/></label>
            <label>Subtotal (₹)<input type="number" min="0.01" step="0.01" value={invoiceDraft.subtotal} onChange={event => setInvoiceDraft(value => ({ ...value, subtotal: event.target.value }))}/></label>
            <label>Tax amount (₹)<input type="number" min="0" step="0.01" value={invoiceDraft.taxAmount} onChange={event => setInvoiceDraft(value => ({ ...value, taxAmount: event.target.value }))}/></label>
            <label>Approval state<select value={invoiceDraft.status} onChange={event => setInvoiceDraft(value => ({ ...value, status: event.target.value as InvoiceDraft["status"] }))}><option>Draft</option><option>Approved</option><option>Disputed</option></select></label>
            <label className="ow-form-wide">Notes<textarea rows={2} value={invoiceDraft.notes} onChange={event => setInvoiceDraft(value => ({ ...value, notes: event.target.value }))} placeholder="Invoice basis, receipt evidence, tax details or reconciliation notes"/></label>
            <div className="ow-form-total">Invoice total <strong>{money((Number(invoiceDraft.subtotal) || 0) + (Number(invoiceDraft.taxAmount) || 0))}</strong></div>
            <div className="ow-form-actions"><button className="button-quiet" onClick={() => { setInvoiceDraft(blankInvoice()); setShowInvoiceForm(false); }}>Cancel</button><button className="button-primary" onClick={saveInvoice}>Save invoice</button></div>
          </div>}
          <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Invoice</th><th>Direction / party</th><th>PO / dates</th><th>Invoice value</th><th>Paid</th><th>Balance / state</th><th>Payment</th></tr></thead><tbody>
            {invoices.filter(row => [row.number, row.notes].join(" ").toLowerCase().includes(search.toLowerCase().trim())).map(invoice => {
              const party = invoice.counterpartyName || (invoice.counterpartyType === "vendor" ? vendors.find(item => item.id === invoice.counterpartyId)?.company : companies.find(item => item.id === invoice.counterpartyId)?.name);
              const paid = payments.filter(row => row.invoiceId === invoice.id).reduce((sum, row) => sum + row.amount, 0);
              const balance = Math.max(0, invoice.totalAmount - paid);
              const due = invoice.status === "Void" ? "Void" : invoice.status === "Disputed" ? "Disputed" : balance <= 0 ? "Paid" : paid > 0 ? "Part paid" : invoice.status;
              return <tr key={invoice.id}>
                <td><strong>{invoice.number}</strong><small>{invoice.invoiceDate}</small></td>
                <td><strong>{invoice.direction}</strong><small>{party || "Counterparty unavailable"}</small></td>
                <td><strong>{orders.find(po => po.id === invoice.poId)?.number || "—"}</strong><small>Due {invoice.dueDate || "not set"}</small></td>
                <td>{money(invoice.totalAmount)}<small>Tax {money(invoice.taxAmount)}</small></td>
                <td>{money(paid)}</td>
                <td><strong>{money(balance)}</strong><small className={statusClass(due)}>{due}</small></td>
                <td>{invoice.status === "Approved" && balance > 0 ? <button className="button-quiet compact-button" onClick={() => { setPaymentFor(paymentFor === invoice.id ? "" : invoice.id); setPaymentDraft(value => ({ ...value, amount: balance.toFixed(2) })); }}><Plus size={12}/> Add payment</button> : <span className="ow-muted">{invoice.status === "Draft" ? "Approval required" : "—"}</span>}</td>
              </tr>;
            })}
          </tbody></table></div>
          {paymentFor && <div className="ow-payment-form">
            {(() => {
              const invoice = invoices.find(row => row.id === paymentFor);
              if (!invoice) return null;
              const paid = payments.filter(row => row.invoiceId === invoice.id).reduce((sum, row) => sum + row.amount, 0);
              const balance = Math.max(0, invoice.totalAmount - paid);
              return <><div><strong>Record payment · {invoice.number}</strong><small>Outstanding {money(balance)}</small></div>
                <label>Payment date<input type="date" value={paymentDraft.date} onChange={event => setPaymentDraft(value => ({ ...value, date: event.target.value }))}/></label>
                <label>Amount (₹)<input type="number" min="0.01" max={balance} step="0.01" value={paymentDraft.amount} onChange={event => setPaymentDraft(value => ({ ...value, amount: event.target.value }))}/></label>
                <label>Payment reference<input value={paymentDraft.reference} onChange={event => setPaymentDraft(value => ({ ...value, reference: event.target.value }))} placeholder="UTR / cheque / receipt no."/></label>
                <label>Method<select value={paymentDraft.method} onChange={event => setPaymentDraft(value => ({ ...value, method: event.target.value }))}><option>Bank transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option><option>Credit note</option><option>Other</option></select></label>
                <label className="ow-form-wide">Notes<input value={paymentDraft.notes} onChange={event => setPaymentDraft(value => ({ ...value, notes: event.target.value }))} placeholder="Reference or reconciliation notes"/></label>
                <div className="ow-form-actions"><button className="button-quiet" onClick={() => setPaymentFor("")}>Cancel</button><button className="button-primary" onClick={() => savePayment(invoice)}>Save payment</button></div>
              </>;
            })()}
          </div>}
          <div className="ow-payment-history"><h4><FileText size={14}/> Payment history</h4>{payments.length ? <div className="ow-table-wrap"><table className="ow-table"><thead><tr><th>Invoice</th><th>Date</th><th>Reference</th><th>Method</th><th>Amount</th></tr></thead><tbody>{payments.map(payment => <tr key={payment.id}><td>{invoices.find(row => row.id === payment.invoiceId)?.number || "Invoice archived"}</td><td>{payment.paymentDate}</td><td>{payment.reference}</td><td>{payment.method}</td><td>{money(payment.amount)}</td></tr>)}</tbody></table></div> : <p className="ow-empty-hint">No payment entries have been recorded yet.</p>}</div>
          <div className="ow-footnote">This is an operational invoice and payment ledger, not a GST filing or bank reconciliation engine. Entries are stored locally and synchronised through the configured AXIMACH server. Preserve original invoice and bank evidence outside AXIMACH until formal document attachments and reconciliation controls are enabled.</div>
        </div>
      </>}
      <div className="ow-bottom-links">
        <button className="button-quiet" onClick={() => onSelectModule("components")}>Components & BOM <ArrowRight size={13}/></button>
        <button className="button-quiet" onClick={() => onSelectModule("inventory")}>Inventory <ArrowRight size={13}/></button>
        <button className="button-quiet" onClick={() => onSelectModule("costing")}>Costing & profitability <ArrowRight size={13}/></button>
      </div>
    </section>
  );
}
