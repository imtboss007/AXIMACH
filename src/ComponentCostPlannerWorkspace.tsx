import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, Boxes, Calculator, Check, CircleDollarSign,
  ClipboardList, Package, Pencil, Plus, Search, ShieldCheck,
  Trash2, TrendingUp, Workflow, X
} from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData, vendorSupportsProcessType,
  type ComponentPlannedCostRecord, type ComponentProcessCostRecord
} from "./manufacturingData";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type PlanFields = Pick<ComponentPlannedCostRecord,
  "materialCostPerPart" | "directLabourCostPerPart" | "overheadCostPerPart" |
  "toolingCostPerPart" | "qualityCostPerPart" | "reworkScrapCostPerPart" |
  "packagingCostPerPart" | "otherCostPerPart" | "targetSellingPricePerPart" | "status" | "notes"
>;
type ProcessDraft = { processTypeId: string; vendorId: string; quantityPerPart: string; ratePerProcess: string; transportCostPerPart: string; notes: string };

const blankFields = (): PlanFields => ({
  materialCostPerPart: 0, directLabourCostPerPart: 0, overheadCostPerPart: 0,
  toolingCostPerPart: 0, qualityCostPerPart: 0, reworkScrapCostPerPart: 0,
  packagingCostPerPart: 0, otherCostPerPart: 0, targetSellingPricePerPart: 0,
  status: "Draft", notes: ""
});
const blankProcess = (): ProcessDraft => ({
  processTypeId: "", vendorId: "", quantityPerPart: "1", ratePerProcess: "",
  transportCostPerPart: "0", notes: ""
});
const costFields: { key: Exclude<keyof PlanFields, "status" | "notes">; label: string; detail: string }[] = [
  { key: "materialCostPerPart", label: "Material cost / finished piece", detail: "Raw material and purchased material input" },
  { key: "directLabourCostPerPart", label: "Direct labour / piece", detail: "Planned hands-on labour allowance" },
  { key: "overheadCostPerPart", label: "Factory overhead / piece", detail: "Power, supervision and allocated overhead" },
  { key: "toolingCostPerPart", label: "Tooling & fixture / piece", detail: "Allocated tool, fixture and consumable cost" },
  { key: "qualityCostPerPart", label: "Quality & inspection / piece", detail: "Inspection, gauge and certification allowance" },
  { key: "reworkScrapCostPerPart", label: "Rework & scrap allowance / piece", detail: "Planned quality loss allowance" },
  { key: "packagingCostPerPart", label: "Packaging & handling / piece", detail: "Protective packaging and handling allowance" },
  { key: "otherCostPerPart", label: "Other planned cost / piece", detail: "Any additional direct cost not listed above" }
];
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const sumPlanFields = (value: PlanFields) => costFields.reduce((total, field) => total + Math.max(0, Number(value[field.key]) || 0), 0);
const fromRecord = (record?: ComponentPlannedCostRecord): PlanFields => record ? ({
  materialCostPerPart: record.materialCostPerPart || 0,
  directLabourCostPerPart: record.directLabourCostPerPart || 0,
  overheadCostPerPart: record.overheadCostPerPart || 0,
  toolingCostPerPart: record.toolingCostPerPart || 0,
  qualityCostPerPart: record.qualityCostPerPart || 0,
  reworkScrapCostPerPart: record.reworkScrapCostPerPart || 0,
  packagingCostPerPart: record.packagingCostPerPart || 0,
  otherCostPerPart: record.otherCostPerPart || 0,
  targetSellingPricePerPart: record.targetSellingPricePerPart || 0,
  status: record.status || "Draft",
  notes: record.notes || ""
}) : blankFields();

