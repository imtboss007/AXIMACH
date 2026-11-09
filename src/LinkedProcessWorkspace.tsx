import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUp, Boxes, CalendarClock, Check, CircleDollarSign, ClipboardCheck, FileText, FileDown, Printer, GitBranch, Package, Plus, Search, ShieldAlert, ShieldCheck, Truck, Users, Workflow, Wrench, X, Trash2 } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ComponentTransportLegRecord, type LifecycleStatus, type OperationRecord, type ProcessDefinitionRecord, type PurchaseOrderLine } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { ComponentIcon, ProcessIcon } from "./IconStudio";
import ProcessUniverse3D from "./ProcessUniverse3D";
import PartMaterialCostingPanel from "./PartMaterialCostingPanel";

type LinkedNavigationContext = { companyId?: string; poId?: string; poLineId?: string; componentId?: string; operationId?: string; vendorId?: string; routeId?: string };
type Props = { initialContext?: LinkedNavigationContext; onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string, context?: LinkedNavigationContext) => void; onOpenIconStudio?: (processDefinitionId?: string) => void; onScheduleVendor?: (vendorId:string, operationId:string, processName:string) => void };
type ProcessExportField = "company" | "po" | "component" | "componentNumber" | "operation" | "category" | "subcategory" | "execution" | "machine" | "description" | "vendor" | "transportVendor" | "transportRoute" | "vehicle" | "quantity" | "quantityUnit" | "completed" | "rejected" | "status" | "tolerance" | "inspection" | "paymentStatus" | "paidAmount" | "plannedStart" | "plannedEnd" | "price" | "transportCost" | "transportLegCost" | "amount" | "combinedAmount";
const DEFAULT_PROCESS_COLOR = "#6fa9e5";
const ALTERNATE_ROUTE_COLOR = "#4b95eb";
const REWORK_ROUTE_COLOR = "#e38b45";
const PROCESS_EXPORT_FIELDS: Array<{key:ProcessExportField;label:string}> = [
  {key:"company",label:"Company"},{key:"po",label:"PO number"},{key:"component",label:"Component name"},{key:"componentNumber",label:"Component number"},
  {key:"operation",label:"Process"},{key:"category",label:"Category"},{key:"subcategory",label:"Subcategory"},{key:"execution",label:"Execution type"},{key:"machine",label:"Machine / station"},
  {key:"description",label:"Operation notes"},{key:"vendor",label:"Vendor"},{key:"transportVendor",label:"Transport vendor"},
  {key:"transportRoute",label:"Transport route"},{key:"vehicle",label:"Vehicle type"},{key:"quantity",label:"Planned quantity"},{key:"quantityUnit",label:"Quantity unit"},
  {key:"completed",label:"Completed quantity"},{key:"rejected",label:"Rejected quantity"},{key:"status",label:"Status"},
  {key:"tolerance",label:"Tolerance"},{key:"inspection",label:"Inspection result"},{key:"paymentStatus",label:"Payment status"},
  {key:"paidAmount",label:"Paid amount"},{key:"plannedStart",label:"Start date/time"},{key:"plannedEnd",label:"Due date/time"},
  {key:"price",label:"Price / piece or set"},{key:"transportCost",label:"Legacy operation transport (separate)"},{key:"transportLegCost",label:"Transport leg amount"},{key:"amount",label:"Process amount (transport excluded)"},{key:"combinedAmount",label:"Process + transport total"}
];
type DraftOperation = Pick<OperationRecord, "name" | "category" | "machine" | "vendorId" | "status" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd" | "transportVendorId" | "transportFrom" | "transportTo" | "transportVehicleType" | "transportRouteId" | "quantity" | "completed" | "accepted" | "rejected" | "ratePerPart" | "actualRatePerPart" | "inspectionResult" | "transportCost" | "transportPickup" | "transportDelivery" | "qualityNotes" | "notes" | "branch"> & { paymentStatus:"Paid"|"Unpaid"; paidAmount:number; paymentReference:string; subcategory:string; executionType:"Internal"|"Outsourced"; toleranceCategory:"Standard"|"Precision"|"Close"|"Ultra Precision"; inspectionRequired:boolean; processCostTotal:number; parentId?:string; relationType?:"subprocess"|"alternate"|"rework"; costIncluded:boolean; processDefinitionId?: string; processSubcategoryId:string; processColor?: string };
const processSubcategoryIdFor = (definition: ProcessDefinitionRecord | undefined, subcategory: string) => {
  const index = definition?.subcategories.indexOf(subcategory) ?? -1;
  if (!definition || index < 0) return "";
  return definition.subcategoryIds?.[index] || `${definition.id}-subprocess-${String(index + 1).padStart(3, "0")}`;
};
const resolveProcessDefinition = (
  definitions: ProcessDefinitionRecord[],
  definitionId?: string,
  processType?: string,
  category?: string
) => {
  const stableDefinition = definitionId ? definitions.find(definition => definition.id === definitionId) : undefined;
  if (stableDefinition && (!processType || stableDefinition.processType === processType) && (!category || stableDefinition.category === category)) return stableDefinition;
  if (!processType) return undefined;
  const matches = definitions.filter(definition => definition.processType === processType && (!category || definition.category === category));
  return matches.length === 1 ? matches[0] : undefined;
};
const blankOperation = (line?: PurchaseOrderLine): DraftOperation => ({
  processDefinitionId: "", name: "", category: "", machine: "", vendorId: "", status: "Planned", executionType:"Outsourced", toleranceCategory:"Standard", inspectionRequired:false, plannedStart: "", plannedEnd: line?.targetDelivery ? (line.targetDelivery.includes("T")?line.targetDelivery:line.targetDelivery+"T08:00") : "", actualStart: "", actualEnd: "",
  quantity: line?.quantity || 0, completed: 0, accepted: 0, rejected: 0, ratePerPart: 0, actualRatePerPart: 0, processCostTotal: 0, paymentStatus:"Unpaid", paidAmount:0, paymentReference:"", subcategory:"", processSubcategoryId:"",
  transportVendorId: "", transportFrom:"", transportTo:"", transportVehicleType:"", transportRouteId:"", transportCost: 0, transportPickup: "", transportDelivery: "", qualityNotes: "", inspectionResult: "", notes: "", branch: "Main route", costIncluded: true, processColor: DEFAULT_PROCESS_COLOR
});
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dateValue = (value: string) => new Date(value.includes("T") ? value : value + "T12:00:00");
const dateTimeInput = (value?: string) => value ? (value.includes("T") ? value.slice(0,16) : value+"T08:00") : "";
const shortDate = (value?: string) => value ? dateValue(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(value.includes("T") ? {hour:"2-digit",minute:"2-digit"} : {}) }) : "Not set";
const daysBetween = (start?: string, end?: string) => start && end ? Math.max(1, Math.round((dateValue(end).getTime() - dateValue(start).getTime()) / 86400000) + 1) : 0;

