import { useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowRight, BarChart3, CalendarClock, CheckCircle2, CircleDollarSign, ClipboardCheck, Package, ShieldAlert, ShieldCheck, Truck, Workflow } from "lucide-react";
import { activeRows, useManufacturingData } from "./manufacturingData";

type Props={onBack:()=>void;onSelectModule:(id:string)=>void};
type Period="7"|"30"|"90"|"all";
const today=()=>new Date().toISOString().slice(0,10);
const daysAgo=(n:number)=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
const inPeriod=(date:string|undefined,period:Period)=>period==="all"||!!date&&(date.slice(0,10)>=daysAgo(Number(period))&&date.slice(0,10)<=today());
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});

export default function AIInsightsWorkspace({onBack,onSelectModule}:Props){
  const {data,syncStatus}=useManufacturingData();
  const [period,setPeriod]=useState<Period>("30");
  const operations=activeRows(data.operations);
  const orders=activeRows(data.purchaseOrders);
  const components=activeRows(data.components);
  const materials=activeRows(data.materials);
  const bom=activeRows(data.bomLines);
  const inspections=activeRows(data.qualityInspections);
  const processTypes=activeRows(data.processTypes);
  const vendors=activeRows(data.vendors);
  const rates=activeRows(data.processVendorRates);
  const transactions=data.inventoryTransactions;
  const windowOperations=operations.filter(row=>inPeriod(row.actualEnd||row.plannedEnd||row.updatedAt,period));
  const windowInspections=inspections.filter(row=>inPeriod(row.inspectionDate||row.updatedAt,period));
  const windowRates=rates.filter(row=>inPeriod(row.quotedAt||row.createdAt,period));
  const overdue=windowOperations.filter(row=>row.status!=="Complete"&&!!row.plannedEnd&&row.plannedEnd<today());
  const nearDue=windowOperations.filter(row=>row.status!=="Complete"&&!!row.plannedEnd&&row.plannedEnd>=today()&&row.plannedEnd<=daysAgo(-7));
  const holdOperations=windowOperations.filter(row=>row.status==="Quality hold");
  const rejected=windowInspections.reduce((sum,row)=>sum+(Number(row.rejectedQty)||0),0);
  const inspected=windowInspections.reduce((sum,row)=>sum+(Number(row.inspectedQty)||0),0);
  const rejectionRate=inspected?rejected/inspected*100:0;
  const qualityByOperation=useMemo(()=>{
    const grouped=new Map<string,{operationId:string;name:string;inspected:number;rejected:number}>();
    for(const row of windowInspections){
      const entry=grouped.get(row.operationId)||{operationId:row.operationId,name:data.operations.find(op=>op.id===row.operationId)?.name||"Operation unavailable",inspected:0,rejected:0};
      entry.inspected+=Number(row.inspectedQty)||0;entry.rejected+=Number(row.rejectedQty)||0;grouped.set(row.operationId,entry);
    }
    return [...grouped.values()].filter(row=>row.inspected>0).map(row=>({...row,rate:row.rejected/row.inspected*100})).sort((a,b)=>b.rate-a.rate).slice(0,5);
  },[windowInspections,data.operations]);
  const quoteSpread=useMemo(()=>processTypes.map(type=>{
    const quotes=windowRates.filter(row=>row.processTypeId===type.id&&row.status!=="Rejected"&&row.status!=="Expired"&&(!row.validFrom||row.validFrom<=today())&&(!row.validUntil||row.validUntil>=today()));
    if(quotes.length<2)return null;
    const sorted=quotes.slice().sort((a,b)=>a.ratePerPart-b.ratePerPart);
    const low=sorted[0],high=sorted[sorted.length-1];
    return {id:type.id,name:type.name,low,high,spread:high.ratePerPart-low.ratePerPart,pct:low.ratePerPart>0?(high.ratePerPart-low.ratePerPart)/low.ratePerPart*100:undefined,vendorCount:new Set(quotes.map(row=>row.vendorId)).size};
  }).filter((row):row is NonNullable<typeof row>=>!!row&&row.vendorCount>1).sort((a,b)=>b.spread-a.spread).slice(0,6),[processTypes,windowRates]);
  const openLines=orders.filter(po=>!["complete","cancelled","closed"].includes(String(po.status||"").toLowerCase())).flatMap(po=>po.lines.filter(line=>!("deletedAt" in line&&(line as typeof line & {deletedAt?:string}).deletedAt)).map(line=>({po,line})));
  const requiredByMaterial=new Map<string,number>();
  for(const entry of openLines)for(const bomLine of bom.filter(row=>row.componentId===entry.line.componentId)){
    const requirement=bomLine.quantityPerPart*(1+(bomLine.scrapPercent||0)/100)*entry.line.quantity;
    requiredByMaterial.set(bomLine.materialId,(requiredByMaterial.get(bomLine.materialId)||0)+requirement);
  }
  const availableByMaterial=new Map<string,number>();
  for(const row of transactions){
    if(row.itemType!=="material")continue;
    const locationType=row.locationType||(row.factoryId?"factory":row.vendorId?"vendor":row.companyId?"company":undefined);
    if(locationType!=="company"&&locationType!=="factory")continue;
    availableByMaterial.set(row.itemId,(availableByMaterial.get(row.itemId)||0)+(row.direction==="in"?row.quantity:-row.quantity));
  }
  const materialGaps=[...requiredByMaterial.entries()].map(([id,required])=>{
    const material=materials.find(row=>row.id===id);
    const available=availableByMaterial.get(id)||0;
    return {id,name:material?.name||"Material unavailable",code:material?.code||id,unit:material?.unit||"",required,available,gap:required-available};
  }).filter(row=>row.gap>0).sort((a,b)=>b.gap-a.gap).slice(0,8);
  const deliveryLines=openLines.map(({po,line})=>({po,line,due:line.targetDelivery||po.targetDelivery,component:components.find(row=>row.id===line.componentId)})).filter(row=>!!row.due);
  const lateDeliveries=deliveryLines.filter(row=>row.due<today());
  const nextDeliveries=deliveryLines.filter(row=>row.due>=today()&&row.due<=daysAgo(-7));
  const periodLabel=period==="all"?"All saved history":"Last "+period+" days";
  return <section className="workspace-page module-functional-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command Centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED DATA":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR":"LOCAL DATA"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow">INSIGHTS / EVIDENCE-BASED ANALYSIS</div><h1>AI Insights<span>.</span></h1><p>Read-only analysis of saved AXIMACH records: production delay, vendor quote spread, quality results, delivery exposure and gross BOM/material coverage.</p></div><div className="workspace-title-actions"><label>Reporting period<select value={period} onChange={event=>setPeriod(event.target.value as Period)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All saved history</option></select></label></div></div>
    <section className="surface-panel module-safety-note"><ShieldCheck size={15}/><span>AI inference is not connected. These are deterministic, source-linked checks—not AI-generated predictions. No production, quality, payment, inventory or vendor record is changed automatically. Period: {periodLabel}.</span></section>
    <section className="metric-grid">
      <article className="metric-card"><div className="metric-card-top"><span>Overdue operations</span><AlertTriangle size={17}/></div><strong className="metric-number">{overdue.length}</strong><div className="metric-card-bottom"><span>Target date passed</span><span>Not complete</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Due within 7 days</span><CalendarClock size={17}/></div><strong className="metric-number">{nearDue.length}</strong><div className="metric-card-bottom"><span>Open operation targets</span><span>Saved dates</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Quality rejection rate</span><ClipboardCheck size={17}/></div><strong className="metric-number">{inspected?rejectionRate.toFixed(1)+"%":"—"}</strong><div className="metric-card-bottom"><span>{rejected.toLocaleString("en-IN")} rejected</span><span>{inspected.toLocaleString("en-IN")} inspected</span></div></article>
      <article className="metric-card"><div className="metric-card-top"><span>Quality holds</span><ShieldAlert size={17}/></div><strong className="metric-number">{holdOperations.length}</strong><div className="metric-card-bottom"><span>Operations marked</span><span>Quality hold</span></div></article>
    </section>
    <div className="dashboard-grid actual-data-dashboard">
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">PRODUCTION RISK</div><h3>Delay and schedule signals</h3><p>Source: Process Map planned / actual end dates. Open a row to inspect its saved route.</p></div><Activity size={18}/></div>
        {overdue.length?overdue.slice(0,6).map(op=><button className="attention-row" key={op.id} onClick={()=>{const po=orders.find(row=>row.id===op.poId);if(po)onSelectModule("production");}}><span className="attention-symbol red-symbol"><AlertTriangle size={16}/></span><span className="attention-copy"><strong>{op.name}</strong><small>{orders.find(po=>po.id===op.poId)?.number||"PO"} · {op.plannedEnd} target</small><em>Open Process Map to review</em></span><ArrowRight size={15}/></button>):<div className="vendor-empty"><CheckCircle2 size={16}/> No overdue operations in this reporting period.</div>}
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("production")}>Open Production Planning <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">VENDOR QUOTE DIVERGENCE</div><h3>Saved rate spreads</h3><p>Source: current-valid, non-rejected Process Directory quotes with multiple vendors for the same process type.</p></div><CircleDollarSign size={18}/></div>
        {quoteSpread.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendors</th><th>Lowest</th><th>Highest</th><th>Spread</th></tr></thead><tbody>{quoteSpread.map(row=><tr key={row.id}><td>{row.name}</td><td>{row.vendorCount}</td><td>{money(row.low.ratePerPart)} · {vendors.find(v=>v.id===row.low.vendorId)?.company||"Vendor"}</td><td>{money(row.high.ratePerPart)} · {vendors.find(v=>v.id===row.high.vendorId)?.company||"Vendor"}</td><td>{money(row.spread)}{row.pct===undefined?"":" · "+row.pct.toFixed(1)+"%"}</td></tr>)}</tbody></table></div>:<div className="vendor-empty">No process has multiple valid saved vendor quotes in this period.</div>}
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("process-master")}>Open Process Directory <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">QUALITY SIGNALS</div><h3>Operation rejection share</h3><p>Source: summed inspection-event quantities in this period. Events are not deduplicated by serial or lot.</p></div><BarChart3 size={18}/></div>
        {qualityByOperation.length?qualityByOperation.map(row=><div className="job-row" key={row.operationId}><span className="job-number"><ClipboardCheck size={14}/></span><span className="job-main"><strong>{row.name}</strong><small>{row.rejected} rejected / {row.inspected} inspected</small></span><span className="job-chip">{row.rate.toFixed(1)}%</span></div>):<div className="vendor-empty">No inspection quantities recorded in this period.</div>}
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("quality")}>Open Quality & Inspection <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">DELIVERY EXPOSURE</div><h3>PO delivery dates</h3><p>Source: open PO component-line due dates. Dates are contractual targets, not predicted dispatch dates.</p></div><Truck size={18}/></div>
        <div className="movement-facts"><div><small>OVERDUE LINES</small><strong>{lateDeliveries.length}</strong></div><div><small>DUE NEXT 7 DAYS</small><strong>{nextDeliveries.length}</strong></div></div>
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("dispatch")}>Open Dispatch & Delivery <ArrowRight size={14}/></button>
      </section>
      <section className="surface-panel attention-panel"><div className="panel-heading"><div><div className="eyebrow">MATERIAL COVERAGE</div><h3>Gross BOM stock gaps</h3><p>Available material is company / legacy factory ledger stock. Demand is open PO quantity × BOM usage × scrap factor.</p></div><Package size={18}/></div>
        {materialGaps.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Material</th><th>Gross demand</th><th>Recorded stock</th><th>Gap</th></tr></thead><tbody>{materialGaps.map(row=><tr key={row.id}><td>{row.code} · {row.name}</td><td>{row.required.toLocaleString("en-IN")} {row.unit}</td><td>{row.available.toLocaleString("en-IN")} {row.unit}</td><td><strong>{row.gap.toLocaleString("en-IN")} {row.unit}</strong></td></tr>)}</tbody></table></div>:<div className="vendor-empty">No gross BOM stock gaps are calculable from the saved stock ledger and open PO lines.</div>}
        <button className="button-quiet compact-button" onClick={()=>onSelectModule("inventory")}>Open Material & Inventory <ArrowRight size={14}/></button>
      </section>
    </div>
    <section className="surface-panel module-safety-note"><ShieldCheck size={15}/><span>Material demand is gross, based on BOM consumption for open PO quantities; it is not netted for unposted consumption, purchase commitments or partial production. Stock excludes vendor and transit locations. Rate spread is not an approved purchase recommendation. Set management thresholds and connect an AI inference provider before treating any signal as a predictive alert.</span></section>
  </section>;
}
