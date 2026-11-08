import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Building2, CalendarClock, Mail, MessageCircle, Phone, Plus, Search, ShieldCheck, Trash2, Users, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ContactProfileRecord } from "./manufacturingData";
import SearchableMultiSelect from "./SearchableMultiSelect";
import SearchablePicker from "./SearchablePicker";
import { ProcessIcon } from "./IconStudio";

type LinkedNavigationContext={companyId?:string;poId?:string;poLineId?:string;componentId?:string;operationId?:string;vendorId?:string};
type Props={onBack:()=>void;onNotice:(value:string)=>void;notice:string;onSelectModule:(id:string,context?:LinkedNavigationContext)=>void};
type Contact360Props=Props & {initialVendorId?:string;onInitialVendorConsumed?:()=>void};
type ContactRecord=ContactProfileRecord;
type ContactDraft=Omit<ContactRecord,"id"|"createdAt"|"updatedAt">;
const CONTACT_KEY="aximach.contact360.v1";
const blank=():ContactDraft=>({linkedType:"company",linkedId:"",name:"",role:"",group:"",phone:"",whatsapp:"",additionalPhones:[],email:"",address:"",followUpDate:"",history:"",processCategories:[],processTypes:[],processSubcategories:[],processDefinitionIds:[],processSubcategoryIds:[],machineCapabilities:[],materialCapabilities:[]});
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
 const [categoryFilters,setCategoryFilters]=useState<string[]>([]);
 const [subcategoryFilters,setSubcategoryFilters]=useState<string[]>([]);
 const [onlyWhatsApp,setOnlyWhatsApp]=useState(false);
 useEffect(()=>{const legacy=readContacts();if(!legacy.length)return;update(current=>{const byId=new Map(current.contactProfiles.map(row=>[row.id,row]));let changed=false;for(const row of legacy){const old=byId.get(row.id);if(!old||(Date.parse(row.updatedAt||"")||0)>(Date.parse(old.updatedAt||"")||0)){byId.set(row.id,{...row,group:row.group||""});changed=true;}}return changed?{...current,contactProfiles:[...byId.values()]}:current;});},[update]);
 useEffect(()=>{if(!initialVendorId)return;setEditingId("");setDraft({...blank(),linkedType:"vendor",linkedId:initialVendorId});setShowForm(true);onInitialVendorConsumed?.();},[initialVendorId]);
 const relatedLabel=(row:ContactRecord)=>row.linkedType==="company"?companies.find(x=>x.id===row.linkedId)?.name||"Company record missing":vendors.find(x=>x.id===row.linkedId)?.company||"Vendor record missing";
 const generated=[
  ...companies.filter(c=>c.contactPerson?.trim()).map(c=>({id:"company:"+c.id,linkedId:c.id,name:c.contactPerson||"",role:"Company contact",group:"",phone:c.phone,whatsapp:c.phone,additionalPhones:[],email:c.email,address:c.address||"",followUpDate:"",history:"",relationship:c.name,source:"Company Directory",linkedType:"company",vendorType:"Company",processes:"",machines:"",materials:"",processCategories:[],processTypes:[],processSubcategories:[],processDefinitionIds:[],processSubcategoryIds:[],machineCapabilities:[],materialCapabilities:[]})),
  ...vendors.map(v=>({id:"vendor:"+v.id,linkedId:v.id,name:v.contact,role:v.role,group:"",phone:v.phone,whatsapp:v.whatsappNumber||v.phone,additionalPhones:v.additionalPhones||[],email:v.email,address:v.address,followUpDate:"",history:"",relationship:v.company,source:"Vendor Directory",linkedType:"vendor",vendorType:v.vendorType||"",processes:v.processes||"",machines:v.machines||"",materials:v.materials||"",processCategories:[],processTypes:[],processSubcategories:[],machineCapabilities:[],materialCapabilities:[]}))
 ];
 const processDefinitions=activeRows(data.processDefinitions);
 const stableContactSubcategoryId=(definition:typeof processDefinitions[number],index:number)=>definition.subcategoryIds?.[index]||definition.id+"-subprocess-"+String(index+1).padStart(3,"0");
 const contactProcessDefinitionIds=(row:{processDefinitionIds?:string[];processTypes?:string[];processCategories?:string[]})=>{
  if(Array.isArray(row.processDefinitionIds))return [...new Set(row.processDefinitionIds)];
  const resolved:string[]=[];
  for(const value of row.processTypes||[]){
   const direct=processDefinitions.filter(definition=>definition.id===value);
   if(direct.length===1){resolved.push(direct[0].id);continue;}
   const matches=processDefinitions.filter(definition=>definition.processType===value&&(!(row.processCategories||[]).length||(row.processCategories||[]).includes(definition.category)));
   if(matches.length===1)resolved.push(matches[0].id);
  }
  return [...new Set(resolved)];
 };
 const manual=activeRows(rows);
 const contactRows=[
  ...generated.map(row=>({...row,kind:"master" as const})),
  ...manual.map(row=>{const vendor=row.linkedType==="vendor"?vendors.find(v=>v.id===row.linkedId):undefined;return {...row,kind:"manual" as const,relationship:row.linkedType==="company"?companies.find(c=>c.id===row.linkedId)?.name||"Company":vendor?.company||"Vendor",source:"Contact 360",vendorType:vendor?.vendorType||"",processes:vendor?.processes||"",machines:vendor?.machines||"",materials:vendor?.materials||"",processCategories:row.processCategories||[],processTypes:row.processTypes||[],processSubcategories:row.processSubcategories||[],processDefinitionIds:row.processDefinitionIds||[],processSubcategoryIds:row.processSubcategoryIds||[],machineCapabilities:row.machineCapabilities||[],materialCapabilities:row.materialCapabilities||[]};})
 ];
 const roleOptions=[...new Set(contactRows.map(row=>row.role).filter(Boolean))].sort();
 const vendorTypeOptions=[...new Set(vendors.map(v=>v.vendorType||"").filter(Boolean))].sort();
 const legacyProcessTextOptions=[...new Set([...contactRows.flatMap(row=>row.processTypes||[]),...vendors.flatMap(v=>v.processes.split(/[,;|]/).map(x=>x.trim()).filter(Boolean))])].filter(value=>value&&!processDefinitions.some(definition=>definition.id===value)).sort((a,b)=>a.localeCompare(b));
 const processOptions=[...processDefinitions.map(definition=>({id:"directory:"+definition.id,label:definition.category+" · "+definition.processType})),...legacyProcessTextOptions.map(value=>({id:"text:"+value.trim().toLowerCase(),label:"Legacy / contact text · "+value}))];
 const categoryOptions=[...new Set([...processDefinitions.map(x=>x.category),...contactRows.flatMap(row=>row.processCategories||[])].filter(Boolean))].sort();
 const selectedCapabilityDefinitions=processDefinitions.filter(definition=>(!categoryFilters.length||categoryFilters.includes(definition.category))&&(!processFilters.length||processFilters.some(value=>value==="directory:"+definition.id||(value.startsWith("text:")&&value.slice(5)===definition.processType.trim().toLowerCase()))));
 const processSubcategoryFilterOptions=selectedCapabilityDefinitions.flatMap(definition=>(definition.subcategories||[]).map((name,index)=>({
  id:stableContactSubcategoryId(definition,index),
  label:definition.category+" · "+definition.processType+" · "+name
 })));
 const customContactSubcategoryFilterOptions=[...new Set(contactRows.flatMap(row=>row.processSubcategories||[]))].map(name=>({
  id:"contact:"+name.trim().toLowerCase(),label:"Contact capability · "+name
 }));
 const subcategoryOptions=[...new Map([...processSubcategoryFilterOptions,...customContactSubcategoryFilterOptions].map(option=>[option.id,option])).values()].sort((a,b)=>a.label.localeCompare(b.label));
 const machineOptions=[...new Set([...vendors.flatMap(v=>v.machines.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)),...contactRows.flatMap(row=>row.machineCapabilities||[])])].sort();
 const materialOptions=[...new Set([...vendors.flatMap(v=>v.materials.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)),...contactRows.flatMap(row=>row.materialCapabilities||[])])].sort();

 const filtered=useMemo(()=>contactRows.filter(row=>{
  const text=(row.name+" "+row.role+" "+(row.group||"")+" "+row.phone+" "+(row.additionalPhones||[]).join(" ")+" "+row.whatsapp+" "+row.email+" "+row.address+" "+row.relationship+" "+row.source+" "+row.vendorType+" "+row.processes+" "+row.machines+" "+row.materials).toLowerCase();
  const vendorId=row.linkedType==="vendor"?(row.linkedId||String(row.id).replace(/^vendor:/,"")):"";
  const capabilityRows=processDefinitions.filter(definition=>(definition.vendorIds||[]).includes(vendorId));
  const contactDefinitionIds=contactProcessDefinitionIds(row);
  const linkedDefinitionIds=[...new Set([...capabilityRows.map(definition=>definition.id),...contactDefinitionIds])];
  const rowCategories=[...capabilityRows.map(definition=>definition.category),...(row.processCategories||[])].join(" ").toLowerCase();
  const capabilitySubcategoryIds=capabilityRows.flatMap(definition=>(definition.subcategories||[]).map((_,index)=>stableContactSubcategoryId(definition,index)));
  const contactSubcategoryIds=row.processSubcategoryIds||[];
  const customContactSubcategoryIds=(row.processSubcategories||[]).map(name=>"contact:"+name.trim().toLowerCase());
  const subcategoryMatch=!subcategoryFilters.length||subcategoryFilters.some(id=>capabilitySubcategoryIds.includes(id)||contactSubcategoryIds.includes(id)||customContactSubcategoryIds.includes(id));
  const legacyProcessNames=[...(row.processTypes||[]),...String(row.processes||"").split(/[,;|]/).map(value=>value.trim()).filter(Boolean)].map(value=>value.toLowerCase());
  const processMatch=!processFilters.length||processFilters.some(value=>value.startsWith("directory:")?linkedDefinitionIds.includes(value.slice(10)):value.startsWith("text:")&&legacyProcessNames.includes(value.slice(5)));
  const containsAny=(values:string[],source:string)=>!values.length||values.some(value=>source.toLowerCase().includes(value.toLowerCase()));
  return text.includes(search.toLowerCase().trim())
   &&(typeFilter==="All"||row.linkedType===typeFilter.toLowerCase())
   &&(!roleFilters.length||roleFilters.includes(row.role))
   &&(!vendorTypeFilters.length||vendorTypeFilters.includes(row.vendorType))
   &&containsAny(categoryFilters,rowCategories)
   &&processMatch
   &&subcategoryMatch
   &&containsAny(machineFilters,row.machines+" "+(row.machineCapabilities||[]).join(" "))
   &&containsAny(materialFilters,row.materials+" "+(row.materialCapabilities||[]).join(" "))
   &&(!onlyWhatsApp||Boolean(String(row.whatsapp||"").replace(/\D/g,"").length>=8));
 }),[contactRows,search,typeFilter,roleFilters,vendorTypeFilters,categoryFilters,processFilters,subcategoryFilters,machineFilters,materialFilters,onlyWhatsApp]);
 const beginNew=()=>{setEditingId("");setDraft(blank());setShowForm(true);};
 const edit=(row:ContactRecord)=>{setEditingId(row.id);setDraft({linkedType:row.linkedType,linkedId:row.linkedId,name:row.name,role:row.role,group:row.group||"",phone:row.phone,whatsapp:row.whatsapp,additionalPhones:row.additionalPhones||[],email:row.email,address:row.address,followUpDate:row.followUpDate,history:row.history,processCategories:row.processCategories||[],processTypes:row.processTypes||[],processSubcategories:row.processSubcategories||[],processDefinitionIds:contactProcessDefinitionIds(row),processSubcategoryIds:row.processSubcategoryIds||[],machineCapabilities:row.machineCapabilities||[],materialCapabilities:row.materialCapabilities||[]});setShowForm(true);};
 const save=()=>{if(!draft.name.trim()||!draft.linkedId){onNotice("Enter the contact name and link it to a company or vendor.");return;}const stamp=nowIso();const old=rows.find(x=>x.id===editingId);const row:ContactRecord={...draft,id:editingId||makeId("contact"),createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined};update(current=>({...current,contactProfiles:[row,...current.contactProfiles.filter(x=>x.id!==row.id)]}));setShowForm(false);setEditingId("");setDraft(blank());onNotice("Contact profile saved to shared AXIMACH contact data with its company/vendor relationship and follow-up history.");};
 const remove=(id:string)=>{if(!window.confirm("Delete this Contact 360 profile? The linked company or vendor master will not be deleted."))return;const stamp=nowIso();update(current=>({...current,contactProfiles:current.contactProfiles.map(row=>row.id===id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));onNotice("Contact profile archived. Linked company/vendor master and historical record were retained.");};
 const options=draft.linkedType==="company"?companies.map(c=>({id:c.id,label:c.name})):vendors.map(v=>({id:v.id,label:v.company+" · "+v.contact}));
 return <section className="workspace-page relationship-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> CONTACT GRAPH</span></div>
  {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> RELATIONSHIPS / CONTACT MASTER</div><h1>Contact 360<span>.</span></h1><p>Unified contact profiles across company and vendor masters, with communication history and follow-up dates.</p></div><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add contact</button></div>
  <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contact name, company, phone, role, machine or capability…"/></label><label>Relationship<select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="All">All contacts</option><option value="vendor">Vendor contacts</option><option value="company">Company contacts</option></select></label><span className="module-number">{filtered.length} CONTACT PROFILES</span><button className="button-quiet compact-button" onClick={()=>{setSearch("");setTypeFilter("All");setRoleFilters([]);setVendorTypeFilters([]);setCategoryFilters([]);setProcessFilters([]);setSubcategoryFilters([]);setMachineFilters([]);setMaterialFilters([]);setOnlyWhatsApp(false);}}>Clear filters</button></div>
  <section className="surface-panel contact360-filter-panel"><div className="panel-heading"><div><h3>Contact capability filters</h3><p>Each column has its own search, multi-select, Select all and Clear controls.</p></div><button className="button-quiet compact-button" onClick={()=>{setRoleFilters([]);setVendorTypeFilters([]);setCategoryFilters([]);setProcessFilters([]);setSubcategoryFilters([]);setMachineFilters([]);setMaterialFilters([]);}}>Clear all filters</button></div>
    <div className="contact360-filter-grid ax-search-filter-columns">
      <label className="contact360-whatsapp-filter"><input type="checkbox" checked={onlyWhatsApp} onChange={e=>setOnlyWhatsApp(e.target.checked)}/> WhatsApp contacts only</label>
      <SearchableMultiSelect id="contact-role" label="Role / designation" options={roleOptions.map(x=>({id:x,label:x}))} selected={roleFilters} onChange={setRoleFilters} emptyMeansAll/>
      <SearchableMultiSelect id="contact-vendor-type" label="Vendor category" options={vendorTypeOptions.map(x=>({id:x,label:x}))} selected={vendorTypeFilters} onChange={setVendorTypeFilters} emptyMeansAll/>
      <SearchableMultiSelect id="contact-process-category" label="Process category" options={categoryOptions.map(x=>({id:x,label:x}))} selected={categoryFilters} onChange={setCategoryFilters} emptyMeansAll/>
      <SearchableMultiSelect id="contact-process-type" label="Process type" options={processOptions} selected={processFilters} onChange={setProcessFilters} emptyMeansAll/>
      <SearchableMultiSelect id="contact-process-subcategory" label="Process subcategory" options={subcategoryOptions} selected={subcategoryFilters} onChange={setSubcategoryFilters} emptyMeansAll/>
      <SearchableMultiSelect id="contact-machine" label="Machine capability" options={machineOptions.map(x=>({id:x,label:x}))} selected={machineFilters} onChange={setMachineFilters} emptyMeansAll/>
      <SearchableMultiSelect id="contact-material" label="Material capability" options={materialOptions.map(x=>({id:x,label:x}))} selected={materialFilters} onChange={setMaterialFilters} emptyMeansAll/>
    </div>
  </section>
  {showForm&&<section className="surface-panel"><div className="panel-heading"><div><h3>{editingId?"Edit contact profile":"Add contact profile"}</h3><p>Every profile must be linked to an existing company or vendor.</p></div></div>
   <div className="module-record-form specialized-form">
    <label>Relationship type<select value={draft.linkedType} onChange={e=>setDraft({...draft,linkedType:e.target.value as "company"|"vendor",linkedId:""})}><option value="company">Company</option><option value="vendor">Vendor</option></select></label>
    <SearchablePicker id="contact-linked-record" label="Linked company / vendor *" value={draft.linkedId} placeholder="Search company or vendor…" options={options} onChange={value=>setDraft({...draft,linkedId:value})}/>
    <label>Contact person *<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Full name"/></label>
    <label>Role / designation<input value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})} placeholder="Purchase, production, accounts…"/></label>
    <label>Contact group<input value={draft.group||""} onChange={e=>setDraft({...draft,group:e.target.value})} placeholder="Purchase, production, accounts, management…"/></label>
    <label>Phone<input value={draft.phone} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="Phone with country code"/></label>
    <label>WhatsApp<input value={draft.whatsapp} onChange={e=>setDraft({...draft,whatsapp:e.target.value})} placeholder="WhatsApp number"/></label>
    <label>Additional phone numbers<input value={(draft.additionalPhones||[]).join(", ")} onChange={e=>setDraft({...draft,additionalPhones:e.target.value.split(/[,;|]/).map(value=>value.trim()).filter(Boolean)})} placeholder="Alternate mobile / office numbers, comma-separated"/></label>
    <label>Email<input type="email" value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="name@company.com"/></label>
    <div className="module-form-wide contact-capability-assignment"><div className="panel-heading"><div><strong>Contact capability assignments</strong><p>Selections are stored on this contact and also combine with linked vendor capabilities.</p></div></div>
     <div className="ax-search-filter-columns">
      <SearchableMultiSelect id="contact-edit-process-category" label="Process category" options={categoryOptions.map(value=>({id:value,label:value}))} selected={draft.processCategories||[]} onChange={values=>setDraft(current=>{const retained=(current.processDefinitionIds||[]).filter(id=>{const definition=processDefinitions.find(item=>item.id===id);return Boolean(definition&&values.includes(definition.category));});const retainedDefinitions=processDefinitions.filter(definition=>retained.includes(definition.id));const retainedSubcategories=retainedDefinitions.flatMap(definition=>(definition.subcategories||[]).map((_,index)=>stableContactSubcategoryId(definition,index)));return {...current,processCategories:values,processDefinitionIds:retained,processTypes:retainedDefinitions.map(definition=>definition.processType),processSubcategoryIds:(current.processSubcategoryIds||[]).filter(id=>retainedSubcategories.includes(id))};})}/>
      <SearchableMultiSelect id="contact-edit-process-type" label="Process Directory process type" options={processDefinitions.filter(definition=>!(draft.processCategories||[]).length||(draft.processCategories||[]).includes(definition.category)).map(definition=>({id:definition.id,label:definition.processType+" · "+definition.category}))} selected={draft.processDefinitionIds||[]} onChange={ids=>setDraft(current=>{const selectedDefinitions=processDefinitions.filter(definition=>ids.includes(definition.id));const subcategoryIds=selectedDefinitions.flatMap(definition=>(definition.subcategories||[]).map((_,index)=>stableContactSubcategoryId(definition,index)));return {...current,processDefinitionIds:ids,processTypes:selectedDefinitions.map(definition=>definition.processType),processSubcategoryIds:(current.processSubcategoryIds||[]).filter(id=>subcategoryIds.includes(id))};})}/>
      <SearchableMultiSelect id="contact-edit-process-subcategory" label="Process Directory subcategory" options={processDefinitions.filter(definition=>(draft.processDefinitionIds||[]).includes(definition.id)).flatMap(definition=>(definition.subcategories||[]).map((name,index)=>({id:stableContactSubcategoryId(definition,index),label:definition.category+" · "+definition.processType+" · "+name})))} selected={draft.processSubcategoryIds||[]} onChange={values=>setDraft(current=>({...current,processSubcategoryIds:values}))}/>
      <label className="module-form-wide">Manual contact capability tags (separate from Process Directory)<input value={(draft.processSubcategories||[]).join(", ")} onChange={event=>setDraft(current=>({...current,processSubcategories:[...new Set(event.target.value.split(",").map(value=>value.trim()).filter(Boolean))]}))} placeholder="Enter contact-only tags separated by commas"/></label>
      <SearchableMultiSelect id="contact-edit-machine" label="Machine capability" options={[...new Set(vendors.flatMap(v=>v.machines.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)))].sort().map(value=>({id:value,label:value}))} selected={draft.machineCapabilities||[]} onChange={values=>setDraft(current=>({...current,machineCapabilities:values}))}/>
      <SearchableMultiSelect id="contact-edit-material" label="Material capability" options={[...new Set(vendors.flatMap(v=>v.materials.split(/[,;|]/).map(x=>x.trim()).filter(Boolean)))].sort().map(value=>({id:value,label:value}))} selected={draft.materialCapabilities||[]} onChange={values=>setDraft(current=>({...current,materialCapabilities:values}))}/>
     </div>
    </div>
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
 const subcategoryOptions=selectedDefinitions.flatMap(definition=>(definition.subcategories||[]).map((name,index)=>({
  id:definition.subcategoryIds?.[index]||definition.id+"-subprocess-"+String(index+1).padStart(3,"0"),
  label:definition.category+" · "+definition.processType+" · "+name
 }))).sort((a,b)=>a.label.localeCompare(b.label));
 const stableSubcategoryIdsFor=(definition:typeof definitions[number],name:string,storedId?:string)=>{
  if(storedId)return storedId;
  const index=definition.subcategories.indexOf(name);
  if(index<0)return "";
  return definition.subcategoryIds?.[index]||definition.id+"-subprocess-"+String(index+1).padStart(3,"0");
 };
 const matchesAny=(selected:string[],source:string)=>!selected.length||selected.some(value=>source.toLowerCase().split(/[,;|]/).map(x=>x.trim()).includes(value.toLowerCase()));

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
  const capabilitySubcategoryIds=capabilityDefinitions.flatMap(definition=>definition.subcategories.map(name=>stableSubcategoryIdsFor(definition,name)));
  const operationSubcategoryIds=assigned.map(operation=>{
   const definition=definitions.find(item=>item.id===operation.processDefinitionId)
    || definitions.find(item=>item.processType===operation.name&&item.category===operation.category);
   return definition?stableSubcategoryIdsFor(definition,operation.subcategory||"",operation.processSubcategoryId):operation.processSubcategoryId||"";
  }).filter(Boolean);
  const execution=assigned.map(op=>op.executionType||"Outsourced").join(" ");
  const subcategoryMatch=!subcategories.length||subcategories.some(id=>capabilitySubcategoryIds.includes(id)||operationSubcategoryIds.includes(id));
  return fullText.includes(search.toLowerCase().trim())
   &&(!vendorTypes.length||vendorTypes.includes(v.vendorType||""))
   &&matchesAny(categories,capabilityCategories+" "+operationCategory)
   &&matchesAny(processTypes,capabilityTypes+" "+v.processes+" "+operationTypes)
   &&subcategoryMatch
   &&matchesAny(executionTypes,execution)
   &&(!onlyAssigned||assigned.length>0);
 });
 return <section className="workspace-page relationship-workspace">
  <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className="demo-pill"><i/> VENDOR CAPABILITY NETWORK</span></div>
  <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / LIVE ASSIGNMENTS</div><h1>Vendor Network<span>.</span></h1><p>Filter process capabilities from Process Directory and see the actual operations assigned to each vendor in Process Plan / Production Plan.</p></div><button className="button-quiet" onClick={()=>onSelectModule("vendors")}><Users size={14}/> Manage vendors</button></div>
  <div className="module-action-bar relationship-filters"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search vendor company, contact, process, machine, material or assigned PO…"/></label><label><input type="checkbox" checked={onlyAssigned} onChange={e=>setOnlyAssigned(e.target.checked)}/> Assigned vendors only</label><span className="module-number">{filtered.length} VENDORS</span><button className="button-quiet compact-button" onClick={clearFilters}>Clear filters</button></div>
  <section className="surface-panel vendor-network-filter-panel"><div className="panel-heading"><div><h3>Capability filters</h3><p>Each column has searchable multi-select, Select all and Clear actions.</p></div><button className="button-quiet compact-button" onClick={clearFilters}>Clear all filters</button></div>
 <div className="contact360-filter-grid ax-search-filter-columns">
  <SearchableMultiSelect id="network-vendor-type" label="Vendor category" options={vendorTypeOptions.map(x=>({id:x,label:x}))} selected={vendorTypes} onChange={setVendorTypes} emptyMeansAll/>
  <SearchableMultiSelect id="network-process-category" label="Process category" options={categoryOptions.map(x=>({id:x,label:x}))} selected={categories} onChange={setCategories} emptyMeansAll/>
  <SearchableMultiSelect id="network-process-type" label="Process type" options={processOptions.map(x=>({id:x,label:x}))} selected={processTypes} onChange={setProcessTypes} emptyMeansAll/>
  <SearchableMultiSelect id="network-subcategory" label="Subcategory" options={subcategoryOptions} selected={subcategories} onChange={setSubcategories} emptyMeansAll/>
  <SearchableMultiSelect id="network-execution" label="Execution" options={["Internal","Outsourced"].map(x=>({id:x,label:x}))} selected={executionTypes} onChange={setExecutionTypes} emptyMeansAll/>
 </div>
