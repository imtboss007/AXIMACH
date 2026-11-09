import { useMemo, useState } from "react";
import { Activity, ArrowRight, Boxes, Check, ClipboardList, Factory, FileText, Package, Plus, Search, ShieldCheck, Trash2, Truck, Users, Warehouse, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type BomLineRecord, type InventoryTransactionRecord, type MaterialRecord, type StockTransactionKind } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
type Tab = "materials" | "bom" | "stock";
type MaterialDraft = Omit<MaterialRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type BomDraft = Omit<BomLineRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type BomIssuePreviewRow = { material: MaterialRecord; bomLineIds: string[]; required: number; issued: number; pending: number; available: number; shortage: number };
const emptyMaterial = (): MaterialDraft => ({ code: "", name: "", grade: "", unit: "kg", specification: "", preferredVendorId: "", ratePerUnit: 0, notes: "" });
const emptyBom = (): BomDraft => ({ componentId: "", materialId: "", revision: "", quantityPerPart: 0, scrapPercent: 0, notes: "" });
const stockKinds: StockTransactionKind[] = ["Opening balance", "Receipt", "Issue to production", "WIP transfer", "Return", "Rejected", "Scrap", "Finished goods receipt", "Dispatch", "Adjustment"];
const fixedStockDirections: Partial<Record<StockTransactionKind, "in" | "out">> = { "Opening balance": "in", "Receipt": "in", "Issue to production": "out", "Return": "in", "Scrap": "out", "Finished goods receipt": "in", "Dispatch": "out" };
const money = (v: number) => "₹" + (Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dateToday = () => new Date().toISOString().slice(0, 10);

export default function InventoryWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const materials = activeRows(data.materials);
  const components = activeRows(data.components);
  const bomLines = activeRows(data.bomLines);
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const orders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const inventoryTransactions = activeRows(data.inventoryTransactions);
  const operations = activeRows(data.operations);
  const [tab, setTab] = useState<Tab>("materials");
  const [search, setSearch] = useState("");
  const [materialEditingId, setMaterialEditingId] = useState("");
  const [bomEditingId, setBomEditingId] = useState("");
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [bomFormOpen, setBomFormOpen] = useState(false);
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterial());
  const [bomDraft, setBomDraft] = useState<BomDraft>(emptyBom());
  const [itemType, setItemType] = useState<"material" | "component">("material");
  const [itemId, setItemId] = useState("");
  const [bomIssuePoLineKey, setBomIssuePoLineKey] = useState("");
  const [bomIssueOperationId, setBomIssueOperationId] = useState("");
  const [transactionType, setTransactionType] = useState<StockTransactionKind>("Receipt");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [quantity, setQuantity] = useState("");
  const [occurredAt, setOccurredAt] = useState(dateToday());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [factoryId, setFactoryId] = useState("");
  const [poLineKey, setPoLineKey] = useState("");
  const [operationId, setOperationId] = useState("");
  const [vendorId, setVendorId] = useState("");

  const companyOrders = orders.filter(po => po.companyId === companyId && (!factoryId || po.factoryId === factoryId));
  const poLineOptions = companyOrders.flatMap(po => po.lines.map(line => {
    const component = components.find(c => c.id === line.componentId);
    return { id: po.id + "::" + line.id, po, line, label: po.number + " · " + (component?.partNumber || "Component") + " · " + line.quantity.toLocaleString("en-IN") + " pcs" };
  }));
  const selectedPoLine = poLineOptions.find(row => row.id === poLineKey);
  const bomIssuePoLineOptions = orders.flatMap(po => po.lines.filter(line => !line.deletedAt).map(line => {
    const component = components.find(c => c.id === line.componentId);
    const company = companies.find(c => c.id === po.companyId);
    return {
      id: po.id + "::" + line.id,
      po,
      line,
      component,
      label: (company?.name || "Company") + " · " + po.number + " · " + (component?.partNumber || "Component") + " · " + line.quantity.toLocaleString("en-IN") + " pcs"
    };
  }));
  const bomIssueSelection = bomIssuePoLineOptions.find(row => row.id === bomIssuePoLineKey);
  const bomIssueOperations = bomIssueSelection ? operations.filter(op => op.poId === bomIssueSelection.po.id && op.poLineId === bomIssueSelection.line.id && !op.deletedAt) : [];
  const bomIssuePreview = useMemo<BomIssuePreviewRow[]>(() => {
    if (!bomIssueSelection?.component) return [];
    const eligibleBom = bomLines.filter(row => row.componentId === bomIssueSelection.component!.id && (!row.revision || row.revision === bomIssueSelection.component!.revision));
    const totals = new Map<string, { required: number; bomLineIds: string[] }>();
    for (const row of eligibleBom) {
      const prior = totals.get(row.materialId) || { required: 0, bomLineIds: [] };
      prior.required += row.quantityPerPart * (1 + row.scrapPercent / 100) * bomIssueSelection.line.quantity;
      prior.bomLineIds.push(row.id);
      totals.set(row.materialId, prior);
    }
    return [...totals.entries()].map(([materialId, total]) => {
      const material = materials.find(row => row.id === materialId);
      if (!material) return null;
      const issued = inventoryTransactions.filter(row => row.itemType === "material" && row.itemId === materialId && row.poId === bomIssueSelection.po.id && row.poLineId === bomIssueSelection.line.id)
        .reduce((sum, row) => sum + (row.transactionType === "Issue to production" && row.direction === "out" ? row.quantity : row.transactionType === "Return" && row.direction === "in" ? -row.quantity : 0), 0);
      const pending = Math.max(0, total.required - Math.max(0, issued));
      const available = stockBalance("material", materialId);
      return { material, bomLineIds: total.bomLineIds, required: total.required, issued: Math.max(0, issued), pending, available, shortage: Math.max(0, pending - available) };
    }).filter((row): row is BomIssuePreviewRow => Boolean(row));
  }, [bomIssuePoLineKey, bomIssueSelection, bomLines, materials, inventoryTransactions]);
  const operationOptions = operations.filter(op => !op.deletedAt && (!selectedPoLine || (op.poId === selectedPoLine.po.id && op.poLineId === selectedPoLine.line.id)));
  const itemOptions = itemType === "material" ? materials.map(m => ({ id: m.id, label: m.code + " · " + m.name + " · " + m.grade })) : components.map(c => ({ id: c.id, label: c.partNumber + " · " + c.name + " · Rev " + (c.revision || "—") }));
  const selectedItem = itemType === "material" ? materials.find(m => m.id === itemId) : components.find(c => c.id === itemId);
  const stockBalance = (type: "material" | "component", id: string) => inventoryTransactions.reduce((total, row) => row.itemType === type && row.itemId === id ? total + (row.direction === "in" ? row.quantity : -row.quantity) : total, 0);
  const visibleMaterials = useMemo(() => materials.filter(m => (m.code + " " + m.name + " " + m.grade + " " + m.specification + " " + m.notes).toLowerCase().includes(search.toLowerCase().trim())), [materials, search]);
  const visibleBom = useMemo(() => bomLines.filter(row => {
    const component = components.find(c => c.id === row.componentId);
    const material = materials.find(m => m.id === row.materialId);
    return (component?.partNumber + " " + component?.name + " " + material?.code + " " + material?.name + " " + row.revision + " " + row.notes).toLowerCase().includes(search.toLowerCase().trim());
  }), [bomLines, components, materials, search]);
  const visibleTransactions = useMemo(() => inventoryTransactions.filter(row => {
    const item = row.itemType === "material" ? materials.find(m => m.id === row.itemId) : components.find(c => c.id === row.itemId);
    return (item?.name + " " + ("code" in (item || {}) ? (item as MaterialRecord).code : (item as any)?.partNumber) + " " + row.transactionType + " " + row.reference + " " + row.notes + " " + row.occurredAt + " " + row.quantity).toLowerCase().includes(search.toLowerCase().trim());
  }).slice().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt)), [inventoryTransactions, materials, components, search]);
  const bomCost = (componentId: string) => bomLines.filter(row => row.componentId === componentId).reduce((total, row) => {
    const material = materials.find(m => m.id === row.materialId);
    return total + row.quantityPerPart * (1 + row.scrapPercent / 100) * (material?.ratePerUnit || 0);
  }, 0);

  const resetMaterial = () => { setMaterialFormOpen(false); setMaterialEditingId(""); setMaterialDraft(emptyMaterial()); };
  const resetBom = () => { setBomFormOpen(false); setBomEditingId(""); setBomDraft(emptyBom()); };
  const editMaterial = (row: MaterialRecord) => {
    const { id, createdAt, updatedAt, deletedAt, ...draft } = row;
    setMaterialDraft(draft); setMaterialEditingId(id); setMaterialFormOpen(true);
  };
  const editBom = (row: BomLineRecord) => {
    const { id, createdAt, updatedAt, deletedAt, ...draft } = row;
    setBomDraft(draft); setBomEditingId(id); setBomFormOpen(true);
  };
  const saveMaterial = () => {
    if (!materialDraft.code.trim() || !materialDraft.name.trim() || !materialDraft.unit.trim()) { onNotice("Material code, name and unit are required."); return; }
    if (!Number.isFinite(Number(materialDraft.ratePerUnit)) || Number(materialDraft.ratePerUnit) < 0) { onNotice("Material rate must be a finite non-negative number."); return; }
    if (materialDraft.preferredVendorId && !vendors.some(vendor => vendor.id === materialDraft.preferredVendorId)) { onNotice("Preferred vendor is missing or archived. Choose an active Vendor Directory record."); return; }
    const duplicate = materials.find(m => m.id !== materialEditingId && m.code.trim().toLowerCase() === materialDraft.code.trim().toLowerCase());
    if (duplicate) { onNotice("That material code already exists. Edit the existing material to avoid duplicate IDs."); return; }
    const stamp = nowIso(); const id = materialEditingId || makeId("material");
    update(current => {
      const old = current.materials.find(m => m.id === id);
      return { ...current, materials: [...current.materials.filter(m => m.id !== id), { ...materialDraft, code: materialDraft.code.trim(), name: materialDraft.name.trim(), id, createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] };
    });
    resetMaterial(); onNotice("Material master saved. BOM lines use its stable material ID and inventory is calculated from posted stock transactions.");
  };
  const saveBom = () => {
    if (!bomDraft.componentId || !components.some(component => component.id === bomDraft.componentId) || !bomDraft.materialId || !materials.some(material => material.id === bomDraft.materialId)) { onNotice("Select active Component Master and Material Master records for this BOM line."); return; }
    if (!Number.isFinite(Number(bomDraft.quantityPerPart)) || bomDraft.quantityPerPart <= 0) { onNotice("BOM quantity per part must be a finite positive number."); return; }
    if (!Number.isFinite(Number(bomDraft.scrapPercent)) || bomDraft.scrapPercent < 0 || bomDraft.scrapPercent > 100) { onNotice("BOM scrap allowance must be between 0 and 100 percent."); return; }
    const duplicate = bomLines.find(row => row.id !== bomEditingId && row.componentId === bomDraft.componentId && row.materialId === bomDraft.materialId && row.revision === bomDraft.revision);
    if (duplicate) { onNotice("This component/material/revision BOM line already exists; edit it instead of creating a duplicate."); return; }
    const stamp = nowIso(); const id = bomEditingId || makeId("bom");
    update(current => {
      const old = current.bomLines.find(row => row.id === id);
      return { ...current, bomLines: [...current.bomLines.filter(row => row.id !== id), { ...bomDraft, id, createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] };
    });
    resetBom(); onNotice("BOM line saved against component ID and material ID. Planned material requirement/cost updates from the linked master records.");
  };
  const archiveMaterial = (row: MaterialRecord) => {
    if (data.bomLines.some(b => b.materialId === row.id && !b.deletedAt)) { onNotice("This material is used by a BOM. Remove/archive its BOM lines first or retain the material for historical traceability."); return; }
    if (!window.confirm("Archive this material master? Stock transaction history remains intact.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, materials: current.materials.map(m => m.id === row.id ? { ...m, deletedAt: stamp, updatedAt: stamp } : m) }));
    onNotice("Material archived; posted stock transactions remain in the ledger.");
  };
  const archiveBom = (row: BomLineRecord) => {
    if (!window.confirm("Archive this BOM line? Its revision history and inventory transactions are retained.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, bomLines: current.bomLines.map(b => b.id === row.id ? { ...b, deletedAt: stamp, updatedAt: stamp } : b) }));
    onNotice("BOM line archived; its record remains available for historical review.");
  };
  const resetTransaction = () => { setItemId(""); setQuantity(""); setOccurredAt(dateToday()); setReference(""); setNotes(""); setPoLineKey(""); setOperationId(""); setVendorId(""); };
  const issueBomMaterialsToProduction = () => {
    if (!bomIssueSelection?.component) { onNotice("Select the actual PO component line first."); return; }
    if (bomIssueOperationId && !bomIssueOperations.some(op => op.id === bomIssueOperationId)) { onNotice("The selected operation no longer belongs to this PO component line. Re-select the operation before issuing."); return; }
    const pendingRows = bomIssuePreview.filter(row => row.pending > 0);
    if (!pendingRows.length) { onNotice("There are no remaining BOM material requirements to issue for this PO component line."); return; }
    const shortages = pendingRows.filter(row => row.shortage > 0);
    if (shortages.length) {
      onNotice("No material was issued. Insufficient stock: " + shortages.map(row => row.material.code + " needs " + row.pending.toLocaleString("en-IN") + " " + row.material.unit + ", available " + row.available.toLocaleString("en-IN") + " " + row.material.unit).join("; ") + ". Receive/adjust stock first.");
      return;
    }
    const issueTotal = pendingRows.reduce((sum, row) => sum + row.pending, 0);
    if (!window.confirm("Issue all remaining BOM material requirements for " + bomIssueSelection.po.number + " / " + bomIssueSelection.component.partNumber + "?\n" + pendingRows.length + " material line(s), total " + issueTotal.toLocaleString("en-IN") + " material units. This creates append-only stock transactions and will not issue any partial line if stock is short.")) return;
    let result: { posted: number; shortage: string[] } = { posted: 0, shortage: [] };
    update(current => {
      const po = current.purchaseOrders.find(row => row.id === bomIssueSelection.po.id);
      const line = po?.lines.find(row => row.id === bomIssueSelection.line.id && !row.deletedAt);
      const component = current.components.find(row => row.id === line?.componentId);
      if (!po || !line || !component) { result = { posted: 0, shortage: ["The PO component line or Component Master record changed; refresh and select it again."] }; return current; }
      if (bomIssueOperationId && !current.operations.some(op => op.id === bomIssueOperationId && op.poId === po.id && op.poLineId === line.id && !op.deletedAt)) { result = { posted: 0, shortage: ["The selected process operation is no longer active on this PO component line. No material was issued."] }; return current; }
      const eligibleBom = current.bomLines.filter(row => row.componentId === component.id && !row.deletedAt && (!row.revision || row.revision === component.revision));
      const totals = new Map<string, { required: number; bomLineIds: string[] }>();
      for (const bom of eligibleBom) {
        const prior = totals.get(bom.materialId) || { required: 0, bomLineIds: [] };
        prior.required += bom.quantityPerPart * (1 + bom.scrapPercent / 100) * line.quantity;
        prior.bomLineIds.push(bom.id);
        totals.set(bom.materialId, prior);
      }
      const plan = [...totals.entries()].map(([materialId, total]) => {
        const material = current.materials.find(row => row.id === materialId && !row.deletedAt);
        const issued = current.inventoryTransactions.filter(row => row.itemType === "material" && row.itemId === materialId && row.poId === po.id && row.poLineId === line.id)
          .reduce((sum, row) => sum + (row.transactionType === "Issue to production" && row.direction === "out" ? row.quantity : row.transactionType === "Return" && row.direction === "in" ? -row.quantity : 0), 0);
        const available = current.inventoryTransactions.reduce((sum, row) => row.itemType === "material" && row.itemId === materialId ? sum + (row.direction === "in" ? row.quantity : -row.quantity) : sum, 0);
        return { material, materialId, bomLineIds: total.bomLineIds, pending: Math.max(0, total.required - Math.max(0, issued)), available };
      }).filter(row => row.pending > 0);
      const missing = plan.filter(row => !row.material);
      if (missing.length) { result = { posted: 0, shortage: missing.map(row => "Missing material " + row.materialId) }; return current; }
      const short = plan.filter(row => row.available + 1e-9 < row.pending);
      if (short.length) { result = { posted: 0, shortage: short.map(row => row.material!.code + " needs " + row.pending.toLocaleString("en-IN") + " " + row.material!.unit + ", available " + row.available.toLocaleString("en-IN") + " " + row.material!.unit) }; return current; }
      const stamp = nowIso();
      const reference = "BOM ISSUE · " + po.number + " · " + component.partNumber;
      const transactions: InventoryTransactionRecord[] = plan.map(row => ({
        id: makeId("stock"), itemType: "material", itemId: row.materialId, transactionType: "Issue to production", direction: "out", quantity: row.pending,
        occurredAt: dateToday(), reference, notes: "Automated BOM issue. PO line quantity: " + line.quantity + "; component revision: " + (component.revision || "—") + "; BOM line IDs: " + row.bomLineIds.join(", ") + ". Remaining requirement after prior issues/returns.",
        companyId: po.companyId, factoryId: po.factoryId, poId: po.id, poLineId: line.id, operationId: bomIssueOperationId || "", vendorId: "", reversalOfId: "", createdAt: stamp, createdBy: "AXIMACH BOM issue workflow"
      }));
      result = { posted: transactions.length, shortage: [] };
      return { ...current, inventoryTransactions: [...current.inventoryTransactions, ...transactions] };
    });
    if (result.shortage.length) onNotice("No material was issued. " + result.shortage.join("; ") + ".");
    else onNotice(result.posted + " BOM material issue transaction(s) posted to the stock ledger for " + bomIssueSelection.po.number + " / " + bomIssueSelection.component.partNumber + ". Quantities were based on PO quantity, BOM per-part quantity, scrap allowance, previous issues and returns.");
  };
  const postTransaction = () => {
    if (!itemId || !selectedItem) { onNotice("Select the material or component that physically moved."); return; }
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) { onNotice("Enter a positive finite quantity for the stock movement."); return; }
    if (!occurredAt) { onNotice("Enter the date of the physical stock movement."); return; }
    if (!reference.trim()) { onNotice("Enter a source reference, challan, issue slip, adjustment note or other movement reference."); return; }
    const requiredDirection = fixedStockDirections[transactionType];
    if (requiredDirection && direction !== requiredDirection) { onNotice(transactionType + " must be posted as stock " + requiredDirection + "."); return; }
    if (factoryId && !factories.some(factory => factory.id === factoryId && (!companyId || factory.companyId === companyId))) { onNotice("The selected factory is no longer active under the selected company."); return; }
    if (vendorId && !vendors.some(vendor => vendor.id === vendorId)) { onNotice("The selected stock vendor is missing or archived."); return; }
    if (operationId && !operations.some(op => op.id === operationId && (!selectedPoLine || (op.poId === selectedPoLine.po.id && op.poLineId === selectedPoLine.line.id)))) { onNotice("The selected operation does not belong to the chosen PO line or is no longer active."); return; }
    if (selectedPoLine && selectedPoLine.line.componentId && itemType === "component" && selectedPoLine.line.componentId !== itemId) { onNotice("The selected component stock item does not match the chosen PO line. Choose the matching part number."); return; }
    const currentBalance = stockBalance(itemType, itemId);
    const nextBalance = currentBalance + (direction === "in" ? q : -q);
    if (direction === "out" && nextBalance < 0 && !window.confirm("This issue will make the calculated balance negative (" + nextBalance.toLocaleString("en-IN") + "). Post anyway? Check the opening balance/receipts first.")) return;
    if (transactionType === "Receipt" && !vendorId && !reference.trim()) { onNotice("For a receipt, enter the supplier/vendor or a source reference such as a delivery challan."); return; }
    const stamp = nowIso();
    const row: InventoryTransactionRecord = {
      id: makeId("stock"), itemType, itemId, transactionType, direction, quantity: q, occurredAt,
      reference: reference.trim(), notes: notes.trim(), companyId, factoryId,
      poId: selectedPoLine?.po.id || "", poLineId: selectedPoLine?.line.id || "",
      operationId, vendorId, reversalOfId: "", createdAt: stamp, createdBy: "AXIMACH operator (not identity-verified)"
    };
    update(current => ({ ...current, inventoryTransactions: [...current.inventoryTransactions, row] }));
    resetTransaction();
    onNotice("Stock movement posted to the append-only ledger. The displayed balance is calculated from all posted in/out transactions; the screen itself never changes stock.");
  };

  return <section className="workspace-page module-functional-page master-data-page inventory-workspace">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED SERVER DATA" : syncStatus === "syncing" ? "SYNCING DATA" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO STOCK · POST TRANSACTIONS"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MATERIALS / BOM / STOCK LEDGER</div><h1>BOM & inventory<span>.</span></h1><p>Material masters link into component BOMs; stock balances are calculated from posted opening, receipt, issue, return, reject, scrap, finished goods and dispatch transactions.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("purchasing")}><FileText size={15}/> Purchase orders</button><button className="button-quiet" onClick={() => onSelectModule("process-map")}><Activity size={15}/> Process Map</button><button className="button-primary" onClick={() => { setTab("stock"); setItemId(""); }}><Plus size={15}/> Post stock movement</button></div></div>
    <div className="costing-tabs">
      <button className={tab==="materials"?"costing-tab-active":""} onClick={()=>{setTab("materials");setSearch("");}}><Package size={15}/> Material master ({materials.length})</button>
      <button className={tab==="bom"?"costing-tab-active":""} onClick={()=>{setTab("bom");setSearch("");}}><Boxes size={15}/> BOM lines ({bomLines.length})</button>
      <button className={tab==="stock"?"costing-tab-active":""} onClick={()=>{setTab("stock");setSearch("");}}><Warehouse size={15}/> Stock ledger ({inventoryTransactions.length})</button>
    </div>
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="materials"?"Search material code, grade, spec…":tab==="bom"?"Search component, material, revision…":"Search item, movement, reference…"} /></label><span className="module-number">{tab==="materials"?materials.length+" MATERIALS":tab==="bom"?bomLines.length+" BOM LINES":inventoryTransactions.length+" POSTED MOVEMENTS"}</span></div>
    {tab==="materials" && <>
      <div className="workspace-title-actions"><button className="button-primary" onClick={()=>{setMaterialDraft(emptyMaterial());setMaterialEditingId("");setMaterialFormOpen(true);}}><Plus size={14}/> Add material</button><button className="button-quiet" onClick={()=>onSelectModule("vendors")}><Users size={14}/> Vendor master</button></div>
      {materialFormOpen && <section className="surface-panel module-record-form-panel"><div className="panel-heading"><div><h3>{materialEditingId?"Edit material":"New material master"}</h3><p>Actual material/grade and quoted or purchase rate only; no default stock figures.</p></div><button className="icon-control" onClick={resetMaterial} aria-label="Close material form"><X size={15}/></button></div>
        <div className="module-record-form">
          <label>Material code *<input value={materialDraft.code} onChange={e=>setMaterialDraft({...materialDraft,code:e.target.value})} placeholder="e.g. EN8-ROUND-80"/></label>
          <label>Material name *<input value={materialDraft.name} onChange={e=>setMaterialDraft({...materialDraft,name:e.target.value})} placeholder="Actual stock/material name"/></label>
          <label>Grade / specification<input value={materialDraft.grade} onChange={e=>setMaterialDraft({...materialDraft,grade:e.target.value})} placeholder="EN8, SS304, Al 6061…"/></label>
          <label>Unit *<select value={materialDraft.unit} onChange={e=>setMaterialDraft({...materialDraft,unit:e.target.value})}><option>kg</option><option>Nos</option><option>mm</option><option>m</option><option>litre</option><option>sheet</option><option>bar</option><option>set</option></select></label>
          <label>Rate per unit (₹)<input type="number" min="0" step="0.01" value={materialDraft.ratePerUnit} onChange={e=>setMaterialDraft({...materialDraft,ratePerUnit:Math.max(0,Number(e.target.value)||0)})}/></label>
          <SearchablePicker id="material-preferred-vendor" label="Preferred vendor" value={materialDraft.preferredVendorId} placeholder="Type supplier name / phone…" options={vendors.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")}))} onChange={preferredVendorId=>setMaterialDraft({...materialDraft,preferredVendorId})}/>
          <label className="module-form-wide">Specification / notes<input value={materialDraft.specification} onChange={e=>setMaterialDraft({...materialDraft,specification:e.target.value})} placeholder="Size, standard, certificate or inspection notes"/></label>
          <label className="module-form-wide">Notes<input value={materialDraft.notes} onChange={e=>setMaterialDraft({...materialDraft,notes:e.target.value})} placeholder="Optional material notes"/></label>
          <div className="module-form-actions"><button className="button-primary" onClick={saveMaterial}><Check size={14}/> Save material</button><button className="button-quiet" onClick={resetMaterial}>Cancel</button></div>
        </div>
      </section>}
      {visibleMaterials.length ? <div className="module-workbench-grid"><section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Material stock and value</h3><p>Balances are derived from the transaction ledger; opening stock must be posted as an opening movement.</p></div></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Material</th><th>Grade</th><th>Unit</th><th>Posted stock</th><th>Rate / unit</th><th>Stock value (entered rate)</th><th>BOM references</th><th>Vendor</th><th>Actions</th></tr></thead><tbody>{visibleMaterials.map(m=>{const balance=stockBalance("material",m.id);return <tr key={m.id}><td><strong>{m.code} · {m.name}</strong><small>{m.specification||"No specification"}</small></td><td>{m.grade||"—"}</td><td>{m.unit}</td><td>{balance.toLocaleString("en-IN")}</td><td>{money(m.ratePerUnit)}</td><td>{money(balance*m.ratePerUnit)}</td><td>{bomLines.filter(b=>b.materialId===m.id&&!b.deletedAt).length}</td><td>{vendors.find(v=>v.id===m.preferredVendorId)?.company||"Not linked"}</td><td><button className="button-quiet compact-button" onClick={()=>editMaterial(m)}>Edit</button> <button className="button-quiet compact-button" onClick={()=>{setTab("stock");setItemType("material");setItemId(m.id);}}>Post movement</button> <button className="button-quiet compact-button" onClick={()=>archiveMaterial(m)}><Trash2 size={12}/> Archive</button></td></tr>})}</tbody></table></div></section>
        <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><h3>Inventory controls</h3><p>Actual physical movements only.</p></div><Warehouse size={19}/></div><button className="related-row" onClick={()=>{setTab("stock");setTransactionType("Opening balance");setItemType("material");setDirection("in");}}><Plus size={14}/><span><strong>Opening balance</strong><small>Post a dated opening quantity</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={()=>{setTab("stock");setTransactionType("Receipt");setItemType("material");setDirection("in");}}><Truck size={14}/><span><strong>Supplier receipt</strong><small>Link vendor and source reference</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={()=>{setTab("bom");setBomFormOpen(true);}}><Boxes size={14}/><span><strong>Build a component BOM</strong><small>Quantity per part × material rate</small></span><ArrowRight size={14}/></button><div className="module-safety-note"><ShieldCheck size={14}/><span>Stock changes are append-only transactions. No stock changes when you open this workspace.</span></div></aside></div> : <div className="module-empty-state"><Package size={26}/><h3>No material masters added</h3><p>Create the actual material grades and rates used by your shop, then post opening stock or receipt movements to establish balances.</p><button className="button-primary" onClick={()=>{setMaterialDraft(emptyMaterial());setMaterialEditingId("");setMaterialFormOpen(true);}}><Plus size={14}/> Add first material</button></div>}
    </>}
    {tab==="bom" && <>
      <div className="workspace-title-actions"><button className="button-primary" onClick={()=>{setBomDraft(emptyBom());setBomEditingId("");setBomFormOpen(true);}}><Plus size={14}/> Add BOM line</button><button className="button-quiet" onClick={()=>onSelectModule("components")}><Package size={14}/> Component master</button></div>
      {bomFormOpen&&<section className="surface-panel module-record-form-panel"><div className="panel-heading"><div><h3>{bomEditingId?"Edit BOM line":"New component BOM line"}</h3><p>Each BOM row links a real component revision to a material record by ID.</p></div><button className="icon-control" onClick={resetBom} aria-label="Close BOM form"><X size={15}/></button></div><div className="module-record-form">
        <SearchablePicker id="bom-component" label="Component / part number *" value={bomDraft.componentId} placeholder="Type component number / name…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={componentId=>setBomDraft({...bomDraft,componentId})}/>
        <SearchablePicker id="bom-material" label="Material *" value={bomDraft.materialId} placeholder="Type material code / grade…" options={materials.map(m=>({id:m.id,label:m.code+" · "+m.name+" · "+m.grade}))} onChange={materialId=>setBomDraft({...bomDraft,materialId})}/>
        <label>Drawing / BOM revision<input value={bomDraft.revision} onChange={e=>setBomDraft({...bomDraft,revision:e.target.value})} placeholder="Revision identifier"/></label>
        <label>Quantity per component *<input type="number" min="0.000001" step="0.000001" value={bomDraft.quantityPerPart||""} onChange={e=>setBomDraft({...bomDraft,quantityPerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Scrap allowance (%)<input type="number" min="0" max="100" step="0.1" value={bomDraft.scrapPercent} onChange={e=>setBomDraft({...bomDraft,scrapPercent:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label>
        <label className="module-form-wide">Notes<input value={bomDraft.notes} onChange={e=>setBomDraft({...bomDraft,notes:e.target.value})} placeholder="Material standard, cutting allowance, special requirements"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveBom}><Check size={14}/> Save BOM line</button><button className="button-quiet" onClick={resetBom}>Cancel</button></div>
        {!components.length&&<div className="module-safety-note">Add actual components first. BOM lines use component master IDs; they do not create example parts.</div>}
        {!materials.length&&<div className="module-safety-note">Add actual material masters first. BOM lines use material master IDs.</div>}
      </div></section>}
      {visibleBom.length?<section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Component BOM and estimated material requirement</h3><p>Estimate uses the material rate you entered; no external market price is fetched.</p></div></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component</th><th>Revision</th><th>Material</th><th>Qty / part</th><th>Scrap %</th><th>Effective qty / part</th><th>Material rate</th><th>Estimated cost / part</th><th>Posted stock</th><th>Actions</th></tr></thead><tbody>{visibleBom.map(row=>{const component=components.find(c=>c.id===row.componentId);const material=materials.find(m=>m.id===row.materialId);const qty=row.quantityPerPart*(1+row.scrapPercent/100);return <tr key={row.id}><td>{component?.partNumber||"Archived component"} · {component?.name||""}</td><td>{row.revision||"—"}</td><td>{material?.code||"Archived material"} · {material?.name||""} ({material?.grade||"—"})</td><td>{row.quantityPerPart.toLocaleString("en-IN")}</td><td>{row.scrapPercent}%</td><td>{qty.toLocaleString("en-IN")}</td><td>{money(material?.ratePerUnit||0)}/{material?.unit||"unit"}</td><td>{money(qty*(material?.ratePerUnit||0))}</td><td>{material?stockBalance("material",material.id).toLocaleString("en-IN")+" "+material.unit:"—"}</td><td><button className="button-quiet compact-button" onClick={()=>editBom(row)}>Edit</button> <button className="button-quiet compact-button" onClick={()=>archiveBom(row)}><Trash2 size={12}/> Archive</button></td></tr>})}</tbody></table></div></section>:<div className="module-empty-state"><Boxes size={26}/><h3>No BOM lines added</h3><p>Link the actual component and material master records to calculate an estimated raw-material requirement and rate per accepted part.</p><button className="button-primary" disabled={!components.length||!materials.length} onClick={()=>{setBomDraft(emptyBom());setBomEditingId("");setBomFormOpen(true);}}><Plus size={14}/> Add BOM line</button></div>}
    </>}
    {tab==="stock" && <>
      <section className="surface-panel bom-production-issue-panel"><div className="panel-heading"><div><h3>Issue BOM materials to production</h3><p>Calculate remaining material needs from the selected PO component quantity and its matching BOM revision. The workflow checks all stock balances before posting; it will not partially issue a short kit.</p></div><span className="record-state">BOM → STOCK → PRODUCTION</span></div><div className="module-record-form">
        <SearchablePicker id="bom-issue-po-line" label="PO component line *" value={bomIssuePoLineKey} placeholder="Search company, PO, part number…" options={bomIssuePoLineOptions.map(row=>({id:row.id,label:row.label}))} onChange={value=>{setBomIssuePoLineKey(value);setBomIssueOperationId("");}}/>
        <SearchablePicker id="bom-issue-operation" label="Production operation (optional)" value={bomIssueOperationId} placeholder="Search operation for traceability…" options={bomIssueOperations.map(row=>({id:row.id,label:"OP-"+String(row.sequence).padStart(3,"0")+" · "+row.name+" · "+row.status}))} onChange={setBomIssueOperationId}/>
        {bomIssueSelection?.component&&<div className="module-safety-note module-form-wide"><Boxes size={14}/><span>Component: <strong>{bomIssueSelection.component.partNumber} · {bomIssueSelection.component.name}</strong> · PO quantity: <strong>{bomIssueSelection.line.quantity.toLocaleString("en-IN")}</strong> · BOM revision: <strong>{bomIssueSelection.component.revision||"Default / unrevisioned"}</strong></span></div>}
        {bomIssuePoLineKey&&<div className="module-form-wide">{bomIssuePreview.length?<div className="costing-table-wrap bom-issue-preview"><table className="costing-table"><thead><tr><th>Material</th><th>Required (BOM × PO qty)</th><th>Already issued net</th><th>Remaining to issue</th><th>Available stock</th><th>Shortage</th></tr></thead><tbody>{bomIssuePreview.map(row=><tr key={row.material.id}><td><strong>{row.material.code} · {row.material.name}</strong><small>{row.material.grade||"—"} · {row.material.unit}</small></td><td>{row.required.toLocaleString("en-IN",{maximumFractionDigits:4})}</td><td>{row.issued.toLocaleString("en-IN",{maximumFractionDigits:4})}</td><td><strong>{row.pending.toLocaleString("en-IN",{maximumFractionDigits:4})}</strong></td><td>{row.available.toLocaleString("en-IN",{maximumFractionDigits:4})}</td><td>{row.shortage>0?<span className="record-state state-pending">{row.shortage.toLocaleString("en-IN",{maximumFractionDigits:4})}</span>:<span className="record-state state-complete">0</span>}</td></tr>)}</tbody></table></div>:<div className="module-empty-state"><Boxes size={20}/><h3>No matching active BOM lines</h3><p>Add BOM rows for this exact component revision before issuing materials.</p><button className="button-quiet compact-button" onClick={()=>setTab("bom")}>Open BOM lines</button></div>}</div>}
        <div className="module-form-actions"><button className="button-primary" disabled={!bomIssuePoLineKey||!bomIssuePreview.length||bomIssuePreview.every(row=>row.pending<=0)||bomIssuePreview.some(row=>row.shortage>0)} onClick={issueBomMaterialsToProduction}><Check size={14}/> Issue all available BOM requirements</button><button className="button-quiet" onClick={()=>{setBomIssuePoLineKey("");setBomIssueOperationId("");}}>Clear issue selection</button></div>
      </div></section>
      <section className="surface-panel module-record-form-panel"><div className="panel-heading"><div><h3>Post a stock movement</h3><p>Each posted row is an append-only record; corrections should be posted as a new adjustment/reversal instead of editing history.</p></div><span className="record-state">LEDGER</span></div><div className="module-record-form">
        <label>Item type<select value={itemType} onChange={e=>{setItemType(e.target.value as "material"|"component");setItemId("");}}><option value="material">Raw material</option><option value="component">Component / WIP / finished goods</option></select></label>
        <SearchablePicker id="stock-item" label={itemType==="material"?"Material *":"Component *"} value={itemId} placeholder="Type material/part number…" options={itemOptions} onChange={setItemId}/>
        <label>Transaction type<select value={transactionType} onChange={e=>{const next=e.target.value as StockTransactionKind;setTransactionType(next);const required=fixedStockDirections[next];if(required)setDirection(required);}}>{stockKinds.map(k=><option key={k}>{k}</option>)}</select></label>
        <label>Movement direction<select value={direction} disabled={Boolean(fixedStockDirections[transactionType])} onChange={e=>setDirection(e.target.value as "in"|"out")}><option value="in">Stock in (+)</option><option value="out">Stock out (−)</option></select></label>
        <label>Quantity *<input type="number" min="0.000001" step="0.000001" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="Actual moved quantity"/></label>
        <label>Movement date *<input type="date" value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></label>
        <SearchablePicker id="stock-company" label="Company" value={companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name}))} onChange={id=>{setCompanyId(id);setFactoryId("");setPoLineKey("");setOperationId("");}}/>
        <SearchablePicker id="stock-factory" label="Factory" value={factoryId} placeholder="Type factory name…" options={factories.filter(f=>f.companyId===companyId).map(f=>({id:f.id,label:f.name}))} onChange={id=>{setFactoryId(id);setPoLineKey("");setOperationId("");}}/>
        <SearchablePicker id="stock-po-line" label="PO component line (optional)" value={poLineKey} placeholder="Type PO / part number…" options={poLineOptions.map(row=>({id:row.id,label:row.label}))} onChange={id=>{setPoLineKey(id);const row=poLineOptions.find(x=>x.id===id);if(row){setCompanyId(row.po.companyId);setFactoryId(row.po.factoryId);}setOperationId("");}}/>
        <SearchablePicker id="stock-operation" label="Operation (optional)" value={operationId} placeholder="Type operation name…" options={operationOptions.map(op=>({id:op.id,label:op.name+" · "+(components.find(c=>c.id===op.componentId)?.partNumber||"Component")}))} onChange={setOperationId}/>
        <SearchablePicker id="stock-vendor" label="Supplier / vendor (optional)" value={vendorId} placeholder="Type vendor / phone…" options={vendors.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")}))} onChange={setVendorId}/>
        <label>Reference (GRN/challan/job) *<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Receipt, issue slip, challan, batch…"/></label>
        <label className="module-form-wide">Movement notes / reason<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Actual receipt, issue, return, reject, scrap or adjustment reason"/></label>
        {selectedItem&&<div className="module-safety-note module-form-wide"><Warehouse size={14}/><span>Current calculated balance: <strong>{stockBalance(itemType,itemId).toLocaleString("en-IN")} {"unit" in selectedItem?selectedItem.unit:"pcs"}</strong>. After this movement: <strong>{(stockBalance(itemType,itemId)+(direction==="in"?Math.max(0,Number(quantity)||0):-Math.max(0,Number(quantity)||0))).toLocaleString("en-IN")} {"unit" in selectedItem?selectedItem.unit:"pcs"}</strong>. No stock changes until you press Post movement.</span></div>}
        <div className="module-form-actions"><button className="button-primary" onClick={postTransaction}><Check size={14}/> Post movement</button><button className="button-quiet" onClick={resetTransaction}>Clear form</button></div>
      </div></section>
      <section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Stock movement history ({visibleTransactions.length})</h3><p>Every row shows source, quantity and reference. The ledger is not silently edited when stock is displayed.</p></div></div>
        {visibleTransactions.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Date</th><th>Item</th><th>Transaction</th><th>Movement</th><th>Quantity</th><th>Balance after all posted entries</th><th>Company / factory</th><th>PO / operation</th><th>Vendor</th><th>Reference / notes</th></tr></thead><tbody>{visibleTransactions.map(row=>{const item=row.itemType==="material"?materials.find(m=>m.id===row.itemId):components.find(x=>x.id===row.itemId);const po=orders.find(p=>p.id===row.poId);const op=operations.find(x=>x.id===row.operationId);const balance=stockBalance(row.itemType,row.itemId);return <tr key={row.id}><td>{row.occurredAt}</td><td><strong>{item?("code" in item?(item as MaterialRecord).code:(item as any).partNumber):"Archived item"}</strong><small>{item?.name||"Missing item"}</small></td><td>{row.transactionType}</td><td><span className={row.direction==="in"?"record-state state-complete":"record-state state-pending"}>{row.direction==="in"?"IN +":"OUT −"}</span></td><td>{row.quantity.toLocaleString("en-IN")} {"unit" in (item||{})?(item as MaterialRecord).unit:"pcs"}</td><td>{balance.toLocaleString("en-IN")} {"unit" in (item||{})?(item as MaterialRecord).unit:"pcs"}</td><td>{companies.find(x=>x.id===row.companyId)?.name||"—"} / {factories.find(x=>x.id===row.factoryId)?.name||"—"}</td><td>{po?.number||"—"} / {op?.name||"—"}</td><td>{vendors.find(v=>v.id===row.vendorId)?.company||"—"}</td><td>{row.reference||"—"}{row.notes?" · "+row.notes:""}</td></tr>})}</tbody></table></div>:<div className="module-empty-state"><ClipboardList size={26}/><h3>No stock movements posted</h3><p>Post an opening balance or actual receipt/issue. Stock balances remain empty until ledger transactions exist.</p></div>}
      </section>
    </>}
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Material and component stock are ledger-derived. Receipt/issue, WIP, rejected, scrap, finished-goods and dispatch rows carry IDs to the material/component and optional PO line/operation/vendor. This workspace does not delete posted history; use a new adjustment for corrections.</span></div>
  </section>;
}
