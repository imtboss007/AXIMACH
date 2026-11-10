import { useMemo, useState } from "react";
import { Activity, ArrowRight, Boxes, CheckCircle2, CircleDollarSign, ClipboardCheck, Factory, FileDown, GitBranch, MessageCircle, Network, Package, Route, Settings2, Sparkles, Truck, Users, Workflow } from "lucide-react";
import { activeRows, useManufacturingData, type MaterialCostEntryRecord, type OperationRecord, type RouteRelationshipRecord } from "./manufacturingData";
import ProcessUniverse3D from "./ProcessUniverse3D";
import OperationInlineEditor from "./OperationInlineEditor";
import OperationQuickCreate from "./OperationQuickCreate";
import TransportRecordInspector from "./TransportRecordInspector";
import MaterialTransportRecordInspector from "./MaterialTransportRecordInspector";
import { transportPopupAnchorFromPoint } from "./transportPopup";
import WorkspaceThemePicker from "./WorkspaceThemePicker";
import { useWorkspaceTheme } from "./workspaceTheme";

type NavigationContext = { companyId?:string; poId?:string; poLineId?:string; componentId?:string; operationId?:string };
type Props = { onBack:()=>void; onNotice:(message:string)=>void; notice:string; onSelectModule:(id:string,context?:NavigationContext)=>void };

