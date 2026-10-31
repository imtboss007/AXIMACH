import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ClipboardCheck, FileText, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type InspectionMeasurementRecord, type InspectionMeasurementResult, type QualityInspectionRecord, type QualityInspectionStatus
} from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type ProcessSelection = { companyId: string; factoryId: string; poId: string; poLineId: string; operationId: string };
type Props = {
  onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void;
  initialOperationId?: string; onInitialOperationApplied?: () => void;
  onOpenOperation: (selection: ProcessSelection) => void;
};
type Draft = Omit<QualityInspectionRecord, "id" | "companyId" | "factoryId" | "poId" | "poLineId" | "componentId" | "operationId" | "createdAt" | "updatedAt" | "deletedAt">;
const blankMeasurement = (): InspectionMeasurementRecord => ({
  id: makeId("measurement"), characteristic: "", nominal: "", lowerLimit: "", upperLimit: "",
  actual: "", unit: "", gaugeReference: "", result: "Not measured"
});
const blankDraft = (): Draft => ({
  stage: "In-process", inspectionDate: "", inspector: "", instrument: "", sampleSize: 0,
  inspectedQty: 0, acceptedQty: 0, rejectedQty: 0, status: "Pending",
  measurements: [], nonConformanceReference: "", correctiveAction: "", notes: ""
});
const statuses: QualityInspectionStatus[] = ["Pending", "Accepted", "Rejected", "Conditional", "Hold"];
const stages = ["Incoming", "First article", "In-process", "Final", "Re-inspection", "Other"];
const moneyless = (value: number) => Number(value || 0).toLocaleString("en-IN");
const measurementResult = (row: InspectionMeasurementRecord): InspectionMeasurementResult => {
  const actual = row.actual.trim() === "" ? NaN : Number(row.actual);
  const lower = row.lowerLimit.trim() === "" ? undefined : Number(row.lowerLimit);
  const upper = row.upperLimit.trim() === "" ? undefined : Number(row.upperLimit);
  if (!Number.isFinite(actual) || (lower !== undefined && !Number.isFinite(lower)) || (upper !== undefined && !Number.isFinite(upper))) return "Not measured";
  if (lower === undefined && upper === undefined) return "Not measured";
  if (lower !== undefined && actual < lower) return "Fail";
  if (upper !== undefined && actual > upper) return "Fail";
  return "Pass";
};

