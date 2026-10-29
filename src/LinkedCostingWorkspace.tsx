import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Check, CircleDollarSign, FileText, Package, Plus, Search, ShieldCheck, Truck, Users, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type QuotationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type ComponentLineRef = { key: string; poId: string; poNumber: string; lineId: string; quantity: number; targetDelivery: string; unitPrice: number; componentId: string };
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const stamp = () => new Date().toISOString().slice(0,10);

export default function LinkedCostingWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const components = activeRows(data.components);
  const orders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const quotations = activeRows(data.quotations);
  const [componentId, setComponentId] = useState("");
  const [lineKey, setLineKey] = useState("");
  const [operationId, setOperationId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [quotedAt, setQuotedAt] = useState(stamp());
  const [validUntil, setValidUntil] = useState("");
  const [quantity, setQuantity] = useState("");
  const [ratePerPart, setRatePerPart] = useState("");
  const [transportCost, setTransportCost] = useState("");
  const [leadDays, setLeadDays] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [showQuoteForm, setShowQuoteForm] = useState(false);

  const selectedComponent = components.find(c => c.id === componentId);
  const componentLines: ComponentLineRef[] = useMemo(() => orders.flatMap(po => po.lines.filter(line => line.componentId === selectedComponent?.id).map(line => ({
    key: po.id + "::" + line.id, poId: po.id, poNumber: po.number, lineId: line.id, quantity: line.quantity, targetDelivery: line.targetDelivery || po.targetDelivery, unitPrice: line.unitPrice, componentId: line.componentId
  }))), [orders, selectedComponent?.id]);
  const selectedLine = componentLines.find(line => line.key === lineKey) || componentLines[0];
  const routeOperations = operations.filter(op => op.componentId === selectedComponent?.id && (!selectedLine || (op.poId === selectedLine.poId && op.poLineId === selectedLine.lineId)));
  const selectedOperation = routeOperations.find(op => op.id === operationId) || routeOperations[0];
  const quoteRows = quotations.filter(q => q.componentId === selectedComponent?.id && (!selectedLine || (q.poId === selectedLine.poId && q.poLineId === selectedLine.lineId)) && (!selectedOperation || q.operationId === selectedOperation.id))
    .filter(q => (q.quoteReference + " " + (vendors.find(v=>v.id===q.vendorId)?.company||"") + " " + q.status + " " + (routeOperations.find(op=>op.id===q.operationId)?.name||"")).toLowerCase().includes(quoteSearch.toLowerCase().trim()))
    .sort((a,b) => (b.quotedAt || "").localeCompare(a.quotedAt || ""));
  const materialCost = selectedComponent ? selectedComponent.materialQty * selectedComponent.materialRate : 0;
  const operationPlanned = routeOperations.reduce((sum,op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const operationActual = routeOperations.reduce((sum,op) => sum + op.quantity * (op.actualRatePerPart || 0) + op.transportCost, 0);
  const selectedQuoteCost = routeOperations.reduce((sum,op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const extraCharges = selectedComponent ? selectedComponent.overhead + selectedComponent.toolingCost + selectedComponent.reworkCost + selectedComponent.scrapCost : 0;
  const plannedTotal = materialCost + operationPlanned + extraCharges;
  const actualTotal = materialCost + operationActual + extraCharges;
  const sellingRate = selectedLine?.unitPrice || selectedComponent?.salePrice || 0;
  const revenue = (selectedLine?.quantity || 0) * sellingRate;
  const acceptedQty = selectedLine ? Math.max(0, selectedLine.quantity - (selectedComponent?.rejectedQty || 0)) : 0;
  const profit = revenue - plannedTotal;
  const costPerAccepted = acceptedQty ? plannedTotal / acceptedQty : 0;

  const openQuote = (forOperationId?: string) => {
    if (!selectedComponent) { onNotice("Create a component master record first."); return; }
    if (!selectedLine) { onNotice("Link this component to a saved purchase-order line before entering a quote."); return; }
    if (!routeOperations.length) { onNotice("Add the required process operations in Process Map first, then enter each vendor quotation against the exact operation."); return; }
    setQuoteReference(""); setQuotedAt(stamp()); setValidUntil(""); setQuantity(String(selectedLine.quantity)); setRatePerPart(""); setTransportCost("0"); setLeadDays(""); setQuoteNotes("");
    setOperationId(forOperationId || routeOperations[0]?.id || ""); setVendorId(""); setShowQuoteForm(true);
  };
  const saveQuote = () => {
    if (!selectedComponent || !selectedLine || !selectedOperation || !vendorId) { onNotice("Choose a component, PO line, process operation and vendor."); return; }
    const rate = Number(ratePerPart);
    const qty = Number(quantity);
    if (!Number.isFinite(rate) || rate < 0 || !Number.isFinite(qty) || qty <= 0) { onNotice("Enter a valid quoted rate and positive quantity."); return; }
    const stampNow = nowIso(); const id = makeId("quote");
    const quote: QuotationRecord = {
      id, poId: selectedLine.poId, poLineId: selectedLine.lineId, componentId: selectedComponent.id, operationId: selectedOperation.id, vendorId,
      quoteReference: quoteReference.trim(), quotedAt: quotedAt || stamp(), validUntil, quantity: qty, ratePerPart: rate,
      transportCost: Math.max(0, Number(transportCost) || 0), leadDays: Math.max(0, Number(leadDays) || 0),
      status: "Received", notes: quoteNotes.trim(), createdAt: stampNow, updatedAt: stampNow
    };
    update(current => ({ ...current, quotations: [...current.quotations, quote] }));
    setShowQuoteForm(false); onNotice("Quotation saved with component ID, PO-line ID, operation ID and vendor ID. It is recorded as a received quote, not an actual purchase/invoice.");
  };
  const selectQuote = (quote: QuotationRecord) => {
    const selectedStamp = nowIso();
    update(current => ({
      ...current,
      quotations: current.quotations.map(q => q.operationId === quote.operationId && q.poLineId === quote.poLineId && !q.deletedAt
        ? { ...q, status: q.id === quote.id ? "Selected" : q.status === "Selected" ? "Received" : q.status, updatedAt: selectedStamp }
        : q),
      operations: current.operations.map(op => op.id === quote.operationId
        ? { ...op, vendorId: quote.vendorId, ratePerPart: quote.ratePerPart, transportCost: quote.transportCost, updatedAt: selectedStamp }
        : op)
    }));
    onNotice("Selected quote rate/vendor applied to this operation's planned cost. The quote remains separate from actual invoice cost.");
  };
  const setExtra = (key: "overhead" | "toolingCost" | "reworkCost" | "scrapCost" | "materialRate" | "benchmarkMaterialRate" | "materialQty" | "salePrice" | "rejectedQty" | "gstRate", value: number) => {
    if (!selectedComponent) return;
    const updatedAt = nowIso();
    update(current => ({ ...current, components: current.components.map(component => component.id === selectedComponent.id ? { ...component, [key]: Math.max(0, value), updatedAt } : component) }));
  };

  return <section className="workspace-page linked-costing-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO DATA · LOCAL UNTIL SERVER SYNC"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> FINANCE / COMPONENT + PROCESS RATE HISTORY</div><h1>Costing & quotations<span>.</span></h1><p>Store every supplier rate against the exact component, PO line and operation; compare quotations without treating them as actual invoices.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendor directory</button><button className="button-primary" onClick={() => openQuote()} disabled={!selectedComponent}><Plus size={15}/> Add process quotation</button></div></div>
    {!components.length ? <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>No component master records yet</h3><p>There are no sample components. Add your actual part number once; then create a PO line, add the required operations and record supplier quotations per operation.</p><button className="button-primary" onClick={() => onSelectModule("components")}><Plus size={14}/> Create component master</button></div></section> : <>
      <div className="linked-master-selectors linked-cost-selectors">
        <SearchablePicker id="cost-component" label="Component / part number" value={selectedComponent?.id||""} placeholder="Type part number or name…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={id=>{setComponentId(id);setLineKey("");setOperationId("");setShowQuoteForm(false);}}/>
        <SearchablePicker id="cost-po-line" label="Purchase order / component line" value={selectedLine?.key||""} placeholder="Type PO number or due date…" options={componentLines.map(line=>({id:line.key,label:line.poNumber+" · "+line.quantity+" pcs · "+(line.targetDelivery||"No delivery date")}))} onChange={key=>{setLineKey(key);setOperationId("");}}/>
        <SearchablePicker id="cost-operation" label="Process operation" value={selectedOperation?.id||""} placeholder="Type operation name…" options={routeOperations.map(op=>({id:op.id,label:op.name+" · OP-"+op.sequence}))} onChange={setOperationId}/>
      </div>
      {!componentLines.length && <div className="module-safety-note"><FileText size={14}/><span>This component is not yet linked to a PO line. Create or edit the actual order in Purchase Orders; quotes will then be stored against that order line.</span><button className="button-quiet compact-button" onClick={() => onSelectModule("purchasing")}>Open purchase orders</button></div>}
      <div className="linked-component-summary"><div><small>COMPONENT</small><strong>{selectedComponent?.partNumber} · {selectedComponent?.name}</strong><span>Revision {selectedComponent?.revision || "—"} · {selectedComponent?.material || "Material not entered"}</span></div><div><small>MATERIAL COST</small><strong>{money(materialCost)}</strong><span>{selectedComponent?.materialQty || 0} units × {money(selectedComponent?.materialRate || 0)}</span></div><div><small>PROCESS + TRANSPORT</small><strong>{money(operationPlanned)}</strong><span>Rates selected or entered per operation</span></div><div><small>PLANNED COST / ACCEPTED PART</small><strong>{money(costPerAccepted)}</strong><span>Uses the selected PO quantity and entered rejects</span></div></div>
      <div className="linked-kpis linked-cost-kpis"><div className="route-kpi kpi-cost"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>PLANNED COST</small><strong>{money(plannedTotal)}</strong><em>Material + planned process + transport + entered extras</em></span></div><div className="route-kpi kpi-quality"><span className="kpi-icon"><Check size={19}/></span><span><small>ACTUAL RATE COST</small><strong>{money(actualTotal)}</strong><em>Actual operation rates only where recorded</em></span></div><div className="route-kpi kpi-delivery"><span className="kpi-icon"><Package size={19}/></span><span><small>ORDER VALUE</small><strong>{money(revenue)}</strong><em>{selectedLine?.quantity || 0} pcs × {money(sellingRate)}</em></span></div><div className="route-kpi kpi-risk"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>ESTIMATED PROFIT / LOSS</small><strong>{money(profit)}</strong><em>Before GST/finance items not entered here</em></span></div></div>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUOTE-TO-OPERATION LINK</div><h3>Process costs for {selectedComponent?.partNumber}</h3><p>Each row references a specific operation ID and PO component line.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><ArrowRight size={14}/> Manage operations</button></div>
        {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Operation</th><th>Vendor</th><th>Qty</th><th>Selected quote / rate</th><th>Actual rate / part</th><th>Transport</th><th>Planned process cost</th><th>Quotes</th></tr></thead><tbody>{routeOperations.map(op => {
          const quoteCount = quotations.filter(q => q.operationId === op.id && !q.deletedAt).length;
          const vendor = vendors.find(v => v.id === op.vendorId);
          return <tr key={op.id}><td><strong>{op.name}</strong><small>{op.category || "Type not entered"} · OP-{op.sequence}</small></td><td>{vendor?.company || "Not assigned"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{money(op.ratePerPart)}</td><td>{(op.actualRatePerPart || 0) > 0 ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.transportCost)}</td><td>{money(op.quantity * op.ratePerPart + op.transportCost)}</td><td><button className="button-quiet compact-button" onClick={() => {openQuote(op.id);}}><Plus size={12}/> {quoteCount} · Add quote</button></td></tr>;
        })}</tbody></table></div> : <div className="module-empty-state"><FileText size={25}/><h3>No process operations linked yet</h3><p>Add the actual operations in Process Map for this component and PO line before recording supplier quotations.</p><button className="button-primary" onClick={() => onSelectModule("process-map")}><Plus size={14}/> Add operations</button></div>}
      </section>
      {showQuoteForm && <section className="surface-panel module-record-form-panel linked-quote-form"><div className="panel-heading"><div><h3>New supplier quotation</h3><p>Quote source and status stay separate from actual accepted invoice / job cost.</p></div><button className="icon-control" onClick={() => setShowQuoteForm(false)} aria-label="Close quote form"><X size={15}/></button></div>
        <div className="module-record-form">
          <label>PO / component line<select value={selectedLine?.key || ""} onChange={e => {setLineKey(e.target.value);setOperationId("");}}><option value="">Select line…</option>{componentLines.map(l=><option key={l.key} value={l.key}>{l.poNumber} · {l.quantity} pcs</option>)}</select></label>
          <label>Process operation *<select value={selectedOperation?.id || operationId} onChange={e => setOperationId(e.target.value)}><option value="">Select operation…</option>{routeOperations.map(op=><option key={op.id} value={op.id}>{op.name} · OP-{op.sequence}</option>)}</select></label>
          <label>Vendor / supplier *<select value={vendorId} onChange={e => setVendorId(e.target.value)}><option value="">Select actual vendor…</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company} · {v.phone || "No phone"}{v.status.toLowerCase().includes("unverified") ? " · Unverified contact" : ""}</option>)}</select>{!vendors.length&&<small className="field-hint">Add vendor details or QR-sync contacts in Vendors & Sub-vendors.</small>}</label>
          <label>Quotation reference<input value={quoteReference} onChange={e=>setQuoteReference(e.target.value)} placeholder="Supplier quote / email / RFQ reference"/></label>
          <label>Quote date<input type="date" value={quotedAt} onChange={e=>setQuotedAt(e.target.value)}/></label>
          <label>Valid until<input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></label>
          <label>Quantity quoted<input type="number" min="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
          <label>Rate per part (₹) *<input type="number" min="0" step="0.01" value={ratePerPart} onChange={e=>setRatePerPart(e.target.value)} placeholder="Enter quote received"/></label>
          <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={transportCost} onChange={e=>setTransportCost(e.target.value)}/></label>
          <label>Lead time (calendar days)<input type="number" min="0" value={leadDays} onChange={e=>setLeadDays(e.target.value)} placeholder="Supplier's committed lead time"/></label>
          <label className="module-form-wide">Quote notes<input value={quoteNotes} onChange={e=>setQuoteNotes(e.target.value)} placeholder="Scope, exclusions, taxes, delivery terms, validity…"/></label>
          <div className="module-form-actions"><button className="button-primary" onClick={saveQuote}><Check size={14}/> Save quotation</button><button className="button-quiet" onClick={()=>setShowQuoteForm(false)}>Cancel</button></div>
        </div>
      </section>}
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLIER QUOTATION HISTORY</div><h3>Quotes received ({quoteRows.length})</h3><p>Compare real quotations supplied by vendors; missing rates stay blank rather than being guessed.</p></div><label className="module-record-search"><Search size={14}/><input value={quoteSearch} onChange={e=>setQuoteSearch(e.target.value)} placeholder="Search quote, vendor, process…"/></label></div>
        {quoteRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendor</th><th>Quote reference</th><th>Quote date</th><th>Validity</th><th>Qty</th><th>Rate / part</th><th>Transport</th><th>Lead days</th><th>Status</th><th>Action</th></tr></thead><tbody>{quoteRows.map(q => <tr key={q.id}><td>{routeOperations.find(op=>op.id===q.operationId)?.name || "Archived operation"}</td><td>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</td><td>{q.quoteReference || "Not entered"}</td><td>{q.quotedAt || "—"}</td><td>{q.validUntil || "—"}</td><td>{q.quantity.toLocaleString("en-IN")}</td><td>{money(q.ratePerPart)}</td><td>{money(q.transportCost)}</td><td>{q.leadDays || "—"}</td><td><span className={"record-state state-" + q.status.toLowerCase()}>{q.status}</span></td><td>{q.status === "Selected" ? <span>Applied to operation</span> : <button className="button-primary compact-button" onClick={() => selectQuote(q)}><Check size={12}/> Use this rate</button>}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No quotations saved for this component/PO line/process yet.</div>}
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPONENT OTHER COSTS</div><h3>Material, overhead and other entered costs</h3><p>These values are stored on this component master and reused across its PO lines; enter current rates only.</p></div></div>
        <div className="module-record-form">
          <label>Material quantity<input type="number" min="0" step="0.001" value={selectedComponent?.materialQty || 0} onChange={e=>setExtra("materialQty",Number(e.target.value)||0)}/></label>
          <label>Material rate per unit (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.materialRate || 0} onChange={e=>setExtra("materialRate",Number(e.target.value)||0)}/></label>
          <label>Benchmark material rate (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.benchmarkMaterialRate || 0} onChange={e=>setExtra("benchmarkMaterialRate",Number(e.target.value)||0)}/></label>
          <label>Selling rate per part (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.salePrice || 0} onChange={e=>setExtra("salePrice",Number(e.target.value)||0)}/></label>
          <label>Overhead (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.overhead || 0} onChange={e=>setExtra("overhead",Number(e.target.value)||0)}/></label>
          <label>Tooling / fixture (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.toolingCost || 0} onChange={e=>setExtra("toolingCost",Number(e.target.value)||0)}/></label>
          <label>Rework cost (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.reworkCost || 0} onChange={e=>setExtra("reworkCost",Number(e.target.value)||0)}/></label>
          <label>Scrap / rejection loss (₹)<input type="number" min="0" step="0.01" value={selectedComponent?.scrapCost || 0} onChange={e=>setExtra("scrapCost",Number(e.target.value)||0)}/></label>
          <label>Rejected quantity (pcs)<input type="number" min="0" value={selectedComponent?.rejectedQty || 0} onChange={e=>setExtra("rejectedQty",Number(e.target.value)||0)}/></label>
          <label>GST rate (%)<input type="number" min="0" max="100" step="0.01" value={selectedComponent?.gstRate || 0} onChange={e=>setExtra("gstRate",Math.min(100,Number(e.target.value)||0))}/></label>
        </div>
        <div className="linked-cost-summary-lines"><div><span>Material cost</span><strong>{money(materialCost)}</strong></div><div><span>Planned process + transport</span><strong>{money(operationPlanned)}</strong></div><div><span>Entered overhead / tooling / rework / scrap</span><strong>{money(extraCharges)}</strong></div><div><span>Planned total</span><strong>{money(plannedTotal)}</strong></div><div><span>Actual-rate total (actual rates still missing are counted as zero)</span><strong>{money(actualTotal)}</strong></div><div><span>Estimated P/L before GST</span><strong>{money(profit)}</strong></div></div>
      </section>
    </>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Quotation amounts are supplier inputs, not live market benchmarks. Selecting a quote updates the operation's planned vendor/rate; it does not mark it as an invoice or actual expense.</span></div>
  </section>;
}
