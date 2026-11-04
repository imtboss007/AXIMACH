import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { ArrowRight, Check, CircleDollarSign, Layers3, Plus, Search, ShieldCheck, Trash2, Users, Edit3, FileDown, FileText, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type PlannedCostEntry, type ProcessDefinitionRecord } from "./manufacturingData";

type Props={moduleId:"process-master"|"planned-cost";onBack:()=>void;onNotice:(value:string)=>void;notice:string};
type ProcessEntry=ProcessDefinitionRecord;
const PROCESS_KEY="aximach.processDirectory.v1";
function readRows<T>(key:string):T[]{try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value as T[]:[];}catch{return[];}}
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});

function ProcessDirectory({onNotice,onBack}:Pick<Props,"onNotice"|"onBack">){
 const {data,update}=useManufacturingData();
 const vendors=activeRows(data.vendors);
 const rows=activeRows(data.processDefinitions);
 useEffect(()=>{
  const legacy=readRows<ProcessEntry>(PROCESS_KEY);
  if(!legacy.length)return;
  update(current=>{
   const byId=new Map(current.processDefinitions.map(row=>[row.id,row]));
   let changed=false;
   for(const row of legacy){
    const old=byId.get(row.id);
    if(!old||(Date.parse(row.updatedAt||"")||0)>(Date.parse(old.updatedAt||"")||0)){
     byId.set(row.id,row);changed=true;
    }
   }
   return changed?{...current,processDefinitions:[...byId.values()]}:current;
  });
 },[update]);
 const [search,setSearch]=useState("");
 const [editingId,setEditingId]=useState("");
 const [processType,setProcessType]=useState("");
 const [category,setCategory]=useState("");
 const [subcategories,setSubcategories]=useState("");
 const [vendorIds,setVendorIds]=useState<string[]>([]);
 const [notes,setNotes]=useState("");
 const filtered=useMemo(()=>rows.filter(row=>(row.processType+" "+row.category+" "+row.subcategories.join(" ")+" "+row.notes+" "+row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join(" ")).toLowerCase().includes(search.toLowerCase().trim())),[rows,search,vendors]);
 const reset=()=>{setEditingId("");setProcessType("");setCategory("");setSubcategories("");setVendorIds([]);setNotes("");};
 const save=()=>{
  if(!processType.trim()||!category.trim()){onNotice("Enter the process type and category.");return;}
  const stamp=nowIso();
  const old=rows.find(row=>row.id===editingId);
  const row:ProcessEntry={
   id:editingId||makeId("process"),
   processType:processType.trim(),
   category:category.trim(),
   subcategories:subcategories.split(",").map(x=>x.trim()).filter(Boolean).slice(0,100),
   vendorIds,
   notes:notes.trim(),
   createdAt:old?.createdAt||stamp,
   updatedAt:stamp
  };
  update(current=>({...current,processDefinitions:[row,...current.processDefinitions.filter(item=>item.id!==row.id)]}));
  reset();
  onNotice(editingId?"Process definition updated.":"Process definition saved to shared AXIMACH Process Directory.");
 };
 const edit=(row:ProcessEntry)=>{
  setEditingId(row.id);setProcessType(row.processType);setCategory(row.category);
  setSubcategories(row.subcategories.join(", "));setVendorIds(row.vendorIds);setNotes(row.notes);
 };
 const remove=(id:string)=>{
  if(!window.confirm("Delete this process directory record? Existing production operation history will not be changed."))return;
  const stamp=nowIso();
  update(current=>({...current,processDefinitions:current.processDefinitions.map(row=>row.id===id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
  onNotice("Process directory record archived. Historical operations remain unchanged.");
 };
 const exportCsv=()=>{
  const quote=(value:unknown)=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const csv=[
   ["Process Type","Category","Subcategories","Vendors","Notes"].map(quote).join(","),
   ...filtered.map(row=>[
    row.processType,row.category,row.subcategories.join("; "),
    row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join("; "),row.notes
   ].map(quote).join(","))
  ].join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="AXIMACH-Process-Directory.csv";a.click();URL.revokeObjectURL(url);
 };
 const exportExcel=async()=>{
  try{
   const workbook=new ExcelJS.Workbook();
   workbook.creator="AXIMACH";
   workbook.created=new Date();
   const sheet=workbook.addWorksheet("Process Directory");
   sheet.columns=[
    {header:"Process Type",key:"processType",width:28},
    {header:"Category",key:"category",width:22},
    {header:"Subcategories",key:"subcategories",width:48},
    {header:"Vendors",key:"vendors",width:42},
    {header:"Notes",key:"notes",width:48}
   ];
   sheet.addRows(filtered.map(row=>({
    processType:row.processType,category:row.category,subcategories:row.subcategories.join("; "),
    vendors:row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join("; "),notes:row.notes
   })));
   sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
   sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17324D"}};
   sheet.views=[{state:"frozen",ySplit:1}];
   const bytes=await workbook.xlsx.writeBuffer();
   const blob=new Blob([bytes as BlobPart],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
   const url=URL.createObjectURL(blob);const a=document.createElement("a");
   a.href=url;a.download="AXIMACH-Process-Directory.xlsx";a.click();URL.revokeObjectURL(url);
   onNotice("Excel workbook exported with "+filtered.length+" process record(s).");
  }catch(error){onNotice(error instanceof Error?"Excel export failed: "+error.message:"Excel export failed.");}
 };
 const exportPdf=()=>{
  const win=window.open("","_blank");
  if(!win){onNotice("Allow pop-ups to print / save the process directory as PDF.");return;}
  const esc=(value:unknown)=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
  const html=filtered.map(row=>"<tr><td>"+esc(row.processType)+"</td><td>"+esc(row.category)+"</td><td>"+esc(row.subcategories.join(" · "))+"</td><td>"+esc(row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join(", "))+"</td></tr>").join("");
  win.document.write("<!doctype html><html><head><title>AXIMACH Process Directory</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left}th{background:#eef2f6}</style></head><body><h1>AXIMACH · Process Directory</h1><table><thead><tr><th>Process type</th><th>Category</th><th>Subcategories</th><th>Vendors</th></tr></thead><tbody>"+html+"</tbody></table></body></html>");
  win.document.close();win.focus();win.print();
 };
 return <section className="workspace-page specialized-directory">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> AXIMACH</button><span className="demo-pill"><i/> INDEPENDENT PROCESS MASTER</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MANUFACTURING / MASTER DATA</div><h1>Process Directory<span>.</span></h1><p>Define process categories, process types and up to 100 subcategories; link multiple vendors to each process.</p></div><span className="module-number">{rows.length} PROCESS RECORDS</span></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search process, category, subcategory or vendor…"/></label></div>
  <section className="surface-panel">
   <div className="panel-heading"><div><h3>{editingId?"Edit process definition":"Add process definition"}</h3><p>One process type may contain up to 100 subcategories and multiple vendor assignments.</p></div></div>
   <div className="module-record-form specialized-form">
    <label>Process type *<input value={processType} onChange={e=>setProcessType(e.target.value)} placeholder="CNC Turning, VMC Milling, Wire EDM…"/></label>
    <label>Category *<input list="aximach-process-categories" value={category} onChange={e=>setCategory(e.target.value)} placeholder="Milling, grinding, turning, heat treatment…"/><datalist id="aximach-process-categories">{[...new Set(rows.map(row=>row.category))].map(value=><option key={value} value={value}/>)}</datalist></label>
    <label className="module-form-wide">Subcategories (comma-separated)<input value={subcategories} onChange={e=>setSubcategories(e.target.value)} placeholder="Rough turning, finish turning, threading, up to 100mm, small mill…"/></label>
    <div className="module-form-wide process-vendor-selection"><strong>Linked vendors</strong><div>{vendors.map(v=><label key={v.id}><input type="checkbox" checked={vendorIds.includes(v.id)} onChange={()=>setVendorIds(current=>current.includes(v.id)?current.filter(id=>id!==v.id):[...current,v.id])}/>{v.company} · {v.contact}</label>)}</div><small>One process can link to multiple vendors; one vendor can be linked to multiple processes.</small></div>
    <label className="module-form-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Process scope or requirements"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={save}><Check size={14}/>{editingId?"Save changes":"Add process"}</button>{editingId&&<button className="button-quiet" onClick={reset}>Cancel edit</button>}</div>
   </div>
  </section>
  <section className="surface-panel">
   <div className="panel-heading"><div><h3>Process definitions</h3><p>{filtered.length} of {rows.length} saved records</p></div><div className="module-form-actions"><button className="button-quiet compact-button" onClick={()=>void exportExcel()}><FileDown size={13}/> Excel .xlsx</button><button className="button-quiet compact-button" onClick={exportCsv}>CSV</button><button className="button-quiet compact-button" onClick={exportPdf}><FileText size={13}/> PDF</button></div></div>
   {filtered.length?<div className="specialized-record-list">{filtered.map(row=><article className="specialized-record" key={row.id}><span className="specialized-record-icon"><Layers3 size={18}/></span><div className="specialized-record-copy"><strong>{row.processType}</strong><span>{row.category}</span><p>{row.subcategories.length?row.subcategories.join(" · "):"No subcategories added"}</p><small>{row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company).filter(Boolean).join(", ")||"No vendor linked"}</small>{row.notes&&<small>{row.notes}</small>}</div><button className="button-quiet compact-button" onClick={()=>edit(row)}><Edit3 size={13}/> Edit</button><button className="button-quiet compact-button" onClick={()=>remove(row.id)}><Trash2 size={13}/> Delete</button></article>)}</div>:<div className="module-empty-state"><Layers3 size={24}/><h3>{search?"No matching process":"No process definitions yet"}</h3><p>Add the actual process types used in your manufacturing flow.</p></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Process Directory is an independent master. It supplies process selectors and vendor capabilities without duplicating operational process executions.</span></div>
 </section>;
}


function PlannedCostDirectory({onNotice,onBack}:Pick<Props,"onNotice"|"onBack">){
 const {data,update}=useManufacturingData();
 const rows=activeRows(data.plannedCosts);
 const definitions=activeRows(data.processDefinitions);
 useEffect(()=>{
  const legacy=readRows<PlannedCostEntry>("aximach.componentPlannedCost.v1");
  if(!legacy.length)return;
  update(current=>{
   const byId=new Map(current.plannedCosts.map(row=>[row.id,row]));
   let changed=false;
   for(const row of legacy){
    const old=byId.get(row.id);
    if(!old||(Date.parse(row.updatedAt||"")||0)>(Date.parse(old.updatedAt||"")||0)){byId.set(row.id,row);changed=true;}
   }
   return changed?{...current,plannedCosts:[...byId.values()]}:current;
  });
 },[update]);
 const [search,setSearch]=useState("");
 const [componentName,setComponentName]=useState("");
 const [componentNumber,setComponentNumber]=useState("");
 const [processType,setProcessType]=useState("");
 const [processCategory,setProcessCategory]=useState("");
 const [processSubcategory,setProcessSubcategory]=useState("");
 const [plannedQty,setPlannedQty]=useState("1");
 const [unit,setUnit]=useState<"piece"|"set">("piece");
 const [plannedRate,setPlannedRate]=useState("");
 const [notes,setNotes]=useState("");
 const [extraProcesses,setExtraProcesses]=useState<Array<{id:string;processType:string;processCategory:string;processSubcategory:string;plannedQty:string;unit:"piece"|"set";plannedRate:string}>>([]);
 const filtered=useMemo(()=>rows.filter(row=>(row.componentName+" "+row.componentNumber+" "+row.processType+" "+row.processCategory+" "+(row.processSubcategory||"")+" "+row.notes).toLowerCase().includes(search.toLowerCase().trim())),[rows,search]);
 const amount=(qty:string,rate:string)=>(Number(qty)||0)*(Number(rate)||0);
 const reset=()=>{setComponentName("");setComponentNumber("");setProcessType("");setProcessCategory("");setProcessSubcategory("");setPlannedQty("1");setUnit("piece");setPlannedRate("");setNotes("");setExtraProcesses([]);};
 const setPrimaryProcess=(value:string)=>{const def=definitions.find(item=>item.processType===value);setProcessType(value);setProcessCategory(def?.category||"");setProcessSubcategory("");};
 const save=()=>{
  const all=[{processType,processCategory,processSubcategory,plannedQty,unit,plannedRate},...extraProcesses];
  if(!componentName.trim()||!componentNumber.trim()||all.some(row=>!row.processType.trim()||!Number.isFinite(Number(row.plannedQty))||Number(row.plannedQty)<=0||!Number.isFinite(Number(row.plannedRate))||Number(row.plannedRate)<0)){
   onNotice("Enter component name, component number and valid process, quantity and planned rate for every row.");return;
  }
  const stamp=nowIso();
  const created:PlannedCostEntry[]=all.map(row=>({
   id:makeId("planned-cost"),componentName:componentName.trim(),componentNumber:componentNumber.trim(),
   processType:row.processType.trim(),processCategory:row.processCategory.trim(),processSubcategory:row.processSubcategory.trim(),
   plannedQty:Number(row.plannedQty),unit:row.unit,plannedRate:Number(row.plannedRate),notes:notes.trim(),createdAt:stamp,updatedAt:stamp
  }));
  update(current=>({...current,plannedCosts:[...created,...current.plannedCosts]}));
  reset();
  onNotice(created.length+" independent planned process cost row(s) saved for "+componentNumber+".");
 };
 const remove=(id:string)=>{if(!window.confirm("Delete this planned-cost record?"))return;const stamp=nowIso();update(current=>({...current,plannedCosts:current.plannedCosts.map(row=>row.id===id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));onNotice("Planned-cost record archived.");};
 return <section className="workspace-page specialized-directory">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> INDEPENDENT COST DIRECTORY</span><span className="module-number">{rows.length} PLANNED COST RECORDS</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> FINANCE / PLANNING REFERENCE</div><h1>Component Planned Cost<span>.</span></h1><p>Independent component and process planning. Add any number of process rows for one component; only Costing &amp; Payment reads these records for comparison.</p></div></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search component, number, category or process…"/></label></div>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Add planned cost group</h3><p>Component and process reference only; no PO or Component Master link is created.</p></div></div>
   <div className="module-record-form specialized-form">
    <label>Component name *<input value={componentName} onChange={e=>setComponentName(e.target.value)} placeholder="Component name"/></label>
    <label>Component number *<input value={componentNumber} onChange={e=>setComponentNumber(e.target.value)} placeholder="Component / part number"/></label>
    <label>Process type *{definitions.length?<select value={processType} onChange={e=>setPrimaryProcess(e.target.value)}><option value="">Select Process Directory entry…</option>{definitions.map(item=><option key={item.id} value={item.processType}>{item.processType} · {item.category}</option>)}</select>:<input value={processType} onChange={e=>setProcessType(e.target.value)} placeholder="Create a Process Directory entry first"/>}</label>
    <label>Process category<input readOnly={definitions.length>0} value={processCategory} onChange={e=>setProcessCategory(e.target.value)} placeholder="Linked from Process Directory"/></label>
    <label>Process subcategory<select value={processSubcategory} onChange={e=>setProcessSubcategory(e.target.value)}><option value="">Select subcategory</option>{(definitions.find(item=>item.processType===processType)?.subcategories||[]).map(value=><option key={value}>{value}</option>)}</select></label>
    <label>Planned quantity *<input type="number" min="0.001" step="any" value={plannedQty} onChange={e=>setPlannedQty(e.target.value)}/></label>
    <label>Unit<select value={unit} onChange={e=>setUnit(e.target.value as "piece"|"set")}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
    <label>Planned rate (₹) *<input type="number" min="0" step="0.01" value={plannedRate} onChange={e=>setPlannedRate(e.target.value)} placeholder="Rate per piece / set"/></label>
    <label>Planned amount (₹)<input readOnly value={money(amount(plannedQty,plannedRate))}/></label>
    <div className="module-form-wide planned-cost-multiple-lines">
     <div className="panel-heading"><div><h3>Additional process rows</h3><p>Each + adds another category, subcategory, quantity, unit and planned amount for the same component.</p></div><button className="button-quiet compact-button" onClick={()=>setExtraProcesses(current=>[...current,{id:makeId("planned-row"),processType:"",processCategory:"",processSubcategory:"",plannedQty:"1",unit:"piece",plannedRate:""}])}><Plus size={14}/> Add process row</button></div>
     {extraProcesses.map((row,index)=>{
      const def=definitions.find(item=>item.processType===row.processType);
      return <div className="module-record-form planned-cost-process-row" key={row.id}>
       <label>Process type *<select value={row.processType} onChange={e=>{const next=definitions.find(item=>item.processType===e.target.value);setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,processType:e.target.value,processCategory:next?.category||"",processSubcategory:""}:item));}}><option value="">Select process…</option>{definitions.map(item=><option key={item.id} value={item.processType}>{item.processType} · {item.category}</option>)}</select></label>
       <label>Process category<input readOnly value={row.processCategory}/></label>
       <label>Process subcategory<select value={row.processSubcategory} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,processSubcategory:e.target.value}:item))}><option value="">Select subcategory</option>{(def?.subcategories||[]).map(value=><option key={value}>{value}</option>)}</select></label>
       <label>Quantity *<input type="number" min="0.001" step="any" value={row.plannedQty} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,plannedQty:e.target.value}:item))}/></label>
       <label>Unit<select value={row.unit} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,unit:e.target.value as "piece"|"set"}:item))}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
       <label>Planned rate (₹) *<input type="number" min="0" step="0.01" value={row.plannedRate} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,plannedRate:e.target.value}:item))}/></label>
       <label>Planned amount (₹)<input readOnly value={money(amount(row.plannedQty,row.plannedRate))}/></label>
       <button className="button-quiet compact-button" onClick={()=>setExtraProcesses(current=>current.filter(item=>item.id!==row.id))}><Trash2 size={13}/> Remove row {index+2}</button>
      </div>;
     })}
    </div>
    <label className="module-form-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Assumptions or rate basis"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/> Save {extraProcesses.length+1} process cost row(s)</button></div>
   </div>
  </section>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Planned cost register</h3><p>{filtered.length} of {rows.length} saved records</p></div></div>
   {filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component</th><th>Component number</th><th>Process</th><th>Category</th><th>Subcategory</th><th>Quantity</th><th>Planned rate</th><th>Planned amount</th><th>Action</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td><strong>{row.componentName}</strong><small>{row.notes||"Independent planned cost"}</small></td><td>{row.componentNumber}</td><td>{row.processType}</td><td>{row.processCategory||"—"}</td><td>{row.processSubcategory||"—"}</td><td>{row.plannedQty.toLocaleString("en-IN")} {row.unit}</td><td>{money(row.plannedRate)}</td><td><strong>{money(row.plannedQty*row.plannedRate)}</strong></td><td><button className="button-quiet compact-button" onClick={()=>remove(row.id)}><Trash2 size={13}/> Delete</button></td></tr>)}</tbody></table></div>:<div className="module-empty-state"><CircleDollarSign size={24}/><h3>{search?"No matching planned costs":"No planned costs saved"}</h3><p>Create an independent planned rate for each component and process combination.</p></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>This directory remains independent of Purchase Orders and Component Directory. Process selectors, categories and subcategories are sourced from Process Directory; this directory is read by Costing &amp; Payment.</span></div>
 </section>;
}


export default function SpecializedDirectoryWorkspace(props:Props){
 return props.moduleId==="process-master"?<ProcessDirectory {...props}/>:<PlannedCostDirectory {...props}/>;
}
