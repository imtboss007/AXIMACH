import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Cpu, FileText, Plus, Search, ShieldCheck, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type VendorCapabilityRecord, type VendorCapabilityStatus } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void; initialVendorId?: string; onInitialVendorApplied?: () => void; onOpenVendor: (vendorId: string) => void };
type Draft = Omit<VendorCapabilityRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
const blankDraft = (): Draft => ({
  vendorId: "", processDefinitionId: "", machineModel: "", envelopeX: 0, envelopeY: 0, envelopeZ: 0,
  materialRange: "", toleranceCapability: "", capacityPerMonth: 0, certificationScope: "",
  evidenceDocumentIds: [], status: "Unverified", validFrom: "", validUntil: "", assessedBy: "", assessedAt: "", notes: ""
});
const statuses: VendorCapabilityStatus[] = ["Unverified", "Evidence requested", "Under evaluation", "Approved", "Expired", "Rejected"];
const moneyless = (value: number) => Number(value || 0).toLocaleString("en-IN");

export default function VendorCapabilityWorkspace({ onBack, onNotice, notice, onSelectModule, initialVendorId = "", onInitialVendorApplied, onOpenVendor }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const allVendors = data.vendors;
  const vendors = activeRows(data.vendors);
  const allProcessDefinitions = data.processDefinitions;
  const processes = activeRows(data.processDefinitions).filter(row => row.status !== "Retired");
  const capabilities = activeRows(data.vendorCapabilities);
  const operations = activeRows(data.operations);
  const [search, setSearch] = useState("");
  const [vendorFilterId, setVendorFilterId] = useState(initialVendorId);
  useEffect(() => { if (initialVendorId) onInitialVendorApplied?.(); }, []);
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => capabilities.filter(cap => {
    const vendor = allVendors.find(row => row.id === cap.vendorId);
    const process = allProcessDefinitions.find(row => row.id === cap.processDefinitionId);
    return (!vendorFilterId || cap.vendorId === vendorFilterId) &&
      [vendor?.company, process?.name, process?.code, cap.machineModel, cap.materialRange, cap.toleranceCapability, cap.certificationScope, cap.status]
        .join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }), [capabilities, vendors, processes, search, vendorFilterId]);
  const selectedVendor = allVendors.find(row => row.id === draft.vendorId);
  const evidenceOptions = selectedVendor?.documents || [];
  const editingCapability = capabilities.find(row => row.id === editingId);
  const draftVendor = allVendors.find(row => row.id === draft.vendorId);
  const vendorPickerOptions = [...vendors, ...(draftVendor && !vendors.some(row => row.id === draftVendor.id) ? [draftVendor] : [])]
    .map(v => ({ id:v.id, label:v.company + (v.gstin ? " · " + v.gstin : "") + (v.deletedAt ? " · Archived" : !vendors.some(row => row.id === v.id) ? " · Inactive" : "") }));
  const draftProcess = allProcessDefinitions.find(row => row.id === draft.processDefinitionId);
  const processPickerRows = [...processes, ...(draftProcess && !processes.some(row => row.id === draftProcess.id) ? [draftProcess] : [])];
  const processPickerOptions = processPickerRows.map(p => ({
    id:p.id, label:(p.code ? p.code + " · " : "") + p.name + (p.revision ? " · Rev " + p.revision : "") +
      (p.deletedAt ? " · Archived" : p.status === "Retired" ? " · Retired" : "")
  }));
  const reset = () => { setShowForm(false); setEditingId(""); setDraft(blankDraft()); };
  const startNew = () => { setDraft(blankDraft()); setEditingId(""); setShowForm(true); };
  const edit = (row: VendorCapabilityRecord) => {
    const { id, createdAt, updatedAt, deletedAt, ...form } = row;
    setEditingId(id); setDraft({ ...form, evidenceDocumentIds: form.evidenceDocumentIds || [] }); setShowForm(true);
  };
  const chooseVendor = (vendorId: string) => setDraft(current => ({
    ...current, vendorId,
    evidenceDocumentIds: vendorId === current.vendorId ? current.evidenceDocumentIds : []
  }));
  const toggleEvidence = (documentId: string, checked: boolean) => setDraft(current => ({
    ...current,
    evidenceDocumentIds: checked
      ? [...new Set([...current.evidenceDocumentIds, documentId])]
      : current.evidenceDocumentIds.filter(id => id !== documentId)
  }));
  const save = () => {
    const vendorAllowed = vendors.some(v => v.id === draft.vendorId) || editingCapability?.vendorId === draft.vendorId;
    const processAllowed = processes.some(p => p.id === draft.processDefinitionId) || editingCapability?.processDefinitionId === draft.processDefinitionId;
    if (!vendorAllowed) { onNotice("Select an active vendor master record."); return; }
    if (!processAllowed) { onNotice("Select an active process definition from Process Master."); return; }
    if (draft.validFrom && draft.validUntil && draft.validUntil < draft.validFrom) { onNotice("Capability validity end date cannot be before its start date."); return; }
    const machineKey = draft.machineModel.trim().toLowerCase();
    const duplicate = capabilities.find(row => row.id !== editingId &&
      row.vendorId === draft.vendorId && row.processDefinitionId === draft.processDefinitionId &&
      row.machineModel.trim().toLowerCase() === machineKey
    );
    if (duplicate) { onNotice("This vendor already has a capability record for that process and machine model. Edit the existing record to update its qualification."); return; }
    const stamp = nowIso();
    const old = capabilities.find(row => row.id === editingId);
    const record: VendorCapabilityRecord = {
      ...draft, id: editingId || makeId("capability"), machineModel: draft.machineModel.trim(),
      materialRange: draft.materialRange.trim(), toleranceCapability: draft.toleranceCapability.trim(),
      certificationScope: draft.certificationScope.trim(), assessedBy: draft.assessedBy.trim(),
      notes: draft.notes.trim(), evidenceDocumentIds: draft.evidenceDocumentIds.filter(id => evidenceOptions.some(doc => doc.id === id)),
      createdAt: old?.createdAt || stamp, updatedAt: stamp
    };
    update(current => ({ ...current, vendorCapabilities: [...current.vendorCapabilities.filter(row => row.id !== record.id), record] }));
    reset();
    onNotice("Vendor capability saved against the selected vendor and process IDs. This does not allocate work or set vendor pricing.");
  };
  const archive = (row: VendorCapabilityRecord) => {
    if (!window.confirm("Archive this capability assessment? Vendor, process and historical operation links will remain unchanged.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, vendorCapabilities: current.vendorCapabilities.map(item => item.id === row.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item) }));
    onNotice("Capability assessment archived. The vendor and process master records were not deleted.");
  };
  const effectiveStatus = (row: VendorCapabilityRecord) => row.status === "Approved" && row.validUntil && row.validUntil < today ? "Expired · validity date passed" : row.status;
  const getAllocationCount = (row: VendorCapabilityRecord) => operations.filter(op => op.vendorId === row.vendorId && op.processDefinitionId === row.processDefinitionId).length;

  return <section className="workspace-page master-data-page capability-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "CAPABILITY REGISTER"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / QUALIFICATION MASTER</div><h1>Vendor Capability Master<span>.</span></h1><p>Map each vendor to the process definitions they can perform, with machine envelope, material range, tolerance, capacity and linked evidence.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("process-master")}><Cpu size={15}/> Process Master</button><button className="button-primary" onClick={startNew}><Plus size={15}/> Add capability</button></div></div>
    <div className="module-action-bar capability-filter-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search process, machine, material, tolerance or status…"/></label><SearchablePicker id="capability-vendor-filter" label="Filter vendor" value={vendorFilterId} placeholder="All vendors" options={vendors.map(v => ({id:v.id,label:v.company + (v.gstin ? " · " + v.gstin : "")}))} onChange={setVendorFilterId}/>{vendorFilterId && <button className="button-quiet compact-button" onClick={() => setVendorFilterId("")}>Clear vendor</button>}<span className="module-number">{filtered.length} / {capabilities.length} RECORDS</span></div>
    {!vendors.length || !processes.length ? <section className="surface-panel capability-prerequisites"><h3>Master records required</h3><p>{!vendors.length ? "Add actual vendors first. " : ""}{!processes.length ? "Create process definitions first. " : ""}Capability records must reference saved vendor and process IDs so that they can be reused across jobs without creating duplicate names.</p><div className="linked-empty-actions">{!vendors.length && <button className="button-quiet" onClick={() => onSelectModule("vendors")}>Open Vendor Directory <ArrowRight size={14}/></button>}{!processes.length && <button className="button-quiet" onClick={() => onSelectModule("process-master")}>Open Process Master <ArrowRight size={14}/></button>}</div></section> : null}
    {showForm && <section className="surface-panel master-editor"><div className="panel-heading"><div><h3>{editingId ? "Edit capability assessment" : "New vendor capability"}</h3><p>Qualification and evidence only. Actual outsourced jobs and their rates remain separately assigned on each Process Map operation.</p></div><button className="icon-control" onClick={reset} aria-label="Close editor"><X size={14}/></button></div>
      <div className="module-record-form capability-form">
        <SearchablePicker id="capability-vendor" label="Vendor *" value={draft.vendorId} placeholder="Search saved vendor…" options={vendorPickerOptions} onChange={chooseVendor}/>
        <SearchablePicker id="capability-process" label="Process definition *" value={draft.processDefinitionId} placeholder="Search Process Master…" options={processPickerOptions} onChange={id => setDraft(current => ({...current,processDefinitionId:id}))}/>
        <label>Machine / equipment model<input value={draft.machineModel} onChange={e => setDraft({...draft,machineModel:e.target.value})} placeholder="Machine make / model / asset reference"/></label>
        <label>Material / grade range<input value={draft.materialRange} onChange={e => setDraft({...draft,materialRange:e.target.value})} placeholder="Actual qualified material range"/></label>
        <label>Capability: tolerance<input value={draft.toleranceCapability} onChange={e => setDraft({...draft,toleranceCapability:e.target.value})} placeholder="Enter demonstrated tolerance / measurement scope"/></label>
        <label>Capacity per month (pcs)<input type="number" min="0" value={draft.capacityPerMonth || ""} onChange={e => setDraft({...draft,capacityPerMonth:Math.max(0,Number(e.target.value)||0)})} placeholder="Optional, enter verified capacity"/></label>
        <div className="capability-envelope"><strong>Machine working envelope (mm)</strong><div><label>X<input type="number" min="0" step="0.1" value={draft.envelopeX || ""} onChange={e => setDraft({...draft,envelopeX:Math.max(0,Number(e.target.value)||0)})}/></label><label>Y<input type="number" min="0" step="0.1" value={draft.envelopeY || ""} onChange={e => setDraft({...draft,envelopeY:Math.max(0,Number(e.target.value)||0)})}/></label><label>Z<input type="number" min="0" step="0.1" value={draft.envelopeZ || ""} onChange={e => setDraft({...draft,envelopeZ:Math.max(0,Number(e.target.value)||0)})}/></label></div></div>
        <label>Certification / qualification scope<input value={draft.certificationScope} onChange={e => setDraft({...draft,certificationScope:e.target.value})} placeholder="Standard, process, scope and certificate details"/></label>
        <label>Qualification status<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as VendorCapabilityStatus})}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Valid from<input type="date" value={draft.validFrom} onChange={e => setDraft({...draft,validFrom:e.target.value})}/></label>
        <label>Valid until<input type="date" min={draft.validFrom || undefined} value={draft.validUntil} onChange={e => setDraft({...draft,validUntil:e.target.value})}/></label>
        <label>Assessed by<input value={draft.assessedBy} onChange={e => setDraft({...draft,assessedBy:e.target.value})} placeholder="Evaluator / engineer"/></label>
        <label>Assessment date<input type="date" value={draft.assessedAt} onChange={e => setDraft({...draft,assessedAt:e.target.value})}/></label>
        <div className="capability-evidence master-form-wide"><div className="vendor-section-heading"><div><strong>Evidence documents</strong><small>Choose existing documents from this vendor's master record. No certificate is assumed or created.</small></div><span>{draft.evidenceDocumentIds.length} selected</span></div>
          {evidenceOptions.length ? <div className="capability-evidence-list">{evidenceOptions.map(doc => <label key={doc.id}><input type="checkbox" checked={draft.evidenceDocumentIds.includes(doc.id)} onChange={e => toggleEvidence(doc.id,e.target.checked)}/><span><strong>{doc.title || "Untitled vendor document"}</strong><small>{doc.reference || "Reference not entered"}</small></span></label>)}</div> : <p className="vendor-empty">No vendor documents are linked. Add certificates or audit evidence in Vendor Directory first.</p>}
        </div>
        <label className="master-form-wide">Assessment notes<input value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})} placeholder="Audit observations, limitations, corrective actions and renewal notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={save}><Check size={14}/> Save capability</button><button className="button-quiet" onClick={reset}>Cancel</button></div>
      </div>
    </section>}
    <div className="master-data-list">
      {filtered.map(row => {
        const vendor = allVendors.find(item => item.id === row.vendorId);
        const process = allProcessDefinitions.find(item => item.id === row.processDefinitionId);
        const evidence = (vendor?.documents || []).filter(doc => (row.evidenceDocumentIds || []).includes(doc.id));
        const allocationCount = getAllocationCount(row);
        return <article className="surface-panel master-data-card capability-card" key={row.id}>
          <div className="master-card-icon"><Cpu size={18}/></div>
          <div className="master-card-copy"><div className="master-card-heading"><strong>{vendor?.company || "Vendor record missing"} → {process?.name || "Process definition missing"}</strong><span className="record-state">{effectiveStatus(row)}</span></div>
            <p>{process?.code || "No process code"} · {row.machineModel || "Machine not specified"} · {moneyless(row.capacityPerMonth)} pcs/month capacity{process?.status === "Retired" || process?.deletedAt ? " · Process definition retired/archived" : ""}</p>
            <small>Envelope: {row.envelopeX || "—"} × {row.envelopeY || "—"} × {row.envelopeZ || "—"} mm · Tolerance: {row.toleranceCapability || "Not entered"} · Material: {row.materialRange || "Not entered"}</small>
            <div className="master-link-stats"><span>{evidence.length} linked evidence document(s)</span><span>{allocationCount} actual operation allocation(s)</span><span>{row.certificationScope || "No certification scope entered"}</span></div>
            {row.notes && <small>{row.notes}</small>}
          </div>
          <div className="module-record-card-actions"><button onClick={() => onOpenVendor(row.vendorId)} disabled={!vendors.some(activeVendor => activeVendor.id === row.vendorId)}>Open vendor</button><button onClick={() => edit(row)}>Edit</button><button onClick={() => archive(row)}>Archive</button></div>
        </article>;
      })}
      {!filtered.length && <div className="module-empty-state"><Cpu size={28}/><h3>{search ? "No matching capability" : "No vendor capabilities recorded"}</h3><p>{search ? "Try another vendor or process keyword." : "No capabilities are preloaded. Add only capabilities supported by your actual vendor evidence and assessment."}</p>{!search && vendors.length > 0 && processes.length > 0 && <button className="button-primary" onClick={startNew}><Plus size={14}/> Add first capability</button>}</div>}
    </div>
    <section className="master-related-actions"><button className="related-row" onClick={() => onSelectModule("vendors")}><Cpu size={16}/><span><strong>Vendor Directory & Work Allocation</strong><small>Vendor master, actual assigned operations and vendor-specific work history</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("process-map")}><FileText size={16}/><span><strong>Process Map</strong><small>Actual job assignment and per-component vendor cost entry remain here</small></span><ArrowRight size={14}/></button></section>
  </section>;
}
