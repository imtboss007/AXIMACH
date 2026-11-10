import { useEffect, useMemo, useRef, useState } from "react";
import ImmersiveWorkspaceControls from "./ImmersiveWorkspaceControls";
import OperationInlineEditor from "./OperationInlineEditor";
import OperationQuickCreate from "./OperationQuickCreate";
import TransportRecordInspector from "./TransportRecordInspector";
import MaterialTransportRecordInspector from "./MaterialTransportRecordInspector";
import WorkspaceThemePicker from "./WorkspaceThemePicker";
import { useWorkspaceTheme } from "./workspaceTheme";
import { Activity, ArrowLeft, ArrowRight, Bike, Box, Bus, CarFront, Check, ChevronDown, CircleDashed, CircleDollarSign, ClipboardCheck, Factory, FileDown, GitBranch, GitMerge, GitPullRequest, Link2, MessageCircle, Network, Package, Plane, Plus, Route, Save, ShieldCheck, Ship, Sparkles, Split, TrainFront, Truck, Users, Waypoints, Workflow, X } from "lucide-react";
import {
  activeRows, makeId, nowIso, useManufacturingData,
  type ComponentTransportLegRecord, type OperationRecord, type RouteRelationshipRecord,
  type RouteRelationshipType, type RouteRelationshipStatus
} from "./manufacturingData";

type NavigationContext = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string };
type Props = { onBack:()=>void; onNotice:(message:string)=>void; notice:string; onSelectModule:(id:string,context?:NavigationContext)=>void };

const RELATIONSHIPS:Array<{id:RouteRelationshipType;label:string;description:string;symbol:string}> = [
  {id:"main",label:"Main route",description:"Primary manufacturing flow",symbol:"→"},
  {id:"alternate",label:"Alternate route",description:"Secondary / optional path",symbol:"↗"},
  {id:"rework",label:"Rework route",description:"Corrective / reprocessing path",symbol:"↶"},
  {id:"dependency",label:"Dependency",description:"Prerequisite / linked step",symbol:"⇢"},
  {id:"parallel",label:"Parallel route",description:"Simultaneous process",symbol:"⇉"},
  {id:"merge",label:"Merge route",description:"Converging processes",symbol:"⋎"},
  {id:"split",label:"Split route",description:"Diverging processes",symbol:"⋔"},
  {id:"follow-on",label:"Follow-on",description:"Next sequential activity",symbol:"⟶"},
  {id:"feedback",label:"Feedback route",description:"Quality / result feedback loop",symbol:"⟳"},
  {id:"conditional",label:"Conditional route",description:"Rule or result-dependent path",symbol:"◇"},
  {id:"successor",label:"Successor",description:"Next linked operation",symbol:"⤷"}
];
const STATUS_OPTIONS:RouteRelationshipStatus[]=["Active","Planned","Conditional","Disabled"];
const relationLabel=(type:RouteRelationshipType)=>RELATIONSHIPS.find(item=>item.id===type)?.label||type;
const money=(amount:number)=>"₹"+Number(amount||0).toLocaleString("en-IN",{maximumFractionDigits:2});
const dateTime=(value?:string)=>value?new Date(value).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"}):"Not scheduled";

type FlowNode =
 | {kind:"material";id:string;entry:any}
 | {kind:"material-transport";id:string;entry:any}
 | {kind:"transport";id:string;leg:ComponentTransportLegRecord}
 | {kind:"operation";id:string;operation:OperationRecord}
 | {kind:"missing-material";id:string};

function vehicleClassFor(value:string) { const type=(value||"").toLowerCase(); if(/bike|motorcycle|scooter|two.wheeler/.test(type))return "bike"; if(/bus/.test(type))return "bus"; if(/car|taxi|auto|three.wheeler/.test(type))return "car"; if(/air|plane|flight/.test(type))return "air"; if(/ship|boat|vessel/.test(type))return "ship"; if(/train|rail/.test(type))return "rail"; return "truck"}
function vehicleIconFor(value:string) { const type=(value||"").toLowerCase(); if(/bike|motorcycle|scooter|two.wheeler/.test(type)) return Bike; if(/bus/.test(type)) return Bus; if(/car|taxi|auto|three.wheeler/.test(type)) return CarFront; if(/air|plane|flight/.test(type)) return Plane; if(/ship|boat|vessel/.test(type)) return Ship; if(/train|rail/.test(type)) return TrainFront; return Truck; }

function RouteCurve({type,transport=false,label,vehicleType="",tripCount=0}:{type:RouteRelationshipType;transport?:boolean;label?:string;vehicleType?:string;tripCount?:number}) {
  const style=transport?"transport":type;
  const VehicleIcon=vehicleIconFor(vehicleType);
  const curvePath=style==="feedback"?"M4 35 C20 -2 48 -5 68 28 C84 55 112 60 132 25"
    :style==="rework"?"M4 37 C36 67 92 2 132 31"
    :style==="alternate"?"M4 36 C35 -15 93 -12 132 31"
    :style==="dependency"?"M4 36 C42 36 92 6 132 31"
    :style==="parallel"?"M4 28 C42 -12 91 47 132 23"
    :style==="merge"?"M4 12 C40 12 48 34 68 34 C90 34 96 54 132 54"
    :style==="split"?"M4 34 C40 34 48 10 68 10 C90 10 98 54 132 54"
    :style==="conditional"?"M4 36 C42 -10 91 76 132 31"
    :style==="successor"?"M4 36 C42 36 91 36 132 31":"M4 36 C42 -5 91 77 132 31";
  return <div className={"route-flow-curve route-flow-curve-"+style} aria-label={transport?"Transport connection":relationLabel(type)}>
    <svg viewBox="0 0 140 66" role="img" aria-hidden="true">
      <path className="route-flow-curve-shadow" d={curvePath}/>
      {style==="parallel"&&<path className="route-flow-curve-secondary" d="M4 43 C42 3 91 86 132 38"/>}
      <path className="route-flow-curve-path" d={curvePath}/>
      <path className="route-flow-curve-head" d="M119 18 L133 31 L115 39"/>
      {style==="feedback"&&<path className="route-flow-curve-feedback-head" d="M8 26 L3 35 L15 37"/>}
      {style==="conditional"&&<path className="route-flow-curve-diamond" d="M69 22 L76 29 L69 36 L62 29 Z"/>}
      {style==="merge"&&<path className="route-flow-curve-branch" d="M56 12 L68 34 L80 12"/>}
      {style==="split"&&<path className="route-flow-curve-branch" d="M56 54 L68 32 L80 54"/>}
      <circle className="route-flow-curve-pulse" r="4"><animateMotion dur="2.3s" repeatCount="indefinite" path={curvePath}/></circle>
    </svg>
    {transport&&<span className={"route-flow-vehicle-marker vehicle-"+vehicleClassFor(vehicleType)} title={(vehicleType||"Transport vehicle")+" · "+tripCount+" trip(s)"}><VehicleIcon size={17}/><b>{tripCount>1?tripCount+"×":vehicleType||"Vehicle"}</b></span>}
    <small>{transport?(vehicleType||"TRANSPORT"):label||relationLabel(type)}</small>
  </div>;
}

