import { useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarClock, Check, CircleDollarSign, Edit3, Factory, FileText, Package, Plus, Search, Trash2, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type CompanyRecord, type ComponentRecord, type FactoryRecord, type PurchaseOrderLine, type PurchaseOrderRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = {
  moduleId: "companies" | "purchasing" | "components";
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  onSelectModule: (id: string) => void;
};

const blankCompany = (): Omit<CompanyRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({ name: "", gstin: "", phone: "", email: "", notes: "" });
const blankFactory = (): Omit<FactoryRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({ companyId: "", name: "", address: "", contactPhone: "" });
const blankComponent = (): Omit<ComponentRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  partNumber: "", name: "", revision: "", material: "", drawingReference: "", notes: "",
  salePrice: 0, materialQty: 0, materialRate: 0, benchmarkMaterialRate: 0, stockQty: 0,
  overhead: 0, toolingCost: 0, reworkCost: 0, scrapCost: 0, rejectedQty: 0, gstRate: 0
});
const blankPO = (): Omit<PurchaseOrderRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  number: "", companyId: "", factoryId: "", issueDate: new Date().toISOString().slice(0, 10),
  targetDelivery: "", status: "Open", notes: "", lines: []
});
const blankLine = (): Omit<PurchaseOrderLine, "id"> => ({ componentId: "", quantity: 0, targetDelivery: "", unitPrice: 0, notes: "" });

