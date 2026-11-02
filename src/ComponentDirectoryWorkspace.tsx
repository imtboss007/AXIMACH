import { useMemo, useState } from "react";
import { ArrowRight, Boxes, Calculator, Check, CircleDollarSign, FileText, Pencil, Plus, Search, ShieldCheck, Trash2, Workflow, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, vendorSupportsProcessType, type ComponentProcessCostRecord, type PurchaseOrderLine, type OperationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import { componentBaselinePerPart } from "./costLedger";

type Props = { onBack:()=>void; onNotice:(value:string)=>void; onSelectModule:(id:string)=>void; onOpenOperation?:(selection:{companyId:string;factoryId:string;poId:string;poLineId:string;operationId:string})=>void };
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const date=(value?:string)=>value?new Date(value+"T12:00:00").toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";

export default function ComponentDirectoryWorkspace({onBack,onNotice,onSelectModule,onOpenOperation}:Props){
  const {data,update}=useManufacturingData();
  const components=activeRows(data.components);
  const orders=activeRows(data.purchaseOrders);
  const operations=activeRows(data.operations);
  const vendors=activeRows(data.vendors);
  const processTypes=activeRows(data.processTypes);
  const processVendorRates=activeRows(data.processVendorRates);
  const standardRecords=activeRows(data.componentProcessCosts||[]);
  const [query,setQuery]=useState("");
  const [selectedId,setSelectedId]=useState("");
  const [poFilter,setPoFilter]=useState("all");
  const [showStandardCostForm,setShowStandardCostForm]=useState(false);
  const [editingStandardCostId,setEditingStandardCostId]=useState("");
  const [standardProcessTypeId,setStandardProcessTypeId]=useState("");
  const [standardVendorId,setStandardVendorId]=useState("");
  const [standardQuantityPerPart,setStandardQuantityPerPart]=useState("1");
  const [standardRatePerProcess,setStandardRatePerProcess]=useState("");
  const [standardTransportPerPart,setStandardTransportPerPart]=useState("");
  const [standardNotes,setStandardNotes]=useState("");
  const visible=useMemo(()=>components.filter(c=>(c.partNumber+" "+c.name+" "+c.revision+" "+c.material+" "+c.drawingReference).toLowerCase().includes(query.toLowerCase().trim())),[components,query]);
  const selected=components.find(c=>c.id===selectedId)||visible[0];
  const linkedLines=orders.flatMap(po=>po.lines.filter(line=>line.componentId===selected?.id).map(line=>({po,line}))).filter(row=>poFilter==="all"||row.po.id===poFilter);
  const routeFor=(lineId:string)=>operations.filter(op=>op.poLineId===lineId&&!op.deletedAt).sort((a,b)=>a.sequence-b.sequence);
  const bomLines=data.bomLines.filter(line=>line.componentId===selected?.id&&!line.deletedAt);
  const bomMaterialQtyPerPart=bomLines.reduce((sum,line)=>sum+line.quantityPerPart*(1+line.scrapPercent/100),0);
  const bomMaterialCostPerPart=bomLines.reduce((sum,line)=>sum+line.quantityPerPart*(1+line.scrapPercent/100)*(data.materials.find(material=>material.id===line.materialId)?.ratePerUnit||0),0);
  const bomWeightedMaterialRate=bomMaterialQtyPerPart>0?bomMaterialCostPerPart/bomMaterialQtyPerPart:0;
  const baseCostForLine=(line?:PurchaseOrderLine)=>{
    const materialQty=line?.materialQty??(selected?.materialQty&&selected.materialQty>0?selected.materialQty:line?bomMaterialQtyPerPart*line.quantity:bomMaterialQtyPerPart);
    const materialRate=line?.materialRate??(selected?.materialRate&&selected.materialRate>0?selected.materialRate:bomWeightedMaterialRate);
    const overhead=line?.overhead??selected?.overhead??0;
    const tooling=line?.toolingCost??selected?.toolingCost??0;
    const rework=line?.reworkCost??selected?.reworkCost??0;
    const scrap=line?.scrapCost??selected?.scrapCost??0;
    return materialQty*materialRate+overhead+tooling+rework+scrap;
  };
  const routeCostTotal=(route:OperationRecord[])=>route.reduce((sum,op)=>sum+op.quantity*op.ratePerPart+op.transportCost,0);
  const materialInputsComplete=(line?:PurchaseOrderLine)=>{
    const lineQty=Number(line?.materialQty)||0;
    const lineRate=Number(line?.materialRate)||0;
    const masterQty=Number(selected?.materialQty)||0;
    const masterRate=Number(selected?.materialRate)||0;
    const useBomQty=lineQty<=0&&masterQty<=0;
    const useBomRate=lineRate<=0&&masterRate<=0;
    const bomQuantitiesComplete=bomLines.length>0&&bomLines.every(bomLine=>{
      const material=data.materials.find(item=>item.id===bomLine.materialId);
      return Boolean(material)&&bomLine.quantityPerPart>0;
    });
    const bomRatesComplete=bomLines.length>0&&bomLines.every(bomLine=>{
      const material=data.materials.find(item=>item.id===bomLine.materialId);
      return Boolean(material)&&Number(material?.ratePerUnit)>0&&bomLine.quantityPerPart>0;
    });
    const materialQty=lineQty>0?lineQty:masterQty>0?masterQty:line?bomMaterialQtyPerPart*line.quantity:bomMaterialQtyPerPart;
    const materialRate=lineRate>0?lineRate:masterRate>0?masterRate:bomWeightedMaterialRate;
    return materialQty>0&&materialRate>0&&(!useBomQty||bomQuantitiesComplete)&&(!useBomRate||bomRatesComplete);
  };
  const standardCosts=standardRecords.filter(row=>row.componentId===selected?.id).sort((a,b)=>a.processTypeId.localeCompare(b.processTypeId));
  const plannedCostRecord=activeRows(data.componentPlannedCosts||[]).find(row=>row.componentId===selected?.id);
  const plannedBaselinePerPart=plannedCostRecord?componentBaselinePerPart(plannedCostRecord,standardCosts):null;
  const standardProcessCostPerPart=standardCosts.reduce((sum,row)=>sum+row.quantityPerPart*row.ratePerProcess+row.transportCostPerPart,0);
  const standardCostComplete=standardCosts.length>0&&standardCosts.every(row=>row.quantityPerPart>0&&Number.isFinite(row.ratePerProcess)&&row.ratePerProcess>=0&&Number.isFinite(row.transportCostPerPart)&&row.transportCostPerPart>=0);
  const standardTypeOptions=processTypes.map(type=>({id:type.id,label:(data.processCategories.find(category=>category.id===type.categoryId)?.name||"Category")+" · "+type.name}));
  const standardVendorOptions=vendors.filter(vendor=>!standardProcessTypeId||vendorSupportsProcessType(vendor,standardProcessTypeId)||vendor.id===standardVendorId);
  const latestStandardRate=(typeId:string,vendorId:string)=>processVendorRates.filter(rate=>rate.processTypeId===typeId&&rate.vendorId===vendorId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]?.ratePerPart;
  const openAddStandardCost=()=>{setEditingStandardCostId("");setStandardProcessTypeId("");setStandardVendorId("");setStandardQuantityPerPart("1");setStandardRatePerProcess("");setStandardTransportPerPart("");setStandardNotes("");setShowStandardCostForm(true);};
  const openEditStandardCost=(record:ComponentProcessCostRecord)=>{setEditingStandardCostId(record.id);setStandardProcessTypeId(record.processTypeId);setStandardVendorId(record.vendorId||"");setStandardQuantityPerPart(String(record.quantityPerPart));setStandardRatePerProcess(String(record.ratePerProcess));setStandardTransportPerPart(String(record.transportCostPerPart));setStandardNotes(record.notes||"");setShowStandardCostForm(true);};
  const saveStandardCost=()=>{
    const type=processTypes.find(item=>item.id===standardProcessTypeId);
    const quantity=Number(standardQuantityPerPart),rate=Number(standardRatePerProcess),transport=Number(standardTransportPerPart);
    if(!selected||!type){onNotice("Select a saved component and Process Directory process.");return;}
    if(!standardQuantityPerPart.trim()||!Number.isFinite(quantity)||quantity<=0||!standardRatePerProcess.trim()||!Number.isFinite(rate)||rate<0||!standardTransportPerPart.trim()||!Number.isFinite(transport)||transport<0){onNotice("Enter a positive process quantity and valid rate and transport cost. Enter 0 explicitly when no charge applies.");return;}
    const duplicate=standardCosts.find(row=>row.processTypeId===type.id&&row.id!==editingStandardCostId);
    if(duplicate){onNotice("A standard cost already exists for this component and process. Edit the existing row to avoid double-counting.");return;}
    if(standardVendorId){const vendor=vendors.find(item=>item.id===standardVendorId);if(!vendor||(!vendorSupportsProcessType(vendor,type.id)&&standardRecords.find(row=>row.id===editingStandardCostId)?.vendorId!==vendor.id)){onNotice("Select a capable Vendor Master record, or add the process capability in Process Directory.");return;}}
    const stamp=nowIso(),previous=standardRecords.find(row=>row.id===editingStandardCostId);
    const record:ComponentProcessCostRecord={id:editingStandardCostId||makeId("component-process-cost"),componentId:selected.id,processTypeId:type.id,vendorId:standardVendorId,quantityPerPart:quantity,ratePerProcess:rate,transportCostPerPart:transport,notes:standardNotes.trim(),createdAt:previous?.createdAt||stamp,updatedAt:stamp};
    update(current=>({...current,componentProcessCosts:editingStandardCostId?(current.componentProcessCosts||[]).map(row=>row.id===editingStandardCostId?record:row):[...(current.componentProcessCosts||[]),record]}));
    setShowStandardCostForm(false);setEditingStandardCostId("");onNotice(editingStandardCostId?"Standard component process cost updated.":"Standard component process cost saved.");
  };
  const archiveStandardCost=(record:ComponentProcessCostRecord)=>{
    if(!window.confirm("Archive this standard component process-cost definition? Historical operations remain unchanged."))return;
    const stamp=nowIso();update(current=>({...current,componentProcessCosts:(current.componentProcessCosts||[]).map(row=>row.id===record.id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));onNotice("Standard component process cost archived.");
  };

  const summaryLine=linkedLines[0]?.line;
  const summaryQuantity=Math.max(1,summaryLine?.quantity||1);
  const allComponentOperations=operations.filter(op=>op.componentId===selected?.id&&!op.deletedAt);
  const componentOperations=poFilter==="all"?allComponentOperations:allComponentOperations.filter(op=>op.poId===poFilter);
  const summaryOperations=summaryLine?routeFor(summaryLine.id):componentOperations;
  const baseCost=baseCostForLine(summaryLine)/summaryQuantity;
  const processCostPerPart=routeCostTotal(summaryOperations)/summaryQuantity;
  const fullyProcessed=baseCost+processCostPerPart;
  const missing=summaryOperations.filter(op=>!(op.ratePerPart>0)).length;
  return <section className="workspace-page component-directory-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> COMPONENT COST LEDGER</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / COMPONENT INTELLIGENCE</div><h1>Component Directory<span>.</span></h1><p>One permanent component record, its PO history, complete process route and fully processed cost.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("components")}>Edit Component Master</button><button className="button-quiet" onClick={()=>onSelectModule("component-cost-planner")}><Calculator size={14}/> Component Cost Planner</button><button className="button-quiet" onClick={()=>window.print()}><FileText size={14}/> Print / Save PDF</button><button className="button-primary" onClick={()=>onSelectModule("costing")}><CircleDollarSign size={15}/> Costing & Payments</button></div></div>
    <div className="component-directory-layout">
      <aside className="surface-panel component-directory-list"><div className="panel-heading"><div><div className="eyebrow">COMPONENT MASTER</div><h3>{components.length} saved components</h3></div></div><label className="module-record-search"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search part number, name, material…"/></label><div className="component-directory-items">{visible.map(item=><button key={item.id} className={"component-directory-item "+(selected?.id===item.id?"active":"")} onClick={()=>setSelectedId(item.id)}><Boxes size={16}/><span><strong>{item.partNumber} · {item.name}</strong><small>Rev {item.revision||"—"} · {item.material||"Material not set"}</small></span></button>)}{!visible.length&&<p className="process-directory-empty">No matching components.</p>}</div></aside>
      <main className="component-directory-detail">{selected?<><section className="surface-panel component-directory-summary"><div><div className="eyebrow">SELECTED COMPONENT</div><h2>{selected.partNumber} — {selected.name}</h2><p>Revision {selected.revision||"—"} · {selected.material||"Material not entered"} · {selected.drawingReference||"No drawing reference"}</p></div><button className="button-quiet compact-button" onClick={()=>onSelectModule("process-map")}><Workflow size={14}/> Open Process Map</button></section>
      <div className="component-directory-kpis"><article><small>Component base cost / pc</small><strong>{materialInputsComplete(summaryLine)?money(baseCost):"Incomplete"}</strong><span>{poFilter==="all"?"First linked PO line / master fallback":"Selected PO line"} · material + overhead + tooling + rework + scrap per piece</span></article><article><small>Process cost / pc (selected route)</small><strong>{summaryOperations.length&&summaryOperations.every(op=>op.quantity>0&&op.ratePerPart>0)?money(processCostPerPart):"Incomplete"}</strong><span>{componentOperations.length} saved process operations</span></article><article><small>Fully processed cost / pc (selected route)</small><strong>{materialInputsComplete(summaryLine)&&summaryOperations.length&&summaryOperations.every(op=>op.quantity>0&&op.ratePerPart>0)?money(fullyProcessed):"Incomplete"}</strong><span>Base cost plus all linked process rates</span></article><article><small>Planned baseline / pc</small><strong>{plannedBaselinePerPart===null?"Not set":money(plannedBaselinePerPart)}</strong><span>Cost Planner baseline · automatically shared with matching PO lines</span></article><article><small>Missing process rates</small><strong>{missing}</strong><span>Incomplete routes are flagged</span></article></div>
      <section className="surface-panel component-directory-routes component-standard-costs"><div className="panel-heading"><div><div className="eyebrow">STANDARD COMPONENT COST DEFINITION</div><h3>Permanent process-cost route</h3><p>Linked to this component ID. This reference route is kept separate from PO-specific actual operations.</p></div><button className="button-primary compact-button" onClick={openAddStandardCost}><Plus size={13}/> Add process cost</button></div>
      <div className="component-standard-summary"><strong>{standardCostComplete?money(standardProcessCostPerPart):"Not complete"}</strong><span>Standard process cost per component piece · {standardCosts.length} definition(s)</span></div>
      {standardCosts.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process / category</th><th>Vendor</th><th>Qty / component</th><th>Rate / process unit</th><th>Transport / pc</th><th>Standard cost / pc</th><th>Notes</th><th>Actions</th></tr></thead><tbody>{standardCosts.map(row=>{const type=data.processTypes.find(item=>item.id===row.processTypeId);const category=data.processCategories.find(item=>item.id===type?.categoryId);const vendor=vendors.find(item=>item.id===row.vendorId);const total=row.quantityPerPart*row.ratePerProcess+row.transportCostPerPart;return <tr key={row.id}><td>{category?.name||"Category"} · {type?.name||"Process"}</td><td>{vendor?.company||(row.vendorId?"Vendor unavailable":"In-house")}</td><td>{row.quantityPerPart.toLocaleString("en-IN")}</td><td>{money(row.ratePerProcess)}</td><td>{money(row.transportCostPerPart)}</td><td>{money(total)}</td><td>{row.notes||"—"}</td><td><span className="component-cost-actions"><button className="button-quiet compact-button" onClick={()=>openEditStandardCost(row)} title="Edit"><Pencil size={12}/></button><button className="button-quiet compact-button" onClick={()=>archiveStandardCost(row)} title="Archive"><Trash2 size={12}/></button></span></td></tr>})}</tbody></table></div>:<p className="process-directory-empty">No standard process-cost definitions saved for this component. No rates or costs have been invented.</p>}
      </section>
      <section className="surface-panel component-directory-routes"><div className="panel-heading"><div><div className="eyebrow">PURCHASE ORDER COMPARISON</div><h3>PO price vs fully processed cost</h3><p>Each PO line is compared separately using its saved unit price, PO-specific material overrides, linked BOM, process costs and extras.</p></div><select aria-label="Filter purchase orders" value={poFilter} onChange={e=>setPoFilter(e.target.value)}><option value="all">All purchase orders</option>{orders.filter(po=>po.lines.some(line=>line.componentId===selected.id)).map(po=><option key={po.id} value={po.id}>{po.number}</option>)}</select></div>
      {linkedLines.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO</th><th>Qty</th><th>PO price / pc</th><th>Planned baseline / pc</th><th>Planned cost total</th><th>Plan margin / pc</th><th>Processed cost / pc</th><th>Difference / pc</th><th>Total difference</th><th>Job status</th><th>Route</th></tr></thead><tbody>{linkedLines.map(({po,line})=>{const route=routeFor(line.id);const missingRates=route.filter(op=>!(op.quantity>0)||!(op.ratePerPart>0));const complete=materialInputsComplete(line)&&line.quantity>0&&route.length>0&&missingRates.length===0;const processedTotal=baseCostForLine(line)+routeCostTotal(route);const processed=complete?processedTotal/line.quantity:null;const diff=processed===null?null:line.unitPrice-processed;const total=diff===null?null:diff*line.quantity;const plannedTotal=plannedBaselinePerPart===null?null:plannedBaselinePerPart*line.quantity;const planMargin=plannedBaselinePerPart===null||!(line.unitPrice>0)?null:line.unitPrice-plannedBaselinePerPart;const reasons=[!materialInputsComplete(line)?"Missing material / BOM cost":null,!route.length?"No PO-specific route":null,...missingRates.map(op=>"Missing rate / quantity: "+op.name)].filter(Boolean);return <tr key={po.id+line.id}><td>{po.number}</td><td>{line.quantity.toLocaleString("en-IN")}</td><td>{line.unitPrice>0?money(line.unitPrice):"Not entered"}</td><td>{plannedBaselinePerPart===null?"Not planned":money(plannedBaselinePerPart)}</td><td>{plannedTotal===null?"—":money(plannedTotal)}</td><td className={planMargin===null?"cost-incomplete":planMargin>=0?"cost-positive":"cost-negative"}>{planMargin===null?"—":money(planMargin)}</td><td>{processed===null?"Incomplete":money(processed)}</td><td className={diff===null?"cost-incomplete":diff>=0?"cost-positive":"cost-negative"}>{diff===null?"—":money(diff)}</td><td className={total===null?"cost-incomplete":total>=0?"cost-positive":"cost-negative"}>{total===null?"—":money(total)}</td><td>{line.jobStatus==="Finished"?"Finished":"In progress"}</td><td><div className="component-po-cost-status"><strong className={complete?"complete":"incomplete"}>{complete?"Actual route complete":"Actual route incomplete"}</strong><small>{route.length} operations · {reasons.join("; ")||"Inputs recorded"}</small><button className="inline-module-link" onClick={()=>onOpenOperation?onOpenOperation({companyId:po.companyId,factoryId:po.factoryId,poId:po.id,poLineId:line.id,operationId:route[0]?.id||""}):onSelectModule("process-map")}>Open PO route</button></div></td></tr>})}</tbody></table></div>:<p className="process-directory-empty">No purchase-order lines are linked to this component yet.</p>}</section>
      <section className="surface-panel component-directory-routes"><div className="panel-heading"><div><div className="eyebrow">PROCESS COST REGISTER</div><h3>All saved operations for this component</h3><p>Vendor, dates, quantity, rate, transport and payment status are read from Process Map.</p></div></div>{componentOperations.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Process</th><th>Vendor</th><th>Start date / time</th><th>Delivery date / time</th><th>Qty</th><th>Rate / pc</th><th>Transport</th><th>Payment</th><th>Total process cost</th></tr></thead><tbody>{componentOperations.map(op=><tr key={op.id}><td>{op.name}</td><td>{vendors.find(v=>v.id===op.vendorId)?.company||"In-house"}</td><td>{date(op.plannedStart)}{(op.plannedStartTime||op.plannedSlotStartAt)?" · "+(/^[0-9]{2}:[0-9]{2}$/.test(op.plannedStartTime||"")?op.plannedStartTime:new Date(op.plannedSlotStartAt!).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})):""}</td><td>{date(op.plannedEnd)}{(op.plannedEndTime||op.plannedSlotEndAt)?" · "+(/^[0-9]{2}:[0-9]{2}$/.test(op.plannedEndTime||"")?op.plannedEndTime:new Date(op.plannedSlotEndAt!).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})):""}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{money(op.ratePerPart)}</td><td>{money(op.transportCost)}</td><td>{op.vendorId?(op.vendorPaymentStatus||"Not Paid"):"—"}</td><td>{money(op.quantity*op.ratePerPart+op.transportCost)}</td></tr>)}</tbody></table></div>:<p className="process-directory-empty">No process operations saved for this component yet.</p>}</section>
      <p className="module-safety-note"><FileText size={14}/> Cost figures use saved component master and operation values. Missing rates are not treated as validated zero-cost operations. The component-level summary aggregates its saved operations; PO-specific totals above are the commercial comparison.</p>
      </>:<div className="surface-panel process-directory-empty">Add a component in Component Master to start its permanent process and cost record.</div>}</main>
    </div>
    {showStandardCostForm&&<div className="pp-modal-backdrop component-cost-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowStandardCostForm(false);}}><section className="pp-process-modal component-cost-modal" role="dialog" aria-modal="true" aria-labelledby="component-cost-title">
      <div className="pp-modal-head"><div><small>COMPONENT STANDARD COST</small><h2 id="component-cost-title">{editingStandardCostId?"Edit standard process cost":"Add standard process cost"}</h2><p>{selected?.partNumber||"Component"} · permanent component record</p></div><button onClick={()=>setShowStandardCostForm(false)} aria-label="Close"><X size={16}/></button></div>
      <div className="pp-modal-form component-cost-form">
        <SearchablePicker id="component-standard-process" label="Process / category *" value={standardProcessTypeId} placeholder="Search Process Directory…" options={standardTypeOptions} onChange={id=>{setStandardProcessTypeId(id);setStandardVendorId("");setStandardRatePerProcess("");}}/>
        <SearchablePicker id="component-standard-vendor" label="Vendor (optional / in-house)" value={standardVendorId} placeholder="Search capable vendor…" options={standardVendorOptions.map(vendor=>({id:vendor.id,label:vendor.company}))} onChange={id=>{setStandardVendorId(id);const saved=latestStandardRate(standardProcessTypeId,id);if(saved!==undefined)setStandardRatePerProcess(String(saved));}}/>
        <label>Process quantity / component piece *<input type="number" min="0.0001" step="0.0001" value={standardQuantityPerPart} onChange={event=>setStandardQuantityPerPart(event.target.value)}/></label>
        <label>Rate per process unit (₹) *<input type="number" min="0" step="0.01" value={standardRatePerProcess} onChange={event=>setStandardRatePerProcess(event.target.value)}/></label>
        <label>Transport cost / component piece (₹) *<input type="number" min="0" step="0.01" value={standardTransportPerPart} onChange={event=>setStandardTransportPerPart(event.target.value)}/></label>
        <label className="pp-modal-wide">Description / notes (optional)<input value={standardNotes} onChange={event=>setStandardNotes(event.target.value)} placeholder="Optional assumptions or notes"/></label>
      </div>
      <div className="component-cost-calculation"><span>Calculated standard cost / component piece</span><strong>{standardQuantityPerPart.trim()&&standardRatePerProcess.trim()&&standardTransportPerPart.trim()&&Number(standardQuantityPerPart)>0&&Number(standardRatePerProcess)>=0&&Number(standardTransportPerPart)>=0?money(Number(standardQuantityPerPart)*Number(standardRatePerProcess)+Number(standardTransportPerPart)):"Enter all required cost inputs"}</strong><small>Process quantity × rate + transport. Not added to PO-specific actual cost.</small></div>
      <div className="pp-modal-actions"><button className="button-primary" onClick={saveStandardCost}><Check size={14}/> Save component cost</button><button onClick={()=>setShowStandardCostForm(false)}>Cancel</button></div>
    </section></div>}
  </section>;
}
