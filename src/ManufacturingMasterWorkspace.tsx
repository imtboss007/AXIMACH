import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { ArrowRight, Building2, CalendarClock, Check, CircleDollarSign, Edit3, Factory, FileDown, FileText, Package, Plus, Search, Trash2, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type CompanyRecord, type ComponentRecord, type FactoryRecord, type PurchaseOrderLine, type PurchaseOrderRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { MechanicalComponentIcon } from "./MechanicalOperationIcon";

type Props = {
  moduleId: "companies" | "purchasing" | "components";
  onBack: () => void;
  onNotice: (value: string) => void;
  notice: string;
  onSelectModule: (id: string) => void;
};

const blankCompany = (): Omit<CompanyRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({ name: "", gstin: "", contactPerson: "", phone: "", email: "", address: "", notes: "" });
const blankFactory = (): Omit<FactoryRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({ companyId: "", name: "", address: "", contactPhone: "" });
const blankComponent = (): Omit<ComponentRecord, "id" | "createdAt" | "updatedAt" | "deletedAt"> => ({
  companyId: "", partNumber: "", name: "", revision: "", drawingReference: "", notes: "",
  salePrice: 0, salePriceUnit: "piece",
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
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [openedPoId, setOpenedPoId] = useState("");
  const openedOrder = orders.find(order => order.id === openedPoId);
  useEffect(() => {
    if (openedPoId) document.getElementById("po-open-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openedPoId]);
  const togglePoSelection = (id: string) => setSelectedPoIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const exportPurchaseOrdersPdf = (rows: PurchaseOrderRecord[]) => {
    if (!rows.length) { onNotice("Select one or more purchase orders first."); return; }
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]!));
    const body = rows.map(order => {
      const lines = order.lines.map(line => {
        const part = components.find(component => component.id === line.componentId);
        return "<tr><td>"+escapeHtml(part?.partNumber)+"</td><td>"+escapeHtml(part?.name)+"</td><td>"+escapeHtml(quantityLabel(line.quantity,line.componentId))+"</td><td>₹"+escapeHtml((part?.salePrice || 0).toLocaleString("en-IN"))+" / "+escapeHtml(part?.salePriceUnit || "piece")+"</td><td>"+escapeHtml(line.targetDelivery || order.targetDelivery)+"</td></tr>";
      }).join("");
      return "<section class='po-sheet'><header><h1>AXIMACH · PURCHASE ORDER</h1><h2>"+escapeHtml(order.number)+"</h2></header><p><b>Company:</b> "+escapeHtml(companyName(order.companyId))+"</p><p><b>PO date:</b> "+escapeHtml(order.issueDate)+" &nbsp; <b>Due:</b> "+escapeHtml(order.targetDelivery)+" &nbsp; <b>Status:</b> "+escapeHtml(order.status)+"</p><table><thead><tr><th>Component No.</th><th>Component Name</th><th>Quantity (piece / set)</th><th>Master Price / Unit</th><th>Delivery</th></tr></thead><tbody>"+lines+"</tbody></table><p>"+escapeHtml(order.notes)+"</p><footer>Generated from AXIMACH Component Master and Purchase Order records.</footer></section>";
    }).join("");
    const popup = window.open("", "_blank");
    if (!popup) { onNotice("Allow pop-ups to print / save the selected purchase orders as PDF."); return; }
    popup.document.write("<!doctype html><html><head><title>AXIMACH Purchase Orders</title><style>body{font:12px Arial;color:#172033;margin:24px}.po-sheet{page-break-after:always;margin-bottom:32px}.po-sheet:last-child{page-break-after:auto}h1{font-size:18px}h2{font-size:24px;margin:8px 0 18px}table{border-collapse:collapse;width:100%;margin:20px 0}td,th{border:1px solid #9aa6b2;padding:8px;text-align:left}th{background:#e9eef5}footer{margin-top:40px;color:#637084}@media print{body{margin:12mm}}</style></head><body>"+body+"</body></html>");
    popup.document.close(); popup.focus(); popup.print();
  };


  const componentName = (id: string) => components.find(c => c.id === id)?.partNumber || components.find(c => c.id === id)?.name || "Deleted / missing component";
  const companyName = (id: string) => companies.find(c => c.id === id)?.name || "Company not found";
  const factoryName = (id: string) => factories.find(f => f.id === id)?.name || "Factory not found";
  const componentUnit = (id: string) => components.find(c => c.id === id)?.salePriceUnit === "set" ? "set" : "piece";
  const quantityLabel = (quantity: number, componentId: string) => `${quantity.toLocaleString("en-IN")} ${componentUnit(componentId)}${quantity === 1 ? "" : "s"}`;
  const companyContacts = activeRows(data.contactProfiles || []).filter(person => person.linkedType === "company");
  const filteredCompanies = useMemo(() => companies.filter(c => {
    const people = companyContacts.filter(person => person.linkedId === c.id)
      .map(person => [person.name, person.role, person.group, person.phone, person.whatsapp, person.email, person.address, person.history].join(" ")).join(" ");
    return (c.name + " " + c.gstin + " " + c.contactPerson + " " + c.phone + " " + c.email + " " + c.address + " " + people).toLowerCase().includes(search.toLowerCase().trim());
  }), [companies, search, data.contactProfiles]);
  const filteredFactories = useMemo(() => factories.filter(f => (f.name + " " + f.address + " " + companyName(f.companyId)).toLowerCase().includes(search.toLowerCase().trim())), [factories, search, data.companies]);
  const filteredComponents = useMemo(() => components.filter(c => (c.partNumber + " " + c.name + " " + c.drawingReference + " " + c.revision).toLowerCase().includes(search.toLowerCase().trim())), [components, search]);
  const filteredOrders = useMemo(() => orders.filter(p => (p.number + " " + companyName(p.companyId) + " " + p.lines.map(l => componentName(l.componentId)).join(" ")).toLowerCase().includes(search.toLowerCase().trim())), [orders, search, data.companies, data.factories, data.components]);

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
    resetForms(); onNotice("Company saved. It can now be linked to components and purchase orders.");
  };
  const saveFactory = () => {
    if (!factoryDraft.companyId || !factoryDraft.name.trim()) { onNotice("Select the parent company and enter a factory name."); return; }
    const stamp = nowIso(); const id = factoryEditingId || makeId("factory");
    update(current => ({ ...current, factories: [...current.factories.filter(x => x.id !== id), { ...factoryDraft, name: factoryDraft.name.trim(), id, createdAt: current.factories.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Factory saved and linked to its company by record ID.");
  };
  const saveComponent = () => {
    if (!componentDraft.companyId || !componentDraft.partNumber.trim() || !componentDraft.name.trim()) { onNotice("Select a company and enter component number and name."); return; }
    const stamp = nowIso(); const id = componentEditingId || makeId("component");
    update(current => ({ ...current, components: [...current.components.filter(x => x.id !== id), { ...componentDraft, partNumber: componentDraft.partNumber.trim(), name: componentDraft.name.trim(), revision: componentDraft.revision.trim(), id, createdAt: current.components.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Component master saved. Purchase-order lines, operations and quotations can link to this component ID.");
  };
  const savePO = () => {
    if (!poDraft.number.trim() || !poDraft.companyId) { onNotice("Select a company and enter the purchase-order number."); return; }
    if (!poLines.length || poLines.some(line => !line.componentId || line.quantity <= 0)) { onNotice("Add at least one component line and set a component and positive quantity on every line."); return; }
    const stamp = nowIso(); const id = poEditingId || makeId("po");
    const lines = poLines.map(line => { const master = components.find(component => component.id === line.componentId); return { ...line, id: line.id || makeId("line"), unitPrice: master?.salePrice || 0, targetDelivery: line.targetDelivery || poDraft.targetDelivery }; });
    update(current => ({ ...current, purchaseOrders: [...current.purchaseOrders.filter(x => x.id !== id), { ...poDraft, number: poDraft.number.trim(), id, lines, createdAt: current.purchaseOrders.find(x => x.id === id)?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] }));
    resetForms(); onNotice("Purchase order saved. Each PO line now points to a component record ID; the Process Map can load the selected line, quantity and delivery target automatically.");
  };

  const editCompany = (row: CompanyRecord) => { resetForms(); setCompanyDraft({ name: row.name, gstin: row.gstin, contactPerson: row.contactPerson || "", phone: row.phone, email: row.email, address: row.address || "", notes: row.notes }); setCompanyEditingId(row.id); setShowForm(true); };
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
  const deleteComponents = (ids:string[]) => {
    const targets=components.filter(row=>ids.includes(row.id));
    if(!targets.length)return;
    if(!window.confirm("Permanently delete "+targets.length+" component master record(s) and all linked PO lines, operations, transport legs, quotations, payments, inspections, BOM links and planned-cost records? This cannot be undone."))return;
    const targetIds=new Set(targets.map(row=>row.id));
    const affectedLines=orders.flatMap(po=>po.lines.filter(line=>targetIds.has(line.componentId)).map(line=>({poId:po.id,lineId:line.id})));
    const lineIds=new Set(affectedLines.map(row=>row.lineId));
    const stamp=nowIso();
    update(current=>({...current,
      components:current.components.filter(row=>!targetIds.has(row.id)),
      purchaseOrders:current.purchaseOrders.map(po=>({...po,lines:po.lines.filter(line=>!targetIds.has(line.componentId)),updatedAt:stamp})).filter(po=>po.lines.length>0),
      operations:current.operations.filter(row=>!targetIds.has(row.componentId)&&!lineIds.has(row.poLineId)),
      quotations:current.quotations.filter(row=>!targetIds.has(row.componentId)&&!lineIds.has(row.poLineId)),
      transportLegs:current.transportLegs.filter(row=>!targetIds.has(row.componentId)&&!lineIds.has(row.poLineId)),
      paymentTransactions:current.paymentTransactions.filter(row=>!targetIds.has(row.componentId)&&!lineIds.has(row.poLineId)),
      inspectionMeasurements:current.inspectionMeasurements.filter(row=>!targetIds.has(row.componentId)&&!lineIds.has(row.poLineId)),
      bomLines:current.bomLines.filter(row=>!targetIds.has(row.componentId)),
      plannedCosts:current.plannedCosts.filter(row=>!targets.some(component=>row.componentNumber.trim().toLowerCase()===component.partNumber.trim().toLowerCase()||row.componentName.trim().toLowerCase()===component.name.trim().toLowerCase()))
    }));
    setSelectedComponentIds(current=>current.filter(id=>!targetIds.has(id)));
    onNotice(targets.length+" component(s) permanently deleted with their dependent manufacturing records.");
  };
  const deletePurchaseOrders = (ids:string[]) => {
    const targets=orders.filter(row=>ids.includes(row.id));if(!targets.length)return;
    if(!window.confirm("Permanently delete "+targets.length+" purchase order(s), their component lines and linked process, transport, costing, payment and inspection records? This cannot be undone."))return;
    const targetIds=new Set(targets.map(row=>row.id));
    const lineIds=new Set(targets.flatMap(po=>po.lines.map(line=>line.id)));
    update(current=>({...current,purchaseOrders:current.purchaseOrders.filter(row=>!targetIds.has(row.id)),operations:current.operations.filter(row=>!targetIds.has(row.poId)&&!lineIds.has(row.poLineId)),quotations:current.quotations.filter(row=>!targetIds.has(row.poId)&&!lineIds.has(row.poLineId)),transportLegs:current.transportLegs.filter(row=>!targetIds.has(row.poId)&&!lineIds.has(row.poLineId)),paymentTransactions:current.paymentTransactions.filter(row=>!targetIds.has(row.poId)&&!lineIds.has(row.poLineId)),inspectionMeasurements:current.inspectionMeasurements.filter(row=>!targetIds.has(row.poId)&&!lineIds.has(row.poLineId)),inventoryTransactions:current.inventoryTransactions.filter(row=>!targetIds.has(row.poId)&&!lineIds.has(row.poLineId))}));
    setSelectedPoIds(current=>current.filter(id=>!targetIds.has(id)));setOpenedPoId("");onNotice(targets.length+" purchase order(s) and linked operational records permanently deleted.");
  };
  const exportComponentsExcel = async (rows:ComponentRecord[],fileName="AXIMACH-Components.xlsx") => {
    if(!rows.length){onNotice("No component records selected for export.");return;}
    const workbook=new ExcelJS.Workbook();workbook.creator="AXIMACH";const sheet=workbook.addWorksheet("Components");
    sheet.columns=[{header:"Company",key:"company",width:28},{header:"Component Number",key:"partNumber",width:24},{header:"Component Name",key:"name",width:36},{header:"Revision",key:"revision",width:14},{header:"Drawing Reference",key:"drawing",width:28},{header:"Price",key:"price",width:16},{header:"Price Unit",key:"unit",width:14},{header:"Notes",key:"notes",width:40}];
    sheet.addRows(rows.map(row=>({company:companyName(row.companyId||""),partNumber:row.partNumber,name:row.name,revision:row.revision,drawing:row.drawingReference,price:row.salePrice,unit:row.salePriceUnit,notes:row.notes})));
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17324D"}};sheet.views=[{state:"frozen",ySplit:1}];
    const bytes=await workbook.xlsx.writeBuffer();const blob=new Blob([new Uint8Array(bytes).buffer as ArrayBuffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName;a.click();URL.revokeObjectURL(url);onNotice("Exported "+rows.length+" component record(s) to Excel.");
  };
  const exportComponentsPdf = (rows:ComponentRecord[]) => {
    if(!rows.length){onNotice("No component records selected for PDF.");return;}const esc=(v:unknown)=>String(v??"").replace(/[&<>"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
    const body=rows.map(row=>"<tr><td>"+esc(row.partNumber)+"</td><td>"+esc(row.name)+"</td><td>"+esc(row.revision)+"</td><td>"+esc(companyName(row.companyId||""))+"</td><td>"+esc(row.drawingReference)+"</td><td>"+esc("₹"+row.salePrice.toLocaleString("en-IN")+" / "+row.salePriceUnit)+"</td></tr>").join("");
    const win=window.open("","_blank");if(!win){onNotice("Allow pop-ups to save the component register as PDF.");return;}win.document.write("<!doctype html><html><head><title>AXIMACH Components</title><style>body{font:12px Arial;padding:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa;padding:8px;text-align:left}th{background:#eef2f6}</style></head><body><h1>AXIMACH · Component Master</h1><table><thead><tr><th>Part no.</th><th>Component</th><th>Revision</th><th>Company</th><th>Drawing ref</th><th>Master price</th></tr></thead><tbody>"+body+"</tbody></table></body></html>");win.document.close();win.focus();win.print();
  };
  const exportPurchaseOrdersExcel = async (rows:PurchaseOrderRecord[]) => {
    if(!rows.length){onNotice("No purchase orders selected for export.");return;}const workbook=new ExcelJS.Workbook();workbook.creator="AXIMACH";const sheet=workbook.addWorksheet("Purchase Orders");
    sheet.columns=[{header:"PO Number",key:"number",width:20},{header:"Company",key:"company",width:28},{header:"PO Date",key:"date",width:16},{header:"Target Delivery",key:"delivery",width:18},{header:"Status",key:"status",width:16},{header:"Component Number",key:"partNumber",width:22},{header:"Component Name",key:"component",width:34},{header:"Quantity",key:"quantity",width:14},{header:"Unit Price",key:"price",width:16},{header:"Line Delivery",key:"lineDelivery",width:18}];
    for(const po of rows)for(const line of po.lines){const component=components.find(row=>row.id===line.componentId);sheet.addRow({number:po.number,company:companyName(po.companyId),date:po.issueDate,delivery:po.targetDelivery,status:po.status,partNumber:component?.partNumber||"",component:component?.name||"",quantity:line.quantity,price:component?.salePrice||0,lineDelivery:line.targetDelivery});}
    sheet.getRow(1).font={bold:true,color:{argb:"FFFFFFFF"}};sheet.getRow(1).fill={type:"pattern",pattern:"solid",fgColor:{argb:"FF17324D"}};sheet.views=[{state:"frozen",ySplit:1}];
    const bytes=await workbook.xlsx.writeBuffer();const blob=new Blob([new Uint8Array(bytes).buffer as ArrayBuffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="AXIMACH-Purchase-Orders.xlsx";a.click();URL.revokeObjectURL(url);onNotice("Exported "+rows.length+" purchase order(s) to Excel.");
  };
  const archive = (collection: "companies" | "factories" | "components" | "purchaseOrders", id: string) => {
    if (!window.confirm("Archive this record? It will be hidden from active selectors but retained in history to protect linked records.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, [collection]: current[collection].map(row => row.id === id ? { ...row, deletedAt: stamp, updatedAt: stamp } : row) } as typeof current));
    onNotice("Record archived. Linked historical records remain intact.");
  };

  const header = moduleId === "companies" ? "Company Directory" : moduleId === "purchasing" ? "Purchase Orders" : "Component Master";
  const description = moduleId === "companies"
    ? "Maintain company name, GST, contact person, email and address; records link by stable IDs."
    : moduleId === "purchasing"
      ? "Create each PO once and add multiple component lines; every line stores component ID, quantity and target delivery."
      : "Create each part number once with drawing revision/reference and a master price per piece or set; reuse the linked record in every order and route.";

  return <section className="workspace-page module-functional-page master-data-page">
    {notice && <div className="notice-banner"><Check size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "LOCAL DATA · SERVER NOT CONNECTED"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MASTER RECORDS / LINKED DATA</div><h1>{header}<span>.</span></h1><p>{description}</p></div>
      <div className="workspace-title-actions">
        {moduleId === "components" && <button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={15}/> Component costing</button>}
        {moduleId === "purchasing" && <button className="button-quiet" onClick={() => onSelectModule("process-map")}><ArrowRight size={15}/> Open Process Map</button>}
        <button className="button-primary" onClick={beginAdd}><Plus size={15}/> {moduleId === "companies" ? "Add Company" : moduleId === "purchasing" ? "Create Purchase Order" : "Add Component"}</button>
      </div>
    </div>
    {false && moduleId === "companies" && <div className="costing-tabs">
      <button className={tab === "companies" ? "costing-tab-active" : ""} onClick={() => { setTab("companies"); resetForms(); }}><Building2 size={15}/> Companies ({companies.length})</button>
      <button className={tab === "factories" ? "costing-tab-active" : ""} onClick={() => { setTab("factories"); resetForms(); }}><Factory size={15}/> Factories ({factories.length})</button>
    </div>}
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={"Search " + header.toLowerCase() + "…"}/></label><span className="module-number">{moduleId === "companies" ? tab === "companies" ? companies.length + " COMPANIES" : factories.length + " FACTORIES" : moduleId === "purchasing" ? orders.length + " ORDERS" : components.length + " COMPONENTS"}</span></div>
    {moduleId === "components" && <div className="module-action-bar po-bulk-actions">
      <label><input type="checkbox" checked={filteredComponents.length>0&&filteredComponents.every(row=>selectedComponentIds.includes(row.id))} onChange={event=>setSelectedComponentIds(event.target.checked?[...new Set([...selectedComponentIds,...filteredComponents.map(row=>row.id)])]:selectedComponentIds.filter(id=>!filteredComponents.some(row=>row.id===id)))} /> Select all visible</label>
      <span className="module-number">{selectedComponentIds.filter(id=>components.some(row=>row.id===id)).length} SELECTED</span>
      <button className="button-primary compact-button" disabled={!selectedComponentIds.length} onClick={()=>exportComponentsPdf(components.filter(row=>selectedComponentIds.includes(row.id)))}>Selected PDF</button>
      <button className="button-quiet compact-button" disabled={!selectedComponentIds.length} onClick={()=>void exportComponentsExcel(components.filter(row=>selectedComponentIds.includes(row.id)))}>Selected Excel</button>
      <button className="button-quiet compact-button" onClick={()=>exportComponentsPdf(components)}>All PDF</button>
      <button className="button-quiet compact-button" onClick={()=>void exportComponentsExcel(components)}>All Excel</button>
      <button className="button-danger compact-button" disabled={!selectedComponentIds.length} onClick={()=>deleteComponents(selectedComponentIds)}><Trash2 size={13}/> Delete selected</button>
      <button className="button-quiet compact-button" disabled={!selectedComponentIds.length} onClick={()=>setSelectedComponentIds([])}>Clear selection</button>
    </div>}
    {moduleId === "purchasing" && <div className="module-action-bar po-bulk-actions">
      <label><input type="checkbox" checked={filteredOrders.length>0 && filteredOrders.every(order=>selectedPoIds.includes(order.id))} onChange={event=>setSelectedPoIds(event.target.checked?[...new Set([...selectedPoIds,...filteredOrders.map(order=>order.id)])]:selectedPoIds.filter(id=>!filteredOrders.some(order=>order.id===id)))} /> Select all visible</label>
      <span className="module-number">{selectedPoIds.filter(id=>orders.some(order=>order.id===id)).length} SELECTED</span>
      <button className="button-primary compact-button" disabled={!selectedPoIds.length} onClick={()=>exportPurchaseOrdersPdf(orders.filter(order=>selectedPoIds.includes(order.id)))}><FileDown size={14}/> Selected PDF</button>
      <button className="button-quiet compact-button" disabled={!selectedPoIds.length} onClick={()=>void exportPurchaseOrdersExcel(orders.filter(order=>selectedPoIds.includes(order.id)))}>Selected Excel</button>
      <button className="button-quiet compact-button" onClick={()=>exportPurchaseOrdersPdf(orders)}>All PDF</button>
      <button className="button-quiet compact-button" onClick={()=>void exportPurchaseOrdersExcel(orders)}>All Excel</button>
      <button className="button-danger compact-button" disabled={!selectedPoIds.length} onClick={()=>deletePurchaseOrders(selectedPoIds)}><Trash2 size={13}/> Delete selected</button>
      <button className="button-quiet compact-button" disabled={!selectedPoIds.length} onClick={()=>setSelectedPoIds([])}>Clear selection</button>
    </div>}

    {showForm && <section className="surface-panel module-record-form-panel">
      <div className="panel-heading"><div><h3>{moduleId === "companies" ? companyEditingId ? "Edit company" : factoryEditingId ? "Edit factory" : tab === "companies" ? "New company" : "New factory" : moduleId === "purchasing" ? poEditingId ? "Edit purchase order" : "New purchase order" : componentEditingId ? "Edit component" : "New component"}</h3><p>Required fields are checked before the record is saved.</p></div><button className="icon-control" onClick={resetForms} aria-label="Close form"><X size={15}/></button></div>
      {moduleId === "companies" && <div className="module-record-form">
        <label>Company name *<input value={companyDraft.name} onChange={e => setCompanyDraft({ ...companyDraft, name: e.target.value })} placeholder="Enter your actual registered company name"/></label>
        <label>GSTIN<input value={companyDraft.gstin} onChange={e => setCompanyDraft({ ...companyDraft, gstin: e.target.value.toUpperCase() })} placeholder="Optional"/></label>
        <label>Contact person<input value={companyDraft.contactPerson || ""} onChange={e => setCompanyDraft({ ...companyDraft, contactPerson: e.target.value })} placeholder="Primary contact person"/></label>
        <label>Phone<input value={companyDraft.phone} onChange={e => setCompanyDraft({ ...companyDraft, phone: e.target.value })} placeholder="Country code + number"/></label>
        <label>Email<input type="email" value={companyDraft.email} onChange={e => setCompanyDraft({ ...companyDraft, email: e.target.value })} placeholder="Accounts / contact email"/></label>
        <label>Address<input value={companyDraft.address || ""} onChange={e => setCompanyDraft({ ...companyDraft, address: e.target.value })} placeholder="Registered / business address"/></label>
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
        <SearchablePicker id="component-company" label="Company *" value={componentDraft.companyId || ""} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name}))} onChange={companyId=>setComponentDraft({...componentDraft,companyId})}/>
        <label>Component / part number *<input value={componentDraft.partNumber} onChange={e => setComponentDraft({ ...componentDraft, partNumber: e.target.value })} placeholder="Customer or internal part number"/></label>
        <label>Component name *<input value={componentDraft.name} onChange={e => setComponentDraft({ ...componentDraft, name: e.target.value })} placeholder="Actual component name"/></label>
        <label>Drawing revision<input value={componentDraft.revision} onChange={e => setComponentDraft({ ...componentDraft, revision: e.target.value })} placeholder="e.g. Rev A"/></label>
        
        <label>Drawing number / file reference<input value={componentDraft.drawingReference} onChange={e => setComponentDraft({ ...componentDraft, drawingReference: e.target.value })} placeholder="Drawing reference"/></label>
        <label>Component price (₹)<input type="number" min="0" step="0.01" value={componentDraft.salePrice} onChange={e => setComponentDraft({ ...componentDraft, salePrice: Math.max(0, Number(e.target.value) || 0) })}/></label>
        <label>Price unit<select value={componentDraft.salePriceUnit || "piece"} onChange={e=>setComponentDraft({...componentDraft,salePriceUnit:e.target.value as "piece"|"set"})}><option value="piece">Per piece</option><option value="set">Per set</option></select></label>
        
        
        
        
        <label className="module-form-wide">Notes<input value={componentDraft.notes} onChange={e => setComponentDraft({ ...componentDraft, notes: e.target.value })} placeholder="Optional engineering / purchase notes"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveComponent}><Check size={14}/> Save component</button><button className="button-quiet" onClick={resetForms}>Cancel</button></div>
      </div>}
      {moduleId === "purchasing" && <div className="module-record-form">
        <label>PO number *<input value={poDraft.number} onChange={e => setPoDraft({ ...poDraft, number: e.target.value })} placeholder="Enter the customer's actual PO number"/></label>
        <SearchablePicker id="po-company" label="Company *" value={poDraft.companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={companyId=>{const factoryId=factories.find(f=>f.companyId===companyId)?.id||"";setPoDraft({...poDraft,companyId,factoryId});}}/>
        
        <label>PO issue date<input type="date" value={poDraft.issueDate} onChange={e => setPoDraft({ ...poDraft, issueDate: e.target.value })}/></label>
        <label>Target delivery<input type="date" value={poDraft.targetDelivery} onChange={e => setPoDraft({ ...poDraft, targetDelivery: e.target.value })}/></label>
        <label>Status<select value={poDraft.status} onChange={e => setPoDraft({ ...poDraft, status: e.target.value })}><option>Open</option><option>Confirmed</option><option>In Production</option><option>Complete</option><option>On Hold</option><option>Cancelled</option></select></label>
        <label className="module-form-wide">PO notes<input value={poDraft.notes} onChange={e => setPoDraft({ ...poDraft, notes: e.target.value })} placeholder="Optional PO notes"/></label>
        <div className="module-form-wide"><div className="panel-heading"><div><h3>PO component lines</h3><p>Each row references a saved component master record and keeps its own quantity and delivery date.</p></div><button type="button" className="button-quiet compact-button" disabled={!components.length} onClick={() => setPoLines(prev => [...prev, { ...blankLine(), targetDelivery: poDraft.targetDelivery, id: makeId("line") }])}><Plus size={14}/> Add component line</button></div>
          {poLines.map((line, index) => <div className="module-record-form po-line-form" key={line.id}>
            <SearchablePicker id={"po-line-component-"+line.id} label="Component *" value={line.componentId} placeholder="Type part number…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={componentId=>{const master=components.find(item=>item.id===componentId);setPoLines(prev=>prev.map(row=>row.id===line.id?{...row,componentId,unitPrice:master?.salePrice||0}:row));}}/>
            <label>Quantity * ({componentUnit(line.componentId)})<input type="number" min="1" value={line.quantity || ""} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, quantity: Math.max(0, Number(e.target.value) || 0) } : row))}/></label>
            <label>Line delivery date<input type="date" value={line.targetDelivery} onChange={e => setPoLines(prev => prev.map(row => row.id === line.id ? { ...row, targetDelivery: e.target.value } : row))}/></label>
            <div className="po-master-price"><small>COMPONENT MASTER PRICE</small><strong>{(() => { const c=components.find(item=>item.id===line.componentId); return c ? "₹"+c.salePrice.toLocaleString("en-IN")+" / per "+(c.salePriceUnit||"piece") : "Select a component"; })()}</strong><span>Linked from Component Directory; not editable on the PO line.</span></div>
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
      {moduleId === "companies" && (tab === "companies" ? filteredCompanies.length ? <div className="module-record-list">{filteredCompanies.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Building2 size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{row.gstin || "GSTIN not entered"} · {row.contactPerson || "Contact person not entered"} · {row.phone || "Phone not entered"}</span><p>{row.email || "No email entered"} · {row.address || "No address entered"} {row.notes ? "· " + row.notes : ""}</p>{companyContacts.some(person=>person.linkedId===row.id)&&<small>Other contacts: {companyContacts.filter(person=>person.linkedId===row.id).map(person=>person.name+(person.group?" · "+person.group:"")).join(", ")}</small>}</div><div className="module-record-card-actions"><button onClick={() => editCompany(row)}>Edit</button><button onClick={() => archive("companies", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Building2 size={28}/><h3>No companies added</h3><p>No placeholder company is preloaded. Add your actual company once and reuse it across all purchase orders and routes.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add your company</button></div> : filteredFactories.length ? <div className="module-record-list">{filteredFactories.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><Factory size={18}/></div><div className="module-record-copy"><strong>{row.name}</strong><span>{companyName(row.companyId)}</span><p>{row.address || "No address entered"} · {row.contactPhone || "No contact phone"}</p></div><div className="module-record-card-actions"><button onClick={() => editFactory(row)}>Edit</button><button onClick={() => archive("factories", row.id)}>Archive</button></div></article>)}</div> : <div className="module-empty-state"><Factory size={28}/><h3>No factories added</h3><p>Add a factory and link it to its parent company.</p><button className="button-primary" disabled={!companies.length} onClick={beginAdd}><Plus size={14}/> Add factory</button></div>)}
      {moduleId === "components" && (filteredComponents.length ? <div className="module-record-list">{filteredComponents.map(row => <article className="module-record-card" key={row.id}><label className="po-row-select" aria-label={"Select "+row.partNumber}><input type="checkbox" checked={selectedComponentIds.includes(row.id)} onChange={()=>setSelectedComponentIds(current=>current.includes(row.id)?current.filter(id=>id!==row.id):[...current,row.id])}/></label><div className="module-record-mark">{<MechanicalComponentIcon componentName={row.name+" "+row.partNumber}/>}<Package size={16}/></div><div className="module-record-copy"><strong>{row.partNumber} · {row.name}</strong><span>Rev {row.revision || "—"} · {companyName(row.companyId||"")}</span><p>{row.drawingReference || "No drawing reference"} · {"₹" + row.salePrice.toLocaleString("en-IN")} / {row.salePriceUnit || "piece"} · {data.purchaseOrders.filter(p => p.lines.some(l => l.componentId === row.id)).length} linked PO(s)</p></div><div className="module-record-card-actions"><button onClick={()=>exportComponentsPdf([row])}>PDF</button><button onClick={()=>void exportComponentsExcel([row],"AXIMACH-"+row.partNumber+".xlsx")}>Excel</button><button onClick={() => editComponent(row)}>Edit</button><button className="button-danger" onClick={() => deleteComponents([row.id])}>Delete</button><button onClick={()=>onSelectModule("inventory")}>Inventory</button><button onClick={()=>onSelectModule("process-map")}>Process Plan</button><button onClick={()=>onSelectModule("costing")}>Costing</button></div></article>)}</div> : <div className="module-empty-state"><Package size={28}/><h3>No components added</h3><p>Save each part number once. Quotations, operations and PO lines will refer back to this component record.</p><button className="button-primary" onClick={beginAdd}><Plus size={14}/> Add component</button></div>)}
      {moduleId === "purchasing" && (filteredOrders.length ? <div className="module-record-list">{filteredOrders.map(row => <article className="module-record-card" key={row.id}><div className="module-record-mark"><FileText size={18}/></div><div className="module-record-copy"><strong>{row.number}</strong><span>{companyName(row.companyId)}</span><p>{row.lines.length} component line(s) · Due {row.targetDelivery || "not set"}</p><div className="related-row-stack">{row.lines.map(line => <small key={line.id}>{componentName(line.componentId||"")} · {quantityLabel(line.quantity, line.componentId||"")} · {line.targetDelivery || row.targetDelivery || "No line date"}</small>)}</div></div><div className="module-record-card-actions"><label className="po-row-select" aria-label={"Select PO "+row.number}><input type="checkbox" checked={selectedPoIds.includes(row.id)} onChange={()=>togglePoSelection(row.id)}/></label><span className="record-state">{row.status}</span><button aria-expanded={openedPoId===row.id} onClick={() => setOpenedPoId(openedPoId===row.id?"":row.id)}>{openedPoId===row.id?"Close":"Open"}</button><button className="button-quiet compact-button" onClick={() => exportPurchaseOrdersPdf([row])}><FileDown size={13}/> PDF</button><button className="button-quiet compact-button" onClick={() => void exportPurchaseOrdersExcel([row])}>Excel</button><button onClick={() => editPO(row)}>Edit</button><button className="button-danger compact-button" onClick={() => deletePurchaseOrders([row.id])}>Delete</button></div></article>)}</div> : <div className="module-empty-state"><FileText size={28}/><h3>No purchase orders added</h3><p>Create a PO and add one or many component lines; the Process Map will take its quantity and dates from the selected line.</p><button className="button-primary" disabled={!companies.length || !components.length} onClick={beginAdd}><Plus size={14}/> Create purchase order</button></div>)}
      {moduleId === "purchasing" && openedOrder && <section id="po-open-detail" className="surface-panel po-open-detail">
        <div className="panel-heading"><div><div className="eyebrow">PURCHASE ORDER DETAIL</div><h3>{openedOrder.number}</h3><p>{companyName(openedOrder.companyId)} · {openedOrder.issueDate || "PO date not set"} · {openedOrder.status}</p></div><button className="button-quiet compact-button" onClick={()=>setOpenedPoId("")}>Close</button></div>
        <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component number</th><th>Component name</th><th>Quantity (piece / set)</th><th>Master price / unit</th><th>Line delivery</th></tr></thead><tbody>{openedOrder.lines.map(line=>{const component=components.find(item=>item.id===line.componentId);return <tr key={line.id}><td>{component?.partNumber||"Missing"}</td><td>{component?.name||"Missing component"}</td><td>{quantityLabel(line.quantity, line.componentId||"")}</td><td>₹{(component?.salePrice||0).toLocaleString("en-IN")} / {component?.salePriceUnit||"piece"}</td><td>{line.targetDelivery||openedOrder.targetDelivery||"—"}</td></tr>;})}</tbody></table></div>
        <div className="module-form-actions"><button className="button-primary" onClick={()=>exportPurchaseOrdersPdf([openedOrder])}><FileDown size={14}/> Save this PO as PDF</button><button className="button-quiet" onClick={()=>editPO(openedOrder)}>Edit PO</button><button className="button-quiet" onClick={()=>onSelectModule("process-map")}>Open Process Map</button></div>
      </section>}
    </section>
      <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> NEXT WORKFLOW</div><h3>Linked modules</h3><p>Use saved records to prevent duplicate typing.</p></div></div>
        {moduleId === "companies" ? <><button className="related-row" onClick={() => onSelectModule("purchasing")}><Package size={16}/><span><strong>Purchase orders</strong><small>{orders.length} saved orders</small></span><ArrowRight size={14}/></button></> : moduleId === "components" ? <><button className="related-row" onClick={() => onSelectModule("purchasing")}><FileText size={16}/><span><strong>PO components</strong><small>{orders.reduce((n,p) => n + p.lines.length, 0)} saved lines</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Operations linked by component + PO line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Supplier rates per component and process</small></span><ArrowRight size={14}/></button></> : <><button className="related-row" onClick={() => onSelectModule("process-map")}><Factory size={16}/><span><strong>Process Map</strong><small>Load a PO component line</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={() => onSelectModule("costing")}><CircleDollarSign size={16}/><span><strong>Costing & quotations</strong><small>Compare rates for the PO component</small></span><ArrowRight size={14}/></button></>}
        <div className="module-safety-note"><CalendarClock size={14}/><span>Master data sync is {syncStatus === "synced" ? "connected to the configured server" : "local until the existing AXIMACH server URL/API key are configured in Communication & Follow-up"}. Store the server on persistent hosting for cross-device access.</span></div>
      </aside>
    </div>
  </section>;
}
