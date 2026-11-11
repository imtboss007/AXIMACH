import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Boxes, Check, ClipboardList, Factory, FileText, Package, Plus, Search, ShieldCheck, Trash2, Truck, Users, Warehouse, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type BomLineRecord, type InventoryTransactionRecord, type MaterialProcessLinkRecord, type MaterialRecord, type StockTransactionKind } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import PartMaterialCostingPanel from "./PartMaterialCostingPanel";

type InventoryNavigationContext = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string; subtab?:string };
type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string, context?: InventoryNavigationContext) => void; initialContext?: InventoryNavigationContext };
type Tab = "materials" | "bom" | "stock" | "process-links";
type MaterialDraft = Omit<MaterialRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type BomDraft = Omit<BomLineRecord, "id" | "createdAt" | "updatedAt" | "deletedAt">;
type BomIssuePreviewRow = { material: MaterialRecord; bomLineIds: string[]; required: number; issued: number; pending: number; available: number; shortage: number };
const emptyMaterial = (): MaterialDraft => ({ code: "", name: "", grade: "", unit: "kg", specification: "", preferredVendorId: "", ratePerUnit: 0, notes: "", materialType: "", shapeType: "Round bar", dimensions: {}, dimensionUnit: "mm", densityKgM3: 0, densityUnit: "kg/m3", priceUnit: "kg" });
const emptyBom = (): BomDraft => ({ componentId: "", partId: "", materialId: "", revision: "", quantityPerPart: 0, scrapPercent: 0, notes: "" });
const stockKinds: StockTransactionKind[] = ["Opening balance", "Receipt", "Issue to production", "WIP transfer", "Return", "Rejected", "Scrap", "Finished goods receipt", "Dispatch", "Adjustment"];
const MATERIAL_SHAPES = ["Round bar", "Square bar", "Hexagonal bar", "Flat bar", "Sheet", "Plate", "Coil", "Pipe", "Round tube", "Square tube", "Rectangular tube", "Angle", "Channel", "I-beam / H-beam", "T-section", "Billet", "Bloom", "Slab", "Wire", "Wire rod", "Casting", "Forging", "Perforated sheet", "Chequered plate", "Expanded metal / mesh", "Custom profile", "Cut blank", "Other"] as const;
const MATERIAL_DIMENSIONS = [{ key: "diameter", label: "Diameter (mm)" }, { key: "width", label: "Width (mm)" }, { key: "height", label: "Height (mm)" }, { key: "thickness", label: "Thickness (mm)" }, { key: "length", label: "Length (mm)" }, { key: "outerDiameter", label: "Outer diameter / OD (mm)" }, { key: "innerDiameter", label: "Inner diameter / ID (mm)" }, { key: "wallThickness", label: "Wall thickness (mm)" }, { key: "outerWidth", label: "Outer width (mm)" }, { key: "outerHeight", label: "Outer height (mm)" }, { key: "legA", label: "Leg A (mm)" }, { key: "legB", label: "Leg B (mm)" }, { key: "flangeWidth", label: "Flange width (mm)" }, { key: "flangeThickness", label: "Flange thickness (mm)" }, { key: "webThickness", label: "Web thickness (mm)" }, { key: "acrossFlats", label: "Across flats (mm)" }];
const MATERIAL_DIMENSIONS_BY_SHAPE: Record<string, Array<{key:string;label:string}>> = {
  "Round bar":[{key:"diameter",label:"Diameter (mm)"},{key:"length",label:"Length (mm)"}],
  "Square bar":[{key:"width",label:"Side width (mm)"},{key:"length",label:"Length (mm)"}],
  "Hexagonal bar":[{key:"acrossFlats",label:"Across flats (mm)"},{key:"length",label:"Length (mm)"}],
  "Flat bar":[{key:"width",label:"Width (mm)"},{key:"thickness",label:"Thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "Sheet":[{key:"width",label:"Width (mm)"},{key:"length",label:"Length (mm)"},{key:"thickness",label:"Thickness (mm)"}],
  "Plate":[{key:"width",label:"Width (mm)"},{key:"length",label:"Length (mm)"},{key:"thickness",label:"Thickness (mm)"}],
  "Coil":[{key:"width",label:"Width (mm)"},{key:"thickness",label:"Thickness (mm)"},{key:"outerDiameter",label:"Coil OD (mm)"},{key:"innerDiameter",label:"Coil ID (mm)"}],
  "Pipe":[{key:"outerDiameter",label:"Outer diameter / OD (mm)"},{key:"innerDiameter",label:"Inner diameter / ID (mm)"},{key:"length",label:"Length (mm)"}],
  "Round tube":[{key:"outerDiameter",label:"Outer diameter / OD (mm)"},{key:"innerDiameter",label:"Inner diameter / ID (mm)"},{key:"length",label:"Length (mm)"}],
  "Square tube":[{key:"outerWidth",label:"Outer side (mm)"},{key:"wallThickness",label:"Wall thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "Rectangular tube":[{key:"outerWidth",label:"Outer width (mm)"},{key:"outerHeight",label:"Outer height (mm)"},{key:"wallThickness",label:"Wall thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "Angle":[{key:"legA",label:"Leg A (mm)"},{key:"legB",label:"Leg B (mm)"},{key:"thickness",label:"Thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "Channel":[{key:"width",label:"Flange width (mm)"},{key:"height",label:"Overall height (mm)"},{key:"webThickness",label:"Web thickness (mm)"},{key:"flangeThickness",label:"Flange thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "I-beam / H-beam":[{key:"flangeWidth",label:"Flange width (mm)"},{key:"height",label:"Overall height (mm)"},{key:"webThickness",label:"Web thickness (mm)"},{key:"flangeThickness",label:"Flange thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "T-section":[{key:"flangeWidth",label:"Flange width (mm)"},{key:"height",label:"Overall height (mm)"},{key:"webThickness",label:"Web thickness (mm)"},{key:"flangeThickness",label:"Flange thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "Wire":[{key:"diameter",label:"Diameter (mm)"},{key:"length",label:"Length (mm)"}],
  "Wire rod":[{key:"diameter",label:"Diameter (mm)"},{key:"length",label:"Length (mm)"}],
  "Billet":[{key:"width",label:"Width (mm)"},{key:"height",label:"Height (mm)"},{key:"length",label:"Length (mm)"}],
  "Bloom":[{key:"width",label:"Width (mm)"},{key:"height",label:"Height (mm)"},{key:"length",label:"Length (mm)"}],
  "Slab":[{key:"width",label:"Width (mm)"},{key:"thickness",label:"Thickness (mm)"},{key:"length",label:"Length (mm)"}],
  "Cut blank":[{key:"width",label:"Width (mm)"},{key:"height",label:"Height (mm)"},{key:"thickness",label:"Thickness (mm)"},{key:"length",label:"Length (mm)"}]
};
const fixedStockDirections: Partial<Record<StockTransactionKind, "in" | "out">> = { "Opening balance": "in", "Receipt": "in", "Issue to production": "out", "Return": "in", "Scrap": "out", "Finished goods receipt": "in", "Dispatch": "out" };
const money = (v: number) => "₹" + (Number(v) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dateToday = () => new Date().toISOString().slice(0, 10);
const STANDARD_MATERIAL_GRADES = [
  ["Mild steel","MS / low-carbon steel",7850,"Steel"],["Mild steel","IS 2062 E250",7850,"Steel"],["Mild steel","IS 2062 E350",7850,"Steel"],
  ["Carbon steel","EN1A",7850,"Steel"],["Carbon steel","EN8",7850,"Steel"],["Carbon steel","EN9",7850,"Steel"],["Alloy steel","EN19",7850,"Steel"],["Alloy steel","EN24",7850,"Steel"],["Alloy steel","EN36",7850,"Steel"],["Alloy steel","EN31",7850,"Steel"],
  ["Stainless steel","SS 304",7930,"Stainless steel"],["Stainless steel","SS 316",8000,"Stainless steel"],["Stainless steel","SS 410",7750,"Stainless steel"],["Stainless steel","SS 420",7750,"Stainless steel"],
  ["Aluminium","Aluminium 1050",2710,"Aluminium"],["Aluminium","Aluminium 6061",2700,"Aluminium"],["Aluminium","Aluminium 6063",2700,"Aluminium"],["Aluminium","Aluminium 6082",2700,"Aluminium"],["Aluminium","Aluminium 7075",2810,"Aluminium"],
  ["Copper","Copper C11000 / ETP",8960,"Copper"],["Brass","Brass C26000",8530,"Brass"],["Brass","Brass C36000",8500,"Brass"],["Bronze","Tin bronze",8800,"Bronze"],["Cast iron","Grey cast iron",7200,"Cast iron"],["Zinc","Zinc",7140,"Non-ferrous"],["Titanium","Titanium Grade 2",4510,"Titanium"],["Alloy steel","AISI 4140 / EN19",7850,"Steel"],["Alloy steel","AISI 4340 / EN24",7850,"Steel"],["Stainless steel","SS 304L",7930,"Stainless steel"],["Stainless steel","SS 316L",8000,"Stainless steel"],["Stainless steel","Duplex 2205",7850,"Stainless steel"],["Aluminium","Aluminium 5052",2680,"Aluminium"],["Aluminium","Aluminium 5083",2660,"Aluminium"],["Aluminium","Aluminium 2014",2800,"Aluminium"],["Copper","Copper C10100",8890,"Copper"],["Copper alloy","Phosphor bronze",8800,"Bronze"],["Nickel alloy","Inconel 625",8440,"Nickel alloy"],["Nickel alloy","Monel 400",8800,"Nickel alloy"],["Magnesium","Magnesium AZ31B",1770,"Magnesium"],["Engineering plastic","Nylon 6 (PA6)",1140,"Plastic"],["Engineering plastic","Acetal / POM",1410,"Plastic"],["Engineering plastic","HDPE",950,"Plastic"],["Engineering plastic","UHMWPE",940,"Plastic"],["Engineering plastic","PTFE",2200,"Plastic"],["Engineering plastic","PVC rigid",1400,"Plastic"],["Engineering plastic","Polycarbonate",1200,"Plastic"],["Engineering plastic","ABS",1070,"Plastic"],["Engineering plastic","Acrylic / PMMA",1190,"Plastic"],["Engineering plastic","Polypropylene (PP)",900,"Plastic"],["Carbon steel","AISI 1018",7870,"Steel"],["Carbon steel","S355 / IS 2062 E350",7850,"Steel"],["Alloy steel","AISI 4130",7850,"Steel"],["Alloy steel","AISI 52100 / 100Cr6",7810,"Steel"],["Stainless steel","SS 201",7800,"Stainless steel"],["Stainless steel","SS 303",7900,"Stainless steel"],["Stainless steel","SS 430",7700,"Stainless steel"],["Stainless steel","17-4PH",7800,"Stainless steel"],["Aluminium","Aluminium 1100",2710,"Aluminium"],["Aluminium","Aluminium 3003",2730,"Aluminium"],["Aluminium","Aluminium 6061-T6",2700,"Aluminium"],["Aluminium","Aluminium 7075-T6",2810,"Aluminium"],["Copper alloy","Cupronickel 70/30",8960,"Copper alloy"],["Nickel alloy","Hastelloy C276",8410,"Nickel alloy"],["Engineering plastic","Polyetheretherketone (PEEK)",1300,"Plastic"],["Engineering plastic","Polyamide 66 (PA66)",1140,"Plastic"]
] as const;

export default function InventoryWorkspace({ onBack, onNotice, notice, onSelectModule, initialContext }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const materials = activeRows(data.materials);
  useEffect(() => {
    const seeds = STANDARD_MATERIAL_GRADES.map(([name,grade,density,type]) => ({
      id: "material-seed-" + grade.toLowerCase().replace(/[^a-z0-9]+/g,"-"), code: grade.toUpperCase().replace(/[^A-Z0-9]+/g,"-"), name, grade, unit:"kg",
      specification:"Bundled typical room-temperature reference density in kg/m³. Reference: MLC metal density chart (https://mlc.org.uk/guides/metal-density-chart), Calibr material density table (https://calibr.pro/tables/density-of-materials-chart/) and BÜLTE polymer technical data (https://www.bulte.com/en/technical-resources/technical-data). Verify the exact grade and supplier material certificate before production use.", preferredVendorId:"", ratePerUnit:0,
      notes:"Reference density; edit for supplier / material certificate.", materialType:type, densityKgM3:density, densityUnit:"kg/m3" as const, priceUnit:"kg" as const, createdAt:nowIso(), updatedAt:nowIso()
    }));
    update(current => { const keys = new Set(current.materials.map(row => (row.name+"::"+row.grade).toLowerCase())); const missing=seeds.filter(row=>!keys.has((row.name+"::"+row.grade).toLowerCase())); return missing.length?{...current,materials:[...missing,...current.materials]}:current; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const components = activeRows(data.components);
  const bomLines = activeRows(data.bomLines);
  const companies = activeRows(data.companies);
  const factories = activeRows(data.factories);
  const orders = activeRows(data.purchaseOrders);
  const vendors = activeRows(data.vendors);
  const inventoryTransactions = activeRows(data.inventoryTransactions);
  const operations = activeRows(data.operations);
  const [tab, setTab] = useState<Tab>(() => initialContext?.subtab === "process-links" ? "process-links" : "materials");
  const [materialLinkPoLineKey, setMaterialLinkPoLineKey] = useState(() => initialContext?.poId && initialContext?.poLineId ? initialContext.poId+"::"+initialContext.poLineId : "");
  const [materialLinkBomLineId, setMaterialLinkBomLineId] = useState("");
  const [materialLinkOperationId, setMaterialLinkOperationId] = useState(initialContext?.operationId || "");
  const [materialLinkQuantityPerPart, setMaterialLinkQuantityPerPart] = useState("");
  const [materialLinkFlowType, setMaterialLinkFlowType] = useState<MaterialProcessLinkRecord["flowType"]>("Material input");
  const [materialLinkPlacement, setMaterialLinkPlacement] = useState<"before"|"after">("before");
  const [materialLinkNotes, setMaterialLinkNotes] = useState("");
  const [materialLinkEditingId, setMaterialLinkEditingId] = useState("");
  const [search, setSearch] = useState("");
  const [directoryCompanyId, setDirectoryCompanyId] = useState("");
  const [directoryPoId, setDirectoryPoId] = useState("");
  const [directoryComponentId, setDirectoryComponentId] = useState("");
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
  useEffect(() => {
    // Hydrate every filter from the incoming record context, including the
    // empty case, so a new module visit cannot inherit a stale component/PO.
    setMaterialLinkPoLineKey(initialContext?.poId && initialContext?.poLineId ? initialContext.poId+"::"+initialContext.poLineId : "");
    setMaterialLinkOperationId(initialContext?.operationId || "");
    setTab(initialContext?.subtab === "process-links" ? "process-links" : "materials");
    setDirectoryCompanyId(initialContext?.companyId || "");
    setDirectoryPoId(initialContext?.poId || "");
    setDirectoryComponentId(initialContext?.componentId || "");
  }, [initialContext?.poId, initialContext?.poLineId, initialContext?.operationId, initialContext?.subtab, initialContext?.companyId, initialContext?.componentId]);
  const directoryPoOptions = orders.filter(po => !directoryCompanyId || po.companyId === directoryCompanyId);
  const directoryComponentOptions = components.filter(component => (!directoryPoId || orders.some(po => po.id === directoryPoId && po.lines.some(line => line.componentId === component.id))) && (!directoryCompanyId || component.companyId === directoryCompanyId || orders.some(po => po.companyId === directoryCompanyId && po.lines.some(line => line.componentId === component.id))));
  const directoryDimensionFields = MATERIAL_DIMENSIONS_BY_SHAPE[materialDraft.shapeType || "Round bar"] || MATERIAL_DIMENSIONS;

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
  const materialLinkSelection = bomIssuePoLineOptions.find(row => row.id === materialLinkPoLineKey);
  const materialProcessLinks = activeRows(data.materialProcessLinks || []);
  const materialLinkBomOptions = materialLinkSelection?.component
    ? bomLines.filter(row => row.componentId === materialLinkSelection.component!.id
      && (!row.revision || row.revision === materialLinkSelection.component!.revision)
      && (!materialLinkSelection.line.partId || !row.partId || row.partId === materialLinkSelection.line.partId))
    : [];
  const materialLinkOperations = materialLinkSelection
    ? operations.filter(op => op.poId === materialLinkSelection.po.id && op.poLineId === materialLinkSelection.line.id && op.componentId === materialLinkSelection.line.componentId && !op.deletedAt)
    : [];
  const visibleMaterialProcessLinks = materialProcessLinks.filter(link => {
    const linkedPO=orders.find(po=>po.id===link.poId);
    return (!materialLinkPoLineKey || link.poId+"::"+link.poLineId === materialLinkPoLineKey)
      && (!directoryCompanyId || link.companyId===directoryCompanyId || linkedPO?.companyId===directoryCompanyId)
      && (!directoryPoId || link.poId===directoryPoId)
      && (!directoryComponentId || link.componentId===directoryComponentId)
      && (!search.trim() || [link.id,link.flowType,link.placement,link.notes,link.quantityPerPart,materials.find(m=>m.id===link.materialId)?.code,materials.find(m=>m.id===link.materialId)?.name,operations.find(op=>op.id===link.operationId)?.name].join(" ").toLowerCase().includes(search.toLowerCase().trim()));
  });
  const selectedMaterialLinkBom = materialLinkBomOptions.find(row => row.id === materialLinkBomLineId);
  const selectedMaterialLinkMaterial = materials.find(row => row.id === selectedMaterialLinkBom?.materialId);
  const resetMaterialLink = () => { setMaterialLinkEditingId(""); setMaterialLinkBomLineId(""); setMaterialLinkOperationId(""); setMaterialLinkQuantityPerPart(""); setMaterialLinkFlowType("Material input"); setMaterialLinkPlacement("before"); setMaterialLinkNotes(""); };
  const editMaterialLink = (link: MaterialProcessLinkRecord) => {
    setMaterialLinkEditingId(link.id); setMaterialLinkPoLineKey(link.poId+"::"+link.poLineId); setMaterialLinkBomLineId(link.bomLineId);
    setMaterialLinkOperationId(link.operationId); setMaterialLinkQuantityPerPart(String(link.quantityPerPart)); setMaterialLinkFlowType(link.flowType);
    setMaterialLinkPlacement(link.placement); setMaterialLinkNotes(link.notes||""); setTab("process-links");
  };
  const saveMaterialLink = () => {
    const selection = bomIssuePoLineOptions.find(row=>row.id===materialLinkPoLineKey);
    const selectedComponent = selection?.component;
    const bom = bomLines.find(row=>row.id===materialLinkBomLineId&&!row.deletedAt);
    const operation = materialLinkOperations.find(row=>row.id===materialLinkOperationId);
    const material = bom ? materials.find(row=>row.id===bom.materialId&&!row.deletedAt) : undefined;
    const quantity = Number(materialLinkQuantityPerPart);
    if (!selection || !selectedComponent || !bom || !material || bom.componentId!==selectedComponent.id || (bom.revision && bom.revision!==selectedComponent.revision) || (selection.line.partId && bom.partId && bom.partId!==selection.line.partId)) { onNotice("Select a BOM material belonging to the exact PO component, part (when part-scoped) and revision."); return; }
    if (!operation || operation.poId!==selection.po.id || operation.poLineId!==selection.line.id || operation.componentId!==selectedComponent.id) { onNotice("Select a process operation from this exact PO component line."); return; }
    if (!Number.isFinite(quantity)||quantity<=0) { onNotice("Material quantity per part must be a positive finite number."); return; }
    const duplicate = materialProcessLinks.find(link=>link.id!==materialLinkEditingId&&link.poLineId===selection.line.id&&link.bomLineId===bom.id&&link.operationId===operation.id&&link.flowType===materialLinkFlowType&&link.placement===materialLinkPlacement&&!link.deletedAt);
    if (duplicate) { onNotice("This BOM material is already linked to that process and position. Edit the existing link instead."); return; }
    const stamp=nowIso();
    update(current=>{
      const old=current.materialProcessLinks.find(link=>link.id===materialLinkEditingId);
      const record:MaterialProcessLinkRecord={
        id:materialLinkEditingId||makeId("material-process-link"), companyId:selection.po.companyId, poId:selection.po.id,
        poLineId:selection.line.id, componentId:selectedComponent.id, bomLineId:bom.id, materialId:material.id,
        operationId:operation.id, quantityPerPart:quantity, unit:material.unit, flowType:materialLinkFlowType,
        placement:materialLinkPlacement, notes:materialLinkNotes.trim(), createdAt:old?.createdAt||stamp, updatedAt:stamp
      };
      return {...current,materialProcessLinks:[...current.materialProcessLinks.filter(link=>link.id!==record.id),record]};
    });
    resetMaterialLink();
    onNotice("Material-to-process link saved against the exact PO line, BOM material and operation IDs. It remains separate from transport legs and stock transactions.");
  };
  const archiveMaterialLink = (link:MaterialProcessLinkRecord) => {
    if (!window.confirm("Archive this material-to-process link? The BOM, material master, stock transactions and process history remain unchanged.")) return;
    const stamp=nowIso();
    update(current=>({...current,materialProcessLinks:current.materialProcessLinks.map(item=>item.id===link.id?{...item,deletedAt:stamp,updatedAt:stamp}:item)}));
    onNotice("Material-to-process link archived. No BOM, stock or process-operation record was deleted.");
  };
  const bomIssueOperations = bomIssueSelection ? operations.filter(op => op.poId === bomIssueSelection.po.id && op.poLineId === bomIssueSelection.line.id && !op.deletedAt) : [];
  const bomIssuePreview = useMemo<BomIssuePreviewRow[]>(() => {
    if (!bomIssueSelection?.component) return [];
    const eligibleBom = bomLines.filter(row => row.componentId === bomIssueSelection.component!.id && (!row.revision || row.revision === bomIssueSelection.component!.revision) && (!bomIssueSelection.line.partId || !row.partId || row.partId === bomIssueSelection.line.partId));
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
  const visibleMaterials = useMemo(() => materials.filter(m => {
    const query = search.toLowerCase().trim();
    const textMatch = !query || (m.code + " " + m.name + " " + m.grade + " " + m.materialType + " " + m.shapeType + " " + m.specification + " " + m.notes + " " + Object.entries(m.dimensions||{}).map(([key,value])=>key+" "+value).join(" ")).toLowerCase().includes(query);
    const bomLinks = bomLines.filter(row => row.materialId === m.id);
    const partLinks = (data.componentParts || []).filter(part => part.materialId === m.id || part.materialIds?.includes(m.id));
    const costLinks = (data.materialCostEntries || []).filter(entry => entry.materialId === m.id && !entry.deletedAt);
    const stockLinks = inventoryTransactions.filter(row => row.itemType === "material" && row.itemId === m.id);
    const stockComponentIds = stockLinks.flatMap(row => orders.flatMap(po => po.lines.filter(line => line.id === row.poLineId).map(line => line.componentId)));
    const companyMatch = !directoryCompanyId || costLinks.some(entry => entry.companyId === directoryCompanyId) || stockLinks.some(row => row.companyId === directoryCompanyId) || partLinks.some(part => part.companyId === directoryCompanyId || components.find(component => component.id === part.componentId)?.companyId === directoryCompanyId) || bomLinks.some(row => orders.some(po => po.companyId === directoryCompanyId && po.lines.some(line => line.componentId === row.componentId)));
    const poMatch = !directoryPoId || costLinks.some(entry => entry.poId === directoryPoId) || stockLinks.some(row => row.poId === directoryPoId) || partLinks.some(part => orders.some(po => po.id === directoryPoId && po.lines.some(line => line.componentId === part.componentId && (!line.partId || line.partId === part.id)))) || bomLinks.some(row => orders.some(po => po.id === directoryPoId && po.lines.some(line => line.componentId === row.componentId && (!line.partId || !row.partId || line.partId === row.partId))));
    const componentMatch = !directoryComponentId || bomLinks.some(row => row.componentId === directoryComponentId) || costLinks.some(entry => entry.componentId === directoryComponentId) || partLinks.some(part => part.componentId === directoryComponentId) || stockComponentIds.includes(directoryComponentId);
    return textMatch && companyMatch && poMatch && componentMatch;
  }), [materials, search, bomLines, data.componentParts, data.materialCostEntries, orders, components, inventoryTransactions, directoryCompanyId, directoryPoId, directoryComponentId]);
  const visibleBom = useMemo(() => bomLines.filter(row => {
    const component = components.find(c => c.id === row.componentId);
    const part = row.partId ? (data.componentParts || []).find(item => item.id === row.partId) : undefined;
    const material = materials.find(m => m.id === row.materialId);
    const linkedOrders = orders.filter(po => po.lines.some(line => line.componentId === row.componentId && (!line.partId || !row.partId || line.partId === row.partId)));
    const query = (component?.partNumber + " " + component?.name + " " + part?.partNumber + " " + part?.name + " " + material?.code + " " + material?.name + " " + row.revision + " " + row.notes).toLowerCase();
    const textMatch = !search.trim() || query.includes(search.toLowerCase().trim());
    const companyMatch = !directoryCompanyId || component?.companyId === directoryCompanyId || linkedOrders.some(po => po.companyId === directoryCompanyId);
    const poMatch = !directoryPoId || linkedOrders.some(po => po.id === directoryPoId);
    const componentMatch = !directoryComponentId || row.componentId === directoryComponentId;
    return textMatch && companyMatch && poMatch && componentMatch;
  }), [bomLines, components, data.componentParts, materials, orders, search, directoryCompanyId, directoryPoId, directoryComponentId]);
  const visibleTransactions = useMemo(() => inventoryTransactions.filter(row => {
    const item = row.itemType === "material" ? materials.find(m => m.id === row.itemId) : components.find(c => c.id === row.itemId);
    const po=orders.find(order=>order.id===row.poId);
    const poLine=po?.lines.find(line=>line.id===row.poLineId);
    const materialBomLinks=row.itemType==="material"?bomLines.filter(bom=>bom.materialId===row.itemId):[];
    const materialPartLinks=row.itemType==="material"?(data.componentParts||[]).filter(part=>part.materialId===row.itemId||part.materialIds?.includes(row.itemId)):[];
    const linkedComponentIds=new Set<string>(row.itemType==="component"?[row.itemId]:[
      ...materialBomLinks.map(bom=>bom.componentId),
      ...materialPartLinks.map(part=>part.componentId)
    ]);
    const linkedPOs=orders.filter(order=>order.lines.some(line=>linkedComponentIds.has(line.componentId)&&(!line.partId||materialBomLinks.some(bom=>!bom.partId||bom.partId===line.partId)||materialPartLinks.some(part=>part.id===line.partId))));
    const companyMatch=!directoryCompanyId||row.companyId===directoryCompanyId||po?.companyId===directoryCompanyId||linkedPOs.some(order=>order.companyId===directoryCompanyId)||[...linkedComponentIds].some(id=>components.find(component=>component.id===id)?.companyId===directoryCompanyId);
    const poMatch=!directoryPoId||row.poId===directoryPoId||(!row.poId&&linkedPOs.some(order=>order.id===directoryPoId));
    const componentMatch=!directoryComponentId||linkedComponentIds.has(directoryComponentId)||poLine?.componentId===directoryComponentId;
    const query=(item?.name+" "+("code" in (item||{})?(item as MaterialRecord).code:(item as any)?.partNumber)+" "+row.transactionType+" "+row.reference+" "+row.notes+" "+row.occurredAt+" "+row.quantity).toLowerCase();
    return companyMatch&&poMatch&&componentMatch&&(!search.trim()||query.includes(search.toLowerCase().trim()));
  }).slice().sort((a,b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt)), [inventoryTransactions, materials, components, orders, bomLines, data.componentParts, search, directoryCompanyId, directoryPoId, directoryComponentId]);
  const linkedMaterialContexts = (materialId: string) => {
    const contexts: string[] = [];
    for (const entry of (data.materialCostEntries || []).filter(row => row.materialId === materialId && !row.deletedAt)) {
      const po = orders.find(row => row.id === entry.poId);
      const company = companies.find(row => row.id === (entry.companyId || po?.companyId));
      const component = components.find(row => row.id === entry.componentId);
      contexts.push([company?.name, po?.number, component ? component.partNumber + " · " + component.name : undefined].filter(Boolean).join(" · "));
    }
    for (const row of inventoryTransactions.filter(item => item.itemType === "material" && item.itemId === materialId && !item.deletedAt)) {
      const po = orders.find(item => item.id === row.poId);
      const company = companies.find(item => item.id === (row.companyId || po?.companyId));
      const line = po?.lines.find(item => item.id === row.poLineId);
      const component = components.find(item => item.id === (line?.componentId || ""));
      contexts.push([company?.name, po?.number, component ? component.partNumber + " · " + component.name : undefined].filter(Boolean).join(" · "));
    }
    for (const part of (data.componentParts || []).filter(row => row.materialId === materialId || row.materialIds?.includes(materialId))) {
      const component = components.find(row => row.id === part.componentId);
      const company = companies.find(row => row.id === (part.companyId || component?.companyId));
      contexts.push([company?.name, component ? component.partNumber + " · " + component.name : undefined, (part.partNumber ? part.partNumber + " · " : "") + part.name].filter(Boolean).join(" · "));
    }
    for (const bom of bomLines.filter(row => row.materialId === materialId)) {
      const part = bom.partId ? (data.componentParts || []).find(item => item.id === bom.partId) : undefined;
      for (const po of orders.filter(order => order.lines.some(line => line.componentId === bom.componentId && (!line.partId || !bom.partId || line.partId === bom.partId)))) {
        const company = companies.find(row => row.id === po.companyId);
        const component = components.find(row => row.id === bom.componentId);
        contexts.push([company?.name, po.number, component ? component.partNumber + " · " + component.name : undefined, part ? (part.partNumber ? part.partNumber + " · " : "") + part.name : undefined].filter(Boolean).join(" · "));
      }
    }
    return [...new Set(contexts.filter(Boolean))];
  };
  const bomCost = (componentId: string) => bomLines.filter(row => row.componentId === componentId).reduce((total, row) => {
    const material = materials.find(m => m.id === row.materialId);
    const quantity = row.quantityPerPart * (1 + row.scrapPercent / 100);
    const rateQuantity = material?.priceUnit === "lb" && material.unit === "kg" ? quantity * 2.2046226218 : quantity;
    return total + rateQuantity * (material?.ratePerUnit || 0);
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
    if (!materialDraft.code.trim() || !materialDraft.name.trim() || !materialDraft.materialType?.trim() || !materialDraft.grade.trim() || !materialDraft.unit.trim()) { onNotice("Material code, material type, name, grade and unit are required."); return; }
    if (!(Number(materialDraft.densityKgM3)>0)) { onNotice("Enter a typical density in kg/m³ or select a known grade to fill it automatically."); return; }
    if (materialDraft.densityKgM3 && (!Number.isFinite(Number(materialDraft.densityKgM3)) || Number(materialDraft.densityKgM3) <= 0)) { onNotice("Density must be a positive kg/m³ value."); return; }
    if (!Number.isFinite(Number(materialDraft.ratePerUnit)) || Number(materialDraft.ratePerUnit) < 0) { onNotice("Material rate must be a finite non-negative number."); return; }
    if (materialDraft.preferredVendorId && !vendors.some(vendor => vendor.id === materialDraft.preferredVendorId)) { onNotice("Preferred vendor is missing or archived. Choose an active Vendor Directory record."); return; }
    const duplicate = materials.find(m => m.id !== materialEditingId && m.code.trim().toLowerCase() === materialDraft.code.trim().toLowerCase());
    const duplicateGrade = materials.find(m => m.id !== materialEditingId && m.grade.trim().toLowerCase() === materialDraft.grade.trim().toLowerCase() && (m.materialType||m.name).trim().toLowerCase() === (materialDraft.materialType||materialDraft.name).trim().toLowerCase());
    if (duplicateGrade) { onNotice("This material type and grade already exist. Select that saved grade or edit its existing directory record; different stock shapes belong in separate procurement allocations."); return; }
    if (duplicate) { onNotice("That material code already exists. Select or edit the existing Material Directory record to avoid duplicate IDs."); return; }
    const stamp = nowIso(); const id = materialEditingId || makeId("material");
    update(current => {
      const old = current.materials.find(m => m.id === id);
      return { ...current, materials: [...current.materials.filter(m => m.id !== id), { ...materialDraft, code: materialDraft.code.trim(), name: materialDraft.name.trim(), densityKgM3: materialDraft.densityUnit === "g/cm3" ? Number(materialDraft.densityKgM3) * 1000 : Number(materialDraft.densityKgM3), densityUnit: "kg/m3" as const, id, createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] };
    });
    resetMaterial(); onNotice("Material saved permanently in the shared Material Directory. Similar grade searches will find this record; BOM links and stock ledger retain its stable ID.");
  };
  const saveBom = () => {
    if (!bomDraft.componentId || !components.some(component => component.id === bomDraft.componentId) || !bomDraft.materialId || !materials.some(material => material.id === bomDraft.materialId)) { onNotice("Select active Component Master and Material Master records for this BOM line."); return; }
    if (!Number.isFinite(Number(bomDraft.quantityPerPart)) || bomDraft.quantityPerPart <= 0) { onNotice("BOM quantity per part must be a finite positive number."); return; }
    if (!Number.isFinite(Number(bomDraft.scrapPercent)) || bomDraft.scrapPercent < 0 || bomDraft.scrapPercent > 100) { onNotice("BOM scrap allowance must be between 0 and 100 percent."); return; }
    const duplicate = bomLines.find(row => row.id !== bomEditingId && row.componentId === bomDraft.componentId && (row.partId || "") === (bomDraft.partId || "") && row.materialId === bomDraft.materialId && row.revision === bomDraft.revision);
    if (duplicate) { onNotice("This component/part/material/revision BOM line already exists; the same material may be allocated independently to another part."); return; }
    const stamp = nowIso(); const id = bomEditingId || makeId("bom");
    update(current => {
      const old = current.bomLines.find(row => row.id === id);
      const material = current.materials.find(row => row.id === bomDraft.materialId);
      return { ...current, bomLines: [...current.bomLines.filter(row => row.id !== id), { ...bomDraft, unit: bomDraft.unit || material?.unit || "kg", id, createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined }] };
    });
    resetBom(); onNotice("BOM line saved against component ID and material ID. Planned material requirement/cost updates from the linked master records.");
  };
  const archiveMaterial = (row: MaterialRecord) => {
    if (!window.confirm("Delete this material from active directory searches? Existing BOM, procurement and stock history will be retained for traceability.")) return;
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
      const eligibleBom = current.bomLines.filter(row => row.componentId === component.id && !row.deletedAt && (!row.revision || row.revision === component.revision) && (!line.partId || !row.partId || row.partId === line.partId));
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
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> MATERIAL DIRECTORY / BOM / STOCK LEDGER</div><h1>Material Directory<span>.</span></h1><p>Permanent searchable catalogue of material families, grades, typical density, stock shapes, dimensions, supplier rates and component BOM links. Stock balances remain transaction-based.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("purchasing",{companyId:directoryCompanyId||undefined,poId:directoryPoId||undefined,poLineId:materialLinkSelection?.line.id,componentId:directoryComponentId||undefined})}><FileText size={15}/> Purchase orders</button><button className="button-quiet" onClick={() => onSelectModule("process-map",{companyId:directoryCompanyId||undefined,poId:directoryPoId||undefined,componentId:directoryComponentId||undefined})}><Activity size={15}/> Process Map</button><button className="button-primary" onClick={() => { setTab("stock"); setItemId(""); }}><Plus size={15}/> Post stock movement</button></div></div>
    <div className="costing-tabs">
      <button className={tab==="materials"?"costing-tab-active":""} onClick={()=>{setTab("materials");setSearch("");}}><Package size={15}/> Material catalogue ({materials.length})</button>
      <button className={tab==="bom"?"costing-tab-active":""} onClick={()=>{setTab("bom");setSearch("");}}><Boxes size={15}/> BOM lines ({bomLines.length})</button>
      <button className={tab==="stock"?"costing-tab-active":""} onClick={()=>{setTab("stock");setSearch("");}}><Warehouse size={15}/> Stock ledger ({inventoryTransactions.length})</button>
      <button className={tab==="process-links"?"costing-tab-active":""} onClick={()=>{setTab("process-links");setSearch("");}}><Activity size={15}/> Material → process ({materialProcessLinks.length})</button>
    </div>
    <div className="module-action-bar"><label className="module-record-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tab==="materials"?"Search material, grade, type, shape, dimension…":tab==="bom"?"Search component, part, material, revision…":tab==="process-links"?"Search material, BOM, process or link…":"Search item, movement, reference…"} /></label><span className="module-number">{tab==="materials"?visibleMaterials.length+" / "+materials.length+" MATERIALS":tab==="bom"?visibleBom.length+" / "+bomLines.length+" BOM LINES":tab==="process-links"?visibleMaterialProcessLinks.length+" / "+materialProcessLinks.length+" PROCESS LINKS":visibleTransactions.length+" / "+inventoryTransactions.length+" STOCK MOVEMENTS"}</span></div>
     <div className="material-directory-filter-bar" aria-label="Filter material directory by linked records">
       <label>Company<select value={directoryCompanyId} onChange={e=>{setDirectoryCompanyId(e.target.value);setDirectoryPoId("");}}><option value="">All companies</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
       <label>Purchase order<select value={directoryPoId} onChange={e=>{setDirectoryPoId(e.target.value);setDirectoryComponentId("");}}><option value="">All purchase orders</option>{directoryPoOptions.map(po=><option key={po.id} value={po.id}>{po.number}</option>)}</select></label>
       <label>Component<select value={directoryComponentId} onChange={e=>setDirectoryComponentId(e.target.value)}><option value="">All components</option>{directoryComponentOptions.map(component=><option key={component.id} value={component.id}>{component.partNumber} · {component.name}</option>)}</select></label>
       {(directoryCompanyId||directoryPoId||directoryComponentId)&&<button type="button" className="button-quiet compact-button" onClick={()=>{setDirectoryCompanyId("");setDirectoryPoId("");setDirectoryComponentId("");}}>Clear filters</button>}
     </div>}
    {tab==="materials" && <section className="surface-panel material-directory-route-allocation">
      <div className="panel-heading">
        <div><div className="eyebrow">MATERIAL DIRECTORY → PROCESS MAP</div><h3>PO-linked material procurement</h3>
          <p>Select Company, Purchase Order and Component above, then add each part, material grade, stock shape, dimensions, quantity, supplier, delivery timing and inbound transport. Every saved allocation is written to the shared Process Map route automatically. Add separate allocations for copper, brass, mild steel or any other material variety under the same component.</p>
        </div>
        <button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("process-map",{companyId:directoryCompanyId,poId:directoryPoId,componentId:directoryComponentId})}><Activity size={14}/> Open Process Map</button>
      </div>
      {directoryCompanyId && directoryPoId && directoryComponentId
        ? <PartMaterialCostingPanel
            key={directoryCompanyId+"-"+directoryPoId+"-"+directoryComponentId}
            scope="process-map"
            companyId={directoryCompanyId}
            poId={directoryPoId}
            componentId={directoryComponentId}
            componentName={components.find(component=>component.id===directoryComponentId)?.name||""}
            componentNumber={components.find(component=>component.id===directoryComponentId)?.partNumber||""}
            requirePoLine
            startExpanded
            defaultNewPart
            processOptions={operations.filter(operation=>operation.poId===directoryPoId&&operation.componentId===directoryComponentId&&!operation.deletedAt)}
            onNotice={onNotice}
          />
        : <div className="module-empty-state"><Package size={22}/><strong>Select the manufacturing job to allocate material</strong><p>Choose one Company, its Purchase Order and the Component using the three filters above. The material allocation form will then open here. You can add more than one part and more than one material / size / grade without replacing earlier entries.</p></div>}
    </section>}
    {tab==="materials" && <>
      <div className="workspace-title-actions"><button className="button-primary" onClick={()=>{setMaterialDraft(emptyMaterial());setMaterialEditingId("");setMaterialFormOpen(true);}}><Plus size={14}/> Add material</button><button className="button-quiet" onClick={()=>onSelectModule("vendors",{companyId:directoryCompanyId||undefined,poId:directoryPoId||undefined,componentId:directoryComponentId||undefined})}><Users size={14}/> Vendor master</button></div>
      {materialFormOpen && <section className="surface-panel module-record-form-panel"><div className="panel-heading"><div><h3>{materialEditingId?"Edit material record":"Add material to directory"}</h3><p>Grade suggestions fill the typical reference density automatically. Your saved custom grades, types, shapes and rates remain in the permanent material catalogue.</p></div><button className="icon-control" onClick={resetMaterial} aria-label="Close material form"><X size={15}/></button></div>
        <div className="module-record-form">
          <label>Material code *<input value={materialDraft.code} onChange={e=>setMaterialDraft({...materialDraft,code:e.target.value})} placeholder="e.g. EN8-ROUND-80"/></label>
          <label>Material name *<input value={materialDraft.name} onChange={e=>setMaterialDraft({...materialDraft,name:e.target.value})} placeholder="Actual stock/material name"/></label>
          <label>Material family / type<input list="aximach-material-types" value={materialDraft.materialType||""} onChange={e=>setMaterialDraft({...materialDraft,materialType:e.target.value})} placeholder="Type or search material family…"/><datalist id="aximach-material-types">{[...new Set([...materials.map(item=>item.materialType||""),"Steel","Stainless steel","Aluminium","Copper","Brass","Bronze","Cast iron","Titanium","Nickel alloy","Plastic","Ceramic"])].filter(Boolean).map(type=><option key={type} value={type}/>)}</datalist></label>
          <label>Grade / specification<input list="aximach-material-grade-catalogue" value={materialDraft.grade} onChange={e=>{const grade=e.target.value;const q=grade.trim().toLowerCase();const saved=q.length>=2?materials.find(row=>row.grade.trim().toLowerCase()===q):undefined;const common=q.length>=2?STANDARD_MATERIAL_GRADES.find(([,known])=>known.toLowerCase()===q):undefined;setMaterialDraft({...materialDraft,grade,code:materialDraft.code||(saved?.code||common?.[1].toUpperCase().replace(/[^A-Z0-9]+/g,"-")||""),...(saved?{name:saved.name,materialType:saved.materialType||saved.name,densityKgM3:saved.densityUnit==="g/cm3"?(Number(saved.densityKgM3)||0)*1000:(saved.densityKgM3||0),densityUnit:"kg/m3" as const,ratePerUnit:saved.ratePerUnit||0,priceUnit:saved.priceUnit||"kg",preferredVendorId:saved.preferredVendorId||"",shapeType:saved.shapeType||materialDraft.shapeType,dimensions:saved.dimensions||{},dimensionUnit:saved.dimensionUnit||"mm"}:common?{name:common[0],materialType:common[3],densityKgM3:common[2],densityUnit:"kg/m3" as const}: {})});}} placeholder="Type to search saved / common grades: EN8, SS304, 6061…"/><datalist id="aximach-material-grade-catalogue">{STANDARD_MATERIAL_GRADES.map(([name,grade])=><option key={grade} value={grade}>{name}</option>)}{materials.map(item=><option key={item.id} value={item.grade}>{item.name} · {item.materialType}</option>)}</datalist></label>
          <label>Stock shape<select value={materialDraft.shapeType||"Round bar"} onChange={e=>setMaterialDraft({...materialDraft,shapeType:e.target.value})}>{MATERIAL_SHAPES.map(shape=><option key={shape}>{shape}</option>)}</select></label>
          <label>Dimension unit<select value={materialDraft.dimensionUnit||"mm"} onChange={e=>setMaterialDraft({...materialDraft,dimensionUnit:e.target.value as "mm"|"inch"})}><option value="mm">Millimetres (mm)</option><option value="inch">Inches (in)</option></select></label>
          {directoryDimensionFields.map(dimension=><label key={dimension.key}>{dimension.label.replace(/\(mm\)/,"("+(materialDraft.dimensionUnit||"mm")+")")}<input type="number" min="0" step="any" value={materialDraft.dimensions?.[dimension.key]??""} onChange={e=>setMaterialDraft({...materialDraft,dimensions:{...(materialDraft.dimensions||{}),[dimension.key]:Math.max(0,Number(e.target.value)||0)}})} placeholder="Optional"/></label>)}
          <label>Unit *<select value={materialDraft.unit} onChange={e=>setMaterialDraft({...materialDraft,unit:e.target.value})}><option>kg</option><option>Nos</option><option>mm</option><option>m</option><option>litre</option><option>sheet</option><option>bar</option><option>set</option></select></label>
          <label>Density (kg/m³)<input type="number" min="0" step="any" value={materialDraft.densityKgM3||""} onChange={e=>setMaterialDraft({...materialDraft,densityKgM3:Math.max(0,Number(e.target.value)||0),densityUnit:"kg/m3"})} placeholder="Auto-filled from grade"/></label>
          
          <label>Rate per unit (₹)<input type="number" min="0" step="0.01" value={materialDraft.ratePerUnit} onChange={e=>setMaterialDraft({...materialDraft,ratePerUnit:Math.max(0,Number(e.target.value)||0)})}/></label>
          <label>Rate unit<select value={materialDraft.priceUnit||"kg"} onChange={e=>setMaterialDraft({...materialDraft,priceUnit:e.target.value as "kg"|"lb"})}><option value="kg">₹ / kg</option><option value="lb">₹ / lb</option></select></label>
          <SearchablePicker id="material-preferred-vendor" label="Preferred vendor" value={materialDraft.preferredVendorId} placeholder="Type supplier name / phone…" options={vendors.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")}))} onChange={preferredVendorId=>setMaterialDraft({...materialDraft,preferredVendorId})}/>
          <label className="module-form-wide">Specification / notes<input value={materialDraft.specification} onChange={e=>setMaterialDraft({...materialDraft,specification:e.target.value})} placeholder="Size, standard, certificate or inspection notes"/></label>
          <label className="module-form-wide">Notes<input value={materialDraft.notes} onChange={e=>setMaterialDraft({...materialDraft,notes:e.target.value})} placeholder="Optional material notes"/></label>
          <div className="module-form-actions"><button className="button-primary" onClick={saveMaterial}><Check size={14}/> Save material</button><button className="button-quiet" onClick={resetMaterial}>Cancel</button></div>
        </div>
      </section>}
      {visibleMaterials.length ? <div className="module-workbench-grid"><section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Material stock and value</h3><p>Balances are derived from the transaction ledger; opening stock must be posted as an opening movement.</p></div></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Material</th><th>Grade</th><th>Stock shape / size</th><th>Density</th><th>Unit</th><th>Posted stock</th><th>Rate / unit</th><th>Stock value (entered rate)</th><th>BOM references</th><th>Company · PO · Component links</th><th>Vendor</th><th>Actions</th></tr></thead><tbody>{visibleMaterials.map(m=>{const balance=stockBalance("material",m.id);const dimensionText=Object.entries(m.dimensions||{}).filter(([,value])=>Number(value)>0).map(([key,value])=>key.replace(/[A-Z]/g," $&").replace(/^./,c=>c.toUpperCase())+" "+value+" "+(m.dimensionUnit||"mm")).join(" · ");return <tr key={m.id}><td><strong>{m.code} · {m.name}</strong><small>{m.specification||"No specification"}</small></td><td>{m.grade||"—"}</td><td><strong>{m.shapeType||"Shape not specified"}</strong><small>{dimensionText||"Dimensions not specified"}</small></td><td>{m.densityKgM3?Number(m.densityUnit==="g/cm3"?m.densityKgM3*1000:m.densityKgM3).toLocaleString("en-IN")+" kg/m³":"Not set"}</td><td>{m.unit}</td><td>{balance.toLocaleString("en-IN")}</td><td>{money(m.ratePerUnit)} / {m.priceUnit||m.unit}</td><td>{money(balance*m.ratePerUnit*(m.priceUnit==="lb"&&m.unit==="kg"?2.2046226218:1))}</td><td>{bomLines.filter(b=>b.materialId===m.id&&!b.deletedAt).length}</td><td><div className="material-directory-context-list">{linkedMaterialContexts(m.id).length?linkedMaterialContexts(m.id).slice(0,3).map((label,index)=><small key={index}>{label}</small>):<small>Not yet allocated to a PO</small>}{linkedMaterialContexts(m.id).length>3&&<small>+{linkedMaterialContexts(m.id).length-3} more linked jobs</small>}</div></td><td>{vendors.find(v=>v.id===m.preferredVendorId)?.company||"Not linked"}</td><td><button className="button-quiet compact-button" onClick={()=>editMaterial(m)}>Edit</button> <button className="button-quiet compact-button" onClick={()=>{setTab("stock");setItemType("material");setItemId(m.id);}}>Post movement</button> <button className="button-quiet compact-button" onClick={()=>archiveMaterial(m)}><Trash2 size={12}/> Delete</button></td></tr>})}</tbody></table></div></section>

        <aside className="surface-panel module-connection-panel"><div className="panel-heading"><div><h3>Inventory controls</h3><p>Actual physical movements only.</p></div><Warehouse size={19}/></div><button className="related-row" onClick={()=>{setTab("stock");setTransactionType("Opening balance");setItemType("material");setDirection("in");}}><Plus size={14}/><span><strong>Opening balance</strong><small>Post a dated opening quantity</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={()=>{setTab("stock");setTransactionType("Receipt");setItemType("material");setDirection("in");}}><Truck size={14}/><span><strong>Supplier receipt</strong><small>Link vendor and source reference</small></span><ArrowRight size={14}/></button><button className="related-row" onClick={()=>{setTab("bom");setBomFormOpen(true);}}><Boxes size={14}/><span><strong>Build a component BOM</strong><small>Quantity per part × material rate</small></span><ArrowRight size={14}/></button><div className="module-safety-note"><ShieldCheck size={14}/><span>Stock changes are append-only transactions. No stock changes when you open this workspace.</span></div></aside></div> : <div className="module-empty-state"><Package size={26}/><h3>No material masters added</h3><p>Create the actual material grades and rates used by your shop, then post opening stock or receipt movements to establish balances.</p><button className="button-primary" onClick={()=>{setMaterialDraft(emptyMaterial());setMaterialEditingId("");setMaterialFormOpen(true);}}><Plus size={14}/> Add first material</button></div>}
    </>}
    {tab==="bom" && <>
      <div className="workspace-title-actions"><button className="button-primary" onClick={()=>{setBomDraft(emptyBom());setBomEditingId("");setBomFormOpen(true);}}><Plus size={14}/> Add BOM line</button><button className="button-quiet" onClick={()=>onSelectModule("components",{companyId:directoryCompanyId||undefined,poId:directoryPoId||undefined,componentId:directoryComponentId||undefined})}><Package size={14}/> Component master</button></div>
      {bomFormOpen&&<section className="surface-panel module-record-form-panel"><div className="panel-heading"><div><h3>{bomEditingId?"Edit BOM line":"New component BOM line"}</h3><p>Each BOM row links a real component revision to a material record by ID.</p></div><button className="icon-control" onClick={resetBom} aria-label="Close BOM form"><X size={15}/></button></div><div className="module-record-form">
        <SearchablePicker id="bom-component" label="Component *" value={bomDraft.componentId} placeholder="Type component number / name…" options={components.map(c=>({id:c.id,label:c.partNumber+" · "+c.name+" · Rev "+(c.revision||"—")}))} onChange={componentId=>setBomDraft({...bomDraft,componentId,partId:""})}/>
        <SearchablePicker id="bom-part" label="Part (optional — blank applies to the whole component)" value={bomDraft.partId||""} placeholder="Search part under the selected component…" options={(data.componentParts||[]).filter(part=>part.componentId===bomDraft.componentId&&!part.deletedAt).map(part=>({id:part.id,label:(part.partNumber?part.partNumber+" · ":"")+part.name}))} onChange={partId=>setBomDraft({...bomDraft,partId:partId||undefined})}/>
        <SearchablePicker id="bom-material" label="Material *" value={bomDraft.materialId} placeholder="Type material code / grade…" options={materials.map(m=>({id:m.id,label:m.code+" · "+m.name+" · "+m.grade}))} onChange={materialId=>setBomDraft({...bomDraft,materialId})}/>
        <label>Drawing / BOM revision<input value={bomDraft.revision} onChange={e=>setBomDraft({...bomDraft,revision:e.target.value})} placeholder="Revision identifier"/></label>
        <label>Quantity per part / component *<input type="number" min="0.000001" step="0.000001" value={bomDraft.quantityPerPart||""} onChange={e=>setBomDraft({...bomDraft,quantityPerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
        <label>Scrap allowance (%)<input type="number" min="0" max="100" step="0.1" value={bomDraft.scrapPercent} onChange={e=>setBomDraft({...bomDraft,scrapPercent:Math.max(0,Math.min(100,Number(e.target.value)||0))})}/></label>
        <label className="module-form-wide">Notes<input value={bomDraft.notes} onChange={e=>setBomDraft({...bomDraft,notes:e.target.value})} placeholder="Material standard, cutting allowance, special requirements"/></label>
        <div className="module-form-actions"><button className="button-primary" onClick={saveBom}><Check size={14}/> Save BOM line</button><button className="button-quiet" onClick={resetBom}>Cancel</button></div>
        {!components.length&&<div className="module-safety-note">Add actual components first. BOM lines use component master IDs; they do not create example parts.</div>}
        {!materials.length&&<div className="module-safety-note">Add actual material masters first. BOM lines use material master IDs.</div>}
      </div></section>}
      {visibleBom.length?<section className="surface-panel module-records-panel"><div className="panel-heading"><div><h3>Component BOM and estimated material requirement</h3><p>Estimate uses the material rate you entered; no external market price is fetched.</p></div></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component</th><th>Part</th><th>Revision</th><th>Material</th><th>Qty / part</th><th>Scrap %</th><th>Effective qty / part</th><th>Material rate</th><th>Estimated cost / part</th><th>Posted stock</th><th>Actions</th></tr></thead><tbody>{visibleBom.map(row=>{const component=components.find(c=>c.id===row.componentId);const material=materials.find(m=>m.id===row.materialId);const qty=row.quantityPerPart*(1+row.scrapPercent/100);return <tr key={row.id}><td>{component?.partNumber||"Archived component"} · {component?.name||""}</td><td>{row.partId?(()=>{const part=(data.componentParts||[]).find(item=>item.id===row.partId);return part?((part.partNumber?part.partNumber+" · ":"")+part.name):"Archived part";})():"Whole component"}</td><td>{row.revision||"—"}</td><td>{material?.code||"Archived material"} · {material?.name||""} ({material?.grade||"—"})</td><td>{row.quantityPerPart.toLocaleString("en-IN")}</td><td>{row.scrapPercent}%</td><td>{qty.toLocaleString("en-IN")}</td><td>{money(material?.ratePerUnit||0)}/{material?.unit||"unit"}</td><td>{money(qty*(material?.ratePerUnit||0)*(material?.priceUnit==="lb"&&material.unit==="kg"?2.2046226218:1))}</td><td>{material?stockBalance("material",material.id).toLocaleString("en-IN")+" "+material.unit:"—"}</td><td><button className="button-quiet compact-button" onClick={()=>editBom(row)}>Edit</button> <button className="button-quiet compact-button" onClick={()=>archiveBom(row)}><Trash2 size={12}/> Archive</button></td></tr>})}</tbody></table></div></section>:<div className="module-empty-state"><Boxes size={26}/><h3>No BOM lines added</h3><p>Link the actual component and material master records to calculate an estimated raw-material requirement and rate per accepted part.</p><button className="button-primary" disabled={!components.length||!materials.length} onClick={()=>{setBomDraft(emptyBom());setBomEditingId("");setBomFormOpen(true);}}><Plus size={14}/> Add BOM line</button></div>}
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
      {tab==="process-links" && <>
      <section className="surface-panel">
        <div className="panel-heading"><div><h3>{materialLinkEditingId?"Edit material-to-process link":"Connect a BOM material to a process"}</h3><p>Each material flow is an independent record. One component can have many materials linked to different processes, and one process can receive several materials.</p></div></div>
        <div className="module-record-form">
          <SearchablePicker id="material-process-po-line" label="PO component line *" value={materialLinkPoLineKey} placeholder="Search company, PO and component…" options={bomIssuePoLineOptions.map(row=>({id:row.id,label:row.label}))} onChange={value=>{setMaterialLinkPoLineKey(value);setMaterialLinkBomLineId("");setMaterialLinkOperationId("");}}/>
          <SearchablePicker id="material-process-bom-line" label="BOM material *" value={materialLinkBomLineId} placeholder="Choose a material in this component BOM…" options={materialLinkBomOptions.map(row=>{const material=materials.find(m=>m.id===row.materialId);const part=row.partId?(data.componentParts||[]).find(item=>item.id===row.partId):undefined;return {id:row.id,label:(part?(part.partNumber?part.partNumber+" · ":"")+part.name+" · ":"Whole component · ")+(material?.code||"Material")+" · "+(material?.name||"Missing material")+" · "+(material?.grade||"—")};})} onChange={value=>{setMaterialLinkBomLineId(value);const row=materialLinkBomOptions.find(item=>item.id===value);const material=row?materials.find(item=>item.id===row.materialId):undefined;setMaterialLinkQuantityPerPart(row?String(row.quantityPerPart*(1+row.scrapPercent/100)):"");if(material)setMaterialLinkNotes(material.grade||"");}}/>
          <SearchablePicker id="material-process-operation" label="Process operation *" value={materialLinkOperationId} placeholder="Choose the exact process step…" options={materialLinkOperations.map(op=>({id:op.id,label:"OP-"+String(op.sequence).padStart(3,"0")+" · "+op.name+" · "+op.branch}))} onChange={setMaterialLinkOperationId}/>
          <label>Material quantity per part *<input type="number" min="0.000001" step="0.000001" value={materialLinkQuantityPerPart} onChange={event=>setMaterialLinkQuantityPerPart(event.target.value)} placeholder="Allocated quantity per part"/></label>
          <SearchablePicker id="material-process-flow-type" label="Material flow type *" value={materialLinkFlowType} options={["Material input","Consumable","WIP transfer","Output"].map(value=>({id:value,label:value}))} onChange={value=>setMaterialLinkFlowType(value as MaterialProcessLinkRecord["flowType"])}/>
          <SearchablePicker id="material-process-placement" label="Connect material" value={materialLinkPlacement} options={[{id:"before",label:"Before the process"},{id:"after",label:"After the process"}]} onChange={value=>setMaterialLinkPlacement(value as "before"|"after")}/>
          {selectedMaterialLinkMaterial&&materialLinkSelection&&<div className="module-safety-note module-form-wide"><Boxes size={14}/><span>{selectedMaterialLinkMaterial.code} · {selectedMaterialLinkMaterial.grade||"Grade not set"} · {materialLinkQuantityPerPart||"0"} {selectedMaterialLinkMaterial.unit}/part × {materialLinkSelection.line.quantity.toLocaleString("en-IN")} pcs = <strong>{(Number(materialLinkQuantityPerPart)||0)*materialLinkSelection.line.quantity} {selectedMaterialLinkMaterial.unit}</strong> planned on this PO line. This mapping does not post stock or issue material.</span></div>}
          <label className="module-form-wide">Material flow notes<input value={materialLinkNotes} onChange={event=>setMaterialLinkNotes(event.target.value)} placeholder="Input point, feed location, batch/lot or process note…"/></label>
          <div className="module-form-actions"><button className="button-primary" onClick={saveMaterialLink}><Check size={14}/> {materialLinkEditingId?"Save material link":"Add material link"}</button><button className="button-quiet" onClick={resetMaterialLink}>Clear form</button></div>
        </div>
      </section>
      <section className="surface-panel module-records-panel">
        <div className="panel-heading"><div><h3>Independent material-to-process links ({visibleMaterialProcessLinks.length})</h3><p>Linked by company, PO, PO line, component, BOM material and exact operation ID. These lines do not reuse or overwrite transport-leg records.</p></div></div>
        {visibleMaterialProcessLinks.length?<div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Material / BOM line</th><th>PO / component</th><th>Process operation</th><th>Flow / position</th><th>Qty / part</th><th>PO total</th><th>Actions</th></tr></thead><tbody>{visibleMaterialProcessLinks.map(link=>{const material=materials.find(m=>m.id===link.materialId);const operation=operations.find(op=>op.id===link.operationId);const po=orders.find(row=>row.id===link.poId);const line=po?.lines.find(row=>row.id===link.poLineId);const bom=(data.bomLines||[]).find(row=>row.id===link.bomLineId);const part=bom?.partId?(data.componentParts||[]).find(row=>row.id===bom.partId):line?.partId?(data.componentParts||[]).find(row=>row.id===line.partId):undefined;return <tr key={link.id}><td><strong>{material?.code||"Material missing"} · {material?.name||""}</strong><small>{material?.grade||"—"} · BOM {link.bomLineId}{part?" · Part "+(part.partNumber?part.partNumber+" ":"")+part.name:" · Whole component"}</small></td><td>{po?.number||"PO missing"}<small>{components.find(c=>c.id===link.componentId)?.partNumber||"Component missing"} · {part?((part.partNumber?part.partNumber+" · ":"")+part.name):"Whole component"} · {line?.quantity||0} pcs</small></td><td><strong>OP-{String(operation?.sequence||0).padStart(3,"0")} · {operation?.name||"Operation missing"}</strong><small>{operation?.branch||"Branch unavailable"} · {link.operationId}</small></td><td>{link.flowType}<small>{link.placement==="before"?"Before":"After"} process</small></td><td>{link.quantityPerPart.toLocaleString("en-IN",{maximumFractionDigits:4})} {link.unit}</td><td><strong>{(link.quantityPerPart*(line?.quantity||0)).toLocaleString("en-IN",{maximumFractionDigits:4})} {link.unit}</strong></td><td><button type="button" className="button-quiet compact-button" onClick={()=>editMaterialLink(link)}>Edit</button> <button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("process-map",{companyId:link.companyId,poId:link.poId,poLineId:link.poLineId,componentId:link.componentId,operationId:link.operationId})}>Open route</button> <button type="button" className="button-quiet compact-button" onClick={()=>archiveMaterialLink(link)}><Trash2 size={12}/> Archive</button></td></tr>;})}</tbody></table></div>:<div className="module-empty-state"><Boxes size={25}/><h3>{materialLinkPoLineKey?"No material process links for this PO line":"No material process links yet"}</h3><p>Choose a PO component line, one of its BOM materials and the exact operation that consumes, receives or produces the material. This creates only the mapping; stock changes require a separate ledger transaction.</p></div>}
      </section>
    </>}
</section>;
}
