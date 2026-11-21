import { useMemo, useState } from "react";
import { Check, ClipboardCheck, FileText, Plus, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { activeRows, makeId, nowIso, type ManufacturingData, type SupplierFinanceApprovalRecord, type SupplierInvoiceRecord, type SupplierPaymentAllocationRecord, type SupplierPaymentRecord } from "./manufacturingData";
import { getServerAuthMode, readServerSession } from "./serverAuth";

type Props = {
  data: ManufacturingData;
  update: (change: (current: ManufacturingData) => ManufacturingData) => void;
  onNotice: (message: string) => void;
};

const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
type Decision = SupplierFinanceApprovalRecord["decision"];

function latestDecision(approvals: SupplierFinanceApprovalRecord[], type: "invoice" | "payment", id: string) {
  return approvals.filter(row => !row.deletedAt && row.targetType === type && row.targetId === id)
    .sort((a, b) => (Date.parse(b.decidedAt || "") || 0) - (Date.parse(a.decidedAt || "") || 0))[0];
}

export default function SupplierAccountsPayablePanel({ data, update, onNotice }: Props) {
  const companies = activeRows(data.companies || []);
  const factories = activeRows(data.factories || []);
  const vendors = activeRows(data.vendors || []);
  const orders = activeRows(data.purchaseOrders || []);
  const invoices = activeRows(data.supplierInvoices || []);
  const payments = activeRows(data.supplierPayments || []);
  const approvals = activeRows(data.supplierFinanceApprovals || []);
  const allocations = activeRows(data.supplierPaymentAllocations || []);

  const baseUrl = (typeof window !== "undefined" ? window.localStorage.getItem("aximach.scheduler.url") : "") || "";
  const session = readServerSession(baseUrl);
  const userMode = getServerAuthMode() === "users";
  const apiKeyMode = typeof window !== "undefined" && Boolean(window.localStorage.getItem("aximach.scheduler.key") && baseUrl && !userMode && window.localStorage.getItem("aximach.storage.mode") !== "local-only");
  const localOnly = typeof window === "undefined" || window.localStorage.getItem("aximach.storage.mode") === "local-only" || (!baseUrl && !apiKeyMode && !userMode);
  const actorId = session?.user.id || (apiKeyMode ? "legacy-api-key" : "local-user");
  const actorRole: "admin" | "manager" | "operator" | "viewer" =
    session?.user.role || (apiKeyMode || localOnly ? "admin" : "operator");
  const canWrite = actorRole !== "viewer";
  const canApprove = actorRole === "admin" || actorRole === "manager";

  const [invoiceCompanyId, setInvoiceCompanyId] = useState(companies[0]?.id || "");
  const [invoiceFactoryId, setInvoiceFactoryId] = useState("");
  const [invoiceVendorId, setInvoiceVendorId] = useState("");
  const [invoicePoId, setInvoicePoId] = useState("");
  const [invoicePoLineId, setInvoicePoLineId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [invoiceSubtotal, setInvoiceSubtotal] = useState("");
  const [invoiceTax, setInvoiceTax] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState("");
  const [invoiceFilter, setInvoiceFilter] = useState("all");

  const [paymentCompanyId, setPaymentCompanyId] = useState(companies[0]?.id || "");
  const [paymentFactoryId, setPaymentFactoryId] = useState("");
  const [paymentVendorId, setPaymentVendorId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentRecord["method"]>("Bank transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState("");

  const [allocationPaymentId, setAllocationPaymentId] = useState("");
  const [allocationInvoiceId, setAllocationInvoiceId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationNotes, setAllocationNotes] = useState("");

  const invoiceFactories = factories.filter(row => row.companyId === invoiceCompanyId);
  const paymentFactories = factories.filter(row => row.companyId === paymentCompanyId);
  const invoiceOrders = orders.filter(row => row.companyId === invoiceCompanyId && (!invoiceFactoryId || row.factoryId === invoiceFactoryId));
  const invoiceLines = invoiceOrders.find(row => row.id === invoicePoId)?.lines.filter(row => !row.deletedAt) || [];
  const invoiceTotal = Math.max(0, Number(invoiceSubtotal) || 0) + Math.max(0, Number(invoiceTax) || 0);

  const invoicePaid = (invoiceId: string) => allocations.filter(row => row.invoiceId === invoiceId)
    .reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
  const paymentAllocated = (paymentId: string) => allocations.filter(row => row.paymentId === paymentId)
    .reduce((sum, row) => sum + Math.max(0, Number(row.amount) || 0), 0);
  const invoiceApproval = (invoice: SupplierInvoiceRecord) => latestDecision(approvals, "invoice", invoice.id);
  const paymentApproval = (payment: SupplierPaymentRecord) => latestDecision(approvals, "payment", payment.id);
  const invoiceState = (invoice: SupplierInvoiceRecord) => {
    if (invoice.status === "Voided") return "Voided";
    const decision = invoiceApproval(invoice);
    if (decision?.decision === "Rejected") return "Rejected";
    if (decision?.decision === "Returned") return "Returned";
    if (invoicePaid(invoice.id) >= invoice.totalAmount - 0.01) return "Paid";
    if (invoicePaid(invoice.id) > 0) return "Partially paid";
    if (decision?.decision === "Approved") return "Approved";
    return invoice.status === "Submitted" ? "Pending approval" : "Draft";
  };
  const paymentState = (payment: SupplierPaymentRecord) => {
    if (payment.status === "Voided") return "Voided";
    const decision = paymentApproval(payment);
    if (decision?.decision === "Rejected") return "Rejected";
    if (decision?.decision === "Returned") return "Returned";
    if (paymentAllocated(payment.id) >= payment.amount - 0.01) return "Fully allocated";
    if (paymentAllocated(payment.id) > 0) return "Partially allocated";
    if (decision?.decision === "Approved") return "Approved · Unallocated";
    return payment.status === "Submitted" ? "Pending approval" : "Draft";
  };

  const outstandingTotal = invoices.filter(row => invoiceState(row) !== "Voided")
    .reduce((sum, row) => sum + Math.max(0, row.totalAmount - invoicePaid(row.id)), 0);
  const overdueTotal = invoices.filter(row => invoiceState(row) !== "Voided" && invoiceState(row) !== "Paid" && row.dueDate && row.dueDate < today())
    .reduce((sum, row) => sum + Math.max(0, row.totalAmount - invoicePaid(row.id)), 0);
  const pendingApprovalCount = invoices.filter(row => invoiceState(row) === "Pending approval").length + payments.filter(row => paymentState(row) === "Pending approval").length;
  const unappliedTotal = payments.filter(row => paymentState(row) !== "Voided")
    .reduce((sum, row) => sum + Math.max(0, row.amount - paymentAllocated(row.id)), 0);

  const saveInvoice = (submit: boolean) => {
    const subtotal = Number(invoiceSubtotal), tax = Number(invoiceTax || 0);
    const total = subtotal + tax;
    if (!invoiceCompanyId || !invoiceFactoryId || !invoiceVendorId || !invoiceNumber.trim() || !invoiceDate || !invoiceDueDate ||
        !Number.isFinite(subtotal) || subtotal <= 0 || !Number.isFinite(tax) || tax < 0 || total <= 0) {
      onNotice("Complete company, factory, supplier, invoice number, invoice/due dates and valid subtotal/tax values.");
      return;
    }
    if (invoiceDueDate < invoiceDate) { onNotice("Invoice due date cannot be earlier than the invoice date."); return; }
    const existing = editingInvoiceId ? invoices.find(row => row.id === editingInvoiceId) : undefined;
    const now = nowIso();
    const record: SupplierInvoiceRecord = {
      id: existing?.id || makeId("supplier-invoice"),
      companyId: invoiceCompanyId, factoryId: invoiceFactoryId, vendorId: invoiceVendorId,
      poId: invoicePoId, poLineId: invoicePoId ? invoicePoLineId : "",
      invoiceNumber: invoiceNumber.trim(), invoiceDate, dueDate: invoiceDueDate, currency: "INR",
      subtotal: Math.round(subtotal * 100) / 100, taxAmount: Math.round(tax * 100) / 100,
      totalAmount: Math.round(total * 100) / 100, status: submit ? "Submitted" : "Draft",
      notes: invoiceNotes.trim(), createdBy: existing?.createdBy || actorId,
      createdAt: existing?.createdAt || now, updatedAt: now
    };
    update(current => ({
      ...current,
      supplierInvoices: existing
        ? current.supplierInvoices.map(row => row.id === existing.id ? record : row)
        : [...current.supplierInvoices, record]
    }));
    setEditingInvoiceId("");
    setInvoiceNumber(""); setInvoicePoId(""); setInvoicePoLineId(""); setInvoiceSubtotal(""); setInvoiceTax(""); setInvoiceDueDate(""); setInvoiceNotes("");
    onNotice(submit ? "Supplier invoice submitted for independent approval." : "Supplier invoice draft saved.");
  };

  const editInvoice = (invoice: SupplierInvoiceRecord) => {
    const decision = invoiceApproval(invoice);
    if (decision?.decision === "Approved" || invoiceState(invoice) === "Paid" || invoiceState(invoice) === "Partially paid") {
      onNotice("Approved or paid invoices are locked. Create a credit/reversal workflow rather than editing the approved financial record.");
      return;
    }
    setEditingInvoiceId(invoice.id);
    setInvoiceCompanyId(invoice.companyId); setInvoiceFactoryId(invoice.factoryId); setInvoiceVendorId(invoice.vendorId);
    setInvoicePoId(invoice.poId || ""); setInvoicePoLineId(invoice.poLineId || "");
    setInvoiceNumber(invoice.invoiceNumber); setInvoiceDate(invoice.invoiceDate); setInvoiceDueDate(invoice.dueDate);
    setInvoiceSubtotal(String(invoice.subtotal)); setInvoiceTax(String(invoice.taxAmount)); setInvoiceNotes(invoice.notes || "");
    if (invoice.status === "Submitted") {
      update(current => ({ ...current, supplierInvoices: current.supplierInvoices.map(row => row.id === invoice.id ? { ...row, status: "Draft", updatedAt: nowIso() } : row) }));
    }
  };

  const decideInvoice = (invoice: SupplierInvoiceRecord, decision: Decision) => {
    if (!canApprove) { onNotice("Only a manager or administrator can approve supplier invoices."); return; }
    if (invoice.createdBy === actorId) { onNotice("Approval requires a different person from the invoice creator."); return; }
    if (invoice.status !== "Submitted") return;
    const now = nowIso();
    const approval: SupplierFinanceApprovalRecord = {
      id: makeId("supplier-approval"), targetType: "invoice", targetId: invoice.id,
      decision, decidedBy: actorId, decidedByRole: actorRole === "manager" ? "manager" : "admin",
      comments: "", decidedAt: now, createdAt: now, updatedAt: now
    };
    update(current => ({ ...current, supplierFinanceApprovals: [...current.supplierFinanceApprovals, approval] }));
    onNotice("Invoice " + decision.toLowerCase() + " decision recorded in the approval history.");
  };

  const savePayment = (submit: boolean) => {
    const amount = Number(paymentAmount);
    if (!paymentCompanyId || !paymentFactoryId || !paymentVendorId || !paymentDate || !Number.isFinite(amount) || amount <= 0) {
      onNotice("Complete company, factory, supplier, payment date and a positive payment amount.");
      return;
    }
    if (["Bank transfer", "UPI", "Cheque"].includes(paymentMethod) && !paymentReference.trim()) {
      onNotice("Enter the bank/UTR/cheque reference for this payment method.");
      return;
    }
    const existing = editingPaymentId ? payments.find(row => row.id === editingPaymentId) : undefined;
    if (existing && (paymentApproval(existing)?.decision === "Approved" || paymentAllocated(existing.id) > 0)) {
      onNotice("Approved or allocated payments are locked.");
      return;
    }
    const now = nowIso();
    const record: SupplierPaymentRecord = {
      id: existing?.id || makeId("supplier-payment"), companyId: paymentCompanyId, factoryId: paymentFactoryId, vendorId: paymentVendorId,
      paymentDate, method: paymentMethod, bankReference: paymentReference.trim(), amount: Math.round(amount * 100) / 100,
      currency: "INR", status: submit ? "Submitted" : "Draft", notes: paymentNotes.trim(),
      createdBy: existing?.createdBy || actorId, createdAt: existing?.createdAt || now, updatedAt: now
    };
    update(current => ({
      ...current,
      supplierPayments: existing
        ? current.supplierPayments.map(row => row.id === existing.id ? record : row)
        : [...current.supplierPayments, record]
    }));
    setEditingPaymentId(""); setPaymentReference(""); setPaymentAmount(""); setPaymentNotes("");
    onNotice(submit ? "Supplier payment submitted for independent approval." : "Supplier payment draft saved.");
  };

  const editPayment = (payment: SupplierPaymentRecord) => {
    if (paymentApproval(payment)?.decision === "Approved" || paymentAllocated(payment.id) > 0) {
      onNotice("Approved or allocated payments are locked.");
      return;
    }
    setEditingPaymentId(payment.id);
    setPaymentCompanyId(payment.companyId); setPaymentFactoryId(payment.factoryId); setPaymentVendorId(payment.vendorId);
    setPaymentDate(payment.paymentDate); setPaymentMethod(payment.method); setPaymentReference(payment.bankReference || "");
    setPaymentAmount(String(payment.amount)); setPaymentNotes(payment.notes || "");
    if (payment.status === "Submitted") {
      update(current => ({ ...current, supplierPayments: current.supplierPayments.map(row => row.id === payment.id ? { ...row, status: "Draft", updatedAt: nowIso() } : row) }));
    }
  };

  const decidePayment = (payment: SupplierPaymentRecord, decision: Decision) => {
    if (!canApprove) { onNotice("Only a manager or administrator can approve supplier payments."); return; }
    if (payment.createdBy === actorId) { onNotice("Payment approval requires a different person from the payment creator."); return; }
    if (payment.status !== "Submitted") return;
    const now = nowIso();
    const approval: SupplierFinanceApprovalRecord = {
      id: makeId("supplier-approval"), targetType: "payment", targetId: payment.id,
      decision, decidedBy: actorId, decidedByRole: actorRole === "manager" ? "manager" : "admin",
      comments: "", decidedAt: now, createdAt: now, updatedAt: now
    };
    update(current => ({ ...current, supplierFinanceApprovals: [...current.supplierFinanceApprovals, approval] }));
    onNotice("Supplier payment " + decision.toLowerCase() + " decision recorded.");
  };

  const approvedInvoices = invoices.filter(row => invoiceApproval(row)?.decision === "Approved" && invoiceState(row) !== "Paid" && invoiceState(row) !== "Voided");
  const approvedPayments = payments.filter(row => paymentApproval(row)?.decision === "Approved" && paymentState(row) !== "Fully allocated" && paymentState(row) !== "Voided");
  const selectedPayment = approvedPayments.find(row => row.id === allocationPaymentId);
  const compatibleInvoices = approvedInvoices.filter(row =>
    (!selectedPayment || row.companyId === selectedPayment.companyId && row.vendorId === selectedPayment.vendorId) &&
    Math.max(0, row.totalAmount - invoicePaid(row.id)) > 0.01
  );
  const selectedInvoice = compatibleInvoices.find(row => row.id === allocationInvoiceId);
  const allocationMax = Math.min(
    selectedPayment ? Math.max(0, selectedPayment.amount - paymentAllocated(selectedPayment.id)) : 0,
    selectedInvoice ? Math.max(0, selectedInvoice.totalAmount - invoicePaid(selectedInvoice.id)) : 0
  );

  const addAllocation = () => {
    if (!selectedPayment || !selectedInvoice) { onNotice("Select an approved supplier payment and a matching approved invoice."); return; }
    const amount = Number(allocationAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > allocationMax + 0.01) {
      onNotice("Allocation must be positive and no greater than the remaining payment or invoice balance (" + money(allocationMax) + ").");
      return;
    }
    const now = nowIso();
    const allocation: SupplierPaymentAllocationRecord = {
      id: makeId("supplier-payment-allocation"), paymentId: selectedPayment.id, invoiceId: selectedInvoice.id,
      amount: Math.round(amount * 100) / 100, notes: allocationNotes.trim(), createdBy: actorId, createdAt: now, updatedAt: now
    };
    update(current => ({ ...current, supplierPaymentAllocations: [...current.supplierPaymentAllocations, allocation] }));
    setAllocationAmount(""); setAllocationNotes("");
    onNotice("Payment allocation recorded against the approved supplier invoice.");
  };

  const filteredInvoices = useMemo(() => invoices.filter(row => {
    if (invoiceFilter === "all") return true;
    return invoiceState(row) === invoiceFilter;
  }), [invoices, allocations, approvals, invoiceFilter]);
  const statusClass = (value: string) => "record-state state-" + value.toLowerCase().replace(/[^a-z]+/g, "-");

  return <section className="surface-panel supplier-ap-panel" aria-label="Supplier invoices and accounts payable">
    <div className="panel-heading">
      <div>
        <div className="eyebrow"><span className="eyebrow-mark"/> ACCOUNTS PAYABLE / SUPPLIER FINANCE</div>
        <h3>Supplier invoices &amp; accounts payable</h3>
        <p>Separate supplier invoice liabilities, independent approval decisions and actual supplier payments. Process-operation payments remain in their existing ledger.</p>
      </div>
      <FileText size={19}/>
    </div>
    <div className="dashboard-job-summary">
      <div><strong>{money(outstandingTotal)}</strong><span>Outstanding supplier invoices</span></div>
      <div><strong>{money(overdueTotal)}</strong><span>Overdue balance</span></div>
      <div><strong>{pendingApprovalCount}</strong><span>Invoices/payments awaiting approval</span></div>
      <div><strong>{money(unappliedTotal)}</strong><span>Approved payments not yet allocated</span></div>
    </div>

    <section className="supplier-ap-subsection">
      <div className="panel-heading"><div><h4>{editingInvoiceId ? "Edit supplier invoice draft" : "Register supplier invoice"}</h4><p>Invoice number is unique for a supplier within a company. Tax is recorded separately from subtotal.</p></div></div>
      <div className="module-record-form supplier-ap-form">
        <label>Company<select value={invoiceCompanyId} onChange={event => {setInvoiceCompanyId(event.target.value);setInvoiceFactoryId("");setInvoicePoId("");setInvoicePoLineId("");}}><option value="">Select company…</option>{companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label>Factory<select value={invoiceFactoryId} onChange={event=>setInvoiceFactoryId(event.target.value)}><option value="">Select factory…</option>{invoiceFactories.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label>Supplier<select value={invoiceVendorId} onChange={event=>setInvoiceVendorId(event.target.value)}><option value="">Select supplier…</option>{vendors.map(row=><option key={row.id} value={row.id}>{row.company}</option>)}</select></label>
        <label>Purchase order (optional)<select value={invoicePoId} onChange={event=>{setInvoicePoId(event.target.value);setInvoicePoLineId("");const po=orders.find(row=>row.id===event.target.value);if(po){setInvoiceCompanyId(po.companyId);setInvoiceFactoryId(po.factoryId);}}}><option value="">No PO link</option>{invoiceOrders.map(row=><option key={row.id} value={row.id}>{row.number}</option>)}</select></label>
        <label>PO component line (optional)<select value={invoicePoLineId} onChange={event=>setInvoicePoLineId(event.target.value)} disabled={!invoicePoId}><option value="">Whole PO / no line</option>{invoiceLines.map(line=><option key={line.id} value={line.id}>{line.id.slice(0,10)} · Qty {line.quantity}</option>)}</select></label>
        <label>Supplier invoice number<input value={invoiceNumber} onChange={event=>setInvoiceNumber(event.target.value)} placeholder="As printed on supplier invoice"/></label>
        <label>Invoice date<input type="date" value={invoiceDate} onChange={event=>setInvoiceDate(event.target.value)}/></label>
        <label>Due date<input type="date" value={invoiceDueDate} onChange={event=>setInvoiceDueDate(event.target.value)}/></label>
        <label>Subtotal (₹)<input type="number" min="0" step="0.01" value={invoiceSubtotal} onChange={event=>setInvoiceSubtotal(event.target.value)}/></label>
        <label>Tax / GST (₹)<input type="number" min="0" step="0.01" value={invoiceTax} onChange={event=>setInvoiceTax(event.target.value)}/></label>
        <label>Total invoice amount (₹)<input readOnly value={invoiceTotal.toFixed(2)}/></label>
        <label className="module-form-wide">Notes / terms<input value={invoiceNotes} onChange={event=>setInvoiceNotes(event.target.value)} placeholder="Payment terms, tax notes, supplier remarks…"/></label>
        <div className="module-form-actions">
          <button className="button-quiet" type="button" disabled={!canWrite||!companies.length||!vendors.length} onClick={()=>saveInvoice(false)}>Save draft</button>
          <button className="button-primary" type="button" disabled={!canWrite||!companies.length||!vendors.length} onClick={()=>saveInvoice(true)}><Plus size={14}/> Submit for approval</button>
          {editingInvoiceId&&<button className="button-quiet" type="button" onClick={()=>{setEditingInvoiceId("");setInvoiceNumber("");}}>Cancel edit</button>}
        </div>
      </div>
    </section>

    <section className="supplier-ap-subsection">
      <div className="panel-heading">
        <div><h4>Supplier invoice register ({invoices.length})</h4><p>Paid balance is calculated only from approved supplier-payment allocations, not from process-operation payment totals.</p></div>
        <select aria-label="Filter supplier invoices" value={invoiceFilter} onChange={event=>setInvoiceFilter(event.target.value)}>
          <option value="all">All statuses</option>
          {["Draft","Pending approval","Approved","Rejected","Returned","Partially paid","Paid","Voided"].map(value=><option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <div className="costing-table-wrap"><table className="costing-table">
        <thead><tr><th>Invoice</th><th>Supplier / company</th><th>Invoice / due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{filteredInvoices.map(invoice=>{
          const vendor=vendors.find(row=>row.id===invoice.vendorId),company=companies.find(row=>row.id===invoice.companyId);
          const paid=invoicePaid(invoice.id),balance=Math.max(0,invoice.totalAmount-paid),state=invoiceState(invoice),decision=invoiceApproval(invoice);
          const canSelfApprove=invoice.createdBy===actorId;
          return <tr key={invoice.id}>
            <td><strong>{invoice.invoiceNumber}</strong><small>{invoice.poId?orders.find(row=>row.id===invoice.poId)?.number||"Archived PO":"No PO linked"}</small></td>
            <td>{vendor?.company||"Archived supplier"}<small>{company?.name||"Archived company"}</small></td>
            <td>{invoice.invoiceDate}<small>Due {invoice.dueDate}</small></td>
            <td>{money(invoice.totalAmount)}</td><td>{money(paid)}</td><td><strong>{money(balance)}</strong></td>
            <td><span className={statusClass(state)}>{state}</span></td>
            <td><div className="supplier-ap-actions">
              {invoice.status==="Draft"&&<button type="button" className="button-quiet compact-button" onClick={()=>update(current=>({...current,supplierInvoices:current.supplierInvoices.map(row=>row.id===invoice.id?{...row,status:"Submitted",updatedAt:nowIso()}:row)}))}>Submit</button>}
              {invoice.status==="Submitted"&&canApprove&&decision?.decision!=="Approved"&&<><button type="button" className="button-primary compact-button" disabled={canSelfApprove} title={canSelfApprove?"Creator cannot approve their own invoice":""} onClick={()=>decideInvoice(invoice,"Approved")}><Check size={12}/> Approve</button><button type="button" className="button-quiet compact-button" disabled={canSelfApprove} onClick={()=>decideInvoice(invoice,"Rejected")}>Reject</button><button type="button" className="button-quiet compact-button" disabled={canSelfApprove} onClick={()=>decideInvoice(invoice,"Returned")}>Return</button></>}
              {(invoice.status==="Draft"||decision?.decision==="Rejected"||decision?.decision==="Returned")&&invoice.status!=="Voided"&&<button type="button" className="button-quiet compact-button" onClick={()=>editInvoice(invoice)}>Edit</button>}
            </div></td>
          </tr>;
        })}{filteredInvoices.length===0&&<tr><td colSpan={8}>No supplier invoices match this filter.</td></tr>}</tbody>
      </table></div>
    </section>

    <section className="supplier-ap-subsection">
      <div className="panel-heading"><div><h4>{editingPaymentId?"Edit supplier payment draft":"Register supplier payment"}</h4><p>Record bank/UPI/cheque payment evidence independently; approval is required before any invoice allocation.</p></div></div>
      <div className="module-record-form supplier-ap-form">
        <label>Company<select value={paymentCompanyId} onChange={event=>{setPaymentCompanyId(event.target.value);setPaymentFactoryId("");}}><option value="">Select company…</option>{companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label>Factory<select value={paymentFactoryId} onChange={event=>setPaymentFactoryId(event.target.value)}><option value="">Select factory…</option>{paymentFactories.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label>Supplier<select value={paymentVendorId} onChange={event=>setPaymentVendorId(event.target.value)}><option value="">Select supplier…</option>{vendors.map(row=><option key={row.id} value={row.id}>{row.company}</option>)}</select></label>
        <label>Payment date<input type="date" value={paymentDate} onChange={event=>setPaymentDate(event.target.value)}/></label>
        <label>Method<select value={paymentMethod} onChange={event=>setPaymentMethod(event.target.value as SupplierPaymentRecord["method"])}>{["Bank transfer","UPI","Cheque","Cash","Other"].map(value=><option key={value}>{value}</option>)}</select></label>
        <label>Bank / UTR / cheque reference<input value={paymentReference} onChange={event=>setPaymentReference(event.target.value)} placeholder="Required for transfer, UPI or cheque"/></label>
        <label>Payment amount (₹)<input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={event=>setPaymentAmount(event.target.value)}/></label>
        <label className="module-form-wide">Payment notes<input value={paymentNotes} onChange={event=>setPaymentNotes(event.target.value)} placeholder="Remittance, bank confirmation, cheque number…"/></label>
        <div className="module-form-actions">
          <button className="button-quiet" type="button" disabled={!canWrite} onClick={()=>savePayment(false)}>Save draft</button>
          <button className="button-primary" type="button" disabled={!canWrite} onClick={()=>savePayment(true)}><Wallet size={14}/> Submit payment for approval</button>
          {editingPaymentId&&<button className="button-quiet" type="button" onClick={()=>setEditingPaymentId("")}>Cancel edit</button>}
        </div>
      </div>
    </section>

    <section className="supplier-ap-subsection">
      <div className="panel-heading"><div><h4>Supplier payment register ({payments.length})</h4><p>Approved payments remain unallocated until a manager/operator deliberately assigns amounts to invoices.</p></div></div>
      <div className="costing-table-wrap"><table className="costing-table">
        <thead><tr><th>Payment date / reference</th><th>Supplier</th><th>Method</th><th>Payment amount</th><th>Allocated</th><th>Unallocated</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{payments.map(payment=>{
          const vendor=vendors.find(row=>row.id===payment.vendorId),allocated=paymentAllocated(payment.id),balance=Math.max(0,payment.amount-allocated),state=paymentState(payment),decision=paymentApproval(payment);
          const self=payment.createdBy===actorId;
          return <tr key={payment.id}>
            <td><strong>{payment.paymentDate}</strong><small>{payment.bankReference||"No transaction reference"}</small></td>
            <td>{vendor?.company||"Archived supplier"}</td><td>{payment.method}</td><td>{money(payment.amount)}</td><td>{money(allocated)}</td><td>{money(balance)}</td>
            <td><span className={statusClass(state)}>{state}</span></td>
            <td><div className="supplier-ap-actions">
              {payment.status==="Draft"&&<button type="button" className="button-quiet compact-button" onClick={()=>update(current=>({...current,supplierPayments:current.supplierPayments.map(row=>row.id===payment.id?{...row,status:"Submitted",updatedAt:nowIso()}:row)}))}>Submit</button>}
              {payment.status==="Submitted"&&canApprove&&decision?.decision!=="Approved"&&<><button type="button" className="button-primary compact-button" disabled={self} onClick={()=>decidePayment(payment,"Approved")}><Check size={12}/> Approve</button><button type="button" className="button-quiet compact-button" disabled={self} onClick={()=>decidePayment(payment,"Rejected")}>Reject</button><button type="button" className="button-quiet compact-button" disabled={self} onClick={()=>decidePayment(payment,"Returned")}>Return</button></>}
              {(payment.status==="Draft"||decision?.decision==="Rejected"||decision?.decision==="Returned")&&allocated===0&&<button type="button" className="button-quiet compact-button" onClick={()=>editPayment(payment)}>Edit</button>}
            </div></td>
          </tr>;
        })}{payments.length===0&&<tr><td colSpan={8}>No supplier payments recorded.</td></tr>}</tbody>
      </table></div>
    </section>

    <section className="supplier-ap-subsection">
      <div className="panel-heading"><div><h4>Payment allocation</h4><p>Split one approved payment across multiple approved invoices, or settle an invoice through multiple payments. Duplicate/over-balance allocations are blocked.</p></div></div>
      <div className="module-record-form supplier-ap-form">
        <label>Approved supplier payment<select value={allocationPaymentId} onChange={event=>{setAllocationPaymentId(event.target.value);setAllocationInvoiceId("");}}><option value="">Select payment…</option>{approvedPayments.map(row=><option key={row.id} value={row.id}>{row.bankReference||row.id.slice(0,12)} · {vendors.find(v=>v.id===row.vendorId)?.company} · remaining {money(row.amount-paymentAllocated(row.id))}</option>)}</select></label>
        <label>Approved invoice<select value={allocationInvoiceId} onChange={event=>setAllocationInvoiceId(event.target.value)}><option value="">Select matching invoice…</option>{compatibleInvoices.map(row=><option key={row.id} value={row.id}>{row.invoiceNumber} · balance {money(row.totalAmount-invoicePaid(row.id))}</option>)}</select></label>
        <label>Allocation amount (₹)<input type="number" min="0.01" max={allocationMax} step="0.01" value={allocationAmount} onChange={event=>setAllocationAmount(event.target.value)}/></label>
        <label>Maximum allocatable (₹)<input readOnly value={allocationMax.toFixed(2)}/></label>
        <label className="module-form-wide">Allocation notes<input value={allocationNotes} onChange={event=>setAllocationNotes(event.target.value)} placeholder="Invoice settlement / remittance reference…"/></label>
        <div className="module-form-actions"><button className="button-primary" type="button" disabled={!canWrite||!selectedPayment||!selectedInvoice||allocationMax<=0} onClick={addAllocation}><Plus size={14}/> Record allocation</button></div>
      </div>
      <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Payment reference</th><th>Invoice</th><th>Supplier</th><th>Allocated amount</th><th>Recorded at</th><th>Notes</th></tr></thead><tbody>
        {allocations.map(row=><tr key={row.id}><td>{payments.find(payment=>payment.id===row.paymentId)?.bankReference||row.paymentId}</td><td>{invoices.find(invoice=>invoice.id===row.invoiceId)?.invoiceNumber||row.invoiceId}</td><td>{vendors.find(v=>v.id===payments.find(payment=>payment.id===row.paymentId)?.vendorId)?.company||"Archived supplier"}</td><td>{money(row.amount)}</td><td>{row.createdAt?new Date(row.createdAt).toLocaleString("en-IN"):"—"}</td><td>{row.notes||"—"}</td></tr>)}
        {allocations.length===0&&<tr><td colSpan={6}>No supplier payment allocations recorded.</td></tr>}
      </tbody></table></div>
    </section>

    <div className="module-safety-note"><ShieldAlert size={15}/><span>Approval history is append-only and the shared server enforces manager/admin approval, different-person approval, approved-record locking, supplier/company matching and invoice/payment balance limits. This first AP release records invoice headers and one optional PO/PO-line association; line-level multi-PO invoice splitting and uploaded invoice documents require the later document-storage/line-allocation stage. Local-only mode is a convenience workflow, not a security boundary.</span></div>
  </section>;
}
