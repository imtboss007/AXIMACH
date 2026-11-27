import type { CSSProperties, ReactNode } from "react";
import { Bike, Bus, CarFront, Package, Plane, Ship, TrainFront, Truck, type LucideIcon } from "lucide-react";
import type { ComponentTransportLegRecord, TransportRouteRecord } from "./manufacturingData";

export const VEHICLE_TYPES = [
 "2-wheeler / Bike","Motorcycle","Scooter","3-wheeler / Auto rickshaw",
 "Tempo / 3-wheeler goods carrier","Heavy-duty tempo","4-wheeler / Car","Car / Taxi",
 "Light commercial vehicle / Van","Mini truck","Pickup truck","Lorry / goods truck",
 "Heavy lorry","Heavy truck","Container truck","Trailer / tractor","Bus / staff vehicle",
 "Courier / delivery van","Air freight","Ship / marine","Rail / train"
] as const;

type VehicleKind="bike"|"motorcycle"|"scooter"|"three-wheeler"|"tempo"|"heavy-tempo"|"car"|"taxi"|"light-van"|"mini-truck"|"pickup"|"lorry"|"heavy-lorry"|"heavy-truck"|"container"|"trailer"|"bus"|"courier-van"|"air"|"ship"|"rail";
type VehicleVisual={Icon:LucideIcon|null;kind:VehicleKind;className:string;color:string};
const VEHICLE_VISUALS:Record<VehicleKind,VehicleVisual>={
 bike:{Icon:Bike,kind:"bike",className:"bike",color:"#D49A2D"},
 motorcycle:{Icon:null,kind:"motorcycle",className:"motorcycle",color:"#B17A25"},
 scooter:{Icon:null,kind:"scooter",className:"scooter",color:"#8B72C9"},
 "three-wheeler":{Icon:null,kind:"three-wheeler",className:"three-wheeler",color:"#16A6A0"},
 tempo:{Icon:null,kind:"tempo",className:"tempo",color:"#A17A35"},
 "heavy-tempo":{Icon:null,kind:"heavy-tempo",className:"heavy-tempo",color:"#C94D75"},
 car:{Icon:CarFront,kind:"car",className:"car",color:"#397FE0"},
 taxi:{Icon:null,kind:"taxi",className:"taxi",color:"#C18A18"},
 "light-van":{Icon:null,kind:"light-van",className:"light-van",color:"#4E9C74"},
 "mini-truck":{Icon:null,kind:"mini-truck",className:"mini-truck",color:"#C17A2C"},
 pickup:{Icon:Truck,kind:"pickup",className:"pickup",color:"#4A8BBD"},
 lorry:{Icon:null,kind:"lorry",className:"lorry",color:"#D45E52"},
 "heavy-lorry":{Icon:null,kind:"heavy-lorry",className:"heavy-lorry",color:"#923F60"},
 "heavy-truck":{Icon:Truck,kind:"heavy-truck",className:"heavy-truck",color:"#BA4D3F"},
 container:{Icon:null,kind:"container",className:"container",color:"#7B8BA5"},
 trailer:{Icon:null,kind:"trailer",className:"trailer",color:"#C46A42"},
 bus:{Icon:Bus,kind:"bus",className:"bus",color:"#9869D5"},
 "courier-van":{Icon:null,kind:"courier-van",className:"courier-van",color:"#299A70"},
 air:{Icon:Plane,kind:"air",className:"air",color:"#348FBD"},
 ship:{Icon:Ship,kind:"ship",className:"ship",color:"#219B9B"},
 rail:{Icon:TrainFront,kind:"rail",className:"rail",color:"#C4774E"}
};
const FALLBACK_VEHICLE_VISUAL:VehicleVisual={Icon:Truck,kind:"pickup",className:"truck",color:"#607D9D"};

