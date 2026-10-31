import { useMemo, useState } from "react";
import { ArrowRight, Check, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ProcessCategoryRecord, type ProcessTypeRecord, type ProcessVendorRateRecord, type VendorRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
type Props = { onBack: () => void; onNotice: (value: string) => void; onSelectModule: (id: string) => void };
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const blankVendor = () => ({ company:"", contact:"", role:"", phone:"", whatsappNumber:"", email:"", address:"", processes:"", machines:"", materials:"", notes:"", status:"Unverified contact — review", sourceContactId:"", whatsappSyncedAt:"" });

export default function ProcessDirectoryWorkspace({ onBack, onNotice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const categories = activeRows(data.processCategories);
  const processTypes = activeRows(data.processTypes);
  const vendors = activeRows(data.vendors);
  const rates = activeRows(data.processVendorRates);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [showCategory, setShowCategory] = useState(false);
  const [showType, setShowType] = useState(false);
  const [showRate, setShowRate] = useState(false);
  const [rateTypeId, setRateTypeId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [quotedAt, setQuotedAt] = useState(new Date().toISOString().slice(0,10));
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [rate, setRate] = useState("");
  const [leadDays, setLeadDays] = useState("0");
  const [notes, setNotes] = useState("");
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorDraft, setVendorDraft] = useState(blankVendor);
  const selectedCategory = categories.find(item => item.id === categoryId);
  const visibleCategories = useMemo(() => categories.filter(item => (item.name+" "+item.code+" "+item.description).toLowerCase().includes(search.toLowerCase().trim())), [categories,search]);
  const filteredTypes = processTypes.filter(item => (!categoryId || item.categoryId === categoryId) && (item.name+" "+item.code+" "+item.description).toLowerCase().includes(search.toLowerCase().trim()));
  const selectedType = processTypes.find(item => item.id === rateTypeId);
  const matchingRates = rates.filter(item => item.processTypeId === selectedType?.id);

  const addCategory = () => {
    const name = categoryName.trim();
    if (!name) { onNotice("Enter a process category name."); return; }
    if (categories.some(item => item.name.toLowerCase() === name.toLowerCase())) { onNotice("That process category already exists."); return; }
    const stamp=nowIso();
    const row:ProcessCategoryRecord={id:makeId("process-category"),name,code:"",description:categoryDescription.trim(),sortOrder:categories.length+1,createdAt:stamp,updatedAt:stamp};
    update(current=>({...current,processCategories:[...current.processCategories,row]}));
    setCategoryName("");setCategoryDescription("");setShowCategory(false);setCategoryId(row.id);onNotice("Process category saved.");
  };
  const addType = () => {
    const name=typeName.trim();
    if(!categoryId||!name){onNotice("Select a category and enter a process type.");return;}
    if(processTypes.some(item=>item.categoryId===categoryId&&item.name.toLowerCase()===name.toLowerCase())){onNotice("That process type already exists in this category.");return;}
    const stamp=nowIso();
    const row:ProcessTypeRecord={id:makeId("process-type"),categoryId,name,code:"",description:typeDescription.trim(),createdAt:stamp,updatedAt:stamp};
    update(current=>({...current,processTypes:[...current.processTypes,row]}));
    setTypeName("");setTypeDescription("");setShowType(false);onNotice("Process type saved.");
  };
  const saveRate = () => {
    if(!rateTypeId||!vendorId||rate.trim()===""||!Number.isFinite(Number(rate))||Number(rate)<0){onNotice("Select a process type and Vendor Master vendor, then enter a valid rate.");return;}
    if(validFrom&&validUntil&&validUntil<validFrom){onNotice("Quotation validity end cannot be before its start.");return;}
    if(!vendors.some(item=>item.id===vendorId)){onNotice("Select an active vendor from Vendor Master.");return;}
    const stamp=nowIso();
    const row:ProcessVendorRateRecord={id:makeId("process-vendor-rate"),processTypeId:rateTypeId,vendorId,quoteReference:quoteReference.trim(),quotedAt,validFrom,validUntil,ratePerPart:Number(rate),currency:"INR",leadDays:Math.max(0,Number(leadDays)||0),notes:notes.trim(),status:"Received",createdAt:stamp,updatedAt:stamp};
    update(current=>({...current,processVendorRates:[...current.processVendorRates,row]}));
    setShowRate(false);setVendorId("");setQuoteReference("");setRate("");setValidFrom("");setValidUntil("");setLeadDays("0");setNotes("");onNotice("Vendor process quotation saved with its own validity and rate history.");
  };
  const saveNewVendor = () => {
    const company=vendorDraft.company.trim(), contact=vendorDraft.contact.trim();
    if(!company||!contact){onNotice("Vendor company and contact person are required.");return;}
    const phone=String(vendorDraft.phone||"").replace(/\D/g,"");
    const duplicate=vendors.find(item=>phone&&String(item.phone||"").replace(/\D/g,"")===phone);
    if(duplicate){onNotice("This phone number already belongs to "+duplicate.company+". Select that Vendor Master record instead.");setVendorId(duplicate.id);setShowVendorForm(false);return;}
    const stamp=nowIso(),id=makeId("vendor");
    const record:VendorRecord={...vendorDraft,company,contact,phone,whatsappNumber:String(vendorDraft.whatsappNumber||"").replace(/\D/g,""),id,createdAt:stamp,updatedAt:stamp};
    update(current=>({...current,vendors:[...current.vendors,record]}));
    setVendorId(id);setVendorDraft(blankVendor());setShowVendorForm(false);
    onNotice("New vendor saved to Vendor Master. Its saved vendor ID is selected in this quotation.");
  };
  const archiveCategory = (item:ProcessCategoryRecord) => {
    if(processTypes.some(type=>type.categoryId===item.id)){onNotice("This category still has process types. Archive or move them first.");return;}
    const stamp=nowIso();update(current=>({...current,processCategories:current.processCategories.map(row=>row.id===item.id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
    if(categoryId===item.id)setCategoryId("");onNotice("Category archived; history is retained.");
  };
  const archiveType = (item:ProcessTypeRecord) => {
    if(data.operations.some(operation=>operation.processTypeId===item.id&&!operation.deletedAt)){onNotice("This process type is used by saved operations and cannot be archived until routes are reassigned.");return;}
    const stamp=nowIso();
    update(current=>({...current,processTypes:current.processTypes.map(row=>row.id===item.id?{...row,deletedAt:stamp,updatedAt:stamp}:row),processVendorRates:current.processVendorRates.map(row=>row.processTypeId===item.id&&!row.deletedAt?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
    onNotice("Process type archived; quotation history is retained.");
  };

  return <section className="workspace-page process-directory-page">
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill "+(syncStatus==="synced"?"scheduler-connected":"")}><i/>{syncStatus==="synced"?"SHARED DATA CONNECTED":syncStatus==="syncing"?"SYNCING":syncStatus==="error"?"SYNC ERROR · LOCAL COPY KEPT":"LOCAL DATA"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER DATA / OPERATIONS</div><h1>Process Directory<span>.</span></h1><p>Reusable process categories, process types, vendor quotations, validity and rate history.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={()=>onSelectModule("vendors")}>Vendor Master</button><button className="button-primary" onClick={()=>setShowCategory(true)}><Plus size={15}/> Add Category</button></div></div>
    <div className="process-directory-toolbar"><label className="module-record-search"><Search size={15}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search categories and process types…"/></label><button className="button-quiet" onClick={()=>{setRateTypeId("");setShowRate(true);}}>Add Vendor Quotation</button></div>
    <div className="process-directory-layout">
      <aside className="surface-panel process-directory-categories"><div className="panel-heading"><div><div className="eyebrow">PROCESS CATEGORIES</div><h3>Catalogue</h3><p>{categories.length} saved categories</p></div></div>{visibleCategories.map(item=><div className={"process-directory-category "+(categoryId===item.id?"active":"")} key={item.id}><button onClick={()=>setCategoryId(item.id)}><strong>{item.name}</strong><small>{processTypes.filter(type=>type.categoryId===item.id).length} process types</small></button><button aria-label={"Archive "+item.name} onClick={()=>archiveCategory(item)}><Trash2 size={13}/></button></div>)}{!categories.length&&<p className="process-directory-empty">No process categories saved yet. Add your manufacturing process categories.</p>}</aside>
      <section className="surface-panel process-directory-types"><div className="panel-heading"><div><div className="eyebrow">PROCESS TYPES / SUBCATEGORIES</div><h3>{selectedCategory?.name||"All process types"}</h3><p>{filteredTypes.length} saved process types · existing routes preserved</p></div><button className="button-primary compact-button" disabled={!categoryId} onClick={()=>setShowType(true)}><Plus size={13}/> Add Process Type</button></div>{filteredTypes.map(item=><article className="process-directory-type" key={item.id}><div><strong>{item.name}</strong><small>{categories.find(category=>category.id===item.categoryId)?.name||"Category unavailable"}</small><p>{item.description||"No description entered."}</p></div><div className="process-directory-type-actions"><span>{rates.filter(rateItem=>rateItem.processTypeId===item.id).length} vendor rates</span><button className="button-quiet compact-button" onClick={()=>{setRateTypeId(item.id);setShowRate(true);}}><Plus size={12}/> Add Rate</button><button className="button-quiet compact-button" onClick={()=>archiveType(item)}>Archive</button></div></article>)}{!filteredTypes.length&&<div className="process-directory-empty">{categoryId?"No process types under this category yet.":"Select a category or add your first category."}</div>}</section>
    </div>
    <section className="surface-panel process-directory-rate-history"><div className="panel-heading"><div><div className="eyebrow">VENDOR RATE HISTORY</div><h3>Quotations & comparisons</h3><p>Reusable process quotations stay separate from PO-operation quotations.</p></div></div><div className="process-directory-rate-filter"><label>Process type<select value={rateTypeId} onChange={event=>setRateTypeId(event.target.value)}><option value="">Select process type…</option>{processTypes.map(item=><option key={item.id} value={item.id}>{categories.find(category=>category.id===item.categoryId)?.name||"Category"} · {item.name}</option>)}</select></label><button className="button-primary compact-button" disabled={!rateTypeId} onClick={()=>setShowRate(true)}><Plus size={13}/> Add quotation</button></div>{matchingRates.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Vendor</th><th>Quote ref</th><th>Quoted</th><th>Valid from</th><th>Valid until</th><th>Rate / part</th><th>Lead days</th><th>Status</th></tr></thead><tbody>{matchingRates.map(item=><tr key={item.id}><td>{vendors.find(vendor=>vendor.id===item.vendorId)?.company||"Vendor archived"}</td><td>{item.quoteReference||"—"}</td><td>{item.quotedAt||"—"}</td><td>{item.validFrom||"—"}</td><td>{item.validUntil||"—"}</td><td>{money(item.ratePerPart)}</td><td>{item.leadDays}</td><td>{item.status}</td></tr>)}</tbody></table></div>:<p className="process-directory-empty">No vendor quotations saved for this process type yet.</p>}</section>
    {showCategory&&<div className="pp-modal-backdrop"><section className="pp-process-modal"><div className="pp-modal-head"><div><small>PROCESS DIRECTORY</small><h2>Add main process category</h2></div><button onClick={()=>setShowCategory(false)}><X size={16}/></button></div><div className="pp-modal-form"><label>Category name *<input value={categoryName} onChange={event=>setCategoryName(event.target.value)}/></label><label>Description<input value={categoryDescription} onChange={event=>setCategoryDescription(event.target.value)}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={addCategory}><Check size={14}/> Save category</button><button onClick={()=>setShowCategory(false)}>Cancel</button></div></section></div>}
    {showType&&<div className="pp-modal-backdrop"><section className="pp-process-modal"><div className="pp-modal-head"><div><small>{selectedCategory?.name}</small><h2>Add process type</h2></div><button onClick={()=>setShowType(false)}><X size={16}/></button></div><div className="pp-modal-form"><label>Process type name *<input value={typeName} onChange={event=>setTypeName(event.target.value)}/></label><label>Description<input value={typeDescription} onChange={event=>setTypeDescription(event.target.value)}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={addType}><Check size={14}/> Save type</button><button onClick={()=>setShowType(false)}>Cancel</button></div></section></div>}
    {showRate&&<div className="pp-modal-backdrop"><section className="pp-process-modal"><div className="pp-modal-head"><div><small>VENDOR MASTER LINK</small><h2>Add vendor quotation</h2><p>Selection reuses the existing Vendor Master ID.</p></div><button onClick={()=>setShowRate(false)}><X size={16}/></button></div><div className="pp-modal-form"><label>Process type *<select value={rateTypeId} onChange={event=>setRateTypeId(event.target.value)}><option value="">Select process type…</option>{processTypes.map(item=><option key={item.id} value={item.id}>{categories.find(category=>category.id===item.categoryId)?.name||"Category"} · {item.name}</option>)}</select></label><SearchablePicker id="process-directory-vendor" label="Vendor Master *" value={vendorId} placeholder="Search existing vendors…" options={vendors.map(item=>({id:item.id,label:item.company+" · "+(item.phone||item.email||"No contact")}))} onChange={setVendorId}/><button type="button" className="button-quiet compact-button" onClick={()=>{setVendorDraft(blankVendor());setShowVendorForm(true);}}>Add New Vendor</button><label>Quotation reference<input value={quoteReference} onChange={event=>setQuoteReference(event.target.value)}/></label><label>Quoted date<input type="date" value={quotedAt} onChange={event=>setQuotedAt(event.target.value)}/></label><label>Valid from<input type="date" value={validFrom} onChange={event=>setValidFrom(event.target.value)}/></label><label>Valid until<input type="date" value={validUntil} onChange={event=>setValidUntil(event.target.value)}/></label><label>Rate per part (₹) *<input type="number" min="0" step="0.01" value={rate} onChange={event=>setRate(event.target.value)}/></label><label>Lead time (days)<input type="number" min="0" value={leadDays} onChange={event=>setLeadDays(event.target.value)}/></label><label className="pp-modal-wide">Notes<input value={notes} onChange={event=>setNotes(event.target.value)}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={saveRate}><Check size={14}/> Save quotation</button><button onClick={()=>setShowRate(false)}>Cancel</button></div></section></div>}
    {showVendorForm&&<div className="pp-modal-backdrop"><section className="pp-process-modal"><div className="pp-modal-head"><div><small>VENDOR MASTER</small><h2>Add New Vendor</h2><p>Creates a master record and returns to this quotation.</p></div><button onClick={()=>setShowVendorForm(false)}><X size={16}/></button></div><div className="pp-modal-form"><label>Vendor company *<input value={vendorDraft.company} onChange={e=>setVendorDraft({...vendorDraft,company:e.target.value})}/></label><label>Contact person *<input value={vendorDraft.contact} onChange={e=>setVendorDraft({...vendorDraft,contact:e.target.value})}/></label><label>Phone<input value={vendorDraft.phone} onChange={e=>setVendorDraft({...vendorDraft,phone:e.target.value})}/></label><label>Email<input type="email" value={vendorDraft.email} onChange={e=>setVendorDraft({...vendorDraft,email:e.target.value})}/></label><label className="pp-modal-wide">Address<input value={vendorDraft.address} onChange={e=>setVendorDraft({...vendorDraft,address:e.target.value})}/></label></div><div className="pp-modal-actions"><button className="button-primary" onClick={saveNewVendor}><Check size={14}/> Save to Vendor Master</button><button onClick={()=>setShowVendorForm(false)}>Cancel</button></div></section></div>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Process Directory is the reusable catalogue and vendor-rate source. Actual vendor assignment belongs in Process Map; material supplier rates are not duplicated here.</span></div>
  </section>;
}