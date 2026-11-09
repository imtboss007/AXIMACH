import type { ManufacturingData, ProcessDefinitionRecord, VendorRecord } from "./manufacturingData";
export const AXIMACH_DEMO_ID_PREFIX="DEMO-";
const id=(kind:string,key:string)=>AXIMACH_DEMO_ID_PREFIX+kind+"-"+key.replace(/[^a-z0-9]+/gi,"-").replace(/^-|-$/g,"").toUpperCase();
const date=(n=0)=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
type Step={category:string;name:string;sub:string;machine:string;vendor:string;tol:"Standard"|"Precision"|"Close"|"Ultra Precision";planned:number;actual:number;inspect?:boolean};
type Part={key:string;co:"ASTER"|"MERIDIAN";name:string;material:string;qty:number;price:number;tol:"Standard"|"Precision"|"Close"|"Ultra Precision";steps:Step[]};
export function createAxMachTwoCompanyDemo():ManufacturingData{
 const stamp=new Date().toISOString();
 const companies:ManufacturingData["companies"]=[
  {id:id("COMPANY","ASTER"),name:"ASTER MOTION COMPONENTS PVT LTD",gstin:"",contactPerson:"Arun Demo",phone:"",email:"arun@aster-demo.invalid",address:"Bengaluru — DEMO",notes:"SYNTHETIC DEMO COMPANY — not a real customer.",createdAt:stamp,updatedAt:stamp},
  {id:id("COMPANY","MERIDIAN"),name:"MERIDIAN FLUID SYSTEMS PVT LTD",gstin:"",contactPerson:"Meera Demo",phone:"",email:"meera@meridian-demo.invalid",address:"Coimbatore — DEMO",notes:"SYNTHETIC DEMO COMPANY — not a real customer.",createdAt:stamp,updatedAt:stamp}
 ];
 const factories:ManufacturingData["factories"]=companies.map((c,i)=>({id:id("FACTORY",i?"MERIDIAN":"ASTER"),companyId:c.id,name:i?"Meridian Demo Works":"Aster Demo Works",address:c.address||"",contactPhone:"",createdAt:stamp,updatedAt:stamp}));
 const vendorSpecs=[
  ["CNC","ASTER CNC & VMC SERVICES","Ravi Demo","CNC Turning; VMC Milling; Drilling","CNC Lathe; VMC"],
  ["HEAT","SOUTHERN HEAT TREAT DEMO","Kiran Demo","Vacuum Hardening; Carburising","Heat-treatment furnace"],
  ["FAB","PRECISION LASER & FAB DEMO","Nila Demo","Laser Cutting; Forming; MIG Welding; Powder Coating","Fiber laser; press brake; MIG"],
  ["GRIND","ACCURATE GRINDING DEMO","Sanjay Demo","Cylindrical Grinding; Surface Grinding; Internal Grinding; Deburring","Cylindrical grinder; surface grinder"],
  ["QA","METROLOGY & QUALITY DEMO LAB","Leena Demo","CMM Inspection; Dimensional Inspection; Pressure Testing; Final Inspection","CMM; gauges; pressure rig"],
  ["LOG","DEMO INDUSTRIAL LOGISTICS","Manoj Demo","Transport; Pickup; Delivery","Closed van; mini truck"]
 ];
 const vendors:VendorRecord[]=vendorSpecs.map(([code,company,contact,processes,machines])=>({id:id("VENDOR",code),company,contact,role:"Demo coordinator",phone:"",whatsappNumber:"",email:code.toLowerCase()+"@vendor-demo.invalid",address:"DEMO LOCATION — not a real supplier",processes,processDefinitionIds:[],machines,materials:"Synthetic demo only",notes:"SYNTHETIC DEMO VENDOR — do not contact.",status:"Demo only — not verified",sourceContactId:"",whatsappSyncedAt:"",vendorType:"Demo supplier",transportRoutes:[],additionalPhones:[],createdAt:stamp,updatedAt:stamp}));
 const parts:Part[]=[
  {key:"AST-1001",co:"ASTER",name:"Precision spindle sleeve",material:"EN24 / 42CrMo4",qty:100,price:1850,tol:"Ultra Precision",steps:[
   {category:"Turning",name:"CNC finish turning",sub:"OD/ID finish turning",machine:"CNC Lathe",vendor:"CNC",tol:"Precision",planned:420,actual:390},
   {category:"Heat Treatment",name:"Vacuum hardening",sub:"Hardening and tempering",machine:"Vacuum furnace",vendor:"HEAT",tol:"Precision",planned:260,actual:250},
   {category:"Grinding",name:"Cylindrical grinding",sub:"OD finish grinding",machine:"Cylindrical grinder",vendor:"GRIND",tol:"Ultra Precision",planned:380,actual:410},
   {category:"Quality",name:"CMM inspection",sub:"Runout and bore measurement",machine:"CMM",vendor:"QA",tol:"Ultra Precision",planned:120,actual:110,inspect:true}
  ]},
  {key:"AST-1002",co:"ASTER",name:"Motor mounting bracket",material:"IS 2062 mild steel",qty:250,price:640,tol:"Standard",steps:[
   {category:"Laser Cutting",name:"Fiber laser cutting",sub:"Profile cutting",machine:"Fiber laser",vendor:"FAB",tol:"Standard",planned:90,actual:85},
   {category:"Forming",name:"Press brake bending",sub:"Two-flange forming",machine:"Press brake",vendor:"FAB",tol:"Standard",planned:75,actual:70},
   {category:"Welding",name:"MIG welding",sub:"Bracket seam welding",machine:"MIG station",vendor:"FAB",tol:"Standard",planned:110,actual:105},
   {category:"Finishing",name:"Powder coating",sub:"Surface preparation and coating",machine:"Coating line",vendor:"FAB",tol:"Standard",planned:95,actual:100},
   {category:"Quality",name:"Final inspection",sub:"Hole pattern and visual check",machine:"Inspection bench",vendor:"QA",tol:"Standard",planned:35,actual:30,inspect:true}
  ]},
  {key:"AST-1003",co:"ASTER",name:"Ground transmission gear shaft",material:"20MnCr5",qty:80,price:2450,tol:"Precision",steps:[
   {category:"Turning",name:"CNC shaft turning",sub:"Bearing seats and shoulders",machine:"CNC Lathe",vendor:"CNC",tol:"Precision",planned:480,actual:460},
   {category:"Gear Cutting",name:"Gear hobbing",sub:"Spur gear tooth generation",machine:"Gear hobbing machine",vendor:"CNC",tol:"Precision",planned:520,actual:540},
   {category:"Heat Treatment",name:"Carburising",sub:"Case hardening",machine:"Heat-treatment furnace",vendor:"HEAT",tol:"Precision",planned:330,actual:320},
   {category:"Grinding",name:"Journal grinding",sub:"Bearing journal finish grind",machine:"Cylindrical grinder",vendor:"GRIND",tol:"Precision",planned:260,actual:275},
   {category:"Metrology",name:"Gear inspection",sub:"Tooth profile and runout verification",machine:"Gear tester",vendor:"QA",tol:"Precision",planned:150,actual:140,inspect:true}
  ]},
  {key:"MER-2001",co:"MERIDIAN",name:"Hydraulic manifold block",material:"Aluminium 6082-T6",qty:60,price:3250,tol:"Precision",steps:[
   {category:"VMC Machining",name:"CNC face milling",sub:"Datum face machining",machine:"VMC",vendor:"CNC",tol:"Precision",planned:550,actual:530},
   {category:"VMC Machining",name:"Deep-hole drilling",sub:"Cross-port drilling",machine:"VMC drilling setup",vendor:"CNC",tol:"Precision",planned:420,actual:440},
   {category:"Threading",name:"CNC tapping",sub:"Threaded port finishing",machine:"Tapping setup",vendor:"CNC",tol:"Precision",planned:210,actual:205},
   {category:"Deburring",name:"Precision deburring",sub:"Port edge and intersection deburring",machine:"Bench deburring",vendor:"GRIND",tol:"Precision",planned:130,actual:125},
   {category:"Quality",name:"Pressure inspection",sub:"Bore, thread and leak verification",machine:"Pressure test rig",vendor:"QA",tol:"Precision",planned:180,actual:175,inspect:true}
  ]},
  {key:"MER-2002",co:"MERIDIAN",name:"Fixture base plate",material:"EN8",qty:120,price:1420,tol:"Standard",steps:[
   {category:"Sawing",name:"Band saw cutting",sub:"Raw blank preparation",machine:"Band saw",vendor:"CNC",tol:"Standard",planned:110,actual:105},
   {category:"VMC Machining",name:"Face milling",sub:"Top and bottom face machining",machine:"VMC",vendor:"CNC",tol:"Standard",planned:260,actual:250},
   {category:"VMC Machining",name:"Drilling and tapping",sub:"Mounting hole pattern",machine:"VMC",vendor:"CNC",tol:"Standard",planned:180,actual:190},
   {category:"Grinding",name:"Surface grinding",sub:"Reference face finish",machine:"Surface grinder",vendor:"GRIND",tol:"Precision",planned:220,actual:215},
   {category:"Quality",name:"Flatness inspection",sub:"Flatness and hole-location check",machine:"Surface plate",vendor:"QA",tol:"Standard",planned:80,actual:75,inspect:true}
  ]}
 ];
 const vendorByCode=new Map(vendorSpecs.map(([code],i)=>[code,vendors[i]]));
 const defs=new Map<string,ProcessDefinitionRecord>();
 for(const p of parts)for(const s of p.steps){
  const key=s.category+"::"+s.name, v=vendorByCode.get(s.vendor)!;
  const row=defs.get(key);
  if(row){if(!row.subcategories.includes(s.sub)){row.subcategories.push(s.sub);row.subcategoryIds?.push(id("SUB",key+"::"+s.sub));}if(!row.vendorIds.includes(v.id))row.vendorIds.push(v.id);}
  else defs.set(key,{id:id("PROCESS",key),processType:s.name,category:s.category,subcategories:[s.sub],subcategoryIds:[id("SUB",key+"::"+s.sub)],vendorIds:[v.id],displayColor:"#4b95eb",notes:"Synthetic DEMO process definition; verify before live production.",createdAt:stamp,updatedAt:stamp});
 }
 const processDefinitions=[...defs.values()];
 vendors.forEach(v=>v.processDefinitionIds=processDefinitions.filter(d=>d.vendorIds.includes(v.id)).map(d=>d.id));
 const purchaseOrders:ManufacturingData["purchaseOrders"]=[],components:ManufacturingData["components"]=[],operations:ManufacturingData["operations"]=[];
 const plannedCosts:ManufacturingData["plannedCosts"]=[],materials:ManufacturingData["materials"]=[],bomLines:ManufacturingData["bomLines"]=[];
 const inventoryTransactions:ManufacturingData["inventoryTransactions"]=[],quotations:ManufacturingData["quotations"]=[];
 const paymentTransactions:ManufacturingData["paymentTransactions"]=[],inspectionMeasurements:ManufacturingData["inspectionMeasurements"]=[];
 const poMap=new Map<string,ManufacturingData["purchaseOrders"][number]>(), companyMap=new Map(companies.map(c=>[c.name.startsWith("ASTER")?"ASTER":"MERIDIAN",c]));
 for(const p of parts){
  const company=companyMap.get(p.co)!,factory=factories.find(f=>f.companyId===company.id)!;
  const componentId=id("COMPONENT",p.key),poId=id("PO",p.co),lineId=id("LINE",p.key);
  components.push({id:componentId,companyId:company.id,partNumber:p.key,name:p.name,revision:"A",material:p.material,drawingReference:p.key+"-DEMO-DRAWING.pdf",notes:"SYNTHETIC DEMO component; not a released drawing.",salePrice:p.price,salePriceUnit:"piece",orderUnit:"Piece",quantityPerUnit:1,overhead:35,toolingCost:50,reworkCost:20,scrapCost:15,rejectedQty:0,gstRate:18,createdAt:stamp,updatedAt:stamp});
  let po=poMap.get(company.id);
  if(!po){po={id:poId,number:"DEMO-PO-"+(p.co==="ASTER"?"001":"002"),companyId:company.id,factoryId:factory.id,issueDate:date(),targetDelivery:date(35),status:"Open",notes:"DEMO ONLY — synthetic purchase order.",lines:[],createdAt:stamp,updatedAt:stamp};poMap.set(company.id,po);purchaseOrders.push(po);}
  po.lines.push({id:lineId,componentId,quantity:p.qty,targetDelivery:date(35),unitPrice:p.price,notes:"DEMO PO line — assumed values.",jobStatus:"In progress",updatedAt:stamp});
  const materialId=id("MATERIAL",p.key);
  materials.push({id:materialId,code:"MAT-"+p.key,name:p.material,grade:p.material,unit:"kg",specification:"Synthetic material spec; verify before use.",preferredVendorId:id("VENDOR","CNC"),ratePerUnit:420,notes:"DEMO material rate.",createdAt:stamp,updatedAt:stamp});
  bomLines.push({id:id("BOM",p.key),componentId,materialId,revision:"A",quantityPerPart:1.25,scrapPercent:2.5,notes:"DEMO BOM quantity; verify against drawing.",createdAt:stamp,updatedAt:stamp});
  let parentId="";const mainIds:string[]=[];
  p.steps.forEach((s,i)=>{
   const def=defs.get(s.category+"::"+s.name)!,vendor=vendorByCode.get(s.vendor)!;
   const operationId=id("OPERATION",p.key+"-"+String(i+1).padStart(2,"0"));
   const completed=i===0?p.qty:i===1?Math.max(1,Math.floor(p.qty*.4)):0;
   const accepted=i===0?p.qty:i===1?Math.floor(completed*.95):0;
   const status=i===0?"Complete":i===1?"Running":"Planned";
   operations.push({id:operationId,poId,poLineId:lineId,componentId,processDefinitionId:def.id,sequence:i+1,name:s.name,category:s.category,machine:s.machine,vendorId:vendor.id,status,plannedStart:date(i+1),plannedEnd:date(i+2),actualStart:i<2?date():"",actualEnd:i===0?date():"",quantity:p.qty,completed,accepted,rejected:completed-accepted,ratePerPart:s.planned,actualRatePerPart:s.actual,transportVendorId:"",transportPickup:"",transportDelivery:"",transportCost:0,qualityNotes:s.inspect?"DEMO sample inspection required.":"",inspectionResult:"Not assessed",notes:"DEMO ONLY — not actual shop-floor execution.",paymentStatus:i===0?"Paid":"Unpaid",paidAmount:i===0?s.actual*p.qty:0,paymentReference:i===0?"DEMO-PAY-"+p.key:"",subcategory:s.sub,processSubcategoryId:def.subcategoryIds?.[def.subcategories.indexOf(s.sub)],executionType:vendor.id===vendors[0].id?"Internal":"Outsourced",toleranceCategory:s.tol,inspectionRequired:!!s.inspect,transportFrom:"",transportTo:"",transportVehicleType:"",transportRouteId:"",processColor:def.displayColor,branch:"Main route",parentId,createdAt:stamp,updatedAt:stamp});
   mainIds.push(operationId);parentId=operationId;
   const subIndex=def.subcategories.indexOf(s.sub);
   plannedCosts.push({id:id("PLANNED-COST",p.key+"-"+(i+1)),companyId:company.id,poId,componentId,processDefinitionId:def.id,processSubcategoryId:def.subcategoryIds?.[subIndex],companyName:company.name,poNumber:po.number,componentName:p.name,componentNumber:p.key,processType:s.name,processCategory:s.category,processSubcategory:s.sub,plannedQty:p.qty,unit:"piece",plannedRate:s.planned,notes:"DEMO planned rate per piece.",createdAt:stamp,updatedAt:stamp});
   quotations.push({id:id("QUOTE",p.key+"-"+(i+1)),poId,poLineId:lineId,componentId,operationId,vendorId:vendor.id,quoteReference:"DEMO-Q-"+p.key+"-"+(i+1),quotedAt:date(),validUntil:date(30),quantity:p.qty,ratePerPart:s.planned,transportCost:75,leadDays:5,status:i===0?"Selected":"Received",notes:"DEMO quote; not a supplier offer.",createdAt:stamp,updatedAt:stamp});
   if(i===0){paymentTransactions.push({id:id("PAYMENT",p.key),operationId,poId,poLineId:lineId,componentId,amount:s.actual*p.qty,paidAt:date(),reference:"DEMO-UTR-"+p.key,notes:"DEMO payment; no money transferred.",createdAt:stamp,updatedAt:stamp});inventoryTransactions.push({id:id("STOCK",p.key),itemType:"material",itemId:materialId,transactionType:"Issue to production",direction:"out",quantity:p.qty*1.25,occurredAt:date(),reference:"DEMO-ISSUE-"+p.key,notes:"DEMO material issue.",companyId:company.id,factoryId:factory.id,poId,poLineId:lineId,operationId,vendorId:vendor.id,reversalOfId:"",createdAt:stamp,createdBy:"AXIMACH DEMO",updatedAt:stamp});}
   if(s.inspect)inspectionMeasurements.push({id:id("MEASUREMENT",p.key),operationId,poId,poLineId:lineId,componentId,characteristic:"Sample bore / profile dimension",nominalValue:10,lowerLimit:9.95,upperLimit:10.05,measuredValue:10.01,unit:"mm",result:"Not assessed",notes:"Synthetic demo reading; not a certificate.",inspectedAt:date(),createdAt:stamp,updatedAt:stamp});
  });
  if(p.key==="AST-1001"){const d=defs.get("Grinding::Cylindrical grinding")!;operations.push({id:id("OPERATION","AST-1001-ALT-01"),poId,poLineId:lineId,componentId,processDefinitionId:d.id,sequence:3,name:"Internal grinding alternative",category:"Grinding",machine:"Internal grinder",vendorId:id("VENDOR","GRIND"),status:"Planned",plannedStart:date(9),plannedEnd:date(10),actualStart:"",actualEnd:"",quantity:p.qty,completed:0,accepted:0,rejected:0,ratePerPart:430,actualRatePerPart:0,transportVendorId:"",transportPickup:"",transportDelivery:"",transportCost:0,qualityNotes:"",inspectionResult:"Not assessed",notes:"DEMO alternate path.",paymentStatus:"Unpaid",paidAmount:0,paymentReference:"",subcategory:"OD finish grinding",processSubcategoryId:d.subcategoryIds?.[d.subcategories.indexOf("OD finish grinding")],executionType:"Outsourced",toleranceCategory:"Ultra Precision",inspectionRequired:false,transportFrom:"",transportTo:"",transportVehicleType:"",transportRouteId:"",processColor:d.displayColor,branch:"Alternate route",parentId:mainIds[1],relationType:"alternate",costIncluded:false,createdAt:stamp,updatedAt:stamp});}
  if(p.key==="MER-2001"){const d=defs.get("Deburring::Precision deburring")!;operations.push({id:id("OPERATION","MER-2001-REWORK-01"),poId,poLineId:lineId,componentId,processDefinitionId:d.id,sequence:5,name:"Port edge rework",category:"Deburring",machine:"Bench deburring",vendorId:id("VENDOR","GRIND"),status:"Quality hold",plannedStart:date(10),plannedEnd:date(11),actualStart:"",actualEnd:"",quantity:p.qty,completed:0,accepted:0,rejected:0,ratePerPart:55,actualRatePerPart:0,transportVendorId:"",transportPickup:"",transportDelivery:"",transportCost:0,qualityNotes:"DEMO rework branch.",inspectionResult:"Not assessed",notes:"DEMO rework path.",paymentStatus:"Unpaid",paidAmount:0,paymentReference:"",subcategory:"Port edge and intersection deburring",processSubcategoryId:d.subcategoryIds?.[d.subcategories.indexOf("Port edge and intersection deburring")],executionType:"Outsourced",toleranceCategory:"Precision",inspectionRequired:true,transportFrom:"",transportTo:"",transportVehicleType:"",transportRouteId:"",processColor:d.displayColor,branch:"Rework route",parentId:mainIds[2],relationType:"rework",costIncluded:false,createdAt:stamp,updatedAt:stamp});}
 }
 const transportRoutes:ManufacturingData["transportRoutes"]=[{id:id("ROUTE","BENGALURU-COIMBATORE"),vendorId:id("VENDOR","LOG"),fromLocation:"Bengaluru DEMO",toLocation:"Coimbatore DEMO",tripDirection:"One-way",vehicleType:"Closed van",fixedAmount:4500,currency:"INR",active:true,notes:"DEMO route, not a booking.",createdAt:stamp,updatedAt:stamp}];
 const transportLegs:ManufacturingData["transportLegs"]=parts.map(p=>({id:id("TRANSPORT-LEG",p.key),poId:id("PO",p.co),poLineId:id("LINE",p.key),componentId:id("COMPONENT",p.key),sequence:1,routeId:transportRoutes[0].id,vendorId:id("VENDOR","LOG"),fromLocation:"Bengaluru DEMO",toLocation:"Coimbatore DEMO",tripDirection:"One-way",vehicleType:"Closed van",fixedAmount:4500,tripCount:1,anchorOperationId:id("OPERATION",p.key+"-01"),placement:"after",pickupAt:date(12),deliveryAt:date(13),status:"Planned",completedTrips:0,notes:"DEMO transport leg; not booked.",createdAt:stamp,updatedAt:stamp}));
 const contactProfiles:ManufacturingData["contactProfiles"]=[
  ...companies.map(c=>({id:id("CONTACT",c.id),linkedType:"company" as const,linkedId:c.id,name:c.contactPerson||"Demo contact",role:"Demo purchasing contact",group:"DEMO",phone:"",whatsapp:"",additionalPhones:[],email:c.email,address:c.address||"",followUpDate:date(3),history:"Synthetic DEMO contact.",processCategories:[],processTypes:[],processSubcategories:[],processDefinitionIds:[],processSubcategoryIds:[],machineCapabilities:[],materialCapabilities:[],createdAt:stamp,updatedAt:stamp})),
  ...vendors.map(v=>({id:id("CONTACT",v.id),linkedType:"vendor" as const,linkedId:v.id,name:v.contact,role:"Demo vendor contact",group:"DEMO",phone:"",whatsapp:"",additionalPhones:[],email:v.email,address:v.address,followUpDate:date(4),history:"Synthetic DEMO vendor contact; do not contact.",processCategories:[],processTypes:[],processSubcategories:[],processDefinitionIds:[],processSubcategoryIds:[],machineCapabilities:[],materialCapabilities:[],createdAt:stamp,updatedAt:stamp}))
 ];
 const followUpAssignments:ManufacturingData["followUpAssignments"]=vendors.map(v=>({id:id("FOLLOW-UP",v.id),moduleId:"vendors",recordId:v.id,recordLabel:v.company,contactId:id("CONTACT",v.id),contactName:v.contact,contactPhone:"",contactEmail:v.email,createdAt:stamp,updatedAt:stamp}));
 return {updatedAt:stamp,companies,factories,purchaseOrders,components,vendors,operations,quotations,materials,bomLines,inventoryTransactions,contactProfiles,processDefinitions,plannedCosts,transportRoutes,transportLegs,paymentTransactions,inspectionMeasurements,followUpAssignments};
}
export function archiveAxMachTwoCompanyDemo(current:ManufacturingData,stamp=new Date().toISOString()):ManufacturingData{
 const archive=<T extends {id:string;updatedAt?:string;deletedAt?:string}>(rows:T[]):T[]=>rows.map(row=>row.id.startsWith(AXIMACH_DEMO_ID_PREFIX)?{...row,deletedAt:stamp,updatedAt:stamp}:row);
 return {...current,updatedAt:stamp,companies:archive(current.companies),factories:archive(current.factories),
  purchaseOrders:current.purchaseOrders.map(po=>({...po,...(po.id.startsWith(AXIMACH_DEMO_ID_PREFIX)?{deletedAt:stamp,updatedAt:stamp}:{}),lines:po.lines.map(line=>line.id.startsWith(AXIMACH_DEMO_ID_PREFIX)?{...line,deletedAt:stamp,updatedAt:stamp}:line)})),
  components:archive(current.components),vendors:archive(current.vendors),operations:archive(current.operations),
  quotations:archive(current.quotations),materials:archive(current.materials),bomLines:archive(current.bomLines),
  inventoryTransactions:archive(current.inventoryTransactions),contactProfiles:archive(current.contactProfiles),
  processDefinitions:archive(current.processDefinitions),plannedCosts:archive(current.plannedCosts),
  transportRoutes:archive(current.transportRoutes),transportLegs:archive(current.transportLegs),
  paymentTransactions:archive(current.paymentTransactions),inspectionMeasurements:archive(current.inspectionMeasurements),
  followUpAssignments:archive(current.followUpAssignments)};
}
