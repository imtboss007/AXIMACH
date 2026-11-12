import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { ArrowRight, Check, CircleDollarSign, Layers3, Plus, Search, ShieldCheck, Trash2, Users, Edit3, FileDown, FileText, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type PlannedCostEntry, type ProcessDefinitionRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import PartMaterialCostingPanel from "./PartMaterialCostingPanel";
import { MechanicalIconGlyph, MECHANICAL_ICON_INVENTORY, mechanicalOperationSvgForName } from "./MechanicalOperationIcon";
import { ComponentIcon, ProcessIcon } from "./IconStudio";

type Props={moduleId:"process-master"|"planned-cost";onBack:()=>void;onNotice:(value:string)=>void;notice:string;onOpenIconStudio?:(processDefinitionId?:string)=>void};
type ProcessEntry=ProcessDefinitionRecord;
const PROCESS_KEY="aximach.processDirectory.v1";
function readRows<T>(key:string):T[]{try{const value=JSON.parse(localStorage.getItem(key)||"[]");return Array.isArray(value)?value as T[]:[];}catch{return[];}}
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});

function processLogoSource(process: Pick<ProcessEntry, "id" | "processType">): string {
 try {
  const assignments=JSON.parse(window.localStorage.getItem("aximach.icon-assignments.v1")||"{}") as Record<string,{customAsset?:string}>;
  const saved=assignments["process:"+process.id]?.customAsset;
  if(saved&&saved.startsWith("data:image/"))return saved;
 } catch { /* Use the deterministic process glyph if local preferences cannot be read. */ }
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(mechanicalOperationSvgForName(process.processType));
}
async function processLogoPngBase64(process: Pick<ProcessEntry, "id" | "processType">): Promise<string> {
 const image=new Image(),source=processLogoSource(process);
 await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error("Could not render process logo: "+process.processType));image.src=source;});
 const canvas=document.createElement("canvas");canvas.width=96;canvas.height=96;
 const context=canvas.getContext("2d");if(!context)throw new Error("Canvas export is unavailable for process logos.");
 context.drawImage(image,4,4,88,88);return canvas.toDataURL("image/png").split(",")[1];
}

