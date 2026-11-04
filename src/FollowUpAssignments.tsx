import { useEffect, useMemo, useState } from "react";
import { Plus, Users, X, Trash2, UserPlus, ContactRound, ShieldCheck } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type FollowUpAssignmentRecord } from "./manufacturingData";

type Props = {
  moduleId: string;
  moduleTitle: string;
  onNotice: (message: string) => void;
  onSelectModule: (id: string) => void;
};
type RecordOption = { id: string; label: string; detail: string };
type ContactOption = { id: string; name: string; detail: string; phone: string; email: string };

export default function FollowUpAssignmentsLauncher({ moduleId, moduleTitle, onNotice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const [open, setOpen] = useState(false);
  const [recordId, setRecordId] = useState("");
  const [contactId, setContactId] = useState("");

  const companies = activeRows(data.companies);
  const components = activeRows(data.components);
  const purchaseOrders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const profiles = activeRows(data.contactProfiles || []);
  const operations = activeRows(data.operations);
  const definitions = activeRows(data.processDefinitions);
  const plannedCosts = activeRows(data.plannedCosts);
  const materials = activeRows(data.materials);
  const bomLines = activeRows(data.bomLines);
  const quotations = activeRows(data.quotations);

  const allRecordOptions = useMemo<RecordOption[]>(() => [
    ...companies.map(row => ({ id: row.id, label: row.name, detail: "Company" })),
    ...components.map(row => ({ id: row.id, label: (row.partNumber ? row.partNumber + " · " : "") + row.name, detail: "Component" })),
    ...purchaseOrders.map(row => ({ id: row.id, label: row.number, detail: "Purchase order" })),
    ...vendors.map(row => ({ id: row.id, label: row.company, detail: "Vendor" })),
    ...profiles.map(row => ({ id: row.id, label: row.name, detail: row.linkedType === "company" ? "Company contact" : "Vendor contact" })),
    ...definitions.map(row => ({ id: row.id, label: row.processType + (row.category ? " · " + row.category : ""), detail: "Process definition" })),
    ...plannedCosts.map(row => ({ id: row.id, label: (row.componentNumber ? row.componentNumber + " · " : "") + row.componentName + " / " + row.processType, detail: "Planned cost" })),
    ...materials.map(row => ({ id: row.id, label: row.code + " · " + row.name, detail: "Material" })),
    ...bomLines.map(row => ({ id: row.id, label: (components.find(c => c.id === row.componentId)?.partNumber || "Component") + " · " + (materials.find(m => m.id === row.materialId)?.name || "BOM material"), detail: "BOM line" })),
    ...operations.map(row => ({ id: row.id, label: row.name + " · " + (purchaseOrders.find(po => po.id === row.poId)?.number || "PO") + " · " + (components.find(c => c.id === row.componentId)?.partNumber || "Component"), detail: "Process operation" })),
    ...quotations.map(row => ({ id: row.id, label: row.quoteReference || "Quotation " + row.id.slice(0, 8), detail: "Process quotation" }))
  ], [companies, components, purchaseOrders, vendors, profiles, definitions, plannedCosts, materials, bomLines, operations, quotations]);

  const recordOptions = useMemo<RecordOption[]>(() => {
    switch (moduleId) {
      case "companies": return allRecordOptions.filter(row => row.detail === "Company");
      case "components": return allRecordOptions.filter(row => row.detail === "Component");
      case "purchasing": return allRecordOptions.filter(row => row.detail === "Purchase order");
      case "vendors":
      case "vendor-capability": return allRecordOptions.filter(row => row.detail === "Vendor");
      case "contact360": return allRecordOptions.filter(row => row.detail === "Company contact" || row.detail === "Vendor contact");
      case "process-master": return allRecordOptions.filter(row => row.detail === "Process definition");
      case "planned-cost": return allRecordOptions.filter(row => row.detail === "Planned cost");
      case "inventory": return allRecordOptions.filter(row => row.detail === "Material" || row.detail === "BOM line");
      case "production":
      case "process-map": return allRecordOptions.filter(row => row.detail === "Purchase order" || row.detail === "Process operation");
      case "dispatch": return allRecordOptions.filter(row => row.detail === "Process operation" && operations.some(op => op.id === row.id && (op.transportVendorId || op.category === "Logistics")));
      case "quality":
      case "costing": return allRecordOptions.filter(row => row.detail === "Process operation" || (moduleId === "costing" && row.detail === "Process quotation"));
      case "communications": return allRecordOptions.filter(row => row.detail === "Company" || row.detail === "Vendor" || row.detail === "Company contact" || row.detail === "Vendor contact");
      default: return allRecordOptions;
    }
  }, [moduleId, allRecordOptions, operations]);

  const contactOptions = useMemo<ContactOption[]>(() => [
    ...companies.filter(row => Boolean(row.contactPerson?.trim() || row.phone || row.email)).map(row => ({
      id: "company:" + row.id, name: row.contactPerson?.trim() || row.name,
      detail: row.name + " · Company", phone: row.phone || "", email: row.email || ""
    })),
    ...vendors.map(row => ({
      id: "vendor:" + row.id, name: row.contact?.trim() || row.company,
      detail: row.company + " · Vendor", phone: row.whatsappNumber || row.phone || "", email: row.email || ""
    })),
    ...profiles.map(row => ({
      id: "profile:" + row.id, name: row.name,
      detail: (row.group ? row.group + " · " : "") + (row.linkedType === "company" ? "Company contact" : "Vendor contact"),
      phone: row.whatsapp || row.phone || (row.additionalPhones || [])[0] || "", email: row.email || ""
    }))
  ], [companies, vendors, profiles]);

  useEffect(() => {
    setRecordId("");
    setContactId("");
  }, [moduleId]);

  const selectedRecord = recordOptions.find(row => row.id === recordId);
  const assignments = activeRows(data.followUpAssignments || []).filter(row => row.moduleId === moduleId && row.recordId === (selectedRecord?.id || ""));
  const assignedContactIds = new Set(assignments.map(row => row.contactId));
  const availableContacts = contactOptions.filter(row => !assignedContactIds.has(row.id));

  const addContact = () => {
    const contact = contactOptions.find(row => row.id === contactId);
    if (!selectedRecord || !contact) {
      onNotice("Select a saved module record and a contact person first.");
      return;
    }
    if (assignments.some(row => row.contactId === contact.id)) {
      onNotice("This contact is already linked to the selected record.");
      return;
    }
    const stamp = nowIso();
    const assignment: FollowUpAssignmentRecord = {
      id: makeId("followup-link"), moduleId, recordId: selectedRecord.id, recordLabel: selectedRecord.label,
      contactId: contact.id, contactName: contact.name, contactPhone: contact.phone, contactEmail: contact.email,
      createdAt: stamp, updatedAt: stamp
    };
    update(current => ({ ...current, followUpAssignments: [...(current.followUpAssignments || []), assignment] }));
    setContactId("");
    onNotice(contact.name + " linked as a follow-up person to " + selectedRecord.label + ".");
  };

  const removeContact = (assignment: FollowUpAssignmentRecord) => {
    const stamp = nowIso();
    update(current => ({
      ...current,
      followUpAssignments: (current.followUpAssignments || []).map(row => row.id === assignment.id
        ? { ...row, deletedAt: stamp, updatedAt: stamp }
        : row)
    }));
    onNotice(assignment.contactName + " was unlinked from this record. The contact master and communication history were retained.");
  };

  return (
    <div className="ax-followup-assignment-dock">
      <button type="button" className="ax-followup-assignment-trigger" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="ax-followup-assignment-panel">
        {open ? <Users size={16}/> : <Plus size={17}/>}
        <span>Follow-up people</span>
        {assignments.length > 0 && <b>{assignments.length}</b>}
      </button>
      {open && <section id="ax-followup-assignment-panel" className="ax-followup-assignment-panel" role="dialog" aria-label={"Follow-up people for " + moduleTitle}>
        <header>
          <div><small>RECORD RELATIONSHIPS / {moduleTitle.toUpperCase()}</small><h3>Follow-up people</h3><p>Link multiple contact persons to the selected record.</p></div>
          <button type="button" className="ax-followup-close" onClick={() => setOpen(false)} aria-label="Close follow-up people"><X size={17}/></button>
        </header>
        <label className="ax-followup-field">Select {moduleTitle} record
          <select value={selectedRecord?.id || ""} onChange={event => setRecordId(event.target.value)}>
            <option value="">Choose a saved record</option>
            {recordOptions.map(row => <option key={row.id} value={row.id}>{row.label} · {row.detail}</option>)}
          </select>
        </label>
        {selectedRecord ? <>
          <div className="ax-followup-add-row">
            <label className="ax-followup-field">Add another contact person
              <select value={contactId} onChange={event => setContactId(event.target.value)}>
                <option value="">Select contact person</option>
                {availableContacts.map(row => <option key={row.id} value={row.id}>{row.name} · {row.detail}{row.phone ? " · " + row.phone : ""}</option>)}
              </select>
            </label>
            <button type="button" className="ax-followup-add-button" onClick={addContact} disabled={!contactId}><Plus size={16}/> Add</button>
          </div>
          <div className="ax-followup-assigned">
            <div className="ax-followup-assigned-heading"><strong>Linked people</strong><span>{assignments.length} CONTACT{assignments.length === 1 ? "" : "S"}</span></div>
            {assignments.length ? assignments.map(row => <article className="ax-followup-person" key={row.id}>
              <span className="ax-followup-person-icon"><ContactRound size={16}/></span>
              <span><strong>{row.contactName}</strong><small>{row.contactPhone || row.contactEmail || "Contact details not recorded"}</small></span>
              <button type="button" onClick={() => removeContact(row)} aria-label={"Unlink " + row.contactName}><Trash2 size={14}/></button>
            </article>) : <p className="ax-followup-empty">No follow-up person linked to this record yet. Add the first person above.</p>}
          </div>
        </> : <div className="ax-followup-empty">No saved records are available in this module yet. Create the master or operational record first.</div>}
        {!contactOptions.length && <div className="ax-followup-empty">No contact people are saved yet. Add people in Vendor Directory or Contact 360, then return here.</div>}
        <footer><span><ShieldCheck size={13}/> {syncStatus === "synced" ? "Saved to shared AXIMACH data" : "Saved on this device until shared server sync is configured"}</span><button type="button" onClick={() => onSelectModule("contact360")}><UserPlus size={13}/> Add contact in Contact 360</button></footer>
      </section>}
    </div>
  );
}