export default function LinkedProcessWorkspace({ initialContext, onBack, onNotice, notice, onSelectModule, onOpenIconStudio, onScheduleVendor }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const purchaseOrders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const componentParts = activeRows(data.componentParts || []);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const processDefinitions = activeRows(data.processDefinitions);
  const transportRoutes = activeRows(data.transportRoutes || []);
  const allTransportLegs = activeRows(data.transportLegs || []);
  const allMaterialCostEntries = activeRows(data.materialCostEntries || []);

  const [companyId, setCompanyId] = useState("");
  const [poId, setPoId] = useState("");
  const [poLineId, setPoLineId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const selectedOperationPanelRef = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [routeView, setRouteView] = useState<"3d" | "list">("3d");
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(-1);
  const [showEditor, setShowEditor] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMenuDefinitionId, setAddMenuDefinitionId] = useState("");
  const [showTransportEditor, setShowTransportEditor] = useState(false);
  const [showTransportMenu, setShowTransportMenu] = useState(false);
  const [editingTransportLegId, setEditingTransportLegId] = useState("");
  const [transportRouteId, setTransportRouteId] = useState("");
  const [transportTripCount, setTransportTripCount] = useState("1");
  const [transportAnchorOperationId, setTransportAnchorOperationId] = useState("");
  const [transportPlacement, setTransportPlacement] = useState<"start"|"before"|"after">("after");
  const [transportLegNotes, setTransportLegNotes] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<DraftOperation>(() => blankOperation());
  const [exportFields,setExportFields] = useState<ProcessExportField[]>(["operation","quantity","status","plannedStart","plannedEnd"]);
  const [exportScope,setExportScope] = useState<string>("all");
  const [exportArrows,setExportArrows] = useState(true);
  const [visualStyle,setVisualStyle] = useState<"sphere"|"vortex"|"linear"|"horizontal"|"vertical"|"timeline"|"gantt"|"nodes"|"branch"|"combined">("sphere");
  const [ganttScale,setGanttScale] = useState<"day"|"week"|"month">("week");
  const [histogramStyle,setHistogramStyle] = useState<"bar"|"stacked"|"donut">("bar");
  const [statusFilters,setStatusFilters] = useState<string[]>([]);
  const [executionFilters,setExecutionFilters] = useState<string[]>([]);
  const [categoryFilters,setCategoryFilters] = useState<string[]>([]);
  const [toleranceFilters,setToleranceFilters] = useState<string[]>([]);
  const [paymentFilters,setPaymentFilters] = useState<string[]>([]);
  const [vendorFilters,setVendorFilters] = useState<string[]>([]);
  const [processTypeFilters,setProcessTypeFilters] = useState<string[]>([]);
  const [subcategoryFilters,setSubcategoryFilters] = useState<string[]>([]);
  const [categorySearch,setCategorySearch] = useState("");
  const [dateFrom,setDateFrom] = useState("");
  const [dateTo,setDateTo] = useState("");
  const [minQuantity,setMinQuantity] = useState("");
  const [maxQuantity,setMaxQuantity] = useState("");
  const [minPrice,setMinPrice] = useState("");
  const [maxPrice,setMaxPrice] = useState("");
  const [minAmount,setMinAmount] = useState("");
  const [maxAmount,setMaxAmount] = useState("");
  const [selectedOperationIds,setSelectedOperationIds] = useState<string[]>([]);
  const [bulkStatus,setBulkStatus] = useState("");
  const [bulkVendorId,setBulkVendorId] = useState("");
  const [bulkStart,setBulkStart] = useState("");
  const [bulkEnd,setBulkEnd] = useState("");
  const appliedLinkedContext = useRef("");
  useEffect(() => {
    if (!initialContext) { appliedLinkedContext.current = ""; return; }
    const contextKey = JSON.stringify({ companyId: initialContext.companyId, poId: initialContext.poId, poLineId: initialContext.poLineId, componentId: initialContext.componentId, operationId: initialContext.operationId, vendorId: initialContext.vendorId });
    if (appliedLinkedContext.current === contextKey) return;
    const targetPO = (initialContext.poId
      ? purchaseOrders.find(po => po.id === initialContext.poId)
      : undefined)
      || (initialContext.poLineId
        ? purchaseOrders.find(po => po.lines.some(line => line.id === initialContext.poLineId))
        : undefined)
      || (initialContext.operationId
        ? purchaseOrders.find(po => po.id === operations.find(op => op.id === initialContext.operationId)?.poId)
        : undefined)
      || (initialContext.vendorId
        ? purchaseOrders.find(po => po.lines.some(line => operations.some(op => op.vendorId === initialContext.vendorId && op.poId === po.id && op.poLineId === line.id)))
        : undefined)
      || (initialContext.componentId
        ? purchaseOrders.find(po => po.lines.some(line => line.componentId === initialContext.componentId))
        : undefined)
      || (initialContext.vendorId
        ? purchaseOrders.find(po => po.lines.some(line => operations.some(op => op.vendorId === initialContext.vendorId && op.poId === po.id && op.poLineId === line.id)))
        : undefined);
    if (targetPO) {
      setCompanyId(targetPO.companyId);
      setPoId(targetPO.id);
      const targetOperation = (initialContext.operationId ? operations.find(op => op.id === initialContext.operationId && op.poId === targetPO.id) : undefined)
        || (initialContext.vendorId ? operations.find(op => op.vendorId === initialContext.vendorId && op.poId === targetPO.id) : undefined);
      const targetLine = targetPO.lines.find(line => line.id === targetOperation?.poLineId)
        || targetPO.lines.find(line => line.id === initialContext.poLineId)
        || targetPO.lines.find(line => line.componentId === initialContext.componentId);
      setPoLineId(targetLine?.id || "");
      const linkedOperation = operations.find(op => op.id === initialContext.operationId
        && op.poId === targetPO.id && op.poLineId === targetLine?.id);
      setSelectedOperationId(linkedOperation?.id || "");
      appliedLinkedContext.current = contextKey;
    } else if (initialContext.companyId && companies.some(company => company.id === initialContext.companyId)) {
      setCompanyId(initialContext.companyId);
      setPoId("");
      setPoLineId("");
      setSelectedOperationId("");
      appliedLinkedContext.current = contextKey;
    } else if (!initialContext.poId && !initialContext.poLineId && !initialContext.componentId && !initialContext.operationId && !initialContext.vendorId) {
      setSelectedOperationId("");
      appliedLinkedContext.current = contextKey;
    }
  }, [initialContext?.companyId, initialContext?.poId, initialContext?.poLineId, initialContext?.componentId, initialContext?.operationId, initialContext?.vendorId, data, companies]);


  const companyOrders = purchaseOrders.filter(p => p.companyId === companyId);
  const selectedPO = purchaseOrders.find(p => p.id === poId);
  const selectedCompany = companies.find(company => company.id === companyId);
  const poLines = selectedPO ? selectedPO.lines.filter(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt)) : [];
  const selectedLine = poLines.find(line => line.id === poLineId);
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const selectedPart = componentParts.find(part => part.id === selectedLine?.partId);
  const processMapMaterialEntries = allMaterialCostEntries.filter(entry => entry.scope === "process-map" && entry.componentId === selectedComponent?.id && (!entry.poId || entry.poId === selectedPO?.id)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const selectedProcessDefinition = resolveProcessDefinition(processDefinitions, draft.processDefinitionId, draft.name, draft.category);
  // Process Map is component-wide: each PO line / part keeps an independent route,
  // even when its branch is also named "Main route".
  const routeOperations = operations.filter(op => op.poId === poId && op.componentId === selectedLine?.componentId).sort((a,b) => a.poLineId.localeCompare(b.poLineId) || a.sequence - b.sequence);
  const selectedLineOperations = operations.filter(op=>op.poId===poId && op.poLineId===poLineId && op.componentId===selectedLine?.componentId).sort((a,b)=>a.sequence-b.sequence);
  const componentTransportLegs = allTransportLegs.filter(leg => leg.poId === poId && leg.componentId === selectedLine?.componentId).sort((a,b) => a.sequence - b.sequence);
  const routeLabels = Object.fromEntries(poLines.filter(line=>line.componentId===selectedLine?.componentId).map(line=>{
    const part=componentParts.find(item=>item.id===line.partId);
    const label=part ? [part.partNumber,part.name].filter(Boolean).join(" · ") : "Component-level route";
    return [line.id,label+" · Qty "+line.quantity];
  }));
  const materialRouteEntries = allMaterialCostEntries.filter(entry=>entry.scope==="process-map" && entry.poId===poId && entry.componentId===selectedLine?.componentId);
  const selectedTransportDirectoryRoute = transportRoutes.find(route => route.id === transportRouteId);
  const processCategories = [...new Set(processDefinitions.map(item => item.category).filter(Boolean))].sort();
  const processTypeOptions = [...new Set(processDefinitions.filter(item => !draft.category || item.category === draft.category).map(item => item.processType).filter(Boolean))].sort();
  const processFilterTypes = processDefinitions.map(definition => ({ id: definition.id, label: definition.category + " · " + definition.processType }));
  const processSubcategoryOptions = processDefinitions.flatMap(definition =>
    (definition.subcategories || []).map((value, index) => ({
      id: definition.subcategoryIds?.[index] || `${definition.id}-subprocess-${String(index + 1).padStart(3, "0")}`,
      label: definition.category + " · " + definition.processType + " · " + value
    }))
  );
  const quantityUnit = selectedComponent?.salePriceUnit === "set" ? "sets" : "pieces";
  const processVendorOptions = selectedProcessDefinition?.vendorIds?.length ? vendors.filter(vendor => selectedProcessDefinition.vendorIds.includes(vendor.id)) : vendors;
  const selectedTransportVendor = vendors.find(vendor => vendor.id === draft.transportVendorId);
  const selectedTransportRoutes = selectedTransportVendor?.transportRoutes || [];
  const visibleOperations = routeOperations.filter(op => {
    const text = [op.name,op.category,op.subcategory,op.machine,op.executionType,op.status,op.branch,op.plannedStart,op.plannedEnd,op.actualStart,op.actualEnd,op.quantity,op.completed,op.accepted,op.rejected,op.ratePerPart,op.actualRatePerPart,op.transportCost,op.paymentStatus,op.paidAmount,op.toleranceCategory,op.inspectionResult,op.qualityNotes,op.notes,op.transportFrom,op.transportTo,op.transportVehicleType,vendors.find(v => v.id === op.vendorId)?.company,vendors.find(v => v.id === op.transportVendorId)?.company].join(" ").toLowerCase();
    const statusMatch = !statusFilters.length || statusFilters.includes(op.status);
    const executionMatch = !executionFilters.length || executionFilters.includes(op.executionType || "Outsourced");
    const operationDefinition = resolveProcessDefinition(processDefinitions, op.processDefinitionId, op.name, op.category);
    const effectiveCategory = operationDefinition?.category || op.category;
    const categoryMatch = !categoryFilters.length || categoryFilters.includes(effectiveCategory);
    const toleranceMatch = !toleranceFilters.length || toleranceFilters.includes(op.toleranceCategory || "Standard");
    const paymentMatch = !paymentFilters.length || paymentFilters.includes(op.paymentStatus || "Unpaid");
    const vendorMatch = !vendorFilters.length || vendorFilters.includes(op.vendorId);
    const stableProcessDefinitionId = operationDefinition?.id || op.processDefinitionId || "";
    const processTypeMatch = !processTypeFilters.length || processTypeFilters.includes(stableProcessDefinitionId);
    const operationSubcategoryId = op.processSubcategoryId || processSubcategoryIdFor(operationDefinition, op.subcategory || "");
    const subcategoryMatch = !subcategoryFilters.length || subcategoryFilters.includes(operationSubcategoryId);
    const operationDate = (op.plannedEnd || "").slice(0,10);
    const dateMatch = (!dateFrom || Boolean(operationDate && operationDate >= dateFrom)) && (!dateTo || Boolean(operationDate && operationDate <= dateTo));
    const quantityMatch = (!minQuantity || op.quantity >= Number(minQuantity)) && (!maxQuantity || op.quantity <= Number(maxQuantity));
    const effectivePrice = op.actualRatePerPart || op.ratePerPart;
    const filterLegs = componentTransportLegs.filter(leg=>!leg.anchorOperationId || leg.anchorOperationId===op.id);
    const filterAnchoredTransport = filterLegs.filter(leg=>leg.anchorOperationId===op.id).reduce((sum,leg)=>sum+Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0),0);
    const filterDuplicateLegacy = filterLegs.some(leg=>leg.anchorOperationId===op.id && Boolean(op.transportRouteId) && op.transportRouteId===leg.routeId && Math.abs(Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0)-Math.max(0,Number(op.transportCost)||0))<0.01);
    const filterLegacyTransport = filterDuplicateLegacy ? 0 : Math.max(0,Number(op.transportCost)||0);
    const firstMainRoute = routeOperations.filter(item=>(item.branch||"Main route")==="Main route").slice().sort((a,b)=>a.sequence-b.sequence)[0];
    const filterUnanchoredTransport = firstMainRoute?.id===op.id ? componentTransportLegs.filter(leg=>!leg.anchorOperationId).reduce((sum,leg)=>sum+Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0),0) : 0;
    const effectiveAmount = op.quantity * effectivePrice + filterAnchoredTransport + filterLegacyTransport + filterUnanchoredTransport;
    const priceMatch = (!minPrice || effectivePrice >= Number(minPrice)) && (!maxPrice || effectivePrice <= Number(maxPrice));
    const amountMatch = (!minAmount || effectiveAmount >= Number(minAmount)) && (!maxAmount || effectiveAmount <= Number(maxAmount));
    return text.includes(search.toLowerCase().trim()) && statusMatch && executionMatch && categoryMatch && toleranceMatch && paymentMatch && vendorMatch && processTypeMatch && subcategoryMatch && dateMatch && quantityMatch && priceMatch && amountMatch;
  });

  const explicitlySelectedOperation = routeOperations.find(op => op.id === selectedOperationId);
  const activeOperation = explicitlySelectedOperation || routeOperations[0];
  const selectedRouteOperations = visibleOperations.filter(op => selectedOperationIds.includes(op.id));
  const resolveBranchOrigin = (branch: string, candidates: OperationRecord[]) => {
    const poLineId=candidates[0]?.poLineId;
    for (const candidate of candidates) {
      if (candidate.relationType !== "alternate" && candidate.relationType !== "rework") continue;
      let branchRoot = candidate;
      let parent = routeOperations.find(item => item.id === branchRoot.parentId && item.poLineId===poLineId);
      let guard = 0;
      while (parent && parent.poLineId===poLineId && (parent.branch || "Main route") === branch && parent.parentId && guard++ < routeOperations.length) {
        branchRoot = parent;
        parent = routeOperations.find(item => item.id === branchRoot.parentId && item.poLineId===poLineId);
      }
      if (parent && parent.poLineId===poLineId && (parent.branch || "Main route") !== branch) return { branchRoot, parent };
    }
    return undefined;
  };
  const routeBranchNames = [...new Set(visibleOperations.map(op => op.branch || "Main route"))]
    .sort((a,b) => a === "Main route" ? -1 : b === "Main route" ? 1 : a.localeCompare(b));
  const getRouteScopeOperations = (scope: string): OperationRecord[] => {
    const source = visibleOperations;
    const branchName = (operation: OperationRecord) => operation.branch || "Main route";
    // "All routes" is the complete saved graph; active filters apply only to filtered scopes.\n    if (scope === "all") return routeOperations;
    if (scope === "main") return source.filter(op => branchName(op) === "Main route");
    if (scope === "alternate") return source.filter(op => op.relationType === "alternate" || (branchName(op) !== "Main route" && !/rework/i.test(branchName(op))));
    if (scope === "rework") return source.filter(op => op.relationType === "rework" || /rework/i.test(branchName(op)));
    if (scope === "filtered") return source;
    if (scope === "selected-operations") return selectedRouteOperations;
    if (scope === "selected-operation") return explicitlySelectedOperation ? source.filter(op => op.id === explicitlySelectedOperation.id) : [];
    if (scope === "selected-branch") return explicitlySelectedOperation ? source.filter(op => op.poLineId===explicitlySelectedOperation.poLineId && branchName(op) === branchName(explicitlySelectedOperation)) : [];
    if (scope.startsWith("branch:")) {
      const branch = scope.slice("branch:".length);
      return source.filter(op => branchName(op) === branch);
    }
    return source;
  };
  const exportOperations = getRouteScopeOperations(exportScope);
  const routeScopeButtons = [
    { key: "all", label: "All routes", count: routeOperations.length },
    { key: "main", label: "Main route", count: visibleOperations.filter(op => (op.branch || "Main route") === "Main route").length },
    { key: "alternate", label: "Alternate routes", count: visibleOperations.filter(op => op.relationType === "alternate" || ((op.branch || "Main route") !== "Main route" && !/rework/i.test(op.branch || ""))).length },
    { key: "rework", label: "Rework routes", count: visibleOperations.filter(op => op.relationType === "rework" || /rework/i.test(op.branch || "")).length },
    { key: "selected-branch", label: "Selected branch", count: explicitlySelectedOperation ? visibleOperations.filter(op => (op.branch || "Main route") === (explicitlySelectedOperation.branch || "Main route")).length : 0 },
    { key: "filtered", label: "Filtered results", count: visibleOperations.length },
    { key: "selected-operations", label: "Selected operations", count: selectedRouteOperations.length },
    { key: "selected-operation", label: "Selected operation", count: explicitlySelectedOperation && visibleOperations.some(op => op.id === explicitlySelectedOperation.id) ? 1 : 0 },
    ...routeBranchNames.filter(name => name !== "Main route").map(name => ({
      key: "branch:" + name, label: name, count: visibleOperations.filter(op => (op.branch || "Main route") === name).length
    }))
  ];  const exportScopeLabel = routeScopeButtons.find(scope => scope.key === exportScope)?.label || "All routes";
  const toggleFilter = (setter: (next: string[] | ((previous: string[]) => string[])) => void, value: string) => setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const clearAllFilters = () => { setExportScope("all"); setZoom(1); setSearch(""); setStatusFilters([]); setExecutionFilters([]); setCategoryFilters([]); setToleranceFilters([]); setPaymentFilters([]); setVendorFilters([]); setProcessTypeFilters([]); setSubcategoryFilters([]); setCategorySearch(""); setDateFrom(""); setDateTo(""); setMinQuantity(""); setMaxQuantity(""); setMinPrice(""); setMaxPrice(""); setMinAmount(""); setMaxAmount(""); setSelectedOperationIds([]); };
  const toggleOperationSelection = (id: string) => setSelectedOperationIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const selectVisibleOperations = (checked: boolean) => setSelectedOperationIds(current => checked ? [...new Set([...current, ...exportOperations.map(op => op.id)])] : current.filter(id => !exportOperations.some(op => op.id === id)));
  // The execution register, bulk actions and route graph must share the selected route scope.
  const selectedVisibleOperations = exportOperations.filter(op => selectedOperationIds.includes(op.id));
  const applyBulkUpdate = () => {
    const selected = selectedVisibleOperations;
    const ids = new Set(selected.map(op => op.id));
    if (!ids.size) { onNotice("Select one or more visible process operations first."); return; }
    if (bulkVendorId && !vendors.some(vendor => vendor.id === bulkVendorId)) {
      onNotice("The selected bulk vendor is missing or archived. Choose an active Vendor Directory record."); return;
    }
    if (bulkVendorId) {
      const incompatible = selected.find(op => {
        if ((op.executionType || "Outsourced") !== "Outsourced") return false;
        const definition = resolveProcessDefinition(processDefinitions, op.processDefinitionId, op.name, op.category);
        return Boolean(definition?.vendorIds?.length && !definition.vendorIds.includes(bulkVendorId));
      });
      if (incompatible) { onNotice("The bulk vendor is not assigned to process definition " + incompatible.name + ". No records were changed."); return; }
    }
    const scheduleConflict = selected.find(op => {
      const nextStart = bulkStart || op.plannedStart;
      const nextEnd = bulkEnd || op.plannedEnd;
      return Boolean(nextStart && nextEnd && nextEnd < nextStart);
    });
    if (scheduleConflict) { onNotice("Bulk dates would put the due date before the planned start for " + scheduleConflict.name + ". No records were changed."); return; }
    const stamp = nowIso();
    update(current => {
      const nextOperations = current.operations.map(op => !ids.has(op.id) ? op : ({
        ...op,
        ...(bulkStatus ? { status: bulkStatus as LifecycleStatus } : {}),
        ...(bulkStatus === "Complete" ? { completed: Math.max(op.completed || 0, op.quantity || 0), actualEnd: op.actualEnd || stamp } : {}),
        ...(bulkVendorId ? { vendorId: bulkVendorId } : {}),
        ...(bulkStart ? { plannedStart: bulkStart } : {}),
        ...(bulkEnd ? { plannedEnd: bulkEnd } : {}),
        updatedAt: stamp
      }));
      if (!bulkStatus) return { ...current, operations: nextOperations };
      const touchedLines = new Set(selected.map(op => op.poId + "::" + op.poLineId));
      const reopenedLines = new Set(selected
        .filter(op => bulkStatus !== "Complete" && ((op.branch || "Main route") === "Main route" || op.costIncluded !== false))
        .map(op => op.poId + "::" + op.poLineId));
      const nextPurchaseOrders = current.purchaseOrders.map(order => ({
        ...order,
        lines: order.lines.map(line => {
          const key = order.id + "::" + line.id;
          if (!touchedLines.has(key)) return line;
          const lineOperations = nextOperations.filter(op => op.poId === order.id && op.poLineId === line.id && !op.deletedAt
            && ((op.branch || "Main route") === "Main route" || op.costIncluded !== false));
          if (lineOperations.length && lineOperations.every(op => op.status === "Complete")) {
            return { ...line, jobStatus: "Finished" as const, jobFinishedAt: stamp, updatedAt: stamp };
          }
          if (reopenedLines.has(key) && line.jobStatus === "Finished") {
            return { ...line, jobStatus: "In progress" as const, jobFinishedAt: undefined, updatedAt: stamp };
          }
          return line;
        })
      }));
      return { ...current, operations: nextOperations, purchaseOrders: nextPurchaseOrders };
    });
    onNotice("Bulk update applied to " + ids.size + " selected operation(s)." + (bulkStatus === "Complete" ? " Completed quantities and actual end dates were recorded; eligible PO jobs were finished only when their saved route operations were all Complete." : bulkStatus ? " Affected finished PO jobs were reopened where an active route operation is no longer Complete." : ""));
    setBulkStatus(""); setBulkVendorId(""); setBulkStart(""); setBulkEnd("");
  };

  const openAddMenu = () => {
    setAddMenuDefinitionId(processDefinitions[0]?.id || "");
    setShowAddMenu(true);
    document.querySelector(".process-add-menu-anchor")?.scrollIntoView({behavior:"smooth",block:"center"});
  };
  const toggleAddMenu = () => {
    if (showAddMenu) setShowAddMenu(false);
    else openAddMenu();
  };
  const paymentRowsFor = (operationId:string) => activeRows(data.paymentTransactions).filter(payment=>payment.operationId===operationId);
  const paymentTotalFor = (operation:OperationRecord) => {
    const transactions=paymentRowsFor(operation.id);
    return transactions.length?transactions.reduce((sum,payment)=>sum+Math.max(0,Number(payment.amount)||0),0):Math.max(0,Number(operation.paidAmount)||0);
  };
  const activeBranchNames = new Set(routeOperations.filter(op => (op.branch || "Main route") !== "Main route" && op.costIncluded !== false).map(op => op.branch || "Main route"));
  const activeRouteOperations = routeOperations.filter(op => (op.branch || "Main route") === "Main route" || activeBranchNames.has(op.branch || "Main route"));
  const costedOperations = routeOperations.filter(op => op.costIncluded !== false);
  const totalProcessCost = costedOperations.reduce((sum, op) => sum + op.quantity * (op.actualRatePerPart || op.ratePerPart), 0);
  const includedTransportLegs = componentTransportLegs.filter(leg => !leg.anchorOperationId || routeOperations.find(operation => operation.id === leg.anchorOperationId)?.costIncluded !== false);
  // Avoid charging the same saved route twice when an older operation field and a newer anchored leg match.
  const duplicateLegacyTransportIds = new Set(includedTransportLegs.filter(leg=>leg.anchorOperationId).filter(leg=>{
    const op=routeOperations.find(operation=>operation.id===leg.anchorOperationId);
    return Boolean(op?.transportRouteId)&&op?.transportRouteId===leg.routeId&&Math.abs(Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0)-Math.max(0,Number(op?.transportCost)||0))<0.01;
  }).map(leg=>leg.anchorOperationId));
  const legacyTransportCost = costedOperations.reduce((sum, op) => sum + (duplicateLegacyTransportIds.has(op.id)?0:Math.max(0, Number(op.transportCost) || 0)), 0);
  const componentTransportCost = includedTransportLegs.reduce((sum, leg) => sum + Math.max(0, Number(leg.fixedAmount) || 0) * Math.max(0, Number(leg.tripCount) || 0), 0);
  const materialInboundTransportCost = materialRouteEntries.reduce((sum,entry)=>sum+Math.max(0,Number(entry.transportCost)||0),0);
  const totalTransportCost = legacyTransportCost + componentTransportCost + materialInboundTransportCost;
  const componentTotalCost = totalProcessCost + totalTransportCost;
  const firstMainRouteOperation = routeOperations.filter(operation => (operation.branch || "Main route") === "Main route").slice().sort((a,b) => a.sequence-b.sequence)[0];
  const unanchoredTransportCost = includedTransportLegs.filter(leg => !leg.anchorOperationId).reduce((sum,leg) => sum + Math.max(0,Number(leg.fixedAmount)||0) * Math.max(0,Number(leg.tripCount)||0),0);
  const operationTransportAmount = (operation: OperationRecord) => {
    const anchored = includedTransportLegs.filter(leg => leg.anchorOperationId === operation.id).reduce((sum,leg) => sum + Math.max(0,Number(leg.fixedAmount)||0) * Math.max(0,Number(leg.tripCount)||0),0);
    const legacy = duplicateLegacyTransportIds.has(operation.id) ? 0 : Math.max(0,Number(operation.transportCost)||0);
    return anchored + legacy + (firstMainRouteOperation?.id === operation.id ? unanchoredTransportCost : 0);
  };
  const expectedQuantity = poLines.filter(line=>line.componentId===selectedLine?.componentId).reduce((sum,line)=>sum+Math.max(0,Number(line.quantity)||0),0) || selectedLine?.quantity || 0;
  const completedQuantity = activeRouteOperations.length ? Math.min(...activeRouteOperations.map(op => op.accepted || 0)) : 0;
  const finalRouteOperation = [...routeOperations].filter(op=>(op.branch||"Main route")==="Main route").sort((a,b)=>a.sequence-b.sequence).at(-1) || routeOperations[routeOperations.length-1];
  const finalCompletedQty = Math.min(expectedQuantity,Math.max(0,finalRouteOperation?.accepted||finalRouteOperation?.completed||0));
  const pendingProductionQty = Math.max(0,expectedQuantity-finalCompletedQty);
  const inProgressProductionQty = Math.min(pendingProductionQty,activeRouteOperations.filter(op=>op.status==="Running").reduce((sum,op)=>sum+Math.max(0,op.quantity-op.completed),0));
  const plannedProductionQty = expectedQuantity;
  const completionPercent = plannedProductionQty>0?Math.round(finalCompletedQty/plannedProductionQty*100):0;
  const vendorAssignedPercent = activeRouteOperations.length?Math.round(activeRouteOperations.filter(op=>op.executionType==="Internal"||Boolean(op.vendorId)).length/activeRouteOperations.length*100):0;
  const lateOps = activeRouteOperations.filter(op => op.plannedEnd && op.status !== "Complete" && op.plannedEnd.slice(0,10) < new Date().toISOString().slice(0, 10));
  const delayedPercent = activeRouteOperations.length?Math.round(lateOps.length/activeRouteOperations.length*100):0;
  const duplicateLegacyTransportIdsForCount = new Set(includedTransportLegs.filter(leg=>leg.anchorOperationId).filter(leg=>{
    const op=routeOperations.find(operation=>operation.id===leg.anchorOperationId);
    return Boolean(op?.transportRouteId)&&op?.transportRouteId===leg.routeId&&Math.abs(Math.max(0,Number(leg.fixedAmount)||0)*Math.max(0,Number(leg.tripCount)||0)-Math.max(0,Number(op?.transportCost)||0))<0.01;
  }).map(leg=>leg.anchorOperationId));
  const transportCount = includedTransportLegs.reduce((sum, leg) => sum + Math.max(0, Number(leg.tripCount) || 0), 0) + costedOperations.filter(op => !duplicateLegacyTransportIdsForCount.has(op.id) && (op.transportCost > 0 || op.transportVendorId)).length + materialRouteEntries.filter(entry=>(Number(entry.transportCost)||0)>0 || entry.transportVendorId).length;
  const totalAccepted = routeOperations.reduce((sum, op) => sum + op.accepted, 0);
  const allDone = activeRouteOperations.length > 0 && activeRouteOperations.every(op => op.status === "Complete");
  const finalDelivery = selectedLine?.targetDelivery || selectedPO?.targetDelivery || "";
  const routeCost = totalProcessCost;
  const durationDays = activeRouteOperations.reduce((sum, op) => sum + daysBetween(op.plannedStart, op.plannedEnd), 0);
  const timelineStart = routeOperations.map(op => op.plannedStart).filter(Boolean).sort()[0] || "";
  const timelineEnd = routeOperations.map(op => op.plannedEnd).filter(Boolean).sort().at(-1) || finalDelivery;
  const ganttBaseDate = timelineStart || finalDelivery || new Date().toISOString().slice(0,10);
  const ganttSpanDays = Math.max(1,daysBetween(ganttBaseDate,timelineEnd||ganttBaseDate));
  const ganttStepDays = ganttScale==="day"?1:ganttScale==="week"?7:30;
  const ganttTicks = Array.from({length:Math.min(16,Math.ceil(ganttSpanDays/ganttStepDays)+1)},(_,index)=>{
    const date=new Date(dateValue(ganttBaseDate).getTime()+index*ganttStepDays*86400000);
    return date.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:ganttScale==="month"?"numeric":undefined});
  });

  const exportColumns = PROCESS_EXPORT_FIELDS.filter(field=>exportFields.includes(field.key));
  const simulationOperations = exportOperations.filter(operation => operation.relationType !== "subprocess");
  const exportBranches = [...new Set(exportOperations.map(op=>(op.poLineId||op.componentId)+"::"+(op.branch||"Main route")))].sort((a,b)=>a.localeCompare(b));
  const processAccent = (operation:OperationRecord) => processDefinitions.find(item=>item.id===operation.processDefinitionId)?.displayColor || operation.processColor || DEFAULT_PROCESS_COLOR;
  const branchAccent = (operation:OperationRecord) => operation.relationType==="rework" ? REWORK_ROUTE_COLOR : operation.relationType==="alternate" ? ALTERNATE_ROUTE_COLOR : processAccent(operation);
  const exportValue = (op:OperationRecord,key:ProcessExportField):string|number => {
    switch(key) {
      case "company": return selectedCompany?.name || "";
      case "po": return selectedPO?.number || "";
      case "component": return selectedComponent?.name || "";
      case "componentNumber": return selectedComponent?.partNumber || "";
      case "operation": return op.name;
      case "category": return op.category || "";
      case "subcategory": return op.subcategory || "";
      case "execution": return op.executionType || "Outsourced";
      case "machine": return op.machine || "";
      case "description": return op.notes || op.qualityNotes || "";
      case "vendor": return vendors.find(v=>v.id===op.vendorId)?.company || "";
      case "transportVendor": return vendors.find(v=>v.id===op.transportVendorId)?.company || "";
      case "transportRoute": return (op.transportFrom||"")+(op.transportTo?" → "+op.transportTo:"");
      case "vehicle": return op.transportVehicleType || "";
      case "quantity": return op.quantity;
      case "quantityUnit": return selectedComponent?.salePriceUnit === "set" ? "sets" : "pieces";
      case "completed": return op.completed;
      case "rejected": return op.rejected;
      case "status": return op.status;
      case "tolerance": return op.toleranceCategory || "Standard";
      case "inspection": return op.inspectionResult || op.qualityNotes || "";
      case "paymentStatus": return op.paymentStatus || "Unpaid";
      case "paidAmount": return paymentTotalFor(op);
      case "plannedStart": return op.plannedStart || "";
      case "plannedEnd": return op.plannedEnd || "";
      case "price": return op.actualRatePerPart || op.ratePerPart;
      case "transportCost": return op.transportCost;
      case "transportLegCost": return operationTransportAmount(op);
      case "amount": return op.quantity*(op.actualRatePerPart||op.ratePerPart);
      case "combinedAmount": return op.quantity*(op.actualRatePerPart||op.ratePerPart)+operationTransportAmount(op);
    }
  };
  const saveExportBlob = (filename:string,blob:Blob) => {
    const url=URL.createObjectURL(blob),anchor=document.createElement("a");
    anchor.href=url;anchor.download=filename;anchor.rel="noopener";document.body.appendChild(anchor);anchor.click();anchor.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  const exportFileBase = ["AXIMACH",selectedComponent?.partNumber || "Component",selectedPO?.number || "Process-Map"].join("-").replace(/[^a-z0-9_-]+/gi,"-");
  const exportCsv = () => {
    if(!exportOperations.length || !exportColumns.length){onNotice("Choose at least one field and ensure operations are visible.");return;}
    const cell=(value:unknown)=>'"'+String(value??"").replace(/"/g,'""')+'"';
    const rows=[exportColumns.map(field=>cell(field.label)).join(","),...exportOperations.map(op=>exportColumns.map(field=>cell(exportValue(op,field.key))).join(","))];
    saveExportBlob(exportFileBase+".csv",new Blob(["\uFEFF"+rows.join("\r\n")],{type:"text/csv;charset=utf-8"}));
    onNotice("CSV export prepared from "+exportOperations.length+" saved operation record(s).");
  };
  const exportExcel = async () => {
    if (!exportOperations.length || !exportColumns.length) { onNotice("Choose at least one field and ensure operations are visible."); return; }
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "AXIMACH";
      workbook.subject = "Selected PO component process map";
      workbook.title = exportFileBase + " Process Map";
      const sheet = workbook.addWorksheet("Process Map");
      sheet.columns = exportColumns.map(field => ({ header: field.label, key: field.key, width: Math.min(34, Math.max(14, field.label.length + 5)) }));
      sheet.addRows(exportOperations.map(op => Object.fromEntries(exportColumns.map(field => [field.key, exportValue(op, field.key)]))));
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17324D" } };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
      if (exportColumns.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: exportColumns.length } };
      const route = workbook.addWorksheet("Route Structure");
      route.columns = [
        { header: "Sequence", key: "sequence", width: 12 }, { header: "Branch", key: "branch", width: 24 },
        { header: "Relation", key: "relation", width: 15 }, { header: "Parent operation ID", key: "parentId", width: 38 },
        { header: "Parent process", key: "parentProcess", width: 28 }, { header: "Operation ID", key: "id", width: 38 },
        { header: "Process", key: "process", width: 28 }, { header: "Next process", key: "nextProcess", width: 28 },
        { header: "Next operation ID", key: "nextId", width: 38 }, { header: "Next arrow", key: "next", width: 30 }
      ];
      route.addRows(exportOperations.map(op => {
        const branch = op.branch || "Main route";
        const nextInSameRoute = exportOperations
          .filter(candidate => candidate.poLineId===op.poLineId && (candidate.branch || "Main route") === branch && candidate.sequence > op.sequence)
          .sort((a,b)=>a.sequence-b.sequence)[0];
        const parent = op.parentId ? routeOperations.find(candidate=>candidate.id===op.parentId) : undefined;
        return {
          sequence: op.sequence, branch, relation: op.relationType || "main",
          parentId: op.parentId || "", parentProcess: parent?.name || "",
          id: op.id, process: op.name,
          nextProcess: nextInSameRoute?.name || "", nextId: nextInSameRoute?.id || "",
          next: exportArrows && nextInSameRoute ? "→ " + nextInSameRoute.name : ""
        };
      }));
      route.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      route.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF17324D" } };
      route.views = [{ state: "frozen", ySplit: 1 }];
      const bytes = await workbook.xlsx.writeBuffer();
      const blob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveExportBlob(exportFileBase + "-Process-Map.xlsx", blob);
      onNotice("Excel workbook exported with selected fields, operation records and route structure.");
    } catch (error) { onNotice(error instanceof Error ? "Excel export failed: " + error.message : "Excel export failed."); }
  };
  const escapeSvg = (value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
  const buildExportSvg = () => {
    const branches=exportBranches;
    const maxNodes=Math.max(1,...branches.map(branch=>exportOperations.filter(op=>(op.branch||"Main route")===branch).length));
    const detailsCount=Math.max(1,exportColumns.filter(field=>field.key!=="operation").length);
    const cardHeight=78+detailsCount*17;
    const laneHeight=cardHeight+58;
    const width=Math.max(900,90+maxNodes*270),height=Math.max(240,115+branches.length*laneHeight);
    const safeColor=(value:string)=>/^#[0-9a-f]{6}$/i.test(value)?value:"#6fa9e5";
    const processColorFor=(operation:OperationRecord)=>safeColor(processDefinitions.find(item=>item.id===operation.processDefinitionId)?.displayColor||operation.processColor||"#6fa9e5");
    const branchColorFor=(branch:string,root?:OperationRecord)=>root?.relationType==="rework"||/rework/i.test(branch)?"#e38b45":root||branch!=="Main route"?"#4b95eb":"#5a8fc4";
    const markerId=(color:string)=>"arrow-"+color.slice(1).toLowerCase();
    const arrowColors=new Set<string>(["#4b95eb","#e38b45"]);
    for(const operation of exportOperations) arrowColors.add(operation.relationType==="rework"?"#e38b45":operation.relationType==="alternate"?"#4b95eb":processColorFor(operation));
    const markerDefinitions=[...arrowColors].map(color=>"<marker id=\""+markerId(color)+"\" markerWidth=\"9\" markerHeight=\"9\" refX=\"7\" refY=\"4.5\" orient=\"auto\"><path d=\"M0 0L9 4.5L0 9Z\" fill=\""+color+"\"/></marker>").join("");
    const svgText=(x:number,y:number,value:unknown,size=12,color="#dceefa",weight=500)=>"<text x=\""+x+"\" y=\""+y+"\" fill=\""+color+"\" font-family=\"Arial\" font-size=\""+size+"\" font-weight=\""+weight+"\">"+escapeSvg(value)+"</text>";
    const content=branches.map((branch,lane)=>{
      const rows=exportOperations.filter(op=>(op.branch||"Main route")===branch).slice().sort((a,b)=>a.sequence-b.sequence),y=85+lane*laneHeight;
      const branchRoot=rows.find(operation=>operation.parentId&&(operation.relationType==="alternate"||operation.relationType==="rework")&&routeOperations.find(parent=>parent.id===operation.parentId)?.branch!==branch);
      const parent=branchRoot?routeOperations.find(operation=>operation.id===branchRoot.parentId):undefined;
      const branchColor=branchColorFor(branch,branchRoot);
      const header=svgText(42,y-20,branch+" · "+rows.length+" STAGE(S)",11,branchColor,700);
      const branchArrow=branchRoot&&parent
        ? svgText(50,y+2,"CONNECTED FROM OP-"+String(parent.sequence).padStart(3,"0")+" · "+parent.name,10,branchColor,600)
          +"<path d=\"M320 "+(y-2)+" h42 m-8 -7 l8 7 -8 7\" stroke=\""+branchColor+"\" stroke-width=\"2.6\" fill=\"none\"/>"
          +svgText(375,y+2,(branchRoot.relationType==="rework"?"REWORK":"ALTERNATE")+" ROUTE",9,branchColor,700)
        : "";
      const cards=rows.map((op,index)=>{
        const x=42+index*270,details=exportColumns.filter(field=>field.key!=="operation");
        const processColor=processColorFor(op);
        const arrowColor=op.relationType==="rework"?"#e38b45":op.relationType==="alternate"?"#4b95eb":processColor;
        const info=details.map((field,i)=>svgText(x+12,y+75+i*17,field.label+": "+exportValue(op,field.key),10,"#a9c5d7",400)).join("");
        const arrow=exportArrows&&index<rows.length-1?"<path d=\"M"+(x+222)+" "+(y+45)+"h28 m-8 -7 l8 7 -8 7\" stroke=\""+arrowColor+"\" stroke-width=\"2.8\" fill=\"none\"/>":"";
        return arrow+"<rect x=\""+x+"\" y=\""+y+"\" width=\"220\" height=\""+cardHeight+"\" rx=\"12\" fill=\"#102c43\" stroke=\""+processColor+"\" stroke-width=\"2\"/>"+svgText(x+12,y+22,"OP-"+String(op.sequence).padStart(3,"0")+" · "+op.status,9,processColor,700)+svgText(x+12,y+48,op.name,14,"#effaff",700)+info;
      }).join("");
      return header+branchArrow+cards;
    }).join("");
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\""+width+"\" height=\""+height+"\" viewBox=\"0 0 "+width+" "+height+"\"><defs>"+markerDefinitions+"</defs><rect width=\"100%\" height=\"100%\" fill=\"#071a2b\"/>"+svgText(42,35,(selectedComponent?.partNumber||"AXIMACH")+" · "+(selectedPO?.number||"PROCESS MAP"),19,"#fff",700)+content+"</svg>";
  };
  const exportVisual = async (format:"svg"|"png") => {
    if(!exportOperations.length || !exportColumns.length){onNotice("Choose at least one field and ensure operations are visible.");return;}
    const blob=new Blob([buildExportSvg()],{type:"image/svg+xml;charset=utf-8"});
    if(format==="svg"){saveExportBlob(exportFileBase+".svg",blob);onNotice("SVG process map exported from saved records.");return;}
    const url=URL.createObjectURL(blob);
    try {
      const img=new Image();
      await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("Could not render process map PNG."));img.src=url;});
      const canvas=document.createElement("canvas");canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Canvas rendering is unavailable.");
      ctx.drawImage(img,0,0);
      const png=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("PNG export failed.")),"image/png"));
      saveExportBlob(exportFileBase+".png",png);onNotice("PNG process map exported from saved records.");
    } catch(error){onNotice(error instanceof Error?error.message:"Could not export PNG.");}
    finally{URL.revokeObjectURL(url);}
  };
  const exportPowerPoint = async () => {
    if(!exportOperations.length||!exportColumns.length){onNotice("Choose at least one field and ensure operations are visible.");return;}
    try {
       const PptxGenJS = (await import("pptxgenjs")).default;
       const deck = new PptxGenJS();
      deck.layout = "LAYOUT_WIDE";
      deck.author = "AXIMACH";
      deck.subject = "Selected AXIMACH Process Map";
      deck.title = exportFileBase+" Process Map";
      deck.company = "AXIMACH";
      const navy = "102A45";
      const cyan = "4DBBD5";
      const pale = "EAF2F8";
      const first = deck.addSlide();
      first.background = { color: navy };
      first.addText("AXIMACH · PROCESS MAP", {x:0.55,y:0.55,w:12.2,h:0.55,fontFace:"Aptos Display",fontSize:25,bold:true,color:"FFFFFF",margin:0});
      first.addText((selectedComponent?.partNumber||"Component")+" · "+(selectedComponent?.name||"") , {x:0.58,y:1.35,w:8.6,h:0.35,fontSize:16,bold:true,color:"A9DDEA",margin:0});
      first.addText("Company: "+(selectedCompany?.name||"—")+"    PO: "+(selectedPO?.number||"—")+"    Operations: "+exportOperations.length, {x:0.58,y:1.92,w:11.8,h:0.35,fontSize:11,color:"DFEAF3",margin:0});
      first.addShape(deck.ShapeType.line,{x:0.58,y:2.48,w:11.9,h:0,line:{color:cyan,width:2}});
      first.addText("Export scope: "+exportScopeLabel,{x:0.58,y:2.78,w:11.6,h:0.35,fontSize:12,color:"FFFFFF",margin:0});
      first.addText("Fields selected: "+exportColumns.map(field=>field.label).join(" · "),{x:0.58,y:3.35,w:11.6,h:1.35,fontSize:11,color:"DFEAF3",breakLine:false,fit:"shrink",margin:0.04,valign:"top"});
      first.addText("Generated from saved AXIMACH operation records.",{x:0.58,y:6.85,w:11.5,h:0.25,fontSize:9,color:"A9C3D7",margin:0});
      const mapSlide = deck.addSlide();
      mapSlide.background = { color: "071A2B" };
      mapSlide.addText("SELECTED ROUTE DIAGRAM", {x:0.45,y:0.25,w:12.2,h:0.35,fontFace:"Aptos Display",fontSize:17,bold:true,color:"FFFFFF",margin:0});
      const svgBase64 = btoa(unescape(encodeURIComponent(buildExportSvg())));
      mapSlide.addImage({data:"data:image/svg+xml;base64,"+svgBase64,x:0.35,y:0.72,w:12.6,h:6.5});
      const headers=exportColumns.map(field=>field.label);
      const rowsPerSlide=9;
      for(let offset=0;offset<exportOperations.length;offset+=rowsPerSlide){
        const page=deck.addSlide();
        page.background={color:"F5F8FC"};
        page.addText("PROCESS MAP · "+(selectedPO?.number||"PO")+" · "+(selectedComponent?.partNumber||"Component"),{x:0.45,y:0.28,w:12.3,h:0.34,fontFace:"Aptos Display",fontSize:16,bold:true,color:navy,margin:0});
        const chunk=exportOperations.slice(offset,offset+rowsPerSlide);
        const tableRows=[headers,...chunk.map(op=>exportColumns.map(field=>String(exportValue(op,field.key)??"")))].map(row=>row.map(text=>({text})));
        const widths=exportColumns.map(()=>12.1/Math.max(1,exportColumns.length));
        page.addTable(tableRows,{x:0.45,y:0.9,w:12.1,h:5.85,border:{type:"solid",color:"D4DEE8",pt:0.6},fontFace:"Aptos",fontSize:Math.max(7,Math.min(10,12-exportColumns.length/2)),color:"1A2B40",rowH:0.48,colW:widths,margin:0.05,breakLine:false,fill:{color:"FFFFFF"},bold:false,paraSpaceAfterPt:0,header:{bold:true,color:"FFFFFF",fill:navy,fontSize:9}} as any);
        page.addText("Operations "+(offset+1)+"–"+(offset+chunk.length)+" of "+exportOperations.length,{x:0.48,y:7.05,w:12,h:0.18,fontSize:8,color:"66788C",margin:0});
      }
      await deck.writeFile({fileName:exportFileBase+"-Process-Map.pptx"});
      onNotice("PowerPoint exported with "+exportOperations.length+" operation(s) and "+exportColumns.length+" selected field(s).");
    } catch(error) {
      onNotice(error instanceof Error?"PowerPoint export failed: "+error.message:"PowerPoint export failed.");
    }
  };
  const printExport = () => {
    if (!exportOperations.length || !exportColumns.length) { onNotice("Choose at least one field and ensure operations are visible."); return; }
    const win = window.open("", "_blank");
    if (!win) { onNotice("Allow pop-ups to print / save the selected process map as PDF."); return; }
    const esc = (value:unknown) => String(value ?? "").replace(/[&<>"]/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;" }[ch] || ch));
    const svgUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(buildExportSvg());
    const header = exportColumns.map(field => "<th>" + esc(field.label) + "</th>").join("");
    const rows = exportOperations.map(op => "<tr>" + exportColumns.map(field => "<td>" + esc(exportValue(op, field.key)) + "</td>").join("") + "</tr>").join("");
    win.document.open();
    win.document.write("<!doctype html><html><head><title>AXIMACH Process Map</title><style>@page{size:landscape;margin:12mm}body{font:10px Arial;color:#17283b;margin:0}h1{font-size:20px;margin:0 0 6px}.meta{margin:0 0 14px;color:#52657a}.diagram{border:1px solid #ccd7e2;padding:8px;margin:0 0 14px;page-break-inside:avoid}.diagram img{display:block;width:100%;height:auto;max-height:65vh;object-fit:contain}table{border-collapse:collapse;width:100%;font-size:9px;page-break-inside:auto}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{border:1px solid #c8d2de;padding:5px;text-align:left;vertical-align:top}th{background:#17324d;color:#fff}small{color:#586b7c}</style></head><body><h1>AXIMACH · PROCESS MAP</h1><p class=\"meta\">" + esc(selectedCompany?.name || "") + " · " + esc(selectedPO?.number || "") + " · " + esc(selectedComponent?.partNumber || "") + " · " + exportOperations.length + " operations · " + exportColumns.length + " selected fields</p><div class=\"diagram\"><img src=\"" + svgUri + "\" alt=\"Selected process route diagram\"/></div><table><thead><tr>" + header + "</tr></thead><tbody>" + rows + "</tbody></table><p><small>Generated from saved AXIMACH operation records. Selected scope, fields and arrow setting applied.</small></p><script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script></body></html>");
    win.document.close();
    win.focus();
  };


  // Restore the first valid saved route automatically. A blank selector must
  // never hide a real PO-line job, route graph, or job-finished control.
  useEffect(() => {
    // Keep an explicitly linked PO, component, operation or vendor selection
    // authoritative. The generic restore must not replace it with the first PO.
    if (initialContext?.poId || initialContext?.poLineId || initialContext?.componentId || initialContext?.operationId || initialContext?.vendorId) return;
    if (!companies.length) {
      if (companyId) { setCompanyId(""); setPoId(""); setPoLineId(""); }
      return;
    }
    const company = companies.find(item => item.id === companyId) || companies[0];
    if (company.id !== companyId) { setCompanyId(company.id); setPoId(""); setPoLineId(""); return; }

    const validOrders = purchaseOrders.filter(item => item.companyId === company.id);
    const order = validOrders.find(item => item.id === poId) || validOrders[0];
    const nextPoId = order?.id || "";
    if (nextPoId !== poId) { setPoId(nextPoId); setPoLineId(""); return; }

    const validLines = (order?.lines || []).filter(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt));
    const line = validLines.find(item => item.id === poLineId) || validLines[0];
    const nextLineId = line?.id || "";
    if (nextLineId !== poLineId) setPoLineId(nextLineId);
  }, [companies, purchaseOrders, companyId, poId, poLineId, initialContext?.poId, initialContext?.poLineId, initialContext?.componentId, initialContext?.operationId, initialContext?.vendorId]);

  useEffect(() => {
    const current = routeOperations.find(operation => operation.id === selectedOperationId);
    const next = current || routeOperations[0];
    if ((next?.id || "") !== selectedOperationId) setSelectedOperationId(next?.id || "");
  }, [routeOperations, selectedOperationId]);

  useEffect(() => {
    if (!simulationActive) return;
    if (!simulationOperations.length || simulationIndex >= simulationOperations.length - 1) {
      setSimulationActive(false);
      return;
    }
    const timer = window.setTimeout(() => setSimulationIndex(index => index + 1), 950);
    return () => window.clearTimeout(timer);
  }, [simulationActive, simulationIndex, simulationOperations.length]);

  useEffect(() => {
    if (!simulationActive || simulationIndex < 0) return;
    const stepOperation = simulationOperations[simulationIndex];
    if (stepOperation) setSelectedOperationId(stepOperation.id);
  }, [simulationActive, simulationIndex, simulationOperations]);

  const startRouteSimulation = () => {
    if (!simulationOperations.length) { onNotice("No saved operations in this route scope. Add a real operation from Process Directory before simulating."); return; }
    setVisualStyle("sphere");
    setRouteView("3d");
    setSimulationIndex(0);
    setSimulationActive(true);
  };

  const changeSelection = (nextCompanyId: string) => {
    setCompanyId(nextCompanyId);
    const nextPO = purchaseOrders.find(p => p.companyId === nextCompanyId);
    setPoId(nextPO?.id || "");
    const firstLine = nextPO?.lines.find(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt));
    setPoLineId(firstLine?.id || "");
    setSelectedOperationId("");
  };
  const changePO = (nextPoId: string) => {
    const next = purchaseOrders.find(p => p.id === nextPoId);
    setPoId(nextPoId);
    setCompanyId(next?.companyId || companyId);
    const firstLine = next?.lines.find(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt));
    setPoLineId(firstLine?.id || "");
    setSelectedOperationId("");
  };
  const changeLine = (nextLineId: string) => { setPoLineId(nextLineId); setSelectedOperationId(""); setSearch(""); setShowEditor(false); };

  const startAddSubprocess = (parentId: string) => {
    setShowAddMenu(false);
    const parent = routeOperations.find(operation => operation.id === parentId);
    if (!parent) return;
    const base = blankOperation(selectedLine);
    base.processDefinitionId = parent.processDefinitionId || processDefinitions.find(item => item.processType === parent.name && item.category === parent.category)?.id || "";
    base.name = parent.name;
    base.category = parent.category;
    base.processColor = parent.processColor || processDefinitions.find(item => item.id === base.processDefinitionId)?.displayColor || DEFAULT_PROCESS_COLOR;
    base.subcategory = "";
    base.processSubcategoryId = "";
    base.vendorId = parent.vendorId;
    base.executionType = parent.executionType || "Outsourced";
    base.branch = parent.branch || "Main route";
    setDraft({ ...base, parentId, relationType:"subprocess" });
    setSelectedOperationId(parentId);
    setEditingId("");
    setShowEditor(true);
    onNotice("Add a sub-process under " + parent.name + ". The parent vendor is preselected; you can keep or change it.");
  };

  const startAddDefinition = (definitionId: string) => {
    const definition = processDefinitions.find(item => item.id === definitionId);
    if (!definition || !selectedPO || !selectedLine || !selectedComponent) {
      onNotice("Select a saved PO component line before adding a Process Directory stage.");
      return;
    }
    const base = blankOperation(selectedLine);
    base.processDefinitionId = definition.id;
    base.name = definition.processType;
    base.category = definition.category;
    base.vendorId = definition.vendorIds?.[0] || "";
    base.subcategory = "";
    base.processColor = definition.displayColor || DEFAULT_PROCESS_COLOR;
    setShowAddMenu(false);
    setDraft(base);
    setEditingId("");
    setSearch("");
    setSimulationActive(false);
    setSimulationIndex(0);
    setShowEditor(true);
    onNotice(definition.processType + " is selected from Process Directory. Save it to create the real operation for this PO component line.");
  };

  const startAdd = (branch = false, transport = false) => {
    setShowAddMenu(false);
    if (!selectedPO || !selectedLine || !selectedComponent) {
      onNotice("Select a saved company, purchase order and PO component line first. AXIMACH will then link every operation to that line.");
      return;
    }
    const base = blankOperation(selectedLine);
    if (transport) { base.name = "Transport / handover"; base.category = "Logistics"; base.branch = "Main route"; }
    if (branch && activeOperation) { base.branch = "Rework · OP-" + String(activeOperation.sequence).padStart(3,"0"); base.name = "Rework operation"; base.parentId = activeOperation.id; base.relationType = "rework"; base.costIncluded = false; }
    setDraft(base);
    setEditingId("");
    setSearch("");
    setSimulationActive(false);
    setSimulationIndex(0);
    setShowEditor(true);
  };
  const startAddBranch = (kind: "alternate" | "rework", anchorId?: string) => {
    setShowAddMenu(false);
    const anchor = routeOperations.find(operation => operation.id === (anchorId || activeOperation?.id));
    if (!selectedPO || !selectedLine || !selectedComponent || !anchor) { onNotice("Select the exact process node where the alternate or rework branch must connect."); return; }
    const base = blankOperation(selectedLine);
    base.processDefinitionId = anchor.processDefinitionId || "";
    base.processColor = processDefinitions.find(definition=>definition.id===anchor.processDefinitionId)?.displayColor || anchor.processColor || DEFAULT_PROCESS_COLOR;
    base.branch = (kind === "alternate" ? "Alternate route" : "Rework") + " · OP-" + String(anchor.sequence).padStart(3, "0") + " · " + anchor.name;
    base.name = anchor.name;
    base.category = anchor.category;
    base.vendorId = anchor.vendorId;
    base.executionType = anchor.executionType || "Outsourced";
    base.parentId = anchor.id;
    base.relationType = kind;
    base.subcategory = "";
    base.processSubcategoryId = "";
    base.costIncluded = false;
    setDraft(base);
    setSelectedOperationId(anchor.id);
    setEditingId("");
    setShowEditor(true);
    onNotice((kind === "alternate" ? "Alternate route" : "Rework branch") + " will connect from " + anchor.name + ". It is excluded from Process Cost until you include it in costing.");
  };

  const startAddBranchStep = () => {
    setShowAddMenu(false);
    const anchor = activeOperation;
    if (!anchor || !anchor.parentId || (anchor.relationType !== "alternate" && anchor.relationType !== "rework")) {
      onNotice("Select an operation already inside an alternate or rework branch first."); return;
    }
    const base = blankOperation(selectedLine);
    base.processDefinitionId = anchor.processDefinitionId || processDefinitions.find(item => item.processType === anchor.name && item.category === anchor.category)?.id || "";
    base.name = anchor.name;
    base.processColor = anchor.processColor || processDefinitions.find(item => item.id === base.processDefinitionId)?.displayColor || DEFAULT_PROCESS_COLOR;
    base.branch = anchor.branch;
    base.category = anchor.category;
    base.subcategory = "";
    base.processSubcategoryId = "";
    base.vendorId = anchor.vendorId;
    base.executionType = anchor.executionType || "Outsourced";
    // Keep each added branch step linked to the immediately preceding step,
    // while retaining the same branch label and relation type for lane grouping.
    base.parentId = anchor.id;
    base.relationType = anchor.relationType;
    base.costIncluded = false;
    setDraft(base);
    setSelectedOperationId(anchor.id);
    setEditingId("");
    setShowEditor(true);
    onNotice("New step will be added to the same branch connected to its original process node.");
  };

  const editActive = (operationId?: string) => {
    const targetOperation = operationId ? routeOperations.find(op=>op.id===operationId) : activeOperation;
    if (!targetOperation) return;
    setSelectedOperationId(targetOperation.id);
    setDraft({
      name: targetOperation.name, category: targetOperation.category, processDefinitionId: targetOperation.processDefinitionId || processDefinitions.find(item=>item.processType===targetOperation.name&&item.category===targetOperation.category)?.id || "", machine: targetOperation.machine, vendorId: targetOperation.vendorId, executionType:targetOperation.executionType||"Outsourced", toleranceCategory:targetOperation.toleranceCategory||"Standard", inspectionRequired:Boolean(targetOperation.inspectionRequired),
      status: targetOperation.status, plannedStart: targetOperation.plannedStart, plannedEnd: targetOperation.plannedEnd, actualStart: targetOperation.actualStart || "", actualEnd: targetOperation.actualEnd || "",
      quantity: targetOperation.quantity, completed: targetOperation.completed, accepted: targetOperation.accepted, rejected: targetOperation.rejected,
      ratePerPart: targetOperation.ratePerPart, processCostTotal: targetOperation.quantity * targetOperation.ratePerPart, actualRatePerPart: targetOperation.actualRatePerPart || 0, transportVendorId: targetOperation.transportVendorId || "", transportFrom:targetOperation.transportFrom||"",transportTo:targetOperation.transportTo||"",transportVehicleType:targetOperation.transportVehicleType||"",transportRouteId:targetOperation.transportRouteId||"", transportCost: targetOperation.transportCost, transportPickup: targetOperation.transportPickup,
      transportDelivery: targetOperation.transportDelivery, qualityNotes: targetOperation.qualityNotes, inspectionResult: targetOperation.inspectionResult || "", notes: targetOperation.notes, branch: targetOperation.branch, parentId:targetOperation.parentId||"", relationType:targetOperation.relationType, costIncluded:targetOperation.costIncluded ?? (targetOperation.relationType !== "alternate" && targetOperation.relationType !== "rework"), paymentStatus:targetOperation.paymentStatus||"Unpaid", paidAmount:paymentTotalFor(targetOperation), paymentReference:targetOperation.paymentReference||"", subcategory:targetOperation.subcategory||"", processSubcategoryId:targetOperation.processSubcategoryId || processSubcategoryIdFor(processDefinitions.find(item=>item.id===targetOperation.processDefinitionId) || processDefinitions.find(item=>item.processType===targetOperation.name&&item.category===targetOperation.category),targetOperation.subcategory||""), processColor:targetOperation.processColor || processDefinitions.find(item=>item.id===targetOperation.processDefinitionId)?.displayColor || DEFAULT_PROCESS_COLOR
    });
    setEditingId(targetOperation.id); setShowEditor(true);
  };
  const saveOperation = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line first."); return; }
    if (!draft.category.trim()) { onNotice("Select or enter a process category."); return; }
    if (!draft.name.trim()) { onNotice("Select or enter a process type."); return; }
    if (draft.vendorId && !vendors.some(vendor => vendor.id === draft.vendorId)) { onNotice("The selected vendor is missing or archived. Choose an active Vendor Directory record."); return; }
    if (draft.executionType === "Outsourced" && selectedProcessDefinition?.vendorIds?.length && draft.vendorId && !selectedProcessDefinition.vendorIds.includes(draft.vendorId)) { onNotice("The selected vendor is not assigned to this Process Directory definition. Choose an assigned vendor or update the Process Directory vendor links."); return; }
    if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) { onNotice("Target/end date cannot be before planned start date."); return; }
    if (draft.actualStart && draft.actualEnd && draft.actualEnd < draft.actualStart) { onNotice("Actual end date cannot be before actual start date."); return; }
    const operationQuantities=[draft.quantity,draft.completed,draft.accepted,draft.rejected];
    if(operationQuantities.some(value=>!Number.isSafeInteger(Number(value))||Number(value)<0)||draft.quantity<1){onNotice("Operation, completed, accepted and rejected quantities must be whole numbers; operation quantity must be at least 1.");return;}
    if(draft.completed>draft.quantity){onNotice("Completed quantity cannot exceed the operation quantity.");return;}
    if (draft.status === "Complete" && draft.completed !== draft.quantity) { onNotice("A process cannot be marked Complete until its completed quantity equals the operation quantity. Record the completed quantity first."); return; }
    if (draft.accepted + draft.rejected > draft.completed) { onNotice("Accepted plus rejected quantity cannot exceed completed quantity."); return; }
    if (draft.paymentStatus === "Paid" && !(Number(draft.paidAmount) > 0)) { onNotice("Enter the actual amount paid before marking this operation Paid."); return; }
    const previousOperation = operations.find(op=>op.id===editingId);
    const previousPaidTotal = previousOperation ? paymentTotalFor(previousOperation) : 0;
    const nextPaidTotal = Math.max(0,Number(draft.paidAmount)||0);
    if (nextPaidTotal + 0.000001 < previousPaidTotal) { onNotice("Recorded payment totals cannot be reduced. Keep the previous total and add a separate correction record through the finance ledger."); return; }
    const stamp = nowIso();
    const operationId = editingId || makeId("operation");
    const proposedProcessDefinitionId = makeId("process-definition");
    update(current => {
      const currentRoute = current.operations.filter(op => op.poLineId === selectedLine.id && op.poId === selectedPO.id && op.componentId === selectedComponent.id && !op.deletedAt);
      const old = current.operations.find(op => op.id === operationId);
      const currentDefinitions = activeRows(current.processDefinitions);
      const resolvedDefinition = selectedProcessDefinition || resolveProcessDefinition(currentDefinitions, draft.processDefinitionId, draft.name.trim(), draft.category.trim());
      const processDefinition: ProcessDefinitionRecord | undefined = resolvedDefinition || (draft.name.trim() && draft.category.trim() ? {
        id: proposedProcessDefinitionId, processType: draft.name.trim(), category: draft.category.trim(),
        subcategories: [], subcategoryIds: [], vendorIds: [], displayColor: draft.processColor || DEFAULT_PROCESS_COLOR,
        notes: "Created from Process Map operation editor.", createdAt: stamp, updatedAt: stamp
      } : undefined);
      const nextProcessDefinitions = processDefinition
        ? resolvedDefinition
          ? current.processDefinitions.map(definition => definition.id === processDefinition.id
              ? { ...definition, displayColor: draft.processColor || definition.displayColor || DEFAULT_PROCESS_COLOR, updatedAt: stamp }
              : definition)
          : [...current.processDefinitions, processDefinition]
        : current.processDefinitions;
      const next: OperationRecord = {
        id: operationId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id,
        sequence: old?.sequence ?? (Math.max(0, ...currentRoute.map(op => op.sequence)) + 10),
        ...draft, processDefinitionId: processDefinition?.id || undefined,
        processSubcategoryId: draft.processSubcategoryId || processSubcategoryIdFor(processDefinition, draft.subcategory) || undefined,
        actualEnd: draft.status === "Complete" ? (draft.actualEnd || stamp.slice(0,10)) : draft.actualEnd, paidAmount: nextPaidTotal, vendorId: draft.vendorId || "", actualRatePerPart: draft.actualRatePerPart || 0, transportVendorId: draft.transportVendorId || "",
        createdAt: old?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined,
        parentId: draft.parentId || old?.parentId || (draft.branch !== "Main route" ? activeOperation?.id || "" : ""), relationType: draft.relationType || old?.relationType
      };
      const existingPayments = current.paymentTransactions.filter(payment=>payment.operationId===operationId&&!payment.deletedAt);
      const ledgerTotal = existingPayments.reduce((sum,payment)=>sum+Math.max(0,Number(payment.amount)||0),0);
      const legacyTotal = existingPayments.length?0:Math.max(0,Number(old?.paidAmount)||0);
      const paymentRecords = [...current.paymentTransactions];
      if (!existingPayments.length && legacyTotal>0) {
        paymentRecords.push({id:makeId("payment"),operationId,poId:selectedPO.id,poLineId:selectedLine.id,componentId:selectedComponent.id,amount:legacyTotal,paidAt:old?.updatedAt||stamp,reference:old?.paymentReference||"",notes:"Opening balance carried forward from the earlier operation payment total.",createdAt:stamp,updatedAt:stamp});
      }
      const recordedTotal=ledgerTotal+legacyTotal;
      const paymentDelta=Math.max(0,nextPaidTotal-recordedTotal);
      if(paymentDelta>0) paymentRecords.push({id:makeId("payment"),operationId,poId:selectedPO.id,poLineId:selectedLine.id,componentId:selectedComponent.id,amount:paymentDelta,paidAt:stamp,reference:draft.paymentReference.trim(),notes:"Additional payment recorded from Process Plan.",createdAt:stamp,updatedAt:stamp});
      return { ...current, operations: [...current.operations.filter(op => op.id !== next.id), next], processDefinitions: nextProcessDefinitions, paymentTransactions: paymentRecords };
    });
    setSelectedOperationId(operationId);
    setShowEditor(false); setEditingId("");
    onNotice(editingId ? "Operation updated and linked to its PO line/component ID." : "Operation saved against the selected PO line. Cost and dates remain separate for this component.");
  };
  const deleteOperation = (target: OperationRecord) => {
    const descendants = new Set<string>();
    let frontier = [target.id];
    while (frontier.length) {
      const nextFrontier: string[] = [];
      for (const parentId of frontier) {
        for (const child of routeOperations) {
          if (child.parentId === parentId && !descendants.has(child.id)) {
            descendants.add(child.id);
            nextFrontier.push(child.id);
          }
        }
      }
      frontier = nextFrontier;
    }
    const ids = new Set([target.id, ...descendants]);
    const count = ids.size;
    if (!window.confirm("Delete process " + target.name + "? This will archive " + count + " process record(s), including linked sub-process / branch descendants. Quotations are archived; payment, inspection and production history are retained for audit.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      operations: current.operations.map(item => ids.has(item.id) ? { ...item, deletedAt: stamp, updatedAt: stamp } : item),
      quotations: current.quotations.map(quote => ids.has(quote.operationId) && !quote.deletedAt ? { ...quote, deletedAt: stamp, updatedAt: stamp } : quote)
    }));
    setSelectedOperationId("");
    setSelectedOperationIds(current => current.filter(id => !ids.has(id)));
    setShowEditor(false);
    setEditingId("");
    onNotice("Deleted " + count + " process record(s). Related quotation history was archived; payment and inspection history was retained.");
  };

  const finishSelectedOperations = () => {
    const ids = new Set(selectedVisibleOperations.map(op => op.id));
    if (!ids.size) { onNotice("Select one or more visible operations to finish."); return; }
    const stamp = nowIso();
    update(current => {
      const nextOperations = current.operations.map(op => ids.has(op.id) ? { ...op, status: "Complete" as LifecycleStatus, completed: Math.max(op.completed || 0, op.quantity || 0), actualEnd: op.actualEnd || stamp, updatedAt: stamp } : op);
      const touchedLines = new Set(selectedVisibleOperations.map(op => op.poId + "::" + op.poLineId));
      const nextPurchaseOrders = current.purchaseOrders.map(order => ({
        ...order,
        lines: order.lines.map(line => {
          if (!touchedLines.has(order.id + "::" + line.id)) return line;
          const lineOperations = nextOperations.filter(op => op.poId === order.id && op.poLineId === line.id && !op.deletedAt && ((op.branch || "Main route") === "Main route" || op.costIncluded !== false));
          if (!lineOperations.length || !lineOperations.every(op => op.status === "Complete")) return line;
          return { ...line, jobStatus: "Finished" as const, jobFinishedAt: stamp, updatedAt: stamp };
        })
      }));
      return { ...current, operations: nextOperations, purchaseOrders: nextPurchaseOrders };
    });
    setSelectedOperationIds([]);
    onNotice("Marked " + ids.size + " selected process operation(s) Complete. A PO component job becomes Finished only when every saved operation on that route is Complete; inspection acceptance remains separate.");
  };

  const updateOperation = (id: string, patch: Partial<OperationRecord>) => {
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(op => op.id === id ? { ...op, ...patch, updatedAt: stamp } : op) }));
  };
  const setBranchCostIncluded = (branch: string, include: boolean, poLineId?:string) => {
    const branchIds = new Set(routeOperations.filter(op => (op.branch || "Main route") === branch && (!poLineId || op.poLineId===poLineId)).map(op => op.id));
    if (!branchIds.size) return;
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(op => branchIds.has(op.id) ? { ...op, costIncluded: include, updatedAt: stamp } : op) }));
    onNotice(include
      ? branch + " activated: its process costs and transport legs anchored to its steps are now included in costing."
      : branch + " excluded: its process costs and anchored transport legs are removed from active costing.");
  };
  const openTransportEditor = (leg?: ComponentTransportLegRecord) => {
    setEditingTransportLegId(leg?.id || "");
    setTransportRouteId(leg?.routeId || transportRoutes.find(route=>route.active!==false)?.id || "");
    setTransportTripCount(String(leg?.tripCount || 1));
    setTransportAnchorOperationId(leg?.anchorOperationId || activeOperation?.id || "");
    setTransportPlacement(leg?.placement || (activeOperation && (activeOperation.branch || "Main route") !== "Main route" ? "after" : leg?.anchorOperationId ? "after" : "start"));
    setTransportLegNotes(leg?.notes || "");
    setShowTransportEditor(true);
    setShowEditor(false);
  };
  const closeTransportEditor = () => { setShowTransportEditor(false); setEditingTransportLegId(""); };
  const saveTransportLeg = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line before adding transport."); return; }
    if (transportPlacement !== "start" && !routeOperations.some(operation=>operation.id===transportAnchorOperationId)) { onNotice("Select the process operation to place this transport before or after."); return; }
    const activeIsBranch = Boolean(activeOperation && (activeOperation.branch || "Main route") !== "Main route");
    if (transportPlacement === "start" && activeIsBranch) { onNotice("Transport for an alternate or rework branch must be anchored to a process step in that branch. This keeps its cost excluded until the branch is used."); return; }
    if (!selectedTransportDirectoryRoute) { onNotice("Select a saved route from Transport Directory, or add one there first."); return; }
    if (!vendors.some(vendor=>vendor.id===selectedTransportDirectoryRoute.vendorId)) { onNotice("The selected route vendor is missing or archived. Repair the vendor link in Transport Directory."); return; }
    if (!Number.isFinite(Number(selectedTransportDirectoryRoute.fixedAmount)) || Number(selectedTransportDirectoryRoute.fixedAmount)<0) { onNotice("The selected Transport Directory route has an invalid fixed rate. Correct it in Transport Directory before assigning it."); return; }
    const existingLegForEdit = editingTransportLegId ? componentTransportLegs.find(leg=>leg.id===editingTransportLegId) : undefined;
    if(selectedTransportDirectoryRoute.active===false&&existingLegForEdit?.routeId!==selectedTransportDirectoryRoute.id){onNotice("This Transport Directory route is inactive. Activate it before assigning it to a new transport entry.");return;}
    const tripCount = Number(transportTripCount);
    if (!Number.isInteger(tripCount) || tripCount < 1) { onNotice("Enter a whole-number trip count of at least 1."); return; }
    const stamp = nowIso();
    const legId = editingTransportLegId || makeId("component-transport");
    const old = componentTransportLegs.find(leg => leg.id === legId);
    const record: ComponentTransportLegRecord = {
      id: legId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id,
      sequence: old?.sequence ?? (Math.max(0, ...componentTransportLegs.map(leg => leg.sequence)) + 1),
      routeId: selectedTransportDirectoryRoute.id, vendorId: selectedTransportDirectoryRoute.vendorId,
      fromLocation: selectedTransportDirectoryRoute.fromLocation, toLocation: selectedTransportDirectoryRoute.toLocation,
      tripDirection: selectedTransportDirectoryRoute.tripDirection, vehicleType: selectedTransportDirectoryRoute.vehicleType,
      fixedAmount: selectedTransportDirectoryRoute.fixedAmount, tripCount,
      anchorOperationId: transportPlacement === "start" ? "" : transportAnchorOperationId, placement: transportPlacement,
      notes: transportLegNotes.trim(),
      createdAt: old?.createdAt || stamp, updatedAt: stamp
    };
    update(current => ({ ...current, transportLegs: [record, ...current.transportLegs.filter(leg => leg.id !== record.id)] }));
    closeTransportEditor();
    onNotice("Transport entry saved for " + selectedComponent.partNumber + ". " + tripCount + " trip(s) × " + money(record.fixedAmount) + " = " + money(record.fixedAmount * tripCount) + ". This is separate from Process Cost.");
  };
  const editTransportLeg = (leg: ComponentTransportLegRecord) => openTransportEditor(leg);
  const archiveTransportLeg = (leg: ComponentTransportLegRecord) => {
    if (!window.confirm("Remove this transport entry from the component total? Its saved record will be archived, not erased.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, transportLegs: current.transportLegs.map(item => item.id === leg.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item) }));
    onNotice("Transport entry archived. Process operation history was not changed.");
  };

  const moveOperation = (id: string, direction: -1 | 1) => {
    const current = routeOperations.find(op=>op.id===id);
    if(!current)return;
    const sameRoute=routeOperations.filter(op=>op.poLineId===current.poLineId&&(op.branch||"Main route")===(current.branch||"Main route")).sort((a,b)=>a.sequence-b.sequence);
    const index=sameRoute.findIndex(op=>op.id===id);
    const neighbor=sameRoute[index+direction];
    if (!neighbor) return;
    const stamp = nowIso();
    update(data => ({ ...data, operations: data.operations.map(op =>
      op.id === current.id ? { ...op, sequence: neighbor.sequence, updatedAt: stamp } :
      op.id === neighbor.id ? { ...op, sequence: current.sequence, updatedAt: stamp } : op
    ) }));
    onNotice("Operation sequence updated for this PO component route.");
  };

  const archiveOperation = (op: OperationRecord) => {
    if (!window.confirm("Archive this operation? Its history and quotations will be retained.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(item => item.id === op.id ? { ...item, deletedAt: stamp, updatedAt: stamp } : item), quotations: current.quotations.map(q => q.operationId === op.id && !q.deletedAt ? { ...q, deletedAt: stamp, updatedAt: stamp } : q) }));
    setSelectedOperationId(""); onNotice("Operation archived. Linked quotation history was retained as archived history.");
  };

  const finishJob = () => {
    if (!selectedPO || !selectedLine) return;
    const unfinishedCount = selectedLineOperations.filter(operation => operation.status !== "Complete").length;
    const confirmation = unfinishedCount
      ? unfinishedCount + " route operation(s) are not marked Complete. Mark the PO job Finished anyway? This only changes the PO-line job status; every operation status and quantity will remain unchanged."
      : "Mark this PO component line as Job Finished? This is a separate final job status and will not change the operation records.";
    if (!window.confirm(confirmation)) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      purchaseOrders: current.purchaseOrders.map(po => po.id !== selectedPO.id ? po : ({
        ...po,
        updatedAt: stamp,
        lines: po.lines.map(line => line.id === selectedLine.id ? { ...line, jobStatus: "Finished", jobFinishedAt: stamp } : line)
      }))
    }));
    onNotice(unfinishedCount ? "Job marked Finished independently. " + unfinishedCount + " unfinished route operation(s) and their quantities were left unchanged." : "Job marked Finished. Individual process operation statuses and quantities were left unchanged.");
  };

  const reopenJob = () => {
    if (!selectedPO || !selectedLine) return;
    if (!window.confirm("Reopen this job? The saved operation completion history will remain unchanged.")) return;
    const stamp = nowIso();
    update(current => ({
      ...current,
      purchaseOrders: current.purchaseOrders.map(po => po.id !== selectedPO.id ? po : ({
        ...po,
        updatedAt: stamp,
        lines: po.lines.map(line => line.id === selectedLine.id ? { ...line, jobStatus: "In progress", jobFinishedAt: undefined } : line)
      }))
    }));
    onNotice("Job reopened. Existing process completion records were retained.");
  };

  const componentQuotes = data.quotations.filter(q => q.poLineId === poLineId && q.componentId === selectedComponent?.id && !q.deletedAt);
  const selectedVendor = vendors.find(v => v.id === activeOperation?.vendorId);
  const selectedOperationQuotations = componentQuotes.filter(q => q.operationId === activeOperation?.id);
  useEffect(() => {
    if (activeOperation?.id && selectedOperationPanelRef.current) selectedOperationPanelRef.current.open = true;
  }, [activeOperation?.id]);
  const deliveryState = !finalDelivery ? "No delivery date" : allDone ? "Route complete" : lateOps.length ? "At risk" : "Scheduled";
  const tab = (id: string, title: string, Icon: typeof Workflow) => <button key={id} className={"route-tab " + (id === "process-map" ? "route-tab-current" : "")} onClick={() => id === "process-map" ? undefined : onSelectModule(id === "components" ? "components" : id === "purchasing" ? "purchasing" : id === "inventory" ? "inventory" : id === "costing" ? "costing" : id === "documents" ? "engineering-change" : id === "history" ? "reports" : "quality")}><Icon size={14}/>{title}</button>;

  return <section className="workspace-page linked-process-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED DATA CONNECTED" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO DATA · LOCAL UNTIL SERVER SYNC"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / LINKED PROCESS ROUTE</div><h1>Process Map<span>.</span></h1><p>Choose existing master records once; operation schedules, rates, vendor assignments, quality and quotations attach to the selected PO component line.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendors</button><button type="button" className="button-primary" aria-label="Add operation ▾" aria-haspopup="menu" aria-expanded={showAddMenu} onClick={toggleAddMenu}><Plus size={15}/> Add Operation <span aria-hidden="true">▾</span></button></div></div>
    <div className="linked-master-selectors">
      <SearchablePicker id="route-company" label="Company" value={companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={changeSelection}/>
      <div className="route-master-picker"><SearchablePicker id="route-po" label="Purchase order" value={poId} placeholder="Type PO number…" options={companyOrders.map(po=>({id:po.id,label:po.number+" · "+po.status}))} onChange={changePO}/>{companyId&&!companyOrders.length&&<button type="button" onClick={()=>onSelectModule("purchasing")}>Add PO</button>}</div>
      <div className="route-master-picker"><SearchablePicker id="route-component-line" label="PO component line" value={poLineId} placeholder="Type part number or name…" options={poLines.map(line=>{const component=components.find(item=>item.id===line.componentId);const part=componentParts.find(item=>item.id===line.partId);return {id:line.id,label:(component?component.partNumber+" · "+component.name:"Missing component")+(part?" · "+(part.partNumber?part.partNumber+" · ":"")+part.name:" · Component-level")+" · "+line.quantity.toLocaleString("en-IN")+" "+(component?.salePriceUnit==="set"?"sets":"pieces")};})} onChange={changeLine}/>{poId&&!poLines.length&&<button type="button" onClick={()=>onSelectModule("purchasing")}>Add PO lines</button>}</div>
    </div>
    {!selectedLine && <div className="process-add-prerequisite-note" role="status"><strong>Process creation is waiting for a PO component line.</strong><span>Select a saved company, purchase order and active PO component line above. Then Add Operation becomes available and the new process is linked to that component route.</span><div><button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("companies")}>Add company</button><button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("purchasing")}>Create / select PO</button><button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("components")}>Add component</button></div></div>}
    {selectedLine && !selectedComponent && <div className="process-add-prerequisite-note" role="alert"><strong>This PO line has no active Component Master record.</strong><span>Restore or create the matching component record before adding production operations, so the route remains linked to a valid component ID.</span><button type="button" className="button-quiet compact-button" onClick={()=>onSelectModule("components")}>Open Component Master</button></div>}
    {selectedLine ? <>
      {selectedComponent && <div className="linked-component-summary"><div className="linked-component-identity"><ComponentIcon componentId={selectedComponent.id} componentName={selectedComponent.name+" "+selectedComponent.partNumber}/><span><small>SELECTED COMPONENT</small><strong>{selectedComponent.partNumber} · {selectedComponent.name}</strong><span>{selectedPart?((selectedPart.partNumber?selectedPart.partNumber+" · ":"")+selectedPart.name+" · Part-level PO line"):"Component-level PO line"} · Revision {selectedComponent.revision || "—"} · Component Master price ₹{(selectedComponent.salePrice || 0).toLocaleString("en-IN")} / {selectedComponent.salePriceUnit === "set" ? "set" : "piece"} · PO {selectedPO?.number}</span></span></div><div><small>ORDER QUANTITY</small><strong>{expectedQuantity.toLocaleString("en-IN")} {quantityUnit}</strong></div><div><small>LINE DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div><div><small>DRAWING / REFERENCE</small><strong>{selectedComponent.drawingReference || "Not entered"}</strong></div><button className="button-quiet compact-button" onClick={() => onSelectModule("components")}>Edit component master</button></div>}
      {selectedComponent && selectedLine && <PartMaterialCostingPanel key={(selectedPO?.id||"") + "-" + selectedComponent.id + "-" + selectedLine.id} scope="process-map" companyId={selectedPO?.companyId} poId={selectedPO?.id} poLineId={selectedLine.id} componentId={selectedComponent.id} componentName={selectedComponent.name} componentNumber={selectedComponent.partNumber} initialPartId={selectedPart?.id || ""} onNotice={onNotice} />}
      <div className={"job-completion-panel " + (selectedLine.jobStatus === "Finished" ? "job-completion-finished" : "")}>
        <div className="job-completion-copy">
          <span className="job-completion-icon"><Check size={19}/></span>
          <div>
            <small>JOB LIFECYCLE · SEPARATE FROM OPERATION STATUS</small>
            <strong>{selectedLine.jobStatus === "Finished" ? "Job Finished" : "In Progress"}</strong>
            <p>{selectedLine.jobStatus === "Finished"
              ? "Finished " + (selectedLine.jobFinishedAt ? new Date(selectedLine.jobFinishedAt).toLocaleString("en-IN") : "—") + ". Operation history remains available."
              : allDone ? "All saved route operations are Complete. Confirm final job closure when the job is actually finished."
              : "Job closure is a separate control. You may mark the PO line Finished when the job is actually finished; unfinished process statuses are not changed."}</p>
          </div>
        </div>
        {selectedLine.jobStatus === "Finished"
          ? <button className="button-quiet" onClick={reopenJob}>Reopen job</button>
          : <button className="button-primary" onClick={finishJob}><Check size={14}/> Mark job finished</button>}
      </div>
      <div className="linked-kpis">
        <button className="route-kpi kpi-delivery" onClick={() => document.getElementById("linked-timeline")?.scrollIntoView({behavior:"smooth",block:"nearest"})}><span className="kpi-icon"><CalendarClock size={19}/></span><span><small>DELIVERY FORECAST</small><strong>{deliveryState}</strong><em>{finalDelivery ? "Target " + shortDate(finalDelivery) : "Enter PO line delivery date"}</em></span></button>
        <button className={"route-kpi kpi-risk " + (lateOps.length ? "linked-kpi-alert" : "")} onClick={() => setSearch("Quality hold")}><span className="kpi-icon"><ShieldAlert size={19}/></span><span><small>BOTTLENECK / LATE OPERATIONS</small><strong>{lateOps.length}</strong><em>{lateOps.length ? "Late or overdue target dates" : "No overdue targets recorded"}</em></span></button>
        <button className="route-kpi kpi-wip"><span className="kpi-icon"><Boxes size={19}/></span><span><small>WORK IN PROGRESS</small><strong>{routeOperations.filter(op => op.status === "Running").reduce((sum,op) => sum + Math.max(0,op.quantity-op.completed),0).toLocaleString("en-IN")} {quantityUnit}</strong><em>{routeOperations.filter(op => op.status === "Running").length} operations running</em></span></button>
        <button className="route-kpi kpi-cost" onClick={() => onSelectModule("costing")}><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>PROCESS COST</small><strong>{money(routeCost)}</strong><em>Transport is totalled separately below</em></span></button>
        <button className="route-kpi kpi-transport"><span className="kpi-icon"><Truck size={19}/></span><span><small>TRANSPORT TRIPS</small><strong>{transportCount}</strong><em>{money(totalTransportCost)} total transport cost</em></span></button>
        <button className="route-kpi kpi-quality"><span className="kpi-icon"><ClipboardCheck size={19}/></span><span><small>ACCEPTED / ORDER QTY</small><strong>{totalAccepted.toLocaleString("en-IN")} {quantityUnit}</strong><em>Sum of accepted quantities entered per operation</em></span></button>
      </div>
      <section className="surface-panel process-production-summary">
        <div className="panel-heading"><div><div className="eyebrow">QUANTITY & EXECUTION OVERVIEW</div><h3>Production quantity status</h3><p>PO quantity is the control total; completion comes from the final process route step.</p></div><div className="module-form-actions"><label className="histogram-style-picker">Histogram<select value={histogramStyle} onChange={e=>setHistogramStyle(e.target.value as "bar"|"stacked"|"donut")}><option value="bar">Progress bars</option><option value="stacked">Completed / rejected</option><option value="donut">Donut progress</option></select></label><span className="module-number">{completionPercent}% COMPLETE</span></div></div>
        <div className="production-quantity-grid">
          <div><small>PLANNED</small><strong>{plannedProductionQty.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>IN PROGRESS</small><strong>{inProgressProductionQty.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>COMPLETED</small><strong>{finalCompletedQty.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>PENDING</small><strong>{pendingProductionQty.toLocaleString("en-IN")} {quantityUnit}</strong></div>
          <div><small>VENDORS ASSIGNED</small><strong>{vendorAssignedPercent}%</strong></div>
          <div><small>DELAYED OPERATIONS</small><strong>{lateOps.length} · {delayedPercent}%</strong></div>
        </div>
        <div className="production-progress-track"><span style={{width:completionPercent+"%"}}/></div>
        <div className={"production-operation-histogram histogram-style-"+histogramStyle}>
          {routeOperations.map(op=>{const pct=op.quantity>0?Math.min(100,Math.round(op.completed/op.quantity*100)):0;const rejected=op.quantity>0?Math.min(100-pct,Math.round(op.rejected/op.quantity*100)):0;return <div className="production-histogram-row" key={op.id}><span>{op.name}</span>{histogramStyle==="donut"?<div className="production-donut" style={{background:"conic-gradient(#25a77b "+pct+"%, #df6e76 "+(pct+rejected)+"%, var(--line) "+(pct+rejected)+"%)"}}><b>{pct}%</b></div>:<div className={histogramStyle==="stacked"?"production-stacked-bar":""}><i className={"histogram-status histogram-"+op.status.toLowerCase().replaceAll(" ","-")} style={{width:pct+"%"}}/>{histogramStyle==="stacked"&&<b style={{width:rejected+"%"}}/>}</div>}<strong>{pct}%</strong><small>{op.completed}/{op.quantity} completed · {op.rejected} rejected · {op.status}</small></div>;})}
          {!routeOperations.length&&<p className="field-hint">Add process operations to populate the per-process production histogram.</p>}
        </div>
      </section>
    </> : <section className="surface-panel linked-empty-master"><Package size={30}/><div><h3>Start with your real master records</h3><p>No company, PO or component is preloaded. Add each master record once; then select a real purchase-order line and AXIMACH will load the component, quantity and delivery date for its route.</p><div className="linked-empty-actions"><button className="button-primary" onClick={() => onSelectModule("companies")}><Plus size={14}/> Add company</button><button className="button-quiet" onClick={() => onSelectModule("components")}><Package size={14}/> Add component</button><button className="button-quiet" onClick={() => onSelectModule("purchasing")}><FileText size={14}/> Create PO</button></div></div></section>}
    <nav className="linked-route-tabs" aria-label="Linked component workspaces">
      {tab("process-map","Process Map",Workflow)}
      {tab("components","Component Details",Package)}
      {tab("purchasing","PO Components",FileText)}
      {tab("inventory","BOM & Material",Boxes)}
      {tab("costing","Costing",CircleDollarSign)}
      {tab("documents","Documents",FileText)}
      {tab("history","History",Activity)}
    </nav>
    <div className="linked-route-toolbar">
      <div className="linked-route-actions">
        <div className="process-add-menu-anchor">
          <button type="button" className="button-primary compact-button" aria-label="Add operation ▾" aria-haspopup="menu" aria-expanded={showAddMenu} onClick={toggleAddMenu}><Plus size={14}/> Add Operation <span aria-hidden="true">▾</span></button>
          {showAddMenu && <div className="process-add-menu" role="menu" aria-label="Add process options">
            <strong>{selectedLine && selectedComponent ? "Add to selected PO component" : "Select a PO component line first"}</strong>{(!selectedLine || !selectedComponent) && <small>Choose Company → Purchase Order → Component above. The menu stays available, but saving an operation requires a valid PO component line.</small>}
            <button type="button" role="menuitem" onClick={()=>startAdd()}><Plus size={13}/> Blank process operation</button>
            <div className="process-add-menu-library">
              <SearchablePicker id="add-operation-process-definition" label="Process Directory stage" value={addMenuDefinitionId} placeholder="Search category / process type…" options={processDefinitions.map(item=>({id:item.id,label:item.category+" · "+item.processType}))} onChange={setAddMenuDefinitionId}/>
              <button type="button" disabled={!addMenuDefinitionId} onClick={()=>startAddDefinition(addMenuDefinitionId)}>Add selected stage</button>
            </div>
            <button type="button" role="menuitem" disabled={!activeOperation} onClick={()=>activeOperation&&startAddSubprocess(activeOperation.id)}><GitBranch size={13}/> Add sub-process under selected</button>
            <button type="button" role="menuitem" disabled={!activeOperation} onClick={()=>startAddBranch("alternate")}><GitBranch size={13}/> Create alternate route from selected</button>
            <button type="button" role="menuitem" disabled={!activeOperation} onClick={()=>startAddBranch("rework")}><GitBranch size={13}/> Create rework branch from selected</button>
            <button type="button" role="menuitem" disabled={!activeOperation || (activeOperation.relationType!=="alternate"&&activeOperation.relationType!=="rework")} onClick={startAddBranchStep}><Plus size={13}/> Add step inside selected branch</button>
            <small>Each option creates a saved operation only after you complete and save its form.</small>
          </div>}
        </div>
        <div className="transport-leg-menu-anchor"><button type="button" className="button-quiet compact-button" disabled={!selectedLine} aria-haspopup="menu" aria-expanded={showTransportMenu} onClick={()=>setShowTransportMenu(value=>!value)}><Truck size={14}/> Add transport leg ▾</button>{showTransportMenu && <div className="process-add-menu" role="menu" aria-label="Transport leg options"><strong>Transport leg actions</strong><button type="button" role="menuitem" onClick={()=>{setShowTransportMenu(false);openTransportEditor();}}>Add leg from saved Transport Directory route</button><button type="button" role="menuitem" onClick={()=>{setShowTransportMenu(false);onSelectModule("transport-master");}}>Open Transport Directory</button><button type="button" role="menuitem" onClick={()=>{setShowTransportMenu(false);onSelectModule("dispatch");}}>Open Transport &amp; Dispatch</button></div>}</div>
        {selectedOperationId && activeOperation && <button className="button-danger compact-button" onClick={()=>deleteOperation(activeOperation)}><Trash2 size={14}/> Delete selected process</button>}
        <button className="button-quiet compact-button" disabled={!selectedLine || !activeOperation} onClick={() => startAddBranch("alternate")}><GitBranch size={14}/> Alternate route from selected</button>
        <button className="button-quiet compact-button" disabled={!selectedLine || !activeOperation} onClick={() => startAddBranch("rework")}><GitBranch size={14}/> Rework branch from selected</button>
        {(activeOperation?.relationType === "alternate" || activeOperation?.relationType === "rework") && <button className="button-quiet compact-button" disabled={!selectedLine} onClick={startAddBranchStep}><Plus size={14}/> Add step to selected branch</button>}
        <button className="button-quiet compact-button" onClick={clearAllFilters}><Search size={14}/> Clear filters</button>
        {onOpenIconStudio && <button className="button-quiet compact-button" onClick={()=>onOpenIconStudio(activeOperation?.processDefinitionId || processDefinitions.find(item=>item.processType===activeOperation?.name&&item.category===activeOperation?.category)?.id || processDefinitions[0]?.id)}><Boxes size={14}/> Add process logo</button>}
      </div>
      <div className="linked-route-actions linked-route-visual-controls" style={{flexWrap:"wrap",alignItems:"center"}}>
        <strong className="process-visual-style-label">VIEW</strong>
        <div className="process-visual-style-buttons" aria-label="All Process Map viewing modes" style={{display:"flex",flexWrap:"wrap",gap:"7px",width:"100%"}}>
          {([
            {id:"sphere",label:"1 · 3D Sphere"},
            {id:"vortex",label:"2 · 3D Vortex"},
            {id:"linear",label:"3 · Linear Flow"},
            {id:"horizontal",label:"4 · Horizontal Flow"},
            {id:"vertical",label:"5 · Vertical Flow"},
            {id:"timeline",label:"6 · Timeline"},
            {id:"gantt",label:"7 · Gantt View"},
            {id:"nodes",label:"8 · Connected Nodes"},
            {id:"branch",label:"9 · Branch / Rework"},
            {id:"combined",label:"10 · Combined 3D"}
          ] as const).map(option=><button key={option.id} type="button" aria-pressed={visualStyle===option.id}
            className={(visualStyle===option.id?"button-primary":"button-quiet")+" compact-button"}
            onClick={()=>{setVisualStyle(option.id);setRouteView("3d");setSimulationActive(false);setSimulationIndex(-1);}}>
            {option.label}
          </button>)}
        </div>
        {!simulationActive
          ? <button className="button-primary compact-button" onClick={startRouteSimulation}><Activity size={14}/> Simulate route</button>
          : <button className="button-quiet compact-button" onClick={() => setSimulationActive(false)}><Activity size={14}/> Pause simulation</button>}
        <button className="button-quiet compact-button" disabled={simulationIndex < 0} onClick={() => { setSimulationActive(false); setSimulationIndex(-1); }}><Check size={14}/> Reset</button>
        <label className="linked-search"><Search size={14}/><input value={search} onChange={e => { setSearch(e.target.value); setSimulationActive(false); setSimulationIndex(-1); }} placeholder="Search process, category, vendor, date, status…"/></label>
        <input aria-label="Route zoom" type="range" min="0.65" max="1.25" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))}/>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
        <SearchablePicker id="process-map-route-scope-mobile" label="Route scope" value={exportScope} options={routeScopeButtons.map(scope=>({id:scope.key,label:scope.label+" ("+scope.count+")"}))} onChange={setExportScope} placeholder="Choose route scope…"/>
      </div>
    </div>
    {showTransportEditor && <section className="route-editor-panel linked-operation-editor">
      <div className="route-editor-heading"><div><strong><Truck size={15}/> {editingTransportLegId ? "Edit component transport entry" : "Add component transport entry"}</strong><small>Transport is not a process operation. It is totalled separately for this PO component.</small></div><button className="icon-control" onClick={closeTransportEditor} aria-label="Close transport editor"><X size={14}/></button></div>
      <div className="route-editor-form">
        <SearchablePicker id="process-transport-directory-route" label="Saved Transport Directory route *" value={transportRouteId} placeholder="Search route, vendor, vehicle or direction…" options={transportRoutes.filter(route=>route.active!==false||(editingTransportLegId&&route.id===componentTransportLegs.find(leg=>leg.id===editingTransportLegId)?.routeId)).map(route=>({id:route.id,label:route.fromLocation+" → "+route.toLocation+" · "+route.vehicleType+" · "+route.tripDirection+" · "+vendors.find(item=>item.id===route.vendorId)?.company+" · "+money(route.fixedAmount)}))} onChange={setTransportRouteId}/>
        <label>Number of times / trips *<input type="number" min="1" step="1" value={transportTripCount} onChange={event => setTransportTripCount(event.target.value)}/></label>
        <SearchablePicker id="process-transport-placement" label="Place transport" value={transportPlacement} options={[{id:"start",label:"At component start"},{id:"before",label:"Before selected process"},{id:"after",label:"After selected process"}]} onChange={value=>setTransportPlacement(value as "start"|"before"|"after")}/>
<SearchablePicker id="process-transport-anchor" label="Connect to process" value={transportAnchorOperationId} disabled={transportPlacement==="start"} placeholder="Search process operation…" options={routeOperations.map(operation=>({id:operation.id,label:"OP-"+String(operation.sequence).padStart(3,"0")+" · "+operation.name}))} onChange={setTransportAnchorOperationId}/>
        <label className="editor-wide">Transport notes<input value={transportLegNotes} onChange={event => setTransportLegNotes(event.target.value)} placeholder="Purpose, pickup/delivery note or dispatch reference"/></label>
        {selectedTransportDirectoryRoute ? <div className="editor-wide linked-detail-grid"><div><small>TRANSPORTER</small><strong>{vendors.find(vendor => vendor.id === selectedTransportDirectoryRoute.vendorId)?.company || "Vendor record unavailable"}</strong></div><div><small>ROUTE / TRIP TYPE</small><strong>{selectedTransportDirectoryRoute.fromLocation} → {selectedTransportDirectoryRoute.toLocation}</strong><span>{selectedTransportDirectoryRoute.tripDirection} · {selectedTransportDirectoryRoute.vehicleType}</span></div><div><small>FIXED RATE × TRIPS</small><strong>{money(selectedTransportDirectoryRoute.fixedAmount)} × {Number(transportTripCount) || 0}</strong><span>Entry total: {money(selectedTransportDirectoryRoute.fixedAmount * (Number(transportTripCount) || 0))}</span></div></div> : <div className="editor-wide vendor-empty">No saved rate selected. <button type="button" className="inline-module-link" onClick={() => onSelectModule("transport-master")}>Open Transport Directory and add a route rate</button></div>}
        <div className="module-form-actions"><button className="button-primary" onClick={saveTransportLeg}><Check size={14}/> {editingTransportLegId ? "Update transport entry" : "Save transport entry"}</button><button className="button-quiet" onClick={closeTransportEditor}>Cancel</button></div>
      </div>
    </section>}
    <details open className="surface-panel component-transport-map-strip">
      <summary className="panel-heading"><div><div className="eyebrow"><Truck size={12}/> ROUTE TRANSPORT NODES</div><h3>Transport legs · {componentTransportLegs.length}</h3><p>Transport is displayed as route nodes here; the master rates remain in Transport Directory and dispatch execution remains in Transport &amp; Dispatch.</p></div><div className="relationship-actions"><button className="button-quiet compact-button" onClick={event=>{event.preventDefault();event.stopPropagation();onSelectModule("transport-master");}}>Transport Directory</button><button className="button-primary compact-button" disabled={!selectedLine||!transportRoutes.length} onClick={event=>{event.preventDefault();event.stopPropagation();openTransportEditor();}}><Plus size={13}/> Add transport node</button></div></summary>
      {componentTransportLegs.length?<div className="component-transport-node-track"><div className="component-transport-node component-transport-start"><Truck size={15}/><strong>Component start</strong></div>{componentTransportLegs.map(leg=>{const anchor=routeOperations.find(op=>op.id===leg.anchorOperationId);const vendor=vendors.find(v=>v.id===leg.vendorId);return <div className="component-transport-node" key={leg.id}><Truck size={15}/><strong>{leg.placement==="before"?"Before":leg.placement==="after"?"After": "At start"} {anchor?"OP-"+String(anchor.sequence).padStart(3,"0")+" · "+anchor.name:""}</strong><span>{leg.fromLocation} → {leg.toLocation}</span><small>{vendor?.company||"Vendor"} · {leg.vehicleType} · {leg.tripDirection} · {leg.tripCount} trip(s) · {money(leg.fixedAmount*leg.tripCount)}</small><span className="component-transport-node-actions"><button type="button" onClick={()=>editTransportLeg(leg)}>Edit</button><button type="button" onClick={()=>archiveTransportLeg(leg)}>Archive</button></span></div>;})}<button className="component-transport-node component-transport-add" onClick={()=>onSelectModule("transport-dispatch")}><Truck size={15}/><strong>Dispatch status</strong><small>Open Transport &amp; Dispatch</small></button></div>:<div className="module-empty-state"><Truck size={22}/><p>No transport nodes added for this PO component. Add a route in Transport Directory, then add its usage here.</p></div>}
    </details>
    <details open className="surface-panel process-map-filter-panel">
      <summary className="panel-heading"><div><div className="eyebrow">ROUTE FILTERS / SAVED OPERATIONS</div><h3>Filter this PO component route</h3><p>Process category, process type and subcategory are linked to Process Directory stable references.</p></div></summary>
      <div className="process-map-filter-grid ax-search-filter-columns">
        <SearchableMultiSelect id="process-filter-status" label="Process status" options={["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"].map(value=>({id:value,label:value}))} selected={statusFilters} onChange={setStatusFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-execution" label="Execution" options={["Internal","Outsourced"].map(value=>({id:value,label:value}))} selected={executionFilters} onChange={setExecutionFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-category" label="Process category" options={processCategories.map(value=>({id:value,label:value}))} selected={categoryFilters} onChange={setCategoryFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-type" label="Process type" options={processFilterTypes} selected={processTypeFilters} onChange={setProcessTypeFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-subcategory" label="Subcategory" options={processSubcategoryOptions} selected={subcategoryFilters} onChange={setSubcategoryFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-tolerance" label="Tolerance" options={["Standard","Precision","Close","Ultra Precision"].map(value=>({id:value,label:value}))} selected={toleranceFilters} onChange={setToleranceFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-payment" label="Payment status" options={["Paid","Unpaid"].map(value=>({id:value,label:value}))} selected={paymentFilters} onChange={setPaymentFilters} emptyMeansAll/>
        <SearchableMultiSelect id="process-filter-vendor" label="Vendor" options={vendors.map(v=>({id:v.id,label:v.company+" · "+v.contact+" · "+(v.phone||"No phone")}))} selected={vendorFilters} onChange={setVendorFilters} emptyMeansAll/>
      </div>
      <div className="process-map-filter-grid process-map-filter-numeric">
        <label>Due from<input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></label>
        <label>Due to<input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></label>
        <label>Min quantity<input type="number" min="0" value={minQuantity} onChange={e=>setMinQuantity(e.target.value)}/></label>
        <label>Max quantity<input type="number" min="0" value={maxQuantity} onChange={e=>setMaxQuantity(e.target.value)}/></label>
        <label>Min price / part (₹)<input type="number" min="0" step="0.01" value={minPrice} onChange={e=>setMinPrice(e.target.value)}/></label>
        <label>Max price / part (₹)<input type="number" min="0" step="0.01" value={maxPrice} onChange={e=>setMaxPrice(e.target.value)}/></label>
        <label>Min total cost (₹)<input type="number" min="0" step="0.01" value={minAmount} onChange={e=>setMinAmount(e.target.value)}/></label>
        <label>Max total cost (₹)<input type="number" min="0" step="0.01" value={maxAmount} onChange={e=>setMaxAmount(e.target.value)}/></label>
      </div>
      <div className="process-map-filter-actions"><span>{visibleOperations.length} visible / {routeOperations.length} operations · {selectedOperationIds.length} selected</span><button className="button-quiet compact-button" onClick={clearAllFilters}>Reset all filters</button></div>
    </details>
    <details open className="surface-panel process-route-scope-panel">
      <summary className="panel-heading"><div><div className="eyebrow">PROCESS MAP / ROUTE SCOPE</div><h3>Choose the route to display and export</h3><p>The same scope controls route arrows, process nodes and every download format for this PO component.</p></div><span className="module-number">{exportOperations.length} / {routeOperations.length} OPERATIONS</span></summary>
      <div className="process-route-scope-buttons">
        {routeScopeButtons.map(scope=><button key={scope.key} type="button" aria-pressed={exportScope===scope.key}
          className={(exportScope===scope.key?"button-primary":"button-quiet")+" compact-button"} onClick={()=>setExportScope(scope.key)}>
          {scope.label} <small>({scope.count})</small>
        </button>)}
      </div>
      {!exportOperations.length && <div className="module-empty-state"><Workflow size={22}/><strong>No processes in this route scope</strong><p>Choose another scope, clear filters, or select saved process operations.</p><button className="button-quiet compact-button" onClick={()=>setExportScope("all")}>Show all routes</button></div>}
    </details>
    <div className="linked-process-layout">
      <details open className="surface-panel linked-route-canvas">
        <summary className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / LIVE RECORDS</div><h3>{selectedLine ? (selectedComponent?.partNumber || "Component") + " · Route graph" : "Route graph"}</h3><p>{routeOperations.length} saved operations · branches and rework remain attached to this PO line</p></div><span className="module-number">{routeOperations.length} OPS</span></summary>
        <div className="process-export-panel">
          <div className="process-export-fields"><div className="process-export-field-actions"><button type="button" onClick={()=>setExportFields(PROCESS_EXPORT_FIELDS.map(field=>field.key))}>Select all fields</button><button type="button" onClick={()=>setExportFields([])}>Clear fields</button></div>{PROCESS_EXPORT_FIELDS.map(field=><label key={field.key}><input type="checkbox" checked={exportFields.includes(field.key)} onChange={()=>setExportFields(current=>current.includes(field.key)?current.filter(key=>key!==field.key):[...current,field.key])}/>{field.label}</label>)}</div>
          <div className="process-export-options" style={{display:"grid",gap:"10px"}}>
            <label><input type="checkbox" checked={exportArrows} onChange={event=>setExportArrows(event.target.checked)}/> Connection arrows</label>

          </div>
          <div className="process-export-actions"><button type="button" className="button-primary compact-button" onClick={exportCsv}><FileDown size={14}/> CSV</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportVisual("svg")}>SVG</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportVisual("png")}>PNG</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportPowerPoint()}><FileText size={14}/> PowerPoint</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportExcel()}><FileDown size={14}/> Excel</button><button type="button" className="button-quiet compact-button" onClick={printExport}><Printer size={14}/> Diagram PDF</button><small>{exportOperations.length} operation(s) · {exportColumns.length} field(s)</small></div>
        </div>
        {showEditor && <section className="route-editor-panel linked-operation-editor"><div className="route-editor-heading"><div><strong><Plus size={15}/> {editingId ? "Edit operation" : "Add operation"}</strong><small>All saved changes are linked to this selected PO line and component.</small></div><button className="icon-control" onClick={() => setShowEditor(false)} aria-label="Close editor"><X size={14}/></button></div>
          <div className="route-editor-form">
            <SearchablePicker id="operation-category" label="Process category *" value={draft.category} placeholder="Search process category…" options={processCategories.map(value=>({id:value,label:value}))} onChange={value=>setDraft({...draft,category:value,name:"",processDefinitionId:"",subcategory:"",processSubcategoryId:"",vendorId:""})} allowCustom/>
            <SearchablePicker id="operation-process-type" label="Process type *" value={draft.processDefinitionId || selectedProcessDefinition?.id || draft.name || ""} placeholder="Search or enter a new process type…" options={processDefinitions.filter(item=>!draft.category||item.category===draft.category).map(item=>({id:item.id,label:item.processType+" · "+item.category}))} onChange={value=>{const definition=processDefinitions.find(item=>item.id===value);const vendorStillAssigned=!definition?.vendorIds?.length||definition.vendorIds.includes(draft.vendorId);setDraft({...draft,processDefinitionId:definition?.id||"",name:definition?.processType||value,category:definition?.category||draft.category,subcategory:"",processSubcategoryId:"",vendorId:vendorStillAssigned?draft.vendorId:"",processColor:definition?.displayColor||draft.processColor||DEFAULT_PROCESS_COLOR});}} allowCustom/>
            <SearchablePicker id="operation-subcategory" label="Process subcategory" value={draft.processSubcategoryId} placeholder="Select a subcategory linked to this Process Directory definition…" options={selectedProcessDefinition ? selectedProcessDefinition.subcategories.map((value,index)=>({id:selectedProcessDefinition.subcategoryIds?.[index] || `${selectedProcessDefinition.id}-subprocess-${String(index+1).padStart(3,"0")}`,label:value})) : []} onChange={value=>{const definition=selectedProcessDefinition;const index=definition ? definition.subcategories.findIndex((_,i)=>(definition.subcategoryIds?.[i] || `${definition.id}-subprocess-${String(i+1).padStart(3,"0")}`)===value) : -1;setDraft({...draft,processSubcategoryId:value,subcategory:definition?.subcategories[index]||""});}}/>
            <label className="process-color-field">Process type colour<input type="color" value={draft.processColor||selectedProcessDefinition?.displayColor||DEFAULT_PROCESS_COLOR} onChange={event=>setDraft({...draft,processColor:event.target.value})}/><small>Saved to this Process Directory process type and shared by its operations.</small></label>
            <SearchablePicker id="operation-execution-type" label="Execution type" value={draft.executionType} options={["Internal","Outsourced"].map(value=>({id:value,label:value}))} onChange={value=>setDraft({...draft,executionType:value as "Internal"|"Outsourced",vendorId:value==="Internal"?"":draft.vendorId})}/>
            <label>Machine / station<input value={draft.machine} onChange={e => setDraft({...draft,machine:e.target.value})} placeholder="Machine / work centre"/></label>
            <SearchablePicker id="operation-vendor-picker" label="Vendor" value={draft.vendorId} placeholder="Type vendor name or phone…" options={processVendorOptions.map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")+(v.status.toLowerCase().includes("unverified")?" · Unverified":"")}))} onChange={vendorId=>setDraft({...draft,vendorId})}/>{!vendors.length && <small className="field-hint">Scan/import contacts or add a vendor in Vendors first.</small>}
            <label>Start date &amp; time<input type="datetime-local" value={dateTimeInput(draft.plannedStart)} onChange={e => setDraft({...draft,plannedStart:e.target.value})}/></label>
            <label>Delivery date &amp; time<input type="datetime-local" min={dateTimeInput(draft.plannedStart)} value={dateTimeInput(draft.plannedEnd)} onChange={e => setDraft({...draft,plannedEnd:e.target.value})}/></label>
            <label>Actual start date &amp; time<input type="datetime-local" value={dateTimeInput(draft.actualStart)} onChange={e => setDraft({...draft,actualStart:e.target.value})}/></label>
            <label>Actual completion date &amp; time<input type="datetime-local" min={dateTimeInput(draft.actualStart)} value={dateTimeInput(draft.actualEnd)} onChange={e => setDraft({...draft,actualEnd:e.target.value})}/></label>
            <label>Duration (calendar days)<input readOnly value={daysBetween(draft.plannedStart,draft.plannedEnd) || "—"}/></label>
            <label>Quantity to process<input type="number" min="0" value={draft.quantity || ""} onChange={e => setDraft({...draft,quantity:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Completed quantity<input type="number" min="0" value={draft.completed || ""} onChange={e => setDraft({...draft,completed:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Accepted quantity<input type="number" min="0" value={draft.accepted || ""} onChange={e => setDraft({...draft,accepted:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Rejected quantity<input type="number" min="0" value={draft.rejected || ""} onChange={e => setDraft({...draft,rejected:Math.max(0,Number(e.target.value)||0)})}/></label>
            <label>Total planned process cost (₹)<input type="number" min="0" step="0.01" value={draft.processCostTotal || ""} onChange={e => { const total=Math.max(0,Number(e.target.value)||0); setDraft({...draft,processCostTotal:total,ratePerPart:draft.quantity>0?total/draft.quantity:0}); }}/><small className="field-hint">Enter the total PO-line process cost. AXIMACH calculates the per-piece rate using the operation quantity.</small></label><label>Quoted / planned rate per part (₹)<input type="number" min="0" step="0.01" value={draft.ratePerPart || ""} onChange={e => { const rate=Math.max(0,Number(e.target.value)||0); setDraft({...draft,ratePerPart:rate,processCostTotal:draft.quantity*rate}); }}/></label>
            <label>Actual rate per part (₹)<input type="number" min="0" step="0.01" value={draft.actualRatePerPart || ""} onChange={e => setDraft({...draft,actualRatePerPart:Math.max(0,Number(e.target.value)||0)})}/></label>
            <SearchablePicker id="operation-payment-status" label="Payment status" value={draft.paymentStatus} options={["Unpaid","Paid"].map(value=>({id:value,label:value}))} onChange={value=>setDraft({...draft,paymentStatus:value as "Paid"|"Unpaid"})}/>
            <label>Total amount paid (₹)<input type="number" min="0" step="0.01" value={draft.paidAmount || ""} onChange={e=>setDraft({...draft,paidAmount:Math.max(0,Number(e.target.value)||0)})}/><small className="field-hint">Increasing this total appends only the additional amount as a dated payment-ledger transaction.</small></label>
            <label>Payment reference<input value={draft.paymentReference} onChange={e=>setDraft({...draft,paymentReference:e.target.value})} placeholder="Voucher / UTR / receipt number"/></label>
            <label>Planned process cost (₹)<input readOnly value={money(draft.quantity * draft.ratePerPart)}/></label>
            <SearchablePicker id="operation-status" label="Status" value={draft.status} options={["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"].map(value=>({id:value,label:value}))} onChange={value=>setDraft({...draft,status:value as LifecycleStatus})}/>
            <label>Route type<input value={draft.branch} onChange={e => setDraft({...draft,branch:e.target.value})} placeholder="Main route / Alternate / Rework"/></label>
            <SearchablePicker id="operation-transport-vendor-picker" label="Legacy operation transport vendor (older records)" value={draft.transportVendorId} placeholder="Type transporter name or phone…" options={vendors.filter(v=>v.vendorType==="Transport").map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")}))} onChange={transportVendorId=>setDraft({...draft,transportVendorId,transportRouteId:"",transportFrom:"",transportTo:"",transportVehicleType:"",transportCost:0})}/>
            <label>Legacy saved route (older vendor-linked records)<select value={draft.transportRouteId} onChange={e=>{const route=selectedTransportRoutes.find(item=>item.id===e.target.value);setDraft({...draft,transportRouteId:e.target.value,transportFrom:route?.fromLocation||"",transportTo:route?.toLocation||"",transportVehicleType:route?.vehicleType||"",transportCost:route?.fixedCost||0});}}><option value="">Select saved route…</option>{selectedTransportRoutes.map(route=><option key={route.id} value={route.id}>{route.fromLocation} → {route.toLocation} · ₹{route.fixedCost.toLocaleString("en-IN")} · {route.vehicleType||"Vehicle not set"}</option>)}</select></label>
            <label>From location<input readOnly value={draft.transportFrom||""}/></label>
            <label>To location<input readOnly value={draft.transportTo||""}/></label>
            <label>Vehicle type<input readOnly value={draft.transportVehicleType||""}/></label>
            <label>Transport pickup date &amp; time<input type="datetime-local" value={dateTimeInput(draft.transportPickup)} onChange={e => setDraft({...draft,transportPickup:e.target.value})}/></label>
            <label>Transport delivery date &amp; time<input type="datetime-local" value={dateTimeInput(draft.transportDelivery)} onChange={e => setDraft({...draft,transportDelivery:e.target.value})}/></label>
            <label>Legacy operation-level transport (₹)<input type="number" min="0" step="0.01" value={draft.transportCost || ""} onChange={e => setDraft({...draft,transportCost:Math.max(0,Number(e.target.value)||0)})}/><small className="field-hint">Compatibility field for older operation records. New transport must be added with the separate Add transport leg action and is counted in the component Transport Cost bucket.</small></label>
            <SearchablePicker id="operation-tolerance" label="Tolerance category" value={draft.toleranceCategory} options={["Standard","Precision","Close","Ultra Precision"].map(value=>({id:value,label:value}))} onChange={value=>setDraft({...draft,toleranceCategory:value as DraftOperation["toleranceCategory"]})}/>
            <label className="editor-wide"><input type="checkbox" checked={draft.inspectionRequired} onChange={e=>setDraft({...draft,inspectionRequired:e.target.checked})}/> Quality / inspection required</label>
            <label className="editor-wide">Quality / inspection requirement<input value={draft.qualityNotes} onChange={e => setDraft({...draft,qualityNotes:e.target.value})} placeholder="Required checks, acceptance criteria, gauges…"/></label>
            <label className="editor-wide">Inspection result<input value={draft.inspectionResult} onChange={e => setDraft({...draft,inspectionResult:e.target.value})} placeholder="Not inspected, accepted, rejected, actual results…"/></label>
            <label className="editor-wide">Operation notes<input value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})} placeholder="Setup, process constraints, delivery instructions"/></label>
            <label className="editor-wide"><input type="checkbox" checked={draft.costIncluded} onChange={e => setDraft({...draft,costIncluded:e.target.checked})}/> Include this operation in Process Cost (untick to exclude it from the active route total)</label>
            <div className="module-form-actions"><button className="button-primary" onClick={saveOperation}><Check size={14}/> {editingId ? "Save changes" : "Save operation"}</button><button className="button-quiet" onClick={() => setShowEditor(false)}>Cancel</button></div>
          </div>
        </section>}
        {!["sphere","vortex","combined"].includes(visualStyle) && processDefinitions.length > 0 && <section className="process-view-directory-catalog-grid">
          <div className="process-directory-map-heading"><span>AVAILABLE PROCESS DEFINITIONS</span><small>These are engineering definitions, not saved production steps</small></div>
          <div className="process-directory-map-nodes">{processDefinitions.map(definition=><button type="button" className="process-directory-map-node" key={definition.id} onClick={()=>startAddDefinition(definition.id)}>
            <ProcessIcon processId={definition.id} processName={definition.processType} category={definition.category} fallback={<Workflow size={18}/>} />
            <strong>{definition.processType}</strong><span>{definition.category}</span><small>{definition.subcategories.length} sub-process option(s)</small><em>＋ Add to selected PO line</em>
          </button>)}</div>
        </section>}
        {exportOperations.length > 0 && <section className="process-route-flow" aria-label="Selected route arrow diagram">
          <div className="process-route-flow-heading"><strong>ROUTE FLOW · {exportScopeLabel}</strong><span>{exportOperations.length} selected process record(s) · arrows remain inside their own route</span></div>
          {exportBranches.map(routeGroup=>{
            const lane=exportOperations.filter(operation=>(operation.poLineId||operation.componentId)+"::"+(operation.branch||"Main route")===routeGroup).slice().sort((a,b)=>a.sequence-b.sequence);
            const branch=lane[0]?.branch||"Main route";
            const partLabel=routeLabels[lane[0]?.poLineId||""]||"";
            const branchOrigin=resolveBranchOrigin(branch,lane);
            const branchRoot=branchOrigin?.branchRoot;
            const parent=branchOrigin?.parent;
            const rework=branchRoot?.relationType==="rework"||/rework/i.test(branch);
            const routeColor=rework?REWORK_ROUTE_COLOR:branchRoot||branch!=="Main route"?ALTERNATE_ROUTE_COLOR:"#5a8fc4";
            return <div className={"process-route-flow-lane "+(rework?"is-rework":branchRoot||branch!=="Main route"?"is-alternate":"is-main")} key={routeGroup}>
              <div className="process-route-flow-lane-title"><i style={{background:routeColor}}/><strong>{partLabel ? partLabel+" · " : ""}{branch}</strong><small>{lane.length} step(s) · {rework?"REWORK":branchRoot||branch!=="Main route"?"ALTERNATE":"MAIN ROUTE"}</small></div>
              {branchRoot&&<div className={"process-route-parent-link "+(rework?"is-rework":"is-alternate")}>
                <button type="button" onClick={()=>{setSelectedOperationId(parent?.id||"");setShowEditor(false);}} disabled={!parent}>OP-{String(parent?.sequence||0).padStart(3,"0")} · {parent?.name||"Parent process"}</button>
                <ArrowRight size={17} style={{color:rework?REWORK_ROUTE_COLOR:ALTERNATE_ROUTE_COLOR}}/>
                <strong>{branchRoot.name}</strong><small>{rework?"Rework starts here":"Alternate route starts here"}</small>
              </div>}
              <div className="process-route-flow-track">{lane.map((operation,index)=>{
                const processColor=processAccent(operation);
                const nodeColor=processColor;
                const routeArrowColor=rework?REWORK_ROUTE_COLOR:branchRoot||branch!=="Main route"?ALTERNATE_ROUTE_COLOR:processColor;
                return <div className="process-route-flow-step" key={operation.id}>
                  <button type="button" className={activeOperation?.id===operation.id?"is-selected":""} style={{borderColor:nodeColor}} onClick={()=>{setSelectedOperationId(operation.id);setShowEditor(false);}} title={"Select "+operation.name+" · OP-"+operation.sequence}>
                    <ProcessIcon processId={operation.processDefinitionId} processName={operation.name} category={operation.category} subcategory={operation.subcategory} fallback={<Workflow size={16}/>}/>
                    <strong>{operation.name}</strong><small>OP-{String(operation.sequence).padStart(3,"0")}</small>
                    <em style={{background:nodeColor}}>{operation.category||"Process"}</em>{operation.subcategory&&<small className="process-route-flow-subcategory">SUB · {operation.subcategory}</small>}
                  </button>
                  {index<lane.length-1&&<span className="process-route-flow-arrow" style={{color:routeArrowColor}}><ArrowRight size={20}/></span>}
                </div>;
              })}</div>
            </div>;
          })}
        </section>}
        {processMapMaterialEntries.length>0&&<section className="process-material-route-panel" aria-label="Material supplier and inbound transport route"><div className="process-material-route-heading"><strong>Material procurement & inbound transport</strong><span>{processMapMaterialEntries.length} material allocation(s) · transport costs kept separate</span></div>{processMapMaterialEntries.map(entry=><div className="process-material-route-row" key={entry.id}><div className="process-material-route-node"><small>SUPPLIER</small><strong>{vendors.find(v=>v.id===entry.vendorId)?.company||"Vendor not assigned"}</strong><span>Given {entry.givenDate||"—"} · Due {entry.deliveryDate||"—"} · Received {entry.actualDeliveryDate||"—"}</span></div><span className="process-material-route-arrow"><ArrowRight size={18}/></span><div className="process-material-route-node"><small>MATERIAL</small><strong>{entry.materialName} · {entry.materialGrade}</strong><span>{entry.quantity} pcs · {entry.totalWeightKg.toFixed(3)} kg · {money(entry.materialCost)}</span></div><span className="process-material-route-arrow"><ArrowRight size={18}/></span><div className="process-material-route-node"><small>INBOUND TRANSPORT</small><strong>{vendors.find(v=>v.id===entry.transportVendorId)?.company||"Transport not assigned"}</strong><span>{[entry.transportFrom||vendors.find(v=>v.id===entry.vendorId)?.address,entry.transportTo].filter(Boolean).join(" → ")||"Route not set"} · {entry.transportVehicleType||"Vehicle not set"} · {money(entry.transportCost||0)}</span><small>Pickup {entry.transportPickupAt||"—"} → Delivery {entry.transportDeliveryAt||"—"} · {entry.transportStatus||"Planned"}</small></div><span className="process-material-route-arrow"><ArrowRight size={18}/></span><div className="process-material-route-node process-material-route-destination"><small>ALLOCATED TO</small><strong>{entry.partId?entry.partName+" · "+entry.partNumber:"Component-level allocation"}</strong><span>{selectedComponent?.partNumber} · {selectedComponent?.name}</span></div></div>)}</section>}
        {["sphere","vortex","linear","horizontal","vertical","timeline","gantt","nodes","branch","combined"].includes(visualStyle)
          ? <div className={"process-visual-stage process-visual-"+visualStyle}><ProcessUniverse3D key={visualStyle} initialLayout={visualStyle} operations={exportOperations} allOperations={routeOperations} processDefinitions={processDefinitions} vendors={vendors} routeLabels={routeLabels} materialRoutes={materialRouteEntries.map(entry=>{
            const supplier=vendors.find(vendor=>vendor.id===entry.vendorId);
            const transporter=vendors.find(vendor=>vendor.id===entry.transportVendorId);
            return {
              id:entry.id,
              partLabel:routeLabels[entry.poLineId||""] || (entry.partNumber ? entry.partNumber+" · "+entry.partName : "Component-level material"),
              materialLabel:[entry.materialName,entry.materialGrade].filter(Boolean).join(" · "),
              quantity:entry.quantity,
              weightKg:entry.totalWeightKg,
              supplier:supplier?.company || "Supplier not assigned",
              transporter:transporter?.company || "Transporter not assigned",
              from:entry.transportFrom || supplier?.address || "Supplier pickup",
              to:entry.transportTo || "Destination not set",
              vehicle:entry.transportVehicleType || "Vehicle not set",
              materialGivenAt:shortDate(entry.givenDate),
              materialDueAt:shortDate(entry.deliveryDate),
              materialReceivedAt:shortDate(entry.actualDeliveryDate),
              pickupAt:shortDate(entry.transportPickupAt),
              deliveryAt:shortDate(entry.transportDeliveryAt),
              status:entry.transportStatus || "Planned",
              transportCost:entry.transportCost || 0
            };
          })} visibleFields={exportFields} showArrows={exportArrows} quantityUnit={quantityUnit} ganttScale={ganttScale} onGanttScaleChange={setGanttScale} operationTransportAmounts={Object.fromEntries(exportOperations.map(operation=>[operation.id,operationTransportAmount(operation)]))} selectedOperationId={activeOperation?.id || ""} simulationIndex={simulationIndex} zoom={zoom} onSelectOperation={id => { setSelectedOperationId(id); setShowEditor(false); if(selectedOperationPanelRef.current)selectedOperationPanelRef.current.open=true; }} onEditOperation={id=>editActive(id)} onChangeProcessColor={(id,color)=>updateOperation(id,{processColor:color})} onAddSubprocess={startAddSubprocess} onAddAlternateRoute={parentId=>startAddBranch("alternate",parentId)} onAddReworkRoute={parentId=>startAddBranch("rework",parentId)} onAddProcessDefinition={startAddDefinition} /></div>
          : visualStyle==="gantt" && exportOperations.length ? <div className="process-gantt-view">
              <div className="process-gantt-toolbar"><label>Scale<select value={ganttScale} onChange={e=>setGanttScale(e.target.value as "day"|"week"|"month")}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label><span>Timeline · {exportOperations.length} operations in {exportScopeLabel}</span></div><div className="process-gantt-axis"><strong>Process</strong><div style={{gridTemplateColumns:"repeat("+ganttTicks.length+",minmax(0,1fr))"}}>{ganttTicks.map((tick,index)=><small key={index}>{tick}</small>)}</div></div>
              {exportOperations.map(op=>{const start=op.plannedStart||op.actualStart||finalDelivery;const end=op.plannedEnd||op.actualEnd||start;const startDate=start?dateValue(start):new Date();const endDate=end?dateValue(end):startDate;const span=Math.max(1,Math.round((endDate.getTime()-startDate.getTime())/86400000)+1);const offset=start?Math.max(0,Math.round((startDate.getTime()-dateValue(timelineStart||start).getTime())/86400000)):0;const total=Math.max(1,daysBetween(timelineStart||start,timelineEnd||end));const left=Math.min(92,offset/total*100);const width=Math.max(3,Math.min(100-left,span/total*100));const branch=op.branch||"Main route";const color=processAccent(op);const routeColor=branchAccent(op);return <div className={"process-gantt-row "+(branch==="Main route"?"":"is-branch")} key={op.id}><button onClick={()=>{setSelectedOperationId(op.id);setShowEditor(false);}}><strong>OP-{op.sequence} · {op.name}</strong><small><i style={{display:"inline-block",width:7,height:7,borderRadius:"50%",background:routeColor,marginRight:5}}/>{branch} · {shortDate(op.plannedStart)} → {shortDate(op.plannedEnd)}</small></button><div className="process-gantt-track"><span className={"process-gantt-bar status-"+op.status.toLowerCase().replaceAll(" ","-")} style={{left:left+"%",width:width+"%",backgroundColor:color}} title={op.status+" · "+shortDate(op.plannedStart)+" to "+shortDate(op.plannedEnd)} /></div></div>;})}
            </div>
          : exportOperations.length ? <div className={"linked-node-scroll process-visual-"+visualStyle+" " + (visualStyle==="vertical" ? "linked-node-vertical" : "")}><div className="linked-route-lanes" style={{transform:"scale(" + zoom + ")",transformOrigin:"top left"}}>{exportBranches.map(routeGroup => {
          const laneOperations = exportOperations.filter(op => (op.poLineId||op.componentId)+"::"+(op.branch||"Main route") === routeGroup).slice().sort((a,b)=>a.sequence-b.sequence);
          const branch = laneOperations[0]?.branch || "Main route";
          const partLabel = routeLabels[laneOperations[0]?.poLineId || ""] || "";
          const alternate = branch !== "Main route";
          const branchOrigin=resolveBranchOrigin(branch,laneOperations);
          const branchRoot=branchOrigin?.branchRoot;
          const parent=branchOrigin?.parent;
          const rework=branchRoot?.relationType==="rework"||/rework/i.test(branch);
          const routeColor=rework?REWORK_ROUTE_COLOR:alternate?ALTERNATE_ROUTE_COLOR:"#5a8fc4";
          return <section className={"linked-route-lane " + (alternate ? "linked-route-lane-alternate " : "")+(rework?"route-rework":"route-alternate")} style={{borderLeftColor:routeColor}} key={routeGroup}>
            <div className="linked-route-lane-heading"><strong>{partLabel ? partLabel+" · " : ""}{branch}</strong><small>{laneOperations.length} operation(s) · {rework?"rework route":alternate?"alternate route":"primary route"}{parent ? " · branches from "+parent.name : ""}</small>{alternate && <button type="button" className="button-quiet compact-button" onClick={() => setBranchCostIncluded(branch, !laneOperations.some(op => op.costIncluded !== false), laneOperations[0]?.poLineId)}>{laneOperations.some(op => op.costIncluded !== false) ? "Exclude this route from costing" : "Use this route · include costs"}</button>}</div>
            {branchRoot&&<div className={"linked-route-parent-arrow "+(rework?"is-rework":"is-alternate")}><span>OP-{String(parent?.sequence||0).padStart(3,"0")} · {parent?.name||"Parent process"}</span><ArrowRight size={17}/><strong>{branchRoot.name}</strong></div>}
            <div className="linked-node-track">{laneOperations.map((op,index) => {
              const vendor = vendors.find(v => v.id === op.vendorId);
              const selected = op.id === activeOperation?.id;
              const accent = processAccent(op);
              const arrowAccent = rework?REWORK_ROUTE_COLOR:alternate?ALTERNATE_ROUTE_COLOR:accent;
              return <div className="linked-node-wrap" key={op.id}><button style={{borderColor:accent}} className={"linked-operation-node status-" + op.status.toLowerCase().replaceAll(" ","-") + (alternate ? " linked-node-alternate" : "") + (selected ? " linked-node-selected" : "")} onClick={() => {setSelectedOperationId(op.id);setShowEditor(false);}}><ProcessIcon processId={op.processDefinitionId} processName={op.name} category={op.category} subcategory={op.subcategory} fallback={op.name.toLowerCase().includes("transport") || op.name.toLowerCase().includes("dispatch") ? <Truck size={19}/> : op.name.toLowerCase().includes("inspect") || op.name.toLowerCase().includes("quality") ? <ClipboardCheck size={19}/> : op.name.toLowerCase().includes("grind") ? <Wrench size={19}/> : <Workflow size={19}/>} /><strong>{op.name}</strong><small>OP-{String(op.sequence).padStart(3,"0")}</small><span>{op.status}</span><small>{vendor?.company || "Vendor unassigned"}</small><small>{daysBetween(op.plannedStart,op.plannedEnd) || "—"} day(s)</small></button>{index < laneOperations.length - 1 && <span className="linked-node-arrow" style={{color:op.relationType==="rework"?REWORK_ROUTE_COLOR:op.relationType==="alternate"?ALTERNATE_ROUTE_COLOR:arrowAccent}}><ArrowRight size={18}/></span>}</div>;
            })}</div>
          </section>;
        })}</div></div> : routeOperations.length ? <div className="module-empty-state"><Workflow size={24}/><h3>No process records in the selected route scope</h3><p>Choose another route scope or reset the filters.</p></div> : <div className="module-empty-state linked-no-operations"><Workflow size={28}/><h3>No operations saved for this component</h3><p>Add only the operations this part actually requires. There is no fixed stage limit and no sample CNC or heat-treatment data.</p><button className="button-primary" disabled={!selectedLine || !selectedComponent} onClick={openAddMenu}><Plus size={14}/> Add first operation ▾</button></div>}
        <div className="route-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="route-scroll-note">Select any operation to inspect its schedule, vendor, quality and cost.</span></div>
      </details>
      <details open className="surface-panel process-operation-table-panel">
        <summary className="panel-heading"><div><div className="eyebrow">PROCESS EXECUTION REGISTER</div><h3>Process operations</h3><p>Selected route scope · {exportOperations.length} of {routeOperations.length} operation(s).</p></div><button className="button-primary compact-button" disabled={!selectedLine} onClick={event=>{event.preventDefault();event.stopPropagation();openAddMenu();}}><Plus size={13}/> Add process ▾</button></summary>
        <div className="process-table-bulkbar">
          <label><input type="checkbox" checked={exportOperations.length>0&&exportOperations.every(op=>selectedOperationIds.includes(op.id))} onChange={e=>selectVisibleOperations(e.target.checked)}/> Select all visible</label>
          <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}><option value="">Bulk status…</option>{["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"].map(value=><option key={value}>{value}</option>)}</select>
          <select value={bulkVendorId} onChange={e=>setBulkVendorId(e.target.value)}><option value="">Bulk vendor…</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company} · {v.contact}</option>)}</select>
          <label>Start <input type="datetime-local" value={bulkStart} onChange={e=>setBulkStart(e.target.value)}/></label>
          <label>Due <input type="datetime-local" value={bulkEnd} onChange={e=>setBulkEnd(e.target.value)}/></label>
          <button className="button-primary compact-button" disabled={!selectedVisibleOperations.length||(!bulkStatus&&!bulkVendorId&&!bulkStart&&!bulkEnd)} onClick={applyBulkUpdate}>Apply to {selectedVisibleOperations.length}</button>
          <button className="button-quiet compact-button" disabled={!selectedOperationIds.length} onClick={()=>setSelectedOperationIds([])}>Clear selection</button>
          <button className="button-quiet compact-button" disabled={!selectedVisibleOperations.length} onClick={finishSelectedOperations}><Check size={13}/> Finish selected</button>
          <button className="button-quiet compact-button" disabled={!exportOperations.length} onClick={exportCsv}><FileDown size={13}/> Export selected/visible CSV</button>
        </div>
        <div className="costing-table-wrap process-operation-table-wrap"><table className="costing-table process-operation-table"><thead><tr><th>SL / Select</th><th>Process</th><th>Category</th><th>Execution</th><th>Vendor</th><th>Start</th><th>Due</th><th>Qty</th><th>Price / {quantityUnit}</th><th>Process cost (transport excluded)</th><th>Transport amount</th><th>Combined amount</th><th>Status</th><th>Tolerance</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{exportOperations.map((op,index)=>{const vendor=vendors.find(v=>v.id===op.vendorId);const appliedRate=op.actualRatePerPart||op.ratePerPart;const amount=op.quantity*appliedRate;return <tr key={op.id} className={"process-operation-row status-row-"+op.status.toLowerCase().replaceAll(" ","-")}><td><label><input type="checkbox" checked={selectedOperationIds.includes(op.id)} onChange={()=>toggleOperationSelection(op.id)}/> {index+1}</label></td><td><span className="process-cell-identity"><ProcessIcon processId={op.processDefinitionId} processName={op.name} category={op.category} subcategory={op.subcategory} fallback={<Workflow size={14}/>} /><span><button className="process-row-open" onClick={()=>{setSelectedOperationId(op.id);setShowEditor(false);if(selectedOperationPanelRef.current)selectedOperationPanelRef.current.open=true;}}>{op.name}</button><small>OP-{String(op.sequence).padStart(3,"0")} · {op.subcategory||"No subcategory"}</small></span></span></td><td>{op.category||"—"}</td><td>{op.executionType||"Outsourced"}</td><td>{vendor?.company||"Unassigned"}</td><td>{shortDate(op.plannedStart)}</td><td>{shortDate(op.plannedEnd)}</td><td>{op.quantity.toLocaleString("en-IN")} {quantityUnit}</td><td>{money(appliedRate)}<small>{op.actualRatePerPart>0?"Actual rate":"Planned rate"}</small></td><td>{money(amount)}</td><td>{money(operationTransportAmount(op))}</td><td>{money(amount+operationTransportAmount(op))}</td><td><span className={"record-state status-tag status-"+op.status.toLowerCase().replaceAll(" ","-")}>{op.status}</span></td><td>{op.toleranceCategory||"Standard"}</td><td>{op.notes||"—"}</td><td><div className="process-row-actions"><button title="Move up" disabled={routeOperations.findIndex(x=>x.id===op.id)===0} onClick={()=>moveOperation(op.id,-1)}><ArrowUp size={12}/></button><button title="Move down" disabled={routeOperations.findIndex(x=>x.id===op.id)===routeOperations.length-1} onClick={()=>moveOperation(op.id,1)}><ArrowDown size={12}/></button><button title="Edit process" onClick={()=>editActive(op.id)}><Wrench size={12}/></button><button title="Assign process logo" onClick={()=>onOpenIconStudio?.(op.processDefinitionId || processDefinitions.find(item=>item.processType===op.name&&item.category===op.category)?.id)}><Boxes size={12}/></button><button title="Create rework branch from this process" onClick={()=>startAddBranch("rework",op.id)}><GitBranch size={12}/></button><button title="Delete process" className="process-row-delete" onClick={()=>deleteOperation(op)}><Trash2 size={12}/></button></div></td></tr>;})}</tbody></table></div>
        {!exportOperations.length&&<div className="module-empty-state"><Workflow size={24}/><h3>{routeOperations.length?"No operations in this route scope":"No process operations yet"}</h3><p>Clear filters or add an operation to the selected PO component line.</p><button className="button-primary" onClick={clearAllFilters}>Reset filters</button></div>}
      </details>
      <div className="process-map-support-grids">
        <details open className="surface-panel"><summary className="panel-heading"><div><div className="eyebrow">UPCOMING DELIVERY</div><h3>Upcoming delivery</h3><p>PO component lines ordered by due date.</p></div></summary>
          <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO</th><th>Component</th><th>Qty</th><th>Status</th></tr></thead><tbody>{purchaseOrders.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line,component:components.find(c=>c.id===line.componentId)}))).sort((a,b)=>(a.line.targetDelivery||a.po.targetDelivery||"9999").localeCompare(b.line.targetDelivery||b.po.targetDelivery||"")).slice(0,20).map(item=>{
            const openLine=()=>{
              const firstOperation=operations.filter(operation=>operation.poId===item.po.id&&operation.poLineId===item.line.id&&operation.componentId===item.line.componentId).sort((a,b)=>a.sequence-b.sequence)[0];
              setCompanyId(item.po.companyId);setPoId(item.po.id);setPoLineId(item.line.id);setSelectedOperationId(firstOperation?.id||"");
              setExportScope("all");setSearch("");setCategorySearch("");
              setStatusFilters([]);setExecutionFilters([]);setCategoryFilters([]);setToleranceFilters([]);setPaymentFilters([]);setVendorFilters([]);setProcessTypeFilters([]);setSubcategoryFilters([]);
              setDateFrom("");setDateTo("");setMinQuantity("");setMaxQuantity("");setMinPrice("");setMaxPrice("");setMinAmount("");setMaxAmount("");
              setSimulationActive(false);setSimulationIndex(-1);setShowEditor(false);setShowAddMenu(false);setShowTransportEditor(false);
              if(firstOperation?.id&&selectedOperationPanelRef.current)selectedOperationPanelRef.current.open=true;
            };
            return <tr key={item.po.id+item.line.id} className="process-upcoming-delivery-row" role="button" tabIndex={0} aria-label={"Open PO "+item.po.number+" component "+(item.component?.partNumber||item.component?.name||"line")} onClick={openLine} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openLine();}}}><td>{item.po.number}<small>{item.line.targetDelivery||item.po.targetDelivery||"No date"}</small></td><td>{item.component?.name||"Missing"}<small>{item.component?.partNumber||"—"}</small></td><td>{item.line.quantity.toLocaleString("en-IN")}</td><td>{item.line.jobStatus||"In progress"}</td></tr>;
          })}</tbody></table></div>
        </details>
        <details open className="surface-panel"><summary className="panel-heading"><div><div className="eyebrow">DELAY & RISK</div><h3>Delayed operations</h3><p>Past due operations that are not marked complete.</p></div></summary>
          <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component</th><th>Process</th><th>Issue</th><th>Days</th><th>Action</th></tr></thead><tbody>{routeOperations.filter(op=>op.plannedEnd&&op.status!=="Complete"&&dateValue(op.plannedEnd).getTime()<Date.now()).map(op=><tr key={op.id}><td>{components.find(c=>c.id===op.componentId)?.partNumber||"—"}</td><td>{op.name}</td><td>{op.status}</td><td>{Math.floor((Date.now()-dateValue(op.plannedEnd).getTime())/86400000)}</td><td><button className="button-quiet compact-button" onClick={()=>{setSelectedOperationId(op.id);editActive();}}>Review</button></td></tr>)}</tbody></table></div>
        </details>
      </div>
      <details open ref={selectedOperationPanelRef} className="surface-panel linked-operation-side">
        <summary className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SELECTED OPERATION</div><h3>{activeOperation?.name || "Select an operation"}</h3><p>{activeOperation ? (activeOperation.category || "Process type not specified") + " · OP-" + String(activeOperation.sequence).padStart(3,"0") : "Select a route node or process row to inspect its linked details."}</p></div>{activeOperation && <button className="icon-control" aria-label="Edit selected operation" onClick={event=>{event.preventDefault();event.stopPropagation();editActive();}}><Wrench size={14}/></button>}</summary>
        {activeOperation ? <>
          <div className="linked-detail-grid"><div><small>VENDOR</small><strong>{selectedVendor?.company || "Not assigned"}</strong><span>{selectedVendor?.phone || "No vendor number linked"}</span></div><div><small>MACHINE / STATION</small><strong>{activeOperation.machine || "Not entered"}</strong></div><div><small>PLANNED SCHEDULE</small><strong>{shortDate(activeOperation.plannedStart)} – {shortDate(activeOperation.plannedEnd)}</strong><span>{daysBetween(activeOperation.plannedStart,activeOperation.plannedEnd) || "—"} calendar day(s)</span></div><div><small>ACTUAL SCHEDULE</small><strong>{shortDate(activeOperation.actualStart)} – {shortDate(activeOperation.actualEnd)}</strong></div><div><small>QUANTITY</small><strong>{activeOperation.quantity.toLocaleString("en-IN")} {quantityUnit}</strong><span>{activeOperation.completed.toLocaleString("en-IN")} completed</span></div><div><small>ACCEPTED / REJECTED</small><strong>{activeOperation.accepted.toLocaleString("en-IN")} / {activeOperation.rejected.toLocaleString("en-IN")}</strong></div><div><small>QUOTED / PLANNED RATE</small><strong>{money(activeOperation.ratePerPart)}</strong></div><div><small>ACTUAL RATE / PART</small><strong>{activeOperation.actualRatePerPart ? money(activeOperation.actualRatePerPart) : "Not entered"}</strong></div><div><small>PROCESS COST</small><strong>{money(activeOperation.quantity * (activeOperation.actualRatePerPart||activeOperation.ratePerPart))}</strong><span>{activeOperation.actualRatePerPart>0?"Actual process rate only":"Planned process rate only"}</span></div><div><small>TRANSPORT</small><strong>{vendors.find(v=>v.id===activeOperation.transportVendorId)?.company || "No transporter assigned"}</strong><span>{activeOperation.transportPickup || activeOperation.transportDelivery ? shortDate(activeOperation.transportPickup) + " → " + shortDate(activeOperation.transportDelivery) : "Not scheduled"} · {money(activeOperation.transportCost)}</span></div><div><small>PROCESS PAYMENT</small><strong>{activeOperation.paymentStatus || "Unpaid"}</strong><span>{money(activeOperation.paidAmount || 0)} paid · {activeOperation.paymentReference || "No payment reference"}</span></div><div><small>STATUS</small><strong>{activeOperation.status}</strong></div><div className="linked-detail-wide"><small>QUALITY / INSPECTION REQUIREMENT</small><strong>{activeOperation.qualityNotes || "No quality notes recorded"}</strong></div><div className="linked-detail-wide"><small>INSPECTION RESULT</small><strong>{activeOperation.inspectionResult || "Not entered"}</strong></div><div className="linked-detail-wide"><small>NOTES</small><strong>{activeOperation.notes || "No operation notes entered"}</strong></div></div>
          <div className="linked-side-actions"><button className="button-primary" onClick={() => editActive()}><Wrench size={14}/> Edit operation</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)<=0} onClick={()=>moveOperation(activeOperation.id,-1)}><ArrowUp size={14}/> Move earlier</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)>=routeOperations.length-1} onClick={()=>moveOperation(activeOperation.id,1)}><ArrowDown size={14}/> Move later</button><button className="button-quiet" onClick={() => onSelectModule("costing",{companyId:selectedPO?.companyId,poId:selectedPO?.id,poLineId:selectedLine?.id,componentId:selectedComponent?.id,operationId:activeOperation.id,vendorId:activeOperation.vendorId})}><CircleDollarSign size={14}/> Quotes / costing</button><button className="button-quiet" onClick={() => onSelectModule("quality",{companyId:selectedPO?.companyId,poId:selectedPO?.id,poLineId:selectedLine?.id,componentId:selectedComponent?.id,operationId:activeOperation.id})}><ClipboardCheck size={14}/> Quality inspection</button>{activeOperation.vendorId&&onScheduleVendor&&<button className="button-quiet" onClick={()=>onScheduleVendor(activeOperation.vendorId,activeOperation.id,activeOperation.name)}><CalendarClock size={14}/> Vendor follow-up</button>}<button className="button-danger" onClick={() => deleteOperation(activeOperation)}><Trash2 size={14}/> Delete process</button></div>
          <div className="linked-quote-preview"><div className="panel-heading"><div><h3>Vendor quotations</h3><p>{selectedOperationQuotations.length} quote(s) linked to this operation</p></div></div>{selectedOperationQuotations.length ? selectedOperationQuotations.map(q => <div key={q.id} className="linked-quote-mini"><strong>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</strong><span>{money(q.ratePerPart)}/part · {q.leadDays} lead day(s)</span><small>{q.quoteReference || "No quote reference"} · {q.status}</small></div>) : <div className="vendor-empty">No quotations recorded for this operation yet. Add a quote from Costing.</div>}</div>
        </> : <div className="module-empty-state"><Workflow size={28}/><h3>Select an operation</h3><p>Operation details, schedule, vendor link, quantities, quality and cost will appear here.</p></div>}
      </details>
    </div>
    <div className="linked-bottom-grid">
      <details open className="surface-panel linked-cost-card"><summary className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COST BREAKDOWN</div><h3>Entered route costs</h3><p>Only rates you entered or selected from quotations are counted.</p></div><CircleDollarSign size={18}/></summary><div className="linked-cost-row"><span>Process cost</span><strong>{money(totalProcessCost)}</strong></div><div className="linked-cost-row"><span>Transport cost</span><strong>{money(totalTransportCost)}</strong></div><div className="linked-cost-row linked-cost-total"><span>Process + transport total</span><strong>{money(componentTotalCost)}</strong></div><button className="button-quiet" onClick={() => onSelectModule("costing",{companyId:selectedPO?.companyId,poId:selectedPO?.id,poLineId:selectedLine?.id,componentId:selectedComponent?.id})}><CircleDollarSign size={14}/> Open detailed costing</button></details>
      <details open className="surface-panel linked-timeline-card" id="linked-timeline"><summary className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> TIMELINE & DELIVERY</div><h3>Planned progress</h3><p>Schedule is based on saved operation dates, not estimated samples.</p></div><CalendarClock size={18}/></summary><div className="linked-timeline-facts"><div><small>FIRST PLANNED START</small><strong>{shortDate(timelineStart)}</strong></div><div><small>LAST OPERATION TARGET</small><strong>{shortDate(timelineEnd)}</strong></div><div><small>SUM OF OPERATION DAYS</small><strong>{durationDays || "—"} days</strong></div><div><small>PO DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div></div><div className={"linked-delivery-state " + (lateOps.length ? "linked-delivery-late" : "")}><span>{lateOps.length ? <ShieldAlert size={16}/> : <Activity size={16}/>}</span><div><strong>{lateOps.length ? "Delay risk detected" : allDone ? "All saved operations complete" : "Delivery forecast awaits schedule data"}</strong><small>{lateOps.length ? lateOps.length + " operation(s) are past their planned target date." : "ETA can be assessed once operation schedules and dependencies are entered."}</small></div></div></details>
    </div>
    <details open className="surface-panel linked-process-table"><summary className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> DETAILED OPERATION LIST</div><h3>Process list ({routeOperations.length} operations)</h3><p>Values remain component- and PO-line-specific.</p></div><span className="module-number">{routeOperations.length} ROWS</span></summary>
      {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Seq</th><th>Operation</th><th>Type</th><th>Vendor</th><th>Machine / station</th><th>Planned start</th><th>Planned target</th><th>Days</th><th>Qty</th><th>Accepted</th><th>Status</th><th>Payment</th><th>Planned rate</th><th>Actual rate</th><th>Process amount</th><th>Transport amount</th><th>Process + transport total</th></tr></thead><tbody>{routeOperations.map(op => <tr key={op.id} className={activeOperation?.id === op.id ? "linked-table-selected" : ""} onClick={() => setSelectedOperationId(op.id)}><td>{op.sequence}</td><td><button className="inline-module-link" onClick={e=>{e.stopPropagation();setSelectedOperationId(op.id);}}>{op.name}</button></td><td>{op.category || "—"}</td><td>{vendors.find(v=>v.id===op.vendorId)?.company || "Unassigned"}</td><td>{op.machine || "—"}</td><td>{shortDate(op.plannedStart)}</td><td>{shortDate(op.plannedEnd)}</td><td>{daysBetween(op.plannedStart,op.plannedEnd) || "—"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{op.accepted.toLocaleString("en-IN")}</td><td><span className={"record-state state-" + op.status.toLowerCase().replace(/\s+/g,"-")}>{op.status}</span></td><td>{op.paymentStatus || "Unpaid"}</td><td>{money(op.ratePerPart)}</td><td>{op.actualRatePerPart ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.quantity*(op.actualRatePerPart||op.ratePerPart))}</td><td>{money(operationTransportAmount(op))}</td><td>{money(op.quantity*(op.actualRatePerPart||op.ratePerPart)+operationTransportAmount(op))}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No operation rows for the selected PO component.</div>}
      {!firstMainRouteOperation && unanchoredTransportCost>0 && <div className="process-list-component-transport-summary"><div><strong>Component-start transport cost</strong><small>Saved transport leg is not assigned to a process operation.</small></div><strong>{money(unanchoredTransportCost)}</strong></div>}
    </details>
    <section className="process-export-print-only">
      <h1>AXIMACH · PROCESS MAP</h1>
      <p>{selectedComponent?.partNumber || "Component"} · {selectedComponent?.name || ""} · {selectedPO?.number || "No PO"} · {exportOperations.length} operation(s)</p>
      <table><thead><tr>{exportColumns.map(field=><th key={field.key}>{field.label}</th>)}</tr></thead>
        <tbody>{exportOperations.map(op=><tr key={op.id}>{exportColumns.map(field=><td key={field.key}>{String(exportValue(op,field.key) ?? "")}</td>)}</tr>)}</tbody>
      </table>
      <small>Generated from saved AXIMACH operation records. Current export scope and selected fields applied.</small>
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Each route is keyed by PO line and component ID; no example company, PO, part number, quote or vendor is preloaded. Server-wide cross-device sync requires the existing AXIMACH server to be deployed with persistent storage and configured in Communication & Follow-up.</span></div>
  </section>;
}
