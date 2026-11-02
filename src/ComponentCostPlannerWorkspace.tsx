import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, ClipboardList, Plus, Search, ShieldCheck, Trash2,
  Workflow, X
} from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type StandaloneCostPlanRecord, type StandalonePlannedProcess
} from "./manufacturingData";
import { findComponentPlanFor } from "./componentPlanLogic";

type Props = {
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
};
type Draft = Omit<StandaloneCostPlanRecord, "id" | "createdAt" | "updatedAt" | "deletedAt" | "poNumber" | "poQuantity">;

const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const planFields: { key: keyof Pick<Draft,
  "materialCostPerPart" | "directLabourCostPerPart" | "overheadCostPerPart" |
  "toolingCostPerPart" | "qualityCostPerPart" | "reworkScrapCostPerPart" |
  "packagingCostPerPart" | "otherCostPerPart">; label: string }[] = [
  { key: "materialCostPerPart", label: "Material / pc" },
  { key: "directLabourCostPerPart", label: "Direct labour / pc" },
  { key: "overheadCostPerPart", label: "Overhead / pc" },
  { key: "toolingCostPerPart", label: "Tooling & fixture / pc" },
  { key: "qualityCostPerPart", label: "Quality & inspection / pc" },
  { key: "reworkScrapCostPerPart", label: "Rework & scrap / pc" },
  { key: "packagingCostPerPart", label: "Packaging / pc" },
  { key: "otherCostPerPart", label: "Other planned cost / pc" }
];
const blankProcess = (): StandalonePlannedProcess => ({
  id: makeId("planned-process"), category: "", processName: "",
  quantityPerPart: 1, ratePerUnit: 0, transportPerPart: 0, notes: ""
});
const blankDraft = (): Draft => ({
  componentName: "", componentNumber: "",
  materialCostPerPart: 0, directLabourCostPerPart: 0, overheadCostPerPart: 0,
  toolingCostPerPart: 0, qualityCostPerPart: 0, reworkScrapCostPerPart: 0,
  packagingCostPerPart: 0, otherCostPerPart: 0, targetSellingPricePerPart: 0,
  processRows: [], status: "Draft", notes: ""
});
const toDraft = (record?: StandaloneCostPlanRecord): Draft => record ? ({
  componentName: record.componentName || record.componentNumber || "",
  componentNumber: record.componentNumber || "",
  materialCostPerPart: Number(record.materialCostPerPart) || 0,
  directLabourCostPerPart: Number(record.directLabourCostPerPart) || 0,
  overheadCostPerPart: Number(record.overheadCostPerPart) || 0,
  toolingCostPerPart: Number(record.toolingCostPerPart) || 0,
  qualityCostPerPart: Number(record.qualityCostPerPart) || 0,
  reworkScrapCostPerPart: Number(record.reworkScrapCostPerPart) || 0,
  packagingCostPerPart: Number(record.packagingCostPerPart) || 0,
  otherCostPerPart: Number(record.otherCostPerPart) || 0,
  targetSellingPricePerPart: Number(record.targetSellingPricePerPart) || 0,
  processRows: (record.processRows || []).map(row => ({ ...row })),
  status: record.status || "Draft",
  notes: record.notes || ""
}) : blankDraft();