function resolveVehicleKind(vehicleType:string):VehicleKind|null{
 const value=(vehicleType||"").trim().toLowerCase().replace(/[_-]+/g," ");
 if(/heavy\s*(?:duty\s*)?tempo|tempo\s*heavy/.test(value))return "heavy-tempo";
 if(/courier|delivery\s*van/.test(value))return "courier-van";
 if(/light\s*commercial|\blcv\b|\bvan\b/.test(value))return "light-van";
 if(/heavy\s*lorry/.test(value))return "heavy-lorry";
 if(/lorry/.test(value))return "lorry";
 if(/container/.test(value))return "container";
 if(/trailer|tractor/.test(value))return "trailer";
 if(/mini\s*truck/.test(value))return "mini-truck";
 if(/pickup/.test(value))return "pickup";
 if(/heavy\s*(?:duty\s*)?truck|heavy\s*goods|\bhcv\b/.test(value))return "heavy-truck";
 if(/tempo|goods\s*carrier|small\s*goods/.test(value))return "tempo";
 if(/bus|staff/.test(value))return "bus";
 if(/air|plane|flight|freight\s*air/.test(value))return "air";
 if(/ship|boat|vessel|marine/.test(value))return "ship";
 if(/train|rail/.test(value))return "rail";
 if(/scooter/.test(value))return "scooter";
 if(/motorcycle|motor\s*cycle|motorbike/.test(value))return "motorcycle";
 if(/2\s*[- ]?wheel|two\s*wheel|\bbike\b/.test(value))return "bike";
 if(/3\s*[- ]?wheel|three\s*wheel|auto|rickshaw/.test(value))return "three-wheeler";
 if(/taxi|cab/.test(value))return "taxi";
 if(/4\s*[- ]?wheel|four\s*wheel|\bcar\b|sedan|hatchback/.test(value))return "car";
 if(/truck/.test(value))return "pickup";
 return null;
}
export function getVehicleVisual(vehicleType:string):VehicleVisual{
 const kind=resolveVehicleKind(vehicleType);
 return kind?VEHICLE_VISUALS[kind]:FALLBACK_VEHICLE_VISUAL;
}

