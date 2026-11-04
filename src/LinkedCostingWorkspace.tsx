import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarClock, Check, CircleDollarSign, FileText, Gauge, Package, Plus, Recycle, RotateCcw, Search, ShieldCheck, Truck, Users, Wallet, Workflow, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type QuotationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import { ProcessIcon } from "./IconStudio";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type ComponentLineRef = { key: string; poId: string; poNumber: string; lineId: string; quantity: number; targetDelivery: string; unitPrice: number; componentId: string; materialQty?: number; materialRate?: number; benchmarkMaterialRate?: number; overhead?: number; toolingCost?: number; reworkCost?: number; scrapCost?: number; rejectedQty?: number; gstRate?: number };
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const stamp = () => new Date().toISOString().slice(0,10);

export default function LinkedCostingWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const components = activeRows(data.components);
  const orders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const quotations = activeRows(data.quotations);
  const [companyId, setCompanyId] = useState("");
  const [rollupPoIds, setRollupPoIds] = useState<string[]>([]);
  const [poId, setPoId] = useState("");
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

  const preferredCompanyId = orders.find(po => po.lines.some(line => !("deletedAt" in line && (line as any).deletedAt)))?.companyId || companies[0]?.id || "";
  useEffect(() => {
    if (!companies.some(company => company.id === companyId) && preferredCompanyId) { setCompanyId(preferredCompanyId); setPoId(""); setLineKey(""); }
    if (!preferredCompanyId && companyId) { setCompanyId(""); setPoId(""); setLineKey(""); }
  }, [companies, companyId, preferredCompanyId]);
  const companyOrders = orders.filter(po => po.companyId === companyId);
  const paymentTransactionsForCompany = activeRows(data.paymentTransactions||[]);
  const companyRollupRows = companyOrders.flatMap(po => po.lines.filter(line=>!("deletedAt" in line && (line as any).deletedAt)).map(line=>{
    const component=components.find(item=>item.id===line.componentId);
    const linkedOperations=operations.filter(op=>op.poId===po.id&&op.poLineId===line.id&&op.componentId===line.componentId);
    const revenue=line.quantity*(component?.salePrice ?? line.unitPrice ?? 0);
    const processCost=linkedOperations.reduce((sum,op)=>sum+op.quantity*(op.actualRatePerPart||0),0);
    const transportCost=linkedOperations.reduce((sum,op)=>sum+Math.max(0,Number(op.transportCost)||0),0);
    const plannedRows=activeRows(data.plannedCosts).filter(row=>row.componentNumber.trim().toLowerCase()===(component?.partNumber||"").trim().toLowerCase()||row.componentName.trim().toLowerCase()===(component?.name||"").trim().toLowerCase());
    const plannedCost=plannedRows.reduce((sum,row)=>sum+row.plannedRate*line.quantity,0);
    const paid=linkedOperations.reduce((sum,op)=>{
      const txns=paymentTransactionsForCompany.filter(txn=>txn.operationId===op.id);
      return sum+(txns.length?txns.reduce((sub,txn)=>sub+Math.max(0,Number(txn.amount)||0),0):Math.max(0,Number(op.paidAmount)||0));
    },0);
    const recordedCost=processCost+transportCost;
    return {po,line,component,linkedOperations,revenue,processCost,transportCost,plannedCost,paid,recordedCost,profitLoss:revenue-recordedCost};
  }));
  const visibleCompanyRollup = companyRollupRows.filter(row=>!rollupPoIds.length||rollupPoIds.includes(row.po.id));
  const companyRollupTotals = visibleCompanyRollup.reduce((sum,row)=>({
    revenue:sum.revenue+row.revenue,planned:sum.planned+row.plannedCost,process:sum.process+row.processCost,
    transport:sum.transport+row.transportCost,recorded:sum.recorded+row.recordedCost,paid:sum.paid+row.paid,
    profitLoss:sum.profitLoss+row.profitLoss
  }),{revenue:0,planned:0,process:0,transport:0,recorded:0,paid:0,profitLoss:0});

  useEffect(() => {
    if (!companyOrders.some(po => po.id === poId)) { setPoId(companyOrders[0]?.id || ""); setLineKey(""); setOperationId(""); }
  }, [companyOrders, poId]);
  const selectedPO = companyOrders.find(po => po.id === poId);
  const componentLines: ComponentLineRef[] = useMemo(() => (selectedPO?.lines || []).filter(line => !("deletedAt" in line && (line as any).deletedAt)).map(line => ({
    key: selectedPO!.id + "::" + line.id, poId: selectedPO!.id, poNumber: selectedPO!.number, lineId: line.id, quantity: line.quantity,
    targetDelivery: line.targetDelivery || selectedPO!.targetDelivery, unitPrice: line.unitPrice, componentId: line.componentId, materialQty: line.materialQty,
    materialRate: line.materialRate, benchmarkMaterialRate: line.benchmarkMaterialRate, overhead: line.overhead, toolingCost: line.toolingCost,
    reworkCost: line.reworkCost, scrapCost: line.scrapCost, rejectedQty: line.rejectedQty, gstRate: line.gstRate
  })), [selectedPO]);
  const preferredLine = componentLines.find(line => quotations.some(q => !q.deletedAt && q.poLineId === line.lineId)) || componentLines[0];
  useEffect(() => {
    const currentLine = componentLines.find(line => line.key === lineKey);
    const nextLine = currentLine || preferredLine;
    if ((nextLine?.key || "") !== lineKey) setLineKey(nextLine?.key || "");
  }, [componentLines, lineKey, preferredLine?.key]);
  const selectedLine = componentLines.find(line => line.key === lineKey) || preferredLine;
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const routeOperations = operations.filter(op => op.componentId === selectedComponent?.id && (!selectedLine || (op.poId === selectedLine.poId && op.poLineId === selectedLine.lineId)));
  const paymentTransactions = activeRows(data.paymentTransactions || []);
  const paymentTotalFor = (operation: typeof routeOperations[number]) => {
    const rows=paymentTransactions.filter(payment=>payment.operationId===operation.id);
    return rows.length?rows.reduce((sum,payment)=>sum+Math.max(0,Number(payment.amount)||0),0):Math.max(0,Number(operation.paidAmount)||0);
  };
  const preferredOperation = routeOperations.find(op => quotations.some(q => !q.deletedAt && q.operationId === op.id)) || routeOperations[0];
  useEffect(() => {
    const currentOperation = routeOperations.find(op => op.id === operationId);
    const nextOperation = currentOperation || preferredOperation;
    if ((nextOperation?.id || "") !== operationId) setOperationId(nextOperation?.id || "");
  }, [routeOperations, operationId, preferredOperation?.id]);
  const selectedOperation = routeOperations.find(op => op.id === operationId) || preferredOperation;
  // Show saved quotes for every process in the selected component/PO line.
  // Filtering by the currently selected operation hid quotations saved against
  // other steps, making a populated costing register look empty.
  const quoteRows = quotations.filter(q => q.componentId === selectedComponent?.id && (!selectedLine || (q.poId === selectedLine.poId && q.poLineId === selectedLine.lineId)))
    .filter(q => (q.quoteReference + " " + (vendors.find(v=>v.id===q.vendorId)?.company||"") + " " + q.status + " " + (routeOperations.find(op=>op.id===q.operationId)?.name||"")).toLowerCase().includes(quoteSearch.toLowerCase().trim()))
    .sort((a,b) => (b.quotedAt || "").localeCompare(a.quotedAt || ""));
  // PO-line overrides isolate material/cost/rejection inputs between different orders for the same component.
  const componentBomLines = data.bomLines.filter(line => line.componentId === selectedComponent?.id && !line.deletedAt);
  const bomMaterialQtyPerPart = componentBomLines.reduce((sum,line) => sum + line.quantityPerPart * (1 + line.scrapPercent / 100), 0);
  const bomMaterialCostPerPart = componentBomLines.reduce((sum,line) => sum + line.quantityPerPart * (1 + line.scrapPercent / 100) * (data.materials.find(material => material.id === line.materialId)?.ratePerUnit || 0), 0);
  const bomWeightedMaterialRate = bomMaterialQtyPerPart > 0 ? bomMaterialCostPerPart / bomMaterialQtyPerPart : 0;
  const masterMaterialQty = selectedComponent?.materialQty || 0;
  const masterMaterialRate = selectedComponent?.materialRate || 0;
  const materialQty = selectedLine?.materialQty ?? (masterMaterialQty > 0 ? masterMaterialQty : bomMaterialQtyPerPart * (selectedLine?.quantity || 0));
  const materialRate = selectedLine?.materialRate ?? (masterMaterialRate > 0 ? masterMaterialRate : bomWeightedMaterialRate);
  const materialCostSource = selectedLine?.materialQty !== undefined || selectedLine?.materialRate !== undefined ? "PO-line cost override" : masterMaterialQty > 0 && masterMaterialRate > 0 ? "Component master default" : bomMaterialQtyPerPart > 0 ? "Linked BOM estimate" : "No material rate / BOM entered";
  const benchmarkMaterialRate = selectedLine?.benchmarkMaterialRate ?? selectedComponent?.benchmarkMaterialRate ?? 0;
  const overhead = selectedLine?.overhead ?? selectedComponent?.overhead ?? 0;
  const toolingCost = selectedLine?.toolingCost ?? selectedComponent?.toolingCost ?? 0;
  const reworkCost = selectedLine?.reworkCost ?? selectedComponent?.reworkCost ?? 0;
  const scrapCost = selectedLine?.scrapCost ?? selectedComponent?.scrapCost ?? 0;
  const rejectedQty = selectedLine?.rejectedQty ?? selectedComponent?.rejectedQty ?? 0;
  const gstRate = selectedLine?.gstRate ?? selectedComponent?.gstRate ?? 0;
  const materialCost = materialQty * materialRate;
  const benchmarkMaterialCost = materialQty * benchmarkMaterialRate;
  const materialVariance = materialCost - benchmarkMaterialCost;
  const operationPlanned = routeOperations.reduce((sum,op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const operationActual = routeOperations.reduce((sum,op) => sum + op.quantity * (op.actualRatePerPart || 0) + op.transportCost, 0);
  const extraCharges = overhead + toolingCost + reworkCost + scrapCost;
  const plannedTotal = materialCost + operationPlanned + extraCharges;
  const actualTotal = materialCost + operationActual + extraCharges;
  const sellingRate = selectedComponent?.salePrice ?? selectedLine?.unitPrice ?? 0;
  const revenue = (selectedLine?.quantity || 0) * sellingRate;
  const gstEstimate = revenue * gstRate / 100;
  const finalOperation = routeOperations[routeOperations.length - 1];
  const acceptedQty = selectedLine ? (finalOperation && finalOperation.completed > 0 ? finalOperation.accepted : Math.max(0, selectedLine.quantity - rejectedQty)) : 0;
  const independentPlannedCosts = selectedComponent ? activeRows(data.plannedCosts).filter(row =>
    row.componentNumber.trim().toLowerCase() === selectedComponent.partNumber.trim().toLowerCase()
    || row.componentName.trim().toLowerCase() === selectedComponent.name.trim().toLowerCase()
  ) : [];
  const independentPlannedTotal = independentPlannedCosts.reduce((sum,row) =>
    sum + row.plannedRate * (selectedLine?.quantity || row.plannedQty), 0
  );
  const actualProcessTotal = operationActual;
  const independentVariance = actualProcessTotal - independentPlannedTotal;
  const paidProcessTotal = routeOperations.reduce((sum,op) => sum + paymentTotalFor(op), 0);
  const unpaidProcessBalance = Math.max(0, operationActual - paidProcessTotal);
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
    const amount = Math.max(0, value);
    const updatedAt = nowIso();
    if (selectedLine) {
      const lineKeyName = key === "salePrice" ? "unitPrice" : key;
      update(current => ({
        ...current,
        purchaseOrders: current.purchaseOrders.map(po => po.id !== selectedLine.poId ? po : {
          ...po, updatedAt,
          lines: po.lines.map(line => line.id === selectedLine.lineId ? { ...line, [lineKeyName]: amount } : line)
        })
      }));
      return;
    }
    const componentKey = key === "salePrice" ? "salePrice" : key;
    update(current => ({ ...current, components: current.components.map(component => component.id === selectedComponent.id ? { ...component, [componentKey]: amount, updatedAt } : component) }));
  };

  return <section className="workspace-page linked-costing-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO DATA · LOCAL UNTIL SERVER SYNC"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> FINANCE / COMPONENT + PROCESS RATE HISTORY</div><h1>Costing &amp; Payment<span>.</span></h1><p>Store every supplier rate against the exact component, PO line and operation; compare quotations without treating them as actual invoices.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendor directory</button><button className="button-primary" onClick={() => openQuote()} disabled={!selectedComponent}><Plus size={15}/> Add process quotation</button></div></div>
    {!components.length ? <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>No component master records yet</h3><p>There are no sample components. Add your actual part number once; then create a PO line, add the required operations and record supplier quotations per operation.</p><button className="button-primary" onClick={() => onSelectModule("components")}><Plus size={14}/> Create component master</button></div></section> : <>
      <section className="surface-panel company-cost-rollup">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPANY-WIDE FINANCIAL ANALYSIS</div><h3>All purchase orders · component profit / loss</h3><p>Aggregates every PO and component for the selected company. Select one, several or all POs to narrow the analysis.</p></div><span className="module-number">{visibleCompanyRollup.length} COMPONENT LINES</span></div>
        <div className="process-table-bulkbar"><label><input type="checkbox" checked={companyOrders.length>0&&companyOrders.every(po=>rollupPoIds.includes(po.id))} onChange={e=>setRollupPoIds(e.target.checked?companyOrders.map(po=>po.id):[])} /> Select all POs</label>{companyOrders.map(po=><label key={po.id}><input type="checkbox" checked={!rollupPoIds.length||rollupPoIds.includes(po.id)} onChange={e=>setRollupPoIds(current=>{const base=current.length?current:companyOrders.map(item=>item.id);const next=e.target.checked?[...new Set([...base,po.id])]:base.filter(id=>id!==po.id);return next.length===companyOrders.length?[]:next;})}/>{po.number}</label>)}<button className="button-quiet compact-button" onClick={()=>setRollupPoIds([])}>All POs</button></div>
        <div className="dashboard-job-summary company-rollup-totals">
          <div><strong>{money(companyRollupTotals.revenue)}</strong><span>Selected PO line value</span></div>
          <div><strong>{money(companyRollupTotals.planned)}</strong><span>Independent planned process cost</span></div>
          <div><strong>{money(companyRollupTotals.process)}</strong><span>Actual process cost recorded</span></div>
          <div><strong>{money(companyRollupTotals.transport)}</strong><span>Transport cost</span></div>
          <div><strong>{money(companyRollupTotals.paid)}</strong><span>Process amounts paid</span></div>
          <div><strong className={companyRollupTotals.profitLoss<0?"loss-value":"profit-value"}>{money(companyRollupTotals.profitLoss)}</strong><span>Recorded contribution / loss</span></div>
        </div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO</th><th>Component</th><th>Qty</th><th>PO value</th><th>Planned process</th><th>Actual process</th><th>Transport</th><th>Paid</th><th>Recorded balance</th><th>Contribution / loss</th></tr></thead><tbody>{visibleCompanyRollup.map(row=><tr key={row.po.id+":"+row.line.id}><td><strong>{row.po.number}</strong><small>{row.po.issueDate||"No PO date"}</small></td><td><strong>{row.component?.name||"Missing component"}</strong><small>{row.component?.partNumber||"—"}</small></td><td>{row.line.quantity.toLocaleString("en-IN")}</td><td>{money(row.revenue)}</td><td>{money(row.plannedCost)}</td><td>{money(row.processCost)}</td><td>{money(row.transportCost)}</td><td>{money(row.paid)}</td><td>{money(Math.max(0,row.recordedCost-row.paid))}</td><td><strong className={row.profitLoss<0?"loss-value":"profit-value"}>{money(row.profitLoss)}</strong></td></tr>)}</tbody></table></div>
        <div className="module-safety-note"><ShieldCheck size={14}/><span>Contribution is calculated as PO line value minus saved actual process and transport costs. Material, overhead, tax, finance and other costs not entered in the records are excluded; this is not an audited net-profit figure.</span></div>
      </section>
      <div className="linked-master-selectors linked-cost-selectors">
        <SearchablePicker id="cost-company" label="Company" value={companyId} placeholder="Select company…" options={companies.map(c=>({id:c.id,label:c.name}))} onChange={id=>{setCompanyId(id);setPoId("");setLineKey("");setOperationId("");setShowQuoteForm(false);}}/>
        <SearchablePicker id="cost-po" label="Purchase order" value={poId} placeholder="Select PO…" options={companyOrders.map(po=>({id:po.id,label:po.number+" · "+po.status}))} onChange={id=>{setPoId(id);setLineKey("");setOperationId("");setShowQuoteForm(false);}}/>
        <SearchablePicker id="cost-po-line" label="PO component line" value={selectedLine?.key||""} placeholder="Select component line…" options={componentLines.map(line=>({id:line.key,label:(components.find(c=>c.id===line.componentId)?.partNumber||"Part missing")+" · "+(components.find(c=>c.id===line.componentId)?.name||"")+" · "+line.quantity+" "+(components.find(c=>c.id===line.componentId)?.salePriceUnit==="set"?"sets":"pieces")"}))} onChange={key=>{setLineKey(key);setOperationId("");}}/>
        <SearchablePicker id="cost-operation" label="Process operation" value={selectedOperation?.id||""} placeholder="Select operation…" options={routeOperations.map(op=>({id:op.id,label:op.name+" · OP-"+op.sequence}))} onChange={setOperationId}/>
      </div>
      {!componentLines.length && <div className="module-safety-note"><FileText size={14}/><span>This component is not yet linked to a PO line. Create or edit the actual order in Purchase Orders; quotes will then be stored against that order line.</span><button className="button-quiet compact-button" onClick={() => onSelectModule("purchasing")}>Open purchase orders</button></div>}
      <div className="linked-component-summary"><div><small>COMPONENT</small><strong>{selectedComponent?.partNumber} · {selectedComponent?.name}</strong><span>Revision {selectedComponent?.revision || "—"} · Drawing {selectedComponent?.drawingReference || "—"}</span></div><div><small>MATERIAL COST</small><strong>{money(materialCost)}</strong><span>{materialQty.toLocaleString("en-IN")} units × {money(materialRate)} · {materialCostSource}</span></div><div><small>PROCESS + TRANSPORT</small><strong>{money(operationPlanned)}</strong><span>Rates selected or entered per operation</span></div><div><small>PLANNED COST / ACCEPTED PART</small><strong>{money(costPerAccepted)}</strong><span>Uses the selected PO quantity and entered rejects</span></div></div>
      <div className="linked-kpis linked-cost-kpis"><div className="route-kpi kpi-cost"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>PLANNED COST</small><strong>{money(plannedTotal)}</strong><em>Material + planned process + transport + entered extras</em></span></div><div className="route-kpi kpi-quality"><span className="kpi-icon"><Check size={19}/></span><span><small>ACTUAL RATE COST</small><strong>{money(actualTotal)}</strong><em>Actual operation rates only where recorded</em></span></div><div className="route-kpi kpi-delivery"><span className="kpi-icon"><Package size={19}/></span><span><small>ORDER VALUE</small><strong>{money(revenue)}</strong><em>{selectedLine?.quantity || 0} {selectedComponent?.salePriceUnit === "set" ? "sets" : "pieces"} × {money(sellingRate)}</em></span></div><div className="route-kpi kpi-risk"><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>ESTIMATED PROFIT / LOSS</small><strong>{money(profit)}</strong><em>Before GST/finance items not entered here</em></span></div></div>
      {independentPlannedCosts.length > 0 && <section className="surface-panel planned-cost-comparison">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> INDEPENDENT PLANNED COST REGISTER</div><h3>Planned vs actual process cost</h3><p>Matched by component name / number only. Planned Cost records remain independent of the operational PO and process records.</p></div><span className="module-number">{independentPlannedCosts.length} PLANNED PROCESS RATES</span></div>
        <div className="dashboard-job-summary">
          <div><strong>{money(independentPlannedTotal)}</strong><span>Planned cost at selected PO quantity</span></div>
          <div><strong>{money(actualProcessTotal)}</strong><span>Actual entered process + transport</span></div>
          <div><strong>{money(independentVariance)}</strong><span>{independentVariance > 0 ? "Actual above planned" : independentVariance < 0 ? "Actual below planned" : "Actual equals planned"}</span></div>
        </div>
      </section>}

      <section className="surface-panel costing-payment-summary">
  <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> PROCESS PAYMENT CONTROL</div><h3>Payment status for selected PO component</h3><p>Payment entries are stored per process operation in Process Plan.</p></div></div>
  <div className="dashboard-job-summary">
    <div><strong>{money(paidProcessTotal)}</strong><span>Paid / recorded payments</span></div>
    <div><strong>{money(unpaidProcessBalance)}</strong><span>Remaining actual process balance</span></div>
    <div><strong>{routeOperations.filter(op=>paymentTotalFor(op)<(op.quantity*(op.actualRatePerPart||0)+op.transportCost)).length}</strong><span>Operations with unpaid balance</span></div>
  </div>
  <button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><Wallet size={14}/> Update operation payments</button>
</section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUOTE-TO-OPERATION LINK</div><h3>Process costs for {selectedComponent?.partNumber}</h3><p>Each row references a specific operation ID and PO component line.</p></div><button className="button-quiet compact-button" onClick={() => onSelectModule("process-map")}><ArrowRight size={14}/> Manage operations</button></div>
        {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Operation</th><th>Vendor</th><th>Qty</th><th>Selected quote / rate</th><th>Actual rate / part</th><th>Transport</th><th>Planned process cost</th><th>Payment ledger</th><th>Quotes</th></tr></thead><tbody>{routeOperations.map(op => {
          const quoteCount = quotations.filter(q => q.operationId === op.id && !q.deletedAt).length;
          const vendor = vendors.find(v => v.id === op.vendorId);
          const paymentRows=paymentTransactions.filter(payment=>payment.operationId===op.id).sort((a,b)=>(a.paidAt||"").localeCompare(b.paidAt||""));
          return <tr key={op.id}><td><div className="cost-op-cell"><ProcessIcon processName={op.name} fallback={<Workflow size={17}/>} /><span><strong>{op.name}</strong><small>{op.category || "Type not entered"} · OP-{op.sequence}</small></span></div></td><td>{vendor?.company || "Not assigned"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{money(op.ratePerPart)}</td><td>{(op.actualRatePerPart || 0) > 0 ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.transportCost)}</td><td>{money(op.quantity * op.ratePerPart + op.transportCost)}</td><td><div className="payment-ledger-cell">{paymentRows.length?paymentRows.map(payment=><small key={payment.id}>{money(payment.amount)} · {payment.paidAt?new Date(payment.paidAt).toLocaleDateString("en-IN"):"Date not set"}{payment.reference?" · "+payment.reference:""}</small>):<small>{op.paidAmount? "Legacy recorded total: "+money(op.paidAmount):"No payment recorded"}</small>}<strong>Recorded: {money(paymentRows.length?paymentRows.reduce((sum,payment)=>sum+payment.amount,0):op.paidAmount||0)}</strong></div></td><td><button className="button-quiet compact-button" onClick={() => {openQuote(op.id);}}><Plus size={12}/> {quoteCount} · Add quote</button></td></tr>;
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
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLIER QUOTATION HISTORY</div><h3>Saved quotations ({quoteRows.length})</h3><p>All process operations for this selected component and PO line are shown here. The current operation selector does not hide earlier saved quotes.</p></div><label className="module-record-search"><Search size={14}/><input value={quoteSearch} onChange={e=>setQuoteSearch(e.target.value)} placeholder="Search quote, vendor, process…"/></label></div>
        {quoteRows.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendor</th><th>Quote reference</th><th>Quote date</th><th>Validity</th><th>Qty</th><th>Rate / part</th><th>Transport</th><th>Lead days</th><th>Status</th><th>Action</th></tr></thead><tbody>{quoteRows.map(q => <tr key={q.id}><td><div className="cost-op-cell cost-quote-process"><ProcessIcon processName={routeOperations.find(op=>op.id===q.operationId)?.name || "Archived operation"} fallback={<Workflow size={16}/>} /><span><strong>{routeOperations.find(op=>op.id===q.operationId)?.name || "Archived operation"}</strong><small>OP-{routeOperations.find(op=>op.id===q.operationId)?.sequence ?? "—"}</small></span></div></td><td>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</td><td>{q.quoteReference || "Not entered"}</td><td>{q.quotedAt || "—"}</td><td>{q.validUntil || "—"}</td><td>{q.quantity.toLocaleString("en-IN")}</td><td>{money(q.ratePerPart)}</td><td>{money(q.transportCost)}</td><td>{q.leadDays || "—"}</td><td><span className={"record-state state-" + q.status.toLowerCase()}>{q.status}</span></td><td>{q.status === "Selected" ? <span>Applied to operation</span> : <button className="button-primary compact-button" onClick={() => selectQuote(q)}><Check size={12}/> Use this rate</button>}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No quotations saved for this component/PO line/process yet.</div>}
      </section>
      <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COMPONENT OTHER COSTS</div><h3>Material, overhead and other entered costs</h3><p>When a PO line is selected, edits are saved to that line only so this order’s costs and rejects do not affect another order for the same part. Blank material defaults are estimated from linked BOM lines and their entered material rates; this is an estimate, not a supplier invoice.</p></div></div>
        <div className="module-record-form">
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Package size={15}/></span>Material quantity</span><input type="number" min="0" step="0.001" value={materialQty} onChange={e=>setExtra("materialQty",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><CircleDollarSign size={15}/></span>Material rate per unit (₹)</span><input type="number" min="0" step="0.01" value={materialRate} onChange={e=>setExtra("materialRate",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Gauge size={15}/></span>Benchmark material rate (₹)</span><input type="number" min="0" step="0.01" value={benchmarkMaterialRate} onChange={e=>setExtra("benchmarkMaterialRate",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Wallet size={15}/></span>Selling rate per part (₹)</span><input type="number" min="0" step="0.01" value={sellingRate} onChange={e=>setExtra("salePrice",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Activity size={15}/></span>Overhead (₹)</span><input type="number" min="0" step="0.01" value={overhead} onChange={e=>setExtra("overhead",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Wrench size={15}/></span>Tooling / fixture (₹)</span><input type="number" min="0" step="0.01" value={toolingCost} onChange={e=>setExtra("toolingCost",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><RotateCcw size={15}/></span>Rework cost (₹)</span><input type="number" min="0" step="0.01" value={reworkCost} onChange={e=>setExtra("reworkCost",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><Recycle size={15}/></span>Scrap / rejection loss (₹)</span><input type="number" min="0" step="0.01" value={scrapCost} onChange={e=>setExtra("scrapCost",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><ShieldCheck size={15}/></span>Rejected quantity (pcs)</span><input type="number" min="0" value={rejectedQty} onChange={e=>setExtra("rejectedQty",Number(e.target.value)||0)}/></label>
          <label className="costing-input-field"><span className="costing-input-heading"><span className="costing-input-icon"><FileText size={15}/></span>GST rate (%)</span><input type="number" min="0" max="100" step="0.01" value={gstRate} onChange={e=>setExtra("gstRate",Math.min(100,Number(e.target.value)||0))}/></label>
        </div>
        <div className="linked-cost-summary-lines">
          <div><span>Material input · quantity × rate</span><strong>{materialQty.toLocaleString("en-IN")} × {money(materialRate)} = {money(materialCost)}</strong></div>
          <div><span>Overhead item</span><strong>{money(overhead)}</strong></div>
          <div><span>Tooling / fixture item</span><strong>{money(toolingCost)}</strong></div>
          <div><span>Rework item</span><strong>{money(reworkCost)}</strong></div>
          <div><span>Scrap / rejection loss item</span><strong>{money(scrapCost)}</strong></div>
          <div><span>Rejected quantity</span><strong>{rejectedQty.toLocaleString("en-IN")} pcs</strong></div>
          <div><span>GST input</span><strong>{gstRate}% · {money(gstEstimate)}</strong></div>
          <div><span>Entered material cost</span><strong>{money(materialCost)}</strong></div><div><span>Material cost source</span><strong>{materialCostSource}</strong></div><div><span>Entered benchmark material value (not live market data)</span><strong>{money(benchmarkMaterialCost)}</strong></div><div><span>Material variance vs entered benchmark</span><strong>{money(materialVariance)}</strong></div><div><span>Planned process + transport</span><strong>{money(operationPlanned)}</strong></div><div><span>Entered overhead / tooling / rework / scrap</span><strong>{money(extraCharges)}</strong></div><div><span>Planned total before GST</span><strong>{money(plannedTotal)}</strong></div><div><span>Entered material/extras + actual operation rates (missing actual rates count as zero)</span><strong>{money(actualTotal)}</strong></div><div><span>Estimated P/L before GST</span><strong>{money(profit)}</strong></div><div><span>Entered GST rate / illustrative GST on order value</span><strong>{gstRate}% · {money(gstEstimate)}</strong></div></div>
      </section>
    </>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Quotation amounts are supplier inputs, not live market benchmarks. Selecting a quote updates the operation's planned vendor/rate; it does not mark it as an invoice or actual expense.</span></div>
  </section>;
}
