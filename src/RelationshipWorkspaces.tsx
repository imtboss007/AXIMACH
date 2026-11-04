import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, CalendarClock, Mail, MessageCircle, Phone, Plus, Search, ShieldCheck, Trash2, Users, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ContactProfileRecord } from "./manufacturingData";

type Props={onBack:()=>void;onNotice:(value:string)=>void;notice:string;onSelectModule:(id:string)=>void};
type Contact360Props=Props & {initialVendorId?:string;onInitialVendorConsumed?:()=>void};
type ContactRecord=ContactProfileRecord;
type ContactDraft=Omit<ContactRecord,"id"|"createdAt"|"updatedAt">;
const CONTACT_KEY="aximach.contact360.v1";
const blank=():ContactDraft=>({linkedType:"company",linkedId:"",name:"",role:"",group:"",phone:"",whatsapp:"",additionalPhones:[],email:"",address:"",followUpDate:"",history:""});
function readContacts():ContactRecord[]{try{const value=JSON.parse(localStorage.getItem(CONTACT_KEY)||"[]");return Array.isArray(value)?value as ContactRecord[]:[];}catch{return[];}}

export function Contact360Workspace({onBack,onNotice,notice,onSelectModule,initialVendorId,onInitialVendorConsumed}:Contact360Props){
 const {data,update}=useManufacturingData();const companies=activeRows(data.companies),vendors=activeRows(data.vendors);
 const rows=data.contactProfiles||[];const [search,setSearch]=useState("");const [editingId,setEditingId]=useState("");const [showForm,setShowForm]=useState(false);const [draft,setDraft]=useState<ContactDraft>(blank());
 const [typeFilter,setTypeFilter]=useState("All");
 const [roleFilters,setRoleFilters]=useState<string[]>([]);
 const [vendorTypeFilters,setVendorTypeFilters]=useState<string[]>([]);
 const [processFilters,setProcessFilters]=useState<string[]>([]);
 const [machineFilters,setMachineFilters]=useState<string[]>([]);
 const [materialFilters,setMaterialFilters]=useState<string[]>([]);
 useEffect(()=>{const legacy=readContacts();if(!legacy.length)return;update(current=>{const byId=new Map(current.contactProfiles.map(row=>[row.id,row]));let changed=false;for(const row of legacy){const old=byId.get(row.id);if(!old||(Date.parse(row.updatedAt||"")||0)>(Date.parse(old.updatedAt||"")||0)){byId.set(row.id,{...row,group:row.group||""});changed=true;}}return changed?{...current,contactProfiles:[...byId.values()]}:current;});},[update]);
 useEffect(()=>{if(!initialVendorId)return;setEditingId("");setDraft({...blank(),linkedType:"vendor",linkedId:initialVendorId});setShowForm(true);onInitialVendorConsumed?.();},[initialVendorId]);
 const relatedLabel=(row:ContactRecord)=>row.linkedType==="company"?companies.find(x=>x.id===row.linkedId)?.name||"Company record missing":vendors.find(x=>x.id===row.linkedId)?.company||"Vendor record missing";
 const generated=[
  ...companies.filter(c=>c.contactPerson?.trim()).map(c=>({id:"company:"+c.id,name:c.contactPerson||"",role:"Company contact",group:"",phone:c.phone,whatsapp:c.phone,additionalPhones:[],email:c.email,address:c.address||"",followUpDate:"",history:"",relationship:c.name,source:"Company Directory",linkedType:"company",vendorType:"Company",processes:"",machines:"",materials:""})),
  ...vendors.map(v=>({id:"vendor:"+v.id,name:v.contact,role:v.role,group:"",phone:v.phone,whatsapp:v.whatsappNumber||v.phone,additionalPhones:v.additionalPhones||[],email:v.email,address:v.address,followUpDate:"",history:"",relationship:v.company,source:"Vendor Directory",linkedType:"vendor",vendorType:v.vendorType||"",processes:v.processes||"",machines:v.machines||"",materials:v.materials||""}))
 ];
 const manual=activeRows(rows);
 const contactRows=[
  ...generated.map(row=>({...row,kind:"master" as const})),
  ...manual.map(row=>{const vendor=row.linkedType==="vendor"?vendors.find(v=>v.id===row.linkedId):undefined;return {...row,kind:"manual" as const,relationship:row.linkedType==="company"?companies.find(c=>c.id===row.linkedId)?.name||"Company":vendor?.company||"Vendor",source:"Contact 360",vendorType:vendor?.vendorType||"",processes:vendor?.processes||"",machines:vendor?.machines||"",materials:vendor?.materials||""};})
 ];
 const roleOptions=[...new Set(contactRows.map(row=>row.role).filter(Boolean))].sort();
 const vendorTypeOptions=[...new Set(vendors.map(v=>v.vendorType||"").filter(Boolean))].sort();
 const processOptions=[...new Set(vendors.flatMap(v=>v.processes.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)))].sort();
 const machineOptions=[...new Set(vendors.flatMap(v=>v.machines.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)))].sort();
 const materialOptions=[...new Set(vendors.flatMap(v=>v.materials.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)))].sort();
 const toggleMulti=(setter:React.Dispatch<React.SetStateAction<string[]>>,value:string)=>setter(current=>current.includes(value)?current.filter(x=>x!==value):[...current,value]);
 const filtered=useMemo(()=>contactRows.filter(row=>{
  const text=(row.name+" "+row.role+" "+(row.group||"")+" "+row.phone+" "+(row.additionalPhones||[]).join(" ")+" "+row.whatsapp+" "+row.email+" "+row.address+" "+row.relationship+" "+row.source+" "+row.vendorType+" "+row.processes+" "+row.machines+" "+row.materials).toLowerCase();
  const containsAny=(values:string[],source:string)=>!values.length||values.some(value=>source.toLowerCase().split(/[,;|]/).map(x=>x.trim()).includes(value.toLowerCase()));
  return text.includes(search.toLowerCase().trim())
   &&(typeFilter==="All"||row.linkedType===typeFilter.toLowerCase())
   &&(!roleFilters.length||roleFilters.includes(row.role))
   &&(!vendorTypeFilters.length||vendorTypeFilters.includes(row.vendorType))
   &&containsAny(processFilters,row.processes)
   &&containsAny(machineFilters,row.machines)
   &&containsAny(materialFilters,row.materials);
 }),[contactRows,search,typeFilter,roleFilters,vendorTypeFilters,processFilters,machineFilters,materialFilters]);
 const beginNew=()=>{setEditingId("");setDraft(blank());setShowForm(true);};
 const edit=(row:ContactRecord)=>{setEditingId(row.id);setDraft({linkedType:row.linkedType,linkedId:row.linkedId,name:row.name,role:row.role,group:row.group||"",phone:row.phone,whatsapp:row.whatsapp,additionalPhones:row.additionalPhones||[],email:row.email,address:row.address,followUpDate:row.followUpDate,history:row.history});setShowForm(true);};
 const save=()=>{if(!draft.name.trim()||!draft.linkedId){onNotice("Enter the contact name and link it to a company or vendor.");return;}const stamp=nowIso();const old=rows.find(x=>x.id===editingId);const row:ContactRecord={...draft,id:editingId||makeId("contact"),createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined};update(current=>({...current,contactProfiles:[row,...current.contactProfiles.filter(x=>x.id!==row.id)]}));setShowForm(false);setEditingId("");setDraft(blank());onNotice("Contact profile saved to shared AXIMACH contact data with its company/vendor relationship and follow-up history.");};
 const remove=(id:string)=>{if(!window.confirm("Delete this Contact 360 profile? The linked company or vendor master will not be deleted."))return;const stamp=nowIso();update(current=>({...current,contactProfiles:current.contactProfiles.map(row=>row.id===id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));onNotice("Contact profile archived. Linked company/vendor master and historical record were retained.");};
 const options=draft.linkedType==="company"?companies.map(c=>({id:c.id,label:c.name})):vendors.map(v=>({id:v.id,label:v.company+" · "+v.contact}));
 return <section className="workspace-page relationship-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> CONTACT GRAPH</span></div>
  {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> RELATIONSHIPS / CONTACT MASTER</div><h1>Contact 360<span>.</span></h1><p>Unified contact profiles across company and vendor masters, with communication history and follow-up dates.</p></div><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add contact</button></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contact name, company, phone, role, machine or capability…"/></label><label>Relationship<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="All">All contacts</option><option value="vendor">Vendor contacts</option><option value="company">Company contacts</option></select></label><span className="module-number">{filtered.length} CONTACT PROFILES</span><button className="button-quiet compact-button" onClick={()=>{setSearch("");setTypeFilter("All");setRoleFilters([]);setVendorTypeFilters([]);setProcessFilters([]);setMachineFilters([]);setMaterialFilters([]);}}>Clear filters</button></div>
  <section className="surface-panel contact360-filter-panel"><div className="panel-heading"><div><h3>Contact capability filters</h3><p>Select multiple values in each category. All selections can be cleared together.</p></div><button className="button-quiet compact-button" onClick={()=>{setRoleFilters(roleOptions);setVendorTypeFilters(vendorTypeOptions);setProcessFilters(processOptions);setMachineFilters(machineOptions);setMaterialFilters(materialOptions);}}>Select all</button></div>
    <div className="contact360-filter-grid">
      <div><strong>Role / designation</strong>{roleOptions.map(x=><label key={x}><input type="checkbox" checked={roleFilters.includes(x)} onChange={()=>toggleMulti(setRoleFilters,x)}/>{x}</label>)}</div>
      <div><strong>Type of vendor</strong>{vendorTypeOptions.map(x=><label key={x}><input type="checkbox" checked={vendorTypeFilters.includes(x)} onChange={()=>toggleMulti(setVendorTypeFilters,x)}/>{x}</label>)}</div>
      <div><strong>Process capabilities</strong>{processOptions.map(x=><label key={x}><input type="checkbox" checked={processFilters.includes(x)} onChange={()=>toggleMulti(setProcessFilters,x)}/>{x}</label>)}</div>
      <div><strong>Machine capabilities</strong>{machineOptions.map(x=><label key={x}><input type="checkbox" checked={machineFilters.includes(x)} onChange={()=>toggleMulti(setMachineFilters,x)}/>{x}</label>)}</div>
      <div><strong>Material capabilities</strong>{materialOptions.map(x=><label key={x}><input type="checkbox" checked={materialFilters.includes(x)} onChange={()=>toggleMulti(setMaterialFilters,x)}/>{x}</label>)}</div>
    </div>
  </section>
  {showForm&&<section className="surface-panel"><div className="panel-heading"><div><h3>{editingId?"Edit contact profile":"Add contact profile"}</h3><p>Every profile must be linked to an existing company or vendor.</p></div></div>
   <div className="module-record-form specialized-form">
    <label>Relationship type<select value={draft.linkedType} onChange={e=>setDraft({...draft,linkedType:e.target.value as "company"|"vendor",linkedId:""})}><option value="company">Company</option><option value="vendor">Vendor</option></select></label>
    <label>Linked company / vendor *<select value={draft.linkedId} onChange={e=>setDraft({...draft,linkedId:e.target.value})}><option value="">Select related record</option>{options.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <label>Contact person *<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Full name"/></label>
    <label>Role / designation<input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Purchase, production, accounts…"/></label>
    <label>Contact group<input value={draft.group||""} onChange={e=>setDraft({...draft,group:e.target.value})} placeholder="Purchase, production, accounts, management…"/></label>
    <label>Phone<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="Phone with country code"/></label>
    <label>WhatsApp<input value={draft.whatsapp} onChange={e=>setDraft({...draft,whatsapp:e.target.value})} placeholder="WhatsApp number"/></label>
    <label>Additional phone numbers<input value={(draft.additionalPhones||[]).join(", ")} onChange={e=>setDraft({...draft,additionalPhones:e.target.value.split(/[,;|]/).map(value=>value.trim()).filter(Boolean)})} placeholder="Alternate mobile / office numbers, comma-separated"/></label>
    <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
    <label>Next follow-up date<input type="date" value={draft.followUpDate} onChange={e=>setDraft({...draft,followUpDate:e.target.value})}/></label>
    <label className="module-form-wide">Address<input value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} placeholder="Contact address"/></label>
    <label className="module-form-wide">Communication / follow-up history<textarea rows={3} value={draft.history} onChange={e=>setDraft({...draft,history:e.target.value})} placeholder="Record calls, meetings, messages and outcomes"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/> Save contact</button><button className="button-quiet" onClick={()=>setShowForm(false)}>Cancel</button></div>
   </div>
  </section>}
  <section className="surface-panel"><div className="panel-heading"><div><h3>Connected contacts</h3><p>Company/vendor contacts are read from their master records; additional profiles are stored in Contact 360.</p></div></div>
   {filtered.length?<div className="specialized-record-list">{filtered.map(row=><article className="specialized-record contact360-row" key={row.id}><span className="specialized-record-icon"><Users size={18}/></span><div className="specialized-record-copy"><strong>{row.name}</strong><span>{row.relationship} · {row.role||row.source}{row.group?" · "+row.group:""}</span><small><Phone size={12}/> {row.phone||"No phone"} · <Mail size={12}/> {row.email||"No email"}</small>{(row.additionalPhones||[]).length>0&&<small>Other numbers: {(row.additionalPhones||[]).join(" · ")}</small>}<small>{row.address||"Address not recorded"} · {row.source}</small>{row.linkedType==="vendor"&&<small>Vendor type: {row.vendorType||"Not set"} · Process: {row.processes||"Not set"} · Machines: {row.machines||"Not set"} · Materials: {row.materials||"Not set"}</small>}{row.followUpDate&&<small><CalendarClock size={12}/> Follow-up: {row.followUpDate}</small>}{row.history&&<p>{row.history}</p>}</div><div className="relationship-actions">{row.kind==="manual"?<><button className="button-quiet compact-button" onClick={()=>edit(rows.find(x=>x.id===row.id)!)}>Edit</button><button className="button-quiet compact-button" onClick={()=>remove(row.id)}><Trash2 size={13}/> Delete</button></>:<button className="button-quiet compact-button" onClick={()=>onSelectModule(row.source==="Company Directory"?"companies":"vendors")}>Open master <ArrowUpRight size={13}/></button>}</div></article>)}</div>:<div className="module-empty-state"><Users size={24}/><h3>No contacts match</h3><p>Add an individual contact or change your search.</p></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Deleting a Contact 360 profile does not delete the underlying company or vendor. Company and vendor master contacts remain visible here.</span></div>
 </section>;
}

export function VendorNetworkWorkspace({onBack,onSelectModule}:Props){
 const {data}=useManufacturingData();
 const vendors=activeRows(data.vendors);
 const operations=activeRows(data.operations);
 const definitions=activeRows(data.processDefinitions);
 const contacts=activeRows(data.contactProfiles||[]);
 const [search,setSearch]=useState("");
 const [vendorTypes,setVendorTypes]=useState<string[]>([]);
 const [categories,setCategories]=useState<string[]>([]);
 const [processTypes,setProcessTypes]=useState<string[]>([]);
 const [subcategories,setSubcategories]=useState<string[]>([]);
 const [executionTypes,setExecutionTypes]=useState<string[]>([]);
 const [onlyAssigned,setOnlyAssigned]=useState(false);
 const vendorTypeOptions=[...new Set(vendors.map(v=>v.vendorType||"").filter(Boolean))].sort();
 const categoryOptions=[...new Set(definitions.map(p=>p.category).filter(Boolean))].sort();
 const processOptions=[...new Set(definitions.map(p=>p.processType).filter(Boolean))].sort();
 const selectedDefinitions=definitions.filter(p=>(!categories.length||categories.includes(p.category))&&(!processTypes.length||processTypes.includes(p.processType)));
 const subcategoryOptions=[...new Set(selectedDefinitions.flatMap(p=>p.subcategories||[]))].sort();
 const matchesAny=(selected:string[],source:string)=>!selected.length||selected.some(value=>source.toLowerCase().split(/[,;|]/).map(x=>x.trim()).includes(value.toLowerCase()));
 const toggle=(setter:(next:string[]|((old:string[])=>string[]))=>void,value:string)=>setter(old=>old.includes(value)?old.filter(x=>x!==value):[...old,value]);
 const clearFilters=()=>{setSearch("");setVendorTypes([]);setCategories([]);setProcessTypes([]);setSubcategories([]);setExecutionTypes([]);setOnlyAssigned(false);};
 const rows=vendors.map(v=>{
  const assigned=operations.filter(op=>op.vendorId===v.id||op.transportVendorId===v.id);
  const contactRows=contacts.filter(c=>c.linkedType==="vendor"&&c.linkedId===v.id);
  const capabilityDefinitions=definitions.filter(definition=>(definition.vendorIds||[]).includes(v.id));
  const assignedProcesses=[...new Set(assigned.filter(op=>op.vendorId===v.id).map(op=>op.name))];
  const assignedPOs=[...new Set(assigned.map(op=>op.poId).filter(Boolean))];
  return {vendor:v,assigned,contactRows,capabilityDefinitions,assignedProcesses,assignedPOs};
 });
 const filtered=rows.filter(({vendor:v,assigned,capabilityDefinitions})=>{
  const linkedContacts=contacts.filter(c=>c.linkedType==="vendor"&&c.linkedId===v.id).map(c=>[c.name,c.role,c.phone,c.whatsapp,c.email,c.group].join(" ")).join(" ");
  const capabilityText=capabilityDefinitions.map(definition=>[definition.processType,definition.category,...(definition.subcategories||[])].join(" ")).join(" ");
  const fullText=(v.company+" "+v.contact+" "+v.role+" "+v.phone+" "+v.email+" "+v.vendorType+" "+v.processes+" "+capabilityText+" "+v.machines+" "+v.materials+" "+v.notes+" "+linkedContacts+" "+assigned.map(op=>op.name+" "+op.category+" "+op.subcategory+" "+op.status).join(" ")).toLowerCase();
  const operationCategory=assigned.map(op=>op.category).join(" ");
  const operationTypes=assigned.map(op=>op.name).join(" ");
  const operationSubcategories=assigned.map(op=>op.subcategory||"").join(" ");
  const capabilityCategories=capabilityDefinitions.map(definition=>definition.category).join(" ");
  const capabilityTypes=capabilityDefinitions.map(definition=>definition.processType).join(" ");
  const capabilitySubcategories=capabilityDefinitions.flatMap(definition=>definition.subcategories||[]).join(" ");
  const execution=assigned.map(op=>op.executionType||"Outsourced").join(" ");
  return fullText.includes(search.toLowerCase().trim())
   &&(!vendorTypes.length||vendorTypes.includes(v.vendorType||""))
   &&matchesAny(categories,capabilityCategories+" "+operationCategory)
   &&matchesAny(processTypes,capabilityTypes+" "+v.processes+" "+operationTypes)
   &&matchesAny(subcategories,capabilitySubcategories+" "+operationSubcategories)
   &&matchesAny(executionTypes,execution)
   &&(!onlyAssigned||assigned.length>0);
 });
 return <section className="workspace-page relationship-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> VENDOR CAPABILITY NETWORK</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / LIVE ASSIGNMENTS</div><h1>Vendor Network<span>.</span></h1><p>Filter process capabilities from Process Directory and see the actual operations assigned to each vendor in Process Plan / Production Plan.</p></div><button className="button-quiet" onClick={()=>onSelectModule("vendors")}><Users size={14}/> Manage vendors</button></div>
  <div className="module-action-bar relationship-filters"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor company, contact, process, machine, material or assigned PO…"/></label><label><input type="checkbox" checked={onlyAssigned} onChange={e=>setOnlyAssigned(e.target.checked)}/> Assigned vendors only</label><span className="module-number">{filtered.length} VENDORS</span><button className="button-quiet compact-button" onClick={clearFilters}>Clear filters</button></div>
  <section className="surface-panel vendor-network-filter-panel"><div className="panel-heading"><div><h3>Capability filters</h3><p>Select multiple values. Process categories/types are sourced from Process Directory; assignments are read from saved operations.</p></div><button className="button-quiet compact-button" onClick={()=>{setVendorTypes(vendorTypeOptions);setCategories(categoryOptions);setProcessTypes(processOptions);setSubcategories(subcategoryOptions);setExecutionTypes(["Internal","Outsourced"]);}}>Select all</button></div>
   <div className="contact360-filter-grid">
    <div><strong>Vendor type</strong>{vendorTypeOptions.map(x=><label key={x}><input type="checkbox" checked={vendorTypes.includes(x)} onChange={()=>toggle(setVendorTypes,x)}/>{x}</label>)}</div>
    <div><strong>Process category</strong>{categoryOptions.map(x=><label key={x}><input type="checkbox" checked={categories.includes(x)} onChange={()=>toggle(setCategories,x)}/>{x}</label>)}</div>
    <div><strong>Process type</strong>{processOptions.map(x=><label key={x}><input type="checkbox" checked={processTypes.includes(x)} onChange={()=>toggle(setProcessTypes,x)}/>{x}</label>)}</div>
    <div><strong>Subcategory</strong>{subcategoryOptions.map(x=><label key={x}><input type="checkbox" checked={subcategories.includes(x)} onChange={()=>toggle(setSubcategories,x)}/>{x}</label>)}</div>
    <div><strong>Execution</strong>{["Internal","Outsourced"].map(x=><label key={x}><input type="checkbox" checked={executionTypes.includes(x)} onChange={()=>toggle(setExecutionTypes,x)}/>{x}</label>)}</div>
   </div>
  </section>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Vendors and production assignments</h3><p>{filtered.length} of {vendors.length} vendor records · {operations.length} saved operations scanned.</p></div></div>
   {filtered.length?<div className="vendor-record-list">{filtered.map(({vendor:v,assigned,contactRows,assignedProcesses,assignedPOs})=><article className="vendor-record vendor-network-record" key={v.id}>
    <span className="vendor-avatar">{v.company.slice(0,1).toUpperCase()}</span>
    <span className="vendor-record-copy"><strong>{v.company}</strong><small>{v.vendorType||"Vendor type not set"} · {v.contact} · {v.phone||"No phone"}</small>
     <small>{[...new Set([...(v.processes||"").split(/[,;|]/).map(value=>value.trim()).filter(Boolean),...capabilityDefinitions.map(definition=>definition.processType)])].join(", ")||"No process capabilities"} · {v.machines||"Machines not recorded"} · {v.materials||"Materials not recorded"}</small>
     <small>Linked people: {contactRows.map(c=>c.name+(c.phone?" · "+c.phone:"")).join(" | ")||"No additional contacts"}</small>
     <small>Assigned process: {assignedProcesses.join(", ")||"No process operation assigned"}</small>
     <small>{assigned.length} assigned operation(s) · {assignedPOs.length} PO(s)</small>
     {assigned.length>0&&<span className="vendor-assignment-chips">{assigned.slice(0,12).map(op=><em key={op.id}>{op.name} · {op.status} · {op.executionType||"Outsourced"}</em>)}</span>}
    </span><div className="vendor-network-actions"><button className="button-quiet compact-button" onClick={()=>onSelectModule("vendors")}>Open vendor</button><button className="button-quiet compact-button" onClick={()=>onSelectModule("process-map")}>Open Process Plan</button></div>
   </article>)}</div>:<div className="module-empty-state"><Wrench size={24}/><h3>No matching vendors</h3><p>Change the capability filters or add capabilities to Vendor Directory from Process Directory.</p><button className="button-primary" onClick={()=>onSelectModule("vendors")}><Plus size={14}/> Open Vendor Directory</button></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Capability data is sourced from Vendor Directory and Process Directory. Assignment counts and statuses are derived from existing PO-linked Process Plan operations; they are not manually duplicated here.</span></div>
 </section>;
}
