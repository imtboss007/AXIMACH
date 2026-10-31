import { Fragment, useMemo, useState } from "react";
import { Activity, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Clock3, Maximize2, Plus, Search, ShieldAlert, SlidersHorizontal, Truck, Users, Workflow, X, Wrench } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type LifecycleStatus, type OperationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Props = { onBack: () => void; onNotice: (value: string) => void; onSelectModule: (id: string) => void };
type FilterOption = { id: string; label: string };
type ProcessDraft = {
  companyId: string; poId: string; poLineId: string; name: string; category: string; vendorId: string;
  plannedStart: string; plannedEnd: string; quantity: string; ratePerPart: string;
  status: LifecycleStatus; branch: string; parentId: string; notes: string;
};
const emptyDraft = (): ProcessDraft => ({
  companyId: "", poId: "", poLineId: "", name: "", category: "", vendorId: "",
  plannedStart: "", plannedEnd: "", quantity: "", ratePerPart: "",
  status: "Queued", branch: "Main route", parentId: "", notes: ""
});
const day = (value?: string) => value ? new Date(value + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const statusClass = (value: string) => value.toLowerCase().replace(/[^a-z]+/g, "-");
const isSelected = (ids: string[], id: string) => ids.length === 0 || ids.includes(id);

function MultiSelectFilter({ label, options, value, onChange, optional = false }: {
  label: string; options: FilterOption[]; value: string[]; onChange: (ids: string[]) => void; optional?: boolean;
}) {
  const [query, setQuery] = useState("");
  const optionIds = options.map(option => option.id);
  const filtered = options.filter(option => option.label.toLowerCase().includes(query.toLowerCase().trim()));
  const allSelected = value.length === 0 || value.length === options.length;
  const toggle = (id: string) => {
    if (value.length === 0 || value.length === options.length) {
      onChange(optionIds.filter(item => item !== id));
      return;
    }
    const next = value.includes(id) ? value.filter(item => item !== id) : [...value, id];
    onChange(next.length === options.length ? [] : next);
  };
  return <div className="pp-filter">
    <label>{label}{optional ? <small>Optional</small> : null}</label>
    <details className="pp-multiselect">
      <summary><Search size={13}/><span>{allSelected ? "All " + label.toLowerCase() : value.length + " selected"}</span><ChevronDown size={13}/></summary>
      <div className="pp-filter-menu">
        <label className="pp-filter-search"><Search size={13}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={"Search " + label.toLowerCase() + "…"} /></label>
        <div className="pp-filter-menu-actions">
          <button type="button" onClick={() => onChange([])}>Select all</button>
          <button type="button" onClick={() => onChange([])}>Clear filter</button>
        </div>
        <div className="pp-filter-options">
          {filtered.map(option => <label key={option.id}><input type="checkbox" checked={isSelected(value, option.id)} onChange={() => toggle(option.id)}/><span>{option.label}</span></label>)}
          {!filtered.length && <small>No matching saved records.</small>}
        </div>
      </div>
    </details>
  </div>;
}

export default function ProductionPlanningWorkspace({ onBack, onNotice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const companies = activeRows(data.companies);
  const orders = activeRows(data.purchaseOrders);
  const components = activeRows(data.components);
  const vendors = activeRows(data.vendors);
  const operations = activeRows(data.operations);

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
  const [collapsedComponents, setCollapsedComponents] = useState<string[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<ProcessDraft>(emptyDraft());

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
    return (operation.name + " " + operation.category + " " + operation.status + " " + vendorName).toLowerCase().includes(search.toLowerCase().trim());
  });
  const selected = visible.find(operation => operation.id === selectedId) || rows.find(operation => operation.id === selectedId) || visible[0] || rows[0];
  const selectedLine = allowedLines.find(row => row.line.id === selected?.poLineId);
  const selectedComponent = components.find(component => component.id === (selected?.componentId || selectedLine?.line.componentId));
  const selectedPO = orders.find(po => po.id === (selected?.poId || selectedLine?.po.id));

  const totalQty = allowedLines.reduce((sum, row) => sum + row.line.quantity, 0);
  const planned = rows.filter(operation => operation.status === "Queued").reduce((sum, operation) => sum + operation.quantity, 0);
  const inProgress = rows.filter(operation => operation.status === "Running").reduce((sum, operation) => sum + operation.quantity, 0);
  const completed = rows.filter(operation => operation.status === "Complete").reduce((sum, operation) => sum + operation.accepted, 0);
  const pending = Math.max(0, totalQty - completed - inProgress);
  const today = new Date().toISOString().slice(0, 10);
  const delayed = rows.filter(operation => operation.status !== "Complete" && operation.plannedEnd && operation.plannedEnd < today);
  const assigned = new Set(rows.map(operation => operation.vendorId).filter(Boolean)).size;
  const processCount = rows.length;
  const processLabel = (operation: OperationRecord) => operation.name || operation.category || "Operation";
  const allDates = rows.flatMap(operation => [operation.plannedStart, operation.plannedEnd]).filter(Boolean).sort();
  const timelineStart = allDates[0] || today;
  const timelineEnd = allDates[allDates.length - 1] || timelineStart;
  const duration = Math.max(1, (Date.parse(timelineEnd) - Date.parse(timelineStart)) / 86400000 + 1);

  const setSelection = (setter: (ids: string[]) => void, ids: string[]) => setter(ids);
  const resetFilters = () => {
    setCompanyIds([]); setPoIds([]); setComponentIds([]); setVendorIds([]);
    setStatusIds([]); setExecutionIds([]); setCategoryIds([]);
    setPeriodStart(""); setPeriodEnd(""); setSearch(""); setSelectedId("");
  };
  const openAdd = () => {
    const next = emptyDraft();
    if (companyIds.length === 1) next.companyId = companyIds[0];
    if (poIds.length === 1) next.poId = poIds[0];
    const preferredLine = allowedLines.length === 1 ? allowedLines[0] : undefined;
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
    setDraft({
      companyId: po?.companyId || "", poId: operation.poId, poLineId: operation.poLineId,
      name: operation.name, category: operation.category, vendorId: operation.vendorId || "",
      plannedStart: operation.plannedStart || "", plannedEnd: operation.plannedEnd || "",
      quantity: String(operation.quantity), ratePerPart: String(operation.ratePerPart),
      status: operation.status, branch: operation.branch || "Main route", parentId: operation.parentId || "", notes: operation.notes || ""
    });
    setEditingId(operation.id); setShowEditor(true);
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
    if (!draft.name.trim()) { onNotice("Enter the process name."); return; }
    const quantity = Number(draft.quantity || line.quantity);
    const rate = Number(draft.ratePerPart || 0);
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(rate) || rate < 0) { onNotice("Quantity and price must be valid non-negative numbers."); return; }
    if (draft.plannedStart && draft.plannedEnd && draft.plannedEnd < draft.plannedStart) { onNotice("Due date cannot be earlier than the start date."); return; }
    const stamp = nowIso();
    const id = editingId || makeId("operation");
    update(current => {
      const previous = current.operations.find(operation => operation.id === id);
      const lineOperations = current.operations.filter(operation => operation.poLineId === line.id && operation.poId === po.id && !operation.deletedAt);
      const next: OperationRecord = {
        id, poId: po.id, poLineId: line.id, componentId: component.id,
        sequence: previous?.sequence ?? (Math.max(0, ...lineOperations.map(operation => operation.sequence)) + 10),
        name: draft.name.trim(), category: draft.category.trim(), machine: previous?.machine || "",
        machineResourceId: previous?.machineResourceId, vendorId: draft.vendorId,
        status: draft.status, plannedStart: draft.plannedStart, plannedEnd: draft.plannedEnd,
        actualStart: previous?.actualStart || "", actualEnd: previous?.actualEnd || "",
        plannedSlotStartAt: previous?.plannedSlotStartAt, plannedSlotEndAt: previous?.plannedSlotEndAt,
        quantity, completed: previous?.completed || 0, accepted: previous?.accepted || 0, rejected: previous?.rejected || 0,
        setupHours: previous?.setupHours || 0, cycleTimeSeconds: previous?.cycleTimeSeconds || 0,
        ratePerPart: rate, actualRatePerPart: previous?.actualRatePerPart || 0,
        transportVendorId: previous?.transportVendorId || "", transportPickup: previous?.transportPickup || "",
        transportDelivery: previous?.transportDelivery || "", transportCost: previous?.transportCost || 0,
        qualityNotes: previous?.qualityNotes || "", inspectionResult: previous?.inspectionResult || "",
        notes: draft.notes, vendorPaymentStatus: previous?.vendorPaymentStatus || "Not Paid", branch: draft.branch, parentId: draft.branch === "Main route" ? "" : draft.parentId,
        createdAt: previous?.createdAt || stamp, updatedAt: stamp, deletedAt: undefined
      };
      return { ...current, operations: [...current.operations.filter(operation => operation.id !== id), next] };
    });
    setSelectedId(id); setTab("General"); setShowEditor(false); setEditingId("");
    onNotice(editingId ? "Process details updated in the saved component route." : "Process added to the selected PO component route.");
  };

  const componentGroups = allowedLines.map(row => {
    const component = components.find(item => item.id === row.line.componentId);
    const groupOperations = rows.filter(operation => operation.poLineId === row.line.id).slice().sort((a, b) => a.sequence - b.sequence);
    return { key: row.po.id + ":" + row.line.id, po: row.po, line: row.line, component, operations: groupOperations };
  });
  const toggleComponent = (key: string) => setCollapsedComponents(current => current.includes(key) ? current.filter(item => item !== key) : [...current, key]);
  const allCollapsed = componentGroups.length > 0 && componentGroups.every(group => collapsedComponents.includes(group.key));
  const workloads = vendors.map(vendor => {
    const vendorOperations = rows.filter(operation => operation.vendorId === vendor.id);
    return { id: vendor.id, name: vendor.company, operations: vendorOperations };
  }).filter(item => item.operations.length);
  const internalOperations = rows.filter(operation => !operation.vendorId);
  if (internalOperations.length) workloads.push({ id: "__internal__", name: "In-house", operations: internalOperations });
  const upcomingLimit = new Date(); upcomingLimit.setDate(upcomingLimit.getDate() + 7);
  const upcomingDate = upcomingLimit.toISOString().slice(0, 10);
  const upcoming = allowedLines.filter(row => row.line.targetDelivery && row.line.targetDelivery >= today && row.line.targetDelivery <= upcomingDate);
  const ganttRows = rows.filter(operation => operation.plannedStart && operation.plannedEnd);
  const searchedRows = visible;

  return <div className="production-planning">
    <header className="pp-heading">
      <div><div className="pp-eyebrow">AXIMACH / OPERATIONS CONTROL</div><h1>Production Planning</h1><p>Company → Purchase Order → Component → Process → Vendor, dates, quantity and price.</p></div>
      <div className="pp-heading-actions"><span className={"pp-live " + (syncStatus === "synced" ? "pp-live-connected" : "")}><i/>{syncStatus === "synced" ? "SHARED DATA ONLINE" : syncStatus === "syncing" ? "SYNCING" : syncStatus === "error" ? "SYNC ERROR" : "LOCAL DATA"}</span><button onClick={() => onSelectModule("command-centre")}>Command Centre</button></div>
    </header>

    <section className="pp-filter-panel">
      <div className="pp-filter-grid">
        <MultiSelectFilter label="Company" options={companyOptions} value={companyIds} onChange={ids => { setSelection(setCompanyIds, ids); setPoIds([]); setComponentIds([]); }}/>
        <MultiSelectFilter label="PO Number" options={poOptions} value={poIds} onChange={ids => { setSelection(setPoIds, ids); setComponentIds([]); }}/>
        <MultiSelectFilter label="Component" options={componentOptions} value={componentIds} onChange={setComponentIds}/>
        <div className="pp-filter pp-date"><label>Plan Period</label><div className="pp-date-range"><input aria-label="Plan period start" type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)}/><span>to</span><input aria-label="Plan period end" type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)}/></div></div>
        <MultiSelectFilter label="Vendor" options={vendorOptions} value={vendorIds} onChange={setVendorIds} optional/>
        <div className="pp-filter-actions"><button className="pp-apply" onClick={() => onNotice("Filters applied to saved companies, purchase orders, components and vendor assignments.")}>Apply</button><button onClick={resetFilters}>Reset</button></div>
      </div>
      <div className="pp-secondary-filters">
        <MultiSelectFilter label="Process Status" options={statusOptions} value={statusIds} onChange={setStatusIds}/>
        <MultiSelectFilter label="Execution Type" options={executionOptions} value={executionIds} onChange={setExecutionIds}/>
        <MultiSelectFilter label="Process Category" options={categoryOptions} value={categoryIds} onChange={setCategoryIds}/>
        <span className="pp-filter-help"><SlidersHorizontal size={13}/> Search and check multiple values. Selecting a vendor shows only the components assigned to that vendor.</span>
      </div>
    </section>

    <section className="pp-kpis">
      {[{ label: "Total Qty", value: totalQty, sub: allowedLines.length + " PO component lines", icon: Activity, kind: "blue" },
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
          <button onClick={() => onNotice("Simulation preview is not connected to a planning model yet. No records were changed.")}>Simulate</button>
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
                      <button className={"pp-route-node " + statusClass(operation.status) + (selected?.id === operation.id ? " selected" : "")} onClick={() => { setSelectedId(operation.id); setTab("General"); }}>
                        <span className="pp-route-node-top"><b>{operation.sequence / 10 || index + 1}. {processLabel(operation)}</b><small>OP-{String(operation.sequence).padStart(3, "0")}</small></span>
                        <span className="pp-route-node-data">Vendor: {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</span>
                        <span className="pp-route-node-data">Start: {day(operation.plannedStart)}</span>
                        <span className="pp-route-node-data">Due: {day(operation.plannedEnd)}</span>
                        <span className="pp-route-node-data">Qty: {operation.quantity.toLocaleString("en-IN")} pcs</span>
                        <span className="pp-route-node-data">Price: {money(operation.ratePerPart)}</span>
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
                        <button className={"pp-route-node " + statusClass(operation.status) + (selected?.id === operation.id ? " selected" : "")} onClick={() => { setSelectedId(operation.id); setTab("General"); }}>
                          <span className="pp-route-node-top"><b>{operation.sequence / 10 || index + 1}. {processLabel(operation)}</b><small>OP-{String(operation.sequence).padStart(3, "0")}</small></span>
                          <span className="pp-route-node-data">Vendor: {vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</span>
                          <span className="pp-route-node-data">Start: {day(operation.plannedStart)}</span>
                          <span className="pp-route-node-data">Due: {day(operation.plannedEnd)}</span>
                          <span className="pp-route-node-data">Qty: {operation.quantity.toLocaleString("en-IN")} pcs</span>
                          <span className="pp-route-node-data">Price: {money(operation.ratePerPart)}</span>
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
          <thead><tr><th>#</th><th>Process</th><th>Category</th><th>Execution</th><th>Vendor</th><th>Start Date</th><th>Due Date</th><th>Qty (pcs)</th><th>Price (₹/pc)</th><th>Total Cost (₹)</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>{searchedRows.map((operation, index) => <tr key={operation.id} onClick={() => setSelectedId(operation.id)} className={selected?.id === operation.id ? "active" : ""}>
            <td>{index + 1}</td><td>{operation.name}</td><td>{operation.category || "—"}</td><td>{operation.vendorId ? "Outsourced" : "Internal"}</td>
            <td>{vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</td><td>{day(operation.plannedStart)}</td><td>{day(operation.plannedEnd)}</td>
            <td>{operation.quantity.toLocaleString("en-IN")}</td><td>{money(operation.ratePerPart)}</td><td>{money(operation.quantity * operation.ratePerPart + operation.transportCost)}</td>
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
            {tab === "General" ? <><p><b>Process:</b><span>{selected.name}</span></p><p><b>Category:</b><span>{selected.category || "—"}</span></p><p><b>Execution:</b><span>{selected.vendorId ? "Outsourced" : "Internal"}</span></p><p><b>Company:</b><span>{companies.find(company => company.id === selectedPO?.companyId)?.name || "—"}</span></p><p><b>PO:</b><span>{orders.find(po => po.id === selected.poId)?.number || "—"}</span></p><p><b>Component:</b><span>{components.find(component => component.id === selected.componentId)?.partNumber || "—"}</span></p><p><b>Status:</b><span>{selected.status}</span></p></> :
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
        <div className="pp-actions"><button className={!calendar ? "active" : ""} onClick={() => setCalendar(false)}>Gantt View</button><button className={calendar ? "active" : ""} onClick={() => setCalendar(true)}><CalendarDays size={13}/> Calendar View</button>{["Day", "Week", "Month"].map(item => <button className={scale === item ? "active" : ""} onClick={() => setScale(item)} key={item}>{item}</button>)}</div>
      </div>
      {calendar ? <div className="pp-calendar-list">{rows.filter(operation => operation.plannedStart || operation.plannedEnd).slice().sort((a, b) => (a.plannedStart || "").localeCompare(b.plannedStart || "")).map(operation => <div className="pp-calendar-row" key={operation.id}><strong>{day(operation.plannedStart)}</strong><span>{processLabel(operation)}</span><small>{vendors.find(vendor => vendor.id === operation.vendorId)?.company || "In-house"}</small><b>{day(operation.plannedEnd)}</b><em className={statusClass(operation.status)}>{operation.status}</em></div>)}{!rows.some(operation => operation.plannedStart || operation.plannedEnd) ? <div className="pp-empty pp-schedule-empty"><CalendarDays size={23}/><strong>No dated processes.</strong><span>Set process dates to populate the calendar.</span></div> : null}</div> :
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

    {showEditor ? <div className="pp-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowEditor(false); }}>
      <section className="pp-process-modal" role="dialog" aria-modal="true" aria-labelledby="pp-process-modal-title">
        <div className="pp-modal-head"><div><small>COMPONENT PROCESS PLAN</small><h2 id="pp-process-modal-title">{editingId ? "Edit Process" : "Add Process"}</h2><p>Link this process to an existing company, purchase order and PO component line.</p></div><button onClick={() => setShowEditor(false)} aria-label="Close process editor"><X size={17}/></button></div>
        <div className="pp-modal-form">
          <SearchablePicker id="pp-add-company" label="Company" value={draft.companyId} placeholder="Search company…" options={companies.map(company => ({ id: company.id, label: company.name }))} onChange={id => setDraft(current => ({ ...current, companyId: id, poId: "", poLineId: "" }))}/>
          <SearchablePicker id="pp-add-po" label="PO Number" value={draft.poId} placeholder="Search purchase order…" options={orders.filter(po => !draft.companyId || po.companyId === draft.companyId).map(po => ({ id: po.id, label: po.number }))} onChange={id => setDraft(current => ({ ...current, poId: id, poLineId: "" }))}/>
          <SearchablePicker id="pp-add-component" label="Component" value={draft.poLineId} placeholder="Search PO component…" options={draftLineOptions} onChange={id => { const line = draftPO?.lines.find(item => item.id === id); setDraft(current => ({ ...current, poLineId: id, quantity: String(line?.quantity || "") })); }}/>
          <label>Process name *<input value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder="Enter actual process name"/></label>
          <label>Process category<input value={draft.category} onChange={event => setDraft(current => ({ ...current, category: event.target.value }))} placeholder="Enter process category"/></label>
          <SearchablePicker id="pp-add-vendor" label="Vendor (optional)" value={draft.vendorId} placeholder="Type vendor name…" options={vendors.map(vendor => ({ id: vendor.id, label: vendor.company + (vendor.phone ? " · " + vendor.phone : "") }))} onChange={id => setDraft(current => ({ ...current, vendorId: id }))}/>
          <label>Given / start date<input type="date" value={draft.plannedStart} onChange={event => setDraft(current => ({ ...current, plannedStart: event.target.value }))}/></label>
          <label>Due date<input type="date" min={draft.plannedStart || undefined} value={draft.plannedEnd} onChange={event => setDraft(current => ({ ...current, plannedEnd: event.target.value }))}/></label>
          <label>Quantity (pcs)<input type="number" min="0" value={draft.quantity} onChange={event => setDraft(current => ({ ...current, quantity: event.target.value }))}/></label>
          <label>Price per piece (₹)<input type="number" min="0" step="0.01" value={draft.ratePerPart} onChange={event => setDraft(current => ({ ...current, ratePerPart: event.target.value }))}/></label>
          <label>Process status<select value={draft.status} onChange={event => setDraft(current => ({ ...current, status: event.target.value as LifecycleStatus }))}><option>Queued</option><option>Running</option><option>Complete</option><option>Quality hold</option></select></label>
          <label>Route<select value={draft.branch} onChange={event => setDraft(current => ({ ...current, branch: event.target.value, parentId: "" }))}><option>Main route</option><option>Alternate / rework</option></select></label>
          {draft.branch !== "Main route" ? <SearchablePicker id="pp-add-parent" label="Branch from process" value={draft.parentId} placeholder="Select parent process…" options={parentOptions} onChange={id => setDraft(current => ({ ...current, parentId: id }))}/> : null}
          <label className="pp-modal-wide">Remarks<input value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Optional process remarks"/></label>
        </div>
        <div className="pp-modal-actions"><button className="pp-add-process" onClick={saveProcess}><Plus size={14}/>{editingId ? "Save Process" : "Add Process"}</button><button onClick={() => setShowEditor(false)}>Cancel</button></div>
      </section>
    </div> : null}
  </div>;
}
