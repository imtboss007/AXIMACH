import { Fragment, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Maximize2, Plus, Search, ShieldAlert, SlidersHorizontal, Truck, Users, Workflow, X, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, vendorSupportsProcessType, type LifecycleStatus, type OperationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; onSelectModule: (id: string) => void };
type FilterOption = { id: string; label: string };
type ProcessAssignmentDraft = {
  vendorId: string; plannedStart: string; plannedEnd: string; plannedStartTime: string; plannedEndTime: string;
  quantity: string; ratePerPart: string; status: LifecycleStatus; vendorPaymentStatus: "Paid" | "Not Paid"; notes: string;
};
type ProcessDraft = {
  companyId: string; poId: string; poLineId: string; categoryId: string; processTypeIds: string[]; name: string; category: string; vendorId: string;
  plannedStart: string; plannedEnd: string; plannedStartTime: string; plannedEndTime: string; quantity: string; ratePerPart: string;
  status: LifecycleStatus; vendorPaymentStatus: "Paid" | "Not Paid"; processAssignments: Record<string, ProcessAssignmentDraft>;
  branch: string; parentId: string; notes: string;
};
const emptyProcessAssignment = (quantity = ""): ProcessAssignmentDraft => ({
  vendorId: "", plannedStart: "", plannedEnd: "", plannedStartTime: "", plannedEndTime: "",
  quantity, ratePerPart: "", status: "Queued", vendorPaymentStatus: "Not Paid", notes: ""
});
const emptyDraft = (): ProcessDraft => ({
  companyId: "", poId: "", poLineId: "", categoryId: "", processTypeIds: [], name: "", category: "", vendorId: "",
  plannedStart: "", plannedEnd: "", plannedStartTime: "", plannedEndTime: "", quantity: "", ratePerPart: "",
  status: "Queued", vendorPaymentStatus: "Not Paid", processAssignments: {}, branch: "Main route", parentId: "", notes: ""
});
const assignmentFromOperation = (operation: OperationRecord): ProcessAssignmentDraft => ({
  vendorId: operation.vendorId || "", plannedStart: operation.plannedStart || "", plannedEnd: operation.plannedEnd || "",
  plannedStartTime: operation.plannedStartTime || (operation.plannedSlotStartAt ? new Date(operation.plannedSlotStartAt).toTimeString().slice(0,5) : ""),
  plannedEndTime: operation.plannedEndTime || (operation.plannedSlotEndAt ? new Date(operation.plannedSlotEndAt).toTimeString().slice(0,5) : ""),
  quantity: String(operation.quantity || ""), ratePerPart: String(operation.ratePerPart ?? ""),
  status: operation.status, vendorPaymentStatus: operation.vendorPaymentStatus || "Not Paid", notes: operation.notes || ""
});
const day = (value?: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const clock = (value?:string) => value ? (/^\d{2}:\d{2}$/.test(value)?value:new Date(value).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})) : "Time not set";
const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z]+/g, "-");
const shiftIsoDate=(value:string,days:number)=>{const date=new Date(value+"T12:00:00");date.setDate(date.getDate()+days);return date.toISOString().slice(0,10)};
const isSelected = (ids: string[], id: string) => ids.length === 0 || (!ids.includes("__none__") && ids.includes(id));

function MultiSelectFilter({ label, options, value, onChange, optional = false, isOpen, onToggle, onClose }: {
  label: string; options: FilterOption[]; value: string[]; onChange: (ids: string[]) => void; optional?: boolean;
  isOpen: boolean; onToggle: () => void; onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const optionIds = options.map(option => option.id);
  const filtered = options.filter(option => option.label.toLowerCase().includes(query.toLowerCase().trim()));
  const noneSelected=value.includes("__none__");
  const selectedCount=noneSelected?0:value.length===0?optionIds.length:optionIds.filter(id=>value.includes(id)).length;
  const allSelected=!noneSelected&&selectedCount===optionIds.length;
  const toggle = (id: string) => {
    const current=value.length===0?optionIds:value.filter(item=>item!=="__none__"&&optionIds.includes(item));
    const next=current.includes(id)?current.filter(item=>item!==id):[...current,id];
    onChange(next.length===0?["__none__"]:next.length===optionIds.length?[]:next);
  };
  return <div className={"pp-filter"+(isOpen?" pp-filter-open":"")} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))onClose();}}>
    <label>{label}{optional ? <small>Optional</small> : null}</label>
    <button type="button" className="pp-multiselect-summary" aria-expanded={isOpen} onClick={onToggle}>
      <Search size={13}/><span>{allSelected ? "All " + label.toLowerCase() : noneSelected ? "None selected" : selectedCount+" selected"}</span><ChevronDown size={13}/>
    </button>
    {isOpen&&<div className="pp-filter-menu">
      <label className="pp-filter-search"><Search size={13}/><input aria-label={"Search "+label+" options"} value={query} onChange={event => setQuery(event.target.value)} placeholder={"Search " + label.toLowerCase() + "…"} /></label>
      <div className="pp-filter-menu-actions">
        <button type="button" onClick={() => onChange(optionIds)}>Select all</button>
        <button type="button" onClick={() => onChange(["__none__"])}>Unselect all</button>
        <button type="button" onClick={() => {setQuery("");onChange([]);}}>Clear filter</button>
      </div>
      <div className="pp-filter-options">
        {filtered.map(option => <label key={option.id}><input type="checkbox" checked={isSelected(value, option.id)} onChange={() => toggle(option.id)}/><span>{option.label}</span></label>)}
        {!filtered.length && <small>No matching saved records.</small>}
      </div>
    </div>}
  </div>;
}

