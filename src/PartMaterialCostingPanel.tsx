import { useEffect, useState } from "react";
import { Check, ChevronDown, Plus, Scissors, Trash2, Truck, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ComponentPartRecord, type MaterialCostEntryRecord, type MaterialRecord, type OperationRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Scope = "process-map" | "planned-cost";
type Props = { scope: Scope; companyId?: string; poId?: string; poLineId?: string; componentId: string; componentName?: string; componentNumber?: string; initialPartId?: string; processOptions?: OperationRecord[]; onNotice?: (value: string) => void; requirePoLine?: boolean; startExpanded?: boolean; defaultNewPart?: boolean };
type DimensionKey = "length" | "width" | "thickness" | "diameter" | "outerDiameter" | "innerDiameter" | "wallThickness" | "outerWidth" | "outerHeight" | "height" | "legA" | "legB" | "flangeWidth" | "flangeThickness" | "webThickness" | "acrossFlats" | "crossSectionArea";
type Shape = { id: string; label: string; fields: Array<{ key: DimensionKey; label: string; unit?: string }> };
const SHAPES: Shape[] = [
  { id: "plate", label: "Sheet / plate", fields: [{key:"length",label:"Length"},{key:"width",label:"Width"},{key:"thickness",label:"Thickness"}] },
  { id: "flat-bar", label: "Flat bar", fields: [{key:"length",label:"Length"},{key:"width",label:"Width"},{key:"thickness",label:"Thickness"}] },
  { id: "round-bar", label: "Round bar / rod", fields: [{key:"length",label:"Length"},{key:"diameter",label:"Diameter"}] },
  { id: "square-bar", label: "Square bar", fields: [{key:"length",label:"Length"},{key:"width",label:"Side width"}] },
  { id: "hex-bar", label: "Hexagonal bar", fields: [{key:"length",label:"Length"},{key:"acrossFlats",label:"Across flats"}] },
  { id: "round-tube", label: "Round tube / pipe", fields: [{key:"length",label:"Length"},{key:"outerDiameter",label:"Outer diameter / OD"},{key:"innerDiameter",label:"Inner diameter / ID"}] },
  { id: "square-tube", label: "Square tube / hollow section", fields: [{key:"length",label:"Length"},{key:"outerWidth",label:"Outer side"},{key:"wallThickness",label:"Wall thickness"}] },
  { id: "rectangular-tube", label: "Rectangular tube / RHS", fields: [{key:"length",label:"Length"},{key:"outerWidth",label:"Outer width"},{key:"outerHeight",label:"Outer height"},{key:"wallThickness",label:"Wall thickness"}] },
  { id: "angle", label: "Angle / L-section", fields: [{key:"length",label:"Length"},{key:"legA",label:"Leg A"},{key:"legB",label:"Leg B"},{key:"thickness",label:"Thickness"}] },
  { id: "channel", label: "Channel / C-section / U-section", fields: [{key:"length",label:"Length"},{key:"width",label:"Flange width"},{key:"height",label:"Overall height"},{key:"webThickness",label:"Web thickness"},{key:"flangeThickness",label:"Flange thickness"}] },
  { id: "i-beam", label: "I-beam / H-beam", fields: [{key:"length",label:"Length"},{key:"flangeWidth",label:"Flange width"},{key:"height",label:"Overall height"},{key:"webThickness",label:"Web thickness"},{key:"flangeThickness",label:"Flange thickness"}] },
  { id: "t-section", label: "T-section", fields: [{key:"length",label:"Length"},{key:"flangeWidth",label:"Flange width"},{key:"height",label:"Overall height"},{key:"webThickness",label:"Web thickness"},{key:"flangeThickness",label:"Flange thickness"}] },
  { id: "custom-profile", label: "Custom profile / rib / staple", fields: [{key:"length",label:"Length"},{key:"crossSectionArea",label:"Cross-section area",unit:"mm²"}] }
];
const UNITS = ["mm","cm","m","ft","inch"];
const UNIT_MM: Record<string,number> = { mm:1, cm:10, m:1000, ft:304.8, inch:25.4 };
const CUT_TYPES = ["Bandsaw","Laser","Gas cut","Plasma","Waterjet","Circular saw","Hacksaw","Shearing","Guillotine","Abrasive cutting","Wire EDM","Milling / profile cutting","Other"];
const CUT_BASES = ["Per piece","Per cut","Per kg","Per metre","Per hour","Fixed job"];
const MATERIAL_SEEDS = [
  {name:"Mild steel",grade:"MS / low-carbon steel",density:7850,type:"Steel"},
  {name:"Mild steel",grade:"IS 2062 E250",density:7850,type:"Steel"},
  {name:"Mild steel",grade:"IS 2062 E350",density:7850,type:"Steel"},
  {name:"Carbon steel",grade:"EN1A",density:7850,type:"Steel"},
  {name:"Carbon steel",grade:"EN8",density:7850,type:"Steel"},
  {name:"Carbon steel",grade:"EN9",density:7850,type:"Steel"},
  {name:"Alloy steel",grade:"EN19",density:7850,type:"Steel"},
  {name:"Alloy steel",grade:"EN24",density:7850,type:"Steel"},
  {name:"Alloy steel",grade:"EN31",density:7850,type:"Steel"},
  {name:"Alloy steel",grade:"EN36",density:7850,type:"Steel"},
  {name:"Stainless steel",grade:"SS 304",density:7930,type:"Stainless steel"},
  {name:"Stainless steel",grade:"SS 316",density:8000,type:"Stainless steel"},
  {name:"Stainless steel",grade:"SS 410",density:7750,type:"Stainless steel"},
  {name:"Stainless steel",grade:"SS 420",density:7750,type:"Stainless steel"},
  {name:"Aluminium",grade:"Aluminium 1050",density:2710,type:"Aluminium"},
  {name:"Aluminium",grade:"Aluminium 6061",density:2700,type:"Aluminium"},
  {name:"Aluminium",grade:"Aluminium 6063",density:2700,type:"Aluminium"},
  {name:"Aluminium",grade:"Aluminium 6082",density:2700,type:"Aluminium"},
  {name:"Aluminium",grade:"Aluminium 7075",density:2810,type:"Aluminium"},
  {name:"Copper",grade:"Copper C11000 / ETP",density:8960,type:"Copper"},
  {name:"Brass",grade:"Brass C26000",density:8530,type:"Brass"},
  {name:"Brass",grade:"Brass C36000",density:8500,type:"Brass"},
  {name:"Bronze",grade:"Tin bronze",density:8800,type:"Bronze"},
  {name:"Cast iron",grade:"Grey cast iron",density:7200,type:"Cast iron"},
  {name:"Zinc",grade:"Zinc",density:7140,type:"Non-ferrous"},
  {name:"Titanium",grade:"Titanium Grade 2",density:4510,type:"Titanium"},
  {name:"Carbon steel",grade:"AISI 1018",density:7870,type:"Steel"},{name:"Carbon steel",grade:"S355 / IS 2062 E350",density:7850,type:"Steel"},{name:"Alloy steel",grade:"AISI 4130",density:7850,type:"Steel"},{name:"Alloy steel",grade:"AISI 52100 / 100Cr6",density:7810,type:"Steel"},{name:"Stainless steel",grade:"SS 201",density:7800,type:"Stainless steel"},{name:"Stainless steel",grade:"SS 303",density:7900,type:"Stainless steel"},{name:"Stainless steel",grade:"SS 430",density:7700,type:"Stainless steel"},{name:"Stainless steel",grade:"17-4PH",density:7800,type:"Stainless steel"},{name:"Aluminium",grade:"Aluminium 1100",density:2710,type:"Aluminium"},{name:"Aluminium",grade:"Aluminium 3003",density:2730,type:"Aluminium"},{name:"Aluminium",grade:"Aluminium 6061-T6",density:2700,type:"Aluminium"},{name:"Aluminium",grade:"Aluminium 7075-T6",density:2810,type:"Aluminium"},{name:"Copper alloy",grade:"Cupronickel 70/30",density:8960,type:"Copper alloy"},{name:"Nickel alloy",grade:"Hastelloy C276",density:8410,type:"Nickel alloy"},{name:"Engineering plastic",grade:"Polyetheretherketone (PEEK)",density:1300,type:"Plastic"},{name:"Engineering plastic",grade:"Polyamide 66 (PA66)",density:1140,type:"Plastic"},
  {name:"Carbon steel",grade:"AISI 1045",density:7850,type:"Steel"},{name:"Carbon steel",grade:"AISI 1020",density:7870,type:"Steel"},{name:"Carbon steel",grade:"AISI 4140",density:7850,type:"Steel"},{name:"Alloy steel",grade:"AISI 4340",density:7850,type:"Steel"},{name:"Alloy steel",grade:"EN 353",density:7850,type:"Steel"},{name:"Alloy steel",grade:"EN 19",density:7850,type:"Steel"},
  {name:"Stainless steel",grade:"SS 304L",density:7930,type:"Stainless steel"},{name:"Stainless steel",grade:"SS 316L",density:8000,type:"Stainless steel"},{name:"Stainless steel",grade:"Duplex 2205",density:7850,type:"Stainless steel"},
  {name:"Aluminium",grade:"Aluminium 5052",density:2680,type:"Aluminium"},{name:"Aluminium",grade:"Aluminium 5083",density:2660,type:"Aluminium"},{name:"Aluminium",grade:"Aluminium 2014",density:2800,type:"Aluminium"},
  {name:"Copper",grade:"Copper C10100",density:8890,type:"Copper"},{name:"Copper alloy",grade:"Phosphor bronze",density:8800,type:"Copper alloy"},{name:"Copper alloy",grade:"Cupronickel 70/30",density:8960,type:"Copper alloy"},
  {name:"Nickel alloy",grade:"Inconel 625",density:8440,type:"Nickel alloy"},{name:"Nickel alloy",grade:"Monel 400",density:8800,type:"Nickel alloy"},{name:"Nickel alloy",grade:"Hastelloy C276",density:8410,type:"Nickel alloy"},
  {name:"Magnesium",grade:"Magnesium AZ31B",density:1770,type:"Magnesium"},{name:"Engineering plastic",grade:"UHMWPE",density:940,type:"Plastic"},{name:"Engineering plastic",grade:"PVC rigid",density:1400,type:"Plastic"},{name:"Engineering plastic",grade:"Polycarbonate",density:1200,type:"Plastic"},{name:"Engineering plastic",grade:"ABS",density:1070,type:"Plastic"},{name:"Engineering plastic",grade:"Acrylic / PMMA",density:1190,type:"Plastic"},{name:"Engineering plastic",grade:"Polypropylene (PP)",density:900,type:"Plastic"}
];
const money = (n:number) => "₹" + (Number(n)||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const unitScale = (unit:string) => UNIT_MM[unit] || 1;
const kgToLb = 2.2046226218;
function dimMm(key:DimensionKey, dims:Record<string,string>, units:Record<string,string>) {
  return Math.max(0,Number(dims[key])||0) * unitScale(units[key]||"mm");
}
function shapeVolumeMm3(shape:string,dims:Record<string,string>,units:Record<string,string>) {
  const d=(key:DimensionKey)=>dimMm(key,dims,units);
  const L=d("length"), W=d("width"), T=d("thickness"), H=d("height"), A=d("outerWidth"), B=d("outerHeight"), wall=d("wallThickness");
  if(shape==="plate"||shape==="flat-bar") return L*W*T;
  if(shape==="round-bar") return Math.PI*Math.pow(d("diameter"),2)*L/4;
  if(shape==="square-bar") return L*Math.pow(W,2);
  if(shape==="hex-bar") return L*3*Math.sqrt(3)*Math.pow(d("acrossFlats"),2)/8;
  if(shape==="round-tube") { const od=d("outerDiameter"), enteredId=d("innerDiameter"), id=enteredId>0?enteredId:Math.max(0,od-2*wall); return id<od?Math.PI*(od*od-id*id)*L/4:0; }
  if(shape==="square-tube") return L*Math.max(0,A*A-Math.pow(Math.max(0,A-2*wall),2));
  if(shape==="rectangular-tube") return L*Math.max(0,A*B-Math.max(0,A-2*wall)*Math.max(0,B-2*wall));
  if(shape==="angle") return L*Math.max(0,d("legA")*T+d("legB")*T-T*T);
  if(shape==="channel") return L*Math.max(0,2*W*d("flangeThickness")+Math.max(0,H-2*d("flangeThickness"))*d("webThickness"));
  if(shape==="i-beam") { const fw=d("flangeWidth"),ft=d("flangeThickness"),web=d("webThickness"); return L*Math.max(0,2*fw*ft+Math.max(0,H-2*ft)*web); }
  if(shape==="t-section") { const fw=d("flangeWidth"),ft=d("flangeThickness"); return L*Math.max(0,fw*ft+Math.max(0,H-ft)*d("webThickness")); }
  if(shape==="custom-profile") return L*d("crossSectionArea");
  return 0;
}
function densityKgM3(material?:MaterialRecord) {
  if(!material) return 0;
  const density=Math.max(0,Number(material.densityKgM3)||0);
  if(material.densityUnit==="g/cm3") return density*1000;
  return density;
}

export default function PartMaterialCostingPanel({scope,companyId="",poId="",poLineId="",componentId,componentName="",componentNumber="",initialPartId="",processOptions=[],onNotice,requirePoLine=false,startExpanded=false,defaultNewPart=false}:Props) {
  const {data,update}=useManufacturingData();
  const materials=activeRows(data.materials);
  useEffect(()=>{
    const additions=MATERIAL_SEEDS.map(item=>({
      id:"material-seed-"+item.grade.toLowerCase().replace(/[^a-z0-9]+/g,"-"),code:item.grade.toUpperCase().replace(/[^A-Z0-9]+/g,"-"),name:item.name,grade:item.grade,unit:"kg",specification:"Typical reference density; verify against material certificate and supplier data.",preferredVendorId:"",ratePerUnit:0,notes:"Reference density in kg/m³ only; verify actual grade against supplier material certificate.",materialType:item.type,densityKgM3:item.density,densityUnit:"kg/m3" as const,priceUnit:"kg" as const,createdAt:nowIso(),updatedAt:nowIso()
    }));
    update(current=>{const keys=new Set(current.materials.map(item=>(item.name+"::"+item.grade).toLowerCase()));const missing=additions.filter(item=>!keys.has((item.name+"::"+item.grade).toLowerCase()));return missing.length?{...current,materials:[...missing,...current.materials]}:current;});
  // Seed once when the shared material catalogue is first opened.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const vendors=activeRows(data.vendors);
  const parts=activeRows(data.componentParts||[]).filter(part=>part.componentId===componentId);
  const relatedPoLines=activeRows(data.purchaseOrders||[]).filter(po=>!poId||po.id===poId).flatMap(po=>po.lines.filter(line=>!line.deletedAt&&line.componentId===componentId).map(line=>({po, line, part:parts.find(part=>part.id===line.partId)})));
  // Show every saved part/material allocation for this component and PO, not only the currently selected PO line.
  const entries=activeRows(data.materialCostEntries||[]).filter(entry=>entry.scope===scope&&entry.componentId===componentId&&(!poId||entry.poId===poId));
  const [expanded,setExpanded]=useState(startExpanded);
  const [target,setTarget]=useState<"component"|"part">(initialPartId||defaultNewPart?"part":"component");
  const [newPartMode,setNewPartMode]=useState(defaultNewPart&&!initialPartId);
  const [formError,setFormError]=useState("");
  const [selectedPoLineId,setSelectedPoLineId]=useState(poLineId);
  const [anchorOperationId,setAnchorOperationId]=useState("");
  const [partId,setPartId]=useState(initialPartId);
  const [partName,setPartName]=useState("");
  const [partNumber,setPartNumber]=useState("");
  const [shape,setShape]=useState("plate");
  const [dimensions,setDimensions]=useState<Record<string,string>>({});
  const [dimensionUnits,setDimensionUnits]=useState<Record<string,string>>({});
  const [materialId,setMaterialId]=useState("");
  const [newMaterialOpen,setNewMaterialOpen]=useState(false);
  const [newMaterialName,setNewMaterialName]=useState("");
  const [newMaterialType,setNewMaterialType]=useState("");
  const [editingEntryId,setEditingEntryId]=useState("");
  const [newMaterialGrade,setNewMaterialGrade]=useState("");
  const [newMaterialCode,setNewMaterialCode]=useState("");
  const [newDensity,setNewDensity]=useState("");
  const [densityUnit,setDensityUnit]=useState<"kg/m3"|"g/cm3">("kg/m3");
  const [materialRate,setMaterialRate]=useState("");
  const [priceUnit,setPriceUnit]=useState<"kg"|"lb">("kg");
  const [quantity,setQuantity]=useState("1");
  const [vendorId,setVendorId]=useState("");
  const [givenDate,setGivenDate]=useState("");
  const [deliveryDate,setDeliveryDate]=useState("");
  const [actualDeliveryDate,setActualDeliveryDate]=useState("");
  const [transportVendorId,setTransportVendorId]=useState("");
  const [transportFrom,setTransportFrom]=useState("");
  const [transportTo,setTransportTo]=useState("");
  const [transportVehicleType,setTransportVehicleType]=useState("");
  const [transportCost,setTransportCost]=useState("");
  const [transportPickupAt,setTransportPickupAt]=useState("");
  const [transportDeliveryAt,setTransportDeliveryAt]=useState("");
  const [transportStatus,setTransportStatus]=useState<"Planned"|"Queued"|"Running"|"Complete"|"Delayed">("Planned");
  const [cuttingType,setCuttingType]=useState("");
  const [customCuttingType,setCustomCuttingType]=useState("");
  const [cuttingBasis,setCuttingBasis]=useState("Per piece");
  const [cuttingRate,setCuttingRate]=useState("");
  const [cutsPerPiece,setCutsPerPiece]=useState("1");
  const [cuttingHours,setCuttingHours]=useState("0");
  const [wastagePercent,setWastagePercent]=useState("0");
  const [notes,setNotes]=useState("");
  useEffect(()=>{if(initialPartId){const part=parts.find(item=>item.id===initialPartId);if(part){setTarget("part");selectPart(initialPartId);}}},[initialPartId,parts.length]);
  const chosenMaterial=materials.find(item=>item.id===materialId);
  const chosenShape=SHAPES.find(item=>item.id===shape)||SHAPES[0];
  const volumeMm3=shapeVolumeMm3(shape,dimensions,dimensionUnits);
  const perPieceKg=volumeMm3*densityKgM3(chosenMaterial||({densityKgM3:Number(newDensity),densityUnit} as MaterialRecord))/1_000_000_000;
  const qty=Math.max(0,Number(quantity)||0);
  const wastage=Math.max(0,Number(wastagePercent)||0);
  const totalWeightKg=perPieceKg*qty*(1+wastage/100);
  const rate=Math.max(0,Number(materialRate)||0);
  const materialCost=priceUnit==="kg"?totalWeightKg*rate:totalWeightKg*kgToLb*rate;
  const lengthM=dimMm("length",dimensions,dimensionUnits)/1000;
  const cutRate=Math.max(0,Number(cuttingRate)||0);
  const cuttingCost=!cuttingType?0:cuttingBasis==="Per piece"?cutRate*qty:cuttingBasis==="Per cut"?cutRate*qty*Math.max(1,Number(cutsPerPiece)||1):cuttingBasis==="Per kg"?cutRate*totalWeightKg:cuttingBasis==="Per metre"?cutRate*lengthM*qty:cuttingBasis==="Per hour"?cutRate*Math.max(0,Number(cuttingHours)||0):cutRate;
  const totalCost=materialCost+cuttingCost;
  const reset=()=>{setFormError("");setEditingEntryId("");setAnchorOperationId("");setTarget(defaultNewPart&&!initialPartId?"part":"component");setNewPartMode(defaultNewPart&&!initialPartId);setPartId("");setPartName("");setPartNumber("");setShape("plate");setDimensions({});setDimensionUnits({});setMaterialId("");setNewMaterialOpen(false);setNewMaterialName("");setNewMaterialType("");setNewMaterialGrade("");setNewMaterialCode("");setNewDensity("");setMaterialRate("");setPriceUnit("kg");setQuantity("1");setVendorId("");setGivenDate("");setDeliveryDate("");setActualDeliveryDate("");setTransportVendorId("");setTransportFrom("");setTransportTo("");setTransportVehicleType("");setTransportCost("");setTransportPickupAt("");setTransportDeliveryAt("");setTransportStatus("Planned");setCuttingType("");setCustomCuttingType("");setCuttingBasis("Per piece");setCuttingRate("");setCutsPerPiece("1");setCuttingHours("0");setWastagePercent("0");setNotes("");};
  const selectPart=(id:string)=>{const part=parts.find(item=>item.id===id);const linkedLine=relatedPoLines.find(item=>item.line.partId===id);if(linkedLine)setSelectedPoLineId(linkedLine.line.id);setNewPartMode(false);setPartId(id);setPartName(part?.name||"");setPartNumber(part?.partNumber||"");setShape(part?.shapeType||"plate");setDimensions(Object.fromEntries(Object.entries(part?.dimensions||{}).map(([key,value])=>[key,String(value)])));setDimensionUnits(part?.dimensionUnits||{});setMaterialId(part?.materialId||"");const savedMaterial=materials.find(item=>item.id===part?.materialId);if(savedMaterial){setMaterialRate(String(savedMaterial.ratePerUnit||""));setPriceUnit(savedMaterial.priceUnit||"kg");setVendorId(part?.vendorIds?.[0]||savedMaterial.preferredVendorId||"");}};
  useEffect(()=>{
    if(requirePoLine&&!selectedPoLineId&&relatedPoLines.length===1){
      const onlyLine=relatedPoLines[0];
      setSelectedPoLineId(onlyLine.line.id);
      if(onlyLine.line.partId)selectPart(onlyLine.line.partId);
    }
  },[requirePoLine,selectedPoLineId,relatedPoLines.length]);
  const editEntry=(entry:MaterialCostEntryRecord)=>{
    const part=parts.find(item=>item.id===entry.partId);
    setExpanded(true);setEditingEntryId(entry.id);setNewMaterialOpen(false);setNewMaterialName("");setNewMaterialType("");setNewMaterialGrade("");setNewMaterialCode("");setNewDensity("");
    setSelectedPoLineId(entry.poLineId||poLineId||"");setAnchorOperationId(entry.anchorOperationId||"");setTarget(part?"part":"component");setNewPartMode(false);setPartId(part?.id||"");setPartName(part?.name||entry.partName||"");setPartNumber(part?.partNumber||entry.partNumber||"");
    setShape(entry.shapeType||part?.shapeType||"plate");setDimensions(Object.fromEntries(Object.entries(entry.dimensions||{}).map(([key,value])=>[key,String(value)])));setDimensionUnits(entry.dimensionUnits||part?.dimensionUnits||{});
    setMaterialId(entry.materialId||"");setMaterialRate(String(entry.materialRate||""));setPriceUnit(entry.priceUnit||"kg");setQuantity(String(entry.quantity||1));setVendorId(entry.vendorId||"");
    setGivenDate(entry.givenDate||"");setDeliveryDate(entry.deliveryDate||"");setActualDeliveryDate(entry.actualDeliveryDate||"");setTransportVendorId(entry.transportVendorId||"");setTransportFrom(entry.transportFrom||"");setTransportTo(entry.transportTo||"");setTransportVehicleType(entry.transportVehicleType||"");setTransportCost(String(entry.transportCost||0));setTransportPickupAt(entry.transportPickupAt||"");setTransportDeliveryAt(entry.transportDeliveryAt||"");setTransportStatus((entry.transportStatus as "Planned"|"Queued"|"Running"|"Complete"|"Delayed")||"Planned");
    setCuttingType(entry.cuttingType||"");setCustomCuttingType("");setCuttingBasis(entry.cuttingBasis||"Per piece");setCuttingRate(String(entry.cuttingRate||0));setCutsPerPiece(String(entry.cutsPerPiece||1));setCuttingHours(String(entry.cuttingHours||0));setWastagePercent(String(entry.wastagePercent||0));setNotes(entry.notes||"");
  };
  const effectivePoLineId=selectedPoLineId;
  const effectivePoLine=relatedPoLines.find(item=>item.line.id===effectivePoLineId);
  const reportError=(message:string)=>{setFormError(message);onNotice?.(message);};
  const save=()=>{
    setFormError("");
    const material=chosenMaterial;
    const materialName=newMaterialOpen?newMaterialName.trim():material?.name||"";
    const materialGrade=newMaterialOpen?newMaterialGrade.trim():material?.grade||"";
    const density= newMaterialOpen ? Math.max(0,Number(newDensity)||0)*(densityUnit==="g/cm3"?1000:1) : densityKgM3(material);
    if(!componentId){reportError("Select a component before saving material costing.");return;}
    if(requirePoLine&&!effectivePoLineId){reportError("Select the exact PO component line before saving this Material Directory allocation.");return;}
    
    if(target==="part"&&!partName.trim()){reportError("Enter a part name or select an existing part.");return;}
    if(target==="part"&&effectivePoLine?.line.partId&&effectivePoLine.line.partId!==partId){reportError("This PO line is already linked to a different part. Create or select a separate PO line for this additional part so each part has its own process route.");return;}
    if(effectivePoLineId&&!relatedPoLines.some(item=>item.line.id===effectivePoLineId)){reportError("The selected PO line does not belong to this component.");return;}
    if(scope==="process-map"&&anchorOperationId&&!processOptions.some(operation=>operation.id===anchorOperationId)){reportError("Select an active operation from this component route for the procurement position.");return;}
    if(!newMaterialOpen&&!material){reportError("Select a material grade from Material Directory or add a new grade.");return;}
    if(newMaterialOpen&&(!materialName||!newMaterialType.trim()||!materialGrade||density<=0)){reportError("Enter material name, material type, grade and a positive density in kg/m³.");return;}
    if(!Number.isFinite(qty)||qty<=0){reportError("Enter a valid part quantity.");return;}
    if(volumeMm3<=0||perPieceKg<=0){reportError("Enter valid dimensions for the selected shape and material density.");return;}
    if(!Number.isFinite(rate)||rate<0){reportError("Enter a valid material rate per kg or lb.");return;}
    const stamp=nowIso();
    let materialRecord=material;
    if(newMaterialOpen){
      const savedGrade=materials.find(row=>row.grade.trim().toLowerCase()===materialGrade.toLowerCase() && (row.materialType||row.name).trim().toLowerCase()===(newMaterialType.trim()||materialName).toLowerCase());
      if(!savedGrade&&newMaterialCode.trim()&&materials.some(row=>row.code.trim().toLowerCase()===newMaterialCode.trim().toLowerCase())){reportError("That material code is already in the Material Directory. Reuse the saved grade or enter a unique code.");return;}
      materialRecord=savedGrade
        ? {...savedGrade,ratePerUnit:rate,priceUnit,preferredVendorId:vendorId||savedGrade.preferredVendorId,densityKgM3:density,densityUnit:"kg/m3",updatedAt:stamp}
        : {id:makeId("material"),code:newMaterialCode.trim()||makeId("MAT").toUpperCase(),name:materialName,grade:materialGrade,unit:"kg",specification:"Typical room-temperature reference density in kg/m³. Reference tables: https://mlc.org.uk/guides/metal-density-chart and https://calibr.pro/tables/density-of-materials-chart/. Confirm the exact grade and supplier certificate.",preferredVendorId:vendorId,ratePerUnit:rate,notes:"Created from "+scope+" material procurement; density reference is typical only, supplier certificate takes priority.",densityKgM3:density,densityUnit:"kg/m3",materialType:newMaterialType.trim()||materialName,priceUnit,createdAt:stamp,updatedAt:stamp};
    }
    const nextMaterials=materialRecord?[materialRecord,...data.materials.filter(row=>row.id!==materialRecord!.id)]:data.materials;
    const existingPart=parts.find(row=>row.id===partId);
    const part:ComponentPartRecord|undefined=target==="part"?{
      id:existingPart?.id||partId||makeId("component-part"),companyId,componentId,partNumber:partNumber.trim(),name:partName.trim(),revision:existingPart?.revision||"",drawingReference:existingPart?.drawingReference||"",
      shapeType:existingPart?.shapeType||shape,
      dimensions:existingPart&&Object.keys(existingPart.dimensions||{}).length?existingPart.dimensions:Object.fromEntries(Object.entries(dimensions).map(([key,value])=>[key,Number(value)||0])),
      dimensionUnits:existingPart&&Object.keys(existingPart.dimensionUnits||{}).length?existingPart.dimensionUnits:dimensionUnits,
      vendorIds:[...new Set([...(existingPart?.vendorIds||[]),...(vendorId?[vendorId]:[])])],materialId:existingPart?.materialId||materialRecord?.id||"",notes:existingPart?.notes||notes.trim(),createdAt:existingPart?.createdAt||stamp,updatedAt:stamp
    }:undefined;
    const entry:MaterialCostEntryRecord={
      id:editingEntryId||makeId("material-cost"),scope,companyId,poId:effectivePoLine?.po.id||poId,poLineId:effectivePoLineId,componentId,anchorOperationId:anchorOperationId||undefined,partId:part?.id||effectivePoLine?.line.partId||partId||"",partNumber:part?.partNumber||"",partName:part?.name||(componentName||componentNumber||"Component-level"),materialId:materialRecord?.id||"",materialName,materialGrade,densityKgM3:density,
      shapeType:shape,dimensions:Object.fromEntries(Object.entries(dimensions).map(([key,value])=>[key,Number(value)||0])),dimensionUnits:{...dimensionUnits},quantity:qty,weightPerPieceKg:perPieceKg,totalWeightKg:totalWeightKg,priceUnit,materialRate:rate,materialCost,
      cuttingType:cuttingType==="Other"?customCuttingType.trim()||"Other":cuttingType,cuttingBasis,cuttingRate:cutRate,cutsPerPiece:Number(cutsPerPiece)||1,cuttingHours:Number(cuttingHours)||0,cuttingCost,wastagePercent:wastage,
      vendorId,givenDate,deliveryDate,actualDeliveryDate,poReference:"",notes:notes.trim(),currency:"INR",transportVendorId,transportFrom:transportFrom.trim(),transportTo:transportTo.trim(),transportVehicleType:transportVehicleType.trim(),transportCost:Math.max(0,Number(transportCost)||0),transportPickupAt,transportDeliveryAt,transportStatus,createdAt:stamp,updatedAt:stamp
    };
    update(current=>{
      const nextPurchaseOrders=part&&effectivePoLineId
        ? current.purchaseOrders.map(order=>order.id!==effectivePoLine!.po.id?order:{
            ...order,
            updatedAt:stamp,
            lines:order.lines.map(line=>line.id!==effectivePoLineId?line:{...line,allocationLevel:"part" as const,partId:part.id})
          })
        : current.purchaseOrders;
      return {
        ...current,
        materials:newMaterialOpen?[materialRecord!,...current.materials.filter(row=>row.id!==materialRecord!.id)]:current.materials,
        componentParts:part?[part,...(current.componentParts||[]).filter(row=>row.id!==part.id)]:current.componentParts||[],
        purchaseOrders:nextPurchaseOrders,
        materialCostEntries:[entry,...(current.materialCostEntries||[]).filter(row=>row.id!==entry.id)]
      };
    });
    reset();
    onNotice?.((scope==="process-map"?"Process Map":"Component Planned Cost")+" material entry saved: "+money(materialCost)+" material + "+money(cuttingCost)+" cutting + "+money(Math.max(0,Number(transportCost)||0))+" transport.");
  };
  const archive=(entry:MaterialCostEntryRecord)=>{
    if(!window.confirm("Delete this material procurement allocation? Its audit record will be retained as archived."))return;
    const stamp=nowIso();
    update(current=>({...current,materialCostEntries:(current.materialCostEntries||[]).map(row=>row.id===entry.id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
  };
  const partValue=target==="component"?"__component__":newPartMode?"__new__":partId;
  const shapeOptions=SHAPES.map(item=>({id:item.id,label:item.label}));
  const materialOptions=materials.map(item=>({id:item.id,label:item.code+" · "+item.name+" · "+item.grade+" · "+(item.materialType||"Material")+" · "+(item.shapeType||"Any shape")+(item.densityKgM3?" · "+Number(item.densityUnit==="g/cm3"?item.densityKgM3*1000:item.densityKgM3).toLocaleString("en-IN")+" kg/m³":" · density required")}));
  const densityDisplay=newMaterialOpen?Math.max(0,Number(newDensity)||0)*(densityUnit==="g/cm3"?1000:1):densityKgM3(chosenMaterial);
  const form=(
    <section className="surface-panel ax-material-cost-panel">
      <div className="panel-heading"><div><h3>{scope==="process-map"?"Material Procurement · First Route Stage":"Material, part & cutting cost"}</h3><p>Shared Material Directory · multiple material / shape / part allocations per component, each with quantity, supplier, given date, promised delivery and actual receipt</p></div><span className="module-number">{parts.length} SAVED PARTS</span></div>
      {formError&&<div className="ax-material-form-error" role="alert">{formError}</div>}
      {defaultNewPart&&!initialPartId&&<div className="ax-material-part-guidance"><strong>New part allocation is selected.</strong> Enter the part number and part name below. Choose an existing part or “Component only — no parts” from Allocation level when that is what you intend.</div>}
      <div className="module-record-form">
        <label>Allocation level<select value={partValue} onChange={event=>{if(event.target.value==="__component__"){setTarget("component");setNewPartMode(false);setPartId("");setPartName("");setPartNumber("");}else if(event.target.value==="__new__"){setTarget("part");setNewPartMode(true);setPartId("");setPartName("");setPartNumber("");setShape("plate");setDimensions({});setDimensionUnits({});setMaterialId("");}else{setTarget("part");selectPart(event.target.value);}}}><option value="__component__">Component only — no parts</option>{parts.map(part=><option key={part.id} value={part.id}>{part.partNumber?part.partNumber+" · ":""}{part.name}</option>)}<option value="__new__">＋ Add a new part under this component</option></select></label>
        {partValue==="__new__"&&<div className="module-form-wide"><strong>New part details</strong></div>}
        {target==="part"&&<><label>Part number<input value={partNumber} onChange={e=>setPartNumber(e.target.value)} placeholder="Part number / drawing number"/></label><label>Part name *<input value={partName} onChange={e=>setPartName(e.target.value)} placeholder="Rib, bracket, staple, plate…"/></label></>}
        <label className="module-form-wide">Procurement timing<select value={anchorOperationId} onChange={e=>setAnchorOperationId(e.target.value)}><option value="">Before first manufacturing process · Route start</option>{processOptions.slice().sort((a,b)=>a.sequence-b.sequence).map(operation=><option key={operation.id} value={operation.id}>After OP-{String(operation.sequence).padStart(3,"0")} · {operation.name}{operation.branch&&operation.branch!=="Main route"?" · "+operation.branch:""}</option>)}</select><small>Use this when the material is purchased later in the route. It stays linked to the selected process step.</small></label>
        <SearchablePicker id={"material-po-line-"+scope+"-"+componentId} label={requirePoLine?"PO line allocation *":"PO line allocation (optional)"} value={selectedPoLineId} placeholder={requirePoLine?"Select exact PO component line / part…":"Component-level or choose a part PO line…"} options={[...(requirePoLine?[]:[{id:"__component__",label:"Component-level — no part allocation"}]),...relatedPoLines.map(item=>({id:item.line.id,label:item.po.number+" · "+(item.part?(item.part.partNumber?item.part.partNumber+" · ":"")+item.part.name:"Component-level / add part")+" · Qty "+item.line.quantity}))]} onChange={id=>{if(id==="__component__"){setSelectedPoLineId("");setTarget("component");setNewPartMode(false);setPartId("");setPartName("");setPartNumber("");return;}setSelectedPoLineId(id);const selected=relatedPoLines.find(item=>item.line.id===id);if(selected?.line.partId){setTarget("part");selectPart(selected.line.partId);}else if(id){setTarget("component");setNewPartMode(false);setPartId("");setPartName("");setPartNumber("");}}}/>
        <SearchablePicker id={"material-shape-"+scope+"-"+componentId} label="Shape type *" value={shape} placeholder="Search shape / profile…" options={shapeOptions} onChange={setShape}/>
        <div className="module-form-wide ax-material-dimensions"><strong>Dimensions — choose a unit for each dimension</strong><div className="module-record-form">{chosenShape.fields.map(field=><div className="ax-material-dimension" key={field.key}><label>{field.label}{field.unit?" ("+field.unit+")":" *"}<input type="number" min="0" step="any" value={dimensions[field.key]||""} onChange={e=>setDimensions(current=>({...current,[field.key]:e.target.value}))}/></label>{!field.unit&&<select aria-label={field.label+" unit"} value={dimensionUnits[field.key]||"mm"} onChange={e=>setDimensionUnits(current=>({...current,[field.key]:e.target.value}))}>{UNITS.map(unit=><option key={unit}>{unit}</option>)}</select>}</div>)}</div></div>
        <div className="module-form-wide ax-material-picker"><SearchablePicker id={"material-grade-"+scope+"-"+componentId} label="Material / grade *" value={materialId} placeholder="Search material name, grade or code…" options={materialOptions} onChange={id=>{setMaterialId(id);setNewMaterialOpen(false);const item=materials.find(row=>row.id===id);if(item){setMaterialRate(String(item.ratePerUnit||""));setPriceUnit(item.priceUnit||"kg");if(item.preferredVendorId)setVendorId(item.preferredVendorId);}}}/><button type="button" className="button-quiet compact-button" onClick={()=>{setNewMaterialOpen(value=>!value);setMaterialId("");}}><Plus size={13}/> Add material / grade</button></div>
        {newMaterialOpen&&<div className="module-form-wide surface-panel ax-material-new-grade"><div className="module-record-form"><label>Material name *<input value={newMaterialName} onChange={e=>setNewMaterialName(e.target.value)} placeholder="MS, brass, copper, aluminium…"/></label><label>Material type *<input list={"ax-material-types-"+scope+"-"+componentId} value={newMaterialType} onChange={e=>setNewMaterialType(e.target.value)} placeholder="Steel, stainless, aluminium, plastic…"/><datalist id={"ax-material-types-"+scope+"-"+componentId}>{[...new Set([...materials.map(item=>item.materialType||""),"Steel","Stainless steel","Aluminium","Copper","Brass","Bronze","Cast iron","Titanium","Nickel alloy","Magnesium","Plastic","Ceramic"])].filter(Boolean).map(type=><option key={type} value={type}/>)}</datalist></label><label>Grade *<input list={"ax-material-grades-"+scope+"-"+componentId} value={newMaterialGrade} onChange={e=>{const typed=e.target.value;const q=typed.trim().toLowerCase();const saved=q.length>=2?materials.find(item=>item.grade.trim().toLowerCase()===q):undefined;const common=q.length>=2?MATERIAL_SEEDS.find(item=>item.grade.trim().toLowerCase()===q):undefined;const match=saved||common;if(match){setNewMaterialGrade(match.grade);setNewMaterialName(match.name);setNewMaterialType(saved?.materialType||("type" in match?match.type:match.name));setNewDensity(String(saved?.densityKgM3?(saved.densityUnit==="g/cm3"?saved.densityKgM3*1000:saved.densityKgM3):("density" in match?match.density:0)));setDensityUnit("kg/m3");if(saved){setMaterialRate(String(saved.ratePerUnit||""));setPriceUnit(saved.priceUnit||"kg");if(saved.preferredVendorId)setVendorId(saved.preferredVendorId);}}else setNewMaterialGrade(typed);}} placeholder="Type to search saved / common grades…"/><datalist id={"ax-material-grades-"+scope+"-"+componentId}>{MATERIAL_SEEDS.map(item=><option key={item.grade} value={item.grade}>{item.name}</option>)}{materials.map(item=><option key={item.id} value={item.grade}>{item.name} · {item.materialType}</option>)}</datalist></label><label>Material code<input value={newMaterialCode} onChange={e=>setNewMaterialCode(e.target.value)} placeholder="Optional stock code"/></label><label>Density (kg/m³) *<input type="number" min="0" step="any" value={newDensity} onChange={e=>{setNewDensity(e.target.value);setDensityUnit("kg/m3");}} placeholder="Auto-fill from known grade"/></label></div></div>}
        <div className="module-form-wide ax-material-density"><span>Selected density</span><strong>{densityDisplay>0?densityDisplay.toLocaleString("en-IN")+" kg/m³":"Density not set"}</strong><small>Density is stored per grade. Values are editable; grade variations must use the supplier / material certificate value.</small></div>
        <label>Quantity (pieces) *<input type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
        <label>Material rate<input type="number" min="0" step="any" value={materialRate} onChange={e=>setMaterialRate(e.target.value)} placeholder="Enter 70, 80, etc."/></label>
        <label>Rate unit<select value={priceUnit} onChange={e=>setPriceUnit(e.target.value as "kg"|"lb")}><option value="kg">₹ per kg</option><option value="lb">₹ per lb</option></select></label>
        <div className="module-form-wide ax-material-calculation"><div><span>Volume / piece</span><strong>{(volumeMm3/1_000_000_000).toFixed(6)} m³</strong></div><div><span>Weight / piece</span><strong>{perPieceKg.toFixed(3)} kg</strong></div><div><span>Total weight</span><strong>{totalWeightKg.toFixed(3)} kg · {(totalWeightKg*kgToLb).toFixed(3)} lb</strong></div><div><span>Material cost</span><strong>{money(materialCost)}</strong></div></div>
        <div className="module-form-wide ax-cutting-cost-box"><div className="panel-heading"><div><h4><Scissors size={15}/> Cutting charge — separate from material</h4><p>Choose a cutting method and its own pricing basis. No cutting fee is assumed when left blank.</p></div></div><div className="module-record-form"><label>Cutting type<select value={cuttingType} onChange={e=>setCuttingType(e.target.value)}><option value="">No cutting charge</option>{CUT_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>{cuttingType==="Other"&&<label>Other cutting type<input value={customCuttingType} onChange={e=>setCustomCuttingType(e.target.value)}/></label>}<label>Charge basis<select value={cuttingBasis} onChange={e=>setCuttingBasis(e.target.value)}>{CUT_BASES.map(basis=><option key={basis}>{basis}</option>)}</select></label><label>Cut rate (₹)<input type="number" min="0" step="any" value={cuttingRate} onChange={e=>setCuttingRate(e.target.value)} placeholder="e.g. 59"/></label>{cuttingBasis==="Per cut"&&<label>Cuts per piece<input type="number" min="1" step="1" value={cutsPerPiece} onChange={e=>setCutsPerPiece(e.target.value)}/></label>}{cuttingBasis==="Per hour"&&<label>Hours<input type="number" min="0" step="any" value={cuttingHours} onChange={e=>setCuttingHours(e.target.value)}/></label>}<div className="module-form-wide ax-material-calculation"><div><span>Cutting cost</span><strong>{money(cuttingCost)}</strong></div><div><span>Material + cutting total</span><strong>{money(totalCost)}</strong></div></div></div></div>
        <SearchablePicker id={"material-vendor-"+scope+"-"+componentId} label="Supplier / material vendor (optional until assigned)" value={vendorId} placeholder="Search supplier…" options={vendors.map(vendor=>({id:vendor.id,label:vendor.company+" · "+vendor.contact}))} onChange={setVendorId}/>
        <label>Material given date/time<input type="datetime-local" value={givenDate} onChange={e=>setGivenDate(e.target.value)}/></label>
        <label>Expected material delivery date/time<input type="datetime-local" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></label>
        <label>Actual material receipt date/time<input type="datetime-local" value={actualDeliveryDate} onChange={e=>setActualDeliveryDate(e.target.value)}/></label>
        <div className="module-form-wide ax-material-transport">
          <div className="panel-heading"><div><h4><Truck size={15}/> Material inbound transport</h4><p>Assign transport directly to this material entry. Transport cost remains separate from material and cutting cost.</p></div></div>
          <div className="module-record-form">
            <SearchablePicker id={"material-transport-vendor-"+scope+"-"+componentId} label="Transport vendor / carrier" value={transportVendorId} placeholder="Select transporter (optional)…" options={vendors.map(vendor=>({id:vendor.id,label:vendor.company+" · "+vendor.contact}))} onChange={setTransportVendorId}/>
            <label>Pickup location<input value={transportFrom} onChange={e=>setTransportFrom(e.target.value)} placeholder="Supplier / pickup address"/></label>
            <label>Delivery location<input value={transportTo} onChange={e=>setTransportTo(e.target.value)} placeholder="Factory / destination"/></label>
            <label>Vehicle type<input value={transportVehicleType} onChange={e=>setTransportVehicleType(e.target.value)} placeholder="Truck, tempo, trailer…"/></label>
            <label>Transport cost (₹)<input type="number" min="0" step="any" value={transportCost} onChange={e=>setTransportCost(e.target.value)} placeholder="Separate transport charge"/></label>
            <label>Pickup date/time<input type="datetime-local" value={transportPickupAt} onChange={e=>setTransportPickupAt(e.target.value)}/></label>
            <label>Transport delivery date/time<input type="datetime-local" value={transportDeliveryAt} onChange={e=>setTransportDeliveryAt(e.target.value)}/></label>
            <label>Transport status<select value={transportStatus} onChange={e=>setTransportStatus(e.target.value as "Planned"|"Queued"|"Running"|"Complete"|"Delayed")}><option>Planned</option><option>Queued</option><option>Running</option><option>Complete</option><option>Delayed</option></select></label>
          </div>
        </div>
        <label className="module-form-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Supplier quote, cutting instructions, material certificate…"/></label>
        <div className="module-form-actions"><button type="button" className="button-primary" onClick={save}><Check size={14}/> {editingEntryId?"Update material allocation":"Save & Add Another Material"}</button><button type="button" className="button-quiet" onClick={reset}>Reset form</button></div>
      </div>
    </section>
  );
  return <section className="ax-material-costing-workspace">
    <button type="button" className="button-primary compact-button" onClick={()=>{reset();setExpanded(true);}}><Plus size={13}/> Add another material / shape allocation</button>
    <button type="button" className="button-quiet compact-button ax-material-cost-toggle" onClick={()=>setExpanded(value=>!value)}><ChevronDown size={14} style={{transform:expanded?"rotate(180deg)":"none"}}/> {scope==="process-map"?"Material / parts / vendor cost":"Planned material / parts / vendor cost"} <span>{entries.length} saved entries</span></button>
    {expanded&&form}
    {entries.length>0&&<section className="surface-panel ax-material-cost-list"><div className="panel-heading"><div><h3>{scope==="process-map"?"Process Map material cost records":"Planned material cost records"}</h3><p>These records are stored separately from process operation cost rows and from the other costing mode.</p></div></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Part / level</th><th>Shape / material</th><th>Qty</th><th>Total weight</th><th>Supplier / dates</th><th>Material cost</th><th>Material transport route</th><th>Transport cost</th><th>Cutting method / cost</th><th>Total incl. transport</th><th></th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id}><td><strong>{entry.partNumber||componentNumber||"Component"}</strong><small>{entry.partName}</small></td><td>{entry.shapeType}<small>{entry.materialName} · {entry.materialGrade}</small><small>{Object.entries(entry.dimensions||{}).filter(([,value])=>Number(value)>0).map(([key,value])=>key.replace(/[A-Z]/g," <td>{entry.shapeType}<small>{entry.materialName} · {entry.materialGrade}</small></td>")+" "+value+" "+(entry.dimensionUnits?.[key]||"mm")).join(" · ")||"Dimensions not entered"}</small></td><td>{entry.quantity}</td><td>{entry.totalWeightKg.toFixed(3)} kg</td><td>{vendors.find(v=>v.id===entry.vendorId)?.company||"Not assigned"}<small>Given: {entry.givenDate||"—"} · Due: {entry.deliveryDate||"—"} · Received: {entry.actualDeliveryDate||"—"}</small></td><td>{money(entry.materialCost)}<small>{money(entry.materialRate)} / {entry.priceUnit}</small></td><td><div className="ax-material-route-line"><span>{entry.transportFrom||vendors.find(v=>v.id===entry.vendorId)?.address||"Supplier pickup"}</span><b>→</b><span>{vendors.find(v=>v.id===entry.transportVendorId)?.company||"Transporter not assigned"}</span><b>→</b><span>{entry.transportTo||"Destination not set"}</span></div><small>{entry.transportVehicleType||"Vehicle not set"} · Pickup {entry.transportPickupAt||"—"} → Delivery {entry.transportDeliveryAt||"—"} · {entry.transportStatus||"Planned"}</small></td><td>{money(entry.transportCost||0)}</td><td>{entry.cuttingType||"No cutting"}<small>{money(entry.cuttingCost)} · {entry.cuttingBasis}</small></td><td><strong>{money(entry.materialCost+entry.cuttingCost+(entry.transportCost||0))}</strong></td><td><button type="button" className="button-quiet compact-button" onClick={()=>editEntry(entry)}>Edit</button> <button type="button" className="button-quiet compact-button" onClick={()=>archive(entry)}><Trash2 size={12}/> Delete</button></td></tr>)}</tbody></table></div></section>}
  </section>;
}