export default function ManufacturingMasterWorkspace({ moduleId, onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const components = activeRows(data.components);
  const orders = activeRows(data.purchaseOrders);
  const [tab, setTab] = useState<"companies" | "factories">(moduleId === "companies" ? "companies" : "companies");
  const [search, setSearch] = useState("");
  const [companyDraft, setCompanyDraft] = useState(blankCompany);
  const [factoryDraft, setFactoryDraft] = useState(blankFactory);
  const [componentDraft, setComponentDraft] = useState(blankComponent);
  const [poDraft, setPoDraft] = useState(blankPO);
  const [poLines, setPoLines] = useState<Array<PurchaseOrderLine>>([]);
  const [companyEditingId, setCompanyEditingId] = useState("");
  const [factoryEditingId, setFactoryEditingId] = useState("");
  const [componentEditingId, setComponentEditingId] = useState("");
  const [poEditingId, setPoEditingId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const componentName = (id: string) => components.find(c => c.id === id)?.partNumber || components.find(c => c.id === id)?.name || "Deleted / missing component";
  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "Company not found";
  const factoryName = (id: string) => factories.find(f => f.id === id)?.name || "Factory not found";
  const filteredCompanies = useMemo(() => companies.filter(c => (c.name + " " + c.gstin + " " + c.phone + " " + c.email).toLowerCase().includes(search.toLowerCase().trim())), [companies, search]);
  const filteredFactories = useMemo(() => factories.filter(f => (f.name + " " + f.address + " " + companyName(f.companyId)).toLowerCase().includes(search.toLowerCase().trim())), [factories, search, data.companies]);
  const filteredComponents = useMemo(() => components.filter(c => (c.partNumber + " " + c.name + " " + c.material + " " + c.drawingReference + " " + c.revision).toLowerCase().includes(search.toLowerCase().trim())), [components, search]);
  const filteredOrders = useMemo(() => orders.filter(p => (p.number + " " + companyName(p.companyId) + " " + factoryName(p.factoryId) + " " + p.lines.map(l => componentName(l.componentId)).join(" ")).toLowerCase().includes(search.toLowerCase().trim())), [orders, search, data.companies, data.factories, data.components]);

  const resetForms = () => {
    setShowForm(false); setCompanyEditingId(""); setFactoryEditingId(""); setComponentEditingId(""); setPoEditingId("");
    setCompanyDraft(blankCompany()); setFactoryDraft(blankFactory()); setComponentDraft(blankComponent()); setPoDraft(blankPO()); setPoLines([]);
  };
  const beginAdd = () => {
    resetForms();
    if (moduleId === "companies") {
      if (tab === "factories") { setFactoryDraft({ ...blankFactory(), companyId: selectedCompanyId || companies[0]?.id || "" }); }
    }
    if (moduleId === "purchasing") setPoLines([{ ...blankLine(), id: makeId("line") }]);
    setShowForm(true);
  };
  const saveCompany = () => {
    if (!companyDraft.name.trim()) { onNotice("Enter a company name."); return; }
    const stamp = nowIso();
    const id = companyEditingId || makeId("company");
    update(current => ({ ...current, companies: [...current.companies.filter(x => x.id !== id), { ...companyDraft, name: companyDraft.name.trim(), id, createdAt: current.companies.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Company saved. It can now be linked to factories and purchase orders.");
  };
  const saveFactory = () => {
    if (!factoryDraft.companyId || !factoryDraft.name.trim()) { onNotice("Select the parent company and enter a factory name."); return; }
    const stamp = nowIso(); const id = factoryEditingId || makeId("factory");
    update(current => ({ ...current, factories: [...current.factories.filter(x => x.id !== id), { ...factoryDraft, name: factoryDraft.name.trim(), id, createdAt: current.factories.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Factory saved and linked to its company by record ID.");
  };
  const saveComponent = () => {
    if (!componentDraft.partNumber.trim() || !componentDraft.name.trim()) { onNotice("Component / part number and name are required."); return; }
    const stamp = nowIso(); const id = componentEditingId || makeId("component");
    update(current => ({ ...current, components: [...current.components.filter(x => x.id !== id), { ...componentDraft, partNumber: componentDraft.partNumber.trim(), name: componentDraft.name.trim(), revision: componentDraft.revision.trim(), id, createdAt: current.components.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Component master saved. Purchase-order lines, operations and quotations can link to this component ID.");
  };
  const savePO = () => {
    if (!poDraft.number.trim() || !poDraft.companyId || !poDraft.factoryId) { onNotice("Select a company and factory, and enter the purchase-order number."); return; }
    if (!poLines.length || poLines.some(line => !line.componentId || line.quantity <= 0)) { onNotice("Add at least one component line and set a component and positive quantity on every line."); return; }
    const stamp = nowIso(); const id = poEditingId || makeId("po");
    const lines = poLines.map(line => ({ ...line, id: line.id || makeId("line"), targetDelivery: line.targetDelivery || poDraft.targetDelivery }));
    update(current => ({ ...current, purchaseOrders: [...current.purchaseOrders.filter(x => x.id !== id), { ...poDraft, number: poDraft.number.trim(), id, lines, createdAt: current.purchaseOrders.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Purchase order saved. Each PO line now points to a component record ID; the Process Map can load the selected line, quantity and delivery target automatically.");
  };

  const editCompany = (row: CompanyRecord) => { resetForms(); setCompanyDraft({ name: row.name, gstin: row.gstin, phone: row.phone, email: row.email, notes: row.notes }); setCompanyEditingId(row.id); setShowForm(true); };
  const editFactory = (row: FactoryRecord) => { resetForms(); setFactoryDraft({ companyId: row.companyId, name: row.name, address: row.address, contactPhone: row.contactPhone }); setFactoryEditingId(row.id); setShowForm(true); };
  const editComponent = (row: ComponentRecord) => {
    resetForms();
    const { id, createdAt, updatedAt, deletedAt, ...draft } = row;
    setComponentDraft(draft); setComponentEditingId(row.id); setShowForm(true);
  };
  const editPO = (row: PurchaseOrderRecord) => {
    resetForms();
    const { id, createdAt, updatedAt, deletedAt, ...draft } = row;
    setPoDraft(draft); setPoLines(row.lines.map(line => ({ ...line }))); setPoEditingId(row.id); setShowForm(true);
  };
  const archive = (collection: "companies" | "factories" | "components" | "purchaseOrders", id: string) => {
    if (!window.confirm("Archive this record? It will be hidden from active selectors but retained in history to protect linked records.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, [collection]: current[collection].map(row => row.id === id ? { ...row, deletedAt: stamp, updatedAt: stamp } : row) } as typeof current));
    onNotice("Record archived. Linked historical records remain intact.");
  };

  const header = moduleId === "companies" ? "Companies & factories" : moduleId === "purchasing" ? "Purchase orders & PO components" : "Component master";
  const description = moduleId === "companies"
    ? "Create each company once, then add its factories; records link by stable IDs."
    : moduleId === "purchasing"
      ? "Create each PO once and add multiple component lines; every line stores component ID, quantity and target delivery."
      : "Create each part number once with revision, material and drawing reference; use the same record in every order, route and costing view.";

  return <section className="workspace-page module-functional-page master-data-page">
    {notice && <div className="notice-banner"><Check size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL DATA · SERVER NOT CONNECTED"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER RECORDS / LINKED DATA</div><h1>{header}<span>.</span></h1><p>{description}</p></div>
      <div className="workspace-title-actions">
        {moduleId === "components" && <button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={15}/> Component costing</button>}
        {moduleId === "purchasing" && <button className="button-quiet" onClick={() => onSelectModule("process-map")}><ArrowRight size={15}/> Open Process Map</button>}
        <button className="button-primary" onClick={beginAdd}><Plus size={15}/> {moduleId === "companies" ? tab === "companies" ? "Add Company" : "Add Factory" : moduleId === "purchasing" ? "Create Purchase Order" : "Add Component"}</button>
      </div>
    </div>
    {moduleId === "companies" && <div className="costing-tabs">
      <button className={tab === "companies" ? "costing-tab-active" : ""} onClick={() => { setTab("companies"); resetForms(); }}><Building2 size={15}/> Companies ({companies.length})</button>
      <button className={tab === "factories" ? "costing-tab-active" : ""} onClick={() => { setTab("factories"); resetForms(); }}><Factory size={15}/> Factories ({factories.length})</button>
    </div>}
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Search " + header.toLowerCase() + "…"}/></label><span className="module-number">{moduleId === "companies" ? tab === "companies" ? companies.length + " COMPANIES" : factories.length + " FACTORIES" : moduleId === "purchasing" ? orders.length + " ORDERS" : components.length + " COMPONENTS"}</span></div>
    {showForm && <section className="surface-panel module-record-form-panel">
      <div className="panel-heading"><div><h3>{moduleId === "companies" ? companyEditingId ? "Edit company" : factoryEditingId ? "Edit factory" : tab === "companies" ? "New company" : "New factory" : moduleId === "purchasing" ? poEditingId ? "Edit purchase order" : "New purchase order" : componentEditingId ? "Edit component" : "New component"}</h3><p>Required fields are checked before the record is saved.</p></div><button className="icon-control" onClick={resetForms} aria-label="Close form"><X size={15}/></button></div>
      {moduleId === "companies" && !factoryEditingId && tab === "companies" && <div className="module-record-form">
        <label>Company name *<input value={companyDraft.name} onChange={e => setCompanyDraft({ ...companyDraft, name: e.target.value })} placeholder="Enter your actual registered company name"/></label>
        <label>GSTIN<input value={companyDraft.gstin} onChange={e => setCompanyDraft({ ...companyDraft, gstin: e.target.value.toUpperCase() })} placeholder="Optional"/></label>
        <label>Phone<input value={companyDraft.phone} onChange={e => setCompanyDraft({ ...companyDraft, phone: e.target.value })} placeholder="Country code + number"/></label>
        <label>Email<input type="email" value={companyDraft.email} onChange={e => setCompanyDraft({ ...companyDraft, email: e.target.value })} placeholder="Accounts / contact email"/></label>
        <label className="module-form-wide">Notes<input value={companyDraft.notes} onChange={e => setCompanyDraft({ ...companyDraft, notes: e.target.value })} placeholder="Optional notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveCompany}><Check size={14}/> Save company</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "companies" && (factoryEditingId || tab === "factories") && <div className="module-record-form">
        <SearchablePicker id="factory-parent-company" label="Parent company *" value={factoryDraft.companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={companyId=>setFactoryDraft({...factoryDraft,companyId})}/>
        <label>Factory / site name *<input value={factoryDraft.name} onChange={e => setFactoryDraft({ ...factoryDraft, name: e.target.value })} placeholder="Enter factory name"/></label>
        <label>Address<input value={factoryDraft.address} onChange={e => setFactoryDraft({ ...factoryDraft, address: e.target.value })} placeholder="Factory address"/></label>
        <label>Factory contact phone<input value={factoryDraft.contactPhone} onChange={e => setFactoryDraft({ ...factoryDraft, contactPhone: e.target.value })} placeholder="Optional"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveFactory}><Check size={14}/> Save factory</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
        {!companies.length && <div className="module-safety-note">Add a company first; a factory must reference its parent company.</div>}
      </div>}
      {moduleId === "components" && <div className="module-record-form">
        <label>Component / part number *<input value={componentDraft.partNumber} onChange={e => setComponentDraft({ ...componentDraft, partNumber: e.target.value })} placeholder="Customer or internal part number"/></label>
        <label>Component name *<input value={componentDraft.name} onChange={e => setComponentDraft({ ...componentDraft, name: e.target.value })} placeholder="Actual component name"/></label>
        <label>Drawing revision<input value={componentDraft.revision} onChange={e => setComponentDraft({ ...componentDraft, revision: e.target.value })} placeholder="e.g. Rev A"/></label>
        <label>Material / grade<input value={componentDraft.material} onChange={e => setComponentDraft({ ...componentDraft, material: e.target.value })} placeholder="Actual material and grade"/></label>
        <label>Drawing number / file reference<input value={componentDraft.drawingReference} onChange={e => setComponentDraft({ ...componentDraft, drawingReference: e.target.value })} placeholder="Drawing reference"/></label>
        <label>Selling rate per accepted part (₹)<input type="number" min="0" step="0.01" value={componentDraft.salePrice} onChange={e => setComponentDraft({ ...componentDraft, salePrice: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label>Material quantity for batch<input type="number" min="0" step="0.001" value={componentDraft.materialQty} onChange={e => setComponentDraft({ ...componentDraft, materialQty: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label>Material purchase rate (₹ / unit)<input type="number" min="0" step="0.01" value={componentDraft.materialRate} onChange={e => setComponentDraft({ ...componentDraft, materialRate: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label>Benchmark material rate (optional)<input type="number" min="0" step="0.01" value={componentDraft.benchmarkMaterialRate} onChange={e => setComponentDraft({ ...componentDraft, benchmarkMaterialRate: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label>Opening stock<input type="number" min="0" value={componentDraft.stockQty} onChange={e => setComponentDraft({ ...componentDraft, stockQty: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label className="module-form-wide">Notes<input value={componentDraft.notes} onChange={e => setComponentDraft({ ...componentDraft, notes: e.target.value })} placeholder="Optional engineering / purchase notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveComponent}><Check size={14}/> Save component</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "purchasing" && <div className="module-record-form">
        <label>PO number *<input value={poDraft.number} onChange={e => setPoDraft({ ...poDraft, number: e.target.value })} placeholder="Enter the customer's actual PO number"/></label>
        <SearchablePicker id="po-company" label="Company *" value={poDraft.companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={companyId=>{const factoryId=factories.find(f=>f.companyId===companyId)?.id||"";setPoDraft({...poDraft,companyId,factoryId});}}/>
        <SearchablePicker id="po-factory" label="Factory *" value={poDraft.factoryId} placeholder="Type factory name…" options={factories.filter(f=>f.companyId===poDraft.companyId).map(f=>({id:f.id,label:f.name}))} onChange={factoryId=>setPoDraft({...poDraft,factoryId})}/>
        <label>PO issue date<input type="date" value={poDraft.issueDate} onChange={e => setPoDraft({ ...poDraft, issueDate: e.target.value })}/></label>
        <label>Target delivery<input type="date" value={poDraft.targetDelivery} onChange={e => setPoDraft({ ...poDraft, targetDelivery: e.target.value })}/></label>
        <label>Status<select value={poDraft.status} onChange={e => setPoDraft({ ...poDraft, status: e.target.value })}><option>Open</option><option>Confirmed</option><option>In Production</option><option>Complete</option><option>On Hold</option><option>Cancelled</option></select></label>
        <label className="module-form-wide">PO notes<input value={poDraft.notes} onChange={e => setPoDraft({ ...poDraft, notes: e.target.value })} placeholder="Optional PO notes"/></label>
        <div className="module-form-wide"><div className="panel-heading"><div><h3>PO component lines</h3><p>Each row references a saved component master record and keeps its own quantity and delivery date.</p></div><button type="button" className="button-quiet compact-button" disabled={!components.length} onClick={() => setPoLines(prev => [...prev, { ...blankLine(), targetDelivery: poDraft.targetDelivery, id: makeId("line") }])}><Plus size={14}/> Add component line</button></div>
          {poLines.map((line, index) => <div className="module-record-form po-line-form" key={line.id}>
            <SearchablePicker id={"po-line-component-"+line.id} label="Component *" value={line.componentId} placeholder="Type part number…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={componentId=>setPoLines(prev=>prev.map(row=>row.id===line.id?{...row,componentId}:row))}/>
            <label>Quantity *<input type="number" min="1" value={line.quantity || ""} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, quantity: Math.max(0, Number(e.target.value) || 0) } : row))}/></label>
            <label>Line delivery date<input type="date" value={line.targetDelivery} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, targetDelivery: e.target.value } : row))}/></label>
            <label>Customer rate / part (₹)<input type="number" min="0" step="0.01" value={line.unitPrice || ""} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, unitPrice: Math.max(0, Number(e.target.value) || 0) } : row))}/></label>
            <label className="module-form-wide">Line notes<input value={line.notes} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, notes: e.target.value } : row))} placeholder="Optional"/></label>
            <button type="button" className="button-quiet compact-button" onClick={() => setPoLines(prev => prev.filter(row => row.id !== line.id))}><Trash2 size={13}/> Remove line {index + 1}</button>
          </div>)}
          {!components.length && <div className="module-empty-state"><p>Create component master records before adding PO lines.</p><button className="button-primary" onClick={() => onSelectModule("components")}>Open Components <ArrowRight size={14}/></button></div>}
        </div>
        <div className="module-form-actions"><button className="button-primary" onClick={savePO}><Check size={14}/> Save purchase order</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
    </section>}
    <div className="module-workbench-grid"><section className="surface-panel module-records-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> ACTIVE MASTER DATA</div><h3>{header}</h3><p>Only records you or your imports have saved appear here.</p></div></div>
      {moduleId === "companies" && (tab === "companies" ? filteredCompanies.length ? <div className="module-record-list">{filteredCompanies.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Building2 size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{row.gstin || "GSTIN not entered"} · {row.phone || "Phone not entered"}</span><p>{row.email || "No email entered"} {row.notes ? "· " + row.notes : ""}</p><button className="inline-module-link" onClick={() => { setTab("factories"); setSelectedCompanyId(row.id); setFactoryDraft({ ...blankFactory(), companyId: row.id }); resetForms(); }}><Factory size={13}/> Manage factories for {row.name} <ArrowRight size={13}/></button></div><div className="module-record-card-actions"><button onClick={() => editCompany(row)}>Edit</button><button onClick={() => archive("companies", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Building2 size={28}/><h3>No companies added</h3><p>No placeholder company is preloaded. Add your actual company once and reuse it across all purchase orders and routes.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add your company</button></div> : filteredFactories.length ? <div className="module-record-list">{filteredFactories.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Factory size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{companyName(row.companyId)}</span><p>{row.address || "No address entered"} · {row.contactPhone || "No contact phone"}</p></div><div className="module-record-card-actions"><button onClick={() => editFactory(row)}>Edit</button><button onClick={() => archive("factories", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Factory size={28}/><h3>No factories added</h3><p>Add a factory and link it to its parent company.</p><button className="button-primary" disabled={!companies.length} onClick={beginAdd}><Plus size={14}/> Add factory</button></div>)}
      {moduleId === "components" && (filteredComponents.length ? <div className="module-record-list">{filteredComponents.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Package size={18}/></div><div className="module-record-copy"><strong>{row.partNumber} · {row.name}</strong><span>Rev {row.revision || "—"} · {row.material || "Material not specified"}</span><p>{row.drawingReference || "No drawing reference"} · {data.purchaseOrders.filter(p => p.lines.some(l => l.componentId === row.id)).length} linked PO(s)</p></div><div className="module-record-card-actions"><button onClick={() => editComponent(row)}>Edit</button><button onClick={() => archive("components", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Package size={28}/><h3>No components added</h3><p>Save each part number once. Quotations, operations and PO lines will refer back to this component record.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add component</button></div>)}
      {moduleId === "purchasing" && (filteredOrders.length ? <div className="module-record-list">{filteredOrders.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><FileText size={18}/></div><div className="module-record-copy"><strong>{row.number}</strong><span>{companyName(row.companyId)} · {factoryName(row.factoryId)}</span><p>{row.lines.length} component line(s) · {row.lines.reduce((n,l) => n + l.quantity, 0).toLocaleString("en-IN")} pcs · Due {row.targetDelivery || "not set"}</p><div className="related-row-stack">{row.lines.map(line => <small key={line.id}>{componentName(line.componentId)} · {line.quantity.toLocaleString("en-IN")} pcs · {line.targetDelivery || row.targetDelivery || "No line date"}</small>)}</div></div><div className="module-record-card-actions"><span className="record-state">{row.status}</span><button onClick={() => editPO(row)}>Edit</button><button onClick={() => archive("purchaseOrders", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><FileText size={28}/><h3>No purchase orders added</h3><p>Create a PO and add one or many component lines; the Process Map will take its quantity and dates from the selected line.</p><button className="button-primary" disabled={!companies.length || !factories.length || !components.length} onClick={beginAdd}><Plus size={14}/> Create purchase order</button></div>)}
    </section>
      <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> NEXT WORKFLOW</div><h3>Linked modules</h3><p>Use saved records to prevent duplicate typing.</p></div></div>
        {moduleId === "companies" ? <><button className="related-row" onClick={() => { setTab("factories"); beginAdd(); }}><Factory size={16}/><span><strong>Factories</strong><small>{factories.length} saved sites</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("purchasing")}><FileText size={16}/><span><strong>Purchase orders</strong><small>{orders.length} saved orders</small></span><ArrowRight size={14}/></button></> : moduleId === "components" ? <><button className="related-row" onClick={() => onSelectModule("purchasing")}><FileText size={16}/><span><strong>PO components</strong><small>{orders.reduce((n,p) => n + p.lines.length, 0)} saved lines</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Operations linked by component + PO line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Supplier rates per component and process</small></span><ArrowRight size={14}/></button></> : <><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Load a PO component line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Compare rates for the PO component</small></span><ArrowRight size={14}/></button></>}
        <div className="module-safety-note"><CalendarClock size={14}/><span>Master data sync is {syncStatus === "synced" ? "connected to the configured server" : "local until the existing AXIMACH server URL/API key are configured in Communication & Follow-up"}. Store the server on persistent hosting for cross-device access.</span></div>
      </aside>
    </div>
  </section>;
}