export default function ProductionPlanningWorkspace({ onBack, onNotice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);
  const processCategories = activeRows(data.processCategories);
  const processTypes = activeRows(data.processTypes);
  const processVendorRates = activeRows(data.processVendorRates);

  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [poIds, setPoIds] = useState<string[]>([]);
  const [componentIds, setComponentIds] = useState<string[]>([]);
  const [vendorIds, setVendorIds] = useState<string[]>([]);
  const [statusIds, setStatusIds] = useState<string[]>([]);
  const [executionIds, setExecutionIds] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("General");
  const [calendar, setCalendar] = useState(false);
  const [scale, setScale] = useState("Week");
  const [calendarCursor,setCalendarCursor]=useState(new Date().toISOString().slice(0,10));
  const [openFilterId,setOpenFilterId]=useState("");
  const [simulationOpen,setSimulationOpen]=useState(false);
  const [collapsedComponents, setCollapsedComponents] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<ProcessDraft>(emptyDraft());
  const [processQuery,setProcessQuery]=useState("");
  const draftProcessTypes=processTypes.filter(item=>draft.processTypeIds.includes(item.id));
  const draftVendorOptions=draftProcessTypes.length===1?vendors.filter(vendor=>vendorSupportsProcessType(vendor,draftProcessTypes[0].id)||vendor.id===draft.vendorId):vendors;
  const latestProcessRate=(processTypeId:string,vendorId:string):number|undefined=>processVendorRates.filter(rate=>rate.processTypeId===processTypeId&&rate.vendorId===vendorId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]?.ratePerPart;

  const companyOptions = useMemo(() => companies.map(company => ({ id: company.id, label: company.name })), [companies]);
  const filteredCompanyOrders = orders.filter(po => isSelected(companyIds, po.companyId));
  const poOptions = filteredCompanyOrders.map(po => ({ id: po.id, label: po.number }));
  const filteredFilterLines = filteredCompanyOrders.filter(po => isSelected(poIds, po.id)).flatMap(po => po.lines.map(line => ({ po, line })));
  const componentOptions = components.filter(component => filteredFilterLines.some(row => row.line.componentId === component.id)).map(component => ({ id: component.id, label: component.partNumber + " — " + component.name }));
  const vendorOptions = vendors.map(vendor => ({ id: vendor.id, label: vendor.company }));
  const categoryOptions = [...new Set(operations.map(operation => operation.category.trim()).filter(Boolean))].sort().map(category => ({ id: category, label: category }));
  const statusOptions = ["Queued", "Running", "Complete", "Quality hold"].map(status => ({ id: status, label: status }));
  const executionOptions = [{ id: "Internal", label: "Internal" }, { id: "Outsourced", label: "Outsourced" }];

  const filteredOrders = orders.filter(po => isSelected(companyIds, po.companyId) && isSelected(poIds, po.id));
  const baseLines = filteredOrders.flatMap(po => po.lines.filter(line => isSelected(componentIds, line.componentId)).map(line => ({ po, line })));
  const baseLineIds = new Set(baseLines.map(row => row.line.id));
  const filteredOperations = operations.filter(operation => {
    if (!baseLineIds.has(operation.poLineId)) return false;
    if (!isSelected(vendorIds, operation.vendorId || "__internal__")) return false;
    if (!isSelected(statusIds, operation.status)) return false;
    const executionType = operation.vendorId ? "Outsourced" : "Internal";
    if (!isSelected(executionIds, executionType)) return false;
    if (!isSelected(categoryIds, operation.category || "__uncategorised__")) return false;
    if (periodStart && operation.plannedStart && operation.plannedStart < periodStart) return false;
    if (periodEnd && operation.plannedEnd && operation.plannedEnd > periodEnd) return false;
    return true;
  });
  const visibleLineIds = new Set(filteredOperations.map(operation => operation.poLineId));
  const allowedLines = baseLines.filter(row => vendorIds.length === 0 || visibleLineIds.has(row.line.id));
  const allowedLineIds = new Set(allowedLines.map(row => row.line.id));
  const rows = filteredOperations.filter(operation => allowedLineIds.has(operation.poLineId)).sort((a, b) => a.sequence - b.sequence);
  const visible = rows.filter(operation => {
    const vendorName = vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house";
    const component = components.find(item => item.id === operation.componentId);
    const po = orders.find(item => item.id === operation.poId);
    const company = companies.find(item => item.id === po?.companyId);
    const searchableText = [operation.name, operation.category, operation.status, vendorName, component?.partNumber, component?.name, po?.number, company?.name].filter(Boolean).join(" ");
    return searchableText.toLowerCase().includes(search.toLowerCase().trim());
  });
  const displayRows = visible;
  const displayLineIds = new Set(displayRows.map(operation => operation.poLineId));
  const displayLines = search.trim() ? allowedLines.filter(row => displayLineIds.has(row.line.id)) : allowedLines;
  const selected = displayRows.find(operation => operation.id === selectedId) || displayRows[0];
  const selectedLine = displayLines.find(row => row.line.id === selected?.poLineId);
  const selectedComponent = components.find(component => component.id === (selected?.componentId || selectedLine?.line.componentId));
  const selectedPO = orders.find(po => po.id === (selected?.poId || selectedLine?.po.id));

  const totalQty = displayLines.reduce((sum, row) => sum + row.line.quantity, 0);
  const planned = displayRows.filter(operation => operation.status === "Queued").reduce((sum, operation) => sum + operation.quantity, 0);
  const inProgress = displayRows.filter(operation => operation.status === "Running").reduce((sum, operation) => sum + operation.quantity, 0);
  const completed = displayRows.filter(operation => operation.status === "Complete").reduce((sum, operation) => sum + operation.accepted, 0);
  const pending = Math.max(0, totalQty - completed - inProgress);
  const today = new Date().toISOString().slice(0, 10);
  const delayed = displayRows.filter(operation => operation.status !== "Complete" && operation.plannedEnd && operation.plannedEnd < today);
  const assigned = new Set(displayRows.map(operation => operation.vendorId).filter(Boolean)).size;
  const processCount = displayRows.length;
  const processLabel = (operation: OperationRecord) => operation.name || operation.category || "Operation";
  const allDates = displayRows.flatMap(operation => [operation.plannedStart, operation.plannedEnd]).filter(Boolean).sort();
  const timelineStart = allDates[0] || today;
  const timelineEnd = allDates[allDates.length - 1] || timelineStart;
  const duration = Math.max(1, (Date.parse(timelineEnd) - Date.parse(timelineStart)) / 86400000 + 1);

  const setSelection = (setter: (ids: string[]) => void, ids: string[]) => setter(ids);
  const resetFilters = () => {
    setCompanyIds([]); setPoIds([]); setComponentIds([]); setVendorIds([]);
    setStatusIds([]); setExecutionIds([]); setCategoryIds([]);
    setPeriodStart(""); setPeriodEnd(""); setSearch(""); setSelectedId("");
  };
  const updatePaymentStatus = (operationId: string, status: "Paid" | "Not Paid") => {
    update(current => ({...current, operations: current.operations.map(operation => operation.id === operationId ? {...operation, vendorPaymentStatus: status, updatedAt: nowIso()} : operation)}));
    onNotice("Vendor payment status updated.");
  };
  const runSimulation = () => setSimulationOpen(true);
  const openAdd = () => {
    const next = emptyDraft();
    if (companyIds.length === 1) next.companyId = companyIds[0];
    if (poIds.length === 1) next.poId = poIds[0];
    const preferredLine = displayLines.length === 1 ? displayLines[0] : undefined;
    if (preferredLine) {
      next.companyId = preferredLine.po.companyId;
      next.poId = preferredLine.po.id;
      next.poLineId = preferredLine.line.id;
      next.quantity = String(preferredLine.line.quantity);
    }
    setDraft(next); setEditingId(""); setShowEditor(true);
  };
  const openEdit = (operation: OperationRecord) => {
    const po = orders.find(item => item.id === operation.poId);
    const processType=processTypes.find(item=>item.id===operation.processTypeId);
    setDraft({
      companyId: po?.companyId || "", poId: operation.poId, poLineId: operation.poLineId,
      categoryId:processType?.categoryId||"",processTypeIds:operation.processTypeId?[operation.processTypeId]:[],
      name: operation.name, category: operation.category, vendorId: operation.vendorId || "",
      plannedStart: operation.plannedStart || "", plannedEnd: operation.plannedEnd || "", plannedStartTime: operation.plannedStartTime || (operation.plannedSlotStartAt ? new Date(operation.plannedSlotStartAt).toTimeString().slice(0,5) : ""), plannedEndTime: operation.plannedEndTime || (operation.plannedSlotEndAt ? new Date(operation.plannedSlotEndAt).toTimeString().slice(0,5) : ""),
      quantity: String(operation.quantity), ratePerPart: String(operation.ratePerPart),
      status: operation.status, vendorPaymentStatus: operation.vendorPaymentStatus || "Not Paid",
      processAssignments: operation.processTypeId ? {[operation.processTypeId]:assignmentFromOperation(operation)} : {},
      branch: operation.branch || "Main route", parentId: operation.parentId || "", notes: operation.notes || ""
    });
    setSelectedId(operation.id);setTab("General");setEditingId(operation.id);setShowEditor(true);
  };
  const draftPO = orders.find(po => po.id === draft.poId);
  const draftLineOptions = (draftPO?.lines || []).map(line => {
    const component = components.find(item => item.id === line.componentId);
    return { id: line.id, label: (component ? component.partNumber + " — " + component.name : "Missing component") + " · " + line.quantity.toLocaleString("en-IN") + " pcs" };
  });
  const parentOptions = operations.filter(operation => operation.poLineId === draft.poLineId && operation.id !== editingId).map(operation => ({ id: operation.id, label: operation.name + " · " + operation.status }));
  const saveProcess = () => {
    const po = orders.find(item => item.id === draft.poId);
    const line = po?.lines.find(item => item.id === draft.poLineId);
    const component = components.find(item => item.id === line?.componentId);
    if (!po || !line || !component) { onNotice("Select a saved company, purchase order and component before saving the process."); return; }
    const previous=editingId?operations.find(operation=>operation.id===editingId):undefined;
    const selectedTypes=draft.processTypeIds.map(id=>processTypes.find(type=>type.id===id)).filter((item):item is typeof processTypes[number]=>Boolean(item));
    if(!selectedTypes.length&&!(editingId&&previous&&draft.name.trim())){onNotice("Choose a Process Directory category and one or more processes.");return;}
    if(selectedTypes.length&&selectedTypes.some(type=>type.categoryId!==draft.categoryId)){onNotice("Choose processes from the selected category. Add another process in a separate operation if it belongs to a different category.");return;}

    const typesToSave:(typeof processTypes[number]|null)[]=selectedTypes.length?selectedTypes:[null];
    const assignmentsToSave=typesToSave.map(processType=>{
      const assignment=selectedTypes.length>1&&processType
        ? draft.processAssignments[processType.id]||emptyProcessAssignment(String(line.quantity))
        : draft;
      return {processType,assignment,quantity:Number(assignment.quantity||line.quantity),rate:Number(assignment.ratePerPart||0)};
    });
    for(const item of assignmentsToSave){
      const {processType,assignment,quantity,rate}=item;
      if(!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(rate)||rate<0){onNotice("Each process needs a positive quantity and a valid non-negative price.");return;}
      if(assignment.plannedStart&&assignment.plannedEnd&&assignment.plannedEnd<assignment.plannedStart){onNotice("Due date cannot be earlier than the start date for "+(processType?.name||"this process")+".");return;}
      if(assignment.plannedStart&&assignment.plannedEnd&&assignment.plannedStart===assignment.plannedEnd&&assignment.plannedStartTime&&assignment.plannedEndTime&&assignment.plannedEndTime<assignment.plannedStartTime){onNotice("Due time cannot be earlier than the start time on the same day for "+(processType?.name||"this process")+".");return;}
      if(assignment.vendorId){
        const vendor=vendors.find(item=>item.id===assignment.vendorId);
        if(!vendor){onNotice("Select a saved Vendor Master record for "+(processType?.name||"this process")+".");return;}
        const priorForProcess=processType?operations.find(operation=>operation.poLineId===line.id&&operation.processTypeId===processType.id):previous;
        if(processType&&!vendorSupportsProcessType(vendor,processType.id)&&priorForProcess?.vendorId!==vendor.id){onNotice("The selected vendor is not assigned to "+processType.name+". Add that capability in Process Directory or select a capable vendor.");return;}
        if(!processType&&previous?.vendorId!==vendor.id){onNotice("A vendor can only be assigned after selecting its Process Directory process.");return;}
      }
    }

    const stamp = nowIso();
    const idsToSave=typesToSave.map((processType,index)=>{
      if(editingId&&index===0)return editingId;
      const existing=processType?operations.find(operation=>operation.poLineId===line.id&&operation.processTypeId===processType.id&&operation.id!==editingId):undefined;
      return existing?.id||makeId("operation");
    });
    update(current => {
      const currentRoute = current.operations.filter(op => op.poLineId === line.id && op.poId === po.id && op.componentId === component.id && !op.deletedAt);
      const maximumSequence=Math.max(0,...currentRoute.map(operation=>operation.sequence));
      const records:OperationRecord[]=assignmentsToSave.map(({processType,assignment,quantity,rate},index)=>{
        const id=idsToSave[index];
        const old=current.operations.find(operation=>operation.id===id);
        const category=processType?processCategories.find(item=>item.id===processType.categoryId)?.name||draft.category:draft.category;
        return {
          id, poId:po.id, poLineId:line.id, componentId:component.id,
          sequence:old?.sequence??maximumSequence+(index+1)*10,
          processTypeId:processType?.id||old?.processTypeId,
          name:processType?.name||draft.name.trim(), category, machine:old?.machine||"",
          machineResourceId:old?.machineResourceId, vendorId:assignment.vendorId||"",
          status:assignment.status, plannedStart:assignment.plannedStart, plannedEnd:assignment.plannedEnd,
          actualStart:old?.actualStart||"", actualEnd:old?.actualEnd||"",
          plannedStartTime:assignment.plannedStartTime||"",plannedEndTime:assignment.plannedEndTime||"",
          plannedSlotStartAt:old&&old.plannedStart===assignment.plannedStart&&old.plannedEnd===assignment.plannedEnd?old.plannedSlotStartAt:undefined,
          plannedSlotEndAt:old&&old.plannedStart===assignment.plannedStart&&old.plannedEnd===assignment.plannedEnd?old.plannedSlotEndAt:undefined,
          quantity, completed:old?.completed||0, accepted:old?.accepted||0, rejected:old?.rejected||0,
          setupHours:old?.setupHours||0, cycleTimeSeconds:old?.cycleTimeSeconds||0,
          ratePerPart:rate, actualRatePerPart:old?.actualRatePerPart||0,
          transportVendorId:old?.transportVendorId||"", transportPickup:old?.transportPickup||"",
          transportDelivery:old?.transportDelivery||"", transportCost:old?.transportCost||0,
          qualityNotes:old?.qualityNotes||"", inspectionResult:old?.inspectionResult||"",
          notes:assignment.notes, vendorPaymentStatus:assignment.vendorPaymentStatus||old?.vendorPaymentStatus||"Not Paid", branch:draft.branch,
          parentId:draft.branch==="Main route"?"":draft.parentId,
          createdAt:old?.createdAt||stamp,updatedAt:stamp,deletedAt:undefined
        };
      });
      const ids=new Set(records.map(record=>record.id));
      return {...current,operations:[...current.operations.filter(operation=>!ids.has(operation.id)),...records]};
    });
    setSelectedId(idsToSave[0]);setTab("General");setShowEditor(false);setEditingId("");
    onNotice(editingId?"Process operation(s) updated. Each process retains its own vendor, schedule, quantity, rate and payment status.":(selectedTypes.length+" process operation(s) saved with independent vendor, schedule and rate details."));
  };
  const componentGroups = displayLines.map(row => {
    const component = components.find(item => item.id === row.line.componentId);
    const groupOperations = displayRows.filter(operation => operation.poLineId === row.line.id).slice().sort((a, b) => a.sequence - b.sequence);
    return { key: row.po.id + ":" + row.line.id, po: row.po, line: row.line, component, operations: groupOperations };
  });
  const toggleComponent = (key: string) => setCollapsedComponents(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const allCollapsed = componentGroups.length > 0 && componentGroups.every(group => collapsedComponents.includes(group.key));
  const workloads = vendors.map(vendor => {
    const vendorOperations = displayRows.filter(operation => operation.vendorId === vendor.id);
    return { id: vendor.id, name: vendor.company, operations: vendorOperations };
  }).filter(item => item.operations.length);
  const internalOperations = displayRows.filter(operation => !operation.vendorId);
  if (internalOperations.length) workloads.push({ id: "__internal__", name: "In-house", operations: internalOperations });
  const upcomingLimit = new Date(); upcomingLimit.setDate(upcomingLimit.getDate() + 7);
  const upcomingDate = upcomingLimit.toISOString().slice(0, 10);
  const upcoming = displayLines.filter(row => row.line.targetDelivery && row.line.targetDelivery >= today && row.line.targetDelivery <= upcomingDate);
  const ganttRows = displayRows.filter(operation => operation.plannedStart && operation.plannedEnd);
  const searchedRows = displayRows;
  const calendarStart=(()=>{const date=new Date(calendarCursor+"T12:00:00");if(scale==="Day")return calendarCursor;if(scale==="Week"){const mondayOffset=(date.getDay()+6)%7;return shiftIsoDate(calendarCursor,-mondayOffset);}const first=new Date(date.getFullYear(),date.getMonth(),1,12);const offset=(first.getDay()+6)%7;first.setDate(first.getDate()-offset);return first.toISOString().slice(0,10);})();
  const calendarDayCount=scale==="Day"?1:scale==="Week"?7:42;
  const calendarDates=Array.from({length:calendarDayCount},(_,index)=>shiftIsoDate(calendarStart,index));
  const calendarEventsForDay=(dateKey:string)=>displayRows.filter(operation=>{const start=operation.plannedStart||operation.plannedEnd;const end=operation.plannedEnd||operation.plannedStart;return Boolean(start&&end&&start<=dateKey&&end>=dateKey);}).sort((a,b)=>a.sequence-b.sequence);
  const calendarHeading=scale==="Month"?new Date(calendarCursor+"T12:00:00").toLocaleDateString("en-IN",{month:"long",year:"numeric"}):scale==="Week"?day(calendarStart)+" — "+day(shiftIsoDate(calendarStart,6)):day(calendarCursor);
  const moveCalendar=(direction:-1|1)=>{if(scale==="Month"){const date=new Date(calendarCursor+"T12:00:00");date.setDate(1);date.setMonth(date.getMonth()+direction);setCalendarCursor(date.toISOString().slice(0,10));}else setCalendarCursor(shiftIsoDate(calendarCursor,(scale==="Week"?7:1)*direction));};
  const operationDateTime=(operation:OperationRecord,edge:"start"|"end")=>{
    const date=edge==="start"?operation.plannedStart:operation.plannedEnd;
    const enteredTime=edge==="start"?operation.plannedStartTime:operation.plannedEndTime;
    const slot=edge==="start"?operation.plannedSlotStartAt:operation.plannedSlotEndAt;
    const time=enteredTime||(slot?new Date(slot).toTimeString().slice(0,5):"");
    if(!date||!time)return null;
    const timestamp=Date.parse(date+"T"+time+":00");
    return Number.isFinite(timestamp)?timestamp:null;
  };
  const simulationScheduled=displayRows.filter(operation=>Boolean(operationDateTime(operation,"start")&&operationDateTime(operation,"end"))).length;
  const simulationMissing=displayRows.length-simulationScheduled;
  const simulationOverdue=displayRows.filter(operation=>operation.status!=="Complete"&&operation.plannedEnd&&operation.plannedEnd<today).length;
  const simulationUnpaid=displayRows.filter(operation=>operation.vendorId&&(operation.vendorPaymentStatus||"Not Paid")!=="Paid").length;
  const simulationAssignedVendors=new Set(displayRows.map(operation=>operation.vendorId).filter(Boolean)).size;
  const simulationValue=displayRows.reduce((sum,operation)=>sum+operation.quantity*operation.ratePerPart+operation.transportCost,0);
  const simulationConflicts:Array<{id:string;first:OperationRecord;second:OperationRecord;reason:string}>=[];
  for(let firstIndex=0;firstIndex<displayRows.length;firstIndex++){
    const first=displayRows[firstIndex];
    const firstStart=operationDateTime(first,"start"),firstEnd=operationDateTime(first,"end");
    if(firstStart===null||firstEnd===null||firstEnd<=firstStart)continue;
    for(let secondIndex=firstIndex+1;secondIndex<displayRows.length;secondIndex++){
      const second=displayRows[secondIndex];
      const sameMachine=Boolean(first.machineResourceId&&first.machineResourceId===second.machineResourceId);
      const sameVendor=Boolean(first.vendorId&&first.vendorId===second.vendorId);
      if(!sameMachine&&!sameVendor)continue;
      const secondStart=operationDateTime(second,"start"),secondEnd=operationDateTime(second,"end");
      if(secondStart===null||secondEnd===null||secondEnd<=secondStart)continue;
      if(firstStart<secondEnd&&secondStart<firstEnd){
        simulationConflicts.push({id:first.id+"-"+second.id,first,second,reason:sameMachine?"Same registered machine":"Potential vendor booking overlap"});
      }
    }
  }

  return <div className="production-planning">
    <header className="pp-heading">
      <div><div className="pp-eyebrow">AXIMACH / OPERATIONS CONTROL</div><h1>Production Planning</h1><p>Company → Purchase Order → Component → Process → Vendor, dates, quantity and price.</p></div>
      <div className="pp-heading-actions"><span className={"pp-live " + (syncStatus === "synced" ? "pp-live-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED DATA ONLINE" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR" : "LOCAL DATA"}</span><button onClick={() => onSelectModule("command-centre")}>Command Centre</button></div>
    </header>

    <section className="pp-filter-panel">
      <div className="pp-filter-grid">
        <MultiSelectFilter label="Company" options={companyOptions} value={companyIds} onChange={ids => { setSelection(setCompanyIds, ids); setPoIds([]); setComponentIds([]); }} isOpen={openFilterId==="Company"} onToggle={()=>setOpenFilterId(current=>current==="Company"?"":"Company")} onClose={()=>setOpenFilterId("")}/>
        <MultiSelectFilter label="PO Number" options={poOptions} value={poIds} onChange={ids => { setSelection(setPoIds, ids); setComponentIds([]); }} isOpen={openFilterId==="PO Number"} onToggle={()=>setOpenFilterId(current=>current==="PO Number"?"":"PO Number")} onClose={()=>setOpenFilterId("")}/>
        <MultiSelectFilter label="Component" options={componentOptions} value={componentIds} onChange={setComponentIds} isOpen={openFilterId==="Component"} onToggle={()=>setOpenFilterId(current=>current==="Component"?"":"Component")} onClose={()=>setOpenFilterId("")}/>
        <div className="pp-filter pp-date"><label>Plan Period</label><div className="pp-date-range"><input aria-label="Plan period start" type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)}/><span>to</span><input aria-label="Plan period end" type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)}/></div></div>
        <MultiSelectFilter label="Vendor" options={vendorOptions} value={vendorIds} onChange={setVendorIds} optional isOpen={openFilterId==="Vendor"} onToggle={()=>setOpenFilterId(current=>current==="Vendor"?"":"Vendor")} onClose={()=>setOpenFilterId("")}/>
        <div className="pp-filter-actions"><span className="pp-filter-live-indicator"><i/> Filters update this view automatically</span><button type="button" onClick={()=>{resetFilters();setOpenFilterId("");}}>Clear all</button></div>
      </div>
      <div className="pp-secondary-filters">
        <MultiSelectFilter label="Process Status" options={statusOptions} value={statusIds} onChange={setStatusIds} isOpen={openFilterId==="Process Status"} onToggle={()=>setOpenFilterId(current=>current==="Process Status"?"":"Process Status")} onClose={()=>setOpenFilterId("")}/>
        <MultiSelectFilter label="Execution Type" options={executionOptions} value={executionIds} onChange={setExecutionIds} isOpen={openFilterId==="Execution Type"} onToggle={()=>setOpenFilterId(current=>current==="Execution Type"?"":"Execution Type")} onClose={()=>setOpenFilterId("")}/>
        <MultiSelectFilter label="Process Category" options={categoryOptions} value={categoryIds} onChange={setCategoryIds} isOpen={openFilterId==="Process Category"} onToggle={()=>setOpenFilterId(current=>current==="Process Category"?"":"Process Category")} onClose={()=>setOpenFilterId("")}/>
        <span className="pp-filter-help"><SlidersHorizontal size={13}/> Search and check multiple values. Selecting a vendor shows only the components assigned to that vendor.</span>
      </div>
    </section>

    <section className="pp-kpis">
      {[{ label: "Total Qty", value: totalQty, sub: displayLines.length + " PO component lines", icon: Activity, kind: "blue" },
        { label: "Planned", value: planned, sub: "Queued process quantity", icon: Clock3, kind: "green" },
        { label: "In Progress", value: inProgress, sub: "Running process quantity", icon: Activity, kind: "orange" },
        { label: "Completed", value: completed, sub: "Accepted pieces", icon: CheckCircle2, kind: "cyan" },
        { label: "Pending", value: pending, sub: "Quantity outstanding", icon: Clock3, kind: "yellow" },
        { label: "Delayed Operations", value: delayed.length, sub: "Past due date", icon: ShieldAlert, kind: "red" },
        { label: "Vendors Assigned", value: assigned, sub: "Unique assigned vendors", icon: Users, kind: "purple" }
      ].map(kpi => <article className={"pp-kpi " + kpi.kind} key={kpi.label}><kpi.icon/><div><small>{kpi.label}</small><strong>{kpi.value.toLocaleString("en-IN")}{kpi.label !== "Delayed Operations" && kpi.label !== "Vendors Assigned" ? " pcs" : ""}</strong><span>{kpi.sub}</span></div></article>)}
    </section>

    <section className="pp-process-section">
      <div className="pp-section-head">
        <div><h2>Component Process Map</h2><p>{componentGroups.length} component route(s) · arrows show operation sequence and alternate / rework links</p></div>
        <div className="pp-actions">
          <button onClick={() => onNotice("Auto Schedule is not enabled for this planning screen yet. No dates or assignments were changed.")}>✧ Auto Schedule (AI)</button>
          <button onClick={() => onSelectModule("process-map")}>Edit Plan</button>
          <button onClick={runSimulation}>Simulate</button>
          <button onClick={() => setCollapsedComponents([])}><Maximize2 size={13}/> Expand All</button>
          <button onClick={() => setCollapsedComponents(componentGroups.map(group => group.key))}>Collapse All</button>
        </div>
      </div>
      {componentGroups.length ? <div className="pp-component-routes">
        {componentGroups.map(group => {
          const mainRoute = group.operations.filter(operation => (operation.branch || "Main route") === "Main route");
          const branches = [...new Set(group.operations.map(operation => operation.branch || "Main route").filter(branch => branch !== "Main route"))];
          const collapsed = collapsedComponents.includes(group.key);
          const routeId = "route-arrow-" + group.line.id.replace(/[^a-z0-9]/gi, "");
          return <article className="pp-component-route" key={group.key}>
            <div className="pp-component-route-head">
              <div><strong>{group.component ? group.component.partNumber + " — " + group.component.name : "Component record unavailable"}</strong><span>{group.po.number} · Qty {group.line.quantity.toLocaleString("en-IN")} pcs · Due {day(group.line.targetDelivery)}</span></div>
              <button onClick={() => toggleComponent(group.key)}>{collapsed ? "Expand" : "Collapse"} <ChevronDown size={13}/></button>
            </div>
            {!collapsed ? <div className="pp-route-map-body">
              {group.operations.length ? <>
                {mainRoute.length ? <div className="pp-route-lane">
                  <div className="pp-route-lane-label">MAIN ROUTE</div>
                  <div className="pp-route-track">
                    {mainRoute.map((operation, index) => <Fragment key={operation.id}>
                      <button className={"pp-route-node " + statusClass(operation.status) + (selected?.id === operation.id ? " selected" : "")} onClick={() => { setSelectedId(operation.id); setTab("General"); openEdit(operation); }}>
                        <span className="pp-route-node-top"><b>{operation.sequence / 10 || index + 1}. {processLabel(operation)}</b><small>OP-{String(operation.sequence).padStart(3, "0")}</small></span>
                        <span className="pp-route-node-data">Vendor: {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</span>
                        <span className="pp-route-node-data">Start: {day(operation.plannedStart)}{" · "+clock(operation.plannedStartTime||operation.plannedSlotStartAt)}</span>
                        <span className="pp-route-node-data">Due: {day(operation.plannedEnd)}{" · "+clock(operation.plannedEndTime||operation.plannedSlotEndAt)}</span>
                        <span className="pp-route-node-data">Qty: {operation.quantity.toLocaleString("en-IN")} pcs</span>
                        <span className="pp-route-node-data">Price: {money(operation.ratePerPart)}</span><span className="pp-route-node-data">Vendor payment: {operation.vendorId ? (operation.vendorPaymentStatus || "Not Paid") : "—"}</span>
                        <strong className="pp-status">{operation.status}</strong>
                      </button>
                      {index < mainRoute.length - 1 && <span className="pp-route-arrow"><ArrowRight size={22}/></span>}
                    </Fragment>)}
                  </div>
                </div> : null}
                {branches.map(branch => {
                  const branchOperations = group.operations.filter(operation => (operation.branch || "Main route") === branch);
                  const connectors = branchOperations.flatMap((operation, index) => {
                    const parent = group.operations.find(item => item.id === operation.parentId);
                    const parentIndex = mainRoute.findIndex(item => item.id === operation.parentId);
                    if (!parent || parentIndex < 0) return [];
                    const startX = Math.round(((parentIndex + 0.5) / Math.max(1, mainRoute.length)) * 1000);
                    const endX = Math.round(((index + 0.5) / Math.max(1, branchOperations.length)) * 1000);
                    return [{ key: operation.id, d: "M " + startX + " 2 C " + startX + " 24 " + endX + " 24 " + endX + " 52" }];
                  });
                  const parentNames = [...new Set(branchOperations.map(operation => group.operations.find(item => item.id === operation.parentId)?.name).filter(Boolean))];
                  return <div className="pp-route-branch" key={branch}>
                    <div className="pp-route-lane-label pp-branch-label"><span>↘ {branch}</span><small>{parentNames.length ? "Branches from " + parentNames.join(", ") : "Alternate route"}</small></div>
                    {connectors.length ? <svg className="pp-route-connectors" viewBox="0 0 1000 58" preserveAspectRatio="none" aria-hidden="true"><defs><marker id={routeId} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="#31b8ff" strokeWidth="1.2"/></marker></defs>{connectors.map(connector => <path key={connector.key} d={connector.d} markerEnd={"url(#" + routeId + ")"} />)}</svg> : null}
                    <div className="pp-route-track">
                      {branchOperations.map((operation, index) => <Fragment key={operation.id}>
                        <button className={"pp-route-node " + statusClass(operation.status) + (selected?.id === operation.id ? " selected" : "")} onClick={() => openEdit(operation)}>
                          <span className="pp-route-node-top"><b>{operation.sequence / 10 || index + 1}. {processLabel(operation)}</b><small>OP-{String(operation.sequence).padStart(3, "0")}</small></span>
                          <span className="pp-route-node-data">Vendor: {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</span>
                          <span className="pp-route-node-data">Start: {day(operation.plannedStart)}{" · "+clock(operation.plannedStartTime||operation.plannedSlotStartAt)}</span>
                          <span className="pp-route-node-data">Due: {day(operation.plannedEnd)}{" · "+clock(operation.plannedEndTime||operation.plannedSlotEndAt)}</span>
                          <span className="pp-route-node-data">Qty: {operation.quantity.toLocaleString("en-IN")} pcs</span>
                          <span className="pp-route-node-data">Price: {money(operation.ratePerPart)}</span>
                          <span className="pp-route-node-data">Vendor payment: {operation.vendorId ? (operation.vendorPaymentStatus || "Not Paid") : "—"}</span>
                          <strong className="pp-status">{operation.status}</strong>
                        </button>
                        {index < branchOperations.length - 1 && <span className="pp-route-arrow"><ArrowRight size={22}/></span>}
                      </Fragment>)}
                    </div>
                  </div>;
                })}
              </> : <div className="pp-empty pp-route-empty"><Workflow size={24}/><strong>No processes added for this component yet.</strong><span>Add the actual processes required for this component. No sample process data is preloaded.</span></div>}
            </div> : null}
          </article>;
        })}
      </div> : <div className="pp-empty"><Workflow size={25}/><strong>No components match these filters.</strong><span>Select a company, purchase order or component, or reset the filters.</span></div>}
    </section>

    <div className="pp-work-area">
      <section className="pp-table-panel">
        <div className="pp-section-head">
          <div><h2>Process Operations ({visible.length})</h2><p>Process, vendor, planned dates, quantity and price for each selected component.</p></div>
          <div className="pp-table-tools">
            <label className="pp-search"><Search size={14}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search process, vendor…"/></label>
            <button className="pp-add-process" onClick={openAdd}><Plus size={14}/> Add Process</button>
          </div>
        </div>
        <div className="pp-table-scroll"><table>
          <thead><tr><th>#</th><th>Process</th><th>Category</th><th>Execution</th><th>Vendor</th><th>Start Date</th><th>Due Date</th><th>Qty (pcs)</th><th>Price (₹/pc)</th><th>Vendor Payment</th><th>Total Cost (₹)</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{searchedRows.map((operation, index) => <tr key={operation.id} onClick={() => openEdit(operation)} className={selected?.id === operation.id ? "active" : ""}>
            <td>{index + 1}</td><td>{operation.name}</td><td>{operation.category || "—"}</td><td>{operation.vendorId ? "Outsourced" : "Internal"}</td>
            <td>{vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</td><td>{day(operation.plannedStart)}</td><td>{day(operation.plannedEnd)}</td>
            <td>{operation.quantity.toLocaleString("en-IN")}</td><td>{money(operation.ratePerPart)}</td><td>{operation.vendorId ? <select aria-label={"Payment status for "+operation.name} value={operation.vendorPaymentStatus || "Not Paid"} onClick={event=>event.stopPropagation()} onChange={event=>updatePaymentStatus(operation.id,event.target.value as "Paid" | "Not Paid")}><option value="Not Paid">Not Paid</option><option value="Paid">Paid</option></select> : "—"}</td><td>{money(operation.quantity * operation.ratePerPart + operation.transportCost)}</td>
            <td><span className={"pp-table-status " + statusClass(operation.status)}>{operation.status}</span></td>
            <td><button onClick={event => { event.stopPropagation(); openEdit(operation); }}>Edit</button></td>
          </tr>)}</tbody>
        </table></div>
        {!searchedRows.length ? <div className="pp-empty pp-table-empty"><strong>No process operations found.</strong><span>Add a process or change the process search.</span></div> : null}
      </section>

      <aside className="pp-details">
        <div className="pp-details-head"><div><small>PROCESS DETAILS</small><h3>{selected ? processLabel(selected) : "No operation selected"}</h3></div>{selected ? <button onClick={() => openEdit(selected)} aria-label="Edit process"><Wrench size={14}/></button> : <button onClick={() => setSelectedId("")} aria-label="Clear selection"><X size={15}/></button>}</div>
        {selected ? <>
          <div className="pp-tabs">{["General", "Dates & Qty", "Vendor", "Cost", "Remarks"].map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</div>
          <div className="pp-detail-body">
            {tab === "General" ? <><p><b>Process:</b><span>{selected.name}</span></p><p><b>Category:</b><span>{selected.category || "—"}</span></p><p><b>Execution:</b><span>{selected.vendorId ? "Outsourced" : "Internal"}</span></p><p><b>Company:</b><span>{companies.find(company => company.id === selectedPO?.companyId)?.name || "—"}</span></p><p><b>PO:</b><span>{orders.find(po => po.id === selected.poId)?.number || "—"}</span></p><p><b>Component:</b><span>{components.find(component => component.id === selected.componentId)?.partNumber || "—"}</span></p><p><b>Status:</b><span>{selected.status}</span></p><p><b>Vendor payment:</b><span>{selected.vendorId ? (selected.vendorPaymentStatus || "Not Paid") : "—"}</span></p></> :
            tab === "Dates & Qty" ? <><p><b>Start:</b><span>{day(selected.plannedStart)}</span></p><p><b>Due:</b><span>{day(selected.plannedEnd)}</span></p><p><b>Quantity:</b><span>{selected.quantity.toLocaleString("en-IN")}</span></p><p><b>Completed:</b><span>{selected.completed.toLocaleString("en-IN")}</span></p><p><b>Accepted:</b><span>{selected.accepted.toLocaleString("en-IN")}</span></p><p><b>Rejected:</b><span>{selected.rejected.toLocaleString("en-IN")}</span></p></> :
            tab === "Vendor" ? <><p><b>Vendor:</b><span>{vendors.find(vendor => vendor.id === selected.vendorId)?.company || "In-house / unassigned"}</span></p><p><b>Vendor Phone:</b><span>{vendors.find(vendor => vendor.id === selected.vendorId)?.phone || "—"}</span></p><p><b>Transport Vendor:</b><span>{vendors.find(vendor => vendor.id === selected.transportVendorId)?.company || "Not assigned"}</span></p></> :
            tab === "Cost" ? <><p><b>Rate per part:</b><span>{money(selected.ratePerPart)}</span></p><p><b>Actual rate:</b><span>{money(selected.actualRatePerPart)}</span></p><p><b>Transport cost:</b><span>{money(selected.transportCost)}</span></p><p><b>Total planned:</b><span>{money(selected.quantity * selected.ratePerPart + selected.transportCost)}</span></p></> :
            <p>{selected.notes || selected.qualityNotes || "No remarks recorded."}</p>}
          </div>
          <button className="pp-detail-edit" onClick={() => openEdit(selected)}><Wrench size={13}/> Edit Process</button>
        </> : <div className="pp-empty-detail">Select a process card or table row to inspect its details.</div>}
      </aside>
    </div>

    <section className="pp-schedule">
      <div className="pp-section-head"><div><h2>Production Schedule ({calendar ? "Calendar View" : "Gantt View"})</h2><p>Based on saved process start and due dates.</p></div>
        <div className="pp-actions"><button className={!calendar ? "active" : ""} onClick={() => setCalendar(false)}>Gantt View</button><button className={calendar ? "active" : ""} onClick={() => setCalendar(true)}><CalendarDays size={13}/> Calendar View</button>{!calendar&&<label className="pp-scale-select"><span>Gantt scale</span><select aria-label="Gantt scale" value={scale} onChange={event=>setScale(event.target.value)}><option value="Day">Day</option><option value="Week">Week</option><option value="Month">Month</option></select></label>}</div>
      </div>
      {calendar ? <div className={"pp-calendar-shell pp-calendar-"+scale.toLowerCase()}>
        <div className="pp-calendar-toolbar"><div className="pp-calendar-navigation"><button type="button" aria-label="Previous calendar period" onClick={()=>moveCalendar(-1)}><ChevronLeft size={16}/></button><strong>{calendarHeading}</strong><button type="button" aria-label="Next calendar period" onClick={()=>moveCalendar(1)}><ChevronRight size={16}/></button><button type="button" onClick={()=>setCalendarCursor(today)}>Today</button></div><label className="pp-scale-select"><span>Calendar view</span><select aria-label="Calendar view" value={scale} onChange={event=>setScale(event.target.value)}><option value="Day">Day</option><option value="Week">Week</option><option value="Month">Month</option></select></label></div>
        {scale!=="Day"&&<div className="pp-calendar-weekdays">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(label=><span key={label}>{label}</span>)}</div>}
        <div className="pp-calendar-grid">{calendarDates.map(dateKey=><article className={"pp-calendar-cell"+(dateKey===today?" pp-calendar-today":"")+(scale==="Month"&&dateKey.slice(0,7)!==calendarCursor.slice(0,7)?" pp-calendar-outside":"")} key={dateKey}><header><strong>{new Date(dateKey+"T12:00:00").getDate()}</strong><small>{scale==="Day"?new Date(dateKey+"T12:00:00").toLocaleDateString("en-IN",{weekday:"long",month:"long",year:"numeric"}):""}</small></header><div className="pp-calendar-events">{calendarEventsForDay(dateKey).map(operation=><button type="button" className={"pp-calendar-event "+statusClass(operation.status)} key={operation.id} onClick={()=>openEdit(operation)} title={"Edit "+processLabel(operation)}><strong>{processLabel(operation)}</strong><small>{vendors.find(vendor=>vendor.id===operation.vendorId)?.company||"In-house"}</small><span>{operation.plannedStart===dateKey&&(operation.plannedStartTime||operation.plannedSlotStartAt)?clock(operation.plannedStartTime||operation.plannedSlotStartAt):operation.plannedEnd===dateKey&&(operation.plannedEndTime||operation.plannedSlotEndAt)?"Due "+clock(operation.plannedEndTime||operation.plannedSlotEndAt):"All day"}</span></button>)}</div></article>)}</div>
        {!displayRows.some(operation=>operation.plannedStart||operation.plannedEnd)&&<div className="pp-empty pp-schedule-empty"><CalendarDays size={23}/><strong>No dated processes.</strong><span>Set process dates and times to populate this calendar.</span></div>}
      </div> :
      ganttRows.length ? <div className={"pp-gantt pp-gantt-" + scale.toLowerCase()}>{ganttRows.map(operation => {
        const left = Math.max(0, (Date.parse(operation.plannedStart) - Date.parse(timelineStart)) / 86400000 / duration * 100);
        const width = Math.max(2, (Date.parse(operation.plannedEnd) - Date.parse(operation.plannedStart) + 86400000) / 86400000 / duration * 100);
        const component = components.find(item => item.id === operation.componentId);
        return <div className="pp-gantt-row" key={operation.id}><span title={processLabel(operation)}>{component?.partNumber || "Component"} · {processLabel(operation)}</span><div><i className={statusClass(operation.status)} style={{ left: left + "%", width: Math.min(width, 100 - left) + "%" }}/></div></div>;
      })}</div> : <div className="pp-empty pp-schedule-empty"><CalendarDays size={23}/><strong>No dated processes to schedule.</strong><span>Set actual planned start and due dates in Process Map to populate this schedule.</span></div>}
    </section>

    <section className="pp-bottom-grid">
      <article><h3><Truck size={16}/> Upcoming Deliveries (Next 7 Days)</h3><p>Saved PO component delivery targets</p>{upcoming.slice(0, 6).map(row => <div className="pp-mini-row pp-delivery-row" key={row.line.id}><span>{day(row.line.targetDelivery)}</span><b>{row.po.number}</b><span>{components.find(component => component.id === row.line.componentId)?.partNumber || "Component"}</span><strong>{row.line.quantity.toLocaleString("en-IN")}</strong></div>)}{!upcoming.length ? <small>No PO component deliveries due in the next 7 days.</small> : null}</article>
      <article><h3><Users size={16}/> Vendor Workload (Current Filter)</h3><p>Processes and quantities assigned to each vendor</p>{workloads.map(item => {
        const total = item.operations.reduce((sum, operation) => sum + operation.quantity, 0);
        const accepted = item.operations.reduce((sum, operation) => sum + operation.accepted, 0);
        const pendingQty = Math.max(0, total - accepted);
        const atRisk = item.operations.some(operation => delayed.some(delivery => delivery.id === operation.id));
        return <div className="pp-workload-row" key={item.id}><b>{item.name}</b><span>{item.operations.length}</span><span>{total.toLocaleString("en-IN")}</span><span>{accepted.toLocaleString("en-IN")}</span><span>{pendingQty.toLocaleString("en-IN")}</span><strong className={atRisk ? "risk" : "track"}>{atRisk ? "At Risk" : "On Track"}</strong></div>;
      })}{!workloads.length ? <small>No vendor assignments recorded for this filter.</small> : null}</article>
      <article><h3><ShieldAlert size={16}/> Delays & Risks</h3><p>Past due processes from saved dates</p>{delayed.slice(0, 6).map(operation => <div className="pp-risk-row" key={operation.id}><span>{components.find(component => component.id === operation.componentId)?.partNumber || "Component"}</span><b>{operation.name}</b><span>{operation.vendorId ? "Vendor delay" : "Internal process delay"}</span><strong>{Math.ceil((Date.now() - Date.parse(operation.plannedEnd)) / 86400000)}d</strong><button onClick={() => { setSelectedId(operation.id); setTab("General"); }}>View</button></div>)}{!delayed.length ? <small>No overdue processes detected in this filtered view.</small> : null}</article>
    </section>

    {simulationOpen&&<div className="pp-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setSimulationOpen(false);}}><section className="pp-process-modal pp-simulation-modal" role="dialog" aria-modal="true" aria-labelledby="pp-simulation-title"><div className="pp-modal-head"><div><small>AXIMACH / PLANNING ENGINE</small><h2 id="pp-simulation-title">Production simulation</h2><p>Read-only review of the currently filtered component routes. No production records are changed.</p></div><button onClick={()=>setSimulationOpen(false)} aria-label="Close simulation"><X size={17}/></button></div><div className="pp-simulation-kpis"><article><small>Operations reviewed</small><strong>{displayRows.length}</strong></article><article><small>Complete schedules (date + time)</small><strong>{simulationScheduled}</strong></article><article><small>Missing dates / times</small><strong>{simulationMissing}</strong></article><article><small>Overdue operations</small><strong>{simulationOverdue}</strong></article><article><small>Unpaid vendor operations</small><strong>{simulationUnpaid}</strong></article><article><small>Vendors assigned</small><strong>{simulationAssignedVendors}</strong></article><article><small>Potential schedule overlaps</small><strong>{simulationConflicts.length}</strong></article><article><small>Planned process value</small><strong>{money(simulationValue)}</strong></article></div><div className="pp-simulation-results"><div className="pp-section-head"><div><h3>Route-by-route schedule check</h3><p>Dates, assigned vendor, rate, payment and process status from saved records.</p></div></div>
      <div className="pp-simulation-conflicts"><div className="pp-simulation-conflicts-heading"><strong>Schedule overlap review</strong><span>{simulationConflicts.length} potential overlap(s)</span></div>
        {simulationConflicts.length?simulationConflicts.map(conflict=><div className="pp-simulation-conflict" key={conflict.id}><strong>{conflict.reason}</strong><span>{conflict.first.name} · {vendors.find(vendor=>vendor.id===conflict.first.vendorId)?.company||conflict.first.machine||"Resource"} overlaps {conflict.second.name} · {vendors.find(vendor=>vendor.id===conflict.second.vendorId)?.company||conflict.second.machine||"Resource"}</span><small>{day(conflict.first.plannedStart)} {clock(conflict.first.plannedStartTime||conflict.first.plannedSlotStartAt)} — {day(conflict.first.plannedEnd)} {clock(conflict.first.plannedEndTime||conflict.first.plannedSlotEndAt)}</small><small>Compared with {day(conflict.second.plannedStart)} {clock(conflict.second.plannedStartTime||conflict.second.plannedSlotStartAt)} — {day(conflict.second.plannedEnd)} {clock(conflict.second.plannedEndTime||conflict.second.plannedSlotEndAt)}</small></div>):<p>No overlapping time windows were found among operations with complete start and due date/time.</p>}
        <small>Overlap checks require saved start and due date/time. Same registered-machine overlaps are resource conflicts; shared-vendor overlaps are potential booking conflicts and require capacity confirmation.</small>
      </div>{displayRows.length?<div className="pp-table-scroll"><table><thead><tr><th>Component</th><th>Process</th><th>Vendor</th><th>Start</th><th>Due</th><th>Quantity</th><th>Process value</th><th>Payment</th><th>Status</th></tr></thead><tbody>{displayRows.map(operation=><tr key={operation.id}><td>{components.find(component=>component.id===operation.componentId)?.partNumber||"Component"}</td><td>{processLabel(operation)}</td><td>{vendors.find(vendor=>vendor.id===operation.vendorId)?.company||"In-house"}</td><td>{day(operation.plannedStart)} {clock(operation.plannedStartTime||operation.plannedSlotStartAt)}</td><td>{day(operation.plannedEnd)} {clock(operation.plannedEndTime||operation.plannedSlotEndAt)}</td><td>{operation.quantity.toLocaleString("en-IN")}</td><td>{money(operation.quantity*operation.ratePerPart+operation.transportCost)}</td><td>{operation.vendorId?(operation.vendorPaymentStatus||"Not Paid"):"—"}</td><td>{operation.status}</td></tr>)}</tbody></table></div>:<p className="process-directory-empty">No operations match the current filters. Add or select a component route before simulating.</p>}</div><div className="pp-modal-actions"><button className="button-primary" onClick={()=>setSimulationOpen(false)}>Close simulation</button></div></section></div>}
    {showEditor ? <div className="pp-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowEditor(false); }}>
      <section className="pp-process-modal" role="dialog" aria-modal="true" aria-labelledby="pp-process-modal-title">
        <div className="pp-modal-head"><div><small>COMPONENT PROCESS PLAN</small><h2 id="pp-process-modal-title">{editingId ? "Edit Process" : "Add Process"}</h2><p>Link this process to an existing company, purchase order and PO component line.</p></div><button onClick={() => setShowEditor(false)} aria-label="Close process editor"><X size={17}/></button></div>
        <div className="pp-modal-form">
          <SearchablePicker id="pp-add-company" label="Company" value={draft.companyId} placeholder="Search company…" options={companies.map(company => ({ id: company.id, label: company.name }))} onChange={id => setDraft(current => ({ ...current, companyId: id, poId: "", poLineId: "" }))}/>
          <SearchablePicker id="pp-add-po" label="PO Number" value={draft.poId} placeholder="Search purchase order…" options={orders.filter(po => !draft.companyId || po.companyId === draft.companyId).map(po => ({ id: po.id, label: po.number }))} onChange={id => setDraft(current => ({ ...current, poId: id, poLineId: "" }))}/>
          <SearchablePicker id="pp-add-component" label="Component" value={draft.poLineId} placeholder="Search PO component…" options={draftLineOptions} onChange={id => { const line = draftPO?.lines.find(item => item.id === id); setDraft(current => ({ ...current, poLineId: id, quantity: String(line?.quantity || "") })); }}/>
          <label>Process category *<select value={draft.categoryId} onChange={event=>{const nextId=event.target.value;setProcessQuery("");setDraft(current=>({...current,categoryId:nextId,category:processCategories.find(item=>item.id===nextId)?.name||"",processTypeIds:[],processAssignments:{},name:"",vendorId:""}));}}><option value="">Select category…</option>{processCategories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <div className="pp-process-multi-select pp-modal-wide"><div className="pp-process-multi-head"><strong>Process / subcategory *</strong><span>Select one or more processes from the chosen category.</span><div><button type="button" onClick={()=>setDraft(current=>{
                const ids=processTypes.filter(type=>type.categoryId===current.categoryId).map(type=>type.id);
                const assignments={...current.processAssignments};
                ids.forEach(id=>{if(!assignments[id]){const existing=operations.find(operation=>operation.poLineId===current.poLineId&&operation.processTypeId===id&&!operation.deletedAt);assignments[id]=existing?assignmentFromOperation(existing):emptyProcessAssignment(current.quantity);}});
                const single=ids.length===1?assignments[ids[0]]:undefined;
                return {...current,processTypeIds:ids,processAssignments:assignments,vendorId:single?.vendorId||"",...(single?{plannedStart:single.plannedStart,plannedEnd:single.plannedEnd,plannedStartTime:single.plannedStartTime,plannedEndTime:single.plannedEndTime,quantity:single.quantity,ratePerPart:single.ratePerPart,status:single.status,vendorPaymentStatus:single.vendorPaymentStatus,notes:single.notes}:{})};
              })} disabled={!draft.categoryId}>Select all</button><button type="button" onClick={()=>setDraft(current=>({...current,processTypeIds:[],processAssignments:{},vendorId:"",name:""}))}>Clear</button></div></div>
            <details className="pp-process-dropdown"><summary><span>{draftProcessTypes.length?draftProcessTypes.slice(0,2).map(type=>type.name).join(", ")+(draftProcessTypes.length>2?" + "+(draftProcessTypes.length-2)+" more":""):"Choose process(es)…"}</span><ChevronDown size={14}/></summary>
              <div className="pp-process-dropdown-menu"><label className="pp-process-search"><Search size={13}/><input value={processQuery} onChange={event=>setProcessQuery(event.target.value)} placeholder="Search processes in this category…"/></label>
                <div className="pp-process-multi-options">{processTypes.filter(type=>type.categoryId===draft.categoryId&&type.name.toLowerCase().includes(processQuery.toLowerCase().trim())).map(type=><label key={type.id}><input type="checkbox" checked={draft.processTypeIds.includes(type.id)} onChange={event=>setDraft(current=>{
                  const ids=event.target.checked?[...new Set([...current.processTypeIds,type.id])]:current.processTypeIds.filter(id=>id!==type.id);
                  const assignments={...current.processAssignments};
                  if(event.target.checked&&!assignments[type.id]){
                    const existing=operations.find(operation=>operation.poLineId===current.poLineId&&operation.processTypeId===type.id&&!operation.deletedAt);
                    assignments[type.id]=existing?assignmentFromOperation(existing):emptyProcessAssignment(current.quantity);
                  }
                  const single=ids.length===1?assignments[ids[0]]:undefined;
                  return {...current,processTypeIds:ids,processAssignments:assignments,name:ids.length?processTypes.find(item=>item.id===ids[0])?.name||"":current.name,category:processCategories.find(item=>item.id===current.categoryId)?.name||current.category,vendorId:single?.vendorId||"",...(single?{plannedStart:single.plannedStart,plannedEnd:single.plannedEnd,plannedStartTime:single.plannedStartTime,plannedEndTime:single.plannedEndTime,quantity:single.quantity,ratePerPart:single.ratePerPart,status:single.status,vendorPaymentStatus:single.vendorPaymentStatus,notes:single.notes}:{})};
                })}/><span>{type.name}</span></label>)}{draft.categoryId&&!processTypes.some(type=>type.categoryId===draft.categoryId)&&<small>No processes are configured under this category.</small>}{draft.categoryId&&processTypes.some(type=>type.categoryId===draft.categoryId)&&!processTypes.some(type=>type.categoryId===draft.categoryId&&type.name.toLowerCase().includes(processQuery.toLowerCase().trim()))&&<small>No matching processes.</small>}{!draft.categoryId&&<small>Select a category to load its saved processes.</small>}</div>
              </div></details></div>
          {draft.processTypeIds.length>1 ? <div className="pp-modal-wide pp-operation-assignment-list">
            <div className="pp-operation-assignment-intro"><strong>Independent operation details</strong><span>Each selected process has its own vendor, start/due date and time, quantity, rate, payment and status.</span></div>
            {draftProcessTypes.map(type=>{
              const assignment=draft.processAssignments[type.id]||emptyProcessAssignment(draft.quantity);
              const capableVendors=vendors.filter(vendor=>vendorSupportsProcessType(vendor,type.id)||vendor.id===assignment.vendorId);
              return <article className="pp-operation-assignment-card" key={type.id}>
                <div className="pp-operation-assignment-title"><strong>{type.name}</strong><small>{processCategories.find(category=>category.id===type.categoryId)?.name||"Process category"}</small></div>
                <div className="pp-operation-assignment-fields">
                  <SearchablePicker id={"pp-vendor-"+type.id} label="Vendor (optional)" value={assignment.vendorId} placeholder="Search capable vendor…" options={capableVendors.map(vendor=>({id:vendor.id,label:vendor.company}))} onChange={id=>{const savedRate=latestProcessRate(type.id,id);setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,vendorId:id,ratePerPart:savedRate===undefined?previous.ratePerPart:String(savedRate)}}};});}}/>
                  <label>Start date<input type="date" value={assignment.plannedStart} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,plannedStart:event.target.value}}};})}/></label>
                  <label>Due date<input type="date" min={assignment.plannedStart||undefined} value={assignment.plannedEnd} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,plannedEnd:event.target.value}}};})}/></label>
                  <label>Start time<input type="time" value={assignment.plannedStartTime} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,plannedStartTime:event.target.value}}};})}/></label>
                  <label>Due time<input type="time" value={assignment.plannedEndTime} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,plannedEndTime:event.target.value}}};})}/></label>
                  <label>Quantity (pcs)<input type="number" min="0" value={assignment.quantity} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,quantity:event.target.value}}};})}/></label>
                  <label>Price per piece (₹)<input type="number" min="0" step="0.01" value={assignment.ratePerPart} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,ratePerPart:event.target.value}}};})}/></label>
                  <label>Vendor payment<select value={assignment.vendorPaymentStatus} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,vendorPaymentStatus:event.target.value as "Paid"|"Not Paid"}}};})}><option value="Not Paid">Not Paid</option><option value="Paid">Paid</option></select></label>
                  <label>Process status<select value={assignment.status} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,status:event.target.value as LifecycleStatus}}};})}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
                  <label className="pp-modal-wide">Remarks<input value={assignment.notes} onChange={event=>setDraft(current=>{const previous=current.processAssignments[type.id]||emptyProcessAssignment(current.quantity);return {...current,processAssignments:{...current.processAssignments,[type.id]:{...previous,notes:event.target.value}}};})} placeholder="Optional process remarks"/></label>
                  {!capableVendors.length?<small className="pp-operation-assignment-hint">No Vendor Master capability is linked to this process yet. Add the vendor and process rate in Process Directory.</small>:null}
                </div>
              </article>;
            })}
          </div> : <>
            {!draft.processTypeIds.length&&editingId&&<label>Legacy process name<input value={draft.name} onChange={event=>setDraft(current=>({...current,name:event.target.value}))}/></label>}
            <SearchablePicker id="pp-add-vendor" label="Vendor (optional)" value={draft.vendorId} placeholder="Search vendor company…" options={draftVendorOptions.map(vendor => ({ id: vendor.id, label: vendor.company }))} onChange={id => {const savedRate=draftProcessTypes[0]?latestProcessRate(draftProcessTypes[0].id,id):undefined;setDraft(current => ({ ...current, vendorId: id, ratePerPart:savedRate===undefined?current.ratePerPart:String(savedRate) }));}}/>
            <label>Given / start date<input type="date" value={draft.plannedStart} onChange={event => setDraft(current => ({ ...current, plannedStart: event.target.value }))}/></label>
            <label>Due date<input type="date" min={draft.plannedStart || undefined} value={draft.plannedEnd} onChange={event => setDraft(current => ({ ...current, plannedEnd: event.target.value }))}/></label>
            <label>Start time<input type="time" value={draft.plannedStartTime} onChange={event => setDraft(current => ({ ...current, plannedStartTime: event.target.value }))}/></label>
            <label>Due time<input type="time" value={draft.plannedEndTime} onChange={event => setDraft(current => ({ ...current, plannedEndTime: event.target.value }))}/></label>
            <label>Quantity (pcs)<input type="number" min="0" value={draft.quantity} onChange={event => setDraft(current => ({ ...current, quantity: event.target.value }))}/></label>
            <label>Price per piece (₹)<input type="number" min="0" step="0.01" value={draft.ratePerPart} onChange={event => setDraft(current => ({ ...current, ratePerPart: event.target.value }))}/></label>
            <label>Vendor payment<select value={draft.vendorPaymentStatus} onChange={event=>setDraft(current=>({...current,vendorPaymentStatus:event.target.value as "Paid"|"Not Paid"}))}><option value="Not Paid">Not Paid</option><option value="Paid">Paid</option></select></label>
            <label>Process status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as LifecycleStatus }))}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
            <label className="pp-modal-wide">Remarks<input value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Optional process remarks"/></label>
          </>}
          <label>Route<select value={draft.branch} onChange={event => setDraft(current => ({ ...current, branch: event.target.value, parentId: "" }))}><option>Main route</option><option>Alternate / rework</option></select></label>
          {draft.branch !== "Main route" ? <SearchablePicker id="pp-add-parent" label="Branch from process" value={draft.parentId} placeholder="Select parent process…" options={parentOptions} onChange={id => setDraft(current => ({ ...current, parentId: id }))}/> : null}
        </div>
        <div className="pp-modal-actions"><button className="pp-add-process" onClick={saveProcess}><Plus size={14}/>{editingId ? "Save Process" : "Add Process"}</button><button onClick={() => setShowEditor(false)}>Cancel</button></div>
      </section>
    </div> : null}
  </div>;
}