export default function ComponentCostPlannerWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const processTypes = activeRows(data.processTypes);
  const categories = activeRows(data.processCategories);
  const plans = activeRows(data.componentPlannedCosts || []);
  const processPlans = activeRows(data.componentProcessCosts || []);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<PlanFields>(blankFields());
  const [showProcessForm, setShowProcessForm] = useState(false);
  const [editingProcessId, setEditingProcessId] = useState("");
  const [processDraft, setProcessDraft] = useState<ProcessDraft>(blankProcess());

  const visibleComponents = useMemo(() => components.filter(component =>
    (component.partNumber + " " + component.name + " " + component.revision + " " + component.material)
      .toLowerCase().includes(search.toLowerCase().trim())
  ).sort((a, b) => a.partNumber.localeCompare(b.partNumber)), [components, search]);
  const selected = components.find(component => component.id === selectedId) || visibleComponents[0] || components[0];
  const savedPlan = selected ? plans.find(record => record.componentId === selected.id) : undefined;
  const selectedProcessPlans = selected ? processPlans
    .filter(record => record.componentId === selected.id)
    .sort((a, b) => a.processTypeId.localeCompare(b.processTypeId)) : [];
  const processCostPerPart = selectedProcessPlans.reduce((sum, row) =>
    sum + row.quantityPerPart * row.ratePerProcess + row.transportCostPerPart, 0);
  const nonProcessPlanPerPart = sumPlanFields(draft);
  const plannedCostPerPart = nonProcessPlanPerPart + processCostPerPart;
  const targetSelling = Number(draft.targetSellingPricePerPart) || 0;
  const plannedMargin = targetSelling - plannedCostPerPart;
  const marginPercent = targetSelling > 0 ? plannedMargin / targetSelling * 100 : null;
  const planSaved = Boolean(savedPlan);
  const processOptions = processTypes.map(type => ({
    id: type.id,
    label: (categories.find(category => category.id === type.categoryId)?.name || "Process") + " · " + type.name
  }));
  const vendorOptions = vendors.filter(vendor =>
    !processDraft.processTypeId || vendorSupportsProcessType(vendor, processDraft.processTypeId) ||
    vendor.id === processDraft.vendorId
  );

  useEffect(() => {
    setDraft(fromRecord(savedPlan));
    setShowProcessForm(false);
    setEditingProcessId("");
  }, [selected?.id, savedPlan?.updatedAt]);

  const selectComponent = (id: string) => {
    setSelectedId(id);
    setShowProcessForm(false);
    setEditingProcessId("");
  };
  const savePlan = () => {
    if (!selected) { onNotice("Create a component in Component Master before planning its cost."); return; }
    const numericFields = costFields.map(field => Number(draft[field.key]));
    if (numericFields.some(value => !Number.isFinite(value) || value < 0) || !Number.isFinite(Number(draft.targetSellingPricePerPart)) || Number(draft.targetSellingPricePerPart) < 0) {
      onNotice("All planned cost fields must be valid non-negative amounts. Enter 0 explicitly where a cost does not apply.");
      return;
    }
    const stamp = nowIso();
    const prior = plans.find(record => record.componentId === selected.id);
    const record: ComponentPlannedCostRecord = {
      ...draft,
      id: prior?.id || makeId("component-planned-cost"),
      componentId: selected.id,
      createdAt: prior?.createdAt || stamp,
      updatedAt: stamp,
      deletedAt: undefined
    };
    update(current => ({
      ...current,
      componentPlannedCosts: [
        ...(current.componentPlannedCosts || []).filter(item => item.id !== record.id),
        record
      ]
    }));
    onNotice("Component planned cost saved. Process Map and Costing & Payments will now show this component's budget reference separately from supplier actuals.");
  };
  const beginAddProcess = () => {
    setEditingProcessId("");
    setProcessDraft(blankProcess());
    setShowProcessForm(true);
  };
  const beginEditProcess = (record: ComponentProcessCostRecord) => {
    setEditingProcessId(record.id);
    setProcessDraft({
      processTypeId: record.processTypeId,
      vendorId: record.vendorId || "",
      quantityPerPart: String(record.quantityPerPart),
      ratePerProcess: String(record.ratePerProcess),
      transportCostPerPart: String(record.transportCostPerPart),
      notes: record.notes || ""
    });
    setShowProcessForm(true);
  };
  const saveProcessPlan = () => {
    if (!selected || !processDraft.processTypeId) {
      onNotice("Select a saved component and a Process Directory process.");
      return;
    }
    const quantity = Number(processDraft.quantityPerPart);
    const rate = Number(processDraft.ratePerProcess);
    const transport = Number(processDraft.transportCostPerPart);
    if (!processDraft.quantityPerPart.trim() || !Number.isFinite(quantity) || quantity <= 0 ||
        !processDraft.ratePerProcess.trim() || !Number.isFinite(rate) || rate < 0 ||
        !processDraft.transportCostPerPart.trim() || !Number.isFinite(transport) || transport < 0) {
      onNotice("Enter a positive process quantity and valid rate and transport amounts. Enter 0 explicitly when a charge does not apply.");
      return;
    }
    const duplicate = selectedProcessPlans.find(row => row.processTypeId === processDraft.processTypeId && row.id !== editingProcessId);
    if (duplicate) { onNotice("This component already has a planned cost for that process. Edit the existing row to avoid double counting."); return; }
    if (processDraft.vendorId) {
      const vendor = vendors.find(row => row.id === processDraft.vendorId);
      const previous = processPlans.find(row => row.id === editingProcessId);
      if (!vendor || (!vendorSupportsProcessType(vendor, processDraft.processTypeId) && previous?.vendorId !== vendor.id)) {
        onNotice("Select a Vendor Master record with this process capability, or leave the process vendor blank for an in-house plan.");
        return;
      }
    }
    const stamp = nowIso();
    const previous = processPlans.find(row => row.id === editingProcessId);
    const record: ComponentProcessCostRecord = {
      id: editingProcessId || makeId("component-process-cost"),
      componentId: selected.id,
      processTypeId: processDraft.processTypeId,
      vendorId: processDraft.vendorId,
      quantityPerPart: quantity,
      ratePerProcess: rate,
      transportCostPerPart: transport,
      notes: processDraft.notes.trim(),
      createdAt: previous?.createdAt || stamp,
      updatedAt: stamp,
      deletedAt: undefined
    };
    update(current => ({
      ...current,
      componentProcessCosts: editingProcessId
        ? current.componentProcessCosts.map(row => row.id === editingProcessId ? record : row)
        : [...current.componentProcessCosts, record]
    }));
    setShowProcessForm(false);
    setEditingProcessId("");
    onNotice("Planned process cost saved against this component. It is a benchmark only; it does not mark a vendor quotation, operation or payment as approved.");
  };
  const archiveProcessPlan = (record: ComponentProcessCostRecord) => {
    if (!window.confirm("Archive this component's planned process-cost row? Existing Process Map operations and actual payments will remain unchanged.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      componentProcessCosts: current.componentProcessCosts.map(row =>
        row.id === record.id ? { ...row, deletedAt: stamp, updatedAt: stamp } : row
      )
    }));
    if (editingProcessId === record.id) setShowProcessForm(false);
    onNotice("Planned process-cost row archived. Historical operations and payment records were not changed.");
  };
  const plannedStatus = savedPlan?.status || "Not saved";

  return <section className="workspace-page component-cost-planner-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline">
      <button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command Centre</button>
      <span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL DATA · SERVER OPTIONAL"}</span>
    </div>
    <div className="workspace-title-row">
      <div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / PER-COMPONENT COST BASELINE</div><h1>Component Cost Planner<span>.</span></h1><p>Set your own target cost for every component. Keep the planned budget separate from quotations, operation commitments and actual vendor payments.</p></div>
      <div className="workspace-title-actions">
        <button className="button-quiet" onClick={() => onSelectModule("component-directory")}><Boxes size={14}/> Component Directory</button>
        <button className="button-quiet" onClick={() => onSelectModule("production")}><Workflow size={14}/> Process Map</button>
        <button className="button-primary" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Costing & Payments</button>
      </div>
    </div>
    <div className="ccp-layout">
      <aside className="surface-panel ccp-component-rail">
        <div className="panel-heading"><div><div className="eyebrow">COMPONENT MASTER</div><h3>{components.length} components</h3><p>One planned budget per component ID.</p></div><span className="module-number">{plans.length} PLANS</span></div>
        <label className="module-record-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search part number or name…"/></label>
        <div className="ccp-component-list">
          {visibleComponents.map(component => {
            const saved = plans.find(plan => plan.componentId === component.id);
            const routeCount = processPlans.filter(row => row.componentId === component.id).length;
            return <button key={component.id} className={"ccp-component-row " + (selected?.id === component.id ? "active" : "")} onClick={() => selectComponent(component.id)}>
              <span className="ccp-component-icon"><Package size={16}/></span>
              <span className="ccp-component-copy"><strong>{component.partNumber}</strong><small>{component.name} · Rev {component.revision || "—"}</small><em>{saved ? saved.status : "Cost plan needed"} · {routeCount} process plan(s)</em></span>
              <ArrowRight size={14}/>
            </button>;
          })}
          {!visibleComponents.length && <div className="ccp-empty"><Boxes size={24}/><strong>{components.length ? "No matching components" : "No components yet"}</strong><span>{components.length ? "Change the search term." : "Create components in Component Master first. This planner does not create fake part records."}</span>{!components.length && <button className="button-primary" onClick={() => onSelectModule("components")}><Plus size={13}/> Open Component Master</button>}</div>}
        </div>
      </aside>

      {selected ? <main className="ccp-main">
        <section className="surface-panel ccp-selected-component">
          <div className="ccp-selected-mark"><Boxes size={21}/></div>
          <div><div className="eyebrow">SELECTED COMPONENT / {selected.revision || "NO REVISION"}</div><h2>{selected.partNumber} <span>·</span> {selected.name}</h2><p>{selected.material || "Material not specified"} · {selected.drawingReference || "No drawing reference"}</p></div>
          <span className={"ccp-plan-status " + (savedPlan?.status === "Approved" ? "approved" : "")}>{plannedStatus}</span>
        </section>

        <section className="ccp-score-grid">
          <article className="ccp-score ccp-score-primary"><span><Calculator size={16}/> TOTAL PLANNED COST / PIECE</span><strong>{money(plannedCostPerPart)}</strong><small>Component inputs + planned process route</small></article>
          <article className="ccp-score"><span><Workflow size={16}/> PROCESS ROUTE PLAN / PIECE</span><strong>{money(processCostPerPart)}</strong><small>{selectedProcessPlans.length} planned process stage(s)</small></article>
          <article className="ccp-score"><span><TrendingUp size={16}/> TARGET SELLING / PIECE</span><strong>{money(targetSelling)}</strong><small>Entered target · not an order price</small></article>
          <article className={"ccp-score " + (plannedMargin < 0 ? "negative" : "positive")}><span><CircleDollarSign size={16}/> PLANNED MARGIN / PIECE</span><strong>{money(plannedMargin)}</strong><small>{marginPercent === null ? "Enter target selling price to calculate margin" : marginPercent.toFixed(1) + "% of target selling price"}</small></article>
        </section>

        <section className="surface-panel ccp-cost-input-panel">
          <div className="panel-heading"><div><div className="eyebrow">YOUR COST ASSUMPTIONS</div><h3>Component-level planned cost</h3><p>All values are per finished component piece. Nothing is inferred from vendor invoices or actual production rates.</p></div><span className="module-number">{savedPlan ? "SAVED BASELINE" : "UNSAVED DRAFT"}</span></div>
          <div className="ccp-input-grid">
            {costFields.map(field => <label key={field.key}><span>{field.label}</span><input type="number" min="0" step="0.01" value={draft[field.key] || ""} onChange={event => setDraft(current => ({ ...current, [field.key]: Number(event.target.value || 0) }))} placeholder="0.00"/><small>{field.detail}</small></label>)}
            <label><span>Target selling price / piece</span><input type="number" min="0" step="0.01" value={draft.targetSellingPricePerPart || ""} onChange={event => setDraft(current => ({ ...current, targetSellingPricePerPart: Number(event.target.value || 0) }))} placeholder="0.00"/><small>Your target only. Actual PO/order prices stay in the commercial record.</small></label>
            <label><span>Plan status</span><select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as "Draft" | "Approved" }))}><option value="Draft">Draft / working estimate</option><option value="Approved">Approved internal baseline</option></select><small>Approval is an internal planning label; it does not approve a supplier quote or payment.</small></label>
            <label className="ccp-notes-field"><span>Planning notes</span><textarea rows={3} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Assumptions, source drawing/revision, costing basis, exclusions…"/></label>
          </div>
          <div className="ccp-save-row"><span><ShieldCheck size={14}/> Saving updates this component's master cost baseline only. Existing PO and actual cost records are preserved.</span><button className="button-primary" onClick={savePlan}><Check size={14}/> {savedPlan ? "Update planned cost" : "Save planned cost"}</button></div>
        </section>

        <section className="surface-panel ccp-process-panel">
          <div className="panel-heading"><div><div className="eyebrow">PROCESS-WISE BUDGET / LINKED TO PROCESS DIRECTORY</div><h3>Planned process route costs</h3><p>Define your expected cost for each required process. These rows are the per-component benchmarks shown beside Process Map operation rates.</p></div><button className="button-primary compact-button" onClick={beginAddProcess}><Plus size={13}/> Add process plan</button></div>
          {showProcessForm && <div className="ccp-process-editor">
            <div className="ccp-process-editor-head"><strong>{editingProcessId ? "Edit process cost plan" : "Add process cost plan"}</strong><button className="icon-control" onClick={() => setShowProcessForm(false)} aria-label="Close process plan editor"><X size={14}/></button></div>
            <div className="ccp-process-form-grid">
              <label>Process / subcategory<select value={processDraft.processTypeId} onChange={event => setProcessDraft(current => ({ ...current, processTypeId: event.target.value, vendorId: vendors.some(vendor => vendorSupportsProcessType(vendor, event.target.value)) ? current.vendorId : "" }))}><option value="">Choose saved process…</option>{processOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
              <label>Preferred capable vendor (optional)<select value={processDraft.vendorId} onChange={event => setProcessDraft(current => ({ ...current, vendorId: event.target.value }))}><option value="">In-house / not assigned</option>{vendorOptions.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.company} · {vendor.contact}</option>)}</select></label>
              <label>Process quantity per component<input type="number" min="0.0001" step="0.0001" value={processDraft.quantityPerPart} onChange={event => setProcessDraft(current => ({ ...current, quantityPerPart: event.target.value }))}/></label>
              <label>Rate per process unit (₹)<input type="number" min="0" step="0.01" value={processDraft.ratePerProcess} onChange={event => setProcessDraft(current => ({ ...current, ratePerProcess: event.target.value }))} placeholder="Enter rate"/></label>
              <label>Transport cost per component (₹)<input type="number" min="0" step="0.01" value={processDraft.transportCostPerPart} onChange={event => setProcessDraft(current => ({ ...current, transportCostPerPart: event.target.value }))}/></label>
              <label>Calculated process plan / component (₹)<input readOnly value={money((Number(processDraft.quantityPerPart) || 0) * (Number(processDraft.ratePerProcess) || 0) + (Number(processDraft.transportCostPerPart) || 0))}/></label>
              <label className="ccp-process-notes"><span>Notes</span><input value={processDraft.notes} onChange={event => setProcessDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Operation assumptions, tolerance, batch basis…"/></label>
            </div>
            {!processTypes.length && <p className="ccp-inline-note">Create your actual process categories and types in Process Directory before adding process budgets.</p>}
            <div className="ccp-process-actions"><button className="button-primary" onClick={saveProcessPlan}><Check size={13}/> Save process plan</button><button className="button-quiet" onClick={() => setShowProcessForm(false)}>Cancel</button></div>
          </div>}
          {selectedProcessPlans.length ? <div className="ccp-table-wrap"><table className="ccp-table"><thead><tr><th>Sequence / process</th><th>Preferred vendor</th><th>Qty / component</th><th>Rate / process unit</th><th>Transport / component</th><th>Planned route cost / component</th><th>Actions</th></tr></thead><tbody>{selectedProcessPlans.map(row => {
            const type = processTypes.find(item => item.id === row.processTypeId);
            const vendor = vendors.find(item => item.id === row.vendorId);
            const category = categories.find(item => item.id === type?.categoryId);
            const cost = row.quantityPerPart * row.ratePerProcess + row.transportCostPerPart;
            return <tr key={row.id}><td><strong>{category?.name || "Process"} · {type?.name || "Archived process"}</strong><small>{row.notes || "No planning note"}</small></td><td>{vendor?.company || (row.vendorId ? "Vendor unavailable" : "In-house")}</td><td>{row.quantityPerPart}</td><td>{money(row.ratePerProcess)}</td><td>{money(row.transportCostPerPart)}</td><td><strong>{money(cost)}</strong></td><td><span className="ccp-actions"><button className="button-quiet compact-button" onClick={() => beginEditProcess(row)} title="Edit process cost"><Pencil size={12}/></button><button className="button-quiet compact-button" onClick={() => archiveProcessPlan(row)} title="Archive process cost"><Trash2 size={12}/></button></span></td></tr>;
          })}</tbody></table></div> : <div className="ccp-empty-process"><Workflow size={25}/><strong>No process costs planned for this component</strong><span>Add only the stages this part actually needs. Process plan rows are independent of the operation execution/payment records.</span></div>}
          <div className="ccp-process-total"><span>Planned process route / finished component</span><strong>{money(processCostPerPart)}</strong></div>
        </section>

        <section className="ccp-tally-strip">
          <div><small>NON-PROCESS COSTS / PIECE</small><strong>{money(nonProcessPlanPerPart)}</strong></div>
          <div><small>PROCESS ROUTE / PIECE</small><strong>{money(processCostPerPart)}</strong></div>
          <div><small>MASTER PLANNED COST / PIECE</small><strong>{money(plannedCostPerPart)}</strong></div>
          <div><small>TARGET MARGIN / PIECE</small><strong>{money(plannedMargin)}</strong></div>
        </section>
      </main> : <div className="surface-panel ccp-empty-main"><ClipboardList size={30}/><h3>Select a component to begin</h3><p>Each component has an independent cost plan. Your planned values will never be substituted for actual supplier invoices or payment entries.</p></div>}
    </div>
    <div className="module-safety-note"><ShieldCheck size={14}/><span>Planned component costs are a separate benchmark. Process Map continues to store operation rates and payment states by PO line; Costing & Payments compares those saved values against this baseline without rewriting vendor actuals. No missing rates are silently converted into approved costs.</span></div>
  </section>;
}