</section>
<section className="surface-panel"><div className="panel-heading"><div><h3>Vendors and production assignments</h3><p>{filtered.length} of {vendors.length} vendor records · {operations.length} saved operations scanned.</p></div></div>
{filtered.length?<div className="costing-table-wrap"><table className="costing-table vendor-network-table"><thead><tr><th>Vendor / contact</th><th>Vendor category</th><th>Process category</th><th>Process type</th><th>Subcategory</th><th>Execution</th><th>Assigned operations / POs</th><th>Interlinks</th></tr></thead><tbody>{filtered.map(({vendor:v,assigned,contactRows,capabilityDefinitions,assignedProcesses,assignedPOs})=><tr key={v.id}>
<td><strong>{v.company}</strong><small>{v.contact} · {v.phone||"No phone"}</small><small>{contactRows.map(c=>c.name).join(", ")||"No additional contacts"}</small></td>
<td>{v.vendorType||"Not set"}</td>
<td>{[...new Set(capabilityDefinitions.map(definition=>definition.category))].join(", ")||"Not linked"}</td>
<td><div className="vendor-network-process-identities">{capabilityDefinitions.length?capabilityDefinitions.map(definition=><span className="vendor-network-process-identity" key={definition.id}><ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={<Wrench size={13}/>} /><span>{definition.processType}</span></span>):assignedProcesses.join(", ")||"Not linked"}</div></td>
<td>{[...new Set(capabilityDefinitions.flatMap(definition=>definition.subcategories||[]))].join(", ")||"Not set"}</td>
<td>{[...new Set(assigned.map(op=>op.executionType||"Outsourced"))].join(", ")||"No execution yet"}</td>
<td>{assigned.length} operation(s) · {assignedPOs.length} PO(s){assigned.length>0&&<small>{assigned.slice(0,6).map(op=>op.name+" · "+op.status).join(" | ")}</small>}</td>
<td><div className="vendor-network-actions"><button className="button-quiet compact-button" onClick={()=>onSelectModule("vendors",{vendorId:v.id})}>Vendor</button><button className="button-quiet compact-button" onClick={()=>{const op=assigned[0];onSelectModule("process-map",{poId:op?.poId,poLineId:op?.poLineId,componentId:op?.componentId,operationId:op?.id,vendorId:v.id});}}>Process Plan</button><button className="button-quiet compact-button" onClick={()=>onSelectModule("contact360")}>Contact 360</button></div></td>
</tr>)}</tbody></table></div>:<div className="module-empty-state"><Wrench size={24}/><h3>No matching vendors</h3><p>Change the capability filters or add capabilities to Vendor Directory from Process Directory.</p><button className="button-primary" onClick={()=>onSelectModule("vendors")}><Plus size={14}/> Open Vendor Directory</button></div>}
</section>
<div className="module-safety-note"><ShieldCheck size={15}/><span>Capability data is sourced from Vendor Directory and Process Directory. Assignment counts and statuses are derived from existing PO-linked Process Plan operations; they are not manually duplicated here.</span></div>
 </section>;
}
