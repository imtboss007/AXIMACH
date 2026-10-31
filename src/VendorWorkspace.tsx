import { useState } from "react";
import { ArrowRight, Check, FileText, Link2, MapPin, Plus, Search, ShieldCheck, Trash2, Users, X } from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type VendorContactRecord, type VendorDocumentRecord, type VendorRecord
} from "./manufacturingData";

type Props = {
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  initialSearch?: string;
  onSelectModule: (id: string) => void;
};

type VendorDraft = {
  company: string;
  gstin: string;
  address: string;
  notes: string;
  status: "Active" | "Inactive";
  verificationStatus: string;
  contacts: VendorContactRecord[];
  documents: VendorDocumentRecord[];
};

const emptyDraft = (): VendorDraft => ({
  company: "", gstin: "", address: "", notes: "", status: "Active",
  verificationStatus: "", contacts: [], documents: []
});

const legacyContacts = (vendor: VendorRecord): VendorContactRecord[] => {
  if (vendor.contacts?.length) return vendor.contacts;
  if (vendor.contact || vendor.phone || vendor.email) {
    return [{
      id: vendor.id + "-primary", name: vendor.contact || "", role: vendor.role || "",
      phone: vendor.phone || "", email: vendor.email || ""
    }];
  }
  return [];
};

const isActive = (status: string) => !["Inactive", "Not approved", "On hold"].includes(status);

