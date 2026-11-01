import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Building2, CalendarClock, Check, ChevronDown, CircleDollarSign,
  ContactRound, Edit3, FolderPlus, Link2, MessageCircle, Plus, Search, ShieldCheck,
  Trash2, Users, X
} from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type Contact360ContactRecord, type Contact360FollowUpRecord,
  type Contact360FollowUpStatus, type Contact360GroupRecord,
  type Contact360GroupType, type VendorRecord
} from "./manufacturingData";

type Props = {
  initialVendorId?: string;
  initialContactId?: string;
  onInitialVendorApplied?: () => void;
  onInitialContactApplied?: () => void;
  onOpenVendor?: (vendorId: string) => void;
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  onSelectModule: (id: string) => void;
};

type ContactDraft = Omit<Contact360ContactRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type FollowDraft = Omit<Contact360FollowUpRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;

const emptyContactDraft = (): ContactDraft => ({
  accountName: "", contactName: "", role: "", phone: "", whatsappNumber: "",
  email: "", address: "", groupIds: [], linkedVendorId: "", syncToVendorMaster: false, notes: ""
});
const emptyFollowDraft = (contactId: string, groupId = ""): FollowDraft => ({
  contactId, groupId, description: "", moduleType: "customers", moduleReference: "",
  amount: 0, currency: "INR", promisedBackDate: "", nextFollowUpDate: "",
  status: "Open", owner: "", notes: ""
});
const groupTypes: Contact360GroupType[] = ["Client", "Vendor", "Project", "Lead", "Other"];
const followStatuses: Contact360FollowUpStatus[] = ["Open", "Waiting for reply", "Follow-up due", "Completed", "On hold"];
const linkedModules = [
  { id: "customers", label: "Customers / RFQ / Sales" },
  { id: "companies", label: "Companies" },
  { id: "purchasing", label: "Purchase Orders" },
  { id: "components", label: "Components / BOM" },
  { id: "production", label: "Production / Process Map" },
  { id: "vendors", label: "Vendors / Subcontracting" },
  { id: "costing", label: "Costing / Quotations" },
  { id: "inventory", label: "Material / Inventory" },
  { id: "quality", label: "Quality / Inspection" },
  { id: "dispatch", label: "Dispatch / Delivery" },
  { id: "communications", label: "Communication / WhatsApp" },
  { id: "invoices", label: "Invoices / Payments" },
  { id: "reports", label: "Reports / Analytics" },
  { id: "other", label: "Other / External" }
];
const dateLabel = (value: string) => value ? new Date(value + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const amountLabel = (value: number, currency: string) => value > 0
  ? new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(value)
  : "—";
const cleanPhone = (value: string) => value.replace(/[^\d+]/g, "");

function effectiveContact(contact: Contact360ContactRecord, vendors: VendorRecord[]) {
  const linkedVendor = contact.linkedVendorId ? vendors.find(vendor => vendor.id === contact.linkedVendorId && !vendor.deletedAt) : undefined;
  const primaryVendorContact = contact.syncToVendorMaster ? linkedVendor : undefined;
  return {
    accountName: linkedVendor?.company || contact.accountName,
    contactName: primaryVendorContact?.contact || contact.contactName,
    role: primaryVendorContact?.role || contact.role,
    phone: primaryVendorContact?.phone || contact.phone,
    whatsappNumber: primaryVendorContact?.whatsappNumber || contact.whatsappNumber,
    email: primaryVendorContact?.email || contact.email,
    address: primaryVendorContact?.address || contact.address,
    linkedVendor
  };
}

export default function Contact360Workspace({
  initialVendorId = "", initialContactId = "", onInitialVendorApplied, onInitialContactApplied, onOpenVendor, onBack, onNotice, notice, onSelectModule
}: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const contacts = activeRows(data.contact360Contacts);
  const groups = activeRows(data.contact360Groups);
  const followUps = activeRows(data.contact360FollowUps);
  const vendors = activeRows(data.vendors);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("");
  const [editingContactId, setEditingContactId] = useState("");
  const [contactDraft, setContactDraft] = useState<ContactDraft>(emptyContactDraft());
  const [followEditingId, setFollowEditingId] = useState("");
  const [followDraft, setFollowDraft] = useState<FollowDraft>(emptyFollowDraft(""));
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState<Contact360GroupType>("Client");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [groupEditId, setGroupEditId] = useState("");
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditType, setGroupEditType] = useState<Contact360GroupType>("Client");

  useEffect(() => {
    if (initialContactId) {
      const existingContact = contacts.find(contact => contact.id === initialContactId);
      if (existingContact) { setSelectedId(existingContact.id); setEditingContactId(""); setFollowEditingId(""); }
      onInitialContactApplied?.();
      return;
    }
    if (!initialVendorId) return;
    const existing = contacts.find(contact => contact.linkedVendorId === initialVendorId);
    if (existing) {
      setSelectedId(existing.id);
      setEditingContactId("");
    } else {
      const vendor = vendors.find(item => item.id === initialVendorId);
      if (vendor) {
        setSelectedId("");
        setEditingContactId("new");
        setContactDraft({
          accountName: vendor.company, contactName: vendor.contact, role: vendor.role,
          phone: vendor.phone, whatsappNumber: vendor.whatsappNumber, email: vendor.email,
          address: vendor.address, groupIds: [], linkedVendorId: vendor.id,
          syncToVendorMaster: true,
          notes: "Linked from AXIMACH Vendor Master. The primary contact fields stay synchronised with that vendor record."
        });
        onNotice("Create a Contact 360 profile linked to " + vendor.company + ". The primary contact can stay synchronised with Vendor Master.");
      }
    }
    onInitialVendorApplied?.();
  }, [initialVendorId, initialContactId]);

  const selected = editingContactId === "new" ? undefined
    : contacts.find(contact => contact.id === selectedId) || contacts[0];
  const selectedDetails = selected ? effectiveContact(selected, vendors) : undefined;
  const visibleContacts = useMemo(() => contacts.filter(contact => {
    const details = effectiveContact(contact, vendors);
    const text = [
      details.accountName, details.contactName, details.role, details.phone,
      details.whatsappNumber, details.email, details.address, contact.notes,
      contact.groupIds.map(id => groups.find(group => group.id === id)?.name || "").join(" ")
    ].join(" ").toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase().trim());
    const matchesGroup = groupFilter === "all" || contact.groupIds.includes(groupFilter);
    return matchesSearch && matchesGroup;
  }).sort((a, b) => {
    const aa = effectiveContact(a, vendors).accountName.toLowerCase();
    const bb = effectiveContact(b, vendors).accountName.toLowerCase();
    return aa.localeCompare(bb) || effectiveContact(a, vendors).contactName.localeCompare(effectiveContact(b, vendors).contactName);
  }), [contacts, vendors, groups, search, groupFilter]);

  const selectedFollowUps = selected ? followUps
    .filter(row => row.contactId === selected.id)
    .sort((a, b) => {
      const ad = a.nextFollowUpDate || a.promisedBackDate || "9999-12-31";
      const bd = b.nextFollowUpDate || b.promisedBackDate || "9999-12-31";
      return ad.localeCompare(bd);
    }) : [];
  const openFollowUps = followUps.filter(row => row.status !== "Completed").length;
  const dueFollowUps = followUps.filter(row => row.status !== "Completed" && row.nextFollowUpDate && row.nextFollowUpDate <= new Date().toISOString().slice(0, 10)).length;
  const uniqueAccounts = new Set(contacts.map(contact => effectiveContact(contact, vendors).accountName.trim().toLowerCase()).filter(Boolean)).size;

  const beginNewContact = () => {
    setSelectedId("");
    setEditingContactId("new");
    setContactDraft(emptyContactDraft());
    setFollowEditingId("");
  };
  const beginEditContact = (contact: Contact360ContactRecord) => {
    const details = effectiveContact(contact, vendors);
    setSelectedId(contact.id);
    setEditingContactId(contact.id);
    setContactDraft({
      accountName: details.accountName, contactName: details.contactName, role: details.role,
      phone: details.phone, whatsappNumber: details.whatsappNumber, email: details.email,
      address: details.address, groupIds: [...contact.groupIds],
      linkedVendorId: contact.linkedVendorId, syncToVendorMaster: contact.syncToVendorMaster,
      notes: contact.notes
    });
  };
  const saveContact = () => {
    if (!contactDraft.accountName.trim() || !contactDraft.contactName.trim()) {
      onNotice("Client / account and contact person are required."); return;
    }
    const linkedVendor = vendors.find(vendor => vendor.id === contactDraft.linkedVendorId);
    if (contactDraft.syncToVendorMaster && !linkedVendor) {
      onNotice("Choose a valid Vendor Master record before enabling vendor synchronisation."); return;
    }
    const id = editingContactId === "new" ? makeId("contact360") : editingContactId;
    const stamp = nowIso();
    const competingPrimary = contactDraft.syncToVendorMaster && contacts.some(contact =>
      contact.id !== id && contact.linkedVendorId === contactDraft.linkedVendorId && contact.syncToVendorMaster
    );
    if (competingPrimary) {
      onNotice("That vendor already has a primary Contact 360 profile. Edit the existing primary profile or save this person as an additional contact without Vendor Master synchronisation.");
      return;
    }
    const record: Contact360ContactRecord = {
      ...contactDraft, id,
      accountName: contactDraft.accountName.trim(), contactName: contactDraft.contactName.trim(),
      phone: cleanPhone(contactDraft.phone), whatsappNumber: cleanPhone(contactDraft.whatsappNumber),
      groupIds: [...new Set(contactDraft.groupIds.filter(groupId => groups.some(group => group.id === groupId)))],
      createdAt: contacts.find(contact => contact.id === id)?.createdAt || stamp,
      updatedAt: stamp, deletedAt: undefined
    };
    update(current => {
      const vendorsNext = record.syncToVendorMaster
        ? current.vendors.map(vendor => vendor.id === record.linkedVendorId ? {
            ...vendor, company: record.accountName, contact: record.contactName, role: record.role,
            phone: record.phone, whatsappNumber: record.whatsappNumber || record.phone,
            email: record.email, address: record.address, updatedAt: stamp
          } : vendor)
        : current.vendors;
      return {
        ...current,
        contact360Contacts: [...current.contact360Contacts.filter(contact => contact.id !== id), record],
        vendors: vendorsNext
      };
    });
    setSelectedId(id);
    setEditingContactId("");
    onNotice(record.syncToVendorMaster
      ? "Contact 360 saved. The linked primary contact fields were synchronised to Vendor Master using the same stable vendor ID."
      : "Contact 360 profile saved to AXIMACH shared manufacturing data.");
  };
  const archiveContact = (contact: Contact360ContactRecord) => {
    if (!window.confirm("Archive this contact profile? Its follow-up history and group links will be retained.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      contact360Contacts: current.contact360Contacts.map(row => row.id === contact.id ? { ...row, deletedAt: stamp, updatedAt: stamp } : row)
    }));
    setSelectedId("");
    setEditingContactId("");
    setFollowEditingId("");
    onNotice("Contact archived. Its follow-up history is retained for audit and can be restored by an administrator through the saved record.");
  };
  const beginNewFollowUp = () => {
    if (!selected) return;
    setFollowEditingId("new");
    setFollowDraft(emptyFollowDraft(selected.id, selected.groupIds[0] || ""));
  };
  const beginEditFollowUp = (row: Contact360FollowUpRecord) => {
    setFollowEditingId(row.id);
    setFollowDraft({
      contactId: row.contactId, groupId: row.groupId, description: row.description,
      moduleType: row.moduleType, moduleReference: row.moduleReference,
      amount: row.amount, currency: row.currency, promisedBackDate: row.promisedBackDate,
      nextFollowUpDate: row.nextFollowUpDate, status: row.status, owner: row.owner, notes: row.notes
    });
  };
  const saveFollowUp = () => {
    if (!selected || !followDraft.description.trim()) {
      onNotice("A follow-up description is required."); return;
    }
    const id = followEditingId === "new" ? makeId("contact360-followup") : followEditingId;
    const stamp = nowIso();
    const old = followUps.find(row => row.id === id);
    const record: Contact360FollowUpRecord = {
      ...followDraft, contactId: selected.id, id,
      description: followDraft.description.trim(),
      amount: Number.isFinite(Number(followDraft.amount)) ? Math.max(0, Number(followDraft.amount)) : 0,
      groupId: selected.groupIds.includes(followDraft.groupId) ? followDraft.groupId : "",
      createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined
    };
    update(current => ({
      ...current,
      contact360FollowUps: [...current.contact360FollowUps.filter(row => row.id !== id), record]
    }));
    setFollowEditingId("");
    onNotice("Follow-up saved. The same linked record is now shown in this Contact 360 register and will remain attached to the contact ID.");
  };
  const archiveFollowUp = (row: Contact360FollowUpRecord) => {
    if (!window.confirm("Archive this follow-up row? The contact and its history will remain.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      contact360FollowUps: current.contact360FollowUps.map(item => item.id === row.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item)
    }));
    if (followEditingId === row.id) setFollowEditingId("");
    onNotice("Follow-up row archived; the contact history remains intact.");
  };
  const addGroup = () => {
    if (!newGroupName.trim()) { onNotice("Enter a group name first."); return; }
    if (groups.some(group => group.name.toLowerCase() === newGroupName.trim().toLowerCase() && group.type === newGroupType)) {
      onNotice("A group with that name and type already exists."); return;
    }
    const stamp = nowIso();
    const group: Contact360GroupRecord = {
      id: makeId("contact360-group"), name: newGroupName.trim(), type: newGroupType,
      description: newGroupDescription.trim(), createdAt: stamp, updatedAt: stamp
    };
    update(current => ({ ...current, contact360Groups: [...current.contact360Groups, group] }));
    setNewGroupName(""); setNewGroupDescription("");
    onNotice("Contact group created. Assign it to as many contacts as required.");
  };
  const beginEditGroup = (group: Contact360GroupRecord) => {
    setGroupEditId(group.id); setGroupEditName(group.name); setGroupEditType(group.type);
  };
  const saveGroup = () => {
    if (!groupEditName.trim()) { onNotice("Group name cannot be empty."); return; }
    const stamp = nowIso();
    update(current => ({
      ...current,
      contact360Groups: current.contact360Groups.map(group => group.id === groupEditId
        ? { ...group, name: groupEditName.trim(), type: groupEditType, updatedAt: stamp } : group)
    }));
    setGroupEditId("");
    onNotice("Contact group updated; all linked contact memberships keep the same group ID.");
  };
  const archiveGroup = (group: Contact360GroupRecord) => {
    const linkedContacts = contacts.filter(contact => contact.groupIds.includes(group.id)).length;
    if (!window.confirm("Archive this group? It is assigned to " + linkedContacts + " contact(s). Their contact profiles and follow-up records will be retained.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      contact360Groups: current.contact360Groups.map(item => item.id === group.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item),
      contact360Contacts: current.contact360Contacts.map(contact => contact.groupIds.includes(group.id)
        ? { ...contact, groupIds: contact.groupIds.filter(id => id !== group.id), updatedAt: stamp } : contact),
      contact360FollowUps: current.contact360FollowUps.map(row => row.groupId === group.id ? { ...row, groupId: "", updatedAt: stamp } : row)
    }));
    if (groupEditId === group.id) setGroupEditId("");
    onNotice("Group archived; active contact and follow-up records were safely detached from that group.");
  };
  const groupNames = (ids: string[]) => ids.map(id => groups.find(group => group.id === id)?.name).filter(Boolean);
  const openLinkedModule = (row: Contact360FollowUpRecord) => {
    const found = linkedModules.find(module => module.id === row.moduleType);
    const navigable = new Set(["companies","purchasing","components","vendors","inventory","production","dispatch","quality","costing","communications","reports"]);
    if (found && navigable.has(found.id)) onSelectModule(found.id);
    else onNotice("Reference " + (row.moduleReference || "not supplied") + " is saved and linked to " + (found?.label || "an external workspace") + ". That destination is not yet an active AXIMACH workspace; open it from the module explorer when available.");
  };

  const contactForm = (newMode: boolean) => (
    <section className="surface-panel c360-editor">
      <div className="panel-heading">
        <div><h3>{newMode ? "New Contact 360 profile" : "Edit contact profile"}</h3><p>One client can have multiple people, roles, groups and linked follow-up records.</p></div>
        <button className="icon-control" onClick={() => setEditingContactId("")} aria-label="Close contact editor"><X size={15}/></button>
      </div>
      <div className="c360-form-grid">
        <label>Client / account name *<input value={contactDraft.accountName} onChange={event => setContactDraft(current => ({ ...current, accountName: event.target.value }))} placeholder="Client, supplier or organisation name"/></label>
        <label>Contact person *<input value={contactDraft.contactName} onChange={event => setContactDraft(current => ({ ...current, contactName: event.target.value }))} placeholder="Person's full name"/></label>
        <label>Role / department<input value={contactDraft.role} onChange={event => setContactDraft(current => ({ ...current, role: event.target.value }))} placeholder="Owner, purchase, accounts, production…"/></label>
        <label>Phone<input value={contactDraft.phone} onChange={event => setContactDraft(current => ({ ...current, phone: event.target.value }))} placeholder="+91…"/></label>
        <label>WhatsApp<input value={contactDraft.whatsappNumber} onChange={event => setContactDraft(current => ({ ...current, whatsappNumber: event.target.value }))} placeholder="Leave blank to use phone"/></label>
        <label>Email<input type="email" value={contactDraft.email} onChange={event => setContactDraft(current => ({ ...current, email: event.target.value }))} placeholder="name@company.com"/></label>
        <label className="c360-wide">Address / location<input value={contactDraft.address} onChange={event => setContactDraft(current => ({ ...current, address: event.target.value }))} placeholder="Optional contact or branch location"/></label>
        <label className="c360-wide">Link to Vendor Master
          <select value={contactDraft.linkedVendorId} onChange={event => {
            const vendor = vendors.find(item => item.id === event.target.value);
            setContactDraft(current => ({
              ...current, linkedVendorId: event.target.value, syncToVendorMaster: Boolean(vendor),
              accountName: vendor?.company || current.accountName, contactName: vendor?.contact || current.contactName,
              role: vendor?.role || current.role, phone: vendor?.phone || current.phone,
              whatsappNumber: vendor?.whatsappNumber || current.whatsappNumber,
              email: vendor?.email || current.email, address: vendor?.address || current.address
            }));
          }}>
            <option value="">No direct Vendor Master link</option>
            {vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.company} · {vendor.contact}</option>)}
          </select>
          <small>Use the same stable vendor ID when this is a supplier contact. Additional people can link to the vendor without becoming its primary contact.</small>
        </label>
        {contactDraft.linkedVendorId && <label className="c360-sync-toggle"><input type="checkbox" checked={contactDraft.syncToVendorMaster} onChange={event => setContactDraft(current => ({ ...current, syncToVendorMaster: event.target.checked }))}/> This is the primary vendor contact — edits synchronise to Vendor Master.</label>}
        <div className="c360-group-assignment c360-wide">
          <div><strong>Contact groups</strong><small>A person can belong to multiple client, project, lead or vendor follow-up groups.</small></div>
          <div className="c360-group-checks">{groups.map(group => <label key={group.id}><input type="checkbox" checked={contactDraft.groupIds.includes(group.id)} onChange={event => setContactDraft(current => ({ ...current, groupIds: event.target.checked ? [...new Set([...current.groupIds, group.id])] : current.groupIds.filter(id => id !== group.id) }))}/><span>{group.name}</span><em>{group.type}</em></label>)}</div>
          {!groups.length && <div className="c360-inline-empty">Create a group in Group manager, then assign this contact to it.</div>}
        </div>
        <label className="c360-wide">Notes<textarea rows={3} value={contactDraft.notes} onChange={event => setContactDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Relationship context, preferences, meeting notes…"/></label>
        <div className="c360-form-actions c360-wide"><button className="button-primary" onClick={saveContact}><Check size={14}/> Save contact profile</button><button className="button-quiet" onClick={() => setEditingContactId("")}>Cancel</button></div>
      </div>
    </section>
  );

  const followForm = (newMode: boolean) => (
    <section className="surface-panel c360-editor c360-follow-editor">
      <div className="panel-heading">
        <div><h3>{newMode ? "Add follow-up item" : "Edit follow-up item"}</h3><p>Track each promise, commercial item or action separately. The promised-return date is not the same as your next follow-up date.</p></div>
        <button className="icon-control" onClick={() => setFollowEditingId("")} aria-label="Close follow-up editor"><X size={15}/></button>
      </div>
      <div className="c360-form-grid">
        <label className="c360-wide">Description / what needs follow-up *<input value={followDraft.description} onChange={event => setFollowDraft(current => ({ ...current, description: event.target.value }))} placeholder="Quotation requested, revised drawing, order confirmation…"/></label>
        <label>Linked AXIMACH module<select value={followDraft.moduleType} onChange={event => setFollowDraft(current => ({ ...current, moduleType: event.target.value }))}>{linkedModules.map(module => <option key={module.id} value={module.id}>{module.label}</option>)}</select></label>
        <label>Record reference<input value={followDraft.moduleReference} onChange={event => setFollowDraft(current => ({ ...current, moduleReference: event.target.value }))} placeholder="RFQ / PO / quote / job reference"/></label>
        <label>Amount<input type="number" min="0" step="0.01" value={followDraft.amount || ""} onChange={event => setFollowDraft(current => ({ ...current, amount: Number(event.target.value || 0) }))} placeholder="0.00"/></label>
        <label>Currency<select value={followDraft.currency} onChange={event => setFollowDraft(current => ({ ...current, currency: event.target.value }))}><option value="INR">INR ₹</option><option value="USD">USD $</option><option value="EUR">EUR €</option><option value="GBP">GBP £</option><option value="PLN">PLN zł</option></select></label>
        <label>They said they'll reach back on<input type="date" value={followDraft.promisedBackDate} onChange={event => setFollowDraft(current => ({ ...current, promisedBackDate: event.target.value }))}/></label>
        <label>Your next follow-up date<input type="date" value={followDraft.nextFollowUpDate} onChange={event => setFollowDraft(current => ({ ...current, nextFollowUpDate: event.target.value }))}/></label>
        <label>Status<select value={followDraft.status} onChange={event => setFollowDraft(current => ({ ...current, status: event.target.value as Contact360FollowUpStatus }))}>{followStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
        <label>Assigned owner<input value={followDraft.owner} onChange={event => setFollowDraft(current => ({ ...current, owner: event.target.value }))} placeholder="Person responsible"/></label>
        <label>Group<select value={followDraft.groupId} onChange={event => setFollowDraft(current => ({ ...current, groupId: event.target.value }))}><option value="">No group</option>{groups.filter(group => selected?.groupIds.includes(group.id)).map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <label className="c360-wide">Notes / last conversation<textarea rows={2} value={followDraft.notes} onChange={event => setFollowDraft(current => ({ ...current, notes: event.target.value }))} placeholder="What was discussed, who promised what, and any next action…"/></label>
        <div className="c360-form-actions c360-wide"><button className="button-primary" onClick={saveFollowUp}><Check size={14}/> Save follow-up</button><button className="button-quiet" onClick={() => setFollowEditingId("")}>Cancel</button></div>
      </div>
    </section>
  );

  return <section className="workspace-page contact360-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowUpRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL DATA · SERVER OPTIONAL"}</span></div>
    <div className="workspace-title-row">
      <div><div className="eyebrow"><span className="eyebrow-mark"/> RELATIONSHIP INTELLIGENCE / CONTACT 360</div><h1>Contact 360<span>.</span></h1><p>One account, many people, multiple groups and every promised follow-up in one editable relationship register.</p></div>
      <div className="workspace-title-actions"><button className="button-quiet" onClick={() => setGroupManagerOpen(value => !value)}><FolderPlus size={15}/> Group manager</button><button className="button-primary" onClick={beginNewContact}><Plus size={15}/> Add contact</button></div>
    </div>
    <div className="c360-metrics">
      <div><small>ACCOUNTS / CLIENTS</small><strong>{uniqueAccounts}</strong><span>Multiple people can sit under one account</span></div>
      <div><small>PEOPLE / CONTACTS</small><strong>{contacts.length}</strong><span>Stable Contact 360 IDs</span></div>
      <div><small>OPEN FOLLOW-UPS</small><strong>{openFollowUps}</strong><span>Across all contact profiles</span></div>
      <div><small>DUE / OVERDUE</small><strong>{dueFollowUps}</strong><span>Based on your next follow-up date</span></div>
    </div>

    {groupManagerOpen && <section className="surface-panel c360-group-manager">
      <div className="panel-heading"><div><h3>Contact group manager</h3><p>Create named groups and reuse them across multiple people and follow-up items.</p></div><span className="module-number">{groups.length} GROUPS</span></div>
      <div className="c360-group-create">
        <label>Group name<input value={newGroupName} onChange={event => setNewGroupName(event.target.value)} placeholder="e.g. North region clients, Pending quotations…"/></label>
        <label>Group type<select value={newGroupType} onChange={event => setNewGroupType(event.target.value as Contact360GroupType)}>{groupTypes.map(type => <option key={type}>{type}</option>)}</select></label>
        <label>Purpose / description<input value={newGroupDescription} onChange={event => setNewGroupDescription(event.target.value)} placeholder="What is this list used for?"/></label>
        <button className="button-primary" onClick={addGroup}><Plus size={14}/> Create group</button>
      </div>
      {groups.length ? <div className="c360-group-list">{groups.map(group => <div key={group.id}>
        {groupEditId === group.id ? <><input value={groupEditName} onChange={event => setGroupEditName(event.target.value)}/><select value={groupEditType} onChange={event => setGroupEditType(event.target.value as Contact360GroupType)}>{groupTypes.map(type => <option key={type}>{type}</option>)}</select><button className="button-primary compact-button" onClick={saveGroup}><Check size={12}/> Save</button><button className="button-quiet compact-button" onClick={() => setGroupEditId("")}>Cancel</button></>
        : <><span><strong>{group.name}</strong><small>{group.type} · {contacts.filter(contact => contact.groupIds.includes(group.id)).length} contacts</small></span><button className="button-quiet compact-button" onClick={() => beginEditGroup(group)}><Edit3 size={12}/> Edit</button><button className="button-quiet compact-button" onClick={() => archiveGroup(group)}><Trash2 size={12}/> Archive</button></>}
      </div>)}</div> : <div className="c360-inline-empty">No groups have been created. Add groups for clients, projects, regions, leads or follow-up lists.</div>}
    </section>}

    <div className="c360-workspace-grid">
      <section className="surface-panel c360-directory">
        <div className="panel-heading"><div><h3>Contact directory</h3><p>Grouped by account · each person has a separate history.</p></div><span className="module-number">{visibleContacts.length} PEOPLE</span></div>
        <label className="module-record-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search account, person, role, phone or group…"/></label>
        <label className="c360-filter"><span>Filter by group</span><select value={groupFilter} onChange={event => setGroupFilter(event.target.value)}><option value="all">All groups</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
        <div className="c360-contact-list">
          {visibleContacts.map(contact => {
            const details = effectiveContact(contact, vendors);
            const count = followUps.filter(row => row.contactId === contact.id).length;
            return <button key={contact.id} className={"c360-contact-item " + (selected?.id === contact.id && editingContactId !== "new" ? "active" : "")} onClick={() => { setSelectedId(contact.id); setEditingContactId(""); setFollowEditingId(""); }}>
              <span className="c360-contact-avatar">{details.contactName.slice(0,1).toUpperCase() || "?"}</span>
              <span className="c360-contact-copy"><strong>{details.contactName}</strong><small>{details.accountName}</small><small>{details.role || "Role not set"} · {count} follow-up{count === 1 ? "" : "s"}</small><span>{groupNames(contact.groupIds).slice(0,3).map(name => <em key={name}>{name}</em>)}</span></span>
              <ArrowUpRight size={14}/>
            </button>;
          })}
          {!visibleContacts.length && <div className="module-empty-state"><ContactRound size={25}/><h3>{contacts.length ? "No matching contacts" : "Your Contact 360 starts here"}</h3><p>{contacts.length ? "Try a different search or group." : "Add a client account and its first contact. You can then add more people, roles, groups and follow-up items."}</p>{!contacts.length && <button className="button-primary" onClick={beginNewContact}><Plus size={14}/> Add first contact</button>}</div>}
        </div>
      </section>

      <div className="c360-detail-column">
        {editingContactId && contactForm(editingContactId === "new")}
        {!editingContactId && selected && selectedDetails && <>
          <section className="surface-panel c360-profile-panel">
            <div className="c360-profile-head"><span className="c360-profile-avatar">{selectedDetails.contactName.slice(0,1).toUpperCase() || "?"}</span><div><div className="eyebrow">CONTACT PROFILE</div><h2>{selectedDetails.contactName}</h2><p>{selectedDetails.accountName} · {selectedDetails.role || "Role not set"}</p></div><div className="c360-profile-actions"><button className="button-quiet compact-button" onClick={() => beginEditContact(selected)}><Edit3 size={13}/> Edit</button><button className="button-quiet compact-button" onClick={() => archiveContact(selected)}><Trash2 size={13}/> Archive</button></div></div>
            <div className="c360-profile-facts">
              <div><small>PHONE</small><strong>{selectedDetails.phone || "Not added"}</strong></div>
              <div><small>WHATSAPP</small><strong>{selectedDetails.whatsappNumber || selectedDetails.phone || "Not linked"}</strong></div>
              <div><small>EMAIL</small><strong>{selectedDetails.email || "Not added"}</strong></div>
              <div><small>ADDRESS</small><strong>{selectedDetails.address || "Not added"}</strong></div>
            </div>
            <div className="c360-profile-links">
              <div><small>GROUP MEMBERSHIPS</small><span>{groupNames(selected.groupIds).length ? groupNames(selected.groupIds).map(name => <em key={name}>{name}</em>) : <i>No groups assigned</i>}</span></div>
              <div><small>LINKED MASTER</small>{selected.syncToVendorMaster && selectedDetails.linkedVendor ? <strong><Link2 size={13}/> Vendor Master · {selectedDetails.linkedVendor.company}</strong> : <span>{selected.linkedVendorId ? "Vendor linked · additional contact profile" : "Standalone Contact 360 record"}</span>}</div>
              {selected.linkedVendorId && onOpenVendor && <button className="button-quiet compact-button" onClick={() => onOpenVendor(selected.linkedVendorId)}><Building2 size={13}/> Open Vendor Master</button>}
              {selectedDetails.phone && <button className="button-quiet compact-button" onClick={() => window.open("https://wa.me/" + (selectedDetails.whatsappNumber || selectedDetails.phone).replace(/\D/g, ""), "_blank", "noopener,noreferrer")}><MessageCircle size={13}/> WhatsApp</button>}
            </div>
            {selected.notes && <div className="c360-notes"><small>RELATIONSHIP NOTES</small><p>{selected.notes}</p></div>}
          </section>
          <section className="surface-panel c360-follow-panel">
            <div className="panel-heading"><div><h3>Follow-up register</h3><p>Every independent request, commercial value and promised response stays as its own editable row.</p></div><button className="button-primary compact-button" onClick={beginNewFollowUp}><Plus size={13}/> Add follow-up</button></div>
            {followEditingId && followForm(followEditingId === "new")}
            <div className="c360-table-wrap"><table className="c360-table">
              <thead><tr><th>Description</th><th>Module / reference</th><th>Amount</th><th>They'll reach back</th><th>Next follow-up</th><th>Group / status</th><th>Actions</th></tr></thead>
              <tbody>
                {selectedFollowUps.map(row => <tr key={row.id} className={row.status === "Completed" ? "c360-row-complete" : ""}>
                  <td><strong>{row.description}</strong><small>{row.owner ? "Owner: " + row.owner : row.notes || "No extra notes"}</small></td>
                  <td><span>{linkedModules.find(module => module.id === row.moduleType)?.label || row.moduleType}</span><small>{row.moduleReference || "Reference not entered"}</small></td>
                  <td className="c360-amount">{amountLabel(row.amount, row.currency)}</td>
                  <td>{dateLabel(row.promisedBackDate)}</td>
                  <td>{dateLabel(row.nextFollowUpDate)}</td>
                  <td><span className="c360-status" data-status={row.status}>{row.status}</span><small>{groups.find(group => group.id === row.groupId)?.name || "No group"}</small></td>
                  <td><div className="c360-row-actions"><button className="icon-control" title="Edit follow-up" onClick={() => beginEditFollowUp(row)}><Edit3 size={13}/></button><button className="icon-control" title="Open linked module" onClick={() => openLinkedModule(row)}><ArrowUpRight size={13}/></button><button className="icon-control" title="Archive follow-up" onClick={() => archiveFollowUp(row)}><Trash2 size={13}/></button></div></td>
                </tr>)}
                {!selectedFollowUps.length && <tr><td colSpan={7}><div className="c360-table-empty"><CalendarClock size={22}/><strong>No follow-up items for this person</strong><span>Add separate rows for every quote, request, promised response, amount or action.</span></div></td></tr>}
              </tbody>
            </table></div>
            <div className="c360-table-foot"><span>{selectedFollowUps.length} linked item{selectedFollowUps.length === 1 ? "" : "s"} · Stable contact ID {selected.id.slice(0,18)}</span><span>Edits are saved to the central Contact 360 data store.</span></div>
          </section>
        </>}
        {!editingContactId && !selected && <section className="surface-panel c360-empty-detail"><ContactRound size={34}/><h3>Select a person or create a new profile</h3><p>One account can have multiple contacts with separate roles, group memberships and independent follow-up registers.</p><button className="button-primary" onClick={beginNewContact}><Plus size={14}/> Add contact profile</button></section>}
      </div>
    </div>
    <div className="module-safety-note"><ShieldCheck size={14}/><span>Contact profiles and follow-up rows use stable IDs in the shared AXIMACH manufacturing data model. A primary vendor-linked contact synchronises its core details to Vendor Master; additional people remain separate profiles. Server-wide visibility requires the existing persistent AXIMACH data server to be configured.</span></div>
  </section>;
}
