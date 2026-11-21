import { useMemo, useState, type ChangeEvent } from "react";
import { getServerAuthHeaders, getServerAuthMode, readServerSession } from "./serverAuth";
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Bot, Check, ClipboardList, Download, FileDown, FileUp, RefreshCw, RotateCcw, Search, ShieldAlert, ShieldCheck, Sparkles, Upload, Wallet } from "lucide-react";
import { archiveAxMachTwoCompanyDemo, AXIMACH_DEMO_ID_PREFIX, createAxMachTwoCompanyDemo } from "./aximachDemoData";
import { activeRows, makeId, mergeManufacturingData, nowIso, useManufacturingData, type CompanyRecord, type ComponentRecord, type VendorRecord, type ContactProfileRecord, type ProcessDefinitionRecord, type PlannedCostEntry, type VendorTransportRoute, type ManufacturingData, type PurchaseOrderRecord, type PurchaseOrderLine, type OperationRecord } from "./manufacturingData";
import { reconcilePurchaseOrderCosts } from "./costReconciliation.mjs";

type Props={onBack:()=>void;onNotice:(value:string)=>void;notice:string;onSelectModule:(id:string)=>void};
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
function downloadFile(name:string,content:string,mime="text/csv;charset=utf-8"){
 const blob=new Blob(["\uFEFF",content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
function csvCell(value:unknown){const text=value!==null&&typeof value==="object"?JSON.stringify(value):String(value??"");return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;}
function parseStringArray(value:string):string[]{if(!value.trim())return[];try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parsed.map(item=>String(item??"")).filter(Boolean);}catch{/* accept legacy comma-separated cells */}return value.split(/[,;|]/).map(item=>item.trim()).filter(Boolean);}
function parseObjectArray<T>(value:string):T[]{if(!value.trim())return[];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed as T[]:[];}catch{return[];}}
function toCsv(rows:Record<string,unknown>[]){if(!rows.length)return "";const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];return [keys.map(csvCell).join(","),...rows.map(row=>keys.map(key=>csvCell(row[key])).join(","))].join("\r\n");}
function rowsFor(moduleId:string,data:ManufacturingData):Record<string,unknown>[] {
 const companies=activeRows(data.companies),components=activeRows(data.components),pos=activeRows(data.purchaseOrders),vendors=activeRows(data.vendors),ops=activeRows(data.operations);
 if(moduleId==="companies")return companies.map(x=>({...x}));
 if(moduleId==="components")return components.map(x=>({id:x.id,companyId:x.companyId||"",companyName:companies.find(c=>c.id===x.companyId)?.name||"",partNumber:x.partNumber,name:x.name,revision:x.revision,drawingReference:x.drawingReference,salePrice:x.salePrice,salePriceUnit:x.salePriceUnit||"piece",notes:x.notes,createdAt:x.createdAt,updatedAt:x.updatedAt}));
 if(moduleId==="purchasing")return pos.flatMap(po=>po.lines.filter((line:any)=>!line.deletedAt).map((line:any)=>{const component=components.find(c=>c.id===line.componentId);return {company:companies.find(c=>c.id===po.companyId)?.name||"",poNumber:po.number,poDate:po.issueDate,dueDate:line.targetDelivery||po.targetDelivery,component:component?.name||"",componentNumber:component?.partNumber||"",quantity:line.quantity,quantityUnit:component?.salePriceUnit||"piece",unitPrice:component?.salePrice??line.unitPrice,jobStatus:line.jobStatus||"In progress"};}));
 if(moduleId==="vendors"||moduleId==="vendor-capability")return vendors.map(x=>({...x}));
 if(moduleId==="production"||moduleId==="process-map"||moduleId==="reports"||moduleId==="ai-insights")return ops.map(x=>({...x,poNumber:pos.find(po=>po.id===x.poId)?.number||"",componentNumber:components.find(c=>c.id===x.componentId)?.partNumber||"",vendorName:vendors.find(v=>v.id===x.vendorId)?.company||""}));
 if(moduleId==="dispatch"){
  const transportLegs=activeRows(data.transportLegs||[]);
  const inventory=activeRows(data.inventoryTransactions||[]);
  const dispatches=inventory.filter(tx=>tx.itemType==="component"&&tx.transactionType==="Dispatch"&&tx.direction==="out");
  const transportRows=transportLegs.map(leg=>{
   const po=pos.find(item=>item.id===leg.poId),component=components.find(item=>item.id===leg.componentId),vendor=vendors.find(item=>item.id===leg.vendorId);
   const dispatch=dispatches.find(tx=>tx.id===leg.dispatchTransactionId);
   const reversed=Boolean(dispatch&&inventory.some(tx=>tx.reversalOfId===dispatch.id));
   return {recordType:"transport-leg",transportLegId:leg.id,companyId:po?.companyId||"",companyName:companies.find(item=>item.id===po?.companyId)?.name||"",factoryId:po?.factoryId||"",factoryName:activeRows(data.factories||[]).find(item=>item.id===po?.factoryId)?.name||"",poId:leg.poId,poNumber:po?.number||"",poLineId:leg.poLineId,componentId:leg.componentId,componentNumber:component?.partNumber||"",componentName:component?.name||"",vendorId:leg.vendorId,transportVendor:vendor?.company||"",fromLocation:leg.fromLocation,toLocation:leg.toLocation,tripDirection:leg.tripDirection,vehicleType:leg.vehicleType,plannedTrips:leg.tripCount,completedTrips:leg.completedTrips||0,pickupAt:leg.pickupAt||"",scheduledDeliveryAt:leg.deliveryAt||"",transportStatus:leg.status||"Queued",transportCost:leg.fixedAmount*leg.tripCount,dispatchTransactionId:leg.dispatchTransactionId||"",dispatchEntryStatus:dispatch?(reversed?"Reversed":"Linked"):(leg.dispatchTransactionId?"Linked entry missing":"Not linked"),dispatchReference:dispatch?.reference||"",dispatchQuantity:dispatch?.quantity??"",dispatchDate:dispatch?.occurredAt||"",dispatchNotes:dispatch?.notes||"",deliveryConfirmedAt:leg.deliveryConfirmedAt||"",deliveryReference:leg.deliveryReference||""};
  });
  const legacyRows=ops.filter(x=>x.transportVendorId||x.category==="Logistics").map(x=>({...x,recordType:"legacy-transport-operation",poNumber:pos.find(po=>po.id===x.poId)?.number||"",componentNumber:components.find(c=>c.id===x.componentId)?.partNumber||"",transportVendor:vendors.find(v=>v.id===x.transportVendorId)?.company||""}));
  const linkedIds=new Set<string>(transportLegs.flatMap(leg=>leg.dispatchTransactionId?[leg.dispatchTransactionId]:[]));
  const unlinkedDispatchRows=dispatches.filter(tx=>!linkedIds.has(tx.id)).map(tx=>{
   const po=pos.find(item=>item.id===tx.poId),component=components.find(item=>item.id===tx.itemId),vendor=vendors.find(item=>item.id===tx.vendorId);
   return {recordType:"unlinked-dispatch-ledger-entry",dispatchTransactionId:tx.id,companyId:tx.companyId,companyName:companies.find(item=>item.id===tx.companyId)?.name||"",factoryId:tx.factoryId,factoryName:activeRows(data.factories||[]).find(item=>item.id===tx.factoryId)?.name||"",poId:tx.poId,poNumber:po?.number||"",poLineId:tx.poLineId,componentId:tx.itemId,componentNumber:component?.partNumber||"",componentName:component?.name||"",vendorId:tx.vendorId,transportVendor:vendor?.company||"",dispatchReference:tx.reference,dispatchQuantity:tx.quantity,dispatchDate:tx.occurredAt,dispatchNotes:tx.notes,dispatchReversed:inventory.some(row=>row.reversalOfId===tx.id)};
  });
  return [...transportRows,...legacyRows,...unlinkedDispatchRows];
 }
 if(moduleId==="quality")return ops.map(x=>({poId:x.poId,poLineId:x.poLineId,componentId:x.componentId,operation:x.name,quantity:x.quantity,completed:x.completed,accepted:x.accepted,rejected:x.rejected,status:x.status,inspectionResult:x.inspectionResult,qualityNotes:x.qualityNotes,measurementHistory:activeRows(data.inspectionMeasurements).filter(item=>item.operationId===x.id).map(item=>[item.inspectedAt,item.characteristic,item.nominalValue,item.lowerLimit,item.upperLimit,item.measuredValue,item.unit,item.result,item.notes].join(" | ")).join(" ; ")}));
 if(moduleId==="cost-reconciliation")return reconcilePurchaseOrderCosts(data).map(row=>({...row,warnings:row.warnings.join(" | ")}));
 if(moduleId==="costing")return ops.map(x=>({poId:x.poId,poLineId:x.poLineId,operation:x.name,vendorId:x.vendorId,quantity:x.quantity,plannedRate:x.ratePerPart,actualRate:x.actualRatePerPart,transportCost:x.transportCost,paymentStatus:x.paymentStatus||"Unpaid",paidAmount:x.paidAmount||0,paymentReference:x.paymentReference||"",paymentHistory:activeRows(data.paymentTransactions).filter(payment=>payment.operationId===x.id).map(payment=>[payment.paidAt,payment.amount,payment.reference,payment.notes].join(" | ")).join(" ; ")}));
 if(moduleId==="payments"){
  const allOperations=data.operations||[],allOrders=data.purchaseOrders||[],allComponents=data.components||[],allVendors=data.vendors||[];
  const transactions=activeRows(data.paymentTransactions||[]);
  const transactionRows=transactions.map(tx=>{
   const operation=allOperations.find(row=>row.id===tx.operationId),po=allOrders.find(row=>row.id===tx.poId),component=allComponents.find(row=>row.id===tx.componentId),vendor=allVendors.find(row=>row.id===(tx.vendorId||operation?.vendorId));
   return {recordType:"payment-transaction",sourceRecord:"PaymentTransactionRecord",paymentTransactionId:tx.id,companyId:po?.companyId||"",companyName:companies.find(row=>row.id===po?.companyId)?.name||"",factoryId:po?.factoryId||"",poId:tx.poId,poNumber:po?.number||"",poLineId:tx.poLineId,componentId:tx.componentId,componentNumber:component?.partNumber||"",componentName:component?.name||"",operationId:tx.operationId,operationName:operation?.name||"",operationArchived:Boolean(operation?.deletedAt),vendorId:tx.vendorId||operation?.vendorId||"",vendorName:vendor?.company||"",amount:tx.amount,currency:"INR",paymentDate:tx.paidAt,reference:tx.reference,notes:tx.notes,createdAt:tx.createdAt,updatedAt:tx.updatedAt};
  });
  const operationsWithLedger=new Set(transactions.map(tx=>tx.operationId));
  const legacyRows=allOperations.filter(op=>!operationsWithLedger.has(op.id)&&Number(op.paidAmount)>0).map(op=>{
   const po=allOrders.find(row=>row.id===op.poId),component=allComponents.find(row=>row.id===op.componentId),vendor=allVendors.find(row=>row.id===op.vendorId);
   return {recordType:"legacy-payment-total",sourceRecord:"legacy OperationRecord.paidAmount",paymentTransactionId:"",companyId:po?.companyId||"",companyName:companies.find(row=>row.id===po?.companyId)?.name||"",factoryId:po?.factoryId||"",poId:op.poId,poNumber:po?.number||"",poLineId:op.poLineId,componentId:op.componentId,componentNumber:component?.partNumber||"",componentName:component?.name||"",operationId:op.id,operationName:op.name,operationArchived:Boolean(op.deletedAt),vendorId:op.vendorId||"",vendorName:vendor?.company||"",amount:op.paidAmount,currency:"INR",paymentDate:"",reference:op.paymentReference||"",notes:"Legacy aggregate payment total; original individual payment dates and entries were not retained.",createdAt:op.createdAt,updatedAt:op.updatedAt};
  });
  return [...transactionRows,...legacyRows];
 }
 if(moduleId==="inventory")return [...activeRows(data.materials||[]),...activeRows(data.bomLines||[]),...activeRows(data.inventoryTransactions||[])].map(x=>({...x}));
 if(moduleId==="process-master")return activeRows(data.processDefinitions).map(x=>({...x}));
 if(moduleId==="planned-cost")return activeRows(data.plannedCosts).map(x=>({...x}));
 if(moduleId==="contact360")return activeRows(data.contactProfiles).map(x=>({...x}));
 if(moduleId==="communications"){
  const assignments=activeRows(data.followUpAssignments||[]).map(row=>({...row,recordType:"linked-record-contact"}));
  try{return [...assignments,...(JSON.parse(localStorage.getItem("aximach.followups.v1")||"[]") as Record<string,unknown>[]).map(row=>({...row,recordType:"follow-up-schedule"}))];}
  catch{return assignments;}
 }
 return [];
}
function parseCsv(input:string):{headers:string[];rows:Record<string,string>[]}{
 const records:string[][]=[];let row:string[]=[],field="",quoted=false;
 for(let i=0;i<input.length;i++){const ch=input[i];if(quoted){if(ch==='"'&&input[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}else if(ch==='"')quoted=true;else if(ch===","){row.push(field);field="";}else if(ch==="\n"){row.push(field);records.push(row);row=[];field="";}else if(ch!=="\r")field+=ch;}
 if(field.length||row.length){row.push(field);records.push(row);}
 const headers=(records.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,""));
 return {headers,rows:records.filter(cells=>cells.some(x=>x.trim())).map(cells=>Object.fromEntries(headers.map((header,i)=>[header,(cells[i]||"").trim()])))};
}
function norm(value:string|undefined){return (value||"").trim().toLowerCase();}
function header(row:Record<string,string>,...keys:string[]){for(const key of keys){const found=Object.entries(row).find(([name])=>name.trim().toLowerCase()===key.toLowerCase());if(found)return found[1];}return "";}

export function ReportsAnalyticsWorkspace({onBack,notice,onSelectModule}:Props){
 const {data}=useManufacturingData();const companies=activeRows(data.companies),pos=activeRows(data.purchaseOrders),lines=pos.flatMap(po=>po.lines.filter(line=>!line.deletedAt)),components=activeRows(data.components),vendors=activeRows(data.vendors),ops=activeRows(data.operations);
 const costRows=reconcilePurchaseOrderCosts(data);
 const costTotal=(key:keyof (typeof costRows)[number])=>costRows.reduce((total,row)=>total+(typeof row[key]==="number"?row[key] as number:0),0);
 const overdue=ops.filter(op=>op.status!=="Complete"&&op.plannedEnd&&op.plannedEnd<new Date().toISOString().slice(0,10));
 const qualityHold=ops.filter(op=>op.status==="Quality hold");const finished=lines.filter(line=>line.jobStatus==="Finished");
 const orderValue=lines.reduce((sum,line)=>sum+line.quantity*(components.find(component=>component.id===line.componentId)?.salePrice ?? line.unitPrice ?? 0),0);
 const onTime=ops.filter(op=>op.status==="Complete"&&(!op.plannedEnd||!op.actualEnd||op.actualEnd<=op.plannedEnd)).length;
 const [report,setReport]=useState("operations");
 const exportReport=()=>{const rows=report==="purchaseOrders"?rowsFor("purchasing",data):report==="costs"?rowsFor("costing",data):report==="cost-reconciliation"?rowsFor("cost-reconciliation",data):report==="quality"?rowsFor("quality",data):rowsFor("reports",data);downloadFile("AXIMACH-"+report+"-report.csv",toCsv(rows));};
 return <section className="workspace-page intelligence-workspace"><div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> LIVE RECORD ANALYTICS</span></div>{notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> BUSINESS INTELLIGENCE / REPORTING</div><h1>Reports &amp; Analytics<span>.</span></h1><p>Operational and financial indicators calculated from saved AXIMACH records. Empty datasets remain zero.</p></div></div>
  <div className="metric-grid dashboard-metric-grid">
   {[[companies.length,"Companies"],[pos.length,"Purchase orders"],[lines.length,"PO component lines"],[vendors.length,"Vendors"],[ops.length,"Process operations"],[finished.length,"Finished jobs"]].map(([value,label])=><article className="metric-card" key={String(label)}><div className="metric-card-top"><span>{label}</span><BarChart3 size={16}/></div><strong className="metric-number">{Number(value).toLocaleString("en-IN")}</strong><div className="metric-card-bottom"><span>Saved AXIMACH data</span></div></article>)}
  </div>
  <section className="dashboard-grid actual-data-dashboard"><div className="surface-panel"><div className="panel-heading"><div><h3>Operational review</h3><p>Recorded exceptions and completion.</p></div></div>
   <div className="dashboard-job-summary"><div><strong>{overdue.length}</strong><span>Overdue operations</span></div><div><strong>{qualityHold.length}</strong><span>Quality holds</span></div><div><strong>{ops.length?Math.round(onTime/ops.length*100):0}%</strong><span>Completed on/before target*</span></div></div>
   <small>*Includes completed records with no dates as not classed overdue; interpret only where actual/target dates exist.</small>
   <button className="related-all" onClick={()=>onSelectModule("production")}>Open Production Plan <ArrowRight size={14}/></button>
  </div><div className="surface-panel"><div className="panel-heading"><div><h3>Financial overview</h3><p>Uses entered rates and PO line values; not an audited ledger.</p></div><Wallet size={18}/></div>
   <div className="linked-cost-row"><span>PO line selling / order value (reference)</span><strong>{money(orderValue)}</strong></div><div className="linked-cost-row"><span>Planned process cost</span><strong>{money(costTotal("plannedProcessCost"))}</strong></div><div className="linked-cost-row"><span>Entered actual-rate process cost</span><strong>{money(costTotal("enteredActualProcessCost"))}</strong></div><div className="linked-cost-row"><span>Process Map material + cutting + material transport</span><strong>{money(costTotal("processMapMaterialCost")+costTotal("processMapCuttingCost")+costTotal("processMapMaterialTransportCost"))}</strong></div><div className="linked-cost-row"><span>Component planned process benchmark (separate)</span><strong>{money(costTotal("componentPlannedProcessBenchmarkCost"))}</strong></div><div className="linked-cost-row"><span>Planned-scope material / cutting / transport benchmark</span><strong>{money(costTotal("plannedScopeMaterialCost")+costTotal("plannedScopeCuttingCost")+costTotal("plannedScopeMaterialTransportCost"))}</strong></div><div className="linked-cost-row"><span>Modern transport scheduled cost</span><strong>{money(costTotal("transportRoutePlannedCost"))}</strong></div><div className="linked-cost-row"><span>Modern transport completed-trip cost</span><strong>{money(costTotal("transportRouteCompletedTripCost"))}</strong></div><div className="linked-cost-row"><span>Legacy operation transport (without modern legs)</span><strong>{money(costTotal("legacyTransportCost"))}</strong></div><div className="linked-cost-row"><span>Payment transactions (settlement, separate)</span><strong>{money(costTotal("paymentTransactionTotal")+costTotal("legacyPaidAmount"))}</strong></div><div className="linked-cost-row linked-cost-total"><span>PO lines with reconciliation warnings</span><strong>{costRows.filter(row=>row.warnings.length>0).length}</strong></div>
   <button className="related-all" onClick={()=>onSelectModule("costing")}>Open Costing &amp; Payment <ArrowRight size={14}/></button>
  </div></section>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Report export</h3><p>Download editable CSV reports, openable in Excel.</p></div><FileDown size={18}/></div>
   <div className="intelligence-export-row"><select value={report} onChange={e=>setReport(e.target.value)}><option value="operations">Process operations</option><option value="purchaseOrders">PO component lines</option><option value="costs">Costing and payment status</option><option value="cost-reconciliation">PO-line cost reconciliation</option><option value="quality">Quality inspection records</option></select><button className="button-primary" onClick={exportReport}><Download size={14}/> Export CSV</button></div>
  </section>
 </section>;
}

export function AIInsightsWorkspace({onBack,onSelectModule}:Props){
 const {data}=useManufacturingData();const companies=activeRows(data.companies),pos=activeRows(data.purchaseOrders),components=activeRows(data.components),vendors=activeRows(data.vendors),ops=activeRows(data.operations);
 const lines=pos.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line})));
 const today=new Date().toISOString().slice(0,10);
 const insights=[
  ...ops.filter(op=>op.status!=="Complete"&&op.plannedEnd&&op.plannedEnd<today).map(op=>({severity:"high",title:"Operation is past its planned target",detail:op.name+" · "+(pos.find(po=>po.id===op.poId)?.number||"PO")+" · target "+op.plannedEnd,action:"Review production schedule",module:"production"})),
  ...ops.filter(op=>op.status==="Quality hold").map(op=>({severity:"high",title:"Quality hold requires disposition",detail:op.name+" · "+(components.find(c=>c.id===op.componentId)?.partNumber||"Component"),action:"Open quality inspection",module:"quality"})),
  ...ops.filter(op=>!op.vendorId&&!op.transportVendorId&&op.category!=="Logistics"&&op.status!=="Complete").map(op=>({severity:"medium",title:"Process operation has no vendor assigned",detail:op.name+" · "+(pos.find(po=>po.id===op.poId)?.number||"PO"),action:"Assign a process vendor",module:"process-map"})),
  ...lines.filter(({po,line})=>!line.targetDelivery&&!po.targetDelivery).map(({po,line})=>({severity:"medium",title:"PO component line has no delivery target",detail:po.number+" · "+(components.find(c=>c.id===line.componentId)?.partNumber||"Component"),action:"Set a delivery date",module:"purchasing"})),
  ...lines.filter(({line})=>line.jobStatus!=="Finished"&&ops.some(op=>op.poLineId===line.id&&op.status==="Complete")).map(({po,line})=>({severity:"low",title:"All or some process steps are complete; job closure not confirmed",detail:po.number+" · "+(components.find(c=>c.id===line.componentId)?.partNumber||"Component"),action:"Review job completion",module:"production"}))
 ];
 return <section className="workspace-page intelligence-workspace"><div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> EVIDENCE-BASED INSIGHTS</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MANUFACTURING INTELLIGENCE / EXPLAINABLE RULES</div><h1>AI Insights<span>.</span></h1><p>Prioritised observations derived from actual AXIMACH records. Each insight shows its evidence and destination.</p></div><Sparkles size={26}/></div>
  <div className="metric-grid dashboard-metric-grid"><article className="metric-card"><div className="metric-card-top"><span>High priority</span><ShieldAlert size={17}/></div><strong className="metric-number">{insights.filter(x=>x.severity==="high").length}</strong></article><article className="metric-card"><div className="metric-card-top"><span>Review</span><Activity size={17}/></div><strong className="metric-number">{insights.filter(x=>x.severity==="medium").length}</strong></article><article className="metric-card"><div className="metric-card-top"><span>Suggestions</span><Bot size={17}/></div><strong className="metric-number">{insights.filter(x=>x.severity==="low").length}</strong></article></div>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Recorded findings</h3><p>{insights.length} evidence-linked observation(s) · {companies.length} companies · {pos.length} POs · {vendors.length} vendors</p></div></div>
   {insights.length?<div className="specialized-record-list">{insights.map((item,index)=><article className="specialized-record" key={item.severity+":"+index}><span className={"specialized-record-icon insight-"+item.severity}><ShieldAlert size={17}/></span><div className="specialized-record-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>Rule-based observation · not an external forecast</small></div><button className="button-quiet compact-button" onClick={()=>onSelectModule(item.module)}>{item.action} <ArrowUpRight size={13}/></button></article>)}</div>:<div className="module-empty-state"><Check size={24}/><h3>No findings from current records</h3><p>Insights will appear as real schedules, vendor assignments, quality results and PO records are entered.</p></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>These are deterministic, explainable data checks, not a claim that a remote AI model has assessed the factory. No external forecasts or invented risk scores are shown.</span></div>
 </section>;
}


function sharedBackupConfig() {
 const base=(window.localStorage.getItem("aximach.scheduler.url")||"").trim().replace(/\/+$/,"");
 const key=window.localStorage.getItem("aximach.scheduler.key")||"";
 const userMode=getServerAuthMode()==="users",session=readServerSession(base);
 if(window.localStorage.getItem("aximach.storage.mode")==="local-only"||!base||(userMode?(!session||session.user.role!=="admin"):!key))throw new Error("Server backup and restore require an administrator account on the shared AXIMACH server.");
 let parsed:URL;try{parsed=new URL(base);}catch{throw new Error("The saved AXIMACH server URL is invalid.");}
 const host=parsed.hostname.replace(/^\[|\]$/g,""),octets=host.split(".").map(Number);
 const privateIpv4=octets.length===4&&octets.every(n=>Number.isInteger(n)&&n>=0&&n<=255)&&(octets[0]===10||(octets[0]===192&&octets[1]===168)||(octets[0]===172&&octets[1]>=16&&octets[1]<=31));
 if(parsed.protocol!=="https:"&&!(parsed.protocol==="http:"&&(host==="localhost"||host==="127.0.0.1"||privateIpv4)))throw new Error("Use HTTPS, localhost or a private LAN address for the shared AXIMACH server.");
 return {base,key,headers:getServerAuthHeaders(key,base,undefined,userMode)};
}
type AxMachServerBackup={format:"aximach-backup";version:1;createdAt:string;sha256:string;data:{contacts:unknown[];schedules:unknown[];logs:unknown[];records:Record<string,unknown[]>;manufacturingData?:unknown;[key:string]:unknown}};
function validateServerBackup(value:unknown):AxMachServerBackup {
 if(!value||typeof value!=="object")throw new Error("Select a valid AXIMACH server backup JSON file.");
 const backup=value as Partial<AxMachServerBackup>;
 if(backup.format!=="aximach-backup"||backup.version!==1||!backup.data||typeof backup.data!=="object")throw new Error("This is not a supported version-1 shared-server backup. Local module JSON exports cannot be restored to the server.");
 const data=backup.data as AxMachServerBackup["data"];
 if(!Array.isArray(data.contacts)||!Array.isArray(data.schedules)||!Array.isArray(data.logs)||!data.records||typeof data.records!=="object"||Array.isArray(data.records)||!Object.values(data.records).every(Array.isArray))throw new Error("The backup is missing required shared-server data collections.");
 if(typeof backup.sha256!=="string"||! /^[a-f0-9]{64}$/i.test(backup.sha256))throw new Error("The backup has no valid SHA-256 integrity digest.");
 return backup as AxMachServerBackup;
}
function ServerBackupPanel({onNotice}:{onNotice:(value:string)=>void}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [selected,setSelected]=useState<{name:string;backup:AxMachServerBackup}|null>(null);
 const [configured]=useState(()=>{const base=window.localStorage.getItem("aximach.scheduler.url")||"";const key=window.localStorage.getItem("aximach.scheduler.key")||"";const session=readServerSession(base);return window.localStorage.getItem("aximach.storage.mode")!=="local-only"&&Boolean(base&&(session?.user.role==="admin"||(getServerAuthMode()!=="users"&&key)));});
 const downloadBackup=async()=>{
  setBusy(true);setError("");
  try{
   const {base,headers}=sharedBackupConfig();
   const response=await fetch(base+"/api/backup",{headers,cache:"no-store"});
   const payload=await response.json().catch(()=>null);
   if(!response.ok)throw new Error(payload?.error||"Shared-server backup request failed (HTTP "+response.status+").");
   const backup=validateServerBackup(payload);
   const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json;charset=utf-8"});
   const url=URL.createObjectURL(blob),anchor=document.createElement("a");
   anchor.href=url;anchor.download="AXIMACH-server-backup-"+new Date().toISOString().slice(0,10)+".json";anchor.click();URL.revokeObjectURL(url);
   onNotice("Full shared-server snapshot downloaded. The SHA-256 digest is included and will be rechecked by the server during restore.");
  }catch(e){setError(e instanceof Error?e.message:"Could not download shared-server backup.");}
  finally{setBusy(false);}
 };
 const loadBackup=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  setError("");setSelected(null);
  try{
   const raw=(await file.text()).replace(/^\uFEFF/,"");
   const backup=validateServerBackup(JSON.parse(raw));
   setSelected({name:file.name,backup});
  }catch(e){setError(e instanceof Error?e.message:"Could not read backup file.");}
  finally{event.target.value="";}
 };
 const restoreBackup=async()=>{
  if(!selected)return;
  setBusy(true);setError("");
  try{
   const {base,headers}=sharedBackupConfig();
   const manufacturing=selected.backup.data.manufacturingData as {companies?:unknown[]}|null|undefined;
   const companyCount=Array.isArray(manufacturing?.companies)?manufacturing.companies.length:0;
   const accepted=window.confirm("RESTORE WILL REPLACE THE SHARED AXIMACH SERVER DATABASE.\n\nFile: "+selected.name+"\nCompanies in manufacturing snapshot: "+companyCount+"\nContacts: "+selected.backup.data.contacts.length+"\nSchedules: "+selected.backup.data.schedules.length+"\n\nThe server creates a protected pre-restore snapshot automatically. Connected devices refresh their local shared-data caches on their next sync. Continue?");
   if(!accepted){setBusy(false);return;}
   const phrase=window.prompt("For explicit approval, type exactly: RESTORE_AXIMACH_BACKUP");
   if(phrase!=="RESTORE_AXIMACH_BACKUP"){setBusy(false);return;}
   const response=await fetch(base+"/api/restore",{method:"POST",headers:{"content-type":"application/json",...headers},body:JSON.stringify({backup:selected.backup,confirmation:phrase})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Shared-server restore failed (HTTP "+response.status+").");
   window.localStorage.removeItem("aximach.manufacturing.restore-generation");
   window.localStorage.removeItem("aximach.module-records.restore-generation");
   window.alert("AXIMACH shared-server data restored successfully.\nPre-restore snapshot: "+String(result.preRestoreBackup||"created") +"\nThis app will reload from the restored server state.");
   window.location.reload();
  }catch(e){setError(e instanceof Error?e.message:"Could not restore the shared-server backup.");setBusy(false);}
 };
 return <section className="surface-panel" aria-label="Shared server backup and restore" style={{marginBottom:18}}>
  <div className="panel-heading"><div><h3>Shared-server backup &amp; recovery</h3><p>Versioned snapshot of the central AXIMACH service database—not just this device’s browser cache.</p></div><ShieldCheck size={18}/></div>
  <div className="linked-route-actions" style={{alignItems:"center",flexWrap:"wrap"}}>
   <button type="button" className="button-primary compact-button" disabled={busy||!configured} onClick={()=>void downloadBackup()}><Download size={14}/>{busy?"Working…":"Download server snapshot"}</button>
   <label className="button-quiet compact-button" style={{display:"inline-flex",alignItems:"center",gap:7,cursor:busy?"wait":"pointer"}}><Upload size={14}/>Choose server backup<input type="file" accept=".json,application/json" disabled={busy} onChange={event=>void loadBackup(event)} style={{display:"none"}}/></label>
   {selected&&<span className="muted-copy">Selected: {selected.name} · SHA-256 present · {selected.backup.data.contacts.length} contacts · {selected.backup.data.schedules.length} schedules</span>}
   <button type="button" className="button-quiet compact-button" disabled={busy||!selected||!configured} onClick={()=>void restoreBackup()}><RotateCcw size={14}/>Restore shared server</button>
  </div>
  {!configured&&<p className="muted-copy" style={{marginTop:10}}>Connect the shared server first: Follow-up Centre → PC ↔ Android shared data settings.</p>}
  {error&&<p role="alert" className="module-safety-note" style={{marginTop:10,borderColor:"var(--danger, #b42318)"}}>{error}</p>}
  <p className="muted-copy" style={{marginTop:10}}>Restore replaces shared contacts, schedules, logs, module records, manufacturing collections and preferences. The server verifies the backup digest and schema, creates a pre-restore snapshot and advances a restore-generation marker so stale device caches cannot silently overwrite the recovered state. Keep exported files encrypted and access-controlled.</p>
 </section>;
}


type ServerAuditEvent = {
 id:string;occurredAt:string;actorId:string;actorUsername:string;actorRole:string;method:string;path:string;action:string;
 targetId?:string;recordCount?:number;collectionCounts?:Record<string,number>;moduleCounts?:Record<string,number>;
 repeat?:string;operationId?:string;vendorId?:string;enabled?:boolean;optedIn?:boolean;providerAccepted?:boolean;
 preferenceKeys?:string[];restoreGeneration?:number;
};
function ServerAuditPanel({onNotice}:{onNotice:(value:string)=>void}) {
 const [events,setEvents]=useState<ServerAuditEvent[]>([]);
 const [filter,setFilter]=useState("");
 const [busy,setBusy]=useState(false);
 const [loaded,setLoaded]=useState(false);
 const [error,setError]=useState("");
 const [configured]=useState(()=>{
  let base=(window.localStorage.getItem("aximach.scheduler.url")||"").trim();
  while(base.endsWith("/"))base=base.slice(0,-1);
  const key=window.localStorage.getItem("aximach.scheduler.key")||"";
  const session=readServerSession(base);
  return window.localStorage.getItem("aximach.storage.mode")!=="local-only"&&Boolean(base&&(session?.user.role==="admin"||(getServerAuthMode()!=="users"&&key)));
 });
 const refresh=async()=>{
  setBusy(true);setError("");
  try{
   const {base,headers}=sharedBackupConfig();
   const response=await fetch(base+"/api/audit-events",{headers,cache:"no-store"});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Audit history request failed (HTTP "+response.status+").");
   if(!Array.isArray(result.events))throw new Error("The server returned an invalid audit history response.");
   setEvents(result.events as ServerAuditEvent[]);setLoaded(true);
   onNotice("Loaded "+result.events.length.toLocaleString("en-IN")+" administrator audit events from the shared AXIMACH server.");
  }catch(e){setError(e instanceof Error?e.message:"Could not load the shared audit trail.");}
  finally{setBusy(false);}
 };
 const visible=[...events].reverse().filter(event=>(event.actorUsername+" "+event.action+" "+event.path+" "+event.actorRole).toLowerCase().includes(filter.trim().toLowerCase())).slice(0,100);
 const exportCsv=()=>{
  const quote=(value:unknown)=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const rows:unknown[][]=[["occurred_at","actor","role","action","method","path","target_id","record_count","collection_counts","module_counts","restore_generation"]];
  for(const event of [...events].reverse())rows.push([
   event.occurredAt,event.actorUsername,event.actorRole,event.action,event.method,event.path,event.targetId||"",
   event.recordCount??"",JSON.stringify(event.collectionCounts||{}),JSON.stringify(event.moduleCounts||{}),event.restoreGeneration??""
  ]);
  const blob=new Blob([String.fromCharCode(0xfeff)+rows.map(row=>row.map(quote).join(",")).join(String.fromCharCode(13,10))],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),anchor=document.createElement("a");
  anchor.href=url;anchor.download="AXIMACH-server-audit-"+new Date().toISOString().slice(0,10)+".csv";anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
 if(!configured)return null;
 const describe=(event:ServerAuditEvent)=>{
  if(event.collectionCounts)return Object.entries(event.collectionCounts).map(([key,value])=>key+": "+value).join(" · ")||"No collection rows";
  if(event.moduleCounts)return Object.entries(event.moduleCounts).map(([key,value])=>key+": "+value).join(" · ")||"No module rows";
  if(event.preferenceKeys)return "Updated preferences: "+event.preferenceKeys.join(", ");
  if(event.restoreGeneration!==undefined)return "Restore generation "+event.restoreGeneration;
  if(event.targetId)return "Record reference "+event.targetId;
  if(event.providerAccepted!==undefined)return event.providerAccepted?"Accepted by messaging provider":"Messaging attempt failed";
  if(event.optedIn!==undefined)return event.optedIn?"Recipient opt-in recorded":"Opt-in not recorded";
  if(event.enabled!==undefined)return event.enabled?"Schedule enabled":"Schedule paused";
  return "Server-side action recorded";
 };
 return <section className="surface-panel" aria-label="Administrator audit trail" style={{marginBottom:18}}>
  <div className="panel-heading"><div><h3><ClipboardList size={17} style={{verticalAlign:"-3px",marginRight:7}}/>Server audit trail</h3><p>Administrator-only record of successful server mutations and scheduler outcomes. Payload content and contact details are intentionally excluded.</p></div><ShieldCheck size={18}/></div>
  <div className="linked-route-actions" style={{alignItems:"center",flexWrap:"wrap"}}>
   <button type="button" className="button-primary compact-button" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={14}/>{busy?"Loading…":"Refresh audit trail"}</button>
   <button type="button" className="button-quiet compact-button" disabled={!loaded||events.length===0} onClick={exportCsv}><Download size={14}/>Download CSV</button>
   <label style={{display:"flex",alignItems:"center",gap:8,minWidth:220,flex:"1 1 240px"}}><Search size={14}/><input type="search" value={filter} onChange={event=>setFilter(event.target.value)} placeholder="Filter by actor, action or route" aria-label="Filter audit events"/></label>
   {loaded&&<span className="muted-copy">{events.length.toLocaleString("en-IN")} events retained · showing up to 100</span>}
  </div>
  {error&&<p role="alert" className="module-safety-note" style={{marginTop:10,borderColor:"var(--danger, #b42318)"}}>{error}</p>}
  {!loaded&&<p className="muted-copy" style={{marginTop:10}}>Refresh to load the shared server's audit history. Only administrators can retrieve these events.</p>}
  {loaded&&<div style={{display:"grid",gap:8,marginTop:14}}>
   {visible.length===0?<p className="muted-copy">No matching audit events.</p>:visible.map(event=><article key={event.id} className="ax-audit-event">
    <div><strong style={{display:"block",fontSize:12}}>{event.action}</strong><small className="muted-copy">{new Date(event.occurredAt).toLocaleString()}</small></div>
    <div><strong style={{display:"block",fontSize:12}}>{event.actorUsername}</strong><small className="muted-copy">{event.actorRole} · {event.method} {event.path}</small></div>
    <small className="muted-copy">{describe(event)}</small>
   </article>)}
  </div>}
  <p className="muted-copy" style={{marginTop:12}}>The shared JSON store retains the latest 10,000 events and includes them in server backups. For regulated or production use, forward events to separately controlled append-only storage; this local audit stream is not a cryptographically tamper-proof ledger.</p>
 </section>;
}

export function ExportCentreWorkspace({onBack,onNotice}:Props){
 const {data}=useManufacturingData();const [moduleId,setModuleId]=useState("companies");
 const options=[["companies","Company Directory"],["components","Component Directory"],["purchasing","Purchase Orders"],["vendors","Vendor Directory"],["contact360","Contact 360"],["process-master","Process Directory"],["planned-cost","Component Planned Cost"],["vendor-capability","Vendor Network"],["inventory","BOM & Inventory"],["production","Production Plan & Process Plan"],["dispatch","Transport & Dispatch"],["quality","Quality Inspection"],["costing","Costing & Payment"],["cost-reconciliation","PO-line Cost Reconciliation"],["payments","Payment Ledger"],["communications","Follow-up Centre"],["reports","Reports & Analytics"],["ai-insights","AI Insights"]];
 const rows=rowsFor(moduleId,data);
 const exportCsv=()=>{if(!rows.length){onNotice("There are no saved records to export for this selection.");return;}downloadFile("AXIMACH-"+moduleId+"-"+new Date().toISOString().slice(0,10)+".csv",toCsv(rows));onNotice("Excel-compatible CSV exported.");};
 const exportExcel=async()=>{
  if(!rows.length){onNotice("There are no saved records to export for this selection.");return;}
  try{
   const imported=await import("exceljs");const workbook=new imported.default.Workbook();
   workbook.creator="AXIMACH Manufacturing OS";workbook.created=new Date();
   const sheet=workbook.addWorksheet(options.find(x=>x[0]===moduleId)?.[1]||moduleId);
   const keys=[...new Set(rows.flatMap(row=>Object.keys(row)))];
   sheet.columns=keys.map(key=>({header:key,key,width:Math.min(36,Math.max(14,key.length+4))}));
   sheet.addRows(rows.map(row=>Object.fromEntries(keys.map(key=>{const value=row[key];return [key,value&&typeof value==="object"?JSON.stringify(value):value??""];}))));
   sheet.views=[{state:"frozen",ySplit:1}];if(keys.length)sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:keys.length}};
   const buffer=await workbook.xlsx.writeBuffer();const blob=new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
   const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download="AXIMACH-"+moduleId+"-"+new Date().toISOString().slice(0,10)+".xlsx";anchor.click();URL.revokeObjectURL(url);
   onNotice("Native Excel workbook exported with "+rows.length+" record(s).");
  }catch(error){onNotice(error instanceof Error?"Excel export failed: "+error.message:"Excel export failed.");}
 };
 const exportJson=()=>{const moduleStores={followUps:JSON.parse(localStorage.getItem("aximach.followups.v1")||"[]")};downloadFile("AXIMACH-complete-backup.json",JSON.stringify({...data,moduleStores},null,2),"application/json");onNotice("Shared manufacturing, contact, process and independent planned-cost records exported with follow-up schedules as JSON backup.");};
 const exportPdf=()=>{const w=window.open("","_blank");if(!w){onNotice("Allow pop-ups to use Print / Save PDF.");return;}const table=rows.length?'<table><thead><tr>'+Object.keys(rows[0]).map(x=>'<th>'+x+'</th>').join("")+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+Object.values(row).map(v=>'<td>'+String(v??"").replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]!))+'</td>').join("")+'</tr>').join("")+'</tbody></table>':'<p>No saved records.</p>';w.document.write('<!doctype html><html><head><title>AXIMACH Export</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:6px;text-align:left}th{background:#eee}</style></head><body><h1>AXIMACH · '+options.find(x=>x[0]===moduleId)?.[1]+'</h1>'+table+'</body></html>');w.document.close();w.focus();w.print();};
 return <section className="workspace-page intelligence-workspace"><div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> DATA EXPORT</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> DATA EXCHANGE / DOWNLOADS</div><h1>Export Centre<span>.</span></h1><p>Export saved module records and individual operation datasets to editable CSV, print/PDF or full JSON backup.</p></div></div>
  <ServerBackupPanel onNotice={onNotice}/>\n  <ServerAuditPanel onNotice={onNotice}/>
  <section className="surface-panel"><div className="module-record-form specialized-form"><label>Module to export<select value={moduleId} onChange={e=>setModuleId(e.target.value)}>{options.map(x=><option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label><label>Matching saved records<input readOnly value={String(rows.length)}/></label><div className="module-form-actions"><button className="button-primary" onClick={exportExcel}><FileDown size={14}/> Excel workbook (.xlsx)</button><button className="button-quiet" onClick={exportCsv}>CSV</button><button className="button-quiet" onClick={exportPdf}>Print / Save PDF</button><button className="button-quiet" onClick={exportJson}><Download size={14}/> Full JSON backup</button></div></div></section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>CSV files are editable in Excel; PDF is generated through the device print dialog. Full JSON backup preserves the manufacturing data model. Specialized records held in browser-local module stores are exported when their matching module is selected.</span></div>
 </section>;
}


type AmadaDemoStep = {name:string;category:string;subcategory:string;machine:string;plannedRate:number;processRate:number;inspection?:boolean};
type AmadaDemoItem = {partNumber:string;name:string;material:string;drawingReference:string;quantity:number;poNumber:string;poRate:number;plannedTotal:number;processTotal:number;tolerance:"Standard"|"Precision"|"Close"|"Ultra Precision";steps:AmadaDemoStep[];notes:string};
const AMADA_DEMO_ITEMS:AmadaDemoItem[] = [
 {partNumber:"AWTI-VHC-3-009-1111",name:"Spacer CU Block — normal machined piece",material:"Copper (ETP grade per quotation)",drawingReference:"AWTI-VHC-3-009-1111.pdf",quantity:4,poNumber:"AMADA-DEMO-2026-001",poRate:2170,plannedTotal:1600,processTotal:1450,tolerance:"Precision",notes:"Actual AMADA drawing identity and drawing quantity. ₹2,170 is an assumed demo PO rate using the earlier quotation only as a reference; it is not a confirmed customer PO rate.",steps:[
  {name:"CNC Milling",category:"Machining",subcategory:"Face and profile milling",machine:"VMC",plannedRate:520,processRate:480},
  {name:"Drilling & Boring",category:"Machining",subcategory:"Hole machining and boring",machine:"VMC / Boring setup",plannedRate:450,processRate:410},
  {name:"Thread Tapping",category:"Threading",subcategory:"Thread tapping",machine:"Tapping setup",plannedRate:350,processRate:310},
  {name:"Deburr & Inspection",category:"Finishing & Quality",subcategory:"Deburring and dimensional check",machine:"Bench / inspection",plannedRate:280,processRate:250,inspection:true}
 ]},
 {partNumber:"AMADA-DEMO-AERO-001",name:"Precision Aerospace Bracket — assumed demo part",material:"Aluminium 7075-T6 (assumed)",drawingReference:"ASSUMED DEMO PART — no AMADA drawing supplied",quantity:10,poNumber:"AMADA-DEMO-2026-002",poRate:4800,plannedTotal:3400,processTotal:5100,tolerance:"Ultra Precision",notes:"Entire part identity, quantity, material and price are illustrative assumptions for margin testing, not an AMADA-issued drawing or order.",steps:[
  {name:"5-Axis CNC Milling",category:"Precision Machining",subcategory:"5-axis profile machining",machine:"5-axis VMC",plannedRate:1800,processRate:2600},
  {name:"Precision Boring",category:"Precision Machining",subcategory:"Bore finishing",machine:"Precision boring setup",plannedRate:900,processRate:1300},
  {name:"Edge Finishing",category:"Finishing",subcategory:"Deburr and edge break",machine:"Bench finishing",plannedRate:400,processRate:500},
  {name:"CMM Inspection",category:"Quality",subcategory:"CMM dimensional inspection",machine:"CMM",plannedRate:300,processRate:700,inspection:true}
 ]},
 {partNumber:"AWTI-EEB-2-002",name:"Gantry Weldment",material:"Mild Steel (MS)",drawingReference:"AWTI-EEB-2-002.pdf",quantity:2,poNumber:"AMADA-DEMO-2026-003",poRate:18000,plannedTotal:16000,processTotal:18000,tolerance:"Standard",notes:"Actual AMADA drawing identity and drawing quantity 2. PO rate and all costing values are assumed demo values.",steps:[
  {name:"Laser / Plasma Cutting",category:"Fabrication",subcategory:"Plate cutting",machine:"Laser / plasma cutting",plannedRate:2400,processRate:2800},
  {name:"Fit-up & Tack Welding",category:"Welding",subcategory:"Fixture fit-up and tack",machine:"Welding fixture",plannedRate:2400,processRate:2700},
  {name:"MIG Welding",category:"Welding",subcategory:"Structural MIG welding",machine:"MIG welding set",plannedRate:5000,processRate:6000},
  {name:"Post-weld Machining",category:"Machining",subcategory:"Drilling and face machining",machine:"VMC / drill",plannedRate:3800,processRate:4200},
  {name:"Powder Coating",category:"Surface Treatment",subcategory:"RAL 7036 powder coating",machine:"Powder coating line",plannedRate:1500,processRate:1800},
  {name:"Final Inspection",category:"Quality",subcategory:"Weldment and dimensional inspection",machine:"Inspection tools",plannedRate:900,processRate:500,inspection:true}
 ]},
 {partNumber:"AMADA-DEMO-SHAFT-001",name:"Precision EN8 Shaft — assumed demo part",material:"EN8 steel (assumed)",drawingReference:"ASSUMED DEMO PART — no AMADA drawing supplied",quantity:20,poNumber:"AMADA-DEMO-2026-004",poRate:3200,plannedTotal:2450,processTotal:3150,tolerance:"Close",notes:"Part identity, drawing number, quantity, material and price are illustrative assumptions for margin testing, not an AMADA-issued drawing or order.",steps:[
  {name:"Saw Cutting & Facing",category:"Cutting",subcategory:"Bar cutting and facing",machine:"Power saw / lathe",plannedRate:350,processRate:400},
  {name:"CNC Turning",category:"Turning & Lathe",subcategory:"Rough and finish turning",machine:"CNC lathe",plannedRate:900,processRate:1150},
  {name:"Keyway Milling",category:"Machining",subcategory:"Keyway milling",machine:"VMC",plannedRate:500,processRate:650},
  {name:"Cylindrical Grinding",category:"Grinding",subcategory:"OD finish grinding",machine:"Cylindrical grinder",plannedRate:500,processRate:650},
  {name:"Dimensional Inspection",category:"Quality",subcategory:"Shaft dimensional inspection",machine:"Micrometer / height gauge",plannedRate:200,processRate:300,inspection:true}
 ]}
];

function addAmadaDemoScenario(current:ManufacturingData):{data:ManufacturingData;counts:{companies:number;components:number;purchaseOrders:number;operations:number;plannedCosts:number;processDefinitions:number}} {
 const stamp=nowIso(), today=stamp.slice(0,10);
 const next:ManufacturingData={...current,updatedAt:stamp,companies:[...current.companies],components:[...current.components],purchaseOrders:[...current.purchaseOrders],operations:[...current.operations],plannedCosts:[...current.plannedCosts],processDefinitions:[...current.processDefinitions]};
 const counts={companies:0,components:0,purchaseOrders:0,operations:0,plannedCosts:0,processDefinitions:0};
 let company=next.companies.find(row=>norm(row.name)==="amada weld tech india pvt ltd");
 if(!company){company={id:"amada-demo-company-amada-weld-tech",name:"AMADA WELD TECH INDIA PVT LTD",gstin:"",contactPerson:"Shainsha",phone:"",email:"design@amadaweldtech.in",address:"Bengaluru, Karnataka 560057",notes:"Customer details from AMADA drawings / quotation. DEMO scenario records below contain assumed PO and process-cost values.",createdAt:stamp,updatedAt:stamp};next.companies.push(company);counts.companies++;}
 const dateAt=(days:number,hour:string)=>{const date=new Date(today+"T00:00:00");date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)+"T"+hour;};
 for(const [itemIndex,item] of AMADA_DEMO_ITEMS.entries()){
  const suffix=String(itemIndex+1).padStart(2,"0");
  let component=next.components.find(row=>norm(row.partNumber)===norm(item.partNumber));
  if(!component){
   component={id:"amada-demo-component-"+suffix,companyId:company.id,partNumber:item.partNumber,name:item.name,revision:"",material:item.material,drawingReference:item.drawingReference,notes:"ASSUMED DEMO SCENARIO. "+item.notes,salePrice:item.poRate,salePriceUnit:"piece",overhead:0,toolingCost:0,reworkCost:0,scrapCost:0,rejectedQty:0,gstRate:0,createdAt:stamp,updatedAt:stamp};
   next.components.push(component);counts.components++;
  } else if(!component.salePrice){
   component={...component,companyId:component.companyId||company.id,salePrice:item.poRate,salePriceUnit:component.salePriceUnit||"piece",notes:(component.notes+" | ASSUMED DEMO PO rate; not customer-confirmed.").trim(),updatedAt:stamp};
   next.components=next.components.map(row=>row.id===component!.id?component!:row);
  }
  let order=next.purchaseOrders.find(row=>row.companyId===company!.id&&row.number===item.poNumber);
  if(!order){order={id:"amada-demo-po-"+suffix,number:item.poNumber,companyId:company.id,factoryId:"",issueDate:today,targetDelivery:dateAt(15,"17:00").slice(0,10),status:"Open",notes:"DEMO ONLY — assumed PO rate and costs for testing planned cost vs PO value vs process cost. Not an AMADA-issued PO.",lines:[],createdAt:stamp,updatedAt:stamp};next.purchaseOrders.push(order);counts.purchaseOrders++;}
  let line=order.lines.find(row=>row.componentId===component!.id);
  if(!line){line={id:"amada-demo-po-line-"+suffix,componentId:component.id,quantity:item.quantity,targetDelivery:order.targetDelivery,unitPrice:component.salePrice||item.poRate,notes:"ASSUMED DEMO customer PO rate; not confirmed by an AMADA purchase order.",jobStatus:"In progress",updatedAt:stamp};order={...order,lines:[...order.lines,line],updatedAt:stamp};next.purchaseOrders=next.purchaseOrders.map(row=>row.id===order!.id?order!:row);}
  const currentLine=line;
  let parentId="";
  item.steps.forEach((step,index)=>{
   const processExists=next.processDefinitions.find(row=>norm(row.processType)===norm(step.name)&&norm(row.category)===norm(step.category));
   if(!processExists){next.processDefinitions.push({id:"amada-demo-process-"+step.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")+"-"+step.category.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),processType:step.name,category:step.category,subcategories:[step.subcategory],vendorIds:[],notes:"Process definition used by AMADA demo scenario; validate against actual process plan before production.",createdAt:stamp,updatedAt:stamp});counts.processDefinitions++;}
   else if(!processExists.subcategories.some(sub=>norm(sub)===norm(step.subcategory))){next.processDefinitions=next.processDefinitions.map(row=>row.id===processExists.id?{...row,subcategories:[...row.subcategories,step.subcategory],updatedAt:stamp}:row);}
   const exists=next.operations.find(row=>row.poId===order!.id&&row.poLineId===currentLine.id&&row.sequence===index+1&&norm(row.name)===norm(step.name));
   if(!exists){
    const op:OperationRecord={id:"amada-demo-operation-"+suffix+"-"+String(index+1).padStart(2,"0"),poId:order.id,poLineId:currentLine.id,componentId:component!.id,sequence:index+1,name:step.name,category:step.category,machine:step.machine,vendorId:"",status:"Planned",plannedStart:dateAt(1+index*2,"09:00"),plannedEnd:dateAt(2+index*2,"17:00"),actualStart:"",actualEnd:"",quantity:item.quantity,completed:0,accepted:0,rejected:0,ratePerPart:step.plannedRate,actualRatePerPart:step.processRate,transportVendorId:"",transportPickup:"",transportDelivery:"",transportCost:0,qualityNotes:step.inspection?"ASSUMED DEMO inspection step; actual readings and acceptance must be entered.":"",inspectionResult:"Not assessed",notes:"ASSUMED DEMO PROCESS COST — illustrative per-piece estimate only; not a supplier invoice or actual shop-floor posting.",paymentStatus:"Unpaid",paidAmount:0,paymentReference:"",subcategory:step.subcategory,executionType:"Internal",toleranceCategory:item.tolerance,inspectionRequired:!!step.inspection,transportFrom:"",transportTo:"",transportVehicleType:"",transportRouteId:"",branch:"Main route",parentId,createdAt:stamp,updatedAt:stamp};
    next.operations.push(op);counts.operations++;parentId=op.id;
   } else {parentId=exists.id;}
   const plannedExists=next.plannedCosts.find(row=>norm(row.componentNumber)===norm(item.partNumber)&&norm(row.poNumber)===norm(item.poNumber)&&norm(row.processType)===norm(step.name)&&norm(row.processCategory)===norm(step.category));
   if(!plannedExists){next.plannedCosts.push({id:"amada-demo-planned-cost-"+suffix+"-"+String(index+1).padStart(2,"0"),companyName:company!.name,poNumber:item.poNumber,componentName:item.name,componentNumber:item.partNumber,processType:step.name,processCategory:step.category,processSubcategory:step.subcategory,plannedQty:item.quantity,unit:"piece",plannedRate:step.plannedRate,notes:"ASSUMED DEMO planned rate per piece; scenario value only.",createdAt:stamp,updatedAt:stamp});counts.plannedCosts++;}
  });
 }
 return {data:next,counts};
}

export function ImportCentreWorkspace({onBack,onNotice,notice}:Props){
 const {data,update}=useManufacturingData();const [type,setType]=useState<"companies"|"components"|"vendors"|"contact360"|"process-master"|"planned-cost"|"backup">("companies");
 const [fileName,setFileName]=useState("");const [source,setSource]=useState("");const [error,setError]=useState("");const [preview,setPreview]=useState<Record<string,string>[]>([]);
 const parsed=useMemo(()=>source&&type!=="backup"?parseCsv(source):{headers:[],rows:[]},[source,type]);
 const activeDemoCompanies=activeRows(data.companies).filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)).length;
 const activeDemoParts=activeRows(data.components).filter(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)).length;
 const loadTwoCompanyDemo=()=>{
  update(current=>mergeManufacturingData(current,createAxMachTwoCompanyDemo()));
  onNotice("Two-company demo loaded: 2 companies, 5 components, 2 POs, linked vendors, process routes, costing, inventory, quality, payments and transport. All records are marked DEMO and existing records were preserved.");
 };
 const removeTwoCompanyDemo=()=>{
  if(!window.confirm("Archive all AXIMACH DEMO records from this workspace? Real company records will not be changed. The demo can be loaded again later."))return;
  update(current=>archiveAxMachTwoCompanyDemo(current));
  onNotice("AXIMACH DEMO records archived and hidden from active module lists. Real records were not changed. Demo tombstones are retained for shared-device sync.");
 };
 const loadAmadaDemo=()=>{let summary:{companies:number;components:number;purchaseOrders:number;operations:number;plannedCosts:number;processDefinitions:number}|null=null;update(current=>{const result=addAmadaDemoScenario(current);summary=result.counts;return result.data;});const added=summary||{companies:0,components:0,purchaseOrders:0,operations:0,plannedCosts:0,processDefinitions:0};onNotice("AMADA assumed-cost scenario merged. Added "+added.components+" components, "+added.purchaseOrders+" POs, "+added.operations+" linked process operations and "+added.plannedCosts+" planned-cost rows. Existing records were retained; all assumed values are clearly marked DEMO.");};
 const handleFile=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0];if(!file)return;
  setError("");setFileName(file.name);setSource("");setPreview([]);
  const extension=file.name.toLowerCase().split(".").pop();
  if(extension==="xlsx"){
   try{
    const imported=await import("exceljs");
    const workbook=new imported.default.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet=workbook.worksheets[0];
    if(!sheet)throw new Error("The workbook contains no worksheet.");
    const rows:string[][]=[];
    sheet.eachRow({includeEmpty:false},row=>{
     const values:string[]=[];
     for(let index=1;index<=sheet.columnCount;index++)values.push(row.getCell(index).text||"");
     while(values.length&&values[values.length-1]==="")values.pop();
     rows.push(values);
    });
    if(!rows.length)throw new Error("The first worksheet is empty.");
    setSource(rows.map(row=>row.map(csvCell).join(",")).join(String.fromCharCode(13,10)));
   }catch(e){setError(e instanceof Error?"Excel workbook could not be read: "+e.message:"Excel workbook could not be read.");}
   return;
  }
  if(extension==="csv"||extension==="txt"||extension==="json"){setSource(await file.text());return;}
  setError("Unsupported file. Choose CSV, TXT, XLSX or an AXIMACH JSON backup.");
 };
 const validate=()=>{
  setError("");if(type==="backup"){try{const root=JSON.parse(source);const value=root.manufacturing||root;if(!value||!Array.isArray(value.companies)||!Array.isArray(value.purchaseOrders))throw new Error("This file is not an AXIMACH manufacturing JSON backup.");setPreview([{rows:String(Object.keys(value).length),companies:String(value.companies.length),purchaseOrders:String(value.purchaseOrders.length),moduleStores:String(Object.keys(root.moduleStores||{}).length)}]);}catch(e){setError(e instanceof Error?e.message:"Invalid JSON backup.");}return;}
  const result=parsed.rows.map((row,index)=>({...row,__row:String(index+2)}));
  if(!parsed.headers.length){setError("CSV header row is missing.");return;}
  const errors:string[]=[];
  result.forEach((row,i)=>{
   const linkedType=header(row,"linkedType","linked type").toLowerCase();
   const valid=type==="companies"?!!header(row,"name","company name")
    :type==="components"?!!header(row,"partNumber","component number","component no")&&!!header(row,"name","component name")
    :type==="vendors"?!!header(row,"company","vendor company")&&!!header(row,"contact","contact person")
    :type==="contact360"?!!header(row,"name","contact name")&&!!header(row,"linkedId","linked id")&&(linkedType==="company"||linkedType==="vendor")
    :type==="process-master"?!!header(row,"processType","process type")&&!!header(row,"category","process category")
    :!!header(row,"componentName","component name")&&!!header(row,"processType","process type")&&Number.isFinite(Number(header(row,"plannedQty","planned quantity")))&&Number(header(row,"plannedQty","planned quantity"))>=0&&Number.isFinite(Number(header(row,"plannedRate","planned rate","rate")))&&Number(header(row,"plannedRate","planned rate","rate"))>=0;
   if(!valid)errors.push("Row "+row.__row+": required field missing.");
  });
  if(errors.length)setError(errors.slice(0,10).join(" "));
  setPreview(result);
 };
 const commit=()=>{
  if(type==="backup"){try{const root=JSON.parse(source);const value=root.manufacturing||root;const stores=root.moduleStores||{};const incoming={...value,processDefinitions:[...(Array.isArray(value.processDefinitions)?value.processDefinitions:[]),...(Array.isArray(stores.processDirectory)?stores.processDirectory:[])],plannedCosts:[...(Array.isArray(value.plannedCosts)?value.plannedCosts:[]),...(Array.isArray(stores.plannedCost)?stores.plannedCost:[])],contactProfiles:[...(Array.isArray(value.contactProfiles)?value.contactProfiles:[]),...(Array.isArray(stores.contact360)?stores.contact360:[])]};update(current=>mergeManufacturingData(current,incoming));if(Array.isArray(stores.followUps))localStorage.setItem("aximach.followups.v1",JSON.stringify(stores.followUps));setError("");onNotice("AXIMACH backup merged by record ID. Shared contact profiles, Process Directory and independent planned-cost records were retained; legacy backups are supported.");setPreview([]);}catch(e){setError(e instanceof Error?e.message:"Backup import failed.");}return;}
  if(!preview.length){setError("Validate and preview the file first.");return;}
  const stamp=nowIso();let inserted=0,skipped=0;
  update(current=>{
   if(type==="companies"){
    const additions:CompanyRecord[]=[];for(const row of preview){const id=header(row,"id"),name=header(row,"name","company name").trim(),gstin=header(row,"gstin","gst");if(!name){skipped++;continue;}if([...current.companies,...additions].some(x=>(id&&x.id===id)||(gstin&&norm(x.gstin)===norm(gstin))||norm(x.name)===norm(name))){skipped++;continue;}additions.push({id:id||makeId("company"),name,gstin,contactPerson:header(row,"contactPerson","contact person"),phone:header(row,"phone","mobile"),email:header(row,"email"),address:header(row,"address"),notes:header(row,"notes")||"Imported CSV",createdAt:header(row,"createdAt")||stamp,updatedAt:header(row,"updatedAt")||stamp});inserted++;}return {...current,companies:[...current.companies,...additions]};
   }
   if(type==="components"){
    const additions:ComponentRecord[]=[];for(const row of preview){const id=header(row,"id"),number=header(row,"partNumber","component number","component no"),name=header(row,"name","component name");if(!number||!name||[...current.components,...additions].some(x=>(id&&x.id===id)||norm(x.partNumber)===norm(number))){skipped++;continue;}const sourceCompanyId=header(row,"companyId"),companyName=header(row,"company","company name");const company=current.companies.find(x=>x.id===sourceCompanyId)||current.companies.find(x=>norm(x.name)===norm(companyName));const unitPrice=Number(header(row,"salePrice","price","unit price"))||0;additions.push({id:id||makeId("component"),companyId:company?.id,partNumber:number,name,revision:header(row,"revision"),drawingReference:header(row,"drawingReference","drawing reference"),notes:header(row,"notes")||"Imported CSV",salePrice:unitPrice,salePriceUnit:(header(row,"salePriceUnit","price unit","unit").toLowerCase()==="set"?"set":"piece"),overhead:0,toolingCost:0,reworkCost:0,scrapCost:0,rejectedQty:0,gstRate:0,createdAt:header(row,"createdAt")||stamp,updatedAt:header(row,"updatedAt")||stamp});inserted++;}return {...current,components:[...current.components,...additions]};
   }
    if(type==="contact360"){
     const additions:ContactProfileRecord[]=[];
     for(const row of preview){
      const id=header(row,"id"),linkedType=header(row,"linkedType","linked type").toLowerCase() as "company"|"vendor",linkedId=header(row,"linkedId","linked id"),name=header(row,"name","contact name"),phone=header(row,"phone");
      const parentExists=linkedType==="company"?current.companies.some(x=>x.id===linkedId):current.vendors.some(x=>x.id===linkedId);
      const duplicate=[...current.contactProfiles,...additions].some(x=>(id&&x.id===id)||(x.linkedType===linkedType&&x.linkedId===linkedId&&norm(x.name)===norm(name)&&norm(x.phone)===norm(phone)));
      if(!parentExists||!name||duplicate){skipped++;continue;}
      additions.push({id:id||makeId("contact"),linkedType,linkedId,name,role:header(row,"role"),group:header(row,"group"),phone,whatsapp:header(row,"whatsapp"),additionalPhones:parseStringArray(header(row,"additionalPhones","additional phones")),email:header(row,"email"),address:header(row,"address"),followUpDate:header(row,"followUpDate","follow up date"),history:header(row,"history"),createdAt:header(row,"createdAt")||stamp,updatedAt:header(row,"updatedAt")||stamp});
      inserted++;
     }
     return {...current,contactProfiles:[...current.contactProfiles,...additions]};
    }
    if(type==="process-master"){
     const additions:ProcessDefinitionRecord[]=[];
     for(const row of preview){
      const id=header(row,"id"),processType=header(row,"processType","process type"),category=header(row,"category","process category");
      const duplicate=[...current.processDefinitions,...additions].some(x=>(id&&x.id===id)||(norm(x.processType)===norm(processType)&&norm(x.category)===norm(category)));
      if(!processType||!category||duplicate){skipped++;continue;}
      const vendorIds=parseStringArray(header(row,"vendorIds","vendor ids")).filter(id=>current.vendors.some(v=>v.id===id));
      additions.push({id:id||makeId("process"),processType,category,subcategories:parseStringArray(header(row,"subcategories","sub categories")),vendorIds,notes:header(row,"notes"),createdAt:header(row,"createdAt")||stamp,updatedAt:header(row,"updatedAt")||stamp});
      inserted++;
     }
     return {...current,processDefinitions:[...current.processDefinitions,...additions]};
    }
    if(type==="planned-cost"){
     const additions:PlannedCostEntry[]=[];
     for(const row of preview){
      const id=header(row,"id"),componentName=header(row,"componentName","component name"),componentNumber=header(row,"componentNumber","component number"),processType=header(row,"processType","process type"),processCategory=header(row,"processCategory","process category"),plannedQty=Number(header(row,"plannedQty","planned quantity")),plannedRate=Number(header(row,"plannedRate","planned rate","rate"));
      const duplicate=[...current.plannedCosts,...additions].some(x=>(id&&x.id===id)||(norm(x.componentNumber)===norm(componentNumber)&&norm(x.componentName)===norm(componentName)&&norm(x.processType)===norm(processType)&&norm(x.processCategory)===norm(processCategory)));
      if(!componentName||!processType||!Number.isFinite(plannedQty)||plannedQty<0||!Number.isFinite(plannedRate)||plannedRate<0||duplicate){skipped++;continue;}
      additions.push({id:id||makeId("planned-cost"),companyName:header(row,"companyName","company name"),poNumber:header(row,"poNumber","po number"),componentName,componentNumber,processType,processCategory,processSubcategory:header(row,"processSubcategory","process subcategory"),plannedQty,unit:header(row,"unit").toLowerCase()==="set"?"set":"piece",plannedRate,notes:header(row,"notes"),createdAt:header(row,"createdAt")||stamp,updatedAt:header(row,"updatedAt")||stamp});
      inserted++;
     }
     return {...current,plannedCosts:[...current.plannedCosts,...additions]};
    }
   const additions:VendorRecord[]=[];for(const row of preview){const id=header(row,"id"),company=header(row,"company","vendor company"),contact=header(row,"contact","contact person"),phone=header(row,"phone","mobile");if(!company||!contact||[...current.vendors,...additions].some(x=>(id&&x.id===id)||(phone&&norm(x.phone)===norm(phone)))){skipped++;continue;}additions.push({id:id||makeId("vendor"),company,contact,role:header(row,"role"),phone,whatsappNumber:header(row,"whatsappNumber","whatsapp","whatsapp number"),email:header(row,"email"),address:header(row,"address"),processes:header(row,"processes","capabilities"),machines:header(row,"machines"),materials:header(row,"materials"),notes:header(row,"notes")||"Imported CSV",status:header(row,"status")||"Unverified contact — review",sourceContactId:header(row,"sourceContactId"),whatsappSyncedAt:header(row,"whatsappSyncedAt"),vendorType:header(row,"vendorType"),additionalPhones:parseStringArray(header(row,"additionalPhones","additional phones")),transportRoutes:parseObjectArray<VendorTransportRoute>(header(row,"transportRoutes","transport routes")),createdAt:header(row,"createdAt")||stamp,updatedAt:header(row,"updatedAt")||stamp});inserted++;}return {...current,vendors:[...current.vendors,...additions]};
  });
  setPreview([]);setSource("");onNotice("Import committed. Added "+inserted+" record(s); skipped "+skipped+" duplicate or incomplete row(s). Review imported records before operational use.");
 };
 return <section className="workspace-page intelligence-workspace"><div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> VALIDATED DATA IMPORT</span></div>{notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> DATA EXCHANGE / IMPORT</div><h1>Import Centre<span>.</span></h1><p>Import CSV or native Excel .xlsx files, or merge an AXIMACH JSON backup. Preview and validate before committing.</p></div><FileUp size={26}/></div>
  <section className="surface-panel">
   <div className="panel-heading"><div><h3>Two-company / five-component manufacturing demo</h3><p>Load a complete, removable synthetic dataset for testing AXIMACH module linkages.</p></div><span className="module-number">OPTIONAL · DEMO ONLY</span></div>
   <p className="module-safety-note">Creates two fictional companies, five component lines, two purchase orders, six fictional vendors, 24 main process operations, alternate and rework routes, BOM and stock movements, quotations, payments, inspection readings, transport legs, Contact 360 records and planned costs. No real supplier is contacted and no payment or dispatch is made.</p>
   <div className="module-form-actions">
    <button className="button-primary" onClick={loadTwoCompanyDemo}><Sparkles size={14}/> Load 2-company / 5-part demo</button>
    <button className="button-quiet" onClick={removeTwoCompanyDemo} disabled={!activeDemoCompanies}><ShieldCheck size={14}/> Remove demo data</button>
    <span className="module-number">{activeDemoCompanies} DEMO COMPANIES · {activeDemoParts} DEMO COMPONENTS ACTIVE</span>
   </div>
  </section>
  <section className="surface-panel"><div className="panel-heading"><div><h3>AMADA costing demonstration</h3><p>Creates four linked sample jobs to compare customer PO rate, planned process cost and process-cost estimate.</p></div><span className="module-number">ASSUMED VALUES</span></div>
   <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component type</th><th>Qty</th><th>PO rate / pc</th><th>Planned cost / pc</th><th>Process cost / pc</th><th>Margin / pc</th></tr></thead><tbody>
    <tr><td>Normal piece — Spacer CU Block</td><td>4</td><td>₹2,170</td><td>₹1,600</td><td>₹1,450</td><td>+₹720 Profit</td></tr>
    <tr><td>Precision aerospace — assumed bracket</td><td>10</td><td>₹4,800</td><td>₹3,400</td><td>₹5,100</td><td>−₹300 Loss</td></tr>
    <tr><td>Weldment — Gantry Weldment</td><td>2</td><td>₹18,000</td><td>₹16,000</td><td>₹18,000</td><td>₹0 Break-even</td></tr>
    <tr><td>Shaft — assumed EN8 shaft</td><td>20</td><td>₹3,200</td><td>₹2,450</td><td>₹3,150</td><td>+₹50 Thin profit</td></tr>
   </tbody></table></div>
   <p className="module-safety-note">AMADA identities are used where drawings were found. The aerospace bracket and shaft are illustrative parts. PO rates and all process/planned costs are assumed demonstration values, not customer-confirmed prices or actual invoices. Transport, GST and payment transactions are excluded. Process estimates are stored on linked operations to make the Costing &amp; Payment comparison visible.</p>
   <p className="module-safety-note">For cross-device testing, run this demo once on the Windows PC that hosts AXIMACH. Keep the PC app open. On Android, use the PC LAN URL and API key from Follow-up Centre → PC → Android private Wi-Fi connection. Both devices must be on the same Wi-Fi. Stable demo IDs prevent a second run from duplicating the sample jobs.</p>
   <div className="module-form-actions"><button className="button-primary" onClick={loadAmadaDemo}><Sparkles size={14}/> Add AMADA demo records to AXIMACH</button></div>
  </section>
  <section className="surface-panel"><div className="module-record-form specialized-form">
   <label>Import type<select value={type} onChange={e=>{setType(e.target.value as typeof type);setPreview([]);setError("");}}><option value="companies">Company Directory CSV</option><option value="components">Component Directory CSV</option><option value="vendors">Vendor Directory CSV</option><option value="contact360">Contact 360 CSV</option><option value="process-master">Process Directory CSV</option><option value="planned-cost">Component Planned Cost CSV</option><option value="backup">AXIMACH JSON backup</option></select></label>
   <label>File<input type="file" accept={type==="backup"?".json,application/json":".csv,text/csv,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"} onChange={handleFile}/></label>
   {fileName&&<div className="module-form-wide">Selected: {fileName}</div>}
   <div className="module-form-actions"><button className="button-quiet" onClick={validate} disabled={!source}><Search size={14}/> Validate &amp; preview</button><button className="button-primary" onClick={commit} disabled={!preview.length}><Upload size={14}/> Commit import</button></div>
  </div>{error&&<div className="notice-banner"><ShieldAlert size={15}/><span>{error}</span></div>}</section>
  {preview.length>0&&<section className="surface-panel"><div className="panel-heading"><div><h3>Import preview</h3><p>{preview.length} row(s) loaded. Duplicate checking is repeated when you commit.</p></div><span className="module-number">{preview.length} ROWS</span></div>
   <div className="costing-table-wrap"><table className="costing-table"><thead><tr>{Object.keys(preview[0]).slice(0,8).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{preview.slice(0,20).map((row,i)=><tr key={i}>{Object.keys(preview[0]).slice(0,8).map(k=><td key={k}>{row[k]}</td>)}</tr>)}</tbody></table></div>
  </section>}
  <div className="module-safety-note"><ShieldCheck size={15}/><span>CSV and first-worksheet XLSX files are converted to a row preview before import; AXIMACH JSON backups merge by record ID. PDF parsing is not enabled. Imported vendor records are marked unverified. Existing records are preserved and duplicates are skipped.</span></div>
 </section>;
}
