import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarClock, Check, CircleDollarSign, Edit3, Factory, FileDown, FileText, Package, Plus, Search, Trash2, X } from "lucide-react";
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
  partNumber: "", name: "", revision: "", salePriceUnit: "piece", drawingReference: "", notes: "",
  salePrice: 0, overhead: 0, toolingCost: 0, reworkCost: 0, scrapCost: 0, rejectedQty: 0, gstRate: 0
});
const blankPO = (): Omit<PurchaseOrderRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  number: "", companyId: "", factoryId: "", issueDate: new Date().toISOString().slice(0, 10),
  targetDelivery: "", status: "Open", notes: "", lines: []
});
const blankLine = (): Omit<PurchaseOrderLine, "id"> => ({ componentId: "", quantity: 0, targetDelivery: "", notes: "" });

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
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [openedPoId, setOpenedPoId] = useState("");
  const openedOrder = orders.find(order => order.id === openedPoId);
  useEffect(() => {
    if (openedPoId) document.getElementById("po-open-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openedPoId]);
  const togglePoSelection = (id: string) => setSelectedPoIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  const componentName = (id: string) => components.find(c => c.id === id)?.partNumber || components.find(c => c.id === id)?.name || "Deleted / missing component";
  const componentUnit = (id: string) => components.find(c => c.id === id)?.salePriceUnit === "set" ? "set" : "piece";
  const quantityLabel = (quantity: number, componentId: string) => quantity.toLocaleString("en-IN") + " " + componentUnit(componentId) + (quantity === 1 ? "" : "s");
  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "Company not found";
  const factoryName = (id: string) => factories.find(f => f.id === id)?.name || "Factory not found";
  const filteredCompanies = useMemo(() => companies.filter(c => (c.name + " " + c.gstin + " " + c.phone + " " + c.email).toLowerCase().includes(search.toLowerCase().trim())), [companies, search]);
  const filteredFactories = useMemo(() => factories.filter(f => (f.name + " " + f.address + " " + companyName(f.companyId)).toLowerCase().includes(search.toLowerCase().trim())), [factories, search, data.companies]);
  const filteredComponents = useMemo(() => components.filter(c => (c.partNumber + " " + c.name + " " + c.drawingReference + " " + c.revision).toLowerCase().includes(search.toLowerCase().trim())), [components, search]);
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
    const lines = poLines.map(line => { const clean = { ...line }; delete clean.unitPrice; return { ...clean, id: line.id || makeId("line"), targetDelivery: line.targetDelivery || poDraft.targetDelivery }; });
    update(current => ({ ...current, purchaseOrders: [...current.purchaseOrders.filter(x => x.id !== id), { ...poDraft, number: poDraft.number.trim(), id, lines, createdAt: current.purchaseOrders.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Purchase order saved. Each PO line now points to a component record ID; the Process Map can load the selected line, quantity and delivery target automatically.");
  };

  const editCompany = (row: CompanyRecord) => { resetForms(); setCompanyDraft({ name: row.name, gstin: row.gstin, phone: row.phone, email: row.email, notes: row.notes }); setCompanyEditingId(row.id); setShowForm(true); };
  const editFactory = (row: FactoryRecord) => { resetForms(); setFactoryDraft({ companyId: row.companyId, name: row.name, address: row.address, contactPhone: row.contactPhone }); setFactoryEditingId(row.id); setShowForm(true); };
  const editComponent = (row: ComponentRecord) => {
    resetForms();
    setComponentDraft({
      partNumber: row.partNumber || "", name: row.name || "", revision: row.revision || "",
      salePriceUnit: row.salePriceUnit === "set" ? "set" : row.orderUnit === "Set" ? "set" : "piece",
      drawingReference: row.drawingReference || "", notes: row.notes || "",
      salePrice: Number(row.salePrice) || 0, overhead: Number(row.overhead) || 0,
      toolingCost: Number(row.toolingCost) || 0, reworkCost: Number(row.reworkCost) || 0,
      scrapCost: Number(row.scrapCost) || 0, rejectedQty: Number(row.rejectedQty) || 0, gstRate: Number(row.gstRate) || 0
    });
    setComponentEditingId(row.id); setShowForm(true);
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

  const downloadPurchaseOrders = (ordersToExport: PurchaseOrderRecord[]) => {
    const headers = ["PO Number", "Company", "Factory", "Component Part Number", "Component Name", "Revision", "Order Quantity", "Unit", "Master Price / Unit", "PO Delivery Date", "Line Delivery Date", "Status", "PO Notes", "Line Notes"];
    const csvValue = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';
    const rows = ordersToExport.flatMap(order => order.lines.filter(line => !line.deletedAt).map(line => {
      const component = components.find(item => item.id === line.componentId);
      const unit = component?.salePriceUnit === "set" ? "Set" : "Piece";
      return [order.number, companyName(order.companyId), factoryName(order.factoryId),
        component?.partNumber || "Missing component", component?.name || "", component?.revision || "",
        line.quantity, unit, (component?.salePrice || 0) + " / " + unit, order.targetDelivery,
        line.targetDelivery || order.targetDelivery, order.status, order.notes, line.notes];
    }));
    const csv = [headers, ...rows].map(row => row.map(csvValue).join(",")).join("\\r\\n");
    const blob = new Blob([String.fromCharCode(0xfeff), csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = ordersToExport.length === 1
      ? "aximach-po-" + (ordersToExport[0].number || "order").replace(/[^a-z0-9-_]+/gi, "-") + ".csv"
      : "aximach-purchase-orders.csv";
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
    onNotice(rows.length + " PO component line(s) exported to CSV.");
  };

  const exportPurchaseOrdersPdf = (ordersToExport: PurchaseOrderRecord[]) => {
    if (!ordersToExport.length) { onNotice("Select one or more purchase orders first."); return; }
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char] || ""));
    const body = ordersToExport.map(order => {
      const lines = order.lines.filter(line => !line.deletedAt).map(line => {
        const component = components.find(item => item.id === line.componentId);
        const unit = component?.salePriceUnit === "set" ? "set" : "piece";
        return "<tr><td>" + escapeHtml(component?.partNumber || "Missing component") +
          "</td><td>" + escapeHtml(component?.name || "Missing component") +
          "</td><td>" + escapeHtml(quantityLabel(line.quantity, line.componentId)) +
          "</td><td>₹" + escapeHtml((component?.salePrice || 0).toLocaleString("en-IN")) + " / " + unit +
          "</td><td>" + escapeHtml(line.targetDelivery || order.targetDelivery || "—") + "</td></tr>";
      }).join("");
      return "<section class='po-sheet'><header><h1>AXIMACH · PURCHASE ORDER</h1><h2>" + escapeHtml(order.number) +
        "</h2></header><p><b>Company:</b> " + escapeHtml(companyName(order.companyId)) +
        " &nbsp; <b>Factory:</b> " + escapeHtml(factoryName(order.factoryId)) +
        "</p><p><b>PO date:</b> " + escapeHtml(order.issueDate) + " &nbsp; <b>Due:</b> " +
        escapeHtml(order.targetDelivery) + " &nbsp; <b>Status:</b> " + escapeHtml(order.status) +
        "</p><table><thead><tr><th>Component No.</th><th>Component Name</th><th>Quantity (piece / set)</th><th>Component Master Price / Unit</th><th>Delivery</th></tr></thead><tbody>" +
        lines + "</tbody></table><p>" + escapeHtml(order.notes) +
        "</p><footer>Generated from AXIMACH Component Master and Purchase Order records.</footer></section>";
    }).join("");
    const popup = window.open("", "_blank");
    if (!popup) { onNotice("Allow pop-ups to print or save the selected purchase orders as PDF. CSV download remains available."); return; }
    popup.document.open();
    popup.document.write("<!doctype html><html><head><meta charset='utf-8'><title>AXIMACH Purchase Orders</title><style>body{font:12px Arial;color:#172033;margin:24px}.po-sheet{page-break-after:always;margin-bottom:32px}.po-sheet:last-child{page-break-after:auto}h1{font-size:18px}h2{font-size:24px;margin:8px 0 18px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #9aa6b2;padding:8px;text-align:left}th{background:#e9eef5}footer{margin-top:40px;color:#637084}@media print{body{margin:12mm}}</style></head><body>" + body + "</body></html>");
    popup.document.close(); popup.focus(); popup.print();
  };

  const header = moduleId === "companies" ? "Companies & factories" : moduleId === "purchasing" ? "Purchase orders & PO components" : "Component master";
  const description = moduleId === "companies"
    ? "Create each company once, then add its factories; records link by stable IDs."
    : moduleId === "purchasing"
      ? "Create each PO once and add multiple component lines; every line stores component ID, quantity and target delivery."
      : "Create each part number once with a master component price per piece or per set; reuse the linked record in every purchase order.";

  return <section className="workspace-page module-functional-page master-data-page">
    {notice && <div className="notice-banner"><Check size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL DATA · SERVER NOT CONNECTED"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER RECORDS / LINKED DATA</div><h1>{header}<span>.</span></h1><p>{description}</p></div>
      <div className="workspace-title-actions">
        {moduleId === "components" && <button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={15}/> Component costing</button>}
        {moduleId === "purchasing" && <>
          <button className="button-quiet" onClick={() => onSelectModule("process-map")}><ArrowRight size={15}/> Open Process Map</button>
          <button className="button-quiet" disabled={!filteredOrders.length} onClick={() => downloadPurchaseOrders(filteredOrders)}><FileDown size={15}/> Download CSV</button>
        </>}
        <button className="button-primary" onClick={beginAdd}><Plus size={15}/> {moduleId === "companies" ? tab === "companies" ? "Add Company" : "Add Factory" : moduleId === "purchasing" ? "Create Purchase Order" : "Add Component"}</button>
      </div>
    </div>
    {moduleId === "companies" && <div className="costing-tabs">
      <button className={tab === "companies" ? "costing-tab-active" : ""} onClick={() => { setTab("companies"); resetForms(); }}><Building2 size={15}/> Companies ({companies.length})</button>
      <button className={tab === "factories" ? "costing-tab-active" : ""} onClick={() => { setTab("factories"); resetForms(); }}><Factory size={15}/> Factories ({factories.length})</button>
    </div>}
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Search " + header.toLowerCase() + "…"}/></label><span className="module-number">{moduleId === "companies" ? tab === "companies" ? companies.length + " COMPANIES" : factories.length + " FACTORIES" : moduleId === "purchasing" ? orders.length + " ORDERS" : components.length + " COMPONENTS"}</span></div>
    {moduleId === "purchasing" && <div className="module-action-bar po-bulk-actions">
      <label><input type="checkbox" checked={filteredOrders.length > 0 && filteredOrders.every(order => selectedPoIds.includes(order.id))} onChange={event => setSelectedPoIds(event.target.checked ? [...new Set([...selectedPoIds, ...filteredOrders.map(order => order.id)])] : selectedPoIds.filter(id => !filteredOrders.some(order => order.id === id)))} /> Select all visible</label>
      <span className="module-number">{selectedPoIds.filter(id => orders.some(order => order.id === id)).length} SELECTED</span>
      <button className="button-primary compact-button" disabled={!selectedPoIds.length} onClick={() => exportPurchaseOrdersPdf(orders.filter(order => selectedPoIds.includes(order.id)))}><FileDown size={14}/> Save selected PO PDF</button>
      <button className="button-quiet compact-button" disabled={!selectedPoIds.length} onClick={() => setSelectedPoIds([])}>Clear selection</button>
    </div>
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
        <label>Drawing number / file reference<input value={componentDraft.drawingReference} onChange={e => setComponentDraft({ ...componentDraft, drawingReference: e.target.value })} placeholder="Drawing reference"/></label>
        <label>Component price (₹)<input type="number" min="0" step="0.01" value={componentDraft.salePrice} onChange={e => setComponentDraft({ ...componentDraft, salePrice: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label>Price unit<select value={componentDraft.salePriceUnit} onChange={e => setComponentDraft({ ...componentDraft, salePriceUnit: e.target.value as "piece" | "set" })}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
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
            <label>Order quantity ({line.componentId ? componentUnit(line.componentId) : "piece / set"}) *<input type="number" min="1" value={line.quantity || ""} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, quantity: Math.max(0, Number(e.target.value) || 0) } : row))}/></label>
            <div className="module-safety-note module-form-wide"><strong>Component Master price:</strong> {line.componentId ? "₹" + (components.find(item => item.id === line.componentId)?.salePrice || 0).toLocaleString("en-IN") + " / per " + componentUnit(line.componentId) : "Select a component"} · This price and unit are linked from Component Master and cannot be edited on the PO line.</div>
            <label>Line delivery date<input type="date" value={line.targetDelivery} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, targetDelivery: e.target.value } : row))}/></label>
            <label className="module-form-wide">Line notes<input value={line.notes} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, notes: e.target.value } : row))} placeholder="Optional"/></label>
            <button type="button" className="button-quiet compact-button" onClick={() => setPoLines(prev => prev.filter(row => row.id !== line.id))}><Trash2 size={13}/> Remove line {index + 1}</button>
          </div>)}
          {!components.length && <div className="module-empty-state"><p>Create component master records before adding PO lines.</p><button className="button-primary" onClick={() => onSelectModule("components")}>Open Components <ArrowRight size={14}/></button></div>}
        </div>
        <div className="module-form-actions"><button className="button-primary" onClick={savePO}><Check size={14}/> Save purchase order</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
    </section>}
    <div className="module-workbench-grid"><section className="surface-panel module-records-panel">
      <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> ACTIVE MASTER DATA</div><h3>{header}</h3><p>{moduleId === "purchasing" ? "Open a PO to see its full component detail; save one or multiple POs as PDF or CSV." : "Only records you or your imports have saved appear here."}</p></div></div>
      {moduleId === "companies" && (tab === "companies" ? filteredCompanies.length ? <div className="module-record-list">{filteredCompanies.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Building2 size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{row.gstin || "GSTIN not entered"} · {row.phone || "Phone not entered"}</span><p>{row.email || "No email entered"} {row.notes ? "· " + row.notes : ""}</p><button className="inline-module-link" onClick={() => { setTab("factories"); setSelectedCompanyId(row.id); setFactoryDraft({ ...blankFactory(), companyId: row.id }); resetForms(); }}><Factory size={13}/> Manage factories for {row.name} <ArrowRight size={13}/></button></div><div className="module-record-card-actions"><button onClick={() => editCompany(row)}>Edit</button><button onClick={() => archive("companies", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Building2 size={28}/><h3>No companies added</h3><p>No placeholder company is preloaded. Add your actual company once and reuse it across all purchase orders and routes.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add your company</button></div> : filteredFactories.length ? <div className="module-record-list">{filteredFactories.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Factory size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{companyName(row.companyId)}</span><p>{row.address || "No address entered"} · {row.contactPhone || "No contact phone"}</p></div><div className="module-record-card-actions"><button onClick={() => editFactory(row)}>Edit</button><button onClick={() => archive("factories", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Factory size={28}/><h3>No factories added</h3><p>Add a factory and link it to its parent company.</p><button className="button-primary" disabled={!companies.length} onClick={beginAdd}><Plus size={14}/> Add factory</button></div>)}
      {moduleId === "components" && (filteredComponents.length ? <div className="module-record-list">{filteredComponents.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Package size={18}/></div><div className="module-record-copy"><strong>{row.partNumber} · {row.name}</strong><span>Rev {row.revision || "—"} · ₹{row.salePrice.toLocaleString("en-IN")} / {row.salePriceUnit === "set" ? "set" : "piece"}</span><p>{row.drawingReference || "No drawing reference"} · {data.purchaseOrders.filter(p => p.lines.some(l => l.componentId === row.id)).length} linked PO(s)</p></div><div className="module-record-card-actions"><button onClick={() => editComponent(row)}>Edit</button><button onClick={() => archive("components", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Package size={28}/><h3>No components added</h3><p>Save each part number once. Quotations, operations and PO lines will refer back to this component record.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add component</button></div>)}
      {moduleId === "purchasing" && (filteredOrders.length ? <div className="module-record-list">{filteredOrders.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><FileText size={18}/></div><div className="module-record-copy"><strong>{row.number}</strong><span>{companyName(row.companyId)} · {factoryName(row.factoryId)}</span><p>{row.lines.length} component line(s) · {row.lines.reduce((n,l) => n + l.quantity, 0).toLocaleString("en-IN")} ordered units · Due {row.targetDelivery || "not set"}</p><div className="related-row-stack">{row.lines.map(line => { const linked = components.find(item => item.id === line.componentId); return <small key={line.id}>{componentName(line.componentId)} · {quantityLabel(line.quantity, line.componentId)} · Master price ₹{(linked?.salePrice || 0).toLocaleString("en-IN")} / {componentUnit(line.componentId)} · {line.targetDelivery || row.targetDelivery || "No line date"}</small>; })}</div></div><div className="module-record-card-actions"><label className="po-row-select" aria-label={"Select PO " + row.number}><input type="checkbox" checked={selectedPoIds.includes(row.id)} onChange={() => togglePoSelection(row.id)}/></label><span className="record-state">{row.status}</span><button aria-expanded={openedPoId === row.id} onClick={() => setOpenedPoId(openedPoId === row.id ? "" : row.id)}>{openedPoId === row.id ? "Close" : "Open"}</button><button className="button-quiet compact-button" onClick={() => exportPurchaseOrdersPdf([row])}><FileDown size={13}/> Save PDF</button><button className="button-quiet compact-button" onClick={() => downloadPurchaseOrders([row])}><FileDown size={13}/> CSV</button><button onClick={() => editPO(row)}>Edit</button><button onClick={() => archive("purchaseOrders", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><FileText size={28}/><h3>No purchase orders added</h3><p>Create a PO and add one or many component lines; the Process Map will take its quantity and dates from the selected line.</p><button className="button-primary" disabled={!companies.length || !factories.length || !components.length} onClick={beginAdd}><Plus size={14}/> Create purchase order</button></div>)}
      {moduleId === "purchasing" && openedOrder && <section id="po-open-detail" className="surface-panel po-open-detail">
        <div className="panel-heading"><div><div className="eyebrow">PURCHASE ORDER DETAIL</div><h3>{openedOrder.number}</h3><p>{companyName(openedOrder.companyId)} · {factoryName(openedOrder.factoryId)} · {openedOrder.issueDate || "PO date not set"} · {openedOrder.status}</p></div><button className="button-quiet compact-button" onClick={() => setOpenedPoId("")}>Close</button></div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component number</th><th>Component name</th><th>Quantity (piece / set)</th><th>Component Master price / unit</th><th>Line delivery</th></tr></thead><tbody>{openedOrder.lines.filter(line => !line.deletedAt).map(line => { const component = components.find(item => item.id === line.componentId); return <tr key={line.id}><td>{component?.partNumber || "Missing"}</td><td>{component?.name || "Missing component"}</td><td>{quantityLabel(line.quantity, line.componentId)}</td><td>₹{(component?.salePrice || 0).toLocaleString("en-IN")} / {componentUnit(line.componentId)}</td><td>{line.targetDelivery || openedOrder.targetDelivery || "—"}</td></tr>; })}</tbody></table></div>
        <div className="module-form-actions"><button className="button-primary" onClick={() => exportPurchaseOrdersPdf([openedOrder])}><FileDown size={14}/> Save this PO as PDF</button><button className="button-quiet" onClick={() => downloadPurchaseOrders([openedOrder])}><FileDown size={14}/> Download CSV</button><button className="button-quiet" onClick={() => editPO(openedOrder)}>Edit PO</button><button className="button-quiet" onClick={() => onSelectModule("process-map")}>Open Process Map</button></div>
      </section>}
    </section>
      <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> NEXT WORKFLOW</div><h3>Linked modules</h3><p>Use saved records to prevent duplicate typing.</p></div></div>
        {moduleId === "companies" ? <><button className="related-row" onClick={() => { setTab("factories"); beginAdd(); }}><Factory size={16}/><span><strong>Factories</strong><small>{factories.length} saved sites</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("purchasing")}><FileText size={16}/><span><strong>Purchase orders</strong><small>{orders.length} saved orders</small></span><ArrowRight size={14}/></button></> : moduleId === "components" ? <><button className="related-row" onClick={() => onSelectModule("purchasing")}><FileText size={16}/><span><strong>PO components</strong><small>{orders.reduce((n,p) => n + p.lines.length, 0)} saved lines</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Operations linked by component + PO line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Supplier rates per component and process</small></span><ArrowRight size={14}/></button></> : <><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Load a PO component line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Compare rates for the PO component</small></span><ArrowRight size={14}/></button></>}
        <div className="module-safety-note"><CalendarClock size={14}/><span>Master data sync is {syncStatus === "synced" ? "connected to the configured server" : "local until the existing AXIMACH server URL/API key are configured in Communication & Follow-up"}. Store the server on persistent hosting for cross-device access.</span></div>
      </aside>
    </div>
  </section>;
}
