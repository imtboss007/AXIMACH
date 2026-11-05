import { useMemo, useState } from "react";
import { ArrowRight, Edit3, MapPin, Plus, Search, ShieldCheck, Truck, Users, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type TransportRouteRecord } from "./manufacturingData";

type Props = { onBack: () => void; onNotice: (value: string) => void; notice: string; onSelectModule: (id: string) => void };
const VEHICLES = ["2-wheeler", "3-wheeler", "4-wheeler", "Heavy-duty 4-wheeler"];
const money = (value: number) => "₹" + (Number(value) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export default function TransportDirectoryWorkspace({ onBack, onNotice, notice, onSelectModule }: Props) {
  const { data, update, syncStatus } = useManufacturingData();
  const routes = activeRows(data.transportRoutes || []);
  const vendors = activeRows(data.vendors);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [fromLocation, setFromLocation] = useState("");
  const [toLocation, setToLocation] = useState("");
  const [tripDirection, setTripDirection] = useState<"One-way" | "Two-way">("One-way");
  const [vehicleType, setVehicleType] = useState(VEHICLES[2]);
  const [fixedAmount, setFixedAmount] = useState("");
  const [notes, setNotes] = useState("");
  const filtered = useMemo(() => routes.filter(route => {
    const vendor = vendors.find(row => row.id === route.vendorId);
    return [route.fromLocation, route.toLocation, route.tripDirection, route.vehicleType, route.notes, vendor?.company || "", vendor?.contact || ""]
      .join(" ").toLowerCase().includes(search.trim().toLowerCase());
  }), [routes, vendors, search]);
  const reset = () => { setEditingId(""); setVendorId(""); setFromLocation(""); setToLocation(""); setTripDirection("One-way"); setVehicleType(VEHICLES[2]); setFixedAmount(""); setNotes(""); };
  const save = () => {
    if (!vendorId || !fromLocation.trim() || !toLocation.trim() || !vehicleType.trim()) { onNotice("Select a vendor and enter both route locations and a vehicle type."); return; }
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
      <button className="button-quiet compact-button" onClick={() => onSelectModule("vendors")}><Users size={14}/> Vendor Directory</button>
      <button className="button-quiet compact-button" onClick={() => onSelectModule("contact360")}><Users size={14}/> Contact 360</button>
    </div>
    <section className="surface-panel">
      <div className="panel-heading"><div><h3>{editingId ? "Edit fixed route rate" : "Add transport route"}</h3><p>Save one rate for each route, vehicle and trip direction. Select a different rate record for a one-way or round trip.</p></div><Truck size={19}/></div>
      <div className="module-form-grid">
        <label>Transport vendor *<select value={vendorId} onChange={event => setVendorId(event.target.value)}><option value="">Select existing vendor</option>{vendors.map(vendor => <option key={vendor.id} value={vendor.id}>{vendor.company} · {vendor.contact || "Contact not set"}{vendor.vendorType === "Transport" ? "" : " · Vendor"}</option>)}</select></label>
        <label>From location *<input value={fromLocation} onChange={event => setFromLocation(event.target.value)} placeholder="Pickup location"/></label>
        <label>To location *<input value={toLocation} onChange={event => setToLocation(event.target.value)} placeholder="Delivery location"/></label>
        <label>Trip direction *<select value={tripDirection} onChange={event => setTripDirection(event.target.value as "One-way" | "Two-way")}><option>One-way</option><option>Two-way</option></select></label>
        <label>Vehicle type *<select value={vehicleType} onChange={event => setVehicleType(event.target.value)}>{VEHICLES.map(value => <option key={value}>{value}</option>)}{!VEHICLES.includes(vehicleType) && <option>{vehicleType}</option>}</select></label>
        <label>Fixed amount (₹) *<input inputMode="decimal" type="number" min="0" step="0.01" value={fixedAmount} onChange={event => setFixedAmount(event.target.value)} placeholder="Enter agreed route rate"/></label>
        <label className="editor-wide">Notes<input value={notes} onChange={event => setNotes(event.target.value)} placeholder="Validity, loading terms, waiting charges or agreement reference"/></label>
      </div>
      <div className="module-form-actions"><button className="button-primary" onClick={save}><Plus size={14}/>{editingId ? "Save route rate" : "Add route rate"}</button>{editingId && <button className="button-quiet" onClick={reset}>Cancel edit</button>}</div>
    </section>
    <section className="surface-panel">
      <div className="panel-heading"><div><div className="eyebrow">SAVED RATE REGISTER</div><h3>Transport routes ({filtered.length})</h3><p>Component transport usage copies the selected rate into a cost snapshot; later master-price changes do not rewrite earlier component costs.</p></div></div>
      {filtered.length ? <div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>From → To</th><th>Vehicle</th><th>Trip type</th><th>Fixed rate</th><th>Vendor</th><th>Contact</th><th>Actions</th></tr></thead><tbody>{filtered.map(route => { const vendor = vendors.find(row => row.id === route.vendorId); return <tr key={route.id}><td><strong>{route.fromLocation} → {route.toLocation}</strong>{route.notes && <small>{route.notes}</small>}</td><td>{route.vehicleType}</td><td>{route.tripDirection}</td><td><strong>{money(route.fixedAmount)}</strong></td><td>{vendor?.company || "Vendor archived"}</td><td>{vendor?.contact || "—"}<small>{vendor?.phone || vendor?.whatsappNumber || ""}</small></td><td><div className="process-row-actions"><button title="Edit route" onClick={() => edit(route)}><Edit3 size={13}/></button><button title="Archive route" onClick={() => archive(route)}><X size={13}/></button><button title="Open Vendor Directory" onClick={() => onSelectModule("vendors")}><Users size={13}/></button></div></td></tr>; })}</tbody></table></div> : <div className="module-empty-state"><MapPin size={24}/><h3>{search ? "No matching routes" : "No transport routes yet"}</h3><p>Add a route and agreed amount. No vendor, route or rate is fabricated.</p></div>}
    </section>
    <div className="module-safety-note"><ShieldCheck size={15}/><span>Transport rates are shared through the existing AXIMACH manufacturing data store. Vendor identity is referenced by vendor ID; this directory does not create duplicate vendors or overwrite Vendor Directory details.</span></div>
  </section>;
}