export default function RouteFlowWorkspace({onBack,onNotice,notice,onSelectModule}:Props) {
  const {data,update,syncStatus}=useManufacturingData();
  const companies=activeRows(data.companies),orders=activeRows(data.purchaseOrders),vendors=activeRows(data.vendors);
  const operations=activeRows(data.operations),materials=activeRows(data.materialCostEntries),legs=activeRows(data.transportLegs||[]);
  const routes=activeRows(data.transportRoutes||[]);
  const [companyPick,setCompanyPick]=useState("");
  const [poPick,setPoPick]=useState("");
  const [linePick,setLinePick]=useState("");
  const [branchPick,setBranchPick]=useState("Main route");
  const [fromOperationId,setFromOperationId]=useState("");
  const [toOperationId,setToOperationId]=useState("");
  const [relationshipType,setRelationshipType]=useState<RouteRelationshipType>("main");
  const [relationshipStatus,setRelationshipStatus]=useState<RouteRelationshipStatus>("Planned");
  const [relationshipCondition,setRelationshipCondition]=useState("");
  const [relationshipNotes,setRelationshipNotes]=useState("");
  const [transportFromOperationId,setTransportFromOperationId]=useState("");
  const [transportToOperationId,setTransportToOperationId]=useState("");
  const [transportVendorId,setTransportVendorId]=useState("");
  const [transportRouteId,setTransportRouteId]=useState("");
  const [transportFrom,setTransportFrom]=useState("");
  const [transportTo,setTransportTo]=useState("");
  const [vehicleType,setVehicleType]=useState("4-wheeler");
  const [tripDirection,setTripDirection]=useState<"One-way"|"Two-way">("One-way");
  const [tripCount,setTripCount]=useState("1");
  const [transportAmount,setTransportAmount]=useState("");
  const [pickupAt,setPickupAt]=useState("");
  const [deliveryAt,setDeliveryAt]=useState("");
  const [transportNotes,setTransportNotes]=useState("");
  const workspaceRef=useRef<HTMLElement|null>(null);
  const [workspaceTheme,setWorkspaceTheme]=useWorkspaceTheme();
  const [inspectedTransportId,setInspectedTransportId]=useState("");
  const [inspectedMaterialTransportId,setInspectedMaterialTransportId]=useState("");
  const [editingOperation,setEditingOperation]=useState<OperationRecord|null>(null);
  const [showAddOperation,setShowAddOperation]=useState(false);
  const [exportFormat,setExportFormat]=useState<"svg"|"png"|"pdf"|"csv"|"json">("svg");
  const [showRelationshipEditor,setShowRelationshipEditor]=useState(false);
  const [showTransportEditor,setShowTransportEditor]=useState(false);
  const routeViewportRef=useRef<HTMLDivElement|null>(null);
  const [relationshipOverlay,setRelationshipOverlay]=useState<Array<{id:string;type:RouteRelationshipType;path:string;arrow:string;label:string;x:number;y:number}>>([]);
  const [relationshipOverlaySize,setRelationshipOverlaySize]=useState({width:0,height:0});

  const company=companies.find(row=>row.id===companyPick)||companies[0];
  const companyId=company?.id||"";
  const companyOrders=orders.filter(row=>row.companyId===companyId);
  const order=companyOrders.find(row=>row.id===poPick)||companyOrders[0];
  const poId=order?.id||"";
  const lineOptions=(order?.lines||[]).filter(line=>!line.deletedAt);
  const line=lineOptions.find(row=>row.id===linePick)||lineOptions[0];
  const poLineId=line?.id||"";
  const component=data.components.find(row=>row.id===line?.componentId);
  const componentId=component?.id||"";
  const routeOperations=operations.filter(row=>row.poId===poId&&row.poLineId===poLineId).sort((a,b)=>a.sequence-b.sequence);
  const branches=[...new Set(["Main route",...routeOperations.map(row=>row.branch||"Main route")])];
  const branch=branches.includes(branchPick)?branchPick:"Main route";
  const lane=routeOperations.filter(row=>(row.branch||"Main route")===branch);
  const routeMaterials=materials.filter(entry=>entry.scope==="process-map"&&entry.componentId===componentId&&(!entry.poLineId||entry.poLineId===poLineId)&&(!entry.poId||entry.poId===poId)&&(!line?.partId||!entry.partId||entry.partId===line.partId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const routeLegs=legs.filter(leg=>leg.poId===poId&&leg.poLineId===poLineId&&(!leg.anchorOperationId||lane.some(operation=>operation.id===leg.anchorOperationId)||leg.placement==="start")).sort((a,b)=>(a.sequence||0)-(b.sequence||0));
  const inspectedTransportLeg=routeLegs.find(leg=>leg.id===inspectedTransportId);
  const inspectedTransportVendor=inspectedTransportLeg?vendors.find(vendor=>vendor.id===inspectedTransportLeg.vendorId):undefined;
  const inspectedTransportRoute=inspectedTransportLeg?routes.find(route=>route.id===inspectedTransportLeg.routeId):undefined;
  const inspectedLegacyVendorRoute=inspectedTransportLeg?inspectedTransportVendor?.transportRoutes?.find(route=>route.id===inspectedTransportLeg.routeId):undefined;
  const inspectedMaterialTransportEntry=routeMaterials.find(entry=>entry.id===inspectedMaterialTransportId);
  const inspectedMaterialTransportVendor=inspectedMaterialTransportEntry?vendors.find(vendor=>vendor.id===inspectedMaterialTransportEntry.transportVendorId):undefined;
  const inspectedMaterialTransportRoute=inspectedMaterialTransportEntry?inspectedMaterialTransportVendor?.transportRoutes?.find(route=>route.fromLocation===inspectedMaterialTransportEntry.transportFrom&&route.toLocation===inspectedMaterialTransportEntry.transportTo&&route.vehicleType===inspectedMaterialTransportEntry.transportVehicleType):undefined;
  const relationships=activeRows(data.routeRelationships||[]).filter(link=>link.poId===poId&&link.poLineId===poLineId&&routeOperations.some(op=>op.id===link.fromOperationId||op.id===link.toOperationId));
  const routeNodes=useMemo<FlowNode[]>(()=>{
    const nodes:FlowNode[]=[];
    const addMaterial=(entry:any)=>{
      nodes.push({kind:"material",id:"material-"+entry.id,entry});
      if(entry.transportVendorId||entry.transportFrom||entry.transportTo||entry.transportVehicleType||Number(entry.transportCost)>0||entry.transportPickupAt||entry.transportDeliveryAt)
        nodes.push({kind:"material-transport",id:"material-transport-"+entry.id,entry});
    };
    const startLegs=routeLegs.filter(leg=>(leg.placement||(!leg.anchorOperationId?"start":"after"))==="start");
    startLegs.forEach(leg=>nodes.push({kind:"transport",id:"transport-"+leg.id,leg}));
    const initialMaterials=routeMaterials.filter(entry=>!entry.anchorOperationId);
    if(!initialMaterials.length&&!lane.length)nodes.push({kind:"missing-material",id:"missing-material"});
    initialMaterials.forEach(addMaterial);
    lane.forEach(operation=>{
      routeLegs.filter(leg=>leg.placement==="before"&&leg.anchorOperationId===operation.id).forEach(leg=>nodes.push({kind:"transport",id:"transport-"+leg.id,leg}));
      nodes.push({kind:"operation",id:operation.id,operation});
      routeLegs.filter(leg=>(leg.placement||"after")==="after"&&leg.anchorOperationId===operation.id).forEach(leg=>nodes.push({kind:"transport",id:"transport-"+leg.id,leg}));
      routeMaterials.filter(entry=>entry.anchorOperationId===operation.id).forEach(addMaterial);
    });
    return nodes;
  },[routeMaterials,routeLegs,lane]);
  const transportChoices = [
    ...routes.filter(route=>route.active!==false).map(route=>({
      id:route.id,vendorId:route.vendorId,fromLocation:route.fromLocation,toLocation:route.toLocation,
      tripDirection:route.tripDirection,vehicleType:route.vehicleType,fixedAmount:route.fixedAmount,legacy:false as const
    })),
    ...vendors.flatMap(vendor=>(vendor.transportRoutes||[]).map(route=>({
      id:route.id,sourceRouteId:route.id,vendorId:vendor.id,fromLocation:route.fromLocation,toLocation:route.toLocation,
      tripDirection:route.tripDirection||"One-way" as const,vehicleType:route.vehicleType,fixedAmount:route.fixedCost,legacy:true as const
    })))
  ];
  const selectedTransportRoute=transportChoices.find(route=>route.id===transportRouteId);
  const locationHints=[...new Set([...transportChoices.flatMap(route=>[route.fromLocation,route.toLocation]),...vendors.map(v=>v.address).filter(Boolean)])];

  const relationFor=(fromId:string,toId:string):RouteRelationshipRecord|undefined=>
    relationships.find(link=>link.fromOperationId===fromId&&link.toOperationId===toId&&link.status!=="Disabled");
  const connectorFor=(index:number)=>{
    const current=routeNodes[index],next=routeNodes[index+1];
    const transport=current?.kind==="transport"||next?.kind==="transport"||current?.kind==="material-transport"||next?.kind==="material-transport";
    let fromId=current?.kind==="operation"?current.operation.id:"";
    let toId=next?.kind==="operation"?next.operation.id:"";
    if(!fromId){for(let i=index-1;i>=0;i--)if(routeNodes[i].kind==="operation"){fromId=(routeNodes[i] as Extract<FlowNode,{kind:"operation"}>).operation.id;break;}}
    if(!toId){for(let i=index+1;i<routeNodes.length;i++)if(routeNodes[i].kind==="operation"){toId=(routeNodes[i] as Extract<FlowNode,{kind:"operation"}>).operation.id;break;}}
    const relation=fromId&&toId?relationFor(fromId,toId):undefined;
    const defaultType:RouteRelationshipType=branch.toLowerCase().includes("rework")?"rework":branch==="Main route"?"main":"alternate";
    const transportNode=current?.kind==="transport"?current:next?.kind==="transport"?next:null;
    const materialTransportNode=current?.kind==="material-transport"?current:next?.kind==="material-transport"?next:null;
    const vehicleType=transportNode?.kind==="transport"?transportNode.leg.vehicleType:materialTransportNode?.kind==="material-transport"?materialTransportNode.entry.transportVehicleType||"":"";
    const tripCount=transportNode?.kind==="transport"?transportNode.leg.tripCount:materialTransportNode?.kind==="material-transport"?1:0;
    return {transport,relation,type:relation?.relationshipType||defaultType,label:relation?.label,vehicleType,tripCount};
  };

  const saveRelationship=()=>{
    if(!poId||!poLineId){onNotice("Select a company, PO and component line before adding a route relationship.");return;}
    if(!fromOperationId||!toOperationId||fromOperationId===toOperationId){onNotice("Choose two different saved process operations.");return;}
    const from=routeOperations.find(row=>row.id===fromOperationId),to=routeOperations.find(row=>row.id===toOperationId);
    if(!from||!to){onNotice("Both route endpoints must belong to the selected PO line.");return;}
    const existing=relationships.find(row=>row.fromOperationId===fromOperationId&&row.toOperationId===toOperationId&&row.relationshipType===relationshipType&&row.status!=="Disabled");
    if(existing){onNotice("This relationship is already saved. Edit or disable its existing record before adding another identical link.");return;}
    const stamp=nowIso();
    const record:RouteRelationshipRecord={id:makeId("route-relationship"),poId,poLineId,componentId,fromOperationId,toOperationId,relationshipType,status:relationshipStatus,condition:relationshipCondition.trim(),label:relationLabel(relationshipType),notes:relationshipNotes.trim(),createdAt:stamp,updatedAt:stamp};
    update(current=>({...current,routeRelationships:[...(current.routeRelationships||[]),record]}));
    setRelationshipCondition("");setRelationshipNotes("");setShowRelationshipEditor(false);
    onNotice(relationLabel(relationshipType)+" connection saved between "+from.name+" and "+to.name+".");
  };
  const disableRelationship=(record:RouteRelationshipRecord)=>{
    const stamp=nowIso();
    update(current=>({...current,routeRelationships:(current.routeRelationships||[]).map(row=>row.id===record.id?{...row,status:"Disabled" as const,updatedAt:stamp}:row)}));
  };
  const saveTransportLeg=()=>{
    const from=routeOperations.find(row=>row.id===transportFromOperationId),to=routeOperations.find(row=>row.id===transportToOperationId);
    if(!from||!to||from.id===to.id){onNotice("Choose the process that sends the item and the process that receives it.");return;}
    if(!transportFrom.trim()||!transportTo.trim()){onNotice("Enter both From and To locations. You can select a known location or type a new one.");return;}
    const count=Math.max(1,Math.floor(Number(tripCount)||1)),amount=Math.max(0,Number(transportAmount)||0);
    const stamp=nowIso(),route=selectedTransportRoute;
    const vendorId=route?.vendorId||transportVendorId;
    const record:ComponentTransportLegRecord={
      id:makeId("transport-leg"),poId,poLineId,componentId,
      sequence:Math.max(0,...routeLegs.map(leg=>leg.sequence||0))+10,
      routeId:route?.id||"",vendorId,fromLocation:transportFrom.trim(),toLocation:transportTo.trim(),
      tripDirection:route?.tripDirection||tripDirection,vehicleType:vehicleType.trim()||route?.vehicleType||"Vehicle not set",
      fixedAmount:route?.fixedAmount??amount,tripCount:count,anchorOperationId:from.id,targetOperationId:to.id,
      placement:"after",pickupAt,deliveryAt,status:"Planned",notes:transportNotes.trim(),createdAt:stamp,updatedAt:stamp
    };
    update(current=>({...current,transportLegs:[...(current.transportLegs||[]),record]}));
    setTransportRouteId("");setTransportAmount("");setTransportNotes("");setPickupAt("");setDeliveryAt("");setShowTransportEditor(false);
    onNotice("Transport leg added between "+from.name+" and "+to.name+". Add another leg to show another carrier or vehicle on the same connection.");
  };
  const openProcessMap=()=>onSelectModule("process-map",{companyId,poId,poLineId,componentId});
  const saveNewOperation=(operation:OperationRecord)=>{
    update(current=>({...current,operations:[...current.operations,operation]}));
    setShowAddOperation(false);
    setBranchPick(operation.branch||"Main route");
    onNotice("New process stage added to the selected PO line and shared Route Flow.");
  };
  const saveInlineOperation=(patch:Partial<OperationRecord>)=>{
    if(!editingOperation)return;
    const id=editingOperation.id;
    update(current=>({...current,operations:current.operations.map(row=>row.id===id?{...row,...patch,updatedAt:nowIso()}:row)}));
    setEditingOperation(null);
    onNotice("Process operation updated in Route Flow. The shared record has been saved.");
  };
  const escSvg=(value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const exportRouteFile=async()=>{
    if(!routeNodes.length){onNotice("Select a PO component line with route stages before exporting.");return;}
    const width=Math.max(1100,routeNodes.length*380+100),height=520,nodeW=250,nodeH=220,gap=130,startX=50,nodeY=155;
    const colors:Record<string,string>={main:"#12bfc8",alternate:"#e3a323",rework:"#e34b56",dependency:"#347de5",parallel:"#994bd4",merge:"#a04fc2",split:"#347de5","follow-on":"#173c6c",feedback:"#455bd6",conditional:"#9954ce",successor:"#203e62",transport:"#248bd0"};
    const nodeDetails=(node:FlowNode):string[]=>{
      if(node.kind==="operation")return [node.operation.name,node.operation.category+" · "+(node.operation.subcategory||"No sub-process"),"Qty "+node.operation.quantity+" · "+(vendors.find(v=>v.id===node.operation.vendorId)?.company||"Vendor not assigned"),money(node.operation.quantity*(node.operation.actualRatePerPart||node.operation.ratePerPart))+" process amount","Start "+dateTime(node.operation.plannedStart),"Due "+dateTime(node.operation.plannedEnd)];
      if(node.kind==="material")return [node.entry.materialName+" · "+node.entry.materialGrade,node.entry.partNumber||node.entry.partName||"Component material",node.entry.shapeType+" · Qty "+node.entry.quantity,"Weight "+Number(node.entry.totalWeightKg||0).toFixed(3)+" kg","Supplier "+(vendors.find(v=>v.id===node.entry.vendorId)?.company||"Not assigned"),money(node.entry.materialCost)+" material"];
      if(node.kind==="material-transport")return ["Inbound material transport",vendors.find(v=>v.id===node.entry.transportVendorId)?.company||"Transporter not assigned",(node.entry.transportFrom||"Pickup")+" → "+(node.entry.transportTo||"Destination"),node.entry.transportVehicleType||"Vehicle not set","Pickup "+dateTime(node.entry.transportPickupAt),"Delivery "+dateTime(node.entry.transportDeliveryAt)];
      if(node.kind==="transport")return ["Transport · "+node.leg.tripDirection,vendors.find(v=>v.id===node.leg.vendorId)?.company||"Transporter not assigned",node.leg.fromLocation+" → "+node.leg.toLocation,node.leg.vehicleType+" · "+node.leg.tripCount+" trip(s)",money(node.leg.fixedAmount*node.leg.tripCount),"Pickup "+dateTime(node.leg.pickupAt)+" · Due "+dateTime(node.leg.deliveryAt)];
      return ["Material allocation missing","Create a material / grade allocation before production."];
    };
    const nodeMarkup=routeNodes.map((node,index)=>{
      const x=startX+index*(nodeW+gap),lines=nodeDetails(node),kind=node.kind==="operation"?"PROCESS":node.kind.toUpperCase().replace("-"," ");
      const title=lines[0]||kind;
      const body=lines.slice(1);
      return '<g><rect x="'+x+'" y="'+nodeY+'" width="'+nodeW+'" height="'+nodeH+'" rx="16" fill="#f5faff" stroke="'+(node.kind==="transport"||node.kind==="material-transport"?"#2689c8":node.kind==="material"?"#1aa6b9":"#527fb8")+'" stroke-width="2.5"/><text x="'+(x+18)+'" y="'+(nodeY+27)+'" font-family="Arial" font-size="12" font-weight="700" fill="#42719e">'+escSvg(kind)+'</text><text x="'+(x+18)+'" y="'+(nodeY+55)+'" font-family="Arial" font-size="17" font-weight="700" fill="#173954">'+escSvg(title)+'</text>'+body.map((line,i)=>'<text x="'+(x+18)+'" y="'+(nodeY+88+i*22)+'" font-family="Arial" font-size="12" fill="#36546f">'+escSvg(line)+'</text>').join("")+'</g>';
    }).join("");
    const connectorMarkup=routeNodes.slice(0,-1).map((node,index)=>{
      const connector=connectorFor(index),color=colors[connector.transport?"transport":connector.type]||"#2ab9d5";
      const x1=startX+index*(nodeW+gap)+nodeW,x2=startX+(index+1)*(nodeW+gap),y=nodeY+nodeH/2;
      const label=connector.transport?(connector.vehicleType||"TRANSPORT"):(connector.label||relationLabel(connector.type));
      const dash=connector.type==="rework"?"8 7":connector.type==="dependency"?"3 6":connector.type==="feedback"?"7 5":"";
      return '<path d="M '+x1+' '+y+' C '+(x1+gap*.45)+' '+(y-72)+' '+(x2-gap*.45)+' '+(y+72)+' '+x2+' '+y+'" fill="none" stroke="'+color+'" stroke-width="5" stroke-linecap="round" '+(dash?'stroke-dasharray="'+dash+'"':"")+' marker-end="url(#routeArrow)"/><text x="'+((x1+x2)/2)+'" y="'+(y-88)+'" text-anchor="middle" font-family="Arial" font-size="12" font-weight="700" fill="'+color+'">'+escSvg(label)+'</text>';
    }).join("");
    const title=(component?.partNumber||"Route")+" · "+(component?.name||"Manufacturing Route")+" · "+(order?.number||"No PO");
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><defs><marker id="routeArrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0 0 L12 6 L0 12 Z" fill="#2ab9d5"/></marker></defs><rect width="100%" height="100%" fill="#eef5fc"/><text x="50" y="55" font-family="Arial" font-size="26" font-weight="700" fill="#173954">'+escSvg(title)+'</text><text x="50" y="86" font-family="Arial" font-size="14" fill="#55718c">Company: '+escSvg(company?.name||"—")+' · PO line quantity: '+escSvg(line?.quantity||0)+' · Branch: '+escSvg(branch)+'</text>'+connectorMarkup+nodeMarkup+'</svg>';
    const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1200);};
    const safeName=(title||"aximach-route").replace(/[^a-z0-9-_]+/gi,"-").replace(/-+/g,"-");
    const records=routeNodes.map((node,index)=>({sequence:index+1,stage:node.kind,record:node.kind==="operation"?node.operation:node.kind==="transport"?node.leg:node.kind==="material"||node.kind==="material-transport"?node.entry:{},relationshipToNext:index<routeNodes.length-1?connectorFor(index).type:""}));
    if(exportFormat==="json"){download(new Blob([JSON.stringify({company:company?.name,po:order?.number,component:component?.name,branch,stages:records,relationships,transportLegs:routeLegs},null,2)],{type:"application/json"}),safeName+".json");}
    else if(exportFormat==="csv"){const rows=[["Sequence","Stage","Name","Category","Subcategory","Quantity","Vendor","Amount","Status","Start","Due","Relationship to next"],...routeNodes.map((node,index)=>node.kind==="operation"?[index+1,"Process",node.operation.name,node.operation.category,node.operation.subcategory||"",node.operation.quantity,vendors.find(v=>v.id===node.operation.vendorId)?.company||"",node.operation.quantity*(node.operation.actualRatePerPart||node.operation.ratePerPart),node.operation.status,node.operation.plannedStart,node.operation.plannedEnd,index<routeNodes.length-1?connectorFor(index).type:""]:node.kind==="transport"?[index+1,"Transport",node.leg.fromLocation+" → "+node.leg.toLocation,"",node.leg.vehicleType,node.leg.tripCount,vendors.find(v=>v.id===node.leg.vendorId)?.company||"",node.leg.fixedAmount*node.leg.tripCount,node.leg.status,node.leg.pickupAt,node.leg.deliveryAt,index<routeNodes.length-1?connectorFor(index).type:""]:[index+1,node.kind,node.kind==="material"?node.entry.materialName+" "+node.entry.materialGrade:node.kind==="material-transport"?"Inbound transport":"Material missing","","",node.kind==="material"?node.entry.quantity:"", "",node.kind==="material"?node.entry.materialCost:node.kind==="material-transport"?node.entry.transportCost||0:"","","","",index<routeNodes.length-1?connectorFor(index).type:""] )];const csv=rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");download(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}),safeName+"-excel.csv");}
    else if(exportFormat==="pdf"){const win=window.open("","_blank");if(!win){onNotice("The browser blocked the PDF print window. Allow pop-ups, or export as SVG / PNG instead.");return;}win.document.write('<!doctype html><html><head><title>'+escSvg(title)+'</title><style>body{margin:0;padding:20px;font:14px Arial}svg{max-width:100%;height:auto}@page{size:landscape;margin:10mm}</style></head><body>'+svg+'<script>window.onload=()=>window.print()<\/script></body></html>');win.document.close();}
    else if(exportFormat==="svg"){download(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),safeName+".svg");}
    else {const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}));image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=width*2;canvas.height=height*2;const context=canvas.getContext("2d");if(!context){URL.revokeObjectURL(url);onNotice("PNG export is unavailable in this browser.");return;}context.scale(2,2);context.drawImage(image,0,0,width,height);canvas.toBlob(blob=>{if(blob)download(blob,safeName+".png");else onNotice("PNG export failed. Try SVG or PDF.");URL.revokeObjectURL(url);},"image/png");};image.onerror=()=>{URL.revokeObjectURL(url);onNotice("PNG export failed. Try SVG or PDF.");};image.src=url;}
    onNotice("Route export started: "+exportFormat.toUpperCase()+".");
  };
  const syncLabel=syncStatus==="synced"?"PC / server synced":syncStatus==="syncing"?"Syncing shared records":syncStatus==="error"?"Sync error":"Local data";
  const processName=(id:string)=>routeOperations.find(row=>row.id===id)?.name||"Process not found";
  const relationshipMatrixRows=useMemo(()=>{
    const rows:Array<{fromId:string;toId:string;type:RouteRelationshipType;status:string}>=[];
    const add=(fromId:string,toId:string,type:RouteRelationshipType,status:string)=>{
      if(!fromId||!toId||fromId===toId)return;
      const existing=rows.findIndex(row=>row.fromId===fromId&&row.toId===toId);
      const next={fromId,toId,type,status};
      if(existing>=0)rows[existing]=next;else rows.push(next);
    };
    const groups=new Map<string,OperationRecord[]>();
    routeOperations.filter(operation=>operation.relationType!=="subprocess").forEach(operation=>{
      const key=operation.branch||"Main route";
      const current=groups.get(key)||[];
      current.push(operation);
      groups.set(key,current);
    });
    for(const [branchName,branchRows] of groups){
      const ordered=branchRows.slice().sort((a,b)=>a.sequence-b.sequence);
      const type:RouteRelationshipType=branchName==="Main route"?"main":/rework/i.test(branchName)?"rework":"alternate";
      const status=type==="rework"?"Conditional":"Active";
      for(let index=0;index<ordered.length-1;index++)add(ordered[index].id,ordered[index+1].id,type,status);
    }
    routeOperations.filter(operation=>operation.relationType==="alternate"||operation.relationType==="rework").forEach(operation=>{
      if(operation.parentId)add(operation.parentId,operation.id,operation.relationType==="rework"?"rework":"alternate",operation.relationType==="rework"?"Conditional":"Planned");
    });
    relationships.forEach(link=>add(link.fromOperationId,link.toOperationId,link.relationshipType,link.status));
    return rows;
  },[routeOperations,relationships]);

  // Draw saved non-adjacent relationships as curved cross-links over the stage track.
  useEffect(()=>{
    const viewport=routeViewportRef.current;
    if(!viewport){setRelationshipOverlay([]);setRelationshipOverlaySize({width:0,height:0});return;}
    const measure=()=>{
      const bounds=viewport.getBoundingClientRect();
      const track=viewport.querySelector(".route-flow-stage-track");
      const width=Math.max(viewport.clientWidth,track?.scrollWidth||0);
      const height=Math.max(viewport.clientHeight,track?.scrollHeight||0);
      const cards=new Map();
      viewport.querySelectorAll<HTMLElement>("[data-route-operation-id]").forEach(card=>{
        const id=card.dataset.routeOperationId;
        if(!id)return;
        const rect=card.getBoundingClientRect();
        cards.set(id,{x:rect.left-bounds.left+viewport.scrollLeft+rect.width/2,y:rect.top-bounds.top+viewport.scrollTop+rect.height/2,width:rect.width,height:rect.height});
      });
      const ordered=lane.filter(operation=>operation.relationType!=="subprocess").slice().sort((a,b)=>a.sequence-b.sequence);
      const items:Array<{id:string;type:RouteRelationshipType;path:string;arrow:string;label:string;x:number;y:number}>=[];
      for(const link of relationships){
        if(link.status==="Disabled")continue;
        const fromIndex=ordered.findIndex(operation=>operation.id===link.fromOperationId);
        const toIndex=ordered.findIndex(operation=>operation.id===link.toOperationId);
        if(fromIndex>=0&&toIndex===fromIndex+1)continue;
        const from=cards.get(link.fromOperationId),to=cards.get(link.toOperationId);
        if(!from||!to)continue;
        const dx=to.x-from.x,dy=to.y-from.y,forward=dx>=0;
        const startX=from.x+(forward?1:-1)*from.width/2,startY=from.y;
        const endX=to.x+(forward?-1:1)*to.width/2,endY=to.y;
        const span=endX-startX,lift=Math.max(58,Math.min(180,Math.abs(span)*.18));
        const direction=forward?-1:1;
        const control1={x:startX+span*.25,y:startY+direction*lift};
        const control2={x:endX-span*.25,y:endY+direction*lift};
        const pathData="M "+startX+" "+startY+" C "+control1.x+" "+control1.y+" "+control2.x+" "+control2.y+" "+endX+" "+endY;
        const tx=endX-control2.x,ty=endY-control2.y,length=Math.hypot(tx,ty)||1;
        const ux=tx/length,uy=ty/length,px=-uy,py=ux,tipX=endX,tipY=endY;
        const arrowData="M "+(tipX-ux*15+px*6)+" "+(tipY-uy*15+py*6)+" L "+tipX+" "+tipY+" L "+(tipX-ux*15-px*6)+" "+(tipY-uy*15-py*6);
        items.push({id:link.id,type:link.relationshipType,path:pathData,arrow:arrowData,label:link.label||relationLabel(link.relationshipType),x:(from.x+to.x)/2,y:Math.min(from.y,to.y)-lift+12});
      }
      setRelationshipOverlay(current=>JSON.stringify(current)===JSON.stringify(items)?current:items);
      setRelationshipOverlaySize(current=>current.width===width&&current.height===height?current:{width,height});
    };
    measure();
    const observer=new ResizeObserver(measure);
    observer.observe(viewport);
    const track=viewport.querySelector(".route-flow-stage-track");
    if(track)observer.observe(track);
    window.addEventListener("resize",measure);
    return ()=>{observer.disconnect();window.removeEventListener("resize",measure);};
  },[relationships,routeOperations,lane,routeNodes,branch]);

  return <section ref={workspaceRef} className="route-flow-workspace" data-workspace-theme={workspaceTheme}>
    <header className="route-flow-workspace-head">
      <div><div className="eyebrow"><span className="eyebrow-mark"/> AXIMACH · LIVE ROUTE EDITOR</div><h1>Route Flow <span>&amp; Relationships</span></h1><p>Open this as a dedicated route canvas. Material, transport, process steps and saved relationship types stay linked to their original PO component line.</p></div>
      <div className="route-flow-head-actions"><WorkspaceThemePicker value={workspaceTheme} onChange={setWorkspaceTheme}/><span className={"route-flow-sync "+(syncStatus==="synced"?"is-synced":"")}><i/>{syncLabel}</span><div className="route-flow-export-controls"><select aria-label="Route export format" value={exportFormat} onChange={e=>setExportFormat(e.target.value as typeof exportFormat)}><option value="svg">SVG vector</option><option value="png">PNG image</option><option value="pdf">PDF / print</option><option value="csv">Excel CSV</option><option value="json">JSON data</option></select><button className="button-quiet compact-button" onClick={exportRouteFile}><FileDown size={14}/> Download</button></div><button className="button-quiet" onClick={openProcessMap}><Workflow size={15}/> Open Process Plan</button><ImmersiveWorkspaceControls targetRef={workspaceRef} onNotice={onNotice}/></div>
    </header>
    {notice&&<div className="notice-banner"><ShieldCheck size={15}/><span>{notice}</span></div>}
    {inspectedMaterialTransportEntry&&<MaterialTransportRecordInspector entry={inspectedMaterialTransportEntry} vendor={inspectedMaterialTransportVendor} directoryRoute={inspectedMaterialTransportRoute} onClose={()=>setInspectedMaterialTransportId("")} onOpenDirectory={()=>{setInspectedMaterialTransportId("");onSelectModule("transport-master",{companyId,poId,poLineId,componentId});}}/>}
    {inspectedTransportLeg&&<TransportRecordInspector leg={inspectedTransportLeg} vendor={inspectedTransportVendor} directoryRoute={inspectedTransportRoute} legacyVendorRoute={inspectedLegacyVendorRoute} onClose={()=>setInspectedTransportId("")} onOpenDirectory={()=>{setInspectedTransportId("");onSelectModule("transport-master",{companyId,poId,poLineId,componentId});}}/>}
    <div className="route-flow-scope-bar">
      <label>Company<select value={companyId} onChange={e=>{setCompanyPick(e.target.value);setPoPick("");setLinePick("");}}><option value="">Select company…</option>{companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Purchase order<select value={poId} onChange={e=>{setPoPick(e.target.value);setLinePick("");}}><option value="">Select PO…</option>{companyOrders.map(row=><option key={row.id} value={row.id}>{row.number}</option>)}</select></label>
      <label>Component / PO line<select value={poLineId} onChange={e=>setLinePick(e.target.value)}><option value="">Select PO component line…</option>{lineOptions.map(row=>{const part=data.componentParts.find(p=>p.id===row.partId);return <option key={row.id} value={row.id}>{component?.partNumber||""} · {component?.name||"Component"}{part?" · "+part.partNumber+" "+part.name:""} · Qty {row.quantity}</option>;})}</select></label>
      <label>Route branch<select value={branch} onChange={e=>setBranchPick(e.target.value)}>{branches.map(value=><option key={value}>{value}</option>)}</select></label>
      <div className="route-flow-scope-stats"><strong>{routeNodes.length}</strong><span>ROUTE STAGES</span><strong>{routeLegs.length}</strong><span>TRANSPORT LEGS</span></div>
    </div>

    <section className="route-flow-canvas-panel">
      <div className="route-flow-canvas-heading"><div><span className="eyebrow">LIVE PO-LINE WORKFLOW</span><h2>{component?.partNumber||"—"} · {component?.name||"Select a component"}</h2><p>{order?.number||"No PO selected"} · {line?.quantity||0} ordered · {branch} · {routeMaterials.length} material allocation(s)</p></div><div className="route-flow-canvas-tools"><button className="button-quiet compact-button" onClick={()=>setShowAddOperation(v=>!v)}><Plus size={14}/> Add process stage</button><button className="button-quiet compact-button" onClick={()=>setShowTransportEditor(v=>!v)}><Truck size={14}/> Add transport leg</button><button className="button-primary compact-button" onClick={()=>setShowRelationshipEditor(v=>!v)}><GitBranch size={14}/> Add relationship</button></div></div>
      <div className="route-flow-canvas-layout"><div className="route-flow-map-main">
      {routeNodes.length===0?<div className="route-flow-empty"><Package size={28}/><strong>Select a PO line with saved route data</strong><span>Material allocations and production operations will appear here.</span></div>:
      <div className="route-flow-stage-scroll" ref={routeViewportRef}>{relationshipOverlaySize.width>0&&<svg className="route-flow-relationship-overlay" width={relationshipOverlaySize.width} height={relationshipOverlaySize.height} aria-hidden="true">{relationshipOverlay.map(item=><g key={item.id} className={"route-flow-curve-"+item.type}><path className="route-flow-curve-shadow" d={item.path}/><path className="route-flow-curve-path" d={item.path}/><path className="route-flow-curve-head" d={item.arrow}/><text className="route-flow-overlay-label" x={item.x} y={item.y}>{item.label}</text></g>)}</svg>}<div className="route-flow-stage-track">
        {routeNodes.map((node,index)=>{
          const connector=index<routeNodes.length-1?connectorFor(index):null;
          const NodeVehicleIcon=node.kind==="transport"?vehicleIconFor(node.leg.vehicleType):node.kind==="material-transport"?vehicleIconFor(node.entry.transportVehicleType||""):Truck;
          return <div className="route-flow-stage-wrap" key={node.id}>
            <article className={"route-flow-stage-card route-flow-stage-"+node.kind} data-route-operation-id={node.kind==="operation"?node.operation.id:undefined}>
              {node.kind==="material"&&<><div className="route-flow-node-top"><Package size={18}/><small>MANDATORY MATERIAL STAGE</small></div><strong>{node.entry.materialName} · {node.entry.materialGrade}</strong><span>{node.entry.partNumber||node.entry.partName||"Component-level allocation"} · {node.entry.shapeType}</span><span>{node.entry.quantity} pieces · {Number(node.entry.totalWeightKg||0).toFixed(3)} kg</span><span>Supplier: {vendors.find(v=>v.id===node.entry.vendorId)?.company||"Not assigned"}</span><em>{money(node.entry.materialCost)} material · {money(node.entry.cuttingCost)} cutting</em><small>Given {dateTime(node.entry.givenDate)} · Due {dateTime(node.entry.deliveryDate)}</small><button onClick={openProcessMap}>Edit material <ArrowRight size={12}/></button></>}
              {node.kind==="material-transport"&&<><div className="route-flow-node-top"><NodeVehicleIcon size={18}/><small>INBOUND MATERIAL TRANSPORT</small></div><strong>{vendors.find(v=>v.id===node.entry.transportVendorId)?.company||"Transporter not assigned"}</strong><span>{node.entry.transportFrom||"Pickup not set"} → {node.entry.transportTo||"Destination not set"}</span><button type="button" className={"route-flow-vehicle-chip vehicle-"+vehicleClassFor(node.entry.transportVehicleType||"")} onClick={()=>setInspectedMaterialTransportId(node.entry.id)} title="Open inbound material transport directory details"><NodeVehicleIcon size={16}/>{node.entry.transportVehicleType||"Vehicle not set"} · View details</button><em>{money(node.entry.transportCost||0)} transport cost</em><small>Pickup {dateTime(node.entry.transportPickupAt)} · Delivery {dateTime(node.entry.transportDeliveryAt)}</small><button type="button" onClick={()=>setInspectedMaterialTransportId(node.entry.id)}>View full transport record <ArrowRight size={12}/></button></>}
              {node.kind==="transport"&&<><div className="route-flow-node-top"><NodeVehicleIcon size={18}/><small>TRANSPORT LEG · {node.leg.tripDirection}</small></div><strong>{vendors.find(v=>v.id===node.leg.vendorId)?.company||"Transporter not assigned"}</strong><span>{node.leg.fromLocation} → {node.leg.toLocation}</span><button type="button" className={"route-flow-vehicle-chip vehicle-"+vehicleClassFor(node.leg.vehicleType)} onClick={()=>setInspectedTransportId(node.leg.id)} title="Open full transport directory record"><NodeVehicleIcon size={16}/> {node.leg.vehicleType||"Vehicle not set"} · View details</button><em>{node.leg.tripCount} trip(s) · {money(node.leg.fixedAmount*node.leg.tripCount)}</em><small>Pickup {dateTime(node.leg.pickupAt)} · Delivery {dateTime(node.leg.deliveryAt)}</small><small>{processName(node.leg.anchorOperationId)} → {processName(node.leg.targetOperationId||"")}</small><button type="button" onClick={()=>setInspectedTransportId(node.leg.id)}>View full transport record <ArrowRight size={12}/></button></>}
              {node.kind==="operation"&&<><div className="route-flow-node-top"><Factory size={18}/><small>OP-{String(node.operation.sequence).padStart(3,"0")} · {node.operation.status}</small></div><strong>{node.operation.name}</strong><span>{node.operation.category} · {node.operation.subcategory||"Sub-process not selected"}</span><span>Qty {node.operation.quantity} · {vendors.find(v=>v.id===node.operation.vendorId)?.company||"Vendor not assigned"}</span><em>{money(node.operation.quantity*(node.operation.actualRatePerPart||node.operation.ratePerPart))} process amount</em><small>Start {dateTime(node.operation.plannedStart)} · Due {dateTime(node.operation.plannedEnd)}</small><button onClick={()=>setEditingOperation(node.operation)}>Edit here <ArrowRight size={12}/></button></>}
              {node.kind==="missing-material"&&<><div className="route-flow-node-top"><Package size={18}/><small>REQUIRED FIRST STAGE</small></div><strong>Material allocation missing</strong><span>A manufacturing route must have its material / grade allocation before its first process.</span><button onClick={openProcessMap}>Add material <ArrowRight size={12}/></button></>}
            </article>
            {connector&&<RouteCurve type={connector.type} transport={connector.transport} label={connector.label} vehicleType={connector.vehicleType} tripCount={connector.tripCount}/>}
          </div>;
        })}
      </div></div>}
      </div><aside className="route-flow-relationship-panel">
        <div><span className="eyebrow">ROUTE DESIGN TOOLKIT</span><h3>Relationship Types (11)</h3></div>
        <div className="route-flow-relationship-types">
          {RELATIONSHIPS.map(item=><button type="button" key={item.id} className={"route-flow-relationship-type route-flow-curve-"+item.id+(relationshipType===item.id?" is-selected":"")} onClick={()=>{setRelationshipType(item.id);setShowRelationshipEditor(true);}}>
            <span className="route-flow-type-swatch" aria-hidden="true"/>
            <span><strong>{item.label}</strong><small>{item.description}</small></span>
          </button>)}
        </div>
        <div className="route-flow-relationship-matrix"><h4>RELATIONSHIP MATRIX · {relationshipMatrixRows.length}</h4>
          {relationshipMatrixRows.length?relationshipMatrixRows.map((link,index)=><div className="route-flow-matrix-row" key={link.fromId+"-"+link.toId+"-"+index}>
            <strong title={processName(link.fromId)}>{processName(link.fromId)}</strong>
            <span className={"route-flow-matrix-arrow route-flow-curve-"+link.type} aria-label={relationLabel(link.type)}><i/></span>
            <strong title={processName(link.toId)}>{processName(link.toId)}</strong>
            <em title={relationLabel(link.type)}>{relationLabel(link.type)} · {link.status}</em>
          </div>):<div className="route-flow-matrix-empty">No saved route connections yet. Add process stages or select a relationship type above.</div>}
        </div>
        <button type="button" className="button-primary compact-button" onClick={()=>setShowRelationshipEditor(true)}><GitBranch size={14}/> Add selected relationship</button>
      </aside></div>
      <div className="route-flow-legend">
{RELATIONSHIPS.map(item=><span key={item.id} className={"route-flow-legend-item route-flow-curve-"+item.id}><i/>{item.label}</span>)}<span className="route-flow-legend-item route-flow-curve-transport"><Truck size={13}/> Transport leg</span></div>
    </section>

    {showTransportEditor&&<section className="route-flow-editor-panel">
      <div className="route-flow-editor-title"><div><span className="eyebrow">TRANSPORT DIRECTORY · MULTIPLE CARRIERS SUPPORTED</span><h3>Add a transport leg between two process stages</h3></div><button className="close-round compact" onClick={()=>setShowTransportEditor(false)}><X size={16}/></button></div>
      <div className="route-flow-editor-grid">
        <label>From process<select value={transportFromOperationId} onChange={e=>setTransportFromOperationId(e.target.value)}><option value="">Select sending process…</option>{routeOperations.map(row=><option key={row.id} value={row.id}>{row.name} · OP-{row.sequence}</option>)}</select></label>
        <label>To process<select value={transportToOperationId} onChange={e=>setTransportToOperationId(e.target.value)}><option value="">Select receiving process…</option>{routeOperations.map(row=><option key={row.id} value={row.id}>{row.name} · OP-{row.sequence}</option>)}</select></label>
        <label>Transport vendor<select value={transportVendorId} onChange={e=>{setTransportVendorId(e.target.value);setTransportRouteId("");}}><option value="">Select a carrier…</option>{vendors.map(v=><option key={v.id} value={v.id}>{v.company} · {v.phone||"No phone"}</option>)}</select></label>
        <label>Saved route<select value={transportRouteId} onChange={e=>{setTransportRouteId(e.target.value);const r=transportChoices.find(item=>item.id===e.target.value);if(r){setTransportVendorId(r.vendorId);setTransportFrom(r.fromLocation);setTransportTo(r.toLocation);setVehicleType(r.vehicleType);setTripDirection(r.tripDirection);setTransportAmount(String(r.fixedAmount));}}}><option value="">Choose a saved route or enter new locations…</option>{transportChoices.filter(r=>!transportVendorId||r.vendorId===transportVendorId).map(r=><option key={r.id} value={r.id}>{r.fromLocation} → {r.toLocation} · {r.vehicleType} · {money(r.fixedAmount)}</option>)}</select></label>
        <label>From location<input list="route-flow-locations" value={transportFrom} onChange={e=>setTransportFrom(e.target.value)} placeholder="Search or enter new pickup location"/></label>
        <label>To location<input list="route-flow-locations" value={transportTo} onChange={e=>setTransportTo(e.target.value)} placeholder="Search or enter new destination"/></label>
        <datalist id="route-flow-locations">{locationHints.map(value=><option key={value} value={value}/>)}</datalist>
        <label>Vehicle type<input value={vehicleType} onChange={e=>setVehicleType(e.target.value)} placeholder="Truck, tempo, van, car, bike…"/></label>
        <label>Trip direction<select value={tripDirection} onChange={e=>setTripDirection(e.target.value as "One-way"|"Two-way")}><option>One-way</option><option>Two-way</option></select></label>
        <label>Trips / carries<input type="number" min="1" step="1" value={tripCount} onChange={e=>setTripCount(e.target.value)}/></label>
        <label>Amount per trip (₹)<input type="number" min="0" step="0.01" value={transportAmount} onChange={e=>setTransportAmount(e.target.value)}/></label>
        <label>Pickup date &amp; time<input type="datetime-local" value={pickupAt} onChange={e=>setPickupAt(e.target.value)}/></label>
        <label>Delivery date &amp; time<input type="datetime-local" value={deliveryAt} onChange={e=>setDeliveryAt(e.target.value)}/></label>
        <label className="route-flow-wide">Notes<input value={transportNotes} onChange={e=>setTransportNotes(e.target.value)} placeholder="Special handling, route instructions, vehicle details…"/></label>
      </div>
      <div className="route-flow-editor-actions"><small>Each save creates a separate transport leg. Add several carriers / vehicle types on the same process connection as separate records.</small><button className="button-primary" onClick={saveTransportLeg}><Save size={14}/> Save transport leg</button></div>
    </section>}

    {showAddOperation&&<OperationQuickCreate poId={poId} poLineId={poLineId} componentId={componentId} sequence={Math.max(0,...routeOperations.map(row=>row.sequence))+1} branch={branch} vendors={vendors.map(v=>({id:v.id,company:v.company}))} onSave={saveNewOperation} onCancel={()=>setShowAddOperation(false)}/>}
    {editingOperation&&<OperationInlineEditor operation={editingOperation} vendors={vendors.map(v=>({id:v.id,company:v.company}))} onSave={saveInlineOperation} onCancel={()=>setEditingOperation(null)}/>}

    {showRelationshipEditor&&<section className="route-flow-editor-panel">
      <div className="route-flow-editor-title"><div><span className="eyebrow">RELATIONSHIP DIRECTORY · PERSISTED CONNECTIONS</span><h3>Add a typed process relationship</h3></div><button className="close-round compact" onClick={()=>setShowRelationshipEditor(false)}><X size={16}/></button></div>
      <div className="route-flow-editor-grid">
        <label>From process<select value={fromOperationId} onChange={e=>setFromOperationId(e.target.value)}><option value="">Select source process…</option>{routeOperations.map(row=><option key={row.id} value={row.id}>{row.name} · OP-{row.sequence}</option>)}</select></label>
        <label>To process<select value={toOperationId} onChange={e=>setToOperationId(e.target.value)}><option value="">Select destination process…</option>{routeOperations.map(row=><option key={row.id} value={row.id}>{row.name} · OP-{row.sequence}</option>)}</select></label>
        <label>Relationship type<select value={relationshipType} onChange={e=>setRelationshipType(e.target.value as RouteRelationshipType)}>{RELATIONSHIPS.map(item=><option key={item.id} value={item.id}>{item.label} · {item.description}</option>)}</select></label>
        <label>Link status<select value={relationshipStatus} onChange={e=>setRelationshipStatus(e.target.value as RouteRelationshipStatus)}>{STATUS_OPTIONS.filter(value=>value!=="Disabled").map(value=><option key={value}>{value}</option>)}</select></label>
        {relationshipType==="conditional"&&<label className="route-flow-wide">Condition / rule<input value={relationshipCondition} onChange={e=>setRelationshipCondition(e.target.value)} placeholder="Example: continue only if inspection result is accepted"/></label>}
        <label className="route-flow-wide">Notes<input value={relationshipNotes} onChange={e=>setRelationshipNotes(e.target.value)} placeholder="Why these process steps are linked…"/></label>
      </div>
      <div className="route-flow-editor-actions"><small>The relationship is saved against this PO line and shown with its own arrow colour, curve and pattern.</small><button className="button-primary" onClick={saveRelationship}><Save size={14}/> Save relationship</button></div>
    </section>}

    <section className="route-flow-bottom-grid">
      <div className="surface-panel route-flow-record-panel"><div className="panel-heading"><div><h3>Saved relationship links</h3><p>These links are persisted with the selected PO line.</p></div><span className="module-number">{relationships.length} LINKS</span></div>
        {relationships.length?relationships.map(link=><div className="route-flow-saved-link" key={link.id}><span className={"route-flow-link-symbol route-flow-curve-"+link.relationshipType}>{RELATIONSHIPS.find(item=>item.id===link.relationshipType)?.symbol}</span><div><strong>{processName(link.fromOperationId)} → {processName(link.toOperationId)}</strong><small>{relationLabel(link.relationshipType)} · {link.status}{link.condition?" · "+link.condition:""}</small></div><button className="button-quiet compact-button" disabled={link.status==="Disabled"} onClick={()=>disableRelationship(link)}>Disable</button></div>):<div className="route-flow-empty-inline">No explicit relationship links saved for this PO line yet. Existing main, alternate and rework operation branches remain visible in the route.</div>}
      </div>
      <div className="surface-panel route-flow-module-links"><div className="panel-heading"><div><h3>Connected manufacturing modules</h3><p>Open the source module to edit the underlying live record.</p></div><Waypoints size={18}/></div>
        <div className="route-flow-module-link-grid">
          {[{id:"companies",title:"Company Directory",icon:Factory,meta:companies.length+" companies"},{id:"components",title:"Component Directory",icon:Box,meta:data.components.length+" components"},{id:"purchasing",title:"Purchase Orders",icon:Package,meta:orders.length+" purchase orders"},{id:"vendors",title:"Vendor Directory",icon:Factory,meta:vendors.length+" vendors"},{id:"transport-master",title:"Transport Directory",icon:Truck,meta:routes.length+" saved transport routes"},{id:"contact360",title:"Contact 360",icon:Users,meta:"Company and vendor contacts"},{id:"process-master",title:"Process Directory",icon:Workflow,meta:data.processDefinitions.length+" process definitions"},{id:"planned-cost",title:"Component Planned Cost",icon:CircleDollarSign,meta:"Component and process plans"},{id:"vendor-capability",title:"Vendor Network",icon:Network,meta:"Process capability network"},{id:"inventory",title:"Material Directory",icon:Package,meta:materials.length+" material allocations"},{id:"production",title:"Production Plan",icon:Activity,meta:operations.length+" process operations"},{id:"route-flow",title:"Route Flow & Relationships",icon:GitBranch,meta:relationships.length+" saved relationships"},{id:"manufacturing-universe",title:"Manufacturing Universe",icon:Network,meta:"Live 3D overview"},{id:"dispatch",title:"Transport & Dispatch",icon:Truck,meta:legs.length+" transport legs"},{id:"quality",title:"Quality Inspection",icon:ClipboardCheck,meta:"Inspection and acceptance"},{id:"costing",title:"Costing & Payment",icon:GitMerge,meta:"Process, material and payment costs"},{id:"communications",title:"Follow-up Centre",icon:MessageCircle,meta:"Assigned contacts and follow-ups"},{id:"reports",title:"Reports & Analytics",icon:Activity,meta:"Manufacturing and delivery reports"},{id:"ai-insights",title:"AI Insights",icon:Sparkles,meta:"Analysis of saved operating data"},{id:"export",title:"Data Exchange Centre",icon:FileDown,meta:"Import, export and backups"}].map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>onSelectModule(item.id,{companyId,poId,poLineId,componentId})}><Icon size={15}/><span><strong>{item.title}</strong><small>{item.meta}</small></span><ArrowRight size={13}/></button>;})}
        </div>
      </div>
    </section>
  </section>;
}
