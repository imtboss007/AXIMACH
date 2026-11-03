import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, CalendarClock, Mail, MessageCircle, Phone, Plus, Search, ShieldCheck, Trash2, Users, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData } from "./manufacturingData";

type Props={onBack:()=>void;onNotice:(value:string)=>void;notice:string;onSelectModule:(id:string)=>void};
type ContactRecord={id:string;deletedAt?:string;linkedType:"company"|"vendor";linkedId:string;name:string;role:string;phone:string;whatsapp:string;email:string;address:string;followUpDate:string;history:string;createdAt:string;updatedAt:string};
type ContactDraft=Omit<ContactRecord,"id"|"createdAt"|"updatedAt">;
const CONTACT_KEY="aximach.contact360.v1";
const blank=():ContactDraft=>({linkedType:"company",linkedId:"",name:"",role:"",phone:"",whatsapp:"",email:"",address:"",followUpDate:"",history:""});
function readContacts():ContactRecord[]{try{const value=JSON.parse(localStorage.getItem(CONTACT_KEY)||"[]");return Array.isArray(value)?value as ContactRecord[]:[];}catch{return[];}}

export function Contact360Workspace({onBack,onNotice,notice,onSelectModule}:Props){
 const {data}=useManufacturingData();const companies=activeRows(data.companies),vendors=activeRows(data.vendors);
 const [rows,setRows]=useState<ContactRecord[]>(()=>readContacts());const [search,setSearch]=useState("");const [editingId,setEditingId]=useState("");const [showForm,setShowForm]=useState(false);const [draft,setDraft]=useState<ContactDraft>(blank());
 const relatedLabel=(row:ContactRecord)=>row.linkedType==="company"?companies.find(x=>x.id===row.linkedId)?.name||"Company record missing":vendors.find(x=>x.id===row.linkedId)?.company||"Vendor record missing";
 const generated=[
  ...companies.filter(c=>c.contactPerson?.trim()).map(c=>({id:"company:"+c.id,name:c.contactPerson||"",role:"Company contact",phone:c.phone,email:c.email,address:c.address||"",followUpDate:"",history:"",relationship:c.name,source:"Company Directory"})),
  ...vendors.map(v=>({id:"vendor:"+v.id,name:v.contact,role:v.role,phone:v.phone,email:v.email,address:v.address,followUpDate:"",history:"",relationship:v.company,source:"Vendor Directory"}))
 ];
 const manual=rows.filter(row=>!row.deletedAt);
 const filtered=useMemo(()=>[
  ...generated.map(row=>({...row,kind:"master" as const})),
  ...manual.map(row=>({...row,kind:"manual" as const,relationship:row.linkedType==="company"?companies.find(c=>c.id===row.linkedId)?.name||"Company":vendors.find(v=>v.id===row.linkedId)?.company||"Vendor",source:"Contact 360"}))
 ].filter(row=>(row.name+" "+row.role+" "+row.phone+" "+row.email+" "+row.address+" "+row.relationship+" "+row.source).toLowerCase().includes(search.toLowerCase().trim())),[generated,manual,search,companies,vendors]);
 const beginNew=()=>{setEditingId("");setDraft(blank());setShowForm(true);};
 const edit=(row:ContactRecord)=>{setEditingId(row.id);setDraft({linkedType:row.linkedType,linkedId:row.linkedId,name:row.name,role:row.role,phone:row.phone,whatsapp:row.whatsapp,email:row.email,address:row.address,followUpDate:row.followUpDate,history:row.history});setShowForm(true);};
 const save=()=>{if(!draft.name.trim()||!draft.linkedId){onNotice("Enter the contact name and link it to a company or vendor.");return;}const stamp=nowIso();const old=rows.find(x=>x.id===editingId);const row:ContactRecord={...draft,id:editingId||makeId("contact"),createdAt:old?.createdAt||stamp,updatedAt:stamp};const next=[row,...rows.filter(x=>x.id!==row.id)];setRows(next);localStorage.setItem(CONTACT_KEY,JSON.stringify(next));setShowForm(false);setEditingId("");setDraft(blank());onNotice("Contact profile saved with its company/vendor relationship and follow-up history.");};
 const remove=(id:string)=>{if(!window.confirm("Delete this Contact 360 profile? The linked company or vendor master will not be deleted."))return;const next=rows.filter(x=>x.id!==id);setRows(next);localStorage.setItem(CONTACT_KEY,JSON.stringify(next));onNotice("Contact profile deleted. Linked company/vendor master was retained.");};
 const options=draft.linkedType==="company"?companies.map(c=>({id:c.id,label:c.name})):vendors.map(v=>({id:v.id,label:v.company+" · "+v.contact}));
 return <section className="workspace-page relationship-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> CONTACT GRAPH</span></div>
  {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> RELATIONSHIPS / CONTACT MASTER</div><h1>Contact 360<span>.</span></h1><p>Unified contact profiles across company and vendor masters, with communication history and follow-up dates.</p></div><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add contact</button></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contact, company, vendor, phone or email…"/></label><span className="module-number">{filtered.length} CONTACT PROFILES</span></div>
  {showForm&&<section className="surface-panel"><div className="panel-heading"><div><h3>{editingId?"Edit contact profile":"Add contact profile"}</h3><p>Every profile must be linked to an existing company or vendor.</p></div></div>
   <div className="module-record-form specialized-form">
    <label>Relationship type<select value={draft.linkedType} onChange={e=>setDraft({...draft,linkedType:e.target.value as "company"|"vendor",linkedId:""})}><option value="company">Company</option><option value="vendor">Vendor</option></select></label>
    <label>Linked company / vendor *<select value={draft.linkedId} onChange={e=>setDraft({...draft,linkedId:e.target.value})}><option value="">Select related record</option>{options.map(x=><option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
    <label>Contact person *<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Full name"/></label>
    <label>Role / designation<input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Purchase, production, accounts…"/></label>
    <label>Phone<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="Phone with country code"/></label>
    <label>WhatsApp<input value={draft.whatsapp} onChange={e=>setDraft({...draft,whatsapp:e.target.value})} placeholder="WhatsApp number"/></label>
    <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
    <label>Next follow-up date<input type="date" value={draft.followUpDate} onChange={e=>setDraft({...draft,followUpDate:e.target.value})}/></label>
    <label className="module-form-wide">Address<input value={draft.address} onChange={e=>setDraft({...draft,address:e.target.value})} placeholder="Contact address"/></label>
    <label className="module-form-wide">Communication / follow-up history<textarea rows={3} value={draft.history} onChange={e=>setDraft({...draft,history:e.target.value})} placeholder="Record calls, meetings, messages and outcomes"/></label>
    <div className="module-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/> Save contact</button><button className="button-quiet" onClick={()=>setShowForm(false)}>Cancel</button></div>
   </div>
  </section>}
  <section className="surface-panel"><div className="panel-heading"><div><h3>Connected contacts</h3><p>Company/vendor contacts are read from their master records; additional profiles are stored in Contact 360.</p></div></div>
   {filtered.length?<div className="specialized-record-list">{filtered.map(row=><article className="specialized-record contact360-row" key={row.id}><span className="specialized-record-icon"><Users size={18}/></span><div className="specialized-record-copy"><strong>{row.name}</strong><span>{row.relationship} · {row.role||row.source}</span><small><Phone size={12}/> {row.phone||"No phone"} · <Mail size={12}/> {row.email||"No email"}</small><small>{row.address||"Address not recorded"} · {row.source}</small>{row.followUpDate&&<small><CalendarClock size={12}/> Follow-up: {row.followUpDate}</small>}{row.history&&<p>{row.history}</p>}</div><div className="relationship-actions">{row.kind==="manual"?<><button className="button-quiet compact-button" onClick={()=>edit(rows.find(x=>x.id===row.id)!)}>Edit</button><button className="button-quiet compact-button" onClick={()=>remove(row.id)}><Trash2 size={13}/> Delete</button></>:<button className="button-quiet compact-button" onClick={()=>onSelectModule(row.source==="Company Directory"?"companies":"vendors")}>Open master <ArrowUpRight size={13}/></button>}</div></article>)}</div>:<div className="module-empty-state"><Users size={24}/><h3>No contacts match</h3><p>Add an individual contact or change your search.</p></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Deleting a Contact 360 profile does not delete the underlying company or vendor. Company and vendor master contacts remain visible here.</span></div>
 </section>;
}

export function VendorNetworkWorkspace({onBack,onSelectModule}:Props){
 const {data}=useManufacturingData();const vendors=activeRows(data.vendors);
 const [search,setSearch]=useState("");const [category,setCategory]=useState("");const [process,setProcess]=useState("");
 const processOptions=[...new Set(vendors.flatMap(v=>v.processes.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)))].sort((a,b)=>a.localeCompare(b));
 const filtered=vendors.filter(v=>{
  const text=(v.company+" "+v.contact+" "+v.role+" "+v.phone+" "+v.processes+" "+v.machines+" "+v.materials+" "+v.notes).toLowerCase();
  const matchesSearch=text.includes(search.toLowerCase().trim());
  const matchesProcess=!process||v.processes.toLowerCase().split(/[,;|]/).some(x=>x.trim()===process.toLowerCase());
  const matchesCategory=!category||v.role.toLowerCase().includes(category.toLowerCase())||v.processes.toLowerCase().includes(category.toLowerCase());
  return matchesSearch&&matchesProcess&&matchesCategory;
 });
 return <section className="workspace-page relationship-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> VENDOR CAPABILITY NETWORK</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / PROCESS CAPABILITIES</div><h1>Vendor Network<span>.</span></h1><p>Find vendors by process category and process, with their saved machines, materials and contact details.</p></div><button className="button-quiet" onClick={()=>onSelectModule("vendors")}><Users size={14}/> Manage vendors</button></div>
  <div className="module-action-bar relationship-filters"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor, contact, machine or material…"/></label><label>Process category<input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Machining, treatment…"/></label><label>Process<select value={process} onChange={e=>setProcess(e.target.value)}><option value="">All processes</option>{processOptions.map(x=><option key={x}>{x}</option>)}</select></label></div>
  <section className="surface-panel"><div className="panel-heading"><div><h3>Matching vendors</h3><p>{filtered.length} of {vendors.length} vendors match the selected capabilities.</p></div></div>
   {filtered.length?<div className="vendor-record-list">{filtered.map(v=><article className="vendor-record" key={v.id}><span className="vendor-avatar">{v.company.slice(0,1).toUpperCase()}</span><span className="vendor-record-copy"><strong>{v.company}</strong><small>{v.contact} · {v.role||"Role not recorded"}</small><small>{v.phone||"Phone not recorded"} · {v.email||"Email not recorded"}</small><small>{v.processes||"Process capabilities not recorded"}</small><small>{v.machines||"Machines not recorded"} · {v.materials||"Materials not recorded"}</small></span><button className="button-quiet compact-button" onClick={()=>onSelectModule("vendors")}>Open vendor <ArrowRight size={13}/></button></article>)}</div>:<div className="module-empty-state"><Wrench size={24}/><h3>No matching vendors</h3><p>Change the process filter or add capabilities in Vendor Directory.</p><button className="button-primary" onClick={()=>onSelectModule("vendors")}><Plus size={14}/> Open Vendor Directory</button></div>}
  </section>
  <div className="module-safety-note"><ShieldCheck size={15}/><span>Vendor Network is a filtered view of saved Vendor Directory records. It does not create duplicate vendor masters.</span></div>
 </section>;
}