export default function ManufacturingUniverseWorkspace({onBack,onNotice,notice,onSelectModule}:Props) {
  const {data,syncStatus,update}=useManufacturingData();
  const companies=activeRows(data.companies),orders=activeRows(data.purchaseOrders),components=activeRows(data.components);
  const vendors=activeRows(data.vendors),operations=activeRows(data.operations),materials=activeRows(data.materialCostEntries),legs=activeRows(data.transportLegs||[]);
  const definitions=activeRows(data.processDefinitions),relationships=activeRows(data.routeRelationships||[]);
  const [companyPick,setCompanyPick]=useState(""),[poPick,setPoPick]=useState(""),[linePick,setLinePick]=useState("");
  const [workspaceTheme,setWorkspaceTheme]=useWorkspaceTheme();
  const [inspectedTransportId,setInspectedTransportId]=useState("");
  const [inspectedMaterialTransportId,setInspectedMaterialTransportId]=useState("");
  const [transportPopupPoint,setTransportPopupPoint]=useState<{x:number;y:number}>({x:8,y:8});
  const [selectedOperationId,setSelectedOperationId]=useState("");
  const [editingOperation,setEditingOperation]=useState<OperationRecord|null>(null);
  const [showAddOperation,setShowAddOperation]=useState(false);
  const [exportFormat,setExportFormat]=useState<"svg"|"png"|"pdf"|"csv"|"json">("svg");
  const [zoom,setZoom]=useState(()=>typeof window!=="undefined"&&window.matchMedia("(max-width:760px)").matches?.78:1),[simulationIndex,setSimulationIndex]=useState(-1);
  const [ganttScale,setGanttScale]=useState<"day"|"week"|"month">("week");
  const [showUniverseSettings,setShowUniverseSettings]=useState(false);
  const [visibleUniverseFields,setVisibleUniverseFields]=useState<string[]>(["company","po","component","category","subcategory","quantity","vendor","plannedStart","plannedEnd","price","amount","status","transportVendor","transportRoute","vehicle","transportPickup","transportDelivery","transportLegCost","combinedAmount","materialShape","materialDensity","materialQuantity","materialWeight","materialVendor","materialGiven","materialDelivery","materialReceived","materialCost","materialCuttingCost","materialTransportCost"]);
  const [visibleUniverseModules,setVisibleUniverseModules]=useState<string[]>(["companies","components","purchasing","vendors","transport-master","contact360","process-master","planned-cost","vendor-capability","inventory","production","route-flow","manufacturing-universe","dispatch","quality","costing","communications","reports","ai-insights","export"]);
  const company=companies.find(row=>row.id===companyPick)||companies[0];
  const companyId=company?.id||"";
  const companyOrders=orders.filter(row=>row.companyId===companyId);
  const po=companyOrders.find(row=>row.id===poPick)||companyOrders[0];
  const poId=po?.id||"";
  const lines=(po?.lines||[]).filter(line=>!line.deletedAt);
  const line=lines.find(row=>row.id===linePick)||lines[0];
  const poLineId=line?.id||"";
  const component=components.find(row=>row.id===line?.componentId);
  const componentId=component?.id||"";
  const allRouteOperations=operations.filter(row=>row.poId===poId&&row.poLineId===poLineId);
  const routeOperations=allRouteOperations.filter(row=>row.relationType!=="subprocess").sort((a,b)=>a.sequence-b.sequence);
  const activeOperation=routeOperations.find(row=>row.id===selectedOperationId)||routeOperations[0];
  const routeLabels=useMemo(()=>Object.fromEntries(lines.map(item=>[item.id,(component?.partNumber?component.partNumber+" · ":"")+(component?.name||"Component")+" · Qty "+item.quantity])),[lines,component]);
  const routeMaterials=materials.filter(entry=>entry.scope==="process-map"&&entry.poId===poId&&entry.componentId===componentId&&(!entry.poLineId||entry.poLineId===poLineId)&&(!line?.partId||!entry.partId||entry.partId===line.partId)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
  const routeLegs=legs.filter(leg=>leg.poId===poId&&leg.poLineId===poLineId);
  const routeRelationships=relationships.filter(link=>link.poId===poId&&link.poLineId===poLineId&&link.status!=="Disabled");
  const transportCostByOperation=Object.fromEntries(routeOperations.map(operation=>{
    const attached=routeLegs.filter(leg=>leg.anchorOperationId===operation.id).reduce((sum,leg)=>sum+Math.max(0,leg.fixedAmount)*Math.max(1,leg.tripCount),0);
    return [operation.id,attached+Math.max(0,Number(operation.transportCost)||0)];
  }));
  const materialRouteNodes=routeMaterials.map((entry:MaterialCostEntryRecord)=>{
    const supplier=vendors.find(vendor=>vendor.id===entry.vendorId),transporter=vendors.find(vendor=>vendor.id===entry.transportVendorId);
    const dimensions=[entry.shapeType,...Object.entries(entry.dimensions||{}).filter(([,value])=>Number(value)>0).map(([key,value])=>key.replace(/[A-Z]/g,letter=>" "+letter)+" "+value+" "+(entry.dimensionUnits?.[key]||"mm"))].join(" · ");
    return {
      id:entry.id,poLineId:entry.poLineId||"",partNumber:entry.partNumber||"",partName:entry.partName||"",
      partLabel:entry.partNumber||entry.partName?[entry.partNumber,entry.partName].filter(Boolean).join(" · "):routeLabels[entry.poLineId||""]||"Component-level material",
      materialLabel:[entry.materialName,entry.materialGrade].filter(Boolean).join(" · "),dimensionsLabel:dimensions,
      companyLabel:company?.name||"Company not linked",poLabel:po?.number||"—",componentLabel:component?.name||"—",
      densityKgM3:entry.densityKgM3,anchorOperationId:entry.anchorOperationId||"",
      anchorOperationName:routeOperations.find(row=>row.id===entry.anchorOperationId)?.name||"",
      quantity:entry.quantity,weightKg:entry.totalWeightKg,supplier:supplier?.company||"Supplier not assigned",
      transporter:transporter?.company||"Transporter not assigned",from:entry.transportFrom||supplier?.address||"Supplier pickup",
      to:entry.transportTo||"Destination not set",vehicle:entry.transportVehicleType||"Vehicle not set",
      materialGivenAt:entry.givenDate||"",materialDueAt:entry.deliveryDate||"",materialReceivedAt:entry.actualDeliveryDate||"",
      pickupAt:entry.transportPickupAt||"",deliveryAt:entry.transportDeliveryAt||"",status:entry.transportStatus||"Planned",
      materialRate:entry.materialRate||0,priceUnit:entry.priceUnit,materialCost:entry.materialCost||0,
      cuttingType:entry.cuttingType||"",cuttingBasis:entry.cuttingBasis||"",cuttingRate:entry.cuttingRate||0,
      cuttingCost:entry.cuttingCost||0,transportCost:entry.transportCost||0
    };
  });
  const inspectedTransportLeg=routeLegs.find(leg=>leg.id===inspectedTransportId);
  const inspectedTransportVendor=inspectedTransportLeg?vendors.find(vendor=>vendor.id===inspectedTransportLeg.vendorId):undefined;
  const inspectedTransportRoute=inspectedTransportLeg?activeRows(data.transportRoutes||[]).find(route=>route.id===inspectedTransportLeg.routeId):undefined;
  const inspectedLegacyVendorRoute=inspectedTransportLeg?inspectedTransportVendor?.transportRoutes?.find(route=>route.id===inspectedTransportLeg.routeId):undefined;
  const inspectedMaterialTransportEntry=routeMaterials.find(entry=>entry.id===inspectedMaterialTransportId);
  const inspectedMaterialTransportVendor=inspectedMaterialTransportEntry?vendors.find(vendor=>vendor.id===inspectedMaterialTransportEntry.transportVendorId):undefined;
  const inspectedMaterialTransportRoute=inspectedMaterialTransportEntry?inspectedMaterialTransportVendor?.transportRoutes?.find(route=>route.fromLocation===inspectedMaterialTransportEntry.transportFrom&&route.toLocation===inspectedMaterialTransportEntry.transportTo&&route.vehicleType===inspectedMaterialTransportEntry.transportVehicleType):undefined;
  const transportNodes=routeLegs.map(leg=>{
    const anchor=allRouteOperations.find(operation=>operation.id===leg.anchorOperationId);
    const relation=anchor?.relationType==="rework"||/rework/i.test(anchor?.branch||"")?"rework" as const:anchor?.relationType==="alternate"||Boolean(anchor?.branch&&anchor.branch!=="Main route")?"alternate" as const:"main" as const;
    return {
      id:leg.id,poLineId:leg.poLineId,anchorOperationId:leg.anchorOperationId||"",targetOperationId:leg.targetOperationId||"",materialEntryId:leg.materialEntryId||"",
      placement:leg.placement||(!leg.anchorOperationId?"start":"after") as "start"|"before"|"after",
      fromLocation:leg.fromLocation,toLocation:leg.toLocation,vehicleType:leg.vehicleType,
      vendorName:vendors.find(vendor=>vendor.id===leg.vendorId)?.company||"Transporter not assigned",
      vendorContact:vendors.find(vendor=>vendor.id===leg.vendorId)?.contact||"",
      vendorRole:vendors.find(vendor=>vendor.id===leg.vendorId)?.role||"",
      vendorPhone:vendors.find(vendor=>vendor.id===leg.vendorId)?.phone||"",
      vendorWhatsapp:vendors.find(vendor=>vendor.id===leg.vendorId)?.whatsappNumber||"",
      vendorEmail:vendors.find(vendor=>vendor.id===leg.vendorId)?.email||"",
      vendorAddress:vendors.find(vendor=>vendor.id===leg.vendorId)?.address||"",
      vendorStatus:vendors.find(vendor=>vendor.id===leg.vendorId)?.status||"",
      vendorNotes:vendors.find(vendor=>vendor.id===leg.vendorId)?.notes||"",
      directoryRouteNotes:activeRows(data.transportRoutes||[]).find(route=>route.id===leg.routeId)?.notes||vendors.find(vendor=>vendor.id===leg.vendorId)?.transportRoutes?.find(route=>route.id===leg.routeId)?.notes||"",
      directoryRouteActive:activeRows(data.transportRoutes||[]).find(route=>route.id===leg.routeId)?.active??true,
      tripDirection:leg.tripDirection,tripCount:leg.tripCount,amount:leg.fixedAmount*leg.tripCount,
      pickupAt:leg.pickupAt||"",deliveryAt:leg.deliveryAt||"",status:leg.status||"Planned",relation
    };
  });
  const onNavigate=(moduleId:string,operation?:OperationRecord)=>onSelectModule(moduleId,{companyId,poId,poLineId,componentId,operationId:operation?.id});
  const stats=[
    {label:"PROCESS STAGES",value:routeOperations.length,icon:Activity,module:"production"},
    {label:"MATERIAL ALLOCATIONS",value:routeMaterials.length,icon:Package,module:"inventory"},
    {label:"TRANSPORT LEGS",value:routeLegs.length,icon:Truck,module:"transport-master"},
    {label:"PROCESS DEFINITIONS",value:definitions.length,icon:Workflow,module:"process-master"},
    {label:"VENDORS",value:vendors.length,icon:Factory,module:"vendors"},
    {label:"CONTACTS",value:activeRows(data.contactProfiles||[]).length,icon:Users,module:"contact360"},
    {label:"PLANNED COSTS",value:activeRows(data.plannedCosts||[]).length,icon:CircleDollarSign,module:"planned-cost"},
    {label:"FOLLOW-UP LINKS",value:activeRows(data.followUpAssignments||[]).length,icon:MessageCircle,module:"communications"},
    {label:"DISPATCH LEGS",value:routeLegs.length,icon:Truck,module:"dispatch"},
    {label:"RELATIONSHIPS",value:routeRelationships.length,icon:GitBranch,module:"route-flow"}
  ];
  const linkModules=[
    {id:"companies",title:"Company Directory",icon:Factory,meta:"Company and factory records"},
    {id:"purchasing",title:"Purchase Orders",icon:Package,meta:"PO dates, lines and quantities"},
    {id:"components",title:"Component Directory",icon:Boxes,meta:"Components, parts and revisions"},
    {id:"inventory",title:"Material Directory",icon:Package,meta:"Grades, density, material and cutting cost"},
    {id:"process-master",title:"Process Directory",icon:Workflow,meta:"Categories and sub-process definitions"},
    {id:"transport-master",title:"Transport Directory",icon:Truck,meta:"Carriers, vehicles and route rates"},
    {id:"vendors",title:"Vendor Directory",icon:Factory,meta:"Suppliers, processors and transporters"},
    {id:"contact360",title:"Contact 360",icon:Users,meta:"Company, vendor and WhatsApp contacts"},
    {id:"planned-cost",title:"Component Planned Cost",icon:CircleDollarSign,meta:"Component and process cost plans"},
    {id:"vendor-capability",title:"Vendor Network",icon:Network,meta:"Vendor process capabilities and categories"},
    {id:"production",title:"Production Plan",icon:Activity,meta:"PO-wise production state and quantities"},
    {id:"dispatch",title:"Transport & Dispatch",icon:Truck,meta:"Dispatch legs, pickups and deliveries"},
    {id:"quality",title:"Quality Inspection",icon:ClipboardCheck,meta:"Measurements, QC and acceptance"},
    {id:"costing",title:"Costing & Payment",icon:CheckCircle2,meta:"Material, process, transport and payment"},
    {id:"communications",title:"Follow-up Centre",icon:MessageCircle,meta:"Assigned contacts and communications"},
    {id:"route-flow",title:"Route Flow & Relationships",icon:Route,meta:"Full-screen route and link editor"},
    {id:"manufacturing-universe",title:"Manufacturing Universe",icon:Network,meta:"Live 3D view and editable scene preferences"},
    {id:"reports",title:"Reports & Analytics",icon:Network,meta:"Operations and delivery analytics"},
    {id:"ai-insights",title:"AI Insights",icon:Sparkles,meta:"Insights from saved operational records"},
    {id:"export",title:"Data Exchange Centre",icon:FileDown,meta:"Import, export and backups"}
  ];
  const universeFieldOptions=[["company","Company"],["po","Purchase order"],["component","Component / part"],["category","Process category"],["subcategory","Sub-process"],["quantity","Quantity"],["vendor","Process vendor"],["plannedStart","Planned start"],["plannedEnd","Delivery / due date"],["price","Rate"],["amount","Process amount"],["status","Process status"],["transportVendor","Transporter"],["transportRoute","Transport route"],["vehicle","Vehicle type"],["transportPickup","Pickup time"],["transportDelivery","Delivery time"],["transportLegCost","Transport cost"],["combinedAmount","Combined amount"],["materialShape","Material shape"],["materialDensity","Material density"],["materialQuantity","Material quantity"],["materialWeight","Material weight"],["materialVendor","Material supplier"],["materialGiven","Material given date"],["materialDelivery","Material due date"],["materialReceived","Material received"],["materialCost","Material cost"],["materialCuttingCost","Cutting cost"],["materialTransportCost","Material transport cost"]] as const;
  const syncText=syncStatus==="synced"?"Live server sync":syncStatus==="syncing"?"Syncing shared data":syncStatus==="error"?"Sync error":"Local records";
  const saveNewOperation=(operation:OperationRecord)=>{
    update(current=>({...current,operations:[...current.operations,operation]}));
    setSelectedOperationId(operation.id);
    setShowAddOperation(false);
    onNotice("New process stage added to the selected PO line and shared Manufacturing Universe.");
  };
  const saveInlineOperation=(patch:Partial<OperationRecord>)=>{
    if(!editingOperation)return;
    const id=editingOperation.id;
    update(current=>({...current,operations:current.operations.map(row=>row.id===id?{...row,...patch,updatedAt:new Date().toISOString()}:row)}));
    setEditingOperation(null);
    onNotice("Process operation updated in Manufacturing Universe. The shared record has been saved.");
  };
  const exportUniverse=()=>{
    const safeName=("AXIMACH-"+(component?.partNumber||"Manufacturing-Universe")).replace(/[^a-z0-9-_]+/gi,"-");
    const download=(blob:Blob,name:string)=>{const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1200);};
    const escape=(value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    const records={company:company?.name,po:po?.number,component:component?.name,stages:routeOperations,materials:routeMaterials,transportLegs:routeLegs,relationships:routeRelationships};
    if(exportFormat==="json"){download(new Blob([JSON.stringify(records,null,2)],{type:"application/json"}),safeName+".json");}
    else if(exportFormat==="csv"){const rows=[["Type","Code","Name","Category","Subcategory","Quantity","Vendor","Rate","Amount","Status","Planned Start","Planned End"],...routeOperations.map(op=>["Process","OP-"+String(op.sequence).padStart(3,"0"),op.name,op.category,op.subcategory||"",op.quantity,vendors.find(v=>v.id===op.vendorId)?.company||"",op.actualRatePerPart||op.ratePerPart,op.quantity*(op.actualRatePerPart||op.ratePerPart),op.status,op.plannedStart,op.plannedEnd]),...routeMaterials.map(m=>["Material",m.materialGrade,m.materialName,m.shapeType,"",m.quantity,vendors.find(v=>v.id===m.vendorId)?.company||"",m.materialRate,m.materialCost,"",m.givenDate,m.deliveryDate])];const csv=rows.map(row=>row.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(",")).join(String.fromCharCode(13,10));download(new Blob([String.fromCharCode(65279)+csv],{type:"text/csv;charset=utf-8"}),safeName+"-excel.csv");}
    else {
      const count=Math.max(1,routeOperations.length),cx=650,cy=470,radius=Math.min(310,120+count*22),positions=routeOperations.map((op,i)=>({op,x:cx+Math.cos((i/count)*Math.PI*2-Math.PI/2)*radius,y:cy+Math.sin((i/count)*Math.PI*2-Math.PI/2)*radius}));
      const nodes=positions.map(({op,x,y})=>'<g><rect x="'+(x-110)+'" y="'+(y-46)+'" width="220" height="92" rx="13" fill="#f4f9ff" stroke="#2d8ac8" stroke-width="3"/><text x="'+x+'" y="'+(y-10)+'" text-anchor="middle" font-family="Arial" font-size="15" font-weight="700" fill="#173954">'+escape("OP-"+String(op.sequence).padStart(3,"0")+" · "+op.name)+'</text><text x="'+x+'" y="'+(y+16)+'" text-anchor="middle" font-family="Arial" font-size="12" fill="#355a7a">'+escape(op.category+" · Qty "+op.quantity)+'</text><text x="'+x+'" y="'+(y+34)+'" text-anchor="middle" font-family="Arial" font-size="11" fill="#55718c">'+escape(op.status)+'</text></g>').join("");
      const edges=positions.map((p,i)=>{const next=positions[i+1];if(!next||positions.length<2)return "";return '<path d="M '+p.x+' '+p.y+' Q '+cx+' '+cy+' '+next.x+' '+next.y+'" fill="none" stroke="#16aeca" stroke-width="4" marker-end="url(#universeArrow)"/>';}).join("");
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="950" viewBox="0 0 1300 950"><defs><marker id="universeArrow" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto"><path d="M0 0 L12 6 L0 12 Z" fill="#16aeca"/></marker></defs><rect width="100%" height="100%" fill="#eaf3fc"/><text x="650" y="70" font-family="Arial" font-size="30" font-weight="700" text-anchor="middle" fill="#173954">AXIMACH · MANUFACTURING UNIVERSE</text><text x="650" y="105" font-family="Arial" font-size="16" text-anchor="middle" fill="#55718c">'+escape((company?.name||"Company")+" · "+(po?.number||"PO")+" · "+(component?.name||"Component"))+'</text><circle cx="650" cy="470" r="75" fill="#0e3454" stroke="#27b8d2" stroke-width="8"/><text x="650" y="462" text-anchor="middle" font-family="Arial" font-size="21" font-weight="700" fill="#fff">AXIMACH</text><text x="650" y="490" text-anchor="middle" font-family="Arial" font-size="13" fill="#c6eaff">LIVE ROUTE</text>'+edges+nodes+'</svg>';
      if(exportFormat==="svg")download(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}),safeName+".svg");
      else if(exportFormat==="pdf"){const win=window.open("","_blank");if(!win){onNotice("PDF print window was blocked. Allow pop-ups or export SVG.");return;}win.document.write('<!doctype html><html><head><title>AXIMACH Universe</title><style>body{margin:0;padding:15px}svg{width:100%;height:auto}@page{size:landscape;margin:10mm}</style></head><body>'+svg+'<script>window.onload=()=>window.print()<\\/script></body></html>');win.document.close();}
      else {const image=new Image(),url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=2600;canvas.height=1900;const ctx=canvas.getContext("2d");if(!ctx){URL.revokeObjectURL(url);return;}ctx.drawImage(image,0,0,2600,1900);canvas.toBlob(blob=>{if(blob)download(blob,safeName+".png");URL.revokeObjectURL(url);},"image/png");};image.src=url;}
    }
    onNotice("Manufacturing Universe export started: "+exportFormat.toUpperCase()+".");
  };

  return <section className="manufacturing-universe-workspace" data-workspace-theme={workspaceTheme}>
    <header className="manufacturing-universe-head">
      <div><div className="eyebrow"><span className="eyebrow-mark"/> AXIMACH · LIVE CONNECTED OPERATIONS</div><h1>Manufacturing <span>Universe</span></h1><p>A dedicated large-format 3D view of live material, transport, process, quality and delivery records. Select a PO line to see its live route.</p></div>
      <div className="manufacturing-universe-actions"><WorkspaceThemePicker value={workspaceTheme} onChange={setWorkspaceTheme}/><span className={"manufacturing-universe-sync "+(syncStatus==="synced"?"is-synced":"")}><i/>{syncText}</span><button className="button-quiet" disabled={!activeOperation} onClick={()=>activeOperation&&setEditingOperation(activeOperation)}><Workflow size={15}/> Edit selected process here</button><div className="route-flow-export-controls"><select aria-label="Universe export format" value={exportFormat} onChange={e=>setExportFormat(e.target.value as typeof exportFormat)}><option value="svg">SVG vector</option><option value="png">PNG image</option><option value="pdf">PDF / print</option><option value="csv">Excel CSV</option><option value="json">JSON data</option></select><button className="button-quiet compact-button" onClick={exportUniverse}><FileDown size={14}/> Download</button></div></div>
    </header>
    {notice&&<div className="notice-banner"><CheckCircle2 size={15}/><span>{notice}</span></div>}
    <div className="manufacturing-universe-scope">
      <label>Company<select value={companyId} onChange={e=>{setCompanyPick(e.target.value);setPoPick("");setLinePick("");setSelectedOperationId("");}}><option value="">Select company…</option>{companies.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label>Purchase order<select value={poId} onChange={e=>{setPoPick(e.target.value);setLinePick("");setSelectedOperationId("");}}><option value="">Select PO…</option>{companyOrders.map(row=><option key={row.id} value={row.id}>{row.number}</option>)}</select></label>
      <label>Component / PO line<select value={poLineId} onChange={e=>{setLinePick(e.target.value);setSelectedOperationId("");}}><option value="">Select component line…</option>{lines.map(row=><option key={row.id} value={row.id}>{component?.partNumber||""} · {component?.name||"Component"} · Qty {row.quantity}</option>)}</select></label>
      <div className="manufacturing-universe-current"><strong>{component?.partNumber||"No component selected"} · {component?.name||"Select a PO line"}</strong><span>{po?.number||"No purchase order"} · {routeOperations.length} process stages · {routeMaterials.length} material allocations · {routeLegs.length} transport legs</span></div>
    </div>
    <section className="manufacturing-universe-customizer"><div className="manufacturing-universe-customizer-head"><div><span className="eyebrow">UNIVERSE DISPLAY CONTROLS</span><strong>Choose what appears in this live view</strong><small>These are view preferences only. They do not delete or change source records.</small></div><button className="button-quiet compact-button" onClick={()=>setShowUniverseSettings(value=>!value)}><Settings2 size={14}/>{showUniverseSettings?"Hide display settings":"Customize view"}</button></div>{showUniverseSettings&&<div className="manufacturing-universe-customizer-body"><div><strong>Live scene information</strong><div className="manufacturing-universe-toggle-grid">{universeFieldOptions.map(([id,label])=><label key={id}><input type="checkbox" checked={visibleUniverseFields.includes(id)} onChange={event=>setVisibleUniverseFields(current=>event.target.checked?[...current,id]:current.filter(value=>value!==id))}/><span>{label}</span></label>)}</div></div><div><strong>Connected module shortcuts</strong><div className="manufacturing-universe-toggle-grid">{linkModules.map(item=><label key={item.id}><input type="checkbox" checked={visibleUniverseModules.includes(item.id)} onChange={event=>setVisibleUniverseModules(current=>event.target.checked?[...current,item.id]:current.filter(value=>value!==item.id))}/><span>{item.title}</span></label>)}</div></div><div className="manufacturing-universe-customizer-actions"><button className="button-quiet compact-button" onClick={()=>{setVisibleUniverseFields(universeFieldOptions.map(([id])=>id));setVisibleUniverseModules(linkModules.map(item=>item.id));}}>Show all</button><button className="button-quiet compact-button" onClick={()=>{setVisibleUniverseFields([]);setVisibleUniverseModules([]);}}>Clear optional display items</button></div></div>}</section>
    <div className="manufacturing-universe-stat-grid">{stats.filter(item=>visibleUniverseModules.includes(item.module)).map(item=>{const Icon=item.icon;return <button key={item.label} onClick={()=>onNavigate(item.module,activeOperation)}><Icon size={16}/><strong>{item.value.toLocaleString("en-IN")}</strong><small>{item.label}</small></button>;})}</div>
    <section className="manufacturing-universe-live-panel">
      <div className="manufacturing-universe-live-heading"><div><span className="eyebrow">LIVE MANUFACTURING SCENE · WEBGL</span><h2>Manufacturing process universe</h2><p>Sphere, cube, vortex, helix, orbit, network, grid, pipeline, layered, stacked, matrix and tree views use the selected live PO-line data.</p></div><div className="manufacturing-universe-live-tools"><button className="button-primary compact-button" disabled={!poId||!poLineId||!componentId} onClick={()=>setShowAddOperation(value=>!value)}><Activity size={14}/> Add process stage</button><span className="manufacturing-universe-live-state"><i/> LIVE RECORDS</span></div></div>
      {(routeOperations.length>0||routeMaterials.length>0||routeLegs.length>0||definitions.length>0)?<ProcessUniverse3D
        onNotice={onNotice} key={poLineId}
        operations={routeOperations.filter(row=>row.relationType!=="subprocess")}
        allOperations={allRouteOperations}
        routeLabels={routeLabels}
        materialRoutes={materialRouteNodes}
        transportLegs={transportNodes}
        routeRelationships={routeRelationships}
        processDefinitions={definitions}
        vendors={vendors.map(row=>({id:row.id,company:row.company}))}
        visibleFields={visibleUniverseFields}
        showArrows
        operationTransportAmounts={transportCostByOperation}
        selectedOperationId={activeOperation?.id||""}
        simulationIndex={simulationIndex}
        zoom={zoom}
        onZoomChange={setZoom}
        initialLayout={typeof window!=="undefined"&&window.matchMedia("(max-width:760px)").matches?"network":"sphere"}
        ganttScale={ganttScale}
        onGanttScaleChange={setGanttScale}
        onSelectOperation={id=>setSelectedOperationId(id)}
        onEditOperation={id=>{const op=allRouteOperations.find(row=>row.id===id)||operations.find(row=>row.id===id);if(!op){onNotice("The selected process record could not be found in the current PO line. Refresh the line and try again.");return;}setSelectedOperationId(op.id);setEditingOperation(op);}}
        onChangeProcessColor={(id,color)=>update(current=>({...current,operations:current.operations.map(row=>row.id===id?{...row,processColor:color,updatedAt:new Date().toISOString()}:row)}))}
        onAddSubprocess={id=>{const op=allRouteOperations.find(row=>row.id===id);if(op)onNavigate("process-map",op);}}
        onAddAlternateRoute={id=>{const op=allRouteOperations.find(row=>row.id===id);if(op)onNavigate("process-map",op);}}
        onAddReworkRoute={id=>{const op=allRouteOperations.find(row=>row.id===id);if(op)onNavigate("process-map",op);}}
        onAddProcessDefinition={()=>onNavigate("process-map",activeOperation)}
        onSelectTransportLeg={(id,anchor)=>{setInspectedTransportId(id);setInspectedMaterialTransportId("");if(anchor)setTransportPopupPoint(transportPopupAnchorFromPoint(anchor.x,anchor.y));}}
        onSelectMaterialTransport={(id,anchor)=>{setInspectedMaterialTransportId(id);setInspectedTransportId("");if(anchor)setTransportPopupPoint(transportPopupAnchorFromPoint(anchor.x,anchor.y));}}
      />:<div className="manufacturing-universe-empty"><Network size={34}/><strong>No saved manufacturing route for this PO line</strong><span>Add material allocations and process steps first. The universe does not invent placeholder operations.</span><div><button className="button-primary" onClick={()=>onNavigate("route-flow")}><Route size={14}/> Open Route Flow</button><button className="button-quiet" onClick={()=>onNavigate("process-map")}><Workflow size={14}/> Open Process Plan</button></div></div>}
    </section>
    {inspectedMaterialTransportEntry&&<MaterialTransportRecordInspector
      entry={inspectedMaterialTransportEntry}
      anchor={transportPopupPoint}
      vendor={inspectedMaterialTransportVendor}
      directoryRoute={inspectedMaterialTransportRoute}
      onClose={()=>setInspectedMaterialTransportId("")}
      onOpenDirectory={()=>{setInspectedMaterialTransportId("");onNavigate("transport-master",activeOperation);}}
    />}
    {inspectedTransportLeg&&<TransportRecordInspector
      leg={inspectedTransportLeg}
      anchor={transportPopupPoint}
      materialEntry={routeMaterials.find(entry=>entry.id===inspectedTransportLeg.materialEntryId)}
      fromOperationName={allRouteOperations.find(row=>row.id===inspectedTransportLeg.anchorOperationId)?.name}
      toOperationName={allRouteOperations.find(row=>row.id===inspectedTransportLeg.targetOperationId)?.name}
      vendor={inspectedTransportVendor}
      directoryRoute={inspectedTransportRoute}
      legacyVendorRoute={inspectedLegacyVendorRoute}
      onClose={()=>setInspectedTransportId("")}
      onOpenDirectory={()=>{setInspectedTransportId("");onNavigate("transport-master",activeOperation);}}
    />}
    {showAddOperation&&<OperationQuickCreate
      poId={poId} poLineId={poLineId} componentId={componentId}
      sequence={Math.max(0,...allRouteOperations.map(row=>row.sequence))+1}
      branch="Main route" vendors={vendors.map(row=>({id:row.id,company:row.company}))}
      onSave={saveNewOperation} onCancel={()=>setShowAddOperation(false)}
    />}
    {editingOperation&&<OperationInlineEditor
      operation={editingOperation} vendors={vendors.map(row=>({id:row.id,company:row.company}))}
      onSave={saveInlineOperation} onCancel={()=>setEditingOperation(null)}
    />}
    <section className="manufacturing-universe-module-links">
      <div className="manufacturing-universe-links-head"><div><span className="eyebrow">CONNECTED WORKSPACES</span><h2>Edit the live records from their source modules</h2><p>Changes made in a source module flow back into this universe through AXIMACH's shared manufacturing data.</p></div></div>
      <div className="manufacturing-universe-links-grid">{linkModules.filter(item=>visibleUniverseModules.includes(item.id)).map(item=>{const Icon=item.icon;return <button key={item.id} onClick={()=>onNavigate(item.id,activeOperation)}><span><Icon size={17}/></span><strong>{item.title}</strong><small>{item.meta}</small><ArrowRight size={14}/></button>;})}</div>
    </section>
  </section>;
}