function ProcessDirectory({onNotice,onBack,onOpenIconStudio}:Pick<Props,"onNotice"|"onBack"|"onOpenIconStudio">){
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
 useEffect(()=>{
  const needsIds=data.processDefinitions.some(row=>row.subcategories.length>0&&(!Array.isArray(row.subcategoryIds)||row.subcategoryIds.length!==row.subcategories.length||row.subcategoryIds.some(id=>!id)));
  if(!needsIds)return;
  update(current=>({...current,processDefinitions:current.processDefinitions.map(row=>{
   if(!row.subcategories.length)return row;
   const ids=row.subcategories.map((_,index)=>row.subcategoryIds?.[index]||row.id+"-subprocess-"+String(index+1).padStart(3,"0"));
   return ids.length===row.subcategoryIds?.length&&ids.every((id,index)=>id===row.subcategoryIds?.[index])?row:{...row,subcategoryIds:ids};
  })}));
 },[data.processDefinitions,update]);
 const [search,setSearch]=useState("");
 const [editingId,setEditingId]=useState("");
 const [processType,setProcessType]=useState("");
 const [category,setCategory]=useState("");
 const [subcategories,setSubcategories]=useState("");
 const [subcategoryDraft,setSubcategoryDraft]=useState("");
 const [vendorIds,setVendorIds]=useState<string[]>([]);
 const [selectedProcessIds,setSelectedProcessIds]=useState<string[]>([]);
 const [selectedCategoryFilters,setSelectedCategoryFilters]=useState<string[]>([]);
 const [selectedTypeFilters,setSelectedTypeFilters]=useState<string[]>([]);
 const [selectedVendorFilters,setSelectedVendorFilters]=useState<string[]>([]);
 const [notes,setNotes]=useState("");
 const [processColor,setProcessColor]=useState("#4b95eb");
 const filtered=useMemo(()=>rows.filter(row=>(row.processType+" "+row.category+" "+row.subcategories.join(" ")+" "+row.notes+" "+row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join(" ")).toLowerCase().includes(search.toLowerCase().trim())
  &&(!selectedCategoryFilters.length||selectedCategoryFilters.includes(row.category))
  &&(!selectedTypeFilters.length||selectedTypeFilters.includes(row.processType))
  &&(!selectedVendorFilters.length||row.vendorIds.some(id=>selectedVendorFilters.includes(id)))),[rows,search,vendors,selectedCategoryFilters,selectedTypeFilters,selectedVendorFilters]);
 const reset=()=>{setEditingId("");setProcessType("");setCategory("");setSubcategories("");setVendorIds([]);setNotes("");setSubcategoryDraft("");setProcessColor("#4b95eb");};
 const save=()=>{
  if(!processType.trim()||!category.trim()){onNotice("Enter the process type and category.");return;}
  const duplicate=rows.find(row=>row.id!==editingId&&row.category.trim().toLowerCase()===category.trim().toLowerCase()&&row.processType.trim().toLowerCase()===processType.trim().toLowerCase());
  if(duplicate){onNotice("This process type already exists in the selected category. Edit the existing definition or choose a different process type.");return;}
  const stamp=nowIso();
  const old=rows.find(row=>row.id===editingId);
  const nextSubcategories=[...new Set(subcategories.split(",").map(x=>x.trim()).filter(Boolean))].slice(0,100);
  const nextSubcategoryIds=nextSubcategories.map((name,index)=>{
   const matchingOldIndex=old?.subcategories.findIndex(item=>item.trim().toLowerCase()===name.toLowerCase())??-1;
   // Exact-name matches survive reordering. For a same-position edit, retain the
   // previous permanent ID so a renamed sub-process keeps its logo assignment.
   return (matchingOldIndex>=0?old?.subcategoryIds?.[matchingOldIndex]:"")
    || old?.subcategoryIds?.[index]
    || makeId("subprocess");
  });
  const row:ProcessEntry={
   id:editingId||makeId("process"),
   processType:processType.trim(),
   category:category.trim(),
   subcategories:nextSubcategories,
   subcategoryIds:nextSubcategoryIds,
   vendorIds,
   displayColor:processColor,
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
  setSubcategories(row.subcategories.join(", "));setVendorIds(row.vendorIds);setNotes(row.notes);setProcessColor(row.displayColor||"#4b95eb");
 };
 const remove=(id:string)=>{
  if(!window.confirm("Delete this process directory record? Existing production operation history will not be changed."))return;
  const stamp=nowIso();
  update(current=>({...current,processDefinitions:current.processDefinitions.map(row=>row.id===id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
  onNotice("Process directory record archived. Historical operations remain unchanged.");
 };
 const exportCsv=(exportRows:ProcessEntry[]=filtered)=>{
  const quote=(value:unknown)=>'"'+String(value??"").replace(/"/g,'""')+'"';
  const csv=[
   ["Process Type","Category","Subcategories","Vendors","Notes"].map(quote).join(","),
   ...exportRows.map(row=>[
    row.processType,row.category,row.subcategories.join("; "),
    row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join("; "),row.notes
   ].map(quote).join(","))
  ].join("\r\n");
  const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a");a.href=url;a.download="AXIMACH-Process-Directory.csv";a.click();URL.revokeObjectURL(url);
 };
 const exportExcel=async(exportRows:ProcessEntry[]=filtered)=>{
  try{
   const workbook=new ExcelJS.Workbook();
   workbook.creator="AXIMACH";
   workbook.created=new Date();
   const sheet=workbook.addWorksheet("Process Directory");
   sheet.columns=[
    {header:"Logo",key:"logo",width:10},
    {header:"Process Type",key:"processType",width:28},
    {header:"Category",key:"category",width:22},
    {header:"Subcategories",key:"subcategories",width:48},
    {header:"Vendors",key:"vendors",width:42},
    {header:"Notes",key:"notes",width:48}
   ];
   sheet.addRows(exportRows.map(row=>({
    processType:row.processType,category:row.category,subcategories:row.subcategories.join("; "),
    vendors:row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join("; "),notes:row.notes
   })));
   for(let index=0;index<exportRows.length;index++){
    const row=exportRows[index];
    const imageId=workbook.addImage({base64:await processLogoPngBase64(row),extension:"png"});
    sheet.addImage(imageId,{tl:{col:0,row:index+1},ext:{width:30,height:30}});
    sheet.getRow(index+2).height=28;
   }
   sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};
   sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17324D"}};
   sheet.views=[{state:"frozen",ySplit:1}];
   const bytes=await workbook.xlsx.writeBuffer();
   const blob=new Blob([new Uint8Array(bytes).buffer as ArrayBuffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
   const url=URL.createObjectURL(blob);const a=document.createElement("a");
   a.href=url;a.download="AXIMACH-Process-Directory.xlsx";a.click();URL.revokeObjectURL(url);
   onNotice("Excel workbook exported with "+exportRows.length+" process record(s).");
  }catch(error){onNotice(error instanceof Error?"Excel export failed: "+error.message:"Excel export failed.");}
 };
 const exportPdf=(exportRows:ProcessEntry[]=filtered)=>{
  const win=window.open("","_blank");
  if(!win){onNotice("Allow pop-ups to print / save the process directory as PDF.");return;}
  const esc=(value:unknown)=>String(value??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
  const html=exportRows.map(row=>"<tr><td><img src='"+esc(processLogoSource(row))+"' width='32' height='32' alt='process logo'/></td><td>"+esc(row.processType)+"</td><td>"+esc(row.category)+"</td><td>"+esc(row.subcategories.join(" · "))+"</td><td>"+esc(row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company||"").join(", "))+"</td></tr>").join("");
  win.document.write("<!doctype html><html><head><title>AXIMACH Process Directory</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left;vertical-align:middle}th{background:#eef2f6}img{display:block;object-fit:contain}</style></head><body><h1>AXIMACH · Process Directory</h1><table><thead><tr><th>Logo</th><th>Process type</th><th>Category</th><th>Subcategories</th><th>Vendors</th></tr></thead><tbody>"+html+"</tbody></table></body></html>");
  win.document.close();win.focus();win.print();
 };
 return <section className="workspace-page specialized-directory">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> AXIMACH</button><span className="demo-pill"><i/> INDEPENDENT PROCESS MASTER</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MANUFACTURING / MASTER DATA</div><h1>Process Directory<span>.</span></h1><p>Define process categories, process types and up to 100 subcategories; link multiple vendors to each process.</p></div><span className="module-number">{rows.length} PROCESS RECORDS</span></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search process, category, subcategory or vendor…"/></label><button type="button" className="button-quiet compact-button" onClick={()=>{setSearch("");setSelectedCategoryFilters([]);setSelectedTypeFilters([]);setSelectedVendorFilters([]);}}>Clear filters</button></div>
  <section className="surface-panel process-directory-filter-panel"><div className="panel-heading"><div><h3>Process Directory filters</h3><p>Filter by category, process type and linked vendor; each field supports partial search and multi-selection.</p></div></div><div className="contact360-filter-grid ax-search-filter-columns"><SearchableMultiSelect id="process-directory-category-filter" label="Category" options={[...new Set(rows.map(row=>row.category))].sort().map(value=>({id:value,label:value}))} selected={selectedCategoryFilters} onChange={setSelectedCategoryFilters} emptyMeansAll/><SearchableMultiSelect id="process-directory-type-filter" label="Process type" options={[...new Set(rows.map(row=>row.processType))].sort().map(value=>({id:value,label:value}))} selected={selectedTypeFilters} onChange={setSelectedTypeFilters} emptyMeansAll/><SearchableMultiSelect id="process-directory-vendor-filter" label="Linked vendor" options={vendors.map(v=>({id:v.id,label:v.company+" · "+v.contact}))} selected={selectedVendorFilters} onChange={setSelectedVendorFilters} emptyMeansAll/></div></section>
  <section className="surface-panel">
   <div className="panel-heading"><div><h3>{editingId?"Edit process definition":"Add process definition"}</h3><p>One process type may contain up to 100 subcategories and multiple vendor assignments.</p></div></div>
   <div className="module-record-form specialized-form">
    <SearchablePicker id="process-category" label="Process category *" value={category} placeholder="Search or add a category…" options={[...new Set(rows.map(row=>row.category))].sort().map(value=>({id:value,label:value}))} onChange={value=>{setCategory(value);const related=rows.filter(row=>row.category===value);if(!related.some(row=>row.processType===processType))setProcessType("");setSubcategories("");}} allowCustom/>
    <SearchablePicker id="process-type" label="Process type *" value={rows.some(row=>row.category===category&&row.processType===processType)?category+"::"+processType:processType} placeholder="Search or add a process type…" options={rows.filter(row=>!category||row.category===category).map(row=>({id:row.category+"::"+row.processType,label:row.processType+" · "+row.category}))} onChange={value=>{const linked=rows.find(row=>row.category+"::"+row.processType===value)||rows.find(row=>row.processType===value&&(row.category===category||!category));if(linked){setProcessType(linked.processType);setCategory(linked.category);setSubcategories(linked.subcategories.join(", "));setProcessColor(linked.displayColor||"#4b95eb");}else{setProcessType(value);}}} allowCustom/>
    <div className="module-form-wide process-subcategory-editor"><SearchableMultiSelect id="process-subcategories" label="Existing subcategories" options={[...new Set(rows.filter(row=>(!category||row.category===category)&&(!processType||row.processType===processType)).flatMap(row=>row.subcategories))].sort().map(value=>({id:value,label:value}))} selected={subcategories.split(",").map(value=>value.trim()).filter(Boolean)} onChange={values=>setSubcategories(values.join(", "))} placeholder="Search subcategory…"/><label>Add subcategory <input value={subcategoryDraft} onChange={event=>setSubcategoryDraft(event.target.value)} placeholder="Type new subcategory…"/></label><button type="button" className="button-quiet compact-button" onClick={()=>{const value=subcategoryDraft.trim();const current=subcategories.split(",").map(x=>x.trim()).filter(Boolean);if(value&&!current.includes(value)&&current.length<100)setSubcategories([...current,value].join(", "));setSubcategoryDraft("");}}>＋ Add subcategory</button><small>Up to 100 separate subcategory entries per process type.</small></div>
    <div className="module-form-wide process-vendor-selection"><SearchableMultiSelect id="process-vendor-links" label="Linked vendors" options={vendors.map(v=>({id:v.id,label:v.company+" · "+v.contact}))} selected={vendorIds} onChange={setVendorIds} placeholder="Search vendor company or contact…"/><small>One process can link to multiple vendors; one vendor can link to multiple processes.</small></div>
    <label className="process-color-field module-form-wide">Process type colour<input type="color" value={processColor} onChange={event=>setProcessColor(event.target.value)}/><small>This colour is saved on the Process Directory definition and reused by every operation and route arrow for this process type.</small></label>
    <label className="module-form-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Process scope or requirements"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={save}><Check size={14}/>{editingId?"Save changes":"Add process"}</button>{editingId&&<button className="button-quiet" onClick={reset}>Cancel edit</button>}</div>
   </div>
  </section>
  <section className="surface-panel">
   <div className="panel-heading"><div><h3>Process definitions</h3><p>{filtered.length} of {rows.length} saved records</p></div><div className="module-form-actions"><button className="button-quiet compact-button" onClick={()=>void exportExcel(filtered)}>Filtered Excel</button><button className="button-quiet compact-button" onClick={()=>exportPdf(filtered)}>Filtered PDF</button><button className="button-quiet compact-button" onClick={()=>exportCsv(filtered)}>Filtered CSV</button><button className="button-danger compact-button" disabled={!selectedProcessIds.length} onClick={()=>{if(!window.confirm("Permanently delete selected process definitions? Operation history will remain unchanged."))return;update(current=>({...current,processDefinitions:current.processDefinitions.filter(row=>!selectedProcessIds.includes(row.id))}));setSelectedProcessIds([]);onNotice("Selected process definitions deleted.");}}>Delete selected</button></div></div>
   {filtered.length?<><div className="module-action-bar po-bulk-actions"><label><input type="checkbox" checked={filtered.length>0&&filtered.every(row=>selectedProcessIds.includes(row.id))} onChange={event=>setSelectedProcessIds(event.target.checked?[...new Set([...selectedProcessIds,...filtered.map(row=>row.id)])]:selectedProcessIds.filter(id=>!filtered.some(row=>row.id===id)))}/> Select all visible</label><span className="module-number">{selectedProcessIds.length} selected</span><button className="button-quiet compact-button" disabled={!selectedProcessIds.length} onClick={()=>void exportExcel(rows.filter(row=>selectedProcessIds.includes(row.id)))}>Selected Excel</button><button className="button-quiet compact-button" disabled={!selectedProcessIds.length} onClick={()=>exportPdf(rows.filter(row=>selectedProcessIds.includes(row.id)))}>Selected PDF</button><button className="button-quiet compact-button" onClick={()=>void exportExcel(rows)}>All Excel</button><button className="button-quiet compact-button" onClick={()=>exportPdf(rows)}>All PDF</button><button className="button-quiet compact-button" onClick={()=>exportCsv(rows)}>All CSV</button><button className="button-quiet compact-button" onClick={()=>setSelectedProcessIds([])}>Clear</button></div><div className="specialized-record-list">{filtered.map(row=><article className="specialized-record" key={row.id}><label className="po-row-select"><input type="checkbox" checked={selectedProcessIds.includes(row.id)} onChange={()=>setSelectedProcessIds(current=>current.includes(row.id)?current.filter(id=>id!==row.id):[...current,row.id])}/></label><span className="specialized-record-icon"><ProcessIcon processId={row.id} processName={row.processType} category={row.category} fallback={<Layers3 size={18}/>} /></span><div className="specialized-record-copy"><strong>{row.processType}</strong><span>{row.category}</span><p className="process-subcategory-logo-list">{row.subcategories.length?row.subcategories.map((subcategory,index)=><span className="process-subcategory-logo-chip" key={row.subcategoryIds?.[index]||subcategory}><ProcessIcon processId={row.id} processName={row.processType} category={row.category} subcategory={subcategory} fallback={<Layers3 size={12}/>} />{subcategory}</span>):"No subcategories added"}</p><small>{row.vendorIds.map(id=>vendors.find(v=>v.id===id)?.company).filter(Boolean).join(", ")||"No vendor linked"}</small>{row.notes&&<small>{row.notes}</small>}</div><button className="button-quiet compact-button" onClick={()=>onOpenIconStudio?.(row.id)} title="Assign process logo"><Layers3 size={13}/> Add / change process logo</button><button className="button-quiet compact-button" onClick={()=>{edit(row);window.scrollTo({top:0,behavior:"smooth"});}}><Edit3 size={13}/> Edit</button><button className="button-quiet compact-button" onClick={()=>exportPdf([row])}>PDF</button><button className="button-quiet compact-button" onClick={()=>void exportExcel([row])}>Excel</button><button className="button-quiet compact-button" onClick={()=>remove(row.id)}><Trash2 size={13}/> Delete</button></article>)}</div></>:<div className="module-empty-state"><Layers3 size={24}/><h3>{search?"No matching process":"No process definitions yet"}</h3><p>Add the actual process types used in your manufacturing flow.</p></div>}
  </section>
  <section className="surface-panel mechanical-icon-inventory">
   <div className="panel-heading"><div><h3>Mechanical Icon Inventory</h3><p>{MECHANICAL_ICON_INVENTORY.length} machining, fabrication, inspection and component symbols. The same icon rules are used on component-name records and process operations.</p></div></div>
   <div className="mechanical-icon-grid">{MECHANICAL_ICON_INVENTORY.map(item=><article className="mechanical-icon-card" key={item.glyph}><MechanicalIconGlyph glyph={item.glyph} label={item.label}/><div><strong>{item.label}</strong><small>{item.application}</small></div></article>)}</div>
  </section>

  <div className="module-safety-note"><ShieldCheck size={15}/><span>Process Directory is an independent master. It supplies process selectors and vendor capabilities without duplicating operational process executions.</span></div>
 </section>;
}


function PlannedCostDirectory({onNotice,onBack}:Pick<Props,"onNotice"|"onBack">){
 const {data,update}=useManufacturingData();
 const rows=activeRows(data.plannedCosts);
 const definitions=activeRows(data.processDefinitions);
 const companies=activeRows(data.companies);
 const purchaseOrders=activeRows(data.purchaseOrders);
 const components=activeRows(data.components);
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
 const [companyFilters,setCompanyFilters]=useState<string[]>([]);
 const [poFilters,setPoFilters]=useState<string[]>([]);
 const [componentFilters,setComponentFilters]=useState<string[]>([]);
 const [categoryFilters,setCategoryFilters]=useState<string[]>([]);
 const [processFilters,setProcessFilters]=useState<string[]>([]);
 const [subcategoryFilters,setSubcategoryFilters]=useState<string[]>([]);
 const [companyId,setCompanyId]=useState("");
 const [companyName,setCompanyName]=useState("");
 const [poId,setPoId]=useState("");
 const [poNumber,setPoNumber]=useState("");
 const [componentId,setComponentId]=useState("");
 const [componentName,setComponentName]=useState("");
 const [componentNumber,setComponentNumber]=useState("");
 const [processType,setProcessType]=useState("");
 const [processCategory,setProcessCategory]=useState("");
 const [processSubcategory,setProcessSubcategory]=useState("");
 const [processSubcategoryId,setProcessSubcategoryId]=useState("");
 const [plannedQty,setPlannedQty]=useState("1");
 const [unit,setUnit]=useState<"piece"|"set">("piece");
 const [plannedRate,setPlannedRate]=useState("");
 const [notes,setNotes]=useState("");
 const [extraProcesses,setExtraProcesses]=useState<Array<{id:string;processDefinitionId:string;processType:string;processCategory:string;processSubcategory:string;processSubcategoryId:string;plannedQty:string;unit:"piece"|"set";plannedRate:string}>>([]);
 const [editingId,setEditingId]=useState("");
 const filtered=useMemo(()=>rows.filter(row=>{
  const companyMatch=!companyFilters.length||companyFilters.includes(row.companyId||companies.find(item=>item.name.trim().toLowerCase()===(row.companyName||"").trim().toLowerCase())?.id||"");
  const poMatch=!poFilters.length||poFilters.includes(row.poId||purchaseOrders.find(item=>item.number.trim().toLowerCase()===(row.poNumber||"").trim().toLowerCase())?.id||"");
  const componentMatch=!componentFilters.length||componentFilters.includes(row.componentId||components.find(item=>item.partNumber.trim().toLowerCase()===row.componentNumber.trim().toLowerCase()||item.name.trim().toLowerCase()===row.componentName.trim().toLowerCase())?.id||"");
  return ((row.companyName||"")+" "+(row.poNumber||"")+" "+row.componentName+" "+row.componentNumber+" "+row.processType+" "+row.processCategory+" "+(row.processSubcategory||"")+" "+(row.notes||"")).toLowerCase().includes(search.toLowerCase().trim())
   &&companyMatch&&poMatch&&(!categoryFilters.length||categoryFilters.includes(row.processCategory))&&(!processFilters.length||processFilters.includes(row.processType))&&(!subcategoryFilters.length||subcategoryFilters.includes(row.processSubcategory||""))&&componentMatch;
 }),[rows,search,companyFilters,poFilters,componentFilters,categoryFilters,processFilters,subcategoryFilters,companies,purchaseOrders,components]);
 const amount=(qty:string,rate:string)=>(Number(qty)||0)*(Number(rate)||0);
 const eligiblePOs=purchaseOrders.filter(po=>!companyId||po.companyId===companyId);
 const selectedPO=purchaseOrders.find(po=>po.id===poId);
 const eligibleComponents=selectedPO?components.filter(component=>selectedPO.lines.some(line=>line.componentId===component.id)):components;
 const processCategories=[...new Set(definitions.map(item=>item.category))].sort();
 const eligibleProcessTypes=definitions.filter(item=>!processCategory||item.category===processCategory);
 const selectedPrimaryDefinition=definitions.find(item=>item.processType===processType&&item.category===processCategory);
 const reset=()=>{setEditingId("");setCompanyId("");setCompanyName("");setPoId("");setPoNumber("");setComponentId("");setComponentName("");setComponentNumber("");setProcessType("");setProcessCategory("");setProcessSubcategory("");setProcessSubcategoryId("");setPlannedQty("1");setUnit("piece");setPlannedRate("");setNotes("");setExtraProcesses([]);};
 const setPrimaryProcess=(value:string)=>{const def=definitions.find(item=>item.processType===value&&item.category===processCategory)||definitions.find(item=>item.processType===value);setProcessType(value);setProcessCategory(def?.category||processCategory);setProcessSubcategory("");setProcessSubcategoryId("");};
 const save=()=>{
  const primaryDefinition=definitions.find(item=>item.processType===processType&&item.category===processCategory);
  const all=[{processDefinitionId:primaryDefinition?.id||"",processType,processCategory,processSubcategory,processSubcategoryId,plannedQty,unit,plannedRate},...extraProcesses];
  if(!componentName.trim()||!componentNumber.trim()||all.some(row=>!row.processType.trim()||!Number.isFinite(Number(row.plannedQty))||Number(row.plannedQty)<=0||!Number.isFinite(Number(row.plannedRate))||Number(row.plannedRate)<0)){
   onNotice("Enter component name, component number and valid process, quantity and planned rate for every row.");return;
  }
  const stamp=nowIso();
  const created:PlannedCostEntry[]=all.map(row=>{
   const definition=definitions.find(item=>item.id===row.processDefinitionId)
    || definitions.find(item=>item.processType.trim().toLowerCase()===row.processType.trim().toLowerCase()&&item.category.trim().toLowerCase()===row.processCategory.trim().toLowerCase());
   const subcategoryIndex=definition?.subcategories.indexOf(row.processSubcategory) ?? -1;
   const stableSubcategoryId=row.processSubcategoryId || (definition&&subcategoryIndex>=0
    ? definition.subcategoryIds?.[subcategoryIndex] || definition.id+"-subprocess-"+String(subcategoryIndex+1).padStart(3,"0")
    : undefined);
   const old=editingId&&row===all[0]?rows.find(item=>item.id===editingId):undefined;
   return {
    id:old?.id||makeId("planned-cost"),companyId,poId,componentId,companyName:companyName.trim(),poNumber:poNumber.trim(),componentName:componentName.trim(),componentNumber:componentNumber.trim(),
    processDefinitionId:definition?.id,processSubcategoryId:stableSubcategoryId,
    processType:row.processType.trim(),processCategory:row.processCategory.trim(),processSubcategory:row.processSubcategory.trim(),
    plannedQty:Number(row.plannedQty),unit:row.unit,plannedRate:Number(row.plannedRate),notes:notes.trim(),createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined
   };
  });
  const savedIds=new Set(created.map(row=>row.id));
  update(current=>({...current,plannedCosts:[...created,...current.plannedCosts.filter(row=>!savedIds.has(row.id))]}));
  const wasEditing=Boolean(editingId);
  reset();
  onNotice(wasEditing?"Planned-cost record updated for "+componentNumber+".":created.length+" independent planned process cost row(s) saved for "+componentNumber+".");
 };
 const edit=(row:PlannedCostEntry)=>{setEditingId(row.id);setCompanyId(row.companyId||"");setCompanyName(row.companyName||companies.find(item=>item.id===row.companyId)?.name||"");setPoId(row.poId||"");setPoNumber(row.poNumber||purchaseOrders.find(item=>item.id===row.poId)?.number||"");setComponentId(row.componentId||"");setComponentName(row.componentName);setComponentNumber(row.componentNumber);setProcessType(row.processType);setProcessCategory(row.processCategory);setProcessSubcategory(row.processSubcategory||"");setProcessSubcategoryId(row.processSubcategoryId||"");setPlannedQty(String(row.plannedQty));setUnit(row.unit);setPlannedRate(String(row.plannedRate));setNotes(row.notes||"");setExtraProcesses([]);window.scrollTo({top:0,behavior:"smooth"});};
 const remove=(id:string)=>{if(!window.confirm("Delete this planned-cost record?"))return;const stamp=nowIso();update(current=>({...current,plannedCosts:current.plannedCosts.map(row=>row.id===id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));if(editingId===id)reset();onNotice("Planned-cost record archived.");};
 return <section className="workspace-page specialized-directory">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> LINKED COST DIRECTORY</span><span className="module-number">{rows.length} PLANNED COST RECORDS</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> FINANCE / PLANNING REFERENCE</div><h1>Component Planned Cost<span>.</span></h1><p>Linked component and process planning. Company, PO, component and Process Directory references are stored by stable record ID and read by Costing &amp; Payment.</p></div></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, PO, component, number, category or process…"/></label><button type="button" className="button-quiet compact-button" onClick={()=>{setSearch("");setCompanyFilters([]);setPoFilters([]);setComponentFilters([]);setCategoryFilters([]);setProcessFilters([]);setSubcategoryFilters([]);}}>Clear filters</button></div>
  <section className="surface-panel planned-cost-filter-panel"><div className="panel-heading"><div><h3>Planned cost filters</h3><p>Search and multi-select linked master records and planned process categories.</p></div><button className="button-quiet compact-button" onClick={()=>{setCompanyFilters([]);setPoFilters([]);setComponentFilters([]);setCategoryFilters([]);setProcessFilters([]);}}>Clear selections</button></div><div className="contact360-filter-grid ax-search-filter-columns"><SearchableMultiSelect id="planned-cost-company-filter" label="Company" options={companies.map(item=>({id:item.id,label:item.name}))} selected={companyFilters} onChange={setCompanyFilters} emptyMeansAll/><SearchableMultiSelect id="planned-cost-po-filter" label="Purchase order" options={purchaseOrders.map(item=>({id:item.id,label:item.number+" · "+(companies.find(company=>company.id===item.companyId)?.name||"Company")}))} selected={poFilters} onChange={setPoFilters} emptyMeansAll/><SearchableMultiSelect id="planned-cost-component-filter" label="Component" options={components.map(item=>({id:item.id,label:item.partNumber+" · "+item.name}))} selected={componentFilters} onChange={setComponentFilters} emptyMeansAll/><SearchableMultiSelect id="planned-cost-category-filter" label="Process category" options={processCategories.map(value=>({id:value,label:value}))} selected={categoryFilters} onChange={setCategoryFilters} emptyMeansAll/><SearchableMultiSelect id="planned-cost-process-filter" label="Process type" options={[...new Set(definitions.map(item=>item.processType))].sort().map(value=>({id:value,label:value}))} selected={processFilters} onChange={setProcessFilters} emptyMeansAll/><SearchableMultiSelect id="planned-cost-subcategory-filter" label="Process subcategory" options={[...new Set(rows.map(row=>row.processSubcategory||"").filter(Boolean))].sort().map(value=>({id:value,label:value}))} selected={subcategoryFilters} onChange={setSubcategoryFilters} emptyMeansAll/></div></section>
  <section className="surface-panel"><div className="panel-heading"><div><h3>{editingId?"Edit planned cost record":"Add planned cost group"}</h3><p>Choose the actual master records. Planned-cost lines retain stable company, PO, component and process-definition IDs.</p></div></div>
   <div className="module-record-form specialized-form">
    <SearchablePicker id="planned-company" label="Company" value={companyId} placeholder="Search company name…" options={companies.map(item=>({id:item.id,label:item.name+" · "+(item.gstin||"GSTIN not set")}))} onChange={value=>{const item=companies.find(row=>row.id===value);setCompanyId(value);setCompanyName(item?.name||"");setPoId("");setPoNumber("");setComponentId("");setComponentName("");setComponentNumber("");}}/>
    <SearchablePicker id="planned-po" label="Purchase order" value={poId} placeholder="Search PO number…" options={eligiblePOs.map(item=>({id:item.id,label:item.number+" · "+(companies.find(row=>row.id===item.companyId)?.name||"Company")}))} onChange={value=>{const item=purchaseOrders.find(row=>row.id===value);const company=companies.find(row=>row.id===item?.companyId);setPoId(value);setPoNumber(item?.number||"");if(item&&company){setCompanyId(company.id);setCompanyName(company.name);}setComponentId("");setComponentName("");setComponentNumber("");}}/>
    <div className="module-form-wide planned-component-select"><div className="panel-heading"><div><strong>Component</strong><p>Selected from Component Master by stable record ID.</p></div>{componentName&&<ComponentIcon componentId={componentId || undefined} componentName={componentName+" "+componentNumber}/> }</div><SearchablePicker id="planned-component" label="Component *" value={componentId} placeholder="Search part number or component name…" options={eligibleComponents.map(item=>({id:item.id,label:item.partNumber+" · "+item.name}))} onChange={value=>{const item=components.find(row=>row.id===value);setComponentId(value);setComponentName(item?.name||"");setComponentNumber(item?.partNumber||"");if(item){const company=companies.find(row=>row.id===item.companyId);if(company){setCompanyId(company.id);setCompanyName(company.name);}}}}/></div>
    <SearchablePicker id="planned-process-category" label="Process category *" value={processCategory} placeholder="Search Process Directory category…" options={processCategories.map(value=>({id:value,label:value}))} onChange={value=>{setProcessCategory(value);setProcessType("");setProcessSubcategory("");setProcessSubcategoryId("");}}/>
    <SearchablePicker id="planned-process-type" label="Process type *" value={processType} placeholder="Search process type…" options={eligibleProcessTypes.map(item=>({id:item.processType,label:item.processType}))} onChange={setPrimaryProcess}/>
    {definitions.find(item=>item.processType===processType&&item.category===processCategory)&&<div className="module-form-wide process-selection-identity"><ProcessIcon processId={definitions.find(item=>item.processType===processType&&item.category===processCategory)?.id} processName={processType} category={processCategory} fallback={<Layers3 size={16}/>} /><span><strong>{processType}</strong><small>{processCategory} · Logo shared with Process Directory and Process Plan</small></span></div>}
    <SearchablePicker id="planned-process-subcategory" label="Process subcategory" value={processSubcategoryId} placeholder="Select a linked Process Directory subcategory…" options={selectedPrimaryDefinition ? selectedPrimaryDefinition.subcategories.map((value,index)=>({id:selectedPrimaryDefinition.subcategoryIds?.[index] || selectedPrimaryDefinition.id+"-subprocess-"+String(index+1).padStart(3,"0"),label:value})) : []} onChange={value=>{const definition=selectedPrimaryDefinition;const index=definition ? definition.subcategories.findIndex((_,i)=>(definition.subcategoryIds?.[i] || definition.id+"-subprocess-"+String(i+1).padStart(3,"0"))===value) : -1;setProcessSubcategoryId(value);setProcessSubcategory(definition?.subcategories[index]||"");}}/>
    <label>Planned quantity *<input type="number" min="0.001" step="any" value={plannedQty} onChange={e=>setPlannedQty(e.target.value)}/></label>
    <label>Unit<select value={unit} onChange={e=>setUnit(e.target.value as "piece"|"set")}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
    <label>Planned rate (₹) *<input type="number" min="0" step="0.01" value={plannedRate} onChange={e=>setPlannedRate(e.target.value)} placeholder="Rate per piece / set"/></label>
    <label>Planned amount (₹)<input readOnly value={money(amount(plannedQty,plannedRate))}/></label>
    <div className="module-form-wide planned-cost-multiple-lines">
     <div className="panel-heading"><div><h3>Additional process rows</h3><p>Each + adds another category, subcategory, quantity, unit and planned amount for the same component.</p></div><button className="button-quiet compact-button" onClick={()=>setExtraProcesses(current=>[...current,{id:makeId("planned-row"),processDefinitionId:"",processType:"",processCategory:"",processSubcategory:"",processSubcategoryId:"",plannedQty:"1",unit:"piece",plannedRate:""}])}><Plus size={14}/> Add process row</button></div>
     {extraProcesses.map((row,index)=>{
      const def=definitions.find(item=>item.id===row.processDefinitionId);
      return <div className="module-record-form planned-cost-process-row" key={row.id}>
       <label>Process type *<select value={row.processDefinitionId} onChange={e=>{const next=definitions.find(item=>item.id===e.target.value);setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,processDefinitionId:next?.id||"",processType:next?.processType||"",processCategory:next?.category||"",processSubcategory:"",processSubcategoryId:""}:item));}}><option value="">Select process…</option>{definitions.filter(item=>!row.processCategory||item.category===row.processCategory).map(item=><option key={item.id} value={item.id}>{item.processType} · {item.category}</option>)}</select>{def&&<span className="process-inline-identity"><ProcessIcon processId={def.id} processName={def.processType} category={def.category} fallback={<Layers3 size={14}/>} />{def.category}</span>}</label>
       <SearchablePicker id={"planned-extra-category-"+row.id} label="Process category *" value={row.processCategory} placeholder="Search category…" options={processCategories.map(value=>({id:value,label:value}))} onChange={value=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,processCategory:value,processDefinitionId:"",processType:"",processSubcategory:"",processSubcategoryId:""}:item))}/>
       <SearchablePicker id={"planned-extra-subcategory-"+row.id} label="Process subcategory" value={row.processSubcategoryId} placeholder="Select a linked Process Directory subcategory…" options={(def?.subcategories||[]).map((value,subIndex)=>({id:def?.subcategoryIds?.[subIndex] || def?.id+"-subprocess-"+String(subIndex+1).padStart(3,"0"),label:value}))} onChange={value=>{const subIndex=def?.subcategories.findIndex((_,i)=>(def.subcategoryIds?.[i] || def.id+"-subprocess-"+String(i+1).padStart(3,"0"))===value) ?? -1;setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,processSubcategoryId:value,processSubcategory:def?.subcategories[subIndex]||""}:item));}}/>
       <label>Quantity *<input type="number" min="0.001" step="any" value={row.plannedQty} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,plannedQty:e.target.value}:item))}/></label>
       <label>Unit<select value={row.unit} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,unit:e.target.value as "piece"|"set"}:item))}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
       <label>Planned rate (₹) *<input type="number" min="0" step="0.01" value={row.plannedRate} onChange={e=>setExtraProcesses(current=>current.map(item=>item.id===row.id?{...item,plannedRate:e.target.value}:item))}/></label>
       <label>Planned amount (₹)<input readOnly value={money(amount(row.plannedQty,row.plannedRate))}/></label>
       <button className="button-quiet compact-button" onClick={()=>setExtraProcesses(current=>current.filter(item=>item.id!==row.id))}><Trash2 size={13}/> Remove row {index+2}</button>
      </div>;
     })}
    </div>
    <label className="module-form-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Assumptions or rate basis"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/> {editingId?"Save changes":"Save "+(extraProcesses.length+1)+" process cost row(s)"}</button></div>
   </div>
  </section>
  {componentId && <PartMaterialCostingPanel key={componentId+"-"+poId} scope="planned-cost" companyId={companyId} poId={poId} componentId={componentId} componentName={componentName} componentNumber={componentNumber} onNotice={onNotice} />}
  <section className="surface-panel"><div className="panel-heading"><div><h3>Planned cost register</h3><p>{filtered.length} of {rows.length} saved records</p></div></div>
   {filtered.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Company reference</th><th>PO reference</th><th>Component</th><th>Component number</th><th>Process</th><th>Category</th><th>Subcategory</th><th>Quantity</th><th>Planned rate</th><th>Planned amount</th><th>Action</th></tr></thead><tbody>{filtered.map(row=><tr key={row.id}><td>{row.companyName||"—"}</td><td>{row.poNumber||"—"}</td><td><div className="planned-cost-component-name"><ComponentIcon componentId={row.componentId} componentName={row.componentName+" "+row.componentNumber}/> <strong>{row.componentName}</strong></div><small>{row.notes||"Independent planned cost"}</small></td><td>{row.componentNumber}</td><td><span className="process-inline-identity"><ProcessIcon processId={row.processDefinitionId} processName={row.processType} category={row.processCategory} subcategory={row.processSubcategory} fallback={<Layers3 size={14}/>} />{row.processType}</span></td><td>{row.processCategory||"—"}</td><td>{row.processSubcategory||"—"}</td><td>{row.plannedQty.toLocaleString("en-IN")} {row.unit}</td><td>{money(row.plannedRate)}</td><td><strong>{money(row.plannedQty*row.plannedRate)}</strong></td><td><button className="button-quiet compact-button" onClick={()=>edit(row)}>Edit</button> <button className="button-quiet compact-button" onClick={()=>remove(row.id)}><Trash2 size={13}/> Delete</button></td></tr>)}</tbody></table></div>:<div className="module-empty-state"><CircleDollarSign size={24}/><h3>{search?"No matching planned costs":"No planned costs saved"}</h3><p>Create an independent planned rate for each component and process combination.</p></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>New planned-cost entries store stable master IDs. Legacy entries without IDs remain readable through a name-based compatibility fallback; Costing &amp; Payment prefers exact component and PO IDs.</span></div>
 </section>;
}


export default function SpecializedDirectoryWorkspace(props:Props){
 return props.moduleId==="process-master"?<ProcessDirectory {...props}/>:<PlannedCostDirectory {...props}/>;
}
