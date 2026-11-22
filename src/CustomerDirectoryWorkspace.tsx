import { useMemo,useState } from "react";
import { ArrowLeft,Building2,Edit3,Plus,Search,Trash2,X } from "lucide-react";
import { activeRows,makeId,nowIso,useManufacturingData,type CustomerRecord } from "./manufacturingData";
type Props={onBack:()=>void;onNotice:(message:string)=>void;notice:string};
type Draft=Omit<CustomerRecord,"id"|"createdAt"|"updatedAt"|"deletedAt">;
const blank=():Draft=>({customerCode:"",legalName:"",displayName:"",gstin:"",pan:"",industry:"",website:"",primaryContact:"",phone:"",email:"",billingAddress:"",shippingAddress:"",paymentTerms:"",creditLimit:0,currency:"INR",status:"Active",notes:""});
export default function CustomerDirectoryWorkspace({onBack,onNotice,notice}:Props){
 const {data,update,syncStatus}=useManufacturingData();
 const rows=activeRows(data.customers||[]);
 const [search,setSearch]=useState(""),[editingId,setEditingId]=useState(""),[draft,setDraft]=useState<Draft>(blank),[showForm,setShowForm]=useState(false);
 const filtered=useMemo(()=>rows.filter(row=>[row.customerCode,row.legalName,row.displayName,row.gstin,row.pan,row.industry,row.primaryContact,row.email,row.phone].some(value=>String(value||"").toLowerCase().includes(search.trim().toLowerCase()))),[rows,search]);
 const field=(key:keyof Draft,value:string|number)=>setDraft(current=>({...current,[key]:value}));
 const reset=()=>{setDraft(blank());setEditingId("");setShowForm(false);};
 const save=()=>{
  const customerCode=draft.customerCode.trim().toUpperCase(),legalName=draft.legalName.trim();
  if(!customerCode||!legalName){onNotice("Customer code and legal name are required.");return;}
  if(rows.some(row=>row.id!==editingId&&row.customerCode.toLowerCase()===customerCode.toLowerCase())){onNotice("Customer code already exists. Use a unique code.");return;}
  const stamp=nowIso(),old=rows.find(row=>row.id===editingId);
  const row:CustomerRecord={...draft,id:editingId||makeId("customer"),customerCode,legalName,displayName:draft.displayName.trim()||legalName,createdAt:old?.createdAt||stamp,updatedAt:stamp};
  update(current=>({...current,customers:[row,...current.customers.filter(item=>item.id!==row.id)]}));
  reset();onNotice(editingId?"Customer record updated.":"Customer record saved.");
 };
 const edit=(row:CustomerRecord)=>{const {id,createdAt,updatedAt,deletedAt,...values}=row;setEditingId(id);setDraft({...blank(),...values});setShowForm(true);};
 const archive=(row:CustomerRecord)=>{if(!window.confirm("Archive customer "+row.customerCode+"? Transaction history will be retained."))return;const stamp=nowIso();update(current=>({...current,customers:current.customers.map(item=>item.id===row.id?{...item,deletedAt:stamp,updatedAt:stamp}:item)}));if(editingId===row.id)reset();onNotice("Customer archived. Historical references are retained.");};
 const input=(label:string,key:keyof Draft,type="text")=><label className="customer-field"><span>{label}</span><input type={type} value={String(draft[key]??"")} onChange={event=>field(key,type==="number"?(Number(event.target.value)||0):event.target.value)}/></label>;
 return <main className="page-content customer-directory">
  <header className="workspace-title-row"><div><div className="eyebrow">MASTER DATA / CUSTOMER ACCOUNTS</div><h1>Customer Directory<span>.</span></h1><p>Independent buyer accounts, separate from AXIMACH operating companies and supplier records.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={onBack}><ArrowLeft size={14}/> Back</button><button className="button-primary" onClick={()=>{reset();setShowForm(true);}}><Plus size={14}/> Add customer</button></div></header>
  <div className="module-safety-note"><Building2 size={15}/><span>Shared AXIMACH data server syncs these records across devices; without it, records remain local to this device.</span><strong>{syncStatus==="synced"?"Synced":syncStatus==="syncing"?"Syncing":"Local"}</strong></div>
  {notice&&<div className="workspace-notice">{notice}</div>}
  <div className="customer-toolbar"><label><Search size={15}/><input aria-label="Search customers" placeholder="Search code, legal name, GSTIN, contact..." value={search} onChange={event=>setSearch(event.target.value)}/></label><span>{filtered.length} of {rows.length} active customers</span></div>
  {showForm&&<section className="customer-form panel"><div className="panel-heading"><div><h3>{editingId?"Edit customer":"New customer"}</h3><p>Identity and commercial defaults. Transaction terms remain on source documents.</p></div><button className="button-quiet compact-button" onClick={reset}><X size={14}/> Close</button></div>
   <div className="customer-form-grid">{input("Customer code *","customerCode")}{input("Legal name *","legalName")}{input("Display / trading name","displayName")}{input("Industry","industry")}{input("GSTIN","gstin")}{input("PAN","pan")}{input("Website","website")}{input("Primary contact","primaryContact")}{input("Phone","phone","tel")}{input("Email","email","email")}{input("Payment terms","paymentTerms")}{input("Credit limit","creditLimit","number")}
    <label className="customer-field"><span>Currency</span><select value={draft.currency} onChange={event=>field("currency",event.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label>
    <label className="customer-field"><span>Status</span><select value={draft.status} onChange={event=>field("status",event.target.value)}><option>Active</option><option>On hold</option><option>Inactive</option></select></label>
    <label className="customer-field customer-field-wide"><span>Billing address</span><textarea rows={2} value={draft.billingAddress||""} onChange={event=>field("billingAddress",event.target.value)}/></label>
    <label className="customer-field customer-field-wide"><span>Shipping address</span><textarea rows={2} value={draft.shippingAddress||""} onChange={event=>field("shippingAddress",event.target.value)}/></label>
    <label className="customer-field customer-field-wide"><span>Notes</span><textarea rows={2} value={draft.notes||""} onChange={event=>field("notes",event.target.value)}/></label></div>
   <div className="customer-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/> Save customer</button><button className="button-quiet" onClick={reset}>Cancel</button></div>
  </section>}
  <section className="customer-list panel">{filtered.length?filtered.map(row=><article className="customer-row" key={row.id}><div className="customer-avatar">{(row.displayName||row.legalName).slice(0,1).toUpperCase()}</div><div className="customer-main"><strong>{row.displayName||row.legalName}</strong><small>{row.customerCode} · {row.legalName}</small><span>{[row.industry,row.gstin?"GSTIN "+row.gstin:"",row.primaryContact,row.email].filter(Boolean).join(" · ")||"No additional details recorded"}</span></div><div className="customer-commercial"><strong>{row.currency} {Number(row.creditLimit||0).toLocaleString("en-IN")}</strong><small>{row.paymentTerms||"Payment terms not set"}</small><span>{row.status}</span></div><div className="customer-actions"><button className="button-quiet compact-button" onClick={()=>edit(row)}><Edit3 size={13}/> Edit</button><button className="button-quiet compact-button" onClick={()=>archive(row)}><Trash2 size={13}/> Archive</button></div></article>):<div className="module-empty-state"><Building2 size={24}/><h3>{search?"No matching customers":"No customers yet"}</h3><p>{search?"Try another code, name or contact.":"Create a customer account before linking commercial transactions."}</p><button className="button-primary" onClick={()=>{reset();setShowForm(true);}}><Plus size={14}/> Add customer</button></div>}</section>
 </main>;
}
