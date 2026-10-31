import { useMemo, useState } from "react";
import { ArrowRight, Check, ClipboardList, Layers3, Plus, Search, ShieldCheck, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ProcessDefinitionRecord, type ProcessDefinitionStatus } from "./manufacturingData";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type Draft = Omit<ProcessDefinitionRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
const blankDraft = (): Draft => ({
  code: "", name: "", category: "", revision: "", description: "", applicableMaterials: "",
  equipmentRequirements: "", parameters: "", acceptanceCriteria: "", status: "Draft", owner: ""
});
const statuses: ProcessDefinitionStatus[] = ["Draft", "Under review", "Validated", "Released", "Retired"];

export default function ProcessMasterWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const processes = activeRows(data.processDefinitions);
  const operations = activeRows(data.operations);
  const capabilities = activeRows(data.vendorCapabilities);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const filtered = useMemo(() => processes.filter(row =>
    [row.code, row.name, row.category, row.revision, row.description, row.applicableMaterials, row.equipmentRequirements, row.status]
      .join(" ").toLowerCase().includes(search.trim().toLowerCase())
  ), [processes, search]);

  const reset = () => { setShowForm(false); setEditingId(""); setDraft(blankDraft()); };
  const edit = (row: ProcessDefinitionRecord) => {
    const { id, createdAt, updatedAt, deletedAt, ...form } = row;
    setEditingId(id); setDraft(form); setShowForm(true);
  };
  const save = () => {
    if (!draft.name.trim()) { onNotice("Enter the process name before saving."); return; }
    const code = draft.code.trim();
    const duplicate = processes.find(row => row.id !== editingId && code && row.code.trim().toLowerCase() === code.toLowerCase());
    if (duplicate) { onNotice("That process code already exists. Open the existing process definition instead of creating a duplicate."); return; }
    const stamp = nowIso();
    const old = processes.find(row => row.id === editingId);
    const record: ProcessDefinitionRecord = {
      ...draft, id: editingId || makeId("process"), code, name: draft.name.trim(), category: draft.category.trim(),
      revision: draft.revision.trim(), description: draft.description.trim(), applicableMaterials: draft.applicableMaterials.trim(),
      equipmentRequirements: draft.equipmentRequirements.trim(), parameters: draft.parameters.trim(),
      acceptanceCriteria: draft.acceptanceCriteria.trim(), owner: draft.owner.trim(),
      createdAt: old?.createdAt || stamp, updatedAt: stamp
    };
    update(current => ({ ...current, processDefinitions: [...current.processDefinitions.filter(row => row.id !== record.id), record] }));
    reset();
    onNotice("Process definition saved. Existing operation and vendor capability links retain their process ID.");
  };
  const archive = (row: ProcessDefinitionRecord) => {
    const useCount = operations.filter(op => op.processDefinitionId === row.id).length;
    const capabilityCount = capabilities.filter(cap => cap.processDefinitionId === row.id).length;
    if (!window.confirm("Retire this process definition from active selection? " + useCount + " operation link(s) and " + capabilityCount + " vendor capability link(s) will remain in historical records.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, processDefinitions: current.processDefinitions.map(item => item.id === row.id ? { ...item, status: "Retired", updatedAt: stamp } : item) }));
    onNotice("Process definition marked Retired. It is excluded from new route/capability selection, while linked operations and capability records retain a readable process definition.");
  };

  return <section className="workspace-page master-data-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "PROCESS MASTER"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / REUSABLE DEFINITIONS</div><h1>Process Master<span>.</span></h1><p>Define each manufacturing process once. Process routes and vendor capabilities reference the same saved process ID; no fixed route is imposed.</p></div><div className="workspace-title-actions"><button className="button-primary" onClick={() => { setDraft(blankDraft()); setEditingId(""); setShowForm(true); }}><Plus size={15}/> Add process definition</button></div></div>
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search process code, name, category, material or equipment…"/></label><span className="module-number">{processes.length} PROCESS DEFINITIONS</span></div>
    {showForm && <section className="surface-panel master-editor"><div className="panel-heading"><div><h3>{editingId ? "Edit process definition" : "New process definition"}</h3><p>Process master data only. Actual routes, operation quantities, dates and costs stay on each PO component line.</p></div><button className="icon-control" onClick={reset} aria-label="Close editor"><X size={14}/></button></div>
      <div className="module-record-form master-process-form">
        <label>Process code<input value={draft.code} onChange={e => setDraft({...draft,code:e.target.value})} placeholder="Optional internal code"/></label>
        <label>Process name *<input value={draft.name} onChange={e => setDraft({...draft,name:e.target.value})} placeholder="Enter process name"/></label>
        <label>Category<input value={draft.category} onChange={e => setDraft({...draft,category:e.target.value})} placeholder="Machining, treatment, inspection…"/></label>
        <label>Revision<input value={draft.revision} onChange={e => setDraft({...draft,revision:e.target.value})} placeholder="Revision / version"/></label>
        <label>Status<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as ProcessDefinitionStatus})}>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Process owner<input value={draft.owner} onChange={e => setDraft({...draft,owner:e.target.value})} placeholder="Responsible person / department"/></label>
        <label className="master-form-wide">Description<input value={draft.description} onChange={e => setDraft({...draft,description:e.target.value})} placeholder="Scope and intended use"/></label>
        <label>Applicable materials / grades<input value={draft.applicableMaterials} onChange={e => setDraft({...draft,applicableMaterials:e.target.value})} placeholder="Enter actual material range"/></label>
        <label>Equipment / machine requirements<input value={draft.equipmentRequirements} onChange={e => setDraft({...draft,equipmentRequirements:e.target.value})} placeholder="Machine types, capacities or fixtures"/></label>
        <label className="master-form-wide">Parameters and controls<input value={draft.parameters} onChange={e => setDraft({...draft,parameters:e.target.value})} placeholder="Process parameters, control points and records"/></label>
        <label className="master-form-wide">Acceptance criteria<input value={draft.acceptanceCriteria} onChange={e => setDraft({...draft,acceptanceCriteria:e.target.value})} placeholder="Customer / drawing / inspection acceptance criteria"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={save}><Check size={14}/> Save process</button><button className="button-quiet" onClick={reset}>Cancel</button></div>
      </div>
    </section>}
    <div className="master-data-list">
      {filtered.map(row => {
        const operationCount = operations.filter(op => op.processDefinitionId === row.id).length;
        const capabilityCount = capabilities.filter(cap => cap.processDefinitionId === row.id).length;
        return <article className="surface-panel master-data-card" key={row.id}>
          <div className="master-card-icon"><Layers3 size={18}/></div>
          <div className="master-card-copy"><div className="master-card-heading"><strong>{row.code ? row.code + " · " : ""}{row.name}</strong><span className="record-state">{row.status}</span></div>
            <p>{row.category || "Category not entered"} · Rev {row.revision || "—"} · {row.applicableMaterials || "Material scope not defined"}</p>
            <small>{row.description || "No description entered"}{row.equipmentRequirements ? " · Equipment: " + row.equipmentRequirements : ""}</small>
            <div className="master-link-stats"><span>{operationCount} linked operation(s)</span><span>{capabilityCount} vendor capability record(s)</span><span>{row.owner || "No owner assigned"}</span></div>
          </div>
          <div className="module-record-card-actions"><button onClick={() => edit(row)}>Edit</button><button onClick={() => archive(row)}>Archive</button></div>
        </article>;
      })}
      {!filtered.length && <div className="module-empty-state"><ClipboardList size={28}/><h3>{search ? "No matching process definition" : "No process definitions yet"}</h3><p>{search ? "Try another process code, category or keyword." : "Create your actual process definitions. They can then be selected by PO component operations and mapped to qualified vendors."}</p>{!search && <button className="button-primary" onClick={() => { setDraft(blankDraft()); setEditingId(""); setShowForm(true); }}><Plus size={14}/> Add first process</button>}</div>}
    </div>
    <section className="master-related-actions"><button className="related-row" onClick={() => onSelectModule("process-map")}><ClipboardList size={16}/><span><strong>Process Map</strong><small>{operations.length} saved operation(s) · assign definitions to individual PO component routes</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("vendor-capability")}><ShieldCheck size={16}/><span><strong>Vendor Capability Master</strong><small>{capabilities.length} qualification record(s) linked by process ID</small></span><ArrowRight size={14}/></button></section>
  </section>;
}
