import type { CSSProperties } from "react";
import { X, CalendarClock, Phone, Mail, MessageCircle, Building2, Route, ReceiptText, Package } from "lucide-react";
import { VehicleIcon as VehicleTypeIcon } from "./TransportVehicle";
import type { MaterialCostEntryRecord, VendorRecord, VendorTransportRoute } from "./manufacturingData";

type Props={anchor?:{x:number;y:number};entry:MaterialCostEntryRecord;vendor?:VendorRecord;directoryRoute?:VendorTransportRoute;onClose:()=>void;onOpenDirectory?:()=>void};
const vehicleClass=(value:string)=>{
 const type=(value||"").toLowerCase();
 if(/bike|motorcycle|scooter/.test(type))return "bike";
 if(/bus/.test(type))return "bus";
 if(/car|taxi|auto/.test(type))return "car";
 if(/plane|air|flight/.test(type))return "air";
 if(/ship|boat|vessel/.test(type))return "ship";
 if(/train|rail/.test(type))return "rail";
 return "truck";
};
const dt=(value?:string)=>value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";
const money=(value:number)=>"₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
export default function MaterialTransportRecordInspector({entry,vendor,directoryRoute,onClose,onOpenDirectory,anchor}:Props){
 const tone=vehicleClass(entry.transportVehicleType||"");
 return <div className="ax-transport-inspector-backdrop ax-transport-popover-backdrop" style={{"--ax-transport-popup-x":(anchor?.x??8)+"px","--ax-transport-popup-y":(anchor?.y??8)+"px"} as CSSProperties} role="presentation" onClick={onClose}>
  <section className={"ax-transport-inspector ax-transport-popover vehicle-"+tone} role="dialog" aria-modal="true" aria-label="Inbound material transport details" onClick={event=>event.stopPropagation()}>
   <header className="ax-transport-inspector-head"><div className="ax-transport-vehicle-identity"><span className={"ax-transport-vehicle-icon vehicle-"+tone}><VehicleTypeIcon vehicleType={entry.transportVehicleType||""} size={22}/></span><div><small>AXIMACH · INBOUND MATERIAL TRANSPORT</small><h2>{entry.transportVehicleType||"Vehicle not specified"}</h2><p>{vendor?.company||"Transporter not assigned"}</p></div></div><button type="button" className="ax-transport-inspector-close" onClick={onClose} aria-label="Close transport details"><X size={20}/></button></header>
   <div className="ax-transport-inspector-grid">
    <div className="ax-transport-info-card ax-transport-wide"><small><Route size={13}/> MATERIAL MOVEMENT ROUTE</small><strong>{entry.transportFrom||"Pickup not recorded"} → {entry.transportTo||"Delivery not recorded"}</strong><p>{entry.transportStatus||"Planned"} · {entry.quantity} pieces · {Number(entry.totalWeightKg||0).toFixed(3)} kg</p></div>
    <div className="ax-transport-info-card"><small><ReceiptText size={13}/> TRANSPORT COST</small><strong>{money(entry.transportCost||0)}</strong></div>
    <div className="ax-transport-info-card"><small><CalendarClock size={13}/> PICKUP / DELIVERY</small><strong>Pickup · {dt(entry.transportPickupAt)}</strong><strong>Delivery · {dt(entry.transportDeliveryAt)}</strong></div>
    <div className="ax-transport-info-card ax-transport-wide"><small><Package size={13}/> LINKED MATERIAL / PO</small><strong>{entry.materialName} · {entry.materialGrade}</strong><p>{entry.partNumber||entry.partName||"Component material"} · {entry.shapeType} · PO {entry.poReference||"Not linked"}</p><p>Material quantity {entry.quantity} · Total weight {Number(entry.totalWeightKg||0).toFixed(3)} kg · Material cost {money(entry.materialCost||0)}</p></div>
    <div className="ax-transport-info-card ax-transport-wide"><small><Route size={13}/> TRANSPORT DIRECTORY ROUTE</small><strong>{directoryRoute?directoryRoute.fromLocation+" → "+directoryRoute.toLocation:(entry.transportFrom||"—")+" → "+(entry.transportTo||"—")}</strong><p>{directoryRoute?.vehicleType||entry.transportVehicleType||"Vehicle not set"} · {directoryRoute?.tripDirection||"One-way"} · {money(directoryRoute?.fixedCost??entry.transportCost??0)}</p><p>{directoryRoute?.notes||"No matching saved vendor route notes."}</p></div>
    <div className="ax-transport-info-card ax-transport-wide"><small><Building2 size={13}/> TRANSPORTER / VENDOR DIRECTORY PROFILE</small><strong>{vendor?.company||"Transporter not assigned"}</strong><p>{[vendor?.contact,vendor?.role].filter(Boolean).join(" · ")||"No contact person recorded"}</p><p>{vendor?.address||"Address not recorded"}</p><div className="ax-transport-contact-links">{vendor?.phone&&<a href={"tel:"+vendor.phone}><Phone size={14}/>{vendor.phone}</a>}{vendor?.whatsappNumber&&<a href={"https://wa.me/"+vendor.whatsappNumber.replace(/[^0-9]/g,"")} target="_blank" rel="noreferrer"><MessageCircle size={14}/>WhatsApp {vendor.whatsappNumber}</a>}{vendor?.email&&<a href={"mailto:"+vendor.email}><Mail size={14}/>{vendor.email}</a>}</div><p>Vendor status: {vendor?.status||"Not recorded"} · Vendor notes: {vendor?.notes||"No vendor notes recorded."}</p></div>
    <div className="ax-transport-info-card ax-transport-wide"><small>RECORD REFERENCES</small><strong>Component {entry.componentId} · PO line {entry.poLineId||"Not linked"}</strong><p>Material allocation ID: {entry.id}</p><p>Notes: {entry.notes||"No material transport notes recorded."}</p></div>
   </div>
   <footer className="ax-transport-inspector-actions"><small>Linked material transport and transporter details · source records remain in their directory</small>{onOpenDirectory&&<button type="button" className="button-quiet" onClick={onOpenDirectory}>Open Transport Directory</button>}</footer>
  </section>
 </div>;
}
