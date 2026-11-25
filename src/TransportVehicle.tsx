import type { CSSProperties } from "react";
import { Bike, Bus, Boxes, CarFront, Package, Plane, Ship, TrainFront, Truck, type LucideIcon } from "lucide-react";
import type { ComponentTransportLegRecord, TransportRouteRecord } from "./manufacturingData";

export const VEHICLE_TYPES = [
 "2-wheeler / Bike","Motorcycle","Scooter","3-wheeler / Auto rickshaw",
 "Tempo / 3-wheeler goods carrier","Heavy-duty tempo","4-wheeler / Car","Car / Taxi",
 "Light commercial vehicle / Van","Mini truck","Pickup truck","Lorry / goods truck",
 "Heavy lorry","Heavy truck","Container truck","Trailer / tractor","Bus / staff vehicle",
 "Courier / delivery van","Air freight","Ship / marine","Rail / train"
] as const;

type VehicleKind="bike"|"car"|"three-wheeler"|"tempo"|"heavy-tempo"|"mini-truck"|"pickup"|"lorry"|"heavy-lorry"|"heavy-truck"|"container"|"trailer"|"bus"|"van"|"air"|"ship"|"rail"|"truck";
type VehicleVisual={Icon:LucideIcon|null;kind:VehicleKind;className:string;color:string};
const VEHICLE_VISUALS:Record<VehicleKind,VehicleVisual>={
 bike:{Icon:Bike,kind:"bike",className:"bike",color:"#D49A2D"},
 car:{Icon:CarFront,kind:"car",className:"car",color:"#397FE0"},
 "three-wheeler":{Icon:null,kind:"three-wheeler",className:"three-wheeler",color:"#16A6A0"},
 tempo:{Icon:null,kind:"tempo",className:"tempo",color:"#A17A35"},
 "heavy-tempo":{Icon:null,kind:"heavy-tempo",className:"heavy-tempo",color:"#C94D75"},
 "mini-truck":{Icon:null,kind:"mini-truck",className:"mini-truck",color:"#C17A2C"},
 pickup:{Icon:Truck,kind:"pickup",className:"pickup",color:"#4A8BBD"},
 lorry:{Icon:null,kind:"lorry",className:"lorry",color:"#D45E52"},
 "heavy-lorry":{Icon:null,kind:"heavy-lorry",className:"heavy-lorry",color:"#923F60"},
 "heavy-truck":{Icon:Truck,kind:"heavy-truck",className:"heavy-truck",color:"#BA4D3F"},
 container:{Icon:Boxes,kind:"container",className:"container",color:"#7B8BA5"},
 trailer:{Icon:Package,kind:"trailer",className:"trailer",color:"#C46A42"},
 bus:{Icon:Bus,kind:"bus",className:"bus",color:"#9869D5"},
 van:{Icon:Truck,kind:"van",className:"van",color:"#299A70"},
 air:{Icon:Plane,kind:"air",className:"air",color:"#348FBD"},
 ship:{Icon:Ship,kind:"ship",className:"ship",color:"#219B9B"},
 rail:{Icon:TrainFront,kind:"rail",className:"rail",color:"#C4774E"},
 truck:{Icon:Truck,kind:"truck",className:"truck",color:"#607D9D"}
};
function resolveVehicleKind(vehicleType:string):VehicleKind{
 const value=(vehicleType||"").trim().toLowerCase().replace(/[_-]+/g," ");
 if(/heavy\s*(?:duty\s*)?tempo|tempo\s*heavy/.test(value))return "heavy-tempo";
 if(/tempo|goods\s*carrier|small\s*goods/.test(value))return "tempo";
 if(/heavy\s*lorry/.test(value))return "heavy-lorry";
 if(/lorry/.test(value))return "lorry";
 if(/container/.test(value))return "container";
 if(/trailer|tractor/.test(value))return "trailer";
 if(/mini\s*truck/.test(value))return "mini-truck";
 if(/pickup/.test(value))return "pickup";
 if(/heavy\s*(?:duty\s*)?truck|heavy\s*goods/.test(value))return "heavy-truck";
 if(/courier|delivery\s*van|light\s*commercial|\blcv\b|\bvan\b/.test(value))return "van";
 if(/bus|staff/.test(value))return "bus";
 if(/air|plane|flight|freight\s*air/.test(value))return "air";
 if(/ship|boat|vessel|marine/.test(value))return "ship";
 if(/train|rail/.test(value))return "rail";
 if(/3\s*[- ]?wheel|three\s*wheel|auto|rickshaw/.test(value))return "three-wheeler";
 if(/4\s*[- ]?wheel|four\s*wheel|car|taxi|sedan|hatchback/.test(value))return "car";
 if(/2\s*[- ]?wheel|two\s*wheel|bike|motorcycle|motor\s*cycle|scooter/.test(value))return "bike";
 if(/truck/.test(value))return "truck";
 return "truck";
}
export function getVehicleVisual(vehicleType:string):VehicleVisual{return VEHICLE_VISUALS[resolveVehicleKind(vehicleType)]||VEHICLE_VISUALS.truck;}
function VehicleSilhouette({kind,size=17}:{kind:VehicleKind;size?:number}){
 const common={fill:"none",stroke:"currentColor",strokeWidth:2.1,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 if(kind==="three-wheeler")return <svg width={size*1.5} height={size} viewBox="0 0 48 32" aria-hidden="true" {...common}><path d="M7 22V14c0-3 2-5 5-5h17l6 7v6H7Z"/><path d="M13 10v8h16l-1-8M29 18h6M8 22h32"/><circle cx="13" cy="25" r="4"/><circle cx="36" cy="25" r="4"/><path d="M36 14h5v6h-5M8 14H4"/></svg>;
 if(kind==="tempo")return <svg width={size*1.7} height={size} viewBox="0 0 52 32" aria-hidden="true" {...common}><path d="M4 8h24v15H4zM28 13h10l8 7v3H28z"/><path d="M34 14v6h10M8 12h16M4 23h44"/><circle cx="13" cy="26" r="4"/><circle cx="39" cy="26" r="4"/></svg>;
 if(kind==="heavy-tempo"||kind==="mini-truck")return <svg width={size*1.8} height={size} viewBox="0 0 58 32" aria-hidden="true" {...common}><path d={kind==="heavy-tempo"?"M3 7h34v16H3zM37 12h10l7 7v4H37z":"M5 10h28v13H5zM33 14h11l7 5v4H33z"}/><path d="M40 14v6h11M8 11h24M4 23h51"/><circle cx="14" cy="26" r="4"/><circle cx="42" cy="26" r="4"/>{kind==="heavy-tempo"&&<circle cx="28" cy="26" r="3"/>}</svg>;
 if(kind==="lorry"||kind==="heavy-lorry")return <svg width={size*2.1} height={size} viewBox="0 0 68 32" aria-hidden="true" {...common}><path d={kind==="heavy-lorry"?"M3 5h42v18H3zM45 11h12l8 8v4H45z":"M4 8h35v15H4zM39 12h12l8 7v4H39z"}/><path d="M48 13v7h15M7 11h28M3 23h63"/><circle cx="14" cy="26" r="4"/><circle cx="42" cy="26" r="4"/><circle cx="56" cy="26" r="4"/>{kind==="heavy-lorry"&&<circle cx="30" cy="26" r="4"/>}</svg>;
 return null;
}
function VehicleGraphic({visual,size=17}:{visual:VehicleVisual;size:number}){
 if(visual.Icon){const Icon=visual.Icon;return <Icon size={size} strokeWidth={2.15} style={{color:visual.color,flex:"0 0 auto"}} aria-hidden="true"/>;}
 return <span className="vehicle-custom-glyph" style={{color:visual.color,display:"inline-flex",alignItems:"center",justifyContent:"center",flex:"0 0 auto"}}><VehicleSilhouette kind={visual.kind} size={size}/></span>;
}
export function VehicleIcon({vehicleType,size=17}:{vehicleType:string;size?:number}){return <VehicleGraphic visual={getVehicleVisual(vehicleType)} size={size}/>}
export function VehicleBadge({vehicleType}:{vehicleType:string}){
 const visual=getVehicleVisual(vehicleType);
 return <span className={"transport-vehicle-chip vehicle-"+visual.className} data-vehicle={vehicleType} style={{"--vehicle-color":visual.color} as CSSProperties}><VehicleGraphic visual={visual} size={16}/><span>{vehicleType}</span></span>;
}
type TransportLegMarkerProps={leg:ComponentTransportLegRecord;vendorName:string;selected:boolean;onSelect:()=>void;routeRecord?:TransportRouteRecord};
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
export function TransportLegMarker({leg,vendorName,selected,onSelect,routeRecord}:TransportLegMarkerProps){
 const visual=getVehicleVisual(leg.vehicleType),placement=leg.placement==="start"||!leg.anchorOperationId?"Before route":leg.placement==="before"?"Before process":"After process";
 return <span className={"transport-leg-marker vehicle-"+visual.className+(selected?" is-selected":"")} style={{"--vehicle-color":visual.color} as CSSProperties}>
  <button type="button" className="transport-leg-marker-button" onClick={onSelect} aria-expanded={selected} aria-label={"Open transport leg "+leg.fromLocation+" to "+leg.toLocation+" by "+leg.vehicleType} title={leg.fromLocation+" → "+leg.toLocation+" · "+leg.vehicleType}><VehicleIcon vehicleType={leg.vehicleType} size={19}/></button>
  {selected&&<span className="transport-leg-popover" role="dialog" aria-label="Saved transport directory record and component leg"><strong>TRANSPORT RECORD · {leg.id}</strong><span>{leg.fromLocation} → {leg.toLocation}</span><small>Transport Directory ID: {routeRecord?.id||leg.routeId}</small><small>Vendor: {vendorName||"Vendor not linked"} · {leg.vehicleType} · {leg.tripDirection}</small><small>Directory route: {routeRecord?(routeRecord.active?"Active":"Inactive"):"Directory master not found"}</small>{routeRecord&&<small>Directory fixed rate: {money(routeRecord.fixedAmount)} · {routeRecord.currency||"INR"}</small>}<small>Saved component rate snapshot: {money(leg.fixedAmount)}</small><small>{placement} · {leg.tripCount} trip(s) · {leg.status||"Status not set"}</small><b>{leg.tripCount} × {money(leg.fixedAmount)} = {money(leg.tripCount*leg.fixedAmount)}</b>{leg.pickupAt&&<small>Pickup: {leg.pickupAt}</small>}{leg.deliveryAt&&<small>Delivery: {leg.deliveryAt}</small>}{routeRecord?.notes&&<small>Directory notes: {routeRecord.notes}</small>}{leg.notes&&<small>Component-leg notes: {leg.notes}</small>}</span>}
 </span>;
}
