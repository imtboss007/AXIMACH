import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Edit3, MapPin, Plus, Search, ShieldCheck, Truck, Users, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type TransportRouteRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";
import SearchableMultiSelect from "./SearchableMultiSelect";
import { VehicleBadge, VEHICLE_TYPES } from "./TransportVehicle";
import TransportRoutingDemo from "./TransportRoutingDemo";

type NavigationContext = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string; vendorId?:string; routeId?:string };
type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string, context?: NavigationContext) => void; onOpenContact360?: (vendorId: string) => void; initialContext?:NavigationContext };

const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function TransportDirectoryWorkspace({ onBack, onNotice, notice, onSelectModule, onOpenContact360, initialContext }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const routes = activeRows(data.transportRoutes || []);
  const vendors = activeRows(data.vendors);
  const transportLegs = activeRows(data.transportLegs || []);
  const materialEntries = activeRows(data.materialCostEntries || []);
  const vehicleOptions = [...new Set([...VEHICLE_TYPES, ...routes.map(route => route.vehicleType).filter(Boolean)])];
  const [search, setSearch] = useState("");
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [routeFilterIds, setRouteFilterIds] = useState<string[]>([]);
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  useEffect(()=>{
    const matches=(record:{companyId?:string;poId?:string;poLineId?:string;componentId?:string;vendorId?:string})=>
      (!initialContext?.companyId||record.companyId===initialContext.companyId)
      &&(!initialContext?.poId||record.poId===initialContext.poId)
      &&(!initialContext?.poLineId||record.poLineId===initialContext.poLineId)
      &&(!initialContext?.componentId||record.componentId===initialContext.componentId);
    const linkedLegs=transportLegs.filter(matches);
    const linkedMaterials=materialEntries.filter(entry=>matches(entry)&&Boolean(entry.transportVendorId));
    const vendorIds=[...new Set([
      ...(initialContext?.vendorId?[initialContext.vendorId]:[]),
      ...linkedLegs.map(row=>row.vendorId),
      ...linkedMaterials.map(row=>row.transportVendorId)
    ].filter((id):id is string=>Boolean(id)&&vendors.some(vendor=>vendor.id===id)))];
    setSelectedVendors(vendorIds);
    setRouteFilterIds(initialContext?.routeId?[initialContext.routeId]:[]);
    setSearch("");
    setSelectedRouteIds([]);
  },[initialContext?.companyId,initialContext?.poId,initialContext?.poLineId,initialContext?.componentId,initialContext?.vendorId,initialContext?.routeId,data.updatedAt]);
  const [editingId, setEditingId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [tripDirection, setTripDirection] = useState<"One-way" | "Two-way">("One-way");
  const [vehicleType, setVehicleType] = useState<string>(VEHICLE_TYPES[2]);
  const [fixedAmount, setFixedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [showTransportDemo, setShowTransportDemo] = useState(false);
  const filtered = useMemo(() => routes.filter(route => {
    const vendor = vendors.find(row => row.id === route.vendorId);
    const textMatch = [route.fromLocation, route.toLocation, route.tripDirection, route.vehicleType, route.notes, vendor?.company || "", vendor?.contact || ""]
      .join(" ").toLowerCase().includes(search.trim().toLowerCase());
    return textMatch &&
      (!selectedVehicles.length || selectedVehicles.includes(route.vehicleType)) &&
      (!selectedDirections.length || selectedDirections.includes(route.tripDirection)) &&
      (!selectedVendors.length || selectedVendors.includes(route.vendorId)) &&
      (!routeFilterIds.length || routeFilterIds.includes(route.id));
  }), [routes, vendors, search, selectedVehicles, selectedDirections, selectedVendors, routeFilterIds]);
  const toggleFilter = (value: string, selected: string[], setter: (next: string[]) => void) =>
    setter(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  const clearFilters = () => { setSearch(""); setSelectedVehicles([]); setSelectedDirections([]); setSelectedVendors([]); setRouteFilterIds([]); };
  const selectVisibleRoutes = (checked: boolean) => setSelectedRouteIds(current =>
    checked ? [...new Set([...current, ...filtered.map(route => route.id)])] : current.filter(id => !filtered.some(route => route.id === id))
  );
  const archiveSelectedRoutes = () => {
    const ids = new Set(selectedRouteIds.filter(id => routes.some(route => route.id === id)));
    if (!ids.size) { onNotice("Select one or more transport routes first."); return; }
    if (!window.confirm("Archive " + ids.size + " selected transport route(s)? Existing component transport entries and saved rate snapshots remain unchanged.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, transportRoutes: current.transportRoutes.map(route => ids.has(route.id) ? { ...route, active: false, deletedAt: stamp, updatedAt: stamp } : route) }));
    setSelectedRouteIds([]);
    onNotice(ids.size + " transport route(s) archived. Existing dispatch and component transport history was retained.");
  };
  const reset = () => { setEditingId(""); setVendorId(""); setFromLocation(""); setToLocation(""); setTripDirection("One-way"); setVehicleType(VEHICLE_TYPES[2]); setFixedAmount(""); setNotes(""); };
  const save = () => {
    if (!vendorId || !fromLocation.trim() || !toLocation.trim() || !vehicleType.trim()) { onNotice("Select a vendor and enter both route locations and a vehicle type."); return; }
    if (!vendors.some(vendor => vendor.id === vendorId)) { onNotice("The selected transport vendor is missing or archived. Choose an active Vendor Directory record."); return; }
    const amount = Number(fixedAmount);
    if (!Number.isFinite(amount) || amount < 0) { onNotice("Enter a valid fixed transport amount in rupees."); return; }
    const stamp = nowIso();
    const old = routes.find(row => row.id === editingId);
    const route: TransportRouteRecord = {
      id: editingId || makeId("transport-route"), vendorId, fromLocation: fromLocation.trim(), toLocation: toLocation.trim(),
      tripDirection, vehicleType: vehicleType.trim(), fixedAmount: amount, currency: "INR", active: true, notes: notes.trim(),
      createdAt: old?.createdAt || stamp, updatedAt: stamp
    };
    update(current => ({ ...current, transportRoutes: [route, ...current.transportRoutes.filter(row => row.id !== route.id)] }));
    reset();
    onNotice(editingId ? "Transport route rate updated. Existing component transport entries retain their saved rate snapshot." : "Transport route and fixed rate saved to the shared Transport Directory.");
  };
  const edit = (route: TransportRouteRecord) => {
    setEditingId(route.id); setVendorId(route.vendorId); setFromLocation(route.fromLocation); setToLocation(route.toLocation);
    setTripDirection(route.tripDirection); setVehicleType(route.vehicleType); setFixedAmount(String(route.fixedAmount)); setNotes(route.notes || "");
  };
  const archive = (route: TransportRouteRecord) => {
    if (!window.confirm("Archive this transport route? Existing component transport entries and their saved rates will remain unchanged.")) return;
    const stamp = nowIso();
    update(current => ({ ...current, transportRoutes: current.transportRoutes.map(row => row.id === route.id ? { ...row, active: false, deletedAt: stamp, updatedAt: stamp } : row) }));
    onNotice("Transport route archived. Existing component transport history and cost snapshots were retained.");
  };
  return <section className="workspace-page specialized-directory">
    {notice && <div className="notice-banner"><ShieldCheck size={16}/><span>{notice}</span><button onClick={() => onNotice("")} aria-label="Dismiss notice"><X size={15}/></button></div>}
    <div className="workspace-topline"><button className="back-link" onClick={onBack}><ArrowRight size={15}/> Command centre</button><span className={"demo-pill " + (syncStatus === "synced" ? "scheduler-connected" : "")}><i/> {syncStatus === "synced" ? "SHARED DATA SYNCED" : "TRANSPORT MASTER"}</span><span className="module-number">{routes.length} SAVED ROUTES</span></div>
    <div className="workspace-title-row"><div><div className="eyebrow"><span className="eyebrow-mark"/> SUPPLY NETWORK / RATE MASTER</div><h1>Transport Directory<span>.</span></h1><p>Maintain fixed route rates linked to existing Vendor Directory records. One-way and two-way prices are stored separately by vehicle type.</p></div></div>
    <div className="module-action-bar">
      <label className="module-record-search"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search route, vehicle, vendor or location…"/></label>
      <button className="button-quiet compact-button" onClick={() => setShowTransportDemo(value=>!value)} aria-expanded={showTransportDemo}><Truck size={14}/> {showTransportDemo ? "Close route demo" : "Preview multi-route demo"}</button>
      <button className="button-quiet compact-button" onClick={() => onSelectModule("vendors",{...initialContext,vendorId:initialContext?.vendorId||(selectedVendors.length===1?selectedVendors[0]:undefined)})}><Users size={14}/> Vendor Directory</button>
      <button className="button-quiet compact-button" onClick={() => {const targetVendor=initialContext?.vendorId||(selectedVendors.length===1?selectedVendors[0]:undefined);if(targetVendor)onOpenContact360?.(targetVendor);else onSelectModule("contact360",initialContext);}}><Users size={14}/> Contact 360</button>
    </div>
    {showTransportDemo && <TransportRoutingDemo onClose={()=>setShowTransportDemo(false)}/>}
    <section className="surface-panel transport-filter-panel">
      <div className="panel-heading"><div><h3>Filter transport routes</h3><p>{initialContext?.poId||initialContext?.componentId?"Showing transport rates linked to the selected manufacturing record where available. Clear filters to browse every route.":"Select All to show every saved route, or tick any combination of filters."}</p></div><button type="button" className="button-quiet compact-button" onClick={clearFilters}>Clear filters</button></div>
      <div className="module-action-bar po-bulk-actions"><label><input type="checkbox" checked={filtered.length > 0 && filtered.every(route => selectedRouteIds.includes(route.id))} onChange={event => selectVisibleRoutes(event.target.checked)}/> Select all visible routes</label><span className="module-number">{selectedRouteIds.filter(id => routes.some(route => route.id === id)).length} SELECTED</span><button type="button" className="button-danger compact-button" disabled={!selectedRouteIds.length} onClick={archiveSelectedRoutes}>Archive selected</button><button type="button" className="button-quiet compact-button" disabled={!selectedRouteIds.length} onClick={() => setSelectedRouteIds([])}>Clear selection</button></div>
      <div className="transport-filter-groups ax-search-filter-columns">
        <button type="button" className="button-quiet compact-button" onClick={clearFilters}>All routes</button>
        <SearchableMultiSelect id="transport-filter-route" label="Route (from → to)" options={routes.map(route=>({id:route.id,label:route.fromLocation+" → "+route.toLocation+" · "+route.vehicleType+" · "+(vendors.find(vendor=>vendor.id===route.vendorId)?.company||"Vendor")}))} selected={routeFilterIds} onChange={setRouteFilterIds} emptyMeansAll/>
        <SearchableMultiSelect id="transport-filter-vehicle" label="Vehicle type" options={vehicleOptions.map(value=>({id:value,label:value}))} selected={selectedVehicles} onChange={setSelectedVehicles} emptyMeansAll/>
        <SearchableMultiSelect id="transport-filter-direction" label="Trip direction" options={["One-way","Two-way"].map(value=>({id:value,label:value}))} selected={selectedDirections} onChange={setSelectedDirections} emptyMeansAll/>
        <SearchableMultiSelect id="transport-filter-vendor" label="Transport vendor" options={vendors.map(vendor=>({id:vendor.id,label:vendor.company+" · "+(vendor.contact||"Contact not set")}))} selected={selectedVendors} onChange={setSelectedVendors} emptyMeansAll/>
      </div>
      <p className="transport-filter-result">Showing {filtered.length} of {routes.length} saved routes</p>
    </section>
    <section className="surface-panel">
      <div className="panel-heading"><div><h3>{editingId ? "Edit fixed route rate" : "Add transport route"}</h3><p>Save one rate for each route, vehicle and trip direction. Select a different rate record for a one-way or round trip.</p></div><Truck size={19}/></div>
      <div className="module-form-grid">
        <SearchablePicker id="transport-route-vendor" label="Transport vendor *" value={vendorId} placeholder="Type vendor name or contact…" options={vendors.map(vendor=>({id:vendor.id,label:vendor.company+" · "+(vendor.contact||"Contact not set")}))} onChange={setVendorId}/>
        <label>From location *<input value={fromLocation} onChange={event => setFromLocation(event.target.value)} placeholder="Pickup location"/></label>
        <label>To location *<input value={toLocation} onChange={event => setToLocation(event.target.value)} placeholder="Delivery location"/></label>
        <SearchablePicker id="transport-route-direction" label="Trip direction *" value={tripDirection} options={["One-way","Two-way"].map(value=>({id:value,label:value}))} onChange={value=>setTripDirection(value as "One-way"|"Two-way")}/>
        <SearchablePicker id="transport-route-vehicle" label="Vehicle type *" value={vehicleType} placeholder="Search vehicle class…" options={vehicleOptions.map(value=>({id:value,label:value}))} onChange={setVehicleType}/>
        <label>Fixed amount (₹) *<input inputMode="decimal" type="number" min="0" step="0.01" value={fixedAmount} onChange={event => setFixedAmount(event.target.value)} placeholder="Enter agreed route rate"/></label>
        <label className="editor-wide">Notes<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Validity, loading terms, waiting charges or agreement reference"/></label>
      </div>
      <div className="module-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/>{editingId ? "Save route rate" : "Add route rate"}</button>{editingId && <button className="button-quiet" onClick={reset}>Cancel edit</button>}</div>
    </section>
    <section className="surface-panel">
      <div className="panel-heading"><div><div className="eyebrow">SAVED RATE REGISTER</div><h3>Transport routes ({filtered.length})</h3><p>Component transport usage copies the selected rate into a cost snapshot; later master-price changes do not rewrite earlier component costs.</p></div></div>
      {filtered.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Select</th><th>From → To</th><th>Vehicle</th><th>Trip type</th><th>Fixed rate</th><th>Vendor</th><th>Contact</th><th>Actions</th></tr></thead><tbody>{filtered.map(route => { const vendor = vendors.find(row => row.id === route.vendorId); return <tr key={route.id}><td><input type="checkbox" aria-label={"Select route " + route.fromLocation + " to " + route.toLocation} checked={selectedRouteIds.includes(route.id)} onChange={() => setSelectedRouteIds(current => current.includes(route.id) ? current.filter(id => id !== route.id) : [...current, route.id])}/></td><td><strong>{route.fromLocation} → {route.toLocation}</strong>{route.notes && <small>{route.notes}</small>}</td><td><VehicleBadge vehicleType={route.vehicleType}/></td><td>{route.tripDirection}</td><td><strong>{money(route.fixedAmount)}</strong></td><td>{vendor?.company || "Vendor archived"}</td><td>{vendor?.contact || "—"}<small>{vendor?.phone || vendor?.whatsappNumber || ""}</small></td><td><div className="process-row-actions"><button title="Edit route" onClick={() => edit(route)}><Edit3 size={13}/></button><button title="Archive route" onClick={() => archive(route)}><X size={13}/></button><button title="Open linked vendor in Contact 360" onClick={() => onSelectModule("vendors",{vendorId:route.vendorId})}><Users size={13}/></button></div></td></tr>; })}</tbody></table></div> : <div className="module-empty-state"><MapPin size={24}/><h3>{search ? "No matching routes" : "No transport routes yet"}</h3><p>Add a route and agreed amount. No vendor, route or rate is fabricated.</p></div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Transport rates are shared through the existing AXIMACH manufacturing data store. Vendor identity is referenced by vendor ID; this directory does not create duplicate vendors or overwrite Vendor Directory details.</span></div>
  </section>;
}
