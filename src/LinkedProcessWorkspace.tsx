import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowDown, ArrowRight, ArrowUp, Boxes, CalendarClock, Check, CircleDollarSign, ClipboardCheck, FileText, FileDown, Printer, GitBranch, Package, Plus, Search, ShieldAlert, ShieldCheck, Truck, Users, Workflow, Wrench, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ComponentTransportLegRecord, type LifecycleStatus, type OperationRecord, type PurchaseOrderLine } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import { ProcessIcon } from "./IconStudio";
import ProcessUniverse3D from "./ProcessUniverse3D";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void; onOpenIconStudio?: () => void; onScheduleVendor?: (vendorId:string, operationId:string, processName:string) => void };
type ProcessExportField = "company" | "po" | "component" | "componentNumber" | "operation" | "category" | "subcategory" | "execution" | "description" | "vendor" | "transportVendor" | "transportRoute" | "vehicle" | "quantity" | "quantityUnit" | "completed" | "rejected" | "status" | "tolerance" | "inspection" | "paymentStatus" | "paidAmount" | "plannedStart" | "plannedEnd" | "price" | "transportCost" | "amount";
const PROCESS_EXPORT_FIELDS: Array<{key:ProcessExportField;label:string}> = [
  {key:"company",label:"Company"},{key:"po",label:"PO number"},{key:"component",label:"Component name"},{key:"componentNumber",label:"Component number"},
  {key:"operation",label:"Process"},{key:"category",label:"Category"},{key:"subcategory",label:"Subcategory"},{key:"execution",label:"Execution type"},
  {key:"description",label:"Operation notes"},{key:"vendor",label:"Vendor"},{key:"transportVendor",label:"Transport vendor"},
  {key:"transportRoute",label:"Transport route"},{key:"vehicle",label:"Vehicle type"},{key:"quantity",label:"Planned quantity"},{key:"quantityUnit",label:"Quantity unit"},
  {key:"completed",label:"Completed quantity"},{key:"rejected",label:"Rejected quantity"},{key:"status",label:"Status"},
  {key:"tolerance",label:"Tolerance"},{key:"inspection",label:"Inspection result"},{key:"paymentStatus",label:"Payment status"},
  {key:"paidAmount",label:"Paid amount"},{key:"plannedStart",label:"Start date/time"},{key:"plannedEnd",label:"Due date/time"},
  {key:"price",label:"Price / piece or set"},{key:"transportCost",label:"Transport cost"},{key:"amount",label:"Process + transport amount"}
];
type DraftOperation = Pick<OperationRecord, "name" | "category" | "machine" | "vendorId" | "status" | "plannedStart" | "plannedEnd" | "actualStart" | "actualEnd" | "transportVendorId" | "transportFrom" | "transportTo" | "transportVehicleType" | "transportRouteId" | "quantity" | "completed" | "accepted" | "rejected" | "ratePerPart" | "actualRatePerPart" | "inspectionResult" | "transportCost" | "transportPickup" | "transportDelivery" | "qualityNotes" | "notes" | "branch"> & { paymentStatus:"Paid"|"Unpaid"; paidAmount:number; paymentReference:string; subcategory:string; executionType:"Internal"|"Outsourced"; toleranceCategory:"Standard"|"Precision"|"Close"|"Ultra Precision"; inspectionRequired:boolean; processCostTotal:number; parentId?:string; relationType?:"subprocess"|"alternate"|"rework"; costIncluded:boolean };
const blankOperation = (line?: PurchaseOrderLine): DraftOperation => ({
  name: "", category: "", machine: "", vendorId: "", status: "Planned", executionType:"Outsourced", toleranceCategory:"Standard", inspectionRequired:false, plannedStart: "", plannedEnd: line?.targetDelivery ? (line.targetDelivery.includes("T")?line.targetDelivery:line.targetDelivery+"T08:00") : "", actualStart: "", actualEnd: "",
  quantity: line?.quantity || 0, completed: 0, accepted: 0, rejected: 0, ratePerPart: 0, actualRatePerPart: 0, processCostTotal: 0, paymentStatus:"Unpaid", paidAmount:0, paymentReference:"", subcategory:"",
  transportVendorId: "", transportFrom:"", transportTo:"", transportVehicleType:"", transportRouteId:"", transportCost: 0, transportPickup: "", transportDelivery: "", qualityNotes: "", inspectionResult: "", notes: "", branch: "Main route", costIncluded: true
});
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const dateValue = (value: string) => new Date(value.includes("T") ? value : value + "T12:00:00");
const dateTimeInput = (value?: string) => value ? (value.includes("T") ? value.slice(0,16) : value+"T08:00") : "";
const shortDate = (value?: string) => value ? dateValue(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", ...(value.includes("T") ? {hour:"2-digit",minute:"2-digit"} : {}) }) : "Not set";
const daysBetween = (start?: string, end?: string) => start && end ? Math.max(1, Math.round((dateValue(end).getTime() - dateValue(start).getTime()) / 86400000) + 1) : 0;

export default function LinkedProcessWorkspace({ onBack, onNotice, notice, onSelectModule, onOpenIconStudio, onScheduleVendor }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const purchaseOrders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const processDefinitions = activeRows(data.processDefinitions);
  const transportRoutes = activeRows(data.transportRoutes || []);
  const allTransportLegs = activeRows(data.transportLegs || []);

  const [companyId, setCompanyId] = useState("");
  const [poId, setPoId] = useState("");
  const [poLineId, setPoLineId] = useState("");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [search, setSearch] = useState("");
  const [vertical, setVertical] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [routeView, setRouteView] = useState<"3d" | "list">("3d");
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationIndex, setSimulationIndex] = useState(-1);
  const [showEditor, setShowEditor] = useState(false);
  const [showTransportEditor, setShowTransportEditor] = useState(false);
  const [editingTransportLegId, setEditingTransportLegId] = useState("");
  const [transportRouteId, setTransportRouteId] = useState("");
  const [transportTripCount, setTransportTripCount] = useState("1");
  const [transportAnchorOperationId, setTransportAnchorOperationId] = useState("");
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


  const companyOrders = purchaseOrders.filter(p => p.companyId === companyId);
  const selectedPO = purchaseOrders.find(p => p.id === poId);
  const selectedCompany = companies.find(company => company.id === companyId);
  const poLines = selectedPO ? selectedPO.lines.filter(line => !("deletedAt" in line && (line as PurchaseOrderLine & {deletedAt?: string}).deletedAt)) : [];
  const selectedLine = poLines.find(line => line.id === poLineId);
  const selectedComponent = components.find(component => component.id === selectedLine?.componentId);
  const selectedProcessDefinition = processDefinitions.find(item => item.processType === draft.name && item.category === draft.category);
  const routeOperations = operations.filter(op => op.poLineId === poLineId && op.poId === poId && op.componentId === selectedLine?.componentId).sort((a,b) => a.sequence - b.sequence);
  const componentTransportLegs = allTransportLegs.filter(leg => leg.poLineId === poLineId && leg.poId === poId && leg.componentId === selectedLine?.componentId).sort((a,b) => a.sequence - b.sequence);
  const selectedTransportDirectoryRoute = transportRoutes.find(route => route.id === transportRouteId);
  const processCategories = [...new Set(processDefinitions.map(item => item.category).filter(Boolean))].sort();
  const processTypeOptions = [...new Set(processDefinitions.filter(item => !draft.category || item.category === draft.category).map(item => item.processType).filter(Boolean))].sort();
  const processFilterTypes = [...new Set(processDefinitions.map(item => item.processType).filter(Boolean))].sort();
  const processSubcategories = [...new Set(processDefinitions.flatMap(item => item.subcategories || []).filter(Boolean))].sort();
  const quantityUnit = selectedComponent?.salePriceUnit === "set" ? "sets" : "pieces";
  const processVendorOptions = selectedProcessDefinition?.vendorIds?.length ? vendors.filter(vendor => selectedProcessDefinition.vendorIds.includes(vendor.id)) : vendors;
  const selectedTransportVendor = vendors.find(vendor => vendor.id === draft.transportVendorId);
  const selectedTransportRoutes = selectedTransportVendor?.transportRoutes || [];
  const visibleOperations = routeOperations.filter(op => {
    const text = [op.name,op.category,op.subcategory,op.machine,op.executionType,op.status,op.branch,op.plannedStart,op.plannedEnd,op.actualStart,op.actualEnd,op.quantity,op.completed,op.accepted,op.rejected,op.ratePerPart,op.actualRatePerPart,op.transportCost,op.paymentStatus,op.paidAmount,op.toleranceCategory,op.inspectionResult,op.qualityNotes,op.notes,op.transportFrom,op.transportTo,op.transportVehicleType,vendors.find(v => v.id === op.vendorId)?.company,vendors.find(v => v.id === op.transportVendorId)?.company].join(" ").toLowerCase();
    const statusMatch = !statusFilters.length || statusFilters.includes(op.status);
    const executionMatch = !executionFilters.length || executionFilters.includes(op.executionType || "Outsourced");
    const categoryMatch = !categoryFilters.length || categoryFilters.includes(op.category);
    const toleranceMatch = !toleranceFilters.length || toleranceFilters.includes(op.toleranceCategory || "Standard");
    const paymentMatch = !paymentFilters.length || paymentFilters.includes(op.paymentStatus || "Unpaid");
    const vendorMatch = !vendorFilters.length || vendorFilters.includes(op.vendorId);
    const processTypeMatch = !processTypeFilters.length || processTypeFilters.includes(op.name);
    const subcategoryMatch = !subcategoryFilters.length || subcategoryFilters.includes(op.subcategory || "");
    const operationDate = (op.plannedEnd || op.plannedStart || "").slice(0,10);
    const dateMatch = (!dateFrom || Boolean(operationDate && operationDate >= dateFrom)) && (!dateTo || Boolean(operationDate && operationDate <= dateTo));
    const quantityMatch = (!minQuantity || op.quantity >= Number(minQuantity)) && (!maxQuantity || op.quantity <= Number(maxQuantity));
    const effectivePrice = op.actualRatePerPart || op.ratePerPart;
    const effectiveAmount = op.quantity * effectivePrice + op.transportCost;
    const priceMatch = (!minPrice || effectivePrice >= Number(minPrice)) && (!maxPrice || effectivePrice <= Number(maxPrice));
    const amountMatch = (!minAmount || effectiveAmount >= Number(minAmount)) && (!maxAmount || effectiveAmount <= Number(maxAmount));
    return text.includes(search.toLowerCase().trim()) && statusMatch && executionMatch && categoryMatch && toleranceMatch && paymentMatch && vendorMatch && processTypeMatch && subcategoryMatch && dateMatch && quantityMatch && priceMatch && amountMatch;
  });
  const visibleBranches = [...new Set(visibleOperations.map(op => op.branch || "Main route"))];
  const toggleFilter = (setter: (next: string[] | ((previous: string[]) => string[])) => void, value: string) => setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const clearAllFilters = () => { setSearch(""); setStatusFilters([]); setExecutionFilters([]); setCategoryFilters([]); setToleranceFilters([]); setPaymentFilters([]); setVendorFilters([]); setProcessTypeFilters([]); setSubcategoryFilters([]); setCategorySearch(""); setDateFrom(""); setDateTo(""); setMinQuantity(""); setMaxQuantity(""); setMinPrice(""); setMaxPrice(""); setMinAmount(""); setMaxAmount(""); setSelectedOperationIds([]); };
  const toggleOperationSelection = (id: string) => setSelectedOperationIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const selectVisibleOperations = (checked: boolean) => setSelectedOperationIds(current => checked ? [...new Set([...current, ...visibleOperations.map(op => op.id)])] : current.filter(id => !visibleOperations.some(op => op.id === id)));
  const selectedVisibleOperations = visibleOperations.filter(op => selectedOperationIds.includes(op.id));
  const applyBulkUpdate = () => {
    const ids = new Set(selectedVisibleOperations.map(op => op.id));
    if (!ids.size) { onNotice("Select one or more visible process operations first."); return; }
    const stamp = nowIso();
    update(current => ({ ...current, operations: current.operations.map(op => !ids.has(op.id) ? op : {
      ...op,
      ...(bulkStatus ? { status: bulkStatus as LifecycleStatus } : {}),
      ...(bulkVendorId ? { vendorId: bulkVendorId } : {}),
      ...(bulkStart ? { plannedStart: bulkStart } : {}),
      ...(bulkEnd ? { plannedEnd: bulkEnd } : {}),
      updatedAt: stamp
    }) }));
    onNotice("Bulk update applied to " + ids.size + " selected operation(s).");
    setBulkStatus(""); setBulkVendorId(""); setBulkStart(""); setBulkEnd("");
  };

  const activeOperation = routeOperations.find(op => op.id === selectedOperationId) || routeOperations[0];
  const selectedRouteOperations = routeOperations.filter(op => selectedOperationIds.includes(op.id));
  const routeBranchNames = [...new Set(routeOperations.map(op => op.branch || "Main route"))]
    .sort((a,b) => a === "Main route" ? -1 : b === "Main route" ? 1 : a.localeCompare(b));
  const getRouteScopeOperations = (scope: string): OperationRecord[] => {
    const branchName = (operation: OperationRecord) => operation.branch || "Main route";
    if (scope === "all") return routeOperations;
    if (scope === "main") return routeOperations.filter(op => branchName(op) === "Main route");
    if (scope === "alternate") return routeOperations.filter(op => branchName(op) !== "Main route" && !/rework/i.test(branchName(op)));
    if (scope === "rework") return routeOperations.filter(op => /rework/i.test(branchName(op)));
    if (scope === "filtered") return visibleOperations;
    if (scope === "selected-operations") return selectedRouteOperations;
    if (scope === "selected-operation") return activeOperation ? [activeOperation] : [];
    if (scope === "selected-branch") return activeOperation ? routeOperations.filter(op => branchName(op) === branchName(activeOperation)) : [];
    if (scope.startsWith("branch:")) {
      const branch = scope.slice("branch:".length);
      return routeOperations.filter(op => branchName(op) === branch);
    }
    return routeOperations;
  };
  const routeScopeButtons = [
    { key: "all", label: "All routes", count: routeOperations.length },
    { key: "main", label: "Main route", count: routeOperations.filter(op => (op.branch || "Main route") === "Main route").length },
    { key: "alternate", label: "Alternate routes", count: routeOperations.filter(op => (op.branch || "Main route") !== "Main route" && !/rework/i.test(op.branch || "")).length },
    { key: "rework", label: "Rework routes", count: routeOperations.filter(op => /rework/i.test(op.branch || "")).length },
    { key: "selected-branch", label: "Selected branch", count: activeOperation ? routeOperations.filter(op => (op.branch || "Main route") === (activeOperation.branch || "Main route")).length : 0 },
    { key: "filtered", label: "Filtered results", count: visibleOperations.length },
    { key: "selected-operations", label: "Selected operations", count: selectedRouteOperations.length },
    { key: "selected-operation", label: "Selected operation", count: activeOperation ? 1 : 0 },
    ...routeBranchNames.filter(name => name !== "Main route").map(name => ({
      key: "branch:" + name, label: name, count: routeOperations.filter(op => (op.branch || "Main route") === name).length
    }))
  ];
  const exportScopeLabel = routeScopeButtons.find(scope => scope.key === exportScope)?.label || "All routes";
  const paymentRowsFor = (operationId:string) => activeRows(data.paymentTransactions).filter(payment=>payment.operationId===operationId);
  const paymentTotalFor = (operation:OperationRecord) => {
    const transactions=paymentRowsFor(operation.id);
    return transactions.length?transactions.reduce((sum,payment)=>sum+Math.max(0,Number(payment.amount)||0),0):Math.max(0,Number(operation.paidAmount)||0);
  };
  const totalProcessCost = routeOperations.reduce((sum, op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const expectedQuantity = selectedLine?.quantity || 0;
  const completedQuantity = routeOperations.length ? Math.min(...routeOperations.map(op => op.accepted || 0)) : 0;
  const finalRouteOperation = [...routeOperations].filter(op=>(op.branch||"Main route")==="Main route").sort((a,b)=>a.sequence-b.sequence).at(-1) || routeOperations[routeOperations.length-1];
  const finalCompletedQty = Math.min(expectedQuantity,Math.max(0,finalRouteOperation?.accepted||finalRouteOperation?.completed||0));
  const pendingProductionQty = Math.max(0,expectedQuantity-finalCompletedQty);
  const inProgressProductionQty = Math.min(pendingProductionQty,routeOperations.filter(op=>op.status==="Running").reduce((sum,op)=>sum+Math.max(0,op.quantity-op.completed),0));
  const plannedProductionQty = expectedQuantity;
  const completionPercent = plannedProductionQty>0?Math.round(finalCompletedQty/plannedProductionQty*100):0;
  const vendorAssignedPercent = routeOperations.length?Math.round(routeOperations.filter(op=>op.executionType==="Internal"||Boolean(op.vendorId)).length/routeOperations.length*100):0;
  const lateOps = routeOperations.filter(op => op.plannedEnd && op.status !== "Complete" && op.plannedEnd.slice(0,10) < new Date().toISOString().slice(0, 10));
  const delayedPercent = routeOperations.length?Math.round(lateOps.length/routeOperations.length*100):0;
  const transportCount = routeOperations.filter(op => op.transportCost > 0 || op.transportVendorId).length;
  const totalAccepted = routeOperations.reduce((sum, op) => sum + op.accepted, 0);
  const allDone = routeOperations.length > 0 && routeOperations.every(op => op.status === "Complete");
  const finalDelivery = selectedLine?.targetDelivery || selectedPO?.targetDelivery || "";
  const routeCost = routeOperations.reduce((sum, op) => sum + op.quantity * op.ratePerPart + op.transportCost, 0);
  const durationDays = routeOperations.reduce((sum, op) => sum + daysBetween(op.plannedStart, op.plannedEnd), 0);
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
  const exportOperations = getRouteScopeOperations(exportScope);
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
      case "amount": return op.quantity*(op.actualRatePerPart||op.ratePerPart)+op.transportCost;
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
        { header: "Parent operation ID", key: "parentId", width: 38 }, { header: "Operation ID", key: "id", width: 38 },
        { header: "Process", key: "process", width: 28 }, { header: "Next arrow", key: "next", width: 18 }
      ];
      route.addRows(exportOperations.map((op, index) => ({
        sequence: op.sequence, branch: op.branch || "Main route", parentId: op.parentId || "", id: op.id,
        process: op.name, next: exportArrows && index < exportOperations.length - 1 ? "Next operation" : ""
      })));
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
    const branches=[...new Set(exportOperations.map(op=>op.branch||"Main route"))];
    const maxNodes=Math.max(1,...branches.map(branch=>exportOperations.filter(op=>(op.branch||"Main route")===branch).length));
    const detailsCount=Math.max(1,exportColumns.filter(field=>field.key!=="operation").length);
    const cardHeight=78+detailsCount*17;
    const laneHeight=cardHeight+40;
    const width=Math.max(900,90+maxNodes*270),height=Math.max(240,100+branches.length*laneHeight);
    const svgText=(x:number,y:number,value:unknown,size=12,color="#dceefa",weight=500)=>"<text x=\""+x+"\" y=\""+y+"\" fill=\""+color+"\" font-family=\"Arial\" font-size=\""+size+"\" font-weight=\""+weight+"\">"+escapeSvg(value)+"</text>";
    const content=branches.map((branch,lane)=>{
      const rows=exportOperations.filter(op=>(op.branch||"Main route")===branch),y=75+lane*laneHeight;
      const cards=rows.map((op,index)=>{
        const x=42+index*270,details=exportColumns.filter(field=>field.key!=="operation");
        const info=details.map((field,i)=>svgText(x+12,y+75+i*17,field.label+": "+exportValue(op,field.key),10,"#a9c5d7",400)).join("");
        const arrow=exportArrows&&index<rows.length-1?"<path d=\"M"+(x+222)+" "+(y+45)+"h36\" stroke=\"#62cde0\" stroke-width=\"2\" fill=\"none\" marker-end=\"url(#a)\"/>":"";
        return arrow+"<rect x=\""+x+"\" y=\""+y+"\" width=\"220\" height=\""+cardHeight+"\" rx=\"12\" fill=\"#102c43\" stroke=\"#3c8da9\"/>"+svgText(x+12,y+22,"OP-"+String(op.sequence).padStart(3,"0")+" · "+op.status,9,"#79b6c8",600)+svgText(x+12,y+48,op.name,14,"#effaff",700)+info;
      }).join("");
      return svgText(42,y-13,branch+" · "+rows.length+" STAGE(S)",10,"#7cb8ca",700)+cards;
    }).join("");
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\""+width+"\" height=\""+height+"\" viewBox=\"0 0 "+width+" "+height+"\"><defs><marker id=\"a\" markerWidth=\"8\" markerHeight=\"8\" refX=\"7\" refY=\"4\" orient=\"auto\"><path d=\"M0 0L8 4L0 8Z\" fill=\"#62cde0\"/></marker></defs><rect width=\"100%\" height=\"100%\" fill=\"#071a2b\"/>"+svgText(42,35,(selectedComponent?.partNumber||"AXIMACH")+" · "+(selectedPO?.number||"PROCESS MAP"),19,"#fff",700)+content+"</svg>";
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
  }, [companies, purchaseOrders, companyId, poId, poLineId]);

  useEffect(() => {
    const current = routeOperations.find(operation => operation.id === selectedOperationId);
    const next = current || routeOperations[0];
    if ((next?.id || "") !== selectedOperationId) setSelectedOperationId(next?.id || "");
  }, [routeOperations, selectedOperationId]);

  useEffect(() => {
    if (!simulationActive) return;
    if (!visibleOperations.length || simulationIndex >= visibleOperations.length - 1) {
      setSimulationActive(false);
      return;
    }
    const timer = window.setTimeout(() => setSimulationIndex(index => index + 1), 950);
    return () => window.clearTimeout(timer);
  }, [simulationActive, simulationIndex, visibleOperations.length]);

  const startRouteSimulation = () => {
    if (!visibleOperations.length) { onNotice("Add at least one real operation before previewing the route."); return; }
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
    const parent = routeOperations.find(operation => operation.id === parentId);
    if (!parent) return;
    const base = blankOperation(selectedLine);
    base.category = parent.category;
    base.vendorId = parent.vendorId;
    base.executionType = parent.executionType || "Outsourced";
    base.branch = parent.branch || "Main route";
    setDraft({ ...base, parentId, relationType:"subprocess" });
    setSelectedOperationId(parentId);
    setEditingId("");
    setShowEditor(true);
    onNotice("Add a sub-process under " + parent.name + ". The parent vendor is preselected; you can keep or change it.");
  };

  const startAdd = (branch = false, transport = false) => {
    if (!selectedPO || !selectedLine || !selectedComponent) {
      onNotice("Select a saved company, purchase order and PO component line first. AXIMACH will then link every operation to that line.");
      return;
    }
    const base = blankOperation(selectedLine);
    if (transport) { base.name = "Transport / handover"; base.category = "Logistics"; base.branch = "Main route"; }
    if (branch && activeOperation) { base.branch = "Rework · OP-" + String(activeOperation.sequence).padStart(3,"0"); base.name = "Rework operation"; base.parentId = activeOperation.id; base.relationType = "rework"; base.costIncluded = false; }
    setDraft(base);
    setEditingId("");
    setShowEditor(true);
  };
  const startAddBranch = (kind: "alternate" | "rework", anchorId?: string) => {
    const anchor = routeOperations.find(operation => operation.id === (anchorId || activeOperation?.id));
    if (!selectedPO || !selectedLine || !selectedComponent || !anchor) { onNotice("Select the exact process node where the alternate or rework branch must connect."); return; }
    const base = blankOperation(selectedLine);
    base.branch = (kind === "alternate" ? "Alternate route" : "Rework") + " · OP-" + String(anchor.sequence).padStart(3, "0") + " · " + anchor.name;
    base.name = kind === "alternate" ? "Alternate route operation" : "Rework operation";
    base.category = anchor.category;
    base.vendorId = anchor.vendorId;
    base.executionType = anchor.executionType || "Outsourced";
    base.parentId = anchor.id;
    base.relationType = kind;
    base.costIncluded = false;
    setDraft(base);
    setSelectedOperationId(anchor.id);
    setEditingId("");
    setShowEditor(true);
    onNotice((kind === "alternate" ? "Alternate route" : "Rework branch") + " will connect from " + anchor.name + ". It is excluded from Process Cost until you include it in costing.");
  };

  const editActive = (operationId?: string) => {
    const targetOperation = operationId ? routeOperations.find(op=>op.id===operationId) : activeOperation;
    if (!targetOperation) return;
    setSelectedOperationId(targetOperation.id);
    setDraft({
      name: targetOperation.name, category: targetOperation.category, machine: targetOperation.machine, vendorId: targetOperation.vendorId, executionType:targetOperation.executionType||"Outsourced", toleranceCategory:targetOperation.toleranceCategory||"Standard", inspectionRequired:Boolean(targetOperation.inspectionRequired),
      status: targetOperation.status, plannedStart: targetOperation.plannedStart, plannedEnd: targetOperation.plannedEnd, actualStart: targetOperation.actualStart || "", actualEnd: targetOperation.actualEnd || "",
      quantity: targetOperation.quantity, completed: targetOperation.completed, accepted: targetOperation.accepted, rejected: targetOperation.rejected,
      ratePerPart: targetOperation.ratePerPart, processCostTotal: targetOperation.quantity * targetOperation.ratePerPart, actualRatePerPart: targetOperation.actualRatePerPart || 0, transportVendorId: targetOperation.transportVendorId || "", transportFrom:targetOperation.transportFrom||"",transportTo:targetOperation.transportTo||"",transportVehicleType:targetOperation.transportVehicleType||"",transportRouteId:targetOperation.transportRouteId||"", transportCost: targetOperation.transportCost, transportPickup: targetOperation.transportPickup,
      transportDelivery: targetOperation.transportDelivery, qualityNotes: targetOperation.qualityNotes, inspectionResult: targetOperation.inspectionResult || "", notes: targetOperation.notes, branch: targetOperation.branch, parentId:targetOperation.parentId||"", relationType:targetOperation.relationType, costIncluded:targetOperation.costIncluded ?? (targetOperation.relationType !== "alternate" && targetOperation.relationType !== "rework"), paymentStatus:targetOperation.paymentStatus||"Unpaid", paidAmount:paymentTotalFor(targetOperation), paymentReference:targetOperation.paymentReference||"", subcategory:targetOperation.subcategory||""
    });
    setEditingId(targetOperation.id); setShowEditor(true);
  };
  const saveOperation = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line first."); return; }
    if (!draft.name.trim()) { onNotice("Enter the operation name."); return; }
    if (draft.executionType === "Outsourced" && !draft.vendorId && draft.category !== "Logistics") { onNotice("Select a vendor for an outsourced operation, or change execution to Internal."); return; }
    if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) { onNotice("Target/end date cannot be before planned start date."); return; }
    if (draft.accepted + draft.rejected > draft.completed) { onNotice("Accepted plus rejected quantity cannot exceed completed quantity."); return; }
    if (draft.paymentStatus === "Paid" && !(Number(draft.paidAmount) > 0)) { onNotice("Enter the actual amount paid before marking this operation Paid."); return; }
    const previousOperation = operations.find(op=>op.id===editingId);
    const previousPaidTotal = previousOperation ? paymentTotalFor(previousOperation) : 0;
    const nextPaidTotal = Math.max(0,Number(draft.paidAmount)||0);
    if (nextPaidTotal + 0.000001 < previousPaidTotal) { onNotice("Recorded payment totals cannot be reduced. Keep the previous total and add a separate correction record through the finance ledger."); return; }
    const stamp = nowIso();
    const operationId = editingId || makeId("operation");
    update(current => {
      const currentRoute = current.operations.filter(op => op.poLineId === selectedLine.id && op.poId === selectedPO.id && op.componentId === selectedComponent.id && !op.deletedAt);
      const old = current.operations.find(op => op.id === operationId);
      const next: OperationRecord = {
        id: operationId, poId: selectedPO.id, poLineId: selectedLine.id, componentId: selectedComponent.id,
        sequence: old?.sequence ?? (Math.max(0, ...currentRoute.map(op => op.sequence)) + 10),
        ...draft, paidAmount: nextPaidTotal, vendorId: draft.vendorId || "", actualRatePerPart: draft.actualRatePerPart || 0, transportVendorId: draft.transportVendorId || "",
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
      return { ...current, operations: [...current.operations.filter(op => op.id !== next.id), next], paymentTransactions: paymentRecords };
    });
    setSelectedOperationId(operationId);
    setShowEditor(false); setEditingId("");
    onNotice(editingId ? "Operation updated and linked to its PO line/component ID." : "Operation saved against the selected PO line. Cost and dates remain separate for this component.");
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
          const lineOperations = nextOperations.filter(op => op.poId === order.id && op.poLineId === line.id && !op.deletedAt);
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
  const openTransportEditor = (leg?: ComponentTransportLegRecord) => {
    setEditingTransportLegId(leg?.id || "");
    setTransportRouteId(leg?.routeId || transportRoutes[0]?.id || "");
    setTransportTripCount(String(leg?.tripCount || 1));
    setTransportAnchorOperationId(leg?.anchorOperationId || activeOperation?.id || "");
    setTransportLegNotes(leg?.notes || "");
    setShowTransportEditor(true);
    setShowEditor(false);
  };
  const closeTransportEditor = () => { setShowTransportEditor(false); setEditingTransportLegId(""); };
  const saveTransportLeg = () => {
    if (!selectedPO || !selectedLine || !selectedComponent) { onNotice("Select a PO component line before adding transport."); return; }
    if (!selectedTransportDirectoryRoute) { onNotice("Select a saved route from Transport Directory, or add one there first."); return; }
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
      anchorOperationId: transportAnchorOperationId, notes: transportLegNotes.trim(),
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
    const index = routeOperations.findIndex(op => op.id === id);
    const current = routeOperations[index];
    const neighbor = routeOperations[index + direction];
    if (!current || !neighbor) return;
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
    const unfinishedCount = routeOperations.filter(operation => operation.status !== "Complete").length;
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
  const deliveryState = !finalDelivery ? "No delivery date" : allDone ? "Route complete" : lateOps.length ? "At risk" : "Scheduled";
  const tab = (id: string, title: string, Icon: typeof Workflow) => <button key={id} className={"route-tab " + (id === "process-map" ? "route-tab-current" : "")} onClick={() => id === "process-map" ? undefined : onSelectModule(id === "components" ? "components" : id === "purchasing" ? "purchasing" : id === "inventory" ? "inventory" : id === "costing" ? "costing" : id === "documents" ? "engineering-change" : id === "history" ? "reports" : "quality")}><Icon size={14}/>{title}</button>;

  return <section className="workspace-page linked-process-page">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED DATA CONNECTED" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR · LOCAL COPY KEPT" : "NO DEMO DATA · LOCAL UNTIL SERVER SYNC"}</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> ENGINEERING / LINKED PROCESS ROUTE</div><h1>Process Map<span>.</span></h1><p>Choose existing master records once; operation schedules, rates, vendor assignments, quality and quotations attach to the selected PO component line.</p></div><div className="workspace-title-actions"><button className="button-quiet" onClick={() => onSelectModule("vendors")}><Users size={15}/> Vendors</button><button className="button-primary" onClick={() => startAdd()} disabled={!selectedLine}><Plus size={15}/> Add Operation</button></div></div>
    <div className="linked-master-selectors">
      <SearchablePicker id="route-company" label="Company" value={companyId} placeholder="Type company name…" options={companies.map(c=>({id:c.id,label:c.name+(c.gstin?" · "+c.gstin:"")}))} onChange={changeSelection}/>
      <div className="route-master-picker"><SearchablePicker id="route-po" label="Purchase order" value={poId} placeholder="Type PO number…" options={companyOrders.map(po=>({id:po.id,label:po.number+" · "+po.status}))} onChange={changePO}/>{companyId&&!companyOrders.length&&<button type="button" onClick={()=>onSelectModule("purchasing")}>Add PO</button>}</div>
      <div className="route-master-picker"><SearchablePicker id="route-component-line" label="PO component line" value={poLineId} placeholder="Type part number or name…" options={poLines.map(line=>{const component=components.find(item=>item.id===line.componentId);return {id:line.id,label:(component?component.partNumber+" · "+component.name:"Missing component")+" · "+line.quantity.toLocaleString("en-IN")+" "+(component?.salePriceUnit==="set"?"sets":"pieces")};})} onChange={changeLine}/>{poId&&!poLines.length&&<button type="button" onClick={()=>onSelectModule("purchasing")}>Add PO lines</button>}</div>
    </div>
    {selectedLine ? <>
      {selectedComponent && <div className="linked-component-summary"><div><small>SELECTED COMPONENT</small><strong>{selectedComponent.partNumber} · {selectedComponent.name}</strong><span>Revision {selectedComponent.revision || "—"} · PO {selectedPO?.number}</span></div><div><small>ORDER QUANTITY</small><strong>{expectedQuantity.toLocaleString("en-IN")} {quantityUnit}</strong></div><div><small>LINE DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div><div><small>DRAWING / REFERENCE</small><strong>{selectedComponent.drawingReference || "Not entered"}</strong></div><button className="button-quiet compact-button" onClick={() => onSelectModule("components")}>Edit component master</button></div>}
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
        <button className="route-kpi kpi-cost" onClick={() => onSelectModule("costing")}><span className="kpi-icon"><CircleDollarSign size={19}/></span><span><small>ENTERED PROCESS + TRANSPORT COST</small><strong>{money(routeCost)}</strong><em>Rates from this component route only</em></span></button>
        <button className="route-kpi kpi-transport"><span className="kpi-icon"><Truck size={19}/></span><span><small>TRANSPORT ACTIVITIES</small><strong>{transportCount}</strong><em>Operations with transport cost/vendor</em></span></button>
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
        <button className="button-primary compact-button" disabled={!selectedLine} onClick={() => startAdd()}><Plus size={14}/> Add operation</button>
        <button className="button-quiet compact-button" disabled={!selectedLine} onClick={() => startAdd(false, true)}><Truck size={14}/> Add transport</button>
        <button className="button-quiet compact-button" disabled={!selectedLine || !activeOperation} onClick={() => startAdd(true)}><GitBranch size={14}/> Add branch / rework</button>
        <button className="button-quiet compact-button" onClick={() => { setZoom(1); setSearch("");setStatusFilters([]);setExecutionFilters([]);setCategoryFilters([]);setToleranceFilters([]);setPaymentFilters([]);setVendorFilters([]);setDateFrom("");setDateTo("");setMinQuantity("");setMaxQuantity("");setMinPrice("");setMaxPrice("");setMinAmount("");setMaxAmount("");setSelectedOperationIds([]); }}><Search size={14}/> Clear filters</button>
        {onOpenIconStudio && <button className="button-quiet compact-button" onClick={onOpenIconStudio}><Boxes size={14}/> Customise process icons</button>}
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
            onClick={()=>{setVisualStyle(option.id);setRouteView(["sphere","vortex","combined"].includes(option.id)?"3d":"list");setSimulationActive(false);setSimulationIndex(-1);}}>
            {option.label}
          </button>)}
        </div>
        {!simulationActive
          ? <button className="button-primary compact-button" disabled={!visibleOperations.length} onClick={startRouteSimulation}><Activity size={14}/> Simulate route</button>
          : <button className="button-quiet compact-button" onClick={() => setSimulationActive(false)}><Activity size={14}/> Pause simulation</button>}
        <button className="button-quiet compact-button" disabled={simulationIndex < 0} onClick={() => { setSimulationActive(false); setSimulationIndex(-1); }}><Check size={14}/> Reset</button>
        <label className="linked-search"><Search size={14}/><input value={search} onChange={e => { setSearch(e.target.value); setSimulationActive(false); setSimulationIndex(-1); }} placeholder="Search process, category, vendor, date, status…"/></label>
        <input aria-label="Route zoom" type="range" min="0.65" max="1.25" step="0.05" value={zoom} onChange={e => setZoom(Number(e.target.value))}/>
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
    <section className="surface-panel process-map-filter-panel">
      <div className="process-map-filter-grid">
        <div><strong>Process status</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setStatusFilters(["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"])}>All</button><button type="button" onClick={()=>setStatusFilters([])}>Clear</button></div>{["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"].map(value=><label key={value}><input type="checkbox" checked={statusFilters.includes(value)} onChange={()=>toggleFilter(setStatusFilters,value)}/>{value}</label>)}</div>
        <div><strong>Execution</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setExecutionFilters(["Internal","Outsourced"])}>All</button><button type="button" onClick={()=>setExecutionFilters([])}>Clear</button></div>{["Internal","Outsourced"].map(value=><label key={value}><input type="checkbox" checked={executionFilters.includes(value)} onChange={()=>toggleFilter(setExecutionFilters,value)}/>{value}</label>)}</div>
        <div><strong>Process category</strong><input className="process-filter-search" value={categorySearch} onChange={e=>setCategorySearch(e.target.value)} placeholder="Search categories…"/><div className="process-filter-quick-actions"><button type="button" onClick={()=>setCategoryFilters(processCategories)}>All</button><button type="button" onClick={()=>setCategoryFilters([])}>Clear</button></div>{processCategories.filter(value=>value.toLowerCase().includes(categorySearch.toLowerCase().trim())).map(value=><label key={value}><input type="checkbox" checked={categoryFilters.includes(value)} onChange={()=>toggleFilter(setCategoryFilters,value)}/>{value}</label>)}</div>
        <div><strong>Process type</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setProcessTypeFilters(processFilterTypes)}>All</button><button type="button" onClick={()=>setProcessTypeFilters([])}>Clear</button></div>{processFilterTypes.map(value=><label key={value}><input type="checkbox" checked={processTypeFilters.includes(value)} onChange={()=>toggleFilter(setProcessTypeFilters,value)}/>{value}</label>)}</div>
        <div><strong>Subcategory</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setSubcategoryFilters(processSubcategories)}>All</button><button type="button" onClick={()=>setSubcategoryFilters([])}>Clear</button></div>{processSubcategories.map(value=><label key={value}><input type="checkbox" checked={subcategoryFilters.includes(value)} onChange={()=>toggleFilter(setSubcategoryFilters,value)}/>{value}</label>)}</div>
        <div><strong>Tolerance</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setToleranceFilters(["Standard","Precision","Close","Ultra Precision"])}>All</button><button type="button" onClick={()=>setToleranceFilters([])}>Clear</button></div>{["Standard","Precision","Close","Ultra Precision"].map(value=><label key={value}><input type="checkbox" checked={toleranceFilters.includes(value)} onChange={()=>toggleFilter(setToleranceFilters,value)}/>{value}</label>)}</div>
        <div><strong>Payment</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setPaymentFilters(["Paid","Unpaid"])}>All</button><button type="button" onClick={()=>setPaymentFilters([])}>Clear</button></div>{["Paid","Unpaid"].map(value=><label key={value}><input type="checkbox" checked={paymentFilters.includes(value)} onChange={()=>toggleFilter(setPaymentFilters,value)}/>{value}</label>)}</div>
        <div><strong>Vendor</strong><div className="process-filter-quick-actions"><button type="button" onClick={()=>setVendorFilters(vendors.map(v=>v.id))}>All</button><button type="button" onClick={()=>setVendorFilters([])}>Clear</button></div>{vendors.map(v=><label key={v.id}><input type="checkbox" checked={vendorFilters.includes(v.id)} onChange={()=>toggleFilter(setVendorFilters,v.id)}/>{v.company} · {v.contact}</label>)}</div>
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
    </section>
    <div className="linked-process-layout">
      <section className="surface-panel linked-route-canvas">
        <div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> OPERATIONS / LIVE RECORDS</div><h3>{selectedLine ? (selectedComponent?.partNumber || "Component") + " · Route graph" : "Route graph"}</h3><p>{routeOperations.length} saved operations · branches and rework remain attached to this PO line</p></div><span className="module-number">{routeOperations.length} OPS</span></div>
        <div className="process-export-panel">
          <div className="process-export-fields"><div className="process-export-field-actions"><button type="button" onClick={()=>setExportFields(PROCESS_EXPORT_FIELDS.map(field=>field.key))}>Select all fields</button><button type="button" onClick={()=>setExportFields([])}>Clear fields</button></div>{PROCESS_EXPORT_FIELDS.map(field=><label key={field.key}><input type="checkbox" checked={exportFields.includes(field.key)} onChange={()=>setExportFields(current=>current.includes(field.key)?current.filter(key=>key!==field.key):[...current,field.key])}/>{field.label}</label>)}</div>
          <div className="process-export-options" style={{display:"grid",gap:"10px"}}>
            <label><input type="checkbox" checked={exportArrows} onChange={event=>setExportArrows(event.target.checked)}/> Connection arrows</label>
            <div className="process-export-scope-buttons" aria-label="All route export scopes" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"7px"}}>
              <strong>ROUTE SCOPE</strong>
              {routeScopeButtons.map(scope=><button key={scope.key} type="button" aria-pressed={exportScope===scope.key}
                disabled={scope.count===0}
                className={(exportScope===scope.key?"button-primary":"button-quiet")+" compact-button"}
                onClick={()=>setExportScope(scope.key)}>
                {scope.label} <small>({scope.count})</small>
              </button>)}
            </div>
          </div>
          <div className="process-export-actions"><button type="button" className="button-primary compact-button" onClick={exportCsv}><FileDown size={14}/> CSV</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportVisual("svg")}>SVG</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportVisual("png")}>PNG</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportPowerPoint()}><FileText size={14}/> PowerPoint</button><button type="button" className="button-quiet compact-button" onClick={()=>void exportExcel()}><FileDown size={14}/> Excel</button><button type="button" className="button-quiet compact-button" onClick={printExport}><Printer size={14}/> Diagram PDF</button><small>{exportOperations.length} operation(s) · {exportColumns.length} field(s)</small></div>
        </div>
        {showEditor && <section className="route-editor-panel linked-operation-editor"><div className="route-editor-heading"><div><strong><Plus size={15}/> {editingId ? "Edit operation" : "Add operation"}</strong><small>All saved changes are linked to this selected PO line and component.</small></div><button className="icon-control" onClick={() => setShowEditor(false)} aria-label="Close editor"><X size={14}/></button></div>
          <div className="route-editor-form">
            <label>Process category *{processDefinitions.length
              ? <select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value,name:"",subcategory:""})}><option value="">Select category</option>{processCategories.map(value=><option key={value}>{value}</option>)}{draft.category&&!processCategories.includes(draft.category)&&<option value={draft.category}>{draft.category} (saved record)</option>}</select>
              : <input value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="Milling, grinding, turning…"/>}</label>
            <label>Process type *{processDefinitions.length
              ? <select value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value,subcategory:""})}><option value="">Select process type</option>{processTypeOptions.map(value=><option key={value}>{value}</option>)}{draft.name&&!processTypeOptions.includes(draft.name)&&<option value={draft.name}>{draft.name} (saved record)</option>}</select>
              : <input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Plano milling, horizontal milling…"/>}</label>
            <label>Process subcategory{(selectedProcessDefinition?.subcategories||[]).length
              ? <select value={draft.subcategory} onChange={e=>setDraft({...draft,subcategory:e.target.value})}><option value="">Select subcategory</option>{selectedProcessDefinition!.subcategories.map(value=><option key={value}>{value}</option>)}</select>
              : <input value={draft.subcategory} onChange={e=>setDraft({...draft,subcategory:e.target.value})} placeholder="Optional subcategory"/>}</label>
            <label>Execution type<select value={draft.executionType} onChange={e=>setDraft({...draft,executionType:e.target.value as "Internal"|"Outsourced",vendorId:e.target.value==="Internal"?"":draft.vendorId})}><option value="Internal">Internal</option><option value="Outsourced">Outsourced</option></select></label>
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
            <label>Payment status<select value={draft.paymentStatus} onChange={e=>setDraft({...draft,paymentStatus:e.target.value as "Paid"|"Unpaid"})}><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option></select></label>
            <label>Total amount paid (₹)<input type="number" min="0" step="0.01" value={draft.paidAmount || ""} onChange={e=>setDraft({...draft,paidAmount:Math.max(0,Number(e.target.value)||0)})}/><small className="field-hint">Increasing this total appends only the additional amount as a dated payment-ledger transaction.</small></label>
            <label>Payment reference<input value={draft.paymentReference} onChange={e=>setDraft({...draft,paymentReference:e.target.value})} placeholder="Voucher / UTR / receipt number"/></label>
            <label>Planned process cost (₹)<input readOnly value={money(draft.quantity * draft.ratePerPart)}/></label>
            <label>Status<select value={draft.status} onChange={e => setDraft({...draft,status:e.target.value as LifecycleStatus})}><option>Planned</option><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option><option>Rejected</option><option>Delayed</option></select></label>
            <label>Route type<input value={draft.branch} onChange={e => setDraft({...draft,branch:e.target.value})} placeholder="Main route / Alternate / Rework"/></label>
            <SearchablePicker id="operation-transport-vendor-picker" label="Transport vendor" value={draft.transportVendorId} placeholder="Type transporter name or phone…" options={vendors.filter(v=>v.vendorType==="Transport").map(v=>({id:v.id,label:v.company+" · "+(v.phone||"No phone")}))} onChange={transportVendorId=>setDraft({...draft,transportVendorId,transportRouteId:"",transportFrom:"",transportTo:"",transportVehicleType:"",transportCost:0})}/>
            <label>Transport route<select value={draft.transportRouteId} onChange={e=>{const route=selectedTransportRoutes.find(item=>item.id===e.target.value);setDraft({...draft,transportRouteId:e.target.value,transportFrom:route?.fromLocation||"",transportTo:route?.toLocation||"",transportVehicleType:route?.vehicleType||"",transportCost:route?.fixedCost||0});}}><option value="">Select saved route…</option>{selectedTransportRoutes.map(route=><option key={route.id} value={route.id}>{route.fromLocation} → {route.toLocation} · ₹{route.fixedCost.toLocaleString("en-IN")} · {route.vehicleType||"Vehicle not set"}</option>)}</select></label>
            <label>From location<input readOnly value={draft.transportFrom||""}/></label>
            <label>To location<input readOnly value={draft.transportTo||""}/></label>
            <label>Vehicle type<input readOnly value={draft.transportVehicleType||""}/></label>
            <label>Transport pickup date &amp; time<input type="datetime-local" value={dateTimeInput(draft.transportPickup)} onChange={e => setDraft({...draft,transportPickup:e.target.value})}/></label>
            <label>Transport delivery date &amp; time<input type="datetime-local" value={dateTimeInput(draft.transportDelivery)} onChange={e => setDraft({...draft,transportDelivery:e.target.value})}/></label>
            <label>Transport cost (₹)<input type="number" min="0" step="0.01" value={draft.transportCost || ""} onChange={e => setDraft({...draft,transportCost:Math.max(0,Number(e.target.value)||0)})}/><small className="field-hint">Auto-filled from the selected Transport Directory route. Manual edit is allowed for an exceptional charge.</small></label>
            <label>Tolerance category<select value={draft.toleranceCategory} onChange={e=>setDraft({...draft,toleranceCategory:e.target.value as DraftOperation["toleranceCategory"]})}><option>Standard</option><option>Precision</option><option>Close</option><option>Ultra Precision</option></select></label>
            <label className="editor-wide"><input type="checkbox" checked={draft.inspectionRequired} onChange={e=>setDraft({...draft,inspectionRequired:e.target.checked})}/> Quality / inspection required</label>
            <label className="editor-wide">Quality / inspection requirement<input value={draft.qualityNotes} onChange={e => setDraft({...draft,qualityNotes:e.target.value})} placeholder="Required checks, acceptance criteria, gauges…"/></label>
            <label className="editor-wide">Inspection result<input value={draft.inspectionResult} onChange={e => setDraft({...draft,inspectionResult:e.target.value})} placeholder="Not inspected, accepted, rejected, actual results…"/></label>
            <label className="editor-wide">Operation notes<input value={draft.notes} onChange={e => setDraft({...draft,notes:e.target.value})} placeholder="Setup, process constraints, delivery instructions"/></label>
            <div className="module-form-actions"><button className="button-primary" onClick={saveOperation}><Check size={14}/> {editingId ? "Save changes" : "Save operation"}</button><button className="button-quiet" onClick={() => setShowEditor(false)}>Cancel</button></div>
          </div>
        </section>}
        {["sphere","vortex","combined"].includes(visualStyle) && routeOperations.length
          ? <div className={"process-visual-stage process-visual-"+visualStyle}><ProcessUniverse3D operations={visibleOperations} selectedOperationId={activeOperation?.id || ""} simulationIndex={simulationIndex} zoom={zoom} onSelectOperation={id => { setSelectedOperationId(id); setShowEditor(false); }} onAddSubprocess={startAddSubprocess} /></div>
          : visualStyle==="gantt" && routeOperations.length ? <div className="process-gantt-view">
              <div className="process-gantt-toolbar"><label>Scale<select value={ganttScale} onChange={e=>setGanttScale(e.target.value as "day"|"week"|"month")}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></label><span>Timeline · {routeOperations.length} operations</span></div><div className="process-gantt-axis"><strong>Process</strong><div style={{gridTemplateColumns:"repeat("+ganttTicks.length+",minmax(0,1fr))"}}>{ganttTicks.map((tick,index)=><small key={index}>{tick}</small>)}</div></div>
              {visibleOperations.map(op=>{const start=op.plannedStart||op.actualStart||finalDelivery;const end=op.plannedEnd||op.actualEnd||start;const startDate=start?dateValue(start):new Date();const endDate=end?dateValue(end):startDate;const span=Math.max(1,Math.round((endDate.getTime()-startDate.getTime())/86400000)+1);const offset=start?Math.max(0,Math.round((startDate.getTime()-dateValue(timelineStart||start).getTime())/86400000)):0;const total=Math.max(1,daysBetween(timelineStart||start,timelineEnd||end));const left=Math.min(92,offset/total*100);const width=Math.max(3,Math.min(100-left,span/total*100));return <div className="process-gantt-row" key={op.id}><button onClick={()=>{setSelectedOperationId(op.id);setShowEditor(false);}}><strong>OP-{op.sequence} · {op.name}</strong><small>{shortDate(op.plannedStart)} → {shortDate(op.plannedEnd)}</small></button><div className="process-gantt-track"><span className={"process-gantt-bar status-"+op.status.toLowerCase().replaceAll(" ","-")} style={{left:left+"%",width:width+"%"}} title={op.status+" · "+shortDate(op.plannedStart)+" to "+shortDate(op.plannedEnd)} /></div></div>;})}
            </div>
          : routeOperations.length ? <div className={"linked-node-scroll process-visual-"+visualStyle+" " + (visualStyle==="vertical" ? "linked-node-vertical" : "")}><div className="linked-route-lanes" style={{transform:"scale(" + zoom + ")",transformOrigin:"top left"}}>{visibleBranches.map(branch => {
          const laneOperations = visibleOperations.filter(op => (op.branch || "Main route") === branch);
          const alternate = branch !== "Main route";
          const branchParents = [...new Set(laneOperations.map(op => op.parentId ? routeOperations.find(parent => parent.id === op.parentId)?.name : "").filter(Boolean))];
          return <section className={"linked-route-lane " + (alternate ? "linked-route-lane-alternate" : "")} key={branch}>
            <div className="linked-route-lane-heading"><strong>{branch}</strong><small>{laneOperations.length} operation(s) · {alternate ? "alternate / rework route" : "primary route"}{branchParents.length ? " · branches from " + branchParents.join(", ") : ""}</small></div>
            <div className="linked-node-track">{laneOperations.map((op,index) => {
              const vendor = vendors.find(v => v.id === op.vendorId);
              const selected = op.id === activeOperation?.id;
              return <div className="linked-node-wrap" key={op.id}><button className={"linked-operation-node status-" + op.status.toLowerCase().replaceAll(" ","-") + (alternate ? " linked-node-alternate" : "") + (selected ? " linked-node-selected" : "")} onClick={() => {setSelectedOperationId(op.id);setShowEditor(false);}}><ProcessIcon processName={op.name} fallback={op.name.toLowerCase().includes("transport") || op.name.toLowerCase().includes("dispatch") ? <Truck size={19}/> : op.name.toLowerCase().includes("inspect") || op.name.toLowerCase().includes("quality") ? <ClipboardCheck size={19}/> : op.name.toLowerCase().includes("grind") ? <Wrench size={19}/> : <Workflow size={19}/>} /><strong>{op.name}</strong><small>OP-{String(op.sequence).padStart(3,"0")}</small><span>{op.status}</span><small>{vendor?.company || "Vendor unassigned"}</small><small>{daysBetween(op.plannedStart,op.plannedEnd) || "—"} day(s)</small></button>{index < laneOperations.length - 1 && <span className="linked-node-arrow"><ArrowRight size={18}/></span>}</div>;
            })}</div>
          </section>;
        })}{!visibleOperations.length && <div className="module-empty-state">No operations match this search.</div>}</div></div> : <div className="module-empty-state linked-no-operations"><Workflow size={28}/><h3>No operations saved for this component</h3><p>Add only the operations this part actually requires. There is no fixed stage limit and no sample CNC or heat-treatment data.</p><button className="button-primary" disabled={!selectedLine} onClick={() => startAdd()}><Plus size={14}/> Add first operation</button></div>}
        <div className="route-legend"><span><i className="legend-done"/> Complete</span><span><i className="legend-live"/> Running</span><span><i className="legend-queued"/> Queued</span><span><i className="legend-hold"/> Quality hold</span><span className="route-scroll-note">Select any operation to inspect its schedule, vendor, quality and cost.</span></div>
      </section>
      <section className="surface-panel process-operation-table-panel">
        <div className="panel-heading"><div><div className="eyebrow">PROCESS EXECUTION REGISTER</div><h3>Process operations</h3><p>Searchable PO/component route table · {visibleOperations.length} visible from {routeOperations.length} operation(s).</p></div><button className="button-primary compact-button" disabled={!selectedLine} onClick={()=>startAdd()}><Plus size={13}/> Add process</button></div>
        <div className="process-table-bulkbar">
          <label><input type="checkbox" checked={visibleOperations.length>0&&visibleOperations.every(op=>selectedOperationIds.includes(op.id))} onChange={e=>selectVisibleOperations(e.target.checked)}/> Select all visible</label>
          <select value={bulkStatus} onChange={e=>setBulkStatus(e.target.value)}><option value="">Bulk status…</option>{["Planned","Queued","Running","Complete","Quality hold","Rejected","Delayed"].map(value=><option key={value}>{value}</option>)}</select>
          <select value={bulkVendorId} onChange={e=>setBulkVendorId(e.target.value)}><option value="">Bulk vendor…</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company} · {v.contact}</option>)}</select>
          <label>Start <input type="datetime-local" value={bulkStart} onChange={e=>setBulkStart(e.target.value)}/></label>
          <label>Due <input type="datetime-local" value={bulkEnd} onChange={e=>setBulkEnd(e.target.value)}/></label>
          <button className="button-primary compact-button" disabled={!selectedVisibleOperations.length||(!bulkStatus&&!bulkVendorId&&!bulkStart&&!bulkEnd)} onClick={applyBulkUpdate}>Apply to {selectedVisibleOperations.length}</button>
          <button className="button-quiet compact-button" disabled={!selectedOperationIds.length} onClick={()=>setSelectedOperationIds([])}>Clear selection</button>
          <button className="button-quiet compact-button" disabled={!selectedVisibleOperations.length} onClick={finishSelectedOperations}><Check size={13}/> Finish selected</button>
          <button className="button-quiet compact-button" disabled={!exportOperations.length} onClick={exportCsv}><FileDown size={13}/> Export selected/visible CSV</button>
        </div>
        <div className="costing-table-wrap process-operation-table-wrap"><table className="costing-table process-operation-table"><thead><tr><th>SL / Select</th><th>Process</th><th>Category</th><th>Execution</th><th>Vendor</th><th>Start</th><th>Due</th><th>Qty</th><th>Price / {quantityUnit}</th><th>Total cost</th><th>Status</th><th>Tolerance</th><th>Remarks</th><th>Actions</th></tr></thead><tbody>{visibleOperations.map((op,index)=>{const vendor=vendors.find(v=>v.id===op.vendorId);const appliedRate=op.actualRatePerPart||op.ratePerPart;const amount=op.quantity*appliedRate+op.transportCost;return <tr key={op.id} className={"process-operation-row status-row-"+op.status.toLowerCase().replaceAll(" ","-")}><td><label><input type="checkbox" checked={selectedOperationIds.includes(op.id)} onChange={()=>toggleOperationSelection(op.id)}/> {index+1}</label></td><td><button className="process-row-open" onClick={()=>{setSelectedOperationId(op.id);setShowEditor(false);}}>{op.name}</button><small>OP-{String(op.sequence).padStart(3,"0")} · {op.subcategory||"No subcategory"}</small></td><td>{op.category||"—"}</td><td>{op.executionType||"Outsourced"}</td><td>{vendor?.company||"Unassigned"}</td><td>{shortDate(op.plannedStart)}</td><td>{shortDate(op.plannedEnd)}</td><td>{op.quantity.toLocaleString("en-IN")} {quantityUnit}</td><td>{money(appliedRate)}<small>{op.actualRatePerPart>0?"Actual rate":"Planned rate"}</small></td><td>{money(amount)}</td><td><span className={"record-state status-tag status-"+op.status.toLowerCase().replaceAll(" ","-")}>{op.status}</span></td><td>{op.toleranceCategory||"Standard"}</td><td>{op.notes||"—"}</td><td><div className="process-row-actions"><button title="Move up" disabled={routeOperations.findIndex(x=>x.id===op.id)===0} onClick={()=>moveOperation(op.id,-1)}><ArrowUp size={12}/></button><button title="Move down" disabled={routeOperations.findIndex(x=>x.id===op.id)===routeOperations.length-1} onClick={()=>moveOperation(op.id,1)}><ArrowDown size={12}/></button><button title="Edit" onClick={()=>editActive(op.id)}><Wrench size={12}/></button><button title="Add next / rework" onClick={()=>{setSelectedOperationId(op.id);startAdd(true);}}><GitBranch size={12}/></button></div></td></tr>;})}</tbody></table></div>
        {!visibleOperations.length&&<div className="module-empty-state"><Workflow size={24}/><h3>{routeOperations.length?"No operations match the current filters":"No process operations yet"}</h3><p>Clear filters or add an operation to the selected PO component line.</p><button className="button-primary" onClick={clearAllFilters}>Reset filters</button></div>}
      </section>
      <div className="process-map-support-grids">
        <section className="surface-panel"><div className="panel-heading"><div><div className="eyebrow">UPCOMING DELIVERY</div><h3>Upcoming delivery</h3><p>PO component lines ordered by due date.</p></div></div>
          <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>PO</th><th>Component</th><th>Qty</th><th>Status</th></tr></thead><tbody>{purchaseOrders.flatMap(po=>po.lines.filter(line=>!line.deletedAt).map(line=>({po,line,component:components.find(c=>c.id===line.componentId)}))).sort((a,b)=>(a.line.targetDelivery||a.po.targetDelivery||"9999").localeCompare(b.line.targetDelivery||b.po.targetDelivery||"")).slice(0,20).map(item=><tr key={item.po.id+item.line.id}><td>{item.po.number}<small>{item.line.targetDelivery||item.po.targetDelivery||"No date"}</small></td><td>{item.component?.name||"Missing"}<small>{item.component?.partNumber||"—"}</small></td><td>{item.line.quantity.toLocaleString("en-IN")}</td><td>{item.line.jobStatus||"In progress"}</td></tr>)}</tbody></table></div>
        </section>
        <section className="surface-panel"><div className="panel-heading"><div><div className="eyebrow">DELAY & RISK</div><h3>Delayed operations</h3><p>Past due operations that are not marked complete.</p></div></div>
          <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Component</th><th>Process</th><th>Issue</th><th>Days</th><th>Action</th></tr></thead><tbody>{routeOperations.filter(op=>op.plannedEnd&&op.status!=="Complete"&&dateValue(op.plannedEnd).getTime()<Date.now()).map(op=><tr key={op.id}><td>{components.find(c=>c.id===op.componentId)?.partNumber||"—"}</td><td>{op.name}</td><td>{op.status}</td><td>{Math.floor((Date.now()-dateValue(op.plannedEnd).getTime())/86400000)}</td><td><button className="button-quiet compact-button" onClick={()=>{setSelectedOperationId(op.id);editActive();}}>Review</button></td></tr>)}</tbody></table></div>
        </section>
      </div>
      <aside className="surface-panel linked-operation-side">
        {activeOperation ? <><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> SELECTED OPERATION</div><h3>{activeOperation.name}</h3><p>{activeOperation.category || "Process type not specified"} · OP-{String(activeOperation.sequence).padStart(3,"0")}</p></div><button className="icon-control" aria-label="Edit selected operation" onClick={() => editActive()}><Wrench size={14}/></button></div>
          <div className="linked-detail-grid"><div><small>VENDOR</small><strong>{selectedVendor?.company || "Not assigned"}</strong><span>{selectedVendor?.phone || "No vendor number linked"}</span></div><div><small>MACHINE / STATION</small><strong>{activeOperation.machine || "Not entered"}</strong></div><div><small>PLANNED SCHEDULE</small><strong>{shortDate(activeOperation.plannedStart)} – {shortDate(activeOperation.plannedEnd)}</strong><span>{daysBetween(activeOperation.plannedStart,activeOperation.plannedEnd) || "—"} calendar day(s)</span></div><div><small>ACTUAL SCHEDULE</small><strong>{shortDate(activeOperation.actualStart)} – {shortDate(activeOperation.actualEnd)}</strong></div><div><small>QUANTITY</small><strong>{activeOperation.quantity.toLocaleString("en-IN")} {quantityUnit}</strong><span>{activeOperation.completed.toLocaleString("en-IN")} completed</span></div><div><small>ACCEPTED / REJECTED</small><strong>{activeOperation.accepted.toLocaleString("en-IN")} / {activeOperation.rejected.toLocaleString("en-IN")}</strong></div><div><small>QUOTED / PLANNED RATE</small><strong>{money(activeOperation.ratePerPart)}</strong></div><div><small>ACTUAL RATE / PART</small><strong>{activeOperation.actualRatePerPart ? money(activeOperation.actualRatePerPart) : "Not entered"}</strong></div><div><small>PROCESS + TRANSPORT COST</small><strong>{money(activeOperation.quantity * (activeOperation.actualRatePerPart||activeOperation.ratePerPart) + activeOperation.transportCost)}</strong><span>{activeOperation.actualRatePerPart>0?"Actual process rate + transport":"Planned process rate + transport"}</span></div><div><small>TRANSPORT</small><strong>{vendors.find(v=>v.id===activeOperation.transportVendorId)?.company || "No transporter assigned"}</strong><span>{activeOperation.transportPickup || activeOperation.transportDelivery ? shortDate(activeOperation.transportPickup) + " → " + shortDate(activeOperation.transportDelivery) : "Not scheduled"} · {money(activeOperation.transportCost)}</span></div><div><small>PROCESS PAYMENT</small><strong>{activeOperation.paymentStatus || "Unpaid"}</strong><span>{money(activeOperation.paidAmount || 0)} paid · {activeOperation.paymentReference || "No payment reference"}</span></div><div><small>STATUS</small><strong>{activeOperation.status}</strong></div><div className="linked-detail-wide"><small>QUALITY / INSPECTION REQUIREMENT</small><strong>{activeOperation.qualityNotes || "No quality notes recorded"}</strong></div><div className="linked-detail-wide"><small>INSPECTION RESULT</small><strong>{activeOperation.inspectionResult || "Not entered"}</strong></div><div className="linked-detail-wide"><small>NOTES</small><strong>{activeOperation.notes || "No operation notes entered"}</strong></div></div>
          <div className="linked-side-actions"><button className="button-primary" onClick={() => editActive()}><Wrench size={14}/> Edit operation</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)<=0} onClick={()=>moveOperation(activeOperation.id,-1)}><ArrowUp size={14}/> Move earlier</button><button className="button-quiet" disabled={routeOperations.findIndex(op=>op.id===activeOperation.id)>=routeOperations.length-1} onClick={()=>moveOperation(activeOperation.id,1)}><ArrowDown size={14}/> Move later</button><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Quotes / costing</button><button className="button-quiet" onClick={() => onSelectModule("quality")}><ClipboardCheck size={14}/> Quality inspection</button>{activeOperation.vendorId&&onScheduleVendor&&<button className="button-quiet" onClick={()=>onScheduleVendor(activeOperation.vendorId,activeOperation.id,activeOperation.name)}><CalendarClock size={14}/> Vendor follow-up</button>}<button className="button-quiet" onClick={() => archiveOperation(activeOperation)}><X size={14}/> Archive</button></div>
          <div className="linked-quote-preview"><div className="panel-heading"><div><h3>Vendor quotations</h3><p>{selectedOperationQuotations.length} quote(s) linked to this operation</p></div></div>{selectedOperationQuotations.length ? selectedOperationQuotations.map(q => <div key={q.id} className="linked-quote-mini"><strong>{vendors.find(v=>v.id===q.vendorId)?.company || "Vendor archived"}</strong><span>{money(q.ratePerPart)}/part · {q.leadDays} lead day(s)</span><small>{q.quoteReference || "No quote reference"} · {q.status}</small></div>) : <div className="vendor-empty">No quotations recorded for this operation yet. Add a quote from Costing.</div>}</div>
        </> : <div className="module-empty-state"><Workflow size={28}/><h3>Select an operation</h3><p>Operation details, schedule, vendor link, quantities, quality and cost will appear here.</p></div>}
      </aside>
    </div>
    <div className="linked-bottom-grid">
      <section className="surface-panel linked-cost-card"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> COST BREAKDOWN</div><h3>Entered route costs</h3><p>Only rates you entered or selected from quotations are counted.</p></div><CircleDollarSign size={18}/></div><div className="linked-cost-row"><span>Process cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.quantity*op.ratePerPart,0))}</strong></div><div className="linked-cost-row"><span>Transport cost</span><strong>{money(routeOperations.reduce((sum,op)=>sum+op.transportCost,0))}</strong></div><div className="linked-cost-row linked-cost-total"><span>Total entered</span><strong>{money(totalProcessCost)}</strong></div><button className="button-quiet" onClick={() => onSelectModule("costing")}><CircleDollarSign size={14}/> Open detailed costing</button></section>
      <section className="surface-panel linked-timeline-card" id="linked-timeline"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> TIMELINE & DELIVERY</div><h3>Planned progress</h3><p>Schedule is based on saved operation dates, not estimated samples.</p></div><CalendarClock size={18}/></div><div className="linked-timeline-facts"><div><small>FIRST PLANNED START</small><strong>{shortDate(timelineStart)}</strong></div><div><small>LAST OPERATION TARGET</small><strong>{shortDate(timelineEnd)}</strong></div><div><small>SUM OF OPERATION DAYS</small><strong>{durationDays || "—"} days</strong></div><div><small>PO DELIVERY TARGET</small><strong>{shortDate(finalDelivery)}</strong></div></div><div className={"linked-delivery-state " + (lateOps.length ? "linked-delivery-late" : "")}><span>{lateOps.length ? <ShieldAlert size={16}/> : <Activity size={16}/>}</span><div><strong>{lateOps.length ? "Delay risk detected" : allDone ? "All saved operations complete" : "Delivery forecast awaits schedule data"}</strong><small>{lateOps.length ? lateOps.length + " operation(s) are past their planned target date." : "ETA can be assessed once operation schedules and dependencies are entered."}</small></div></div></section>
    </div>
    <section className="surface-panel linked-process-table"><div className="panel-heading"><div><div className="eyebrow"><span className="eyebrow-mark"/> DETAILED OPERATION LIST</div><h3>Process list ({routeOperations.length} operations)</h3><p>Values remain component- and PO-line-specific.</p></div><span className="module-number">{routeOperations.length} ROWS</span></div>
      {routeOperations.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Seq</th><th>Operation</th><th>Type</th><th>Vendor</th><th>Machine / station</th><th>Planned start</th><th>Planned target</th><th>Days</th><th>Qty</th><th>Accepted</th><th>Status</th><th>Payment</th><th>Planned rate</th><th>Actual rate</th><th>Process + transport</th></tr></thead><tbody>{routeOperations.map(op => <tr key={op.id} className={activeOperation?.id === op.id ? "linked-table-selected" : ""} onClick={() => setSelectedOperationId(op.id)}><td>{op.sequence}</td><td><button className="inline-module-link" onClick={e=>{e.stopPropagation();setSelectedOperationId(op.id);}}>{op.name}</button></td><td>{op.category || "—"}</td><td>{vendors.find(v=>v.id===op.vendorId)?.company || "Unassigned"}</td><td>{op.machine || "—"}</td><td>{shortDate(op.plannedStart)}</td><td>{shortDate(op.plannedEnd)}</td><td>{daysBetween(op.plannedStart,op.plannedEnd) || "—"}</td><td>{op.quantity.toLocaleString("en-IN")}</td><td>{op.accepted.toLocaleString("en-IN")}</td><td><span className={"record-state state-" + op.status.toLowerCase().replace(/\s+/g,"-")}>{op.status}</span></td><td>{op.paymentStatus || "Unpaid"}</td><td>{money(op.ratePerPart)}</td><td>{op.actualRatePerPart ? money(op.actualRatePerPart) : "Not entered"}</td><td>{money(op.quantity*op.ratePerPart+op.transportCost)}</td></tr>)}</tbody></table></div> : <div className="vendor-empty">No operation rows for the selected PO component.</div>}
    </section>
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