export default function QualityInspectionWorkspace({ onBack, onNotice, notice, onSelectModule, initialOperationId = "", onInitialOperationApplied, onOpenOperation }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const purchaseOrders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const operations = activeRows(data.operations);
  const inspections = activeRows(data.qualityInspections);

  const initialOperation = data.operations.find(row => row.id === initialOperationId);
  const initialPO = initialOperation ? data.purchaseOrders.find(row => row.id === initialOperation.poId) : undefined;
  const initialCompanyId = initialPO?.companyId || "";
  const [companyId, setCompanyId] = useState(initialCompanyId);
  const [factoryId, setFactoryId] = useState(initialPO?.factoryId || "");
  const [poId, setPoId] = useState(initialOperation?.poId || "");
  const [poLineId, setPoLineId] = useState(initialOperation?.poLineId || "");
  const [operationId, setOperationId] = useState(initialOperation?.id || "");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<Draft>(blankDraft());

  useEffect(() => { if (initialOperationId) onInitialOperationApplied?.(); }, []);

  const companyFactories = factories.filter(row => row.companyId === companyId);
  const companyOrders = purchaseOrders.filter(row => row.companyId === companyId && (!factoryId || row.factoryId === factoryId));
  const selectedPO = purchaseOrders.find(row => row.id === poId);
  const poLines = selectedPO?.lines.filter(line => !("deletedAt" in line && (line as typeof line & {deletedAt?: string}).deletedAt)) || [];
  const selectedLine = poLines.find(row => row.id === poLineId);
  const selectedComponent = components.find(row => row.id === selectedLine?.componentId);
  const lineOperations = operations.filter(row => row.poId === poId && row.poLineId === poLineId && row.componentId === selectedLine?.componentId);
  const selectedOperation = lineOperations.find(row => row.id === operationId);
  const selectedInspections = inspections.filter(row => row.operationId === operationId).sort((a,b) => (b.inspectionDate || "").localeCompare(a.inspectionDate || "") || b.updatedAt.localeCompare(a.updatedAt));
  const totalInspected = selectedInspections.reduce((sum,row) => sum + (Number(row.inspectedQty) || 0), 0);
  const totalAccepted = selectedInspections.reduce((sum,row) => sum + (Number(row.acceptedQty) || 0), 0);
  const totalRejected = selectedInspections.reduce((sum,row) => sum + (Number(row.rejectedQty) || 0), 0);

  const filteredHistory = useMemo(() => inspections.filter(row => {
    const po = data.purchaseOrders.find(item => item.id === row.poId);
    const line = po?.lines.find(item => item.id === row.poLineId);
    const component = components.find(item => item.id === row.componentId);
    const operation = data.operations.find(item => item.id === row.operationId);
    const company = data.companies.find(item => item.id === row.companyId);
    return [company?.name, po?.number, component?.partNumber, component?.name, operation?.name, row.stage, row.inspector, row.status, row.nonConformanceReference]
      .join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b) => (b.inspectionDate || "").localeCompare(a.inspectionDate || "") || b.updatedAt.localeCompare(a.updatedAt)), [inspections, data.purchaseOrders, data.operations, data.companies, components, search]);

  const changeCompany = (nextId: string) => { setCompanyId(nextId); setFactoryId(""); setPoId(""); setPoLineId(""); setOperationId(""); setShowForm(false); };
  const changeFactory = (nextId: string) => { setFactoryId(nextId); setPoId(""); setPoLineId(""); setOperationId(""); setShowForm(false); };
  const changePO = (nextId: string) => { setPoId(nextId); setPoLineId(""); setOperationId(""); setShowForm(false); };
  const changeLine = (nextId: string) => { setPoLineId(nextId); setOperationId(""); setShowForm(false); };
  const beginNew = () => {
    if (!selectedPO || !selectedLine || !selectedOperation) { onNotice("Select a saved PO component line and process operation before recording an inspection."); return; }
    setDraft(blankDraft()); setEditingId(""); setShowForm(true);
  };
  const editInspection = (row: QualityInspectionRecord) => {
    const operation = data.operations.find(item => item.id === row.operationId);
    const po = data.purchaseOrders.find(item => item.id === row.poId);
    if (operation && po) {
      setCompanyId(po.companyId); setFactoryId(po.factoryId); setPoId(po.id);
      setPoLineId(row.poLineId); setOperationId(row.operationId);
    }
    const { id, companyId: _companyId, factoryId: _factoryId, poId: _poId, poLineId: _poLineId, componentId: _componentId, operationId: _operationId, createdAt, updatedAt, deletedAt, ...form } = row;
    setDraft({ ...form, measurements: (form.measurements || []).map(item => ({...item})) });
    setEditingId(row.id); setShowForm(true);
  };
  const updateMeasurement = (id: string, patch: Partial<InspectionMeasurementRecord>) =>
    setDraft(current => ({ ...current, measurements: current.measurements.map(row => row.id === id ? { ...row, ...patch } : row) }));
  const addMeasurement = () => setDraft(current => ({ ...current, measurements: [...current.measurements, blankMeasurement()] }));

  const save = () => {
    if (!selectedPO || !selectedLine || !selectedComponent || !selectedOperation) { onNotice("The selected operation is no longer available. Re-select an active PO component and operation."); return; }
    if (draft.inspectedQty < draft.acceptedQty + draft.rejectedQty) { onNotice("Accepted plus rejected quantity cannot exceed inspected quantity."); return; }
    if (draft.inspectedQty < 0 || draft.acceptedQty < 0 || draft.rejectedQty < 0 || draft.sampleSize < 0) { onNotice("Inspection quantities cannot be negative."); return; }
    if (draft.acceptedQty + draft.rejectedQty > 0 && draft.status === "Pending") { onNotice("Select an inspection result status when accepted/rejected quantities are entered."); return; }
    const stamp = nowIso();
    const old = inspections.find(row => row.id === editingId);
    const record: QualityInspectionRecord = {
      ...draft,
      id: editingId || makeId("inspection"),
      companyId: selectedPO.companyId, factoryId: selectedPO.factoryId, poId: selectedPO.id,
      poLineId: selectedLine.id, componentId: selectedComponent.id, operationId: selectedOperation.id,
      measurements: draft.measurements.filter(row => row.characteristic.trim() || row.actual.trim()).map(row => ({
        ...row, characteristic: row.characteristic.trim(), result: measurementResult(row)
      })),
      nonConformanceReference: draft.nonConformanceReference.trim(),
      correctiveAction: draft.correctiveAction.trim(), inspector: draft.inspector.trim(),
      instrument: draft.instrument.trim(), notes: draft.notes.trim(),
      createdAt: old?.createdAt || stamp, updatedAt: stamp
    };
    update(current => ({ ...current, qualityInspections: [...current.qualityInspections.filter(row => row.id !== record.id), record] }));
    setShowForm(false); setEditingId("");
    onNotice("Inspection saved and linked to the exact company, factory, PO, component line and process operation. Operation cost/vendor assignment was not changed.");
  };
  const archive = (row: QualityInspectionRecord) => {
    if (!window.confirm("Archive this inspection record? The saved measurements and links remain in historical data.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, qualityInspections: current.qualityInspections.map(item => item.id === row.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item) }));
    onNotice("Inspection record archived. Linked PO, component and process operation were not changed.");
  };
  const openOperation = (row: QualityInspectionRecord) => {
    const po = data.purchaseOrders.find(item => item.id === row.poId);
    const operation = data.operations.find(item => item.id === row.operationId);
    const line = po?.lines.find(item => item.id === row.poLineId);
    if (!po || !operation || !line) { onNotice("The linked operation or PO line is unavailable. Historical inspection data remains readable."); return; }
    onOpenOperation({ companyId: row.companyId, factoryId: row.factoryId, poId: row.poId, poLineId: row.poLineId, operationId: row.operationId });
  };

  return <section className="workspace-page quality-workspace-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "QUALITY REGISTER"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUALITY / OPERATION-LINKED INSPECTION</div><h1>Quality & Inspection<span>.</span></h1><p>Record incoming, first-article, in-process and final inspections against the exact PO component operation. Inspection quantities and measurements remain separate from production progress and costing.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("process-map")}><ClipboardCheck size={15}/> Process Map</button><button className="button-primary" disabled={!selectedOperation} onClick={beginNew}><Plus size={15}/> Record inspection</button></div></div>

    <section className="surface-panel quality-selection-panel">
      <div className="panel-heading"><div><h3>Select manufacturing context</h3><p>Choose existing master records. The inspection record inherits their stable IDs and cannot be saved as an unlinked note.</p></div><span className="module-number">{inspections.length} SAVED INSPECTIONS</span></div>
      <div className="quality-selectors">
        <SearchablePicker id="quality-company" label="Company" value={companyId} placeholder="Select company…" options={companies.map(row => ({id:row.id,label:row.name}))} onChange={changeCompany}/>
        <SearchablePicker id="quality-factory" label="Factory" value={factoryId} placeholder="Select factory…" options={companyFactories.map(row => ({id:row.id,label:row.name}))} onChange={changeFactory}/>
        <SearchablePicker id="quality-po" label="Purchase order" value={poId} placeholder="Select PO…" options={companyOrders.map(row => ({id:row.id,label:row.number}))} onChange={changePO}/>
        <SearchablePicker id="quality-line" label="PO component line" value={poLineId} placeholder="Select component line…" options={poLines.map(row => {const component=components.find(item=>item.id===row.componentId);return {id:row.id,label:(component?.partNumber || "Part") + " · " + (component?.name || "Component") + " · " + moneyless(row.quantity) + " pcs"};})} onChange={changeLine}/>
        <SearchablePicker id="quality-operation" label="Process operation" value={operationId} placeholder="Select operation…" options={lineOperations.map(row => ({id:row.id,label:"OP-"+String(row.sequence).padStart(3,"0")+" · "+row.name+" · "+row.status}))} onChange={id=>{setOperationId(id);setShowForm(false);}}/>
      </div>
      {selectedOperation && <div className="quality-context-summary"><div><small>SELECTED COMPONENT / OPERATION</small><strong>{selectedComponent?.partNumber || "Part"} · {selectedComponent?.name || "Component"} / {selectedOperation.name}</strong><span>{selectedPO?.number} · {selectedOperation.category || "Process type not set"} · {selectedOperation.vendorId ? data.vendors.find(row=>row.id===selectedOperation.vendorId)?.company || "Vendor unavailable" : "Internal operation"}</span></div><div><small>INSPECTION TOTALS RECORDED</small><strong>{moneyless(totalInspected)} inspected · {moneyless(totalAccepted)} accepted · {moneyless(totalRejected)} rejected</strong><span>{selectedInspections.length} inspection record(s); not automatically added to production completion counts</span></div></div>}
    </section>

    {showForm && selectedOperation && <section className="surface-panel master-editor quality-editor">
      <div className="panel-heading"><div><h3>{editingId ? "Edit inspection record" : "New inspection record"}</h3><p>{selectedPO?.number} · {selectedComponent?.partNumber} · {selectedOperation.name}</p></div><button className="icon-control" onClick={()=>{setShowForm(false);setEditingId("");}} aria-label="Close editor"><X size={14}/></button></div>
      <div className="quality-form">
        <label>Inspection stage<select value={draft.stage} onChange={e=>setDraft({...draft,stage:e.target.value})}>{stages.map(stage=><option key={stage}>{stage}</option>)}</select></label>
        <label>Inspection date<input type="date" value={draft.inspectionDate} onChange={e=>setDraft({...draft,inspectionDate:e.target.value})}/></label>
        <label>Inspector / quality engineer<input value={draft.inspector} onChange={e=>setDraft({...draft,inspector:e.target.value})} placeholder="Name / employee reference"/></label>
        <label>Instrument / gauge<input value={draft.instrument} onChange={e=>setDraft({...draft,instrument:e.target.value})} placeholder="Instrument or gauge used"/></label>
        <label>Sample size<input type="number" min="0" value={draft.sampleSize || ""} onChange={e=>setDraft({...draft,sampleSize:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Inspected quantity<input type="number" min="0" value={draft.inspectedQty || ""} onChange={e=>setDraft({...draft,inspectedQty:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Accepted quantity<input type="number" min="0" value={draft.acceptedQty || ""} onChange={e=>setDraft({...draft,acceptedQty:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Rejected quantity<input type="number" min="0" value={draft.rejectedQty || ""} onChange={e=>setDraft({...draft,rejectedQty:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Overall inspection status<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as QualityInspectionStatus})}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label>
        <div className="quality-measurements">
          <div className="vendor-section-heading"><div><strong>Dimensional / characteristic measurements</strong><small>Enter actual limits and readings; Pass/Fail is calculated only when numeric limits are supplied.</small></div><button type="button" className="button-quiet compact-button" onClick={addMeasurement}><Plus size={13}/> Add measurement</button></div>
          {draft.measurements.map((row,index)=>{
            const result=measurementResult(row);
            return <div className="quality-measurement-row" key={row.id}>
              <label>Characteristic {index+1}<input value={row.characteristic} onChange={e=>updateMeasurement(row.id,{characteristic:e.target.value})} placeholder="Bore diameter, length, runout…"/></label>
              <label>Nominal<input value={row.nominal} onChange={e=>updateMeasurement(row.id,{nominal:e.target.value})} placeholder="Drawing nominal"/></label>
              <label>Lower limit<input value={row.lowerLimit} onChange={e=>updateMeasurement(row.id,{lowerLimit:e.target.value})} placeholder="Minimum"/></label>
              <label>Upper limit<input value={row.upperLimit} onChange={e=>updateMeasurement(row.id,{upperLimit:e.target.value})} placeholder="Maximum"/></label>
              <label>Actual reading<input value={row.actual} onChange={e=>updateMeasurement(row.id,{actual:e.target.value})} placeholder="Measured value"/></label>
              <label>Unit<input value={row.unit} onChange={e=>updateMeasurement(row.id,{unit:e.target.value})} placeholder="mm, µm…"/></label>
              <label>Gauge / instrument<input value={row.gaugeReference} onChange={e=>updateMeasurement(row.id,{gaugeReference:e.target.value})} placeholder="Gauge ID"/></label>
              <span className={"quality-measure-result quality-result-"+result.toLowerCase().replace(/\s+/g,"-")}>{result}</span>
              <button type="button" className="vendor-row-remove" onClick={()=>setDraft(current=>({...current,measurements:current.measurements.filter(item=>item.id!==row.id)}))} aria-label={"Remove characteristic "+(index+1)}><Trash2 size={14}/></button>
            </div>;
          })}
          {!draft.measurements.length && <p className="vendor-empty">No measurements entered. Inspection records can also capture quantity results and notes without dimensional readings.</p>}
        </div>
        <label>Non-conformance / NCR reference<input value={draft.nonConformanceReference} onChange={e=>setDraft({...draft,nonConformanceReference:e.target.value})} placeholder="NCR number or internal reference"/></label>
        <label>Corrective action<input value={draft.correctiveAction} onChange={e=>setDraft({...draft,correctiveAction:e.target.value})} placeholder="Containment / rework / disposition"/></label>
        <label className="quality-form-wide">Inspection notes<input value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})} placeholder="Record observation, sampling plan, drawing reference or inspection context"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={save}><Check size={14}/> Save inspection</button><button className="button-quiet" onClick={()=>{setShowForm(false);setEditingId("");}}>Cancel</button></div>
      </div>
    </section>}

    {selectedOperation && <section className="surface-panel quality-operation-history">
      <div className="panel-heading"><div><h3>Inspection history for {selectedOperation.name}</h3><p>{selectedInspections.length} inspection record(s) · {moneyless(totalInspected)} inspected · {moneyless(totalAccepted)} accepted · {moneyless(totalRejected)} rejected</p></div><button className="button-quiet compact-button" onClick={()=>onOpenOperation({companyId:selectedPO!.companyId,factoryId:selectedPO!.factoryId,poId:selectedPO!.id,poLineId:selectedLine!.id,operationId:selectedOperation.id})}>Open Process Map</button></div>
      {selectedInspections.length ? <div className="quality-history-list">{selectedInspections.map(row=><article key={row.id}><div><strong>{row.stage} · {row.inspectionDate || "Date not entered"}</strong><small>{row.inspector || "Inspector not entered"} · {row.inspectedQty} inspected / {row.acceptedQty} accepted / {row.rejectedQty} rejected · {row.measurements.length} characteristic(s)</small>{row.nonConformanceReference && <small>NCR: {row.nonConformanceReference}</small>}</div><span className={"record-state "+(row.status==="Accepted"?"state-complete":"")}>{row.status}</span><div className="module-record-card-actions"><button onClick={()=>editInspection(row)}>Edit</button><button onClick={()=>archive(row)}>Archive</button></div></article>)}</div> : <p className="vendor-empty">No inspections recorded for this operation yet.</p>}
    </section>}

    <section className="surface-panel quality-register">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> QUALITY HISTORY / ALL OPERATIONS</div><h3>Inspection register</h3><p>Search across every linked company, PO, component and operation.</p></div><span className="module-number">{inspections.length} RECORDS</span></div>
      <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search company, PO, component, operation, NCR or inspector…"/></label><span className="module-number">{filteredHistory.length} MATCHES</span></div>
      {filteredHistory.length ? <div className="costing-table-wrap"><table className="costing-table quality-table"><thead><tr><th>Date</th><th>Company</th><th>PO</th><th>Component</th><th>Operation</th><th>Stage</th><th>Inspector</th><th>Inspected</th><th>Accepted</th><th>Rejected</th><th>Status</th><th></th></tr></thead><tbody>{filteredHistory.map(row=>{
        const po=data.purchaseOrders.find(item=>item.id===row.poId);
        const component=data.components.find(item=>item.id===row.componentId);
        const operation=data.operations.find(item=>item.id===row.operationId);
        const company=data.companies.find(item=>item.id===row.companyId);
        return <tr key={row.id}><td>{row.inspectionDate||"—"}</td><td>{company?.name||"Archived company"}</td><td>{po?.number||"Archived PO"}</td><td>{component?.partNumber||"Archived component"}</td><td>{operation?.name||"Archived operation"}</td><td>{row.stage}</td><td>{row.inspector||"—"}</td><td>{moneyless(row.inspectedQty)}</td><td>{moneyless(row.acceptedQty)}</td><td>{moneyless(row.rejectedQty)}</td><td><span className="record-state">{row.status}</span></td><td><div className="module-record-card-actions"><button onClick={()=>editInspection(row)}>Edit</button><button onClick={()=>openOperation(row)} disabled={!po||!operation}>Open operation</button><button onClick={()=>archive(row)}>Archive</button></div></td></tr>;
      })}</tbody></table></div> : <div className="module-empty-state"><ClipboardCheck size={28}/><h3>{search?"No inspection records match":"No quality inspections recorded"}</h3><p>{search?"Try another search term.":"Start from a saved PO component operation and record actual inspection details. No sample inspection results are preloaded."}{!search && <button className="button-primary" disabled={!selectedOperation} onClick={beginNew}><Plus size={14}/> Record first inspection</button>}</p></div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Quality records are stored separately from vendor allocation, process cost and production quantity fields. Inspection values are not invented or automatically added to operational totals.</span></div>
  </section>;
}