export default function ComponentCostPlannerWorkspace({ onBack, onNotice, notice }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const plans = activeRows(data.standaloneCostPlans || []);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [showForm, setShowForm] = useState(true);

  const visiblePlans = useMemo(() => plans
    .filter(record => ((record.componentName || "") + " " + record.componentNumber + " " + record.notes)
      .toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [plans, search]);
  const selectedRecord = plans.find(record => record.id === selectedId);
  useEffect(() => {
    setDraft(toDraft(selectedRecord));
    setShowForm(Boolean(selectedRecord));
  }, [selectedRecord?.id, selectedRecord?.updatedAt]);

  const nonProcessPerPart = planFields.reduce((sum, field) => sum + Math.max(0, Number(draft[field.key]) || 0), 0);
  const processPerPart = draft.processRows.reduce((sum, row) =>
    sum + Math.max(0, row.quantityPerPart) * Math.max(0, row.ratePerUnit) + Math.max(0, row.transportPerPart), 0);
  const plannedCostPerPart = nonProcessPerPart + processPerPart;
  const plannedMarginPerPart = Number(draft.targetSellingPricePerPart) > 0
    ? Number(draft.targetSellingPricePerPart) - plannedCostPerPart : null;

  const startNew = () => {
    setSelectedId("");
    setDraft(blankDraft());
    setShowForm(true);
  };
  const updateProcess = (id: string, patch: Partial<StandalonePlannedProcess>) => {
    setDraft(current => ({
      ...current,
      processRows: current.processRows.map(row => row.id === id ? { ...row, ...patch } : row)
    }));
  };
  const savePlan = () => {
    const componentName = draft.componentName.trim();
    const componentNumber = draft.componentNumber.trim();
    if (!componentName) {
      onNotice("Enter a component name. Component number is optional, but improves matching in Costing & Payments.");
      return;
    }
    const numericValues = [
      ...planFields.map(field => Number(draft[field.key])),
      Number(draft.targetSellingPricePerPart),
      ...draft.processRows.flatMap(row => [row.quantityPerPart, row.ratePerUnit, row.transportPerPart])
    ];
    if (numericValues.some(value => !Number.isFinite(value) || value < 0)) {
      onNotice("All planned quantities and costs must be valid non-negative numbers.");
      return;
    }
    if (draft.processRows.some(row => !row.processName.trim())) {
      onNotice("Enter a process name for every planned process row, or remove the unused row.");
      return;
    }
    const matchedRecord = findComponentPlanFor(plans, { componentNumber, componentName });
    if (matchedRecord && matchedRecord.id !== selectedId) {
      setSelectedId(matchedRecord.id);
      setDraft(toDraft(matchedRecord));
      onNotice("A Component Plan Directory record already exists for this component. Opened it for editing to avoid duplicate planned baselines.");
      return;
    }
    const stamp = nowIso();
    const record: StandaloneCostPlanRecord = {
      ...draft,
      componentName,
      componentNumber,
      poNumber: undefined,
      poQuantity: undefined,
      processRows: draft.processRows.map(row => ({
        ...row,
        category: row.category.trim(),
        processName: row.processName.trim(),
        notes: row.notes.trim()
      })),
      id: selectedId || makeId("component-plan"),
      createdAt: selectedRecord?.createdAt || stamp,
      updatedAt: stamp,
      deletedAt: undefined
    };
    update(current => ({
      ...current,
      standaloneCostPlans: [
        ...(current.standaloneCostPlans || []).filter(item => item.id !== record.id),
        record
      ]
    }));
    setSelectedId(record.id);
    setShowForm(true);
    onNotice("Component plan saved. Costing & Payments is the only workspace that reads this assumed-cost directory. No operational master, PO, vendor or production record was created or changed.");
  };
  const archivePlan = () => {
    if (!selectedRecord) return;
    if (!window.confirm("Archive this Component Plan Directory record? The saved history remains in AXIMACH data.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      standaloneCostPlans: (current.standaloneCostPlans || []).map(item =>
        item.id === selectedRecord.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item
      )
    }));
    setSelectedId("");
    setDraft(blankDraft());
    setShowForm(false);
    onNotice("Component plan archived. No production or master records were changed.");
  };

  return <section className="workspace-page component-cost-planner-page standalone-cost-planner">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline">
      <button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Command centre</button>
      <span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "SAVED COMPONENT PLANS"}</span>
    </div>
    <div className="workspace-title-row">
      <div>
        <div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / INDEPENDENT COST ASSUMPTIONS</div>
        <h1>Component Plan Directory<span>.</span></h1>
        <p>Create a component name and store your assumed cost per piece. This directory is independent of Component Directory, Component Master, PO, Process Directory and production.</p>
      </div>
      <div className="workspace-title-actions">
        <button className="button-primary" onClick={startNew}><Plus size={14}/> Add component plan</button>
      </div>
    </div>
    <div className="standalone-plan-layout">
      <aside className="surface-panel standalone-plan-list">
        <div className="panel-heading">
          <div><div className="eyebrow">INDEPENDENT COMPONENT PLANS</div><h3>{plans.length} component plan(s)</h3><p>Manual assumptions · no operational links.</p></div>
          <span className="module-number">{plans.length} PLANS</span>
        </div>
        <label className="module-record-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search component name / number…"/></label>
        <div className="standalone-plan-records">
          {visiblePlans.map(record => {
            const processTotal = (record.processRows || []).reduce((sum, row) => sum + row.quantityPerPart * row.ratePerUnit + row.transportPerPart, 0);
            const otherTotal = planFields.reduce((sum, field) => sum + Number(record[field.key] || 0), 0);
            return <button type="button" key={record.id} className={"standalone-plan-record " + (selectedId === record.id ? "active" : "")}
              onClick={() => {setSelectedId(record.id);setShowForm(true);}}>
              <span><strong>{record.componentName || record.componentNumber}</strong><small>{record.componentNumber || "No part number entered"}</small></span>
              <b>{money(otherTotal + processTotal)} / pc</b>
              <em>{record.status} · {record.processRows.length} process row(s)</em>
            </button>;
          })}
          {!visiblePlans.length && <div className="standalone-plan-empty"><ClipboardList size={24}/><strong>No component plans saved</strong><span>Create a component name and enter its assumed cost per piece.</span></div>}
        </div>
        <div className="module-safety-note"><ShieldCheck size={14}/><span>Only Costing & Payments reads this directory. Saving here never creates or edits Component Master, Component Directory, a PO, Process Directory, vendors or production routes.</span></div>
      </aside>

      {showForm && <main className="standalone-plan-editor">
        <section className="surface-panel standalone-plan-key-panel">
          <div className="panel-heading"><div><div className="eyebrow">MANUAL COMPONENT IDENTITY</div><h3>{selectedRecord ? "Edit component assumptions" : "Create component plan"}</h3><p>These are labels entered in this directory; they do not create a Component Master record or link to any production component.</p></div><span className="module-number">{selectedRecord ? "EDITING" : "NEW"}</span></div>
          <div className="standalone-plan-key-grid">
            <label>Component name *<input value={draft.componentName} onChange={event => setDraft(current => ({ ...current, componentName: event.target.value }))} placeholder="Enter your component name"/></label>
            <label>Component number (optional)<input value={draft.componentNumber} onChange={event => setDraft(current => ({ ...current, componentNumber: event.target.value }))} placeholder="Enter your assumed part number"/></label>
            <label>Target selling price / pc (₹)<input type="number" min="0" step="0.01" value={draft.targetSellingPricePerPart} onChange={event => setDraft(current => ({ ...current, targetSellingPricePerPart: Math.max(0, Number(event.target.value) || 0) }))}/></label>
            <label>Plan status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as "Draft" | "Approved" }))}><option value="Draft">Draft</option><option value="Approved">Approved</option></select></label>
          </div>
        </section>

        <section className="surface-panel standalone-plan-costs">
          <div className="panel-heading"><div><div className="eyebrow">ASSUMED COMPONENT COSTS</div><h3>Cost per finished piece</h3><p>These are your assumptions, kept separate from actual PO and production cost.</p></div></div>
          <div className="standalone-plan-cost-grid">
            {planFields.map(field => <label key={field.key}>{field.label}<input type="number" min="0" step="0.01" value={draft[field.key]} onChange={event => setDraft(current => ({ ...current, [field.key]: Math.max(0, Number(event.target.value) || 0) }))}/></label>)}
          </div>
        </section>

        <section className="surface-panel standalone-plan-processes">
          <div className="panel-heading"><div><div className="eyebrow">FREE-ENTRY ASSUMED PROCESS COSTS</div><h3>Process type and transport estimates</h3><p>Enter category and process type directly. Nothing is added to Process Directory or Process Map.</p></div><button className="button-primary compact-button" onClick={() => setDraft(current => ({ ...current, processRows: [...current.processRows, blankProcess()] }))}><Plus size={13}/> Add process type</button></div>
          {draft.processRows.length ? <div className="standalone-process-list">
            {draft.processRows.map((row, index) => {
              const rowTotal = row.quantityPerPart * row.ratePerUnit + row.transportPerPart;
              return <div className="standalone-process-row" key={row.id}>
                <div className="standalone-process-row-head"><strong>PROCESS {String(index + 1).padStart(2, "0")}</strong><span>{money(rowTotal)} / pc</span><button type="button" className="button-quiet compact-button" onClick={() => setDraft(current => ({ ...current, processRows: current.processRows.filter(item => item.id !== row.id) }))} title="Remove process type"><Trash2 size={13}/></button></div>
                <div className="standalone-process-grid">
                  <label>Category<input value={row.category} onChange={event => updateProcess(row.id, { category: event.target.value })} placeholder="e.g. Machining"/></label>
                  <label>Process type / description *<input value={row.processName} onChange={event => updateProcess(row.id, { processName: event.target.value })} placeholder="e.g. CNC milling"/></label>
                  <label>Quantity / pc<input type="number" min="0" step="0.0001" value={row.quantityPerPart} onChange={event => updateProcess(row.id, { quantityPerPart: Math.max(0, Number(event.target.value) || 0) })}/></label>
                  <label>Rate / process unit (₹)<input type="number" min="0" step="0.01" value={row.ratePerUnit} onChange={event => updateProcess(row.id, { ratePerUnit: Math.max(0, Number(event.target.value) || 0) })}/></label>
                  <label>Transport / pc (₹)<input type="number" min="0" step="0.01" value={row.transportPerPart} onChange={event => updateProcess(row.id, { transportPerPart: Math.max(0, Number(event.target.value) || 0) })}/></label>
                  <label>Notes<input value={row.notes} onChange={event => updateProcess(row.id, { notes: event.target.value })} placeholder="Optional"/></label>
                </div>
              </div>;
            })}
          </div> : <div className="standalone-plan-empty compact"><Workflow size={24}/><strong>No process types added</strong><span>Add CNC, VMC, turning, milling, grinding, heat treatment, transport or any assumed process cost you need.</span></div>}
        </section>

        <section className="standalone-plan-totals">
          <div><small>NON-PROCESS / PC</small><strong>{money(nonProcessPerPart)}</strong></div>
          <div><small>PROCESS + TRANSPORT / PC</small><strong>{money(processPerPart)}</strong></div>
          <div><small>ASSUMED COST / PC</small><strong>{money(plannedCostPerPart)}</strong></div>
          <div><small>TARGET SELLING / PC</small><strong>{money(Number(draft.targetSellingPricePerPart) || 0)}</strong></div>
          <div><small>ASSUMED MARGIN / PC</small><strong className={plannedMarginPerPart === null ? "" : plannedMarginPerPart >= 0 ? "cost-positive" : "cost-negative"}>{plannedMarginPerPart === null ? "Selling price not entered" : money(plannedMarginPerPart)}</strong></div>
        </section>
        <section className="surface-panel standalone-plan-notes">
          <label>Planning notes<textarea rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Assumptions, drawing revision, inclusions or exclusions…"/></label>
          <div className="standalone-plan-savebar">
            <span><ShieldCheck size={14}/> Independent Component Plan Directory. Only Costing & Payments can read these assumed costs.</span>
            {selectedRecord && <button type="button" className="button-quiet" onClick={archivePlan}><Trash2 size={14}/> Archive</button>}
            <button type="button" className="button-primary" onClick={savePlan}><Check size={14}/> {selectedRecord ? "Update component plan" : "Save component plan"}</button>
          </div>
        </section>
      </main>}
      {!showForm && <div className="surface-panel standalone-plan-empty-main"><ClipboardList size={28}/><h3>Select a component plan or create a new one</h3><p>These assumptions stay separate from operational records.</p><button className="button-primary" onClick={startNew}><Plus size={14}/> Add component plan</button></div>}
    </div>
  </section>;
}
