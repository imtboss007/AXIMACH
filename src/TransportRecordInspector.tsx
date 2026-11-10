import type { CSSProperties } from "react";
import { Truck, X, CalendarClock, Phone, Mail, MessageCircle, Building2, Route, ReceiptText, BadgeCheck, Bike, Bus, CarFront, Plane, Ship, TrainFront } from "lucide-react";
import type { ComponentTransportLegRecord, TransportRouteRecord, VendorRecord, VendorTransportRoute } from "./manufacturingData";

type Props={
  leg:ComponentTransportLegRecord;
  vendor?:VendorRecord;
  directoryRoute?:TransportRouteRecord;
  legacyVendorRoute?:VendorTransportRoute;
  onClose:()=>void;
  onOpenDirectory?:()=>void;
};
const vehicleClass=(value:string)=>{
 const text=(value||"").toLowerCase();
 if(/bike|motorcycle|scooter/.test(text))return "bike";
 if(/bus/.test(text))return "bus";
 if(/car|taxi|auto|three.wheeler/.test(text))return "car";
 if(/plane|air|flight/.test(text))return "air";
 if(/ship|boat|vessel/.test(text))return "ship";
 if(/train|rail/.test(text))return "rail";
 return "truck";
};
const displayDate=(value?:string)=>value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not recorded";
const amount=(value:number)=>"₹"+Number(value||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const vehicleIcon=(value:string)=>{
 const type=(value||"").toLowerCase();
 if(/bike|motorcycle|scooter/.test(type))return Bike;
 if(/bus/.test(type))return Bus;
 if(/car|taxi|auto/.test(type))return CarFront;
 if(/plane|air|flight/.test(type))return Plane;
 if(/ship|boat|vessel/.test(type))return Ship;
 if(/train|rail/.test(type))return TrainFront;
 return Truck;
};
export default function TransportRecordInspector({leg,vendor,directoryRoute,legacyVendorRoute,onClose,onOpenDirectory,anchor}:Props){
 const vehicle=vehicleClass(leg.vehicleType);
 const VehicleIcon=vehicleIcon(leg.vehicleType);
 const route=directoryRoute||legacyVendorRoute;
 const routeStatus=directoryRoute?(directoryRoute.active?"Active":"Inactive"):"Vendor route";
 const directoryAmount=directoryRoute?.fixedAmount??legacyVendorRoute?.fixedCost??leg.fixedAmount;
 return <div className="ax-transport-inspector-backdrop ax-transport-popover-backdrop" style={{"--ax-transport-popup-x":(anchor?.x??8)+"px","--ax-transport-popup-y":(anchor?.y??8)+"px"} as CSSProperties} role="presentation" onClick={onClose}>
  <section className={"ax-transport-inspector ax-transport-popover vehicle-"+vehicle} role="dialog" aria-modal="true" aria-label="Transport and directory record details" onClick={event=>event.stopPropagation()}>
   <header className="ax-transport-inspector-head">
    <div className="ax-transport-vehicle-identity">
     <span className={"ax-transport-vehicle-icon vehicle-"+vehicle}><VehicleIcon size={22}/></span>
     <div><small>AXIMACH · TRANSPORT RECORD</small><h2>{leg.vehicleType||"Vehicle not specified"}</h2><p>{vendor?.company||"Transporter not assigned"} · {leg.tripDirection}</p></div>
    </div>
    <button type="button" className="ax-transport-inspector-close" onClick={onClose} aria-label="Close transport details"><X size={20}/></button>
   </header>
   <div className="ax-transport-inspector-grid">
    <div className="ax-transport-info-card ax-transport-wide"><small><Route size={13}/> TRANSPORT ROUTE</small><strong>{leg.fromLocation||"Origin not recorded"} → {leg.toLocation||"Destination not recorded"}</strong><p>{leg.placement||"after"} process · {leg.tripCount} trip(s) · {leg.completedTrips||0} completed</p></div>
    <div className="ax-transport-info-card"><small><ReceiptText size={13}/> COST PER TRIP</small><strong>{amount(leg.fixedAmount)}</strong></div>
    <div className="ax-transport-info-card"><small><ReceiptText size={13}/> TOTAL TRANSPORT COST</small><strong>{amount(leg.fixedAmount*leg.tripCount)}</strong></div>
    <div className="ax-transport-info-card"><small><BadgeCheck size={13}/> EXECUTION STATUS</small><strong>{leg.status||"Planned"}</strong></div>
    <div className="ax-transport-info-card"><small><CalendarClock size={13}/> SCHEDULE</small><strong>Pickup · {displayDate(leg.pickupAt)}</strong><strong>Delivery · {displayDate(leg.deliveryAt)}</strong></div>
    <div className="ax-transport-info-card ax-transport-wide"><small><Building2 size={13}/> TRANSPORT DIRECTORY ROUTE</small><strong>{route?route.fromLocation+" → "+route.toLocation:"No linked directory route found"}</strong><p>{route?.vehicleType||leg.vehicleType} · {route?.tripDirection||leg.tripDirection} · {route?amount(directoryAmount):amount(leg.fixedAmount)} · {routeStatus}</p><p>{route?.notes||"No directory route notes recorded."}</p></div>
    <div className="ax-transport-info-card ax-transport-wide"><small><Building2 size={13}/> TRANSPORTER / VENDOR DIRECTORY PROFILE</small><strong>{vendor?.company||"Transporter not assigned"}</strong><p>{[vendor?.contact,vendor?.role].filter(Boolean).join(" · ")||"No contact person recorded"}</p><p>{vendor?.address||"Address not recorded"}</p><div className="ax-transport-contact-links">
      {vendor?.phone&&<a href={"tel:"+vendor.phone}><Phone size={14}/>{vendor.phone}</a>}
      {vendor?.whatsappNumber&&<a href={"https://wa.me/"+vendor.whatsappNumber.replace(/[^0-9]/g,"")} target="_blank" rel="noreferrer"><MessageCircle size={14}/>WhatsApp {vendor.whatsappNumber}</a>}
      {vendor?.email&&<a href={"mailto:"+vendor.email}><Mail size={14}/>{vendor.email}</a>}
     </div><p>Vendor status: {vendor?.status||"Not recorded"}</p><p>Vendor notes: {vendor?.notes||"No vendor notes recorded."}</p></div>
    <div className="ax-transport-info-card ax-transport-wide"><small>LINKED PROCESS HAND-OFF</small><strong>{leg.anchorOperationId||"No anchor operation"}{leg.targetOperationId?" → "+leg.targetOperationId:""}</strong><p>Route / PO line: {leg.poLineId}</p><p>Record ID: {leg.id}</p><p>Transport leg notes: {leg.notes||"No transport leg notes recorded."}</p></div>
   </div>
   <footer className="ax-transport-inspector-actions"><small>Source-linked details · opening the directory will preserve the selected PO-line context</small>{onOpenDirectory&&<button type="button" className="button-quiet" onClick={onOpenDirectory}>Open Transport Directory</button>}</footer>
  </section>
 </div>;
}