export default function VendorWorkspace({ onBack, onNotice, notice, initialSearch = "" }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const vendors = activeRows(data.vendors);
  const [search, setSearch] = useState(initialSearch);
  const [selectedId, setSelectedId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VendorDraft>(emptyDraft());

  const selected = vendors.find(v => v.id === selectedId) || vendors[0];
  const filtered = vendors.filter(v => {
    const contactText = legacyContacts(v).map(c => [c.name, c.role, c.phone, c.email].join(" ")).join(" ");
    const documentText = (v.documents || []).map(d => [d.title, d.reference, d.notes].join(" ")).join(" ");
    return [v.company, v.gstin, v.address, v.notes, v.status, contactText, documentText]
      .join(" ").toLowerCase().includes(search.trim().toLowerCase());
  });

  const resetEditor = () => { setEditing(false); setDraft(emptyDraft()); };
  const beginNew = () => { setSelectedId(""); setDraft(emptyDraft()); setEditing(true); };
  const beginEdit = (vendor: VendorRecord) => {
    const legacyStatus = vendor.status || "Active";
    setSelectedId(vendor.id);
    setDraft({
      company: vendor.company || "",
      gstin: vendor.gstin || "",
      address: vendor.address || "",
      notes: vendor.notes || "",
      status: isActive(legacyStatus) ? "Active" : "Inactive",
      verificationStatus: vendor.verificationStatus || (["Active", "Inactive"].includes(legacyStatus) ? "" : legacyStatus),
      contacts: legacyContacts(vendor),
      documents: vendor.documents || []
    });
    setEditing(true);
  };

  const saveVendor = () => {
    const name = draft.company.trim();
    if (!name) { onNotice("Enter the vendor name before saving."); return; }
    const gstin = draft.gstin.replace(/\\s/g, "").toUpperCase();
    const duplicate = vendors.find(v =>
      v.id !== selectedId &&
      ((gstin && (v.gstin || "").replace(/\\s/g, "").toUpperCase() === gstin) ||
       v.company.trim().toLowerCase() === name.toLowerCase())
    );
    if (duplicate) {
      onNotice("A vendor with this name or GSTIN already exists. Open that vendor record instead of creating a duplicate.");
      return;
    }
    const stamp = nowIso();
    const old = vendors.find(v => v.id === selectedId);
    const contacts = draft.contacts.filter(c => c.name.trim() || c.phone.trim() || c.email.trim()).map(c => ({
      ...c, name: c.name.trim(), role: c.role.trim(), phone: c.phone.trim(), email: c.email.trim()
    }));
    const primary = contacts[0];
    const documents = draft.documents.filter(d => d.title.trim() || d.reference.trim()).map(d => ({
      ...d, title: d.title.trim(), reference: d.reference.trim(), notes: d.notes.trim()
    }));
    const record: VendorRecord = {
      id: selectedId || makeId("vendor"),
      company: name,
      gstin,
      address: draft.address.trim(),
      notes: draft.notes.trim(),
      status: draft.status,
      verificationStatus: draft.verificationStatus.trim(),
      contacts,
      documents,
      contact: primary?.name || "",
      role: primary?.role || "",
      phone: (primary?.phone || "").replace(/\\D/g, ""),
      whatsappNumber: old?.whatsappNumber || (primary?.phone || "").replace(/\\D/g, ""),
      email: primary?.email || "",
      processes: old?.processes || "",
      machines: old?.machines || "",
      materials: old?.materials || "",
      sourceContactId: old?.sourceContactId || "",
      whatsappSyncedAt: old?.whatsappSyncedAt || "",
      createdAt: old?.createdAt || stamp,
      updatedAt: stamp,
      deletedAt: undefined
    };
    update(current => ({
      ...current,
      vendors: [...current.vendors.filter(v => v.id !== record.id), record]
    }));
    setSelectedId(record.id);
    setEditing(false);
    onNotice(syncStatus === "synced"
      ? "Vendor saved to shared AXIMACH data."
      : "Vendor saved. Cross-device sharing requires the AXIMACH data server to be connected.");
  };

  const archiveVendor = (vendor: VendorRecord) => {
    if (!window.confirm("Archive this vendor? Existing process and quotation history will retain its vendor ID.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      vendors: current.vendors.map(v => v.id === vendor.id ? { ...v, deletedAt: stamp, updatedAt: stamp } : v)
    }));
    setSelectedId("");
    resetEditor();
    onNotice("Vendor archived. Historical links were retained.");
  };

  const toggleStatus = (vendor: VendorRecord) => {
    const stamp = nowIso();
    const nextStatus = isActive(vendor.status) ? "Inactive" : "Active";
    update(current => ({
      ...current,
      vendors: current.vendors.map(v => v.id === vendor.id
        ? { ...v, status: nextStatus, updatedAt: stamp }
        : v)
    }));
    onNotice("Vendor marked " + nextStatus.toLowerCase() + ".");
  };

  const updateContact = (id: string, patch: Partial<VendorContactRecord>) =>
    setDraft(current => ({ ...current, contacts: current.contacts.map(c => c.id === id ? { ...c, ...patch } : c) }));
  const updateDocument = (id: string, patch: Partial<VendorDocumentRecord>) =>
    setDraft(current => ({ ...current, documents: current.documents.map(d => d.id === id ? { ...d, ...patch } : d) }));

  return (
    <section className="workspace-page vendor-master-page">
      {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
      <div className="workspace-topline">
        <button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button>
        <span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "VENDOR MASTER"}</span>
      </div>
      <div className="workspace-title-row">
        <div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / MASTER RECORDS</div><h1>Vendor directory<span>.</span></h1><p>Register each vendor once and reuse the same vendor record across POs, components and process operations.</p></div>
        <div className="workspace-title-actions"><button className="button-primary" onClick={beginNew}><Plus size={15}/> Add vendor</button></div>
      </div>

      <div className="module-action-bar">
        <label className="module-record-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor name, GSTIN, contact, phone or email…"/></label>
        <span className="module-number">{vendors.length} VENDORS</span>
      </div>

      <div className="vendor-workspace-grid vendor-master-grid">
        <section className="surface-panel vendor-list-panel">
          <div className="panel-heading"><div><h3>Vendor directory</h3><p>One master record per vendor · searchable across all contact details</p></div></div>
          <div className="vendor-record-list">
            {filtered.map(v => {
              const people = legacyContacts(v);
              return <button key={v.id} className={"vendor-record " + (selected?.id === v.id ? "vendor-record-active" : "")} onClick={() => { setSelectedId(v.id); setEditing(false); }}>
                <span className="vendor-avatar">{v.company.slice(0, 1).toUpperCase()}</span>
                <span className="vendor-record-copy"><strong>{v.company}</strong><small>{v.gstin || "GSTIN not entered"} · {people.length} contact(s)</small><small>{v.status === "Inactive" ? "Inactive" : "Active"}</small></span>
                <ArrowRight size={14}/>
              </button>;
            })}
            {!filtered.length && <div className="module-empty-state"><Users size={25}/><h3>{search ? "No matching vendor" : "No vendors added"}</h3><p>{search ? "Try another search term." : "Add your actual vendors. No placeholder vendor records are preloaded."}</p>{!search && <button className="button-primary" onClick={beginNew}><Plus size={14}/> Add first vendor</button>}</div>}
          </div>
        </section>

        <section className="surface-panel vendor-detail-panel">
          {editing ? <>
            <div className="panel-heading"><div><h3>{selectedId ? "Edit vendor" : "New vendor"}</h3><p>Only vendor registration details are stored here. Process costs remain on each component process operation.</p></div><button className="icon-control" onClick={resetEditor} aria-label="Close editor"><X size={14}/></button></div>
            <div className="vendor-master-form">
              <label>Vendor name *<input value={draft.company} onChange={e => setDraft({ ...draft, company: e.target.value })} placeholder="Enter vendor / subcontractor name"/></label>
              <label>GSTIN<input value={draft.gstin} onChange={e => setDraft({ ...draft, gstin: e.target.value.toUpperCase() })} placeholder="GST registration number"/></label>
              <label className="vendor-master-wide">Address<input value={draft.address} onChange={e => setDraft({ ...draft, address: e.target.value })} placeholder="Vendor address"/></label>
              <div className="vendor-contact-editor vendor-master-wide">
                <div className="vendor-section-heading"><div><strong>Contact persons</strong><small>Add more than one contact for this vendor.</small></div><button type="button" className="button-quiet compact-button" onClick={() => setDraft(current => ({ ...current, contacts: [...current.contacts, { id: makeId("vcontact"), name: "", role: "", phone: "", email: "" }] }))}><Plus size={13}/> Add contact</button></div>
                {draft.contacts.map((person, index) => <div className="vendor-contact-row" key={person.id}>
                  <label>Contact person {index + 1}<input value={person.name} onChange={e => updateContact(person.id, { name: e.target.value })} placeholder="Name"/></label>
                  <label>Role / department<input value={person.role} onChange={e => updateContact(person.id, { role: e.target.value })} placeholder="Optional"/></label>
                  <label>Phone<input value={person.phone} onChange={e => updateContact(person.id, { phone: e.target.value })} placeholder="Phone number"/></label>
                  <label>Email<input type="email" value={person.email} onChange={e => updateContact(person.id, { email: e.target.value })} placeholder="Email address"/></label>
                  <button type="button" className="vendor-row-remove" onClick={() => setDraft(current => ({ ...current, contacts: current.contacts.filter(c => c.id !== person.id) }))} aria-label={"Remove contact " + (index + 1)}><Trash2 size={14}/></button>
                </div>)}
              </div>
              <div className="vendor-document-editor vendor-master-wide">
                <div className="vendor-section-heading"><div><strong>Documents</strong><small>Add a document title and its secure file link or reference.</small></div><button type="button" className="button-quiet compact-button" onClick={() => setDraft(current => ({ ...current, documents: [...current.documents, { id: makeId("vdoc"), title: "", reference: "", notes: "" }] }))}><Plus size={13}/> Add document</button></div>
                {draft.documents.map((doc, index) => <div className="vendor-document-row" key={doc.id}>
                  <label>Document {index + 1}<input value={doc.title} onChange={e => updateDocument(doc.id, { title: e.target.value })} placeholder="Document name"/></label>
                  <label>File link / reference<input value={doc.reference} onChange={e => updateDocument(doc.id, { reference: e.target.value })} placeholder="Paste secure URL or document reference"/></label>
                  <label className="vendor-master-wide">Notes<input value={doc.notes} onChange={e => updateDocument(doc.id, { notes: e.target.value })} placeholder="Optional"/></label>
                  <button type="button" className="vendor-row-remove" onClick={() => setDraft(current => ({ ...current, documents: current.documents.filter(d => d.id !== doc.id) }))} aria-label={"Remove document " + (index + 1)}><Trash2 size={14}/></button>
                </div>)}
              </div>
              <label>Vendor status<select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as "Active" | "Inactive" })}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></label>
              <label>Verification note<input value={draft.verificationStatus} onChange={e => setDraft({ ...draft, verificationStatus: e.target.value })} placeholder="Optional review note"/></label>
              <label className="vendor-master-wide">Notes<input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Vendor-related notes"/></label>
              <div className="vendor-form-actions"><button className="button-primary" onClick={saveVendor}><Check size={14}/> Save vendor</button><button className="button-quiet" onClick={resetEditor}>Cancel</button></div>
            </div>
          </> : selected ? <>
            <div className="vendor-detail-title">
              <span className="vendor-avatar vendor-avatar-large">{selected.company.slice(0, 1).toUpperCase()}</span>
              <div><h3>{selected.company}</h3><p>{selected.gstin || "GSTIN not entered"} · {selected.address || "Address not entered"}</p><span className="record-state">{selected.status === "Inactive" ? "Inactive" : "Active"}</span></div>
              <button className="button-quiet" onClick={() => beginEdit(selected)}>Edit</button>
            </div>
            <div className="vendor-master-detail-section"><div className="vendor-section-heading"><div><strong>Contact persons</strong><small>{legacyContacts(selected).length} saved contact(s)</small></div></div>
              {legacyContacts(selected).length ? <div className="vendor-master-contact-list">{legacyContacts(selected).map(person => <div key={person.id}><strong>{person.name || "Contact name not entered"}</strong><span>{person.role || "Role not set"}</span><span>{person.phone || "Phone not entered"}</span><span>{person.email || "Email not entered"}</span></div>)}</div> : <p className="vendor-empty">No contact persons added.</p>}
            </div>
            <div className="vendor-master-detail-section"><div className="vendor-section-heading"><div><strong>Documents</strong><small>{(selected.documents || []).length} saved document reference(s)</small></div></div>
              {(selected.documents || []).length ? <div className="vendor-master-doc-list">{(selected.documents || []).map(doc => <div key={doc.id}><FileText size={16}/><span><strong>{doc.title || "Document"}</strong><small>{doc.notes || doc.reference || "No reference added"}</small></span>{doc.reference && /^https?:\\/\\//i.test(doc.reference) && <a href={doc.reference} target="_blank" rel="noreferrer"><Link2 size={13}/> Open</a>}</div>)}</div> : <p className="vendor-empty">No documents linked.</p>}
            </div>
            <div className="vendor-master-detail-section"><div className="vendor-section-heading"><div><strong>Notes</strong></div></div><p className="vendor-master-notes">{selected.notes || "No notes entered."}</p></div>
            {selected.verificationStatus && <div className="module-safety-note"><ShieldCheck size={14}/><span>Verification: {selected.verificationStatus}</span></div>}
            <div className="vendor-actions"><button className="button-quiet" onClick={() => toggleStatus(selected)}>{selected.status === "Inactive" ? "Activate vendor" : "Deactivate vendor"}</button><button className="button-quiet" onClick={() => archiveVendor(selected)}><X size={14}/> Archive</button></div>
            <div className="module-safety-note"><ShieldCheck size={14}/><span>This vendor ID is retained by historical process operations and quotations. Vendor costs are entered separately on each component's process chart.</span></div>
          </> : <div className="module-empty-state"><Users size={25}/><h3>Select or add a vendor</h3><p>Vendor records are shared across companies, purchase orders and components without copying the vendor master.</p><button className="button-primary" onClick={beginNew}><Plus size={14}/> Add vendor</button></div>}
        </section>
      </div>
    </section>
  );
}
