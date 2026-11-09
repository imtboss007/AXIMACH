import { useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Scissors, Trash2, X } from "lucide-react";
import { activeRows, makeId, nowIso, useManufacturingData, type ComponentPartRecord, type MaterialCostEntryRecord, type MaterialRecord } from "./manufacturingData";
import SearchablePicker from "./SearchablePicker";

type Scope = "process-map" | "planned-cost";
type Props = { scope: Scope; companyId?: string; poId?: string; poLineId?: string; componentId: string; componentName?: string; componentNumber?: string; onNotice?: (value: string) => void };
type DimensionKey = "length" | "width" | "thickness" | "diameter" | "outerDiameter" | "innerDiameter" | "wallThickness" | "outerWidth" | "outerHeight" | "height" | "legA" | "legB" | "flangeWidth" | "flangeThickness" | "webThickness" | "acrossFlats" | "crossSectionArea";
type Shape = { id: string; label: string; fields: Array<{ key: DimensionKey; label: string; unit?: string }> };
const SHAPES: Shape[] = [
  { id: "plate", label: "Sheet / plate", fields: [{key:"length",label:"Length"},{key:"width",label:"Width"},{key:"thickness",label:"Thickness"}] },
  { id: "flat-bar", label: "Flat bar", fields: [{key:"length",label:"Length"},{key:"width",label:"Width"},{key:"thickness",label:"Thickness"}] },
  { id: "round-bar", label: "Round bar / rod", fields: [{key:"length",label:"Length"},{key:"diameter",label:"Diameter"}] },
  { id: "square-bar", label: "Square bar", fields: [{key:"length",label:"Length"},{key:"width",label:"Side width"}] },
  { id: "hex-bar", label: "Hexagonal bar", fields: [{key:"length",label:"Length"},{key:"acrossFlats",label:"Across flats"}] },
  { id: "round-tube", label: "Round tube / pipe", fields: [{key:"length",label:"Length"},{key:"outerDiameter",label:"Outer diameter"},{key:"wallThickness",label:"Wall thickness"}] },
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
  {name:"Carbon steel",grade:"EN8",density:7850,type:"Steel"},
  {name:"Alloy steel",grade:"EN36",density:7850,type:"Steel"},
  {name:"Stainless steel",grade:"SS 304",density:8000,type:"Stainless steel"},
  {name:"Stainless steel",grade:"SS 316",density:8000,type:"Stainless steel"},
  {name:"Aluminium",grade:"Aluminium 6061",density:2700,type:"Aluminium"},
  {name:"Aluminium",grade:"Aluminium 6063",density:2700,type:"Aluminium"},
  {name:"Copper",grade:"Electrolytic copper",density:8960,type:"Copper"},
  {name:"Brass",grade:"Common brass",density:8500,type:"Brass"},
  {name:"Bronze",grade:"Tin bronze",density:8800,type:"Bronze"},
  {name:"Cast iron",grade:"Grey cast iron",density:7200,type:"Cast iron"},
  {name:"Zinc",grade:"Zinc",density:7140,type:"Non-ferrous"},
  {name:"Titanium",grade:"Titanium Grade 2",density:4510,type:"Titanium"}
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
  if(shape==="round-tube") { const od=d("outerDiameter"), id=Math.max(0,od-2*wall); return Math.PI*(od*od-id*id)*L/4; }
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
function suggestedDensity(name:string,grade:string) {
  const row=MATERIAL_SEEDS.find(item=>(item.name+" "+item.grade).toLowerCase()===(name+" "+grade).toLowerCase())
    || MATERIAL_SEEDS.find(item=>item.grade.toLowerCase()===grade.toLowerCase())
    || MATERIAL_SEEDS.find(item=>item.name.toLowerCase()===name.toLowerCase());
  return row?.density||0;
}
export default function PartMaterialCostingPanel({scope,companyId="",poId="",poLineId="",componentId,componentName="",componentNumber="",onNotice}:Props) {
  const {data,update}=useManufacturingData();
  const materials=activeRows(data.materials);
  const vendors=activeRows(data.vendors);
  const parts=activeRows(data.componentParts||[]).filter(part=>part.componentId===componentId);
  const entries=activeRows(data.materialCostEntries||[]).filter(entry=>entry.scope===scope&&entry.componentId===componentId&&(!poId||entry.poId===poId)&&(!poLineId||entry.poLineId===poLineId));
  const [expanded,setExpanded]=useState(false);
  const [target,setTarget]=useState<"component"|"part">("component");
  const [partId,setPartId]=useState("");
  const [partName,setPartName]=useState("");
  const [partNumber,setPartNumber]=useState("");
  const [shape,setShape]=useState("plate");
  const [dimensions,setDimensions]=useState<Record<string,string>>({});
  const [dimensionUnits,setDimensionUnits]=useState<Record<string,string>>({});
  const [materialId,setMaterialId]=useState("");
  const [newMaterialOpen,setNewMaterialOpen]=useState(false);
  const [newMaterialName,setNewMaterialName]=useState("");
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
  const [cuttingType,setCuttingType]=useState("");
  const [customCuttingType,setCustomCuttingType]=useState("");
  const [cuttingBasis,setCuttingBasis]=useState("Per piece");
  const [cuttingRate,setCuttingRate]=useState("");
  const [cutsPerPiece,setCutsPerPiece]=useState("1");
  const [cuttingHours,setCuttingHours]=useState("0");
  const [wastagePercent,setWastagePercent]=useState("0");
  const [notes,setNotes]=useState("");
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
  const cuttingCost=cuttingBasis==="Per piece"?cutRate*qty:cuttingBasis==="Per cut"?cutRate*qty*Math.max(1,Number(cutsPerPiece)||1):cuttingBasis==="Per kg"?cutRate*totalWeightKg:cuttingBasis==="Per metre"?cutRate*lengthM*qty:cuttingBasis==="Per hour"?cutRate*Math.max(0,Number(cuttingHours)||0):cutRate;
  const totalCost=materialCost+cuttingCost;
  const reset=()=>{setTarget("component");setPartId("");setPartName("");setPartNumber("");setShape("plate");setDimensions({});setDimensionUnits({});setMaterialId("");setNewMaterialOpen(false);setNewMaterialName("");setNewMaterialGrade("");setNewMaterialCode("");setNewDensity("");setMaterialRate("");setPriceUnit("kg");setQuantity("1");setVendorId("");setGivenDate("");setDeliveryDate("");setActualDeliveryDate("");setCuttingType("");setCustomCuttingType("");setCuttingBasis("Per piece");setCuttingRate("");setCutsPerPiece("1");setCuttingHours("0");setWastagePercent("0");setNotes("");};
  const selectPart=(id:string)=>{const part=parts.find(item=>item.id===id);setPartId(id);setPartName(part?.name||"");setPartNumber(part?.partNumber||"");setShape(part?.shapeType||"plate");setDimensions(part?.dimensions||{});setDimensionUnits(part?.dimensionUnits||{});setMaterialId(part?.materialId||"");};
  const save=()=>{
    const material=chosenMaterial;
    const materialName=newMaterialOpen?newMaterialName.trim():material?.name||"";
    const materialGrade=newMaterialOpen?newMaterialGrade.trim():material?.grade||"";
    const density= newMaterialOpen ? Math.max(0,Number(newDensity)||0)*(densityUnit==="g/cm3"?1000:1) : densityKgM3(material);
    if(!componentId){onNotice?.("Select a component before saving material costing.");return;}
    if(target==="part"&&!partName.trim()){onNotice?.("Enter a part name or select an existing part.");return;}
    if(!newMaterialOpen&&!material){onNotice?.("Select a material grade from Material Directory or add a new grade.");return;}
    if(newMaterialOpen&&(!materialName||!materialGrade||density<=0)){onNotice?.("Enter material name, grade and a positive density value.");return;}
    if(!Number.isFinite(qty)||qty<=0){onNotice?.("Enter a valid part quantity.");return;}
    if(volumeMm3<=0||perPieceKg<=0){onNotice?.("Enter valid dimensions for the selected shape and material density.");return;}
    if(!Number.isFinite(rate)||rate<0){onNotice?.("Enter a valid material rate per kg or lb.");return;}
    const stamp=nowIso();
    let materialRecord=material;
    if(newMaterialOpen){
      materialRecord={id:makeId("material"),code:newMaterialCode.trim()||makeId("MAT").toUpperCase(),name:materialName,grade:materialGrade,unit:"kg",specification:"Density-based material costing master",preferredVendorId:vendorId,ratePerUnit:rate,notes:"Created from "+scope+" material calculator",densityKgM3:density,densityUnit:"kg/m3",materialType:materialName,priceUnit,createdAt:stamp,updatedAt:stamp};
    }
    const nextMaterials=materialRecord?[materialRecord,...data.materials.filter(row=>row.id!==materialRecord!.id)]:data.materials;
    const part:ComponentPartRecord|undefined=target==="part"?{
      id:partId||makeId("component-part"),companyId,componentId,partNumber:partNumber.trim(),name:partName.trim(),revision:"",drawingReference:"",shapeType:shape,dimensions:Object.fromEntries(Object.entries(dimensions).map(([key,value])=>[key,Number(value)||0])),dimensionUnits,vendorIds:vendorId?[vendorId]:[],materialId:materialRecord?.id||"",notes:notes.trim(),createdAt:parts.find(row=>row.id===partId)?.createdAt||stamp,updatedAt:stamp
    }:undefined;
    const entry:MaterialCostEntryRecord={
      id:makeId("material-cost"),scope,companyId,poId,poLineId,componentId,partId:part?.id||partId||"",partNumber:part?.partNumber||"",partName:part?.name||(componentName||componentNumber||"Component-level"),materialId:materialRecord?.id||"",materialName,materialGrade,densityKgM3:density,
      shapeType:shape,dimensions:Object.fromEntries(Object.entries(dimensions).map(([key,value])=>[key,Number(value)||0])),dimensionUnits:{...dimensionUnits},quantity:qty,weightPerPieceKg:perPieceKg,totalWeightKg:totalWeightKg,priceUnit,materialRate:rate,materialCost,
      cuttingType:cuttingType==="Other"?customCuttingType.trim()||"Other":cuttingType,cuttingBasis,cuttingRate:cutRate,cutsPerPiece:Number(cutsPerPiece)||1,cuttingHours:Number(cuttingHours)||0,cuttingCost,wastagePercent:wastage,
      vendorId,givenDate,deliveryDate,actualDeliveryDate,poReference:"",notes:notes.trim(),currency:"INR",createdAt:stamp,updatedAt:stamp
    };
    update(current=>({
      ...current,
      materials:newMaterialOpen?[materialRecord!,...current.materials.filter(row=>row.id!==materialRecord!.id)]:current.materials,
      componentParts:part?[part,...(current.componentParts||[]).filter(row=>row.id!==part.id)]:current.componentParts||[],
      materialCostEntries:[entry,...(current.materialCostEntries||[]).filter(row=>row.id!==entry.id)]
    }));
    reset();
    onNotice?.((scope==="process-map"?"Process Map":"Component Planned Cost")+" material entry saved: "+money(materialCost)+" material + "+money(cuttingCost)+" cutting = "+money(totalCost)+".");
  };
  const archive=(entry:MaterialCostEntryRecord)=>{
    const stamp=nowIso();
    update(current=>({...current,materialCostEntries:(current.materialCostEntries||[]).map(row=>row.id===entry.id?{...row,deletedAt:stamp,updatedAt:stamp}:row)}));
  };
  const partOptions=[{id:"__component__",label:"Component-level (no part breakdown)"},...parts.map(part=>({id:part.id,label:(part.partNumber?part.partNumber+" · ":"")+part.name}))];
  const partValue=target==="component"?"__component__":partId;
  const currentVendor=vendors.find(row=>row.id===vendorId);
  const shapeOptions=SHAPES.map(item=>({id:item.id,label:item.label}));
  const materialOptions=materials.map(item=>({id:item.id,label:item.code+" · "+item.name+" · "+item.grade+(item.densityKgM3?" · "+Number(item.densityKgM3).toLocaleString("en-IN")+" kg/m³":" · density required")}));
  const densityDisplay=newMaterialOpen?Math.max(0,Number(newDensity)||0)*(densityUnit==="g/cm3"?1000:1):densityKgM3(chosenMaterial);
  const form=(
    <section className="surface-panel ax-material-cost-panel">
      <div className="panel-heading"><div><h3>Material, part & cutting cost</h3><p>Shared Material Directory · independent {scope==="process-map"?"Process Map material cost":"Component Planned Cost material budget"} record</p></div><span className="module-number">{parts.length} SAVED PARTS</span></div>
      <div className="module-record-form">
        <label>Allocation level<select value={partValue} onChange={event=>{if(event.target.value==="__component__"){setTarget("component");setPartId("");setPartName("");setPartNumber("");}else{setTarget("part");selectPart(event.target.value);}}}><option value="__component__">Component only — no parts</option>{parts.map(part=><option key={part.id} value={part.id}>{part.partNumber?part.partNumber+" · ":""}{part.name}</option>)}<option value="__new__">＋ Add a new part under this component</option></select></label>
        {partValue==="__new__"&&<div className="module-form-wide"><strong>New part details</strong></div>}
        {target==="part"&&<><label>Part number<input value={partNumber} onChange={e=>setPartNumber(e.target.value)} placeholder="Part number / drawing number"/></label><label>Part name *<input value={partName} onChange={e=>setPartName(e.target.value)} placeholder="Rib, bracket, staple, plate…"/></label></>}
        <SearchablePicker id={"material-shape-"+scope+"-"+componentId} label="Shape type *" value={shape} placeholder="Search shape / profile…" options={shapeOptions} onChange={setShape}/>
        <div className="module-form-wide ax-material-dimensions"><strong>Dimensions — choose a unit for each dimension</strong><div className="module-record-form">{chosenShape.fields.map(field=><div className="ax-material-dimension" key={field.key}><label>{field.label}{field.unit?" ("+field.unit+")":" *"}<input type="number" min="0" step="any" value={dimensions[field.key]||""} onChange={e=>setDimensions(current=>({...current,[field.key]:e.target.value}))}/></label>{!field.unit&&<select aria-label={field.label+" unit"} value={dimensionUnits[field.key]||"mm"} onChange={e=>setDimensionUnits(current=>({...current,[field.key]:e.target.value}))}>{UNITS.map(unit=><option key={unit}>{unit}</option>)}</select>}</div>)}</div></div>
        <div className="module-form-wide ax-material-picker"><SearchablePicker id={"material-grade-"+scope+"-"+componentId} label="Material / grade *" value={materialId} placeholder="Search material name, grade or code…" options={materialOptions} onChange={id=>{setMaterialId(id);setNewMaterialOpen(false);const item=materials.find(row=>row.id===id);if(item)setMaterialRate(String(item.ratePerUnit||""));}}/><button type="button" className="button-quiet compact-button" onClick={()=>{setNewMaterialOpen(value=>!value);setMaterialId("");}}><Plus size={13}/> Add material / grade</button></div>
        {newMaterialOpen&&<div className="module-form-wide surface-panel ax-material-new-grade"><div className="module-record-form"><label>Material name *<input value={newMaterialName} onChange={e=>setNewMaterialName(e.target.value)} placeholder="MS, brass, copper, aluminium…"/></label><label>Grade *<input value={newMaterialGrade} onChange={e=>setNewMaterialGrade(e.target.value)} placeholder="EN8, EN36, SS304, 6061…"/></label><label>Material code<input value={newMaterialCode} onChange={e=>setNewMaterialCode(e.target.value)} placeholder="Optional stock code"/></label><label>Density *<input type="number" min="0" step="any" value={newDensity} onChange={e=>setNewDensity(e.target.value)} placeholder="e.g. 7850"/></label><label>Density unit<select value={densityUnit} onChange={e=>setDensityUnit(e.target.value as "kg/m3"|"g/cm3")}><option value="kg/m3">kg/m³</option><option value="g/cm3">g/cm³</option></select></label></div></div>}
        <div className="module-form-wide ax-material-density"><span>Selected density</span><strong>{densityDisplay>0?densityDisplay.toLocaleString("en-IN")+" kg/m³":"Density not set"}</strong><small>Density is stored per grade. Values are editable; grade variations must use the supplier / material certificate value.</small></div>
        <label>Quantity (pieces) *<input type="number" min="1" step="1" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label>
        <label>Material rate<input type="number" min="0" step="any" value={materialRate} onChange={e=>setMaterialRate(e.target.value)} placeholder="Enter 70, 80, etc."/></label>
        <label>Rate unit<select value={priceUnit} onChange={e=>setPriceUnit(e.target.value as "kg"|"lb")}><option value="kg">₹ per kg</option><option value="lb">₹ per lb</option></select></label>
        <div className="module-form-wide ax-material-calculation"><div><span>Volume / piece</span><strong>{(volumeMm3/1_000_000_000).toFixed(6)} m³</strong></div><div><span>Weight / piece</span><strong>{perPieceKg.toFixed(3)} kg</strong></div><div><span>Total weight</span><strong>{totalWeightKg.toFixed(3)} kg · {(totalWeightKg*kgToLb).toFixed(3)} lb</strong></div><div><span>Material cost</span><strong>{money(materialCost)}</strong></div></div>
        <div className="module-form-wide ax-cutting-cost-box"><div className="panel-heading"><div><h4><Scissors size={15}/> Cutting charge — separate from material</h4><p>Choose a cutting method and its own pricing basis. No cutting fee is assumed when left blank.</p></div></div><div className="module-record-form"><label>Cutting type<select value={cuttingType} onChange={e=>setCuttingType(e.target.value)}><option value="">No cutting charge</option>{CUT_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>{cuttingType==="Other"&&<label>Other cutting type<input value={customCuttingType} onChange={e=>setCustomCuttingType(e.target.value)}/></label>}<label>Charge basis<select value={cuttingBasis} onChange={e=>setCuttingBasis(e.target.value)}>{CUT_BASES.map(basis=><option key={basis}>{basis}</option>)}</select></label><label>Cut rate (₹)<input type="number" min="0" step="any" value={cuttingRate} onChange={e=>setCuttingRate(e.target.value)} placeholder="e.g. 59"/></label>{cuttingBasis==="Per cut"&&<label>Cuts per piece<input type="number" min="1" step="1" value={cutsPerPiece} onChange={e=>setCutsPerPiece(e.target.value)}/></label>}{cuttingBasis==="Per hour"&&<label>Hours<input type="number" min="0" step="any" value={cuttingHours} onChange={e=>setCuttingHours(e.target.value)}/></label>}<div className="module-form-wide ax-material-calculation"><div><span>Cutting cost</span><strong>{money(cuttingCost)}</strong></div><div><span>Material + cutting total</span><strong>{money(totalCost)}</strong></div></div></div></div>
        <SearchablePicker id={"material-vendor-"+scope+"-"+componentId} label="Vendor for this part / material" value={vendorId} placeholder="Search supplier…" options={vendors.map(vendor=>({id:vendor.id,label:vendor.company+" · "+vendor.contact}))} onChange={setVendorId}/>
        <label>Given date<input type="date" value={givenDate} onChange={e=>setGivenDate(e.target.value)}/></label>
        <label>Expected delivery date<input type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></label>
        <label>Actual delivery date<input type="date" value={actualDeliveryDate} onChange={e=>setActualDeliveryDate(e.target.value)}/></label>
        <label className="module-form-wide">Notes<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Supplier quote, cutting instructions, material certificate…"/></label>
        <div className="module-form-actions"><button type="button" className="button-primary" onClick={save}><Check size={14}/> Save material and cutting cost</button><button type="button" className="button-quiet" onClick={reset}>Clear</button></div>
      </div>
    </section>
  );
  return <section className="ax-material-costing-workspace">
    <button type="button" className="button-quiet compact-button ax-material-cost-toggle" onClick={()=>setExpanded(value=>!value)}><ChevronDown size={14} style={{transform:expanded?"rotate(180deg)":"none"}}/> {scope==="process-map"?"Material / parts / vendor cost":"Planned material / parts / vendor cost"} <span>{entries.length} saved entries</span></button>
    {expanded&&form}
    {entries.length>0&&<section className="surface-panel ax-material-cost-list"><div className="panel-heading"><div><h3>{scope==="process-map"?"Process Map material cost records":"Planned material cost records"}</h3><p>These records are stored separately from process operation cost rows and from the other costing mode.</p></div></div><div className="costing-table-wrap"><table className="costing-table"><thead><tr><th>Part / level</th><th>Shape / material</th><th>Qty</th><th>Total weight</th><th>Vendor / dates</th><th>Material cost</th><th>Cutting method / cost</th><th>Total</th><th></th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id}><td><strong>{entry.partNumber||componentNumber||"Component"}</strong><small>{entry.partName}</small></td><td>{entry.shapeType}<small>{entry.materialName} · {entry.materialGrade}</small></td><td>{entry.quantity}</td><td>{entry.totalWeightKg.toFixed(3)} kg</td><td>{vendors.find(v=>v.id===entry.vendorId)?.company||"Not assigned"}<small>Given: {entry.givenDate||"—"} · Due: {entry.deliveryDate||"—"} · Received: {entry.actualDeliveryDate||"—"}</small></td><td>{money(entry.materialCost)}<small>{money(entry.materialRate)} / {entry.priceUnit}</small></td><td>{entry.cuttingType||"No cutting"}<small>{money(entry.cuttingCost)} · {entry.cuttingBasis}</small></td><td><strong>{money(entry.materialCost+entry.cuttingCost)}</strong></td><td><button type="button" className="button-quiet compact-button" onClick={()=>archive(entry)}><Trash2 size={12}/> Archive</button></td></tr>)}</tbody></table></div></section>}
  </section>;
}
