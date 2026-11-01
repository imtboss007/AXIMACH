import { useMemo, useState } from "react";
import { ArrowRight, Check, Pencil, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, vendorProcessTypeIds, vendorSupportsProcessType, type ProcessCategoryRecord, type ProcessTypeRecord, type ProcessVendorRateRecord, type VendorRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; onSelectModule: (id: string) => void };
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const blankVendor = (processTypeId = "", processName = "") => ({ company:"", contact:"", role:"", phone:"", whatsappNumber:"", email:"", address:"", processes:processName, processTypeId, processTypeIds:processTypeId?[processTypeId]:[], machines:"", materials:"", notes:"", status:"Unverified contact — review", sourceContactId:"", whatsappSyncedAt:"" });

export default function ProcessDirectoryWorkspace({ onBack, onNotice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const categories = activeRows(data.processCategories);
  const processTypes = activeRows(data.processTypes);
  const vendors = activeRows(data.vendors);
  const rates = activeRows(data.processVendorRates);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [typeName, setTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [showCategory, setShowCategory] = useState(false);
  const [showType, setShowType] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [rateTypeId, setRateTypeId] = useState("");
  const [rateVendorId, setRateVendorId] = useState("");
  const [rateAmount, setRateAmount] = useState("");
  const [rateNotes, setRateNotes] = useState("");
  const [editingRateId, setEditingRateId] = useState("");
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorDraft, setVendorDraft] = useState(blankVendor);
  const selectedCategory = categories.find(item => item.id === categoryId);
  const selectedType = processTypes.find(item => item.id === rateTypeId);
  const visibleCategories = useMemo(() => categories.filter(item => {
    const categoryRates=processTypes.filter(type=>type.categoryId===item.id).flatMap(type=>rates.filter(rate=>rate.processTypeId===type.id));
    const vendorNames=categoryRates.map(rate=>vendors.find(v=>v.id===rate.vendorId)?.company||"");
    return (item.name+" "+item.code+" "+item.description+" "+processTypes.filter(type=>type.categoryId===item.id).map(type=>type.name+" "+type.description).join(" ")+" "+vendorNames.join(" ")).toLowerCase().includes(search.toLowerCase().trim());
  }), [categories,processTypes,rates,vendors,search]);
  const filteredTypes = processTypes.filter(item => (!categoryId || item.categoryId === categoryId) && (item.name+" "+item.code+" "+item.description+" "+rates.filter(rate=>rate.processTypeId===item.id).map(rate=>(vendors.find(v=>v.id===rate.vendorId)?.company||"")+" "+rate.ratePerPart+" "+rate.notes).join(" ")).toLowerCase().includes(search.toLowerCase().trim()));
  const ratesForType = (typeId:string) => rates.filter(rate=>rate.processTypeId===typeId).sort((a,b)=>(a.ratePerPart||0)-(b.ratePerPart||0));
  const matchingRates = rates.filter(item => item.processTypeId === rateTypeId && (!search.trim() || [item.quoteReference,vendors.find(vendor=>vendor.id===item.vendorId)?.company,item.ratePerPart,item.notes].join(" ").toLowerCase().includes(search.toLowerCase().trim())));

  const openAddCategory = () => {setEditingCategoryId("");setCategoryName("");setCategoryDescription("");setShowCategory(true);};
  const openAddType = () => {setEditingTypeId("");setTypeName("");setTypeDescription("");setShowType(true);};
  const saveCategory = () => {
    const name=categoryName.trim();
    if(!name){onNotice("Enter a process category name.");return;}
    if(categories.some(item=>item.id!==editingCategoryId&&item.name.toLowerCase()===name.toLowerCase())){onNotice("That process category already exists.");return;}
    const stamp=nowIso();
    if(editingCategoryId){
      update(current=>({...current,processCategories:current.processCategories.map(row=>row.id===editingCategoryId?{...row,name,description:categoryDescription.trim(),updatedAt:stamp}:row)}));
      setCategoryId(editingCategoryId);onNotice("Process category name updated.");
    }else{
      const row:ProcessCategoryRecord={id:makeId("process-category"),name,code:"",description:categoryDescription.trim(),sortOrder:categories.length+1,createdAt:stamp,updatedAt:stamp};
      update(current=>({...current,processCategories:[...current.processCategories,row]}));
      setCategoryId(row.id);onNotice("Process category saved.");
    }
    setShowCategory(false);setEditingCategoryId("");setCategoryName("");setCategoryDescription("");
  };
  const saveType = () => {
    const name=typeName.trim();
    if(!categoryId||!name){onNotice("Select a category and enter a process name.");return;}
    if(processTypes.some(item=>item.id!==editingTypeId&&item.categoryId===categoryId&&item.name.toLowerCase()===name.toLowerCase())){onNotice("That process already exists in this category.");return;}
    const stamp=nowIso();
    if(editingTypeId){
      update(current=>({...current,processTypes:current.processTypes.map(row=>row.id===editingTypeId?{...row,categoryId,name,description:typeDescription.trim(),updatedAt:stamp}:row)}));
      onNotice("Process name/category updated. Existing operation and quotation links are preserved.");
    }else{
      const row:ProcessTypeRecord={id:makeId("process-type"),categoryId,name,code:"",description:typeDescription.trim(),createdAt:stamp,updatedAt:stamp};
      update(current=>({...current,processTypes:[...current.processTypes,row]}));
      onNotice("Process saved in Process Directory.");
    }
    setShowType(false);setEditingTypeId("");setTypeName("");setTypeDescription("");
  };
  const openAddRate = (processTypeId:string) => {
    setRateTypeId(processTypeId);setRateVendorId("");setRateAmount("");setRateNotes("");setEditingRateId("");setShowRate(true);
  };
  const openEditRate = (item:ProcessVendorRateRecord) => {
    setRateTypeId(item.processTypeId);setRateVendorId(item.vendorId);setRateAmount(String(item.ratePerPart));setRateNotes(item.notes||"");setEditingRateId(item.id);setShowRate(true);
  };
  const saveRate = () => {
    const amount=Number(rateAmount);
    if(!rateTypeId||!processTypes.some(type=>type.id===rateTypeId)||!rateVendorId||rateAmount.trim()===""||!Number.isFinite(amount)||amount<0){onNotice("Select a process, vendor and valid rate.");return;}
    const selectedVendor=vendors.find(item=>item.id===rateVendorId);
    if(!selectedVendor){onNotice("Select an active Vendor Master record.");return;}
    const stamp=nowIso();
    update(current=>{
      const vendor=current.vendors.find(item=>item.id===rateVendorId);
      const assignedIds=vendor?vendorProcessTypeIds(vendor):[];
      const nextIds=[...new Set([...assignedIds,rateTypeId])];
      const processNames=nextIds.map(id=>current.processTypes.find(type=>type.id===id)?.name).filter(Boolean);
      const nextVendors=current.vendors.map(item=>item.id===rateVendorId?{...item,processTypeIds:nextIds,processTypeId:item.processTypeId||rateTypeId,processes:processNames.join(", "),updatedAt:stamp}:item);
      if(editingRateId){
        return {...current,vendors:nextVendors,processVendorRates:current.processVendorRates.map(row=>row.id===editingRateId?{...row,vendorId:rateVendorId,ratePerPart:amount,notes:rateNotes.trim(),updatedAt:stamp}:row)};
      }
      const row:ProcessVendorRateRecord={id:makeId("process-vendor-rate"),processTypeId:rateTypeId,vendorId:rateVendorId,quoteReference:"",quotedAt:new Date().toISOString().slice(0,10),validFrom:"",validUntil:"",ratePerPart:amount,currency:"INR",leadDays:0,notes:rateNotes.trim(),status:"Received",createdAt:stamp,updatedAt:stamp};
      return {...current,vendors:nextVendors,processVendorRates:[...current.processVendorRates,row]};
    });
    setShowRate(false);setEditingRateId("");setRateVendorId("");setRateAmount("");setRateNotes("");
    onNotice(editingRateId?"Vendor process rate updated.":"Vendor linked to this process and rate saved.");
  };
  const archiveRate = (item:ProcessVendorRateRecord) => {
    if(!window.confirm("Remove this vendor rate? The vendor master and historical operation records will be retained."))return;
    const stamp=nowIso();update(current=>({...current,processVendorRates:current.processVendorRates.map(row=>row.id===item.id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
    onNotice("Vendor rate removed; vendor and operation history retained.");
  };
  const saveNewVendor = () => {
    const company=vendorDraft.company.trim();
    if(!company){onNotice("Enter the vendor company name.");return;}
    if(!rateTypeId||!processTypes.some(item=>item.id===rateTypeId)){onNotice("Select the process first.");return;}
    const phone=String(vendorDraft.phone||"").replace(/\D/g,"");
    const whatsappNumber=String(vendorDraft.whatsappNumber||"").replace(/\D/g,"");
    const numbers=[phone,whatsappNumber].filter(Boolean);
    const duplicate=vendors.find(item=>numbers.some(number=>[item.phone,item.whatsappNumber].some(value=>String(value||"").replace(/\D/g,"")===number)));
    if(duplicate){setRateVendorId(duplicate.id);setShowVendorForm(false);onNotice("Existing vendor selected. Assign additional capabilities from Vendor Master or add a rate.");return;}
    const stamp=nowIso(),id=makeId("vendor");
    const processName=processTypes.find(item=>item.id===rateTypeId)?.name||"";
    const record:VendorRecord={...vendorDraft,company,contact:vendorDraft.contact||"",phone,whatsappNumber,processes:processName,processTypeId:rateTypeId,processTypeIds:[rateTypeId],id,createdAt:stamp,updatedAt:stamp};
    update(current=>({...current,vendors:[...current.vendors,record]}));
    setRateVendorId(id);setVendorDraft(blankVendor(rateTypeId,processName));setShowVendorForm(false);
    onNotice("Vendor name saved in Vendor Master and selected for this process rate.");
  };
  const deleteCategory = (item:ProcessCategoryRecord) => {
    if(!window.confirm("Delete this category and its process entries from the active catalogue? Existing production routes, vendors and quotation history will remain stored."))return;
    const childTypes=processTypes.filter(type=>type.categoryId===item.id);
    const childIds=new Set(childTypes.map(type=>type.id));
    const stamp=nowIso();
    update(current=>({...current,
      processCategories:current.processCategories.map(row=>row.id===item.id?{...row,deletedAt:stamp,updatedAt:stamp}:row),
      processTypes:current.processTypes.map(row=>childIds.has(row.id)?{...row,deletedAt:stamp,updatedAt:stamp}:row),
      processVendorRates:current.processVendorRates.map(row=>childIds.has(row.processTypeId)&&!row.deletedAt?{...row,deletedAt:stamp,updatedAt:stamp}:row)
    }));
    if(categoryId===item.id)setCategoryId("");
    onNotice("Category and its sub-processes removed from the active catalogue. Saved production history remains intact.");
  };
  const deleteType = (item:ProcessTypeRecord) => {
    if(!window.confirm("Delete this process from the active directory? Existing production routes, vendor capabilities and rates will be retained as history."))return;
    const stamp=nowIso();
    update(current=>({...current,
      processTypes:current.processTypes.map(row=>row.id===item.id?{...row,deletedAt:stamp,updatedAt:stamp}:row),
      processVendorRates:current.processVendorRates.map(row=>row.processTypeId===item.id&&!row.deletedAt?{...row,deletedAt:stamp,updatedAt:stamp}:row)
    }));
    onNotice("Process removed from the active directory. Linked production history remains preserved.");
  };

  return <section className="workspace-page process-directory-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED DATA CONNECTED":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":"LOCAL DATA"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER DATA / OPERATIONS</div><h1>Process Directory<span>.</span></h1><p>Reusable process catalogue with multiple vendor capabilities and editable rates.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("vendors")}>Vendor Master</button><button className="button-primary" onClick={openAddCategory}><Plus size={15}/> Add Category</button></div></div>
    <div className="process-directory-toolbar"><label className="module-record-search"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search categories, processes, vendors and rates…"/></label><button className="button-quiet" onClick={()=>openAddRate("")} disabled={!processTypes.length}>Add Vendor Rate</button></div>
    <div className="process-directory-layout">
      <aside className="surface-panel process-directory-categories"><div className="panel-heading"><div><div className="eyebrow">PROCESS CATEGORIES</div><h3>Catalogue</h3><p>{categories.length} active categories</p></div></div>{visibleCategories.map(item=><div className={"process-directory-category "+(categoryId===item.id?"active":"")} key={item.id}><button className="process-directory-category-select" onClick={()=>setCategoryId(item.id)}><strong>{item.name}</strong><small>{processTypes.filter(type=>type.categoryId===item.id).length} processes</small></button><button title="Edit category" aria-label={"Edit "+item.name} onClick={()=>{setEditingCategoryId(item.id);setCategoryName(item.name);setCategoryDescription(item.description||"");setShowCategory(true);}}><Pencil size={13}/></button><button title="Delete category" aria-label={"Delete "+item.name} onClick={()=>deleteCategory(item)}><Trash2 size={13}/></button></div>)}{!visibleCategories.length&&<p className="process-directory-empty">No matching categories.</p>}</aside>
      <section className="surface-panel process-directory-types"><div className="panel-heading"><div><div className="eyebrow">PROCESS TYPES / SUBCATEGORIES</div><h3>{selectedCategory?.name||"All processes"}</h3><p>{filteredTypes.length} active processes</p></div><button className="button-primary compact-button" disabled={!categoryId} onClick={openAddType}><Plus size={13}/> Add Process</button></div>
        {filteredTypes.map(item=><article className="process-directory-type" key={item.id}><div className="process-directory-type-main"><strong>{item.name}</strong><small>{categories.find(category=>category.id===item.categoryId)?.name||"Category unavailable"}</small>{item.description&&<p>{item.description}</p>}<div className="process-directory-vendor-rates">{ratesForType(item.id).map(rateItem=><div className="process-directory-vendor-rate" key={rateItem.id}><span>{vendors.find(vendor=>vendor.id===rateItem.vendorId)?.company||"Vendor archived"}</span><strong>{money(rateItem.ratePerPart)}</strong>{rateItem.notes&&<small>{rateItem.notes}</small>}<button title="Edit vendor rate" aria-label="Edit vendor rate" onClick={()=>openEditRate(rateItem)}><Pencil size={12}/></button><button title="Delete vendor rate" aria-label="Delete vendor rate" onClick={()=>archiveRate(rateItem)}><Trash2 size={12}/></button></div>)}{!ratesForType(item.id).length&&<small className="field-hint">No vendor rate entered yet.</small>}</div></div><div className="process-directory-type-actions"><button className="button-quiet compact-button" onClick={()=>{setEditingTypeId(item.id);setTypeName(item.name);setTypeDescription(item.description||"");setCategoryId(item.categoryId);setShowType(true);}}><Pencil size={12}/> Edit</button><button className="button-primary compact-button" onClick={()=>openAddRate(item.id)}><Plus size={12}/> Vendor / Price</button><button className="button-quiet compact-button" onClick={()=>deleteType(item)}><Trash2 size={12}/> Delete</button></div></article>)}{!filteredTypes.length&&<div className="process-directory-empty">{categoryId?"No processes in this category. Add the first process.":"Select a category to view its processes."}</div>}
      </section>
    </div>
    {showCategory&&<div className="pp-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowCategory(false);}}><section className="pp-process-modal" role="dialog" aria-modal="true"><div className="pp-modal-head"><div><small>PROCESS DIRECTORY</small><h2>{editingCategoryId?"Edit category":"Add category"}</h2></div><button onClick={()=>setShowCategory(false)}><X size={16}/></button></div><div className="pp-modal-form"><label>Category name *<input value={categoryName} onChange={event=>setCategoryName(event.target.value)}/></label><label>Description (optional)<input value={categoryDescription} onChange={event=>setCategoryDescription(event.target.value)}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={saveCategory}><Check size={14}/> Save</button><button onClick={()=>setShowCategory(false)}>Cancel</button></div></section></div>}
    {showType&&<div className="pp-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowType(false);}}><section className="pp-process-modal" role="dialog" aria-modal="true"><div className="pp-modal-head"><div><small>{selectedCategory?.name||"PROCESS DIRECTORY"}</small><h2>{editingTypeId?"Edit process":"Add process"}</h2></div><button onClick={()=>setShowType(false)}><X size={16}/></button></div><div className="pp-modal-form"><label>Process name *<input value={typeName} onChange={event=>setTypeName(event.target.value)}/></label><label>Process category *<select value={categoryId} onChange={event=>setCategoryId(event.target.value)}>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="pp-modal-wide">Description (optional)<input value={typeDescription} onChange={event=>setTypeDescription(event.target.value)}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={saveType}><Check size={14}/> Save process</button><button onClick={()=>setShowType(false)}>Cancel</button></div></section></div>}
    {showRate&&<div className="pp-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowRate(false);}}><section className="pp-process-modal process-directory-rate-modal" role="dialog" aria-modal="true"><div className="pp-modal-head"><div><small>VENDOR MASTER LINK</small><h2>{editingRateId?"Edit vendor rate":"Add vendor rate"}</h2><p>{selectedType?selectedCategory?.name+" · "+selectedType.name:"Choose a process below."}</p></div><button onClick={()=>setShowRate(false)}><X size={16}/></button></div><div className="pp-modal-form"><label className="pp-modal-wide">Process category<select value={categories.find(cat=>cat.id===selectedType?.categoryId)?.id||""} onChange={event=>{const first=processTypes.find(type=>type.categoryId===event.target.value);setRateTypeId(first?.id||"");setRateVendorId("");}}><option value="">Select category…</option>{categories.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="pp-modal-wide">Process<select value={rateTypeId} onChange={event=>{setRateTypeId(event.target.value);setRateVendorId("");}}><option value="">Select process…</option>{processTypes.filter(item=>!categories.find(cat=>cat.id===item.categoryId)?.deletedAt).filter(item=>!selectedType||item.categoryId===selectedType.categoryId||editingRateId).map(item=><option key={item.id} value={item.id}>{categories.find(cat=>cat.id===item.categoryId)?.name||"Category"} · {item.name}</option>)}</select></label><SearchablePicker id="process-directory-vendor-picker" label="Vendor name *" value={rateVendorId} placeholder="Search vendor company…" options={vendors.filter(vendor=>vendorSupportsProcessType(vendor,rateTypeId)||rateVendorId===vendor.id).map(vendor=>({id:vendor.id,label:vendor.company}))} onChange={setRateVendorId}/>{rateTypeId&&!vendors.some(vendor=>vendorSupportsProcessType(vendor,rateTypeId))&&<small className="field-hint">No vendor is assigned to this process. Add a vendor name below or assign capabilities in Vendor Master.</small>}<label>Rate per piece (₹) *<input type="number" min="0" step="0.01" value={rateAmount} onChange={event=>setRateAmount(event.target.value)} placeholder="0.00"/></label><label className="pp-modal-wide">Description (optional)<input value={rateNotes} onChange={event=>setRateNotes(event.target.value)} placeholder="Optional process / price note"/></label><button type="button" className="button-quiet compact-button" disabled={!rateTypeId} onClick={()=>{const processName=processTypes.find(item=>item.id===rateTypeId)?.name||"";setVendorDraft(blankVendor(rateTypeId,processName));setShowVendorForm(true);}}>+ Add vendor name</button></div><div className="pp-modal-actions"><button className="button-primary" onClick={saveRate}><Check size={14}/> Save vendor and price</button><button onClick={()=>setShowRate(false)}>Cancel</button></div></section></div>}
    {showVendorForm&&<div className="pp-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setShowVendorForm(false);}}><section className="pp-process-modal process-directory-vendor-modal" role="dialog" aria-modal="true"><div className="pp-modal-head"><div><small>VENDOR MASTER</small><h2>Add vendor name</h2><p>Additional contact details can be completed later in Vendor Master.</p></div><button onClick={()=>setShowVendorForm(false)}><X size={16}/></button></div><div className="pp-modal-form"><label className="pp-modal-wide">Vendor company name *<input value={vendorDraft.company} onChange={event=>setVendorDraft({...vendorDraft,company:event.target.value})}/></label><label className="pp-modal-wide">Phone / WhatsApp (optional)<input value={vendorDraft.phone} onChange={event=>setVendorDraft({...vendorDraft,phone:event.target.value})}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={saveNewVendor}><Check size={14}/> Save vendor</button><button onClick={()=>setShowVendorForm(false)}>Cancel</button></div></section></div>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Process Directory is the single process catalogue and capability/rate source. Vendor names reuse stable Vendor Master IDs; editing or deleting a directory item never erases historical operation records.</span></div>
  </section>;
}