function VehicleSilhouette({kind,size=17}:{kind:VehicleKind;size?:number}){
 const common={fill:"none",stroke:"currentColor",strokeWidth:2.1,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 const Svg=({children}:{children:ReactNode})=><svg width={size*1.9} height={size} viewBox="0 0 64 36" aria-hidden="true" {...common}>{children}</svg>;
 if(kind==="motorcycle")return <Svg><path d="M7 27h9l9-10h13l8 10h8M24 17l-5-7h8l6 7M38 17l6-8h7M44 9h7l4 5"/><circle cx="16" cy="27" r="6"/><circle cx="53" cy="27" r="6"/><path d="M28 11h7"/></Svg>;
 if(kind==="scooter")return <Svg><path d="M8 27h10l8-7h15l5 7h7M25 20l-2-9h8l5 9M39 20l7-11h7M46 9h8"/><circle cx="17" cy="27" r="6"/><circle cx="52" cy="27" r="6"/><path d="M22 20h-6"/></Svg>;
 if(kind==="three-wheeler")return <Svg><path d="M6 26V15c0-4 3-7 7-7h25l9 10v8H6Z"/><path d="M14 10v10h24l-2-10M38 20h8M9 26h47"/><circle cx="16" cy="28" r="5"/><circle cx="49" cy="28" r="5"/><path d="M47 14h8v8h-8M6 15H3"/></Svg>;
 if(kind==="tempo")return <Svg><path d="M3 10h30v16H3zM33 15h12l9 8v3H33z"/><path d="M37 16v7h14M7 13h22M3 26h53"/><circle cx="13" cy="29" r="5"/><circle cx="43" cy="29" r="5"/></Svg>;
 if(kind==="heavy-tempo")return <Svg><path d="M2 7h39v19H2zM41 12h10l9 10v4H41z"/><path d="M45 14v8h12M6 10h31M2 26h58"/><circle cx="14" cy="29" r="5"/><circle cx="43" cy="29" r="5"/><circle cx="55" cy="29" r="4"/></Svg>;
 if(kind==="taxi")return <Svg><path d="M8 25l3-10c1-3 3-5 7-5h25c4 0 7 2 8 5l4 10v3H8z"/><path d="M22 10l4-6h14l4 6M28 4h8v3h-8M14 16h36"/><circle cx="18" cy="28" r="5"/><circle cx="47" cy="28" r="5"/></Svg>;
 if(kind==="light-van"||kind==="courier-van")return <Svg><path d="M5 9h35c4 0 6 2 6 6v11H5zM46 16h8l7 8v2H46z"/><path d="M11 13h25v10H11zM49 18h5l5 6H49zM5 26h56"/><circle cx="17" cy="29" r="5"/><circle cx="50" cy="29" r="5"/>{kind==="courier-van"&&<path d="M19 16h10v7H19zM22 14h4"/></Svg>;
 if(kind==="mini-truck")return <Svg><path d="M4 11h32v15H4zM36 15h12l9 8v3H36z"/><path d="M8 14h24M40 16v7h14M4 26h54"/><circle cx="15" cy="29" r="5"/><circle cx="45" cy="29" r="5"/></Svg>;
 if(kind==="lorry"||kind==="heavy-lorry")return <Svg><path d={kind==="heavy-lorry"?"M2 6h42v20H2zM44 12h11l7 9v5H44z":"M3 9h36v17H3zM39 13h12l9 8v5H39z"}/><path d="M47 14v8h12M6 12h29M2 26h60"/><circle cx="13" cy="29" r="4"/><circle cx="39" cy="29" r="4"/><circle cx="55" cy="29" r="4"/>{kind==="heavy-lorry"&&<circle cx="27" cy="29" r="4"/>}</Svg>;
 if(kind==="container")return <Svg><path d="M2 8h43v18H2zM45 15h9l8 8v3H45z"/><path d="M7 11v12M13 11v12M19 11v12M25 11v12M31 11v12M37 11v12M47 17h7l6 6H47zM2 26h60"/><circle cx="13" cy="29" r="4"/><circle cx="43" cy="29" r="4"/><circle cx="55" cy="29" r="4"/></Svg>;
 if(kind==="trailer")return <Svg><path d="M3 10h35v15H3zM38 17h10l5 8M48 25h13M6 13h29M3 25h58"/><path d="M4 8h31M35 8l-4-4M35 8l-4 4"/><circle cx="13" cy="29" r="4"/><circle cx="42" cy="29" r="4"/><circle cx="55" cy="29" r="4"/></Svg>;
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
type TransportLegMarkerProps={leg:ComponentTransportLegRecord;vendorName:string;selected:boolean;onSelect:()=>void;routeRecord?: TransportRouteRecord};
const money=(value:number)=>"₹"+(Number(value)||0).toLocaleString("en-IN",{maximumFractionDigits:2});
export function TransportLegMarker({leg,vendorName,selected,onSelect,routeRecord}:TransportLegMarkerProps){
 const visual=getVehicleVisual(leg.vehicleType),placement=leg.placement==="start"||!leg.anchorOperationId?"Before route":leg.placement==="before"?"Before process":"After process";
 return <span className={"transport-leg-marker vehicle-"+visual.className+(selected?" is-selected":"")} style={{"--vehicle-color":visual.color} as CSSProperties}>
  <button type="button" className="transport-leg-marker-button" onClick={onSelect} aria-expanded={selected} aria-label={"Open transport leg "+leg.fromLocation+" to "+leg.toLocation+" by "+leg.vehicleType} title={leg.fromLocation+" → "+leg.toLocation+" · "+leg.vehicleType}><VehicleIcon vehicleType={leg.vehicleType} size={19}/></button>
  {selected&&<span className="transport-leg-popover" role="dialog" aria-label="Saved transport directory record and component leg"><strong>TRANSPORT RECORD · {leg.id}</strong><span>{leg.fromLocation} → {leg.toLocation}</span><small>Transport Directory ID: {routeRecord?.id||leg.routeId}</small><small>Vendor: {vendorName||"Vendor not linked"} · {leg.vehicleType} · {leg.tripDirection}</small><small>Directory route: {routeRecord?(routeRecord.active?"Active":"Inactive"):"Directory master not found"}</small>{routeRecord&&<small>Directory fixed rate: {money(routeRecord.fixedAmount)} · {routeRecord.currency||"INR"}</small>}<small>Saved component rate snapshot: {money(leg.fixedAmount)}</small><small>{placement} · {leg.tripCount} trip(s) · {leg.status||"Status not set"}</small><b>{leg.tripCount} × {money(leg.fixedAmount)} = {money(leg.tripCount*leg.fixedAmount)}</b>{leg.pickupAt&&<small>Pickup: {leg.pickupAt}</small>}{leg.deliveryAt&&<small>Delivery: {leg.deliveryAt}</small>}{routeRecord?.notes&&<small>Directory notes: {routeRecord.notes}</small>}{leg.notes&&<small>Component-leg notes: {leg.notes}</small>}</span>}
 </span>;
}
