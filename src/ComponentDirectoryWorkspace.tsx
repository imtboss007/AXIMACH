import { useMemo, useState } from "react";
import { ArrowRight, Boxes, CircleDollarSign, FileText, Search, Workflow } from "lucide-react";
import { activeRows, useManufacturingData, type OperationRecord } from "./manufacturingData";

type Props = { onBack:()=>void; onNotice:(value:string)=>void; onSelectModule:(id:string)=>void };
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const date=(value?:string)=>value?new Date(value+"T12:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";

export default function ComponentDirectoryWorkspace({onBack,onNotice,onSelectModule}:Props){
  const {data}=useManufacturingData();
  const components=activeRows(data.components);
  const orders=activeRows(data.purchaseOrders);
  const operations=activeRows(data.operations);
  const vendors=activeRows(data.vendors);
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [poFilter,setPoFilter]=useState("all");
  const visible=useMemo(()=>components.filter(c=>(c.partNumber+" "+c.name+" "+c.revision+" "+c.material+" "+c.drawingReference).toLowerCase().includes(query.toLowerCase().trim())),[components,query]);
  const selected=components.find(c=>c.id===selectedId)||visible[0];
  const linkedLines=orders.flatMap(po=>po.lines.filter(line=>line.componentId===selected?.id).map(line=>({po,line}))).filter(row=>poFilter==="all"||row.po.id===poFilter);
  const routeFor=(lineId:string)=>operations.filter(op=>op.poLineId===lineId&&!op.deletedAt).sort((a,b)=>a.sequence-b.sequence);
  const materialCost=(selected?.materialQty||0)*(selected?.materialRate||0);
  const baseCost=materialCost+(selected?.overhead||0)+(selected?.toolingCost||0)+(selected?.reworkCost||0)+(selected?.scrapCost||0);
  const componentOperations=operations.filter(op=>op.componentId===selected?.id&&!op.deletedAt);
  const processCostPerPart=componentOperations.reduce((sum,op)=>sum+(op.ratePerPart||0)+(op.quantity>0?(op.transportCost||0)/op.quantity:0),0);
  const fullyProcessed=baseCost+processCostPerPart;
  const missing=componentOperations.filter(op=>!(op.ratePerPart>0)).length;
  return <section className="workspace-page component-directory-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> COMPONENT COST LEDGER</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / COMPONENT INTELLIGENCE</div><h1>Component Directory<span>.</span></h1><p>One permanent component record, its PO history, complete process route and fully processed cost.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("components")}>Edit Component Master</button><button className="button-primary" onClick={()=>onSelectModule("costing")}><CircleDollarSign size={15}/> Costing & Payments</button></div></div>
    <div className="component-directory-layout">
      <aside className="surface-panel component-directory-list"><div className="panel-heading"><div><div className="eyebrow">COMPONENT MASTER</div><h3>{components.length} saved components</h3></div></div><label className="module-record-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search part number, name, material…"/></label><div className="component-directory-items">{visible.map(item=><button key={item.id} className={"component-directory-item "+(selected?.id===item.id?"active":"")} onClick={()=>setSelectedId(item.id)}><Boxes size={16}/><span><strong>{item.partNumber} · {item.name}</strong><small>Rev {item.revision||"—"} · {item.material||"Material not set"}</small></span></button>)}{!visible.length&&<p className="process-directory-empty">No matching components.</p>}</div></aside>
      <main className="component-directory-detail">{selected?<><section className="surface-panel component-directory-summary"><div><div className="eyebrow">SELECTED COMPONENT</div><h2>{selected.partNumber} — {selected.name}</h2><p>Revision {selected.revision||"—"} · {selected.material||"Material not entered"} · {selected.drawingReference||"No drawing reference"}</p></div><button className="button-quiet compact-button" onClick={()=>onSelectModule("process-map")}><Workflow size={14}/> Open Process Map</button></section>
      <div className="component-directory-kpis"><article><small>Component base cost / pc</small><strong>{money(baseCost)}</strong><span>Material + overhead + tooling + rework + scrap</span></article><article><small>Process cost / pc</small><strong>{money(processCostPerPart)}</strong><span>{componentOperations.length} saved process operations</span></article><article><small>Fully processed cost / pc</small><strong>{money(fullyProcessed)}</strong><span>Base cost plus all linked process rates</span></article><article><small>Missing process rates</small><strong>{missing}</strong><span>Incomplete routes are flagged</span></article></div>
      <section className="surface-panel component-directory-routes"><div className="panel-heading"><div><div className="eyebrow">PURCHASE ORDER COMPARISON</div><h3>PO price vs fully processed cost</h3><p>Each PO line is compared separately using its saved unit price and quantity.</p></div><select aria-label="Filter purchase orders" value={poFilter} onChange={e=>setPoFilter(e.target.value)}><option value="all">All purchase orders</option>{orders.filter(po=>po.lines.some(line=>line.componentId===selected.id)).map(po=><option key={po.id} value={po.id}>{po.number}</option>)}</select></div>
      {linkedLines.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO</th><th>Qty</th><th>PO price / pc</th><th>Processed cost / pc</th><th>Difference / pc</th><th>Total difference</th><th>Route</th></tr></thead><tbody>{linkedLines.map(({po,line})=>{const diff=line.unitPrice-fullyProcessed;const total=diff*line.quantity;const route=routeFor(line.id);return <tr key={po.id+line.id}><td>{po.number}</td><td>{line.quantity.toLocaleString("en-IN")}</td><td>{money(line.unitPrice)}</td><td>{money(fullyProcessed)}</td><td className={diff>=0?"cost-positive":"cost-negative"}>{money(diff)}</td><td className={total>=0?"cost-positive":"cost-negative"}>{money(total)}</td><td><button className="inline-module-link" onClick={()=>onSelectModule("process-map")}>{route.length} operations · Open route</button></td></tr>})}</tbody></table></div>:<p className="process-directory-empty">No purchase-order lines are linked to this component yet.</p>}</section>
      <section className="surface-panel component-directory-routes"><div className="panel-heading"><div><div className="eyebrow">PROCESS COST REGISTER</div><h3>All saved operations for this component</h3><p>Vendor, dates, quantity, rate, transport and payment status are read from Process Map.</p></div></div>{componentOperations.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendor</th><th>Start</th><th>Due</th><th>Qty</th><th>Rate / pc</th><th>Transport</th><th>Payment</th><th>Total process cost</th></tr></thead><tbody>{componentOperations.map(op=><tr key={op.id}><td>{op.name}</td><td>{vendors.find(v=>v.id===op.vendorId)?.company||"In-house"}</td><td>{date(op.plannedStart)}</td><td>{date(op.plannedEnd)}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{money(op.ratePerPart)}</td><td>{money(op.transportCost)}</td><td>{op.vendorId?(op.vendorPaymentStatus||"Not Paid"):"—"}</td><td>{money(op.quantity*op.ratePerPart+op.transportCost)}</td></tr>)}</tbody></table></div>:<p className="process-directory-empty">No process operations saved for this component yet.</p>}</section>
      <p className="module-safety-note"><FileText size={14}/> Cost figures use saved component master and operation values. Missing rates are not treated as validated zero-cost operations. The component-level summary aggregates its saved operations; PO-specific totals above are the commercial comparison.</p>
      </>:<div className="surface-panel process-directory-empty">Add a component in Component Master to start its permanent process and cost record.</div>}</main>
    </div>
  </section>;
}
