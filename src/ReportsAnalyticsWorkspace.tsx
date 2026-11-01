import { useMemo, useState } from "react";
import { Activity, ArrowRight, BarChart3, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardCheck, Package, ShieldAlert, Truck, Workflow } from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";

type Props = { onBack:()=>void; onSelectModule:(id:string)=>void };
type Period = "7"|"30"|"90"|"all";
const day=()=>new Date().toISOString().slice(0,10);
const ago=(n:number)=>{const date=new Date();date.setDate(date.getDate()-n);return date.toISOString().slice(0,10);};
const money=(v:number)=>"₹"+(Number(v)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const inPeriod=(value:string|undefined,period:Period)=>period==="all"||(!value?false:value.slice(0,10)>=ago(Number(period))&&value.slice(0,10)<=day());

export default function ReportsAnalyticsWorkspace({onBack,onSelectModule}:Props){
  const {data,syncStatus}=useManufacturingData();
  const [period,setPeriod]=useState<Period>("30");
  const companies=activeRows(data.companies);
  const orders=activeRows(data.purchaseOrders);
  const components=activeRows(data.components);
  const vendors=activeRows(data.vendors);
  const operations=activeRows(data.operations);
  const inspections=activeRows(data.qualityInspections);
  const quotations=activeRows(data.processVendorRates);
  const wip=activeRows(data.wipTransfers);
  const dispatches=activeRows(data.customerDispatches);
  const windowOperations=operations.filter(row=>inPeriod(row.actualEnd||row.plannedEnd||row.updatedAt,period));
  const windowInspections=inspections.filter(row=>inPeriod(row.inspectionDate||row.updatedAt,period));
  const windowQuotes=quotations.filter(row=>inPeriod(row.quotedAt||row.createdAt,period));
  const windowWip=wip.filter(row=>inPeriod(row.preparedAt||row.createdAt,period));
  const windowDispatches=dispatches.filter(row=>inPeriod(row.actualDispatchDate||row.dispatchDate||row.createdAt,period));
  const overdue=windowOperations.filter(row=>row.status!=="Complete"&&row.plannedEnd&&row.plannedEnd<day());
  const paid=windowOperations.filter(row=>row.vendorId&&(row.vendorPaymentStatus||"Not Paid")==="Paid");
  const unpaid=windowOperations.filter(row=>row.vendorId&&(row.vendorPaymentStatus||"Not Paid")!=="Paid");
  const accepted=windowInspections.reduce((sum,row)=>sum+(Number(row.acceptedQty)||0),0);
  const rejected=windowInspections.reduce((sum,row)=>sum+(Number(row.rejectedQty)||0),0);
  const inspected=windowInspections.reduce((sum,row)=>sum+(Number(row.inspectedQty)||0),0);
  const rejectionRate=inspected>0?rejected/inspected*100:0;
  const dueLines=orders.flatMap(po=>po.lines.filter(line=>!("deletedAt" in line&&(line as typeof line & {deletedAt?:string}).deletedAt).map(line=>({po,line,due:line.targetDelivery||po.targetDelivery,component:components.find(c=>c.id===line.componentId)})));
  const overdueDeliveries=dueLines.filter(row=>row.due&&row.due<day()&&row.po.status!=="Complete"&&row.po.status!=="Cancelled");
  const quoteSummary=useMemo(()=>data.processTypes.filter(type=>!type.deletedAt).map(type=>{
    const rows=windowQuotes.filter(q=>q.processTypeId===type.id&&q.status!=="Rejected");
    return {id:type.id,name:type.name,category:data.processCategories.find(c=>c.id===type.categoryId)?.name||"Category unavailable",vendors:new Set(rows.map(q=>q.vendorId)).size,quotes:rows.length,lowest:rows.length?Math.min(...rows.map(q=>q.ratePerPart)):undefined};
  }).filter(row=>row.quotes>0).sort((a,b)=>a.name.localeCompare(b.name)),[data.processTypes,data.processCategories,windowQuotes]);
  const completed=windowOperations.filter(row=>row.status==="Complete").length;
  const inProgress=windowOperations.filter(row=>row.status==="Running").length;
  const open=windowOperations.filter(row=>row.status==="Queued").length;
  const transitWip=windowWip.filter(row=>row.status==="In transit"||row.status==="Partially received").length;
  const transitDispatch=windowDispatches.filter(row=>row.status==="In transit"||row.status==="Partially delivered").length;
  const label=period==="all"?"All saved history":"Last "+period+" days";
  return <section className="workspace-page module-functional-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command Centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED DATA":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR":"LOCAL DATA"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow">INSIGHTS / SOURCE-LINKED REPORTS</div><h1>Reports & Analytics<span>.</span></h1><p>Operational reports calculated from saved AXIMACH records. Each section states its source and reporting window; no sample or forecast values are added.</p></div><div className="workspace-title-actions"><label>Reporting period<select value={period} onChange={event=>setPeriod(event.target.value as Period)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All saved history</option></select></label></div></div>
    <section className="surface-panel quality-selection-panel"><div className="panel-heading"><div><h3>Report scope</h3><p>{label}. Operations use actual end / planned end / updated date; inspections use inspection date; quotations use quoted date; WIP and dispatch use movement / preparation dates.</p></div><span className="module-number">SOURCE: SAVED AXIMACH DATA</span></div>
      <div className="movement-facts"><div><small>COMPANIES</small><strong>{companies.length}</strong></div><div><small>ORDERS</small><strong>{orders.length}</strong></div><div><small>COMPONENTS</small><strong>{components.length}</strong></div><div><small>VENDORS</small><strong>{vendors.length}</strong></div></div>
    </section>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-card-top"><span>Operations in period</span><span className="metric-icon blue"><Activity size={17}/></span></div><strong className="metric-number">{windowOperations.length}</strong><div className="metric-card-bottom"><span>{completed} complete · {inProgress} running</span><span>{open} queued</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Overdue operations</span><span className="metric-icon amber"><ShieldAlert size={17}/></span></div><strong className="metric-number">{overdue.length}</strong><div className="metric-card-bottom"><span>Target date passed</span><span>Not complete</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Inspected quantity</span><span className="metric-icon violet"><ClipboardCheck size={17}/></span></div><strong className="metric-number">{inspected.toLocaleString("en-IN")}</strong><div className="metric-card-bottom"><span>{accepted.toLocaleString("en-IN")} accepted</span><span>{rejected.toLocaleString("en-IN")} rejected</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Inspection rejection rate</span><span className="metric-icon red"><BarChart3 size={17}/></span></div><strong className="metric-number">{inspected?rejectionRate.toFixed(1)+"%":"—"}</strong><div className="metric-card-bottom"><span>Rejected ÷ inspected</span><span>{inspected?"Recorded quantity":"No inspection quantity"}</span></div></article>
    </section>
    <div className="dashboard-grid actual-data-dashboard">
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">PRODUCTION</div><h3>Operation status</h3><p>Source: Process Map operation records · {label}.</p></div><Workflow size={18}/></div>
        <div className="movement-facts"><div><small>QUEUED</small><strong>{open}</strong></div><div><small>RUNNING</small><strong>{inProgress}</strong></div><div><small>COMPLETE</small><strong>{completed}</strong></div><div><small>QUALITY HOLD</small><strong>{windowOperations.filter(row=>row.status==="Quality hold").length}</strong></div></div>
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("production")}>Open Process Map <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">DELIVERY</div><h3>PO dates requiring review</h3><p>Source: PO component-line delivery dates. These are dated commitments, not confirmed shipment forecasts.</p></div><CalendarClock size={18}/></div>
        {overdueDeliveries.length?overdueDeliveries.slice(0,7).map(row=><div className="job-row" key={row.po.id+":"+row.line.id}><span className="job-number"><Package size={14}/></span><span className="job-main"><strong>{row.po.number} · {row.component?.partNumber||"Component"}</strong><small>{row.line.quantity.toLocaleString("en-IN")} pcs · Due {row.due}</small></span><span className="job-chip">Overdue</span></div>):<div className="vendor-empty">No overdue PO component-line dates are recorded.</div>}
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("dispatch")}>Open Dispatch & Delivery <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">VENDOR PAYMENTS</div><h3>Payment status</h3><p>Source: vendor-assigned operation Paid / Not Paid field in Process Map. No invoice or payment record is inferred.</p></div><CircleDollarSign size={18}/></div>
        <div className="movement-facts"><div><small>PAID OPERATIONS</small><strong>{paid.length}</strong></div><div><small>NOT PAID / UNSET</small><strong>{unpaid.length}</strong></div></div>
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("production")}>Review in Process Map <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">QUALITY</div><h3>Inspection records</h3><p>Source: quality inspection register · {windowInspections.length} records in period.</p></div><ClipboardCheck size={18}/></div>
        <div className="movement-facts"><div><small>ACCEPTED</small><strong>{accepted.toLocaleString("en-IN")}</strong></div><div><small>REJECTED</small><strong>{rejected.toLocaleString("en-IN")}</strong></div><div><small>PENDING / HOLD</small><strong>{windowInspections.filter(row=>row.status==="Pending"||row.status==="Hold"||row.status==="Conditional").length}</strong></div></div>
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("quality")}>Open Quality & Inspection <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">PROCESS VENDOR RATES</div><h3>Vendor quote coverage</h3><p>Source: Process Directory quotations received in the selected period. Lowest rate is among saved non-rejected quotes; validity still requires review.</p></div><CircleDollarSign size={18}/></div>
        {quoteSummary.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Category</th><th>Quotes</th><th>Vendors</th><th>Lowest entered rate / part</th></tr></thead><tbody>{quoteSummary.slice(0,10).map(row=><tr key={row.id}><td>{row.name}</td><td>{row.category}</td><td>{row.quotes}</td><td>{row.vendors}</td><td>{row.lowest===undefined?"—":money(row.lowest)}</td></tr>)}</tbody></table></div>:<div className="vendor-empty">No process-vendor quotations in this period.</div>}
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("process-master")}>Open Process Directory <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">CUSTODY / DELIVERY</div><h3>Movement status</h3><p>Source: WIP transfer and customer dispatch registers, filtered by preparation / dispatch date.</p></div><Truck size={18}/></div>
        <div className="movement-facts"><div><small>WIP RECORDS</small><strong>{windowWip.length}</strong></div><div><small>WIP IN TRANSIT</small><strong>{transitWip}</strong></div><div><small>SHIPMENTS</small><strong>{windowDispatches.length}</strong></div><div><small>SHIPMENTS IN TRANSIT</small><strong>{transitDispatch}</strong></div></div>
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("dispatch")}>Open movement register <ArrowRight size={14}/></button>
      </section>
    </div>
    <section className="surface-panel module-safety-note"><ShieldCheck size={15}/><span>Period reports exclude records whose relevant date is blank. Inspection quantities are summed across inspection events, not deduplicated serial/lot units. Vendor rate summaries are entered quote values, not market prices or approved purchase commitments. Payment status is a process status, not a bank reconciliation.</span></section>
  </section>;
}
