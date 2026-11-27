/**
 * AXIMACH permanent material master catalogue.
 * Density values are typical room-temperature references in kg/m³, not a replacement
 * for a supplier material certificate or the exact alloy / temper specification.
 */
export const STANDARD_MATERIAL_GRADES = [
  ["Mild steel","MS / low-carbon steel",7850,"Steel"],["Mild steel","IS 2062 E250",7850,"Steel"],["Mild steel","IS 2062 E350",7850,"Steel"],
  ["Carbon steel","EN1A",7850,"Steel"],["Carbon steel","EN8",7850,"Steel"],["Carbon steel","EN9",7850,"Steel"],["Alloy steel","EN19",7850,"Steel"],["Alloy steel","EN24",7850,"Steel"],["Alloy steel","EN36",7850,"Steel"],["Alloy steel","EN31",7850,"Steel"],
  ["Stainless steel","SS 304",7930,"Stainless steel"],["Stainless steel","SS 316",8000,"Stainless steel"],["Stainless steel","SS 410",7750,"Stainless steel"],["Stainless steel","SS 420",7750,"Stainless steel"],
  ["Aluminium","Aluminium 1050",2710,"Aluminium"],["Aluminium","Aluminium 6061",2700,"Aluminium"],["Aluminium","Aluminium 6063",2700,"Aluminium"],["Aluminium","Aluminium 6082",2700,"Aluminium"],["Aluminium","Aluminium 7075",2810,"Aluminium"],
  ["Copper","Copper C11000 / ETP",8960,"Copper"],["Brass","Brass C26000",8530,"Brass"],["Brass","Brass C36000",8500,"Brass"],["Bronze","Tin bronze",8800,"Bronze"],["Cast iron","Grey cast iron",7200,"Cast iron"],["Zinc","Zinc",7140,"Non-ferrous"],["Titanium","Titanium Grade 2",4510,"Titanium"],["Alloy steel","AISI 4140 / EN19",7850,"Steel"],["Alloy steel","AISI 4340 / EN24",7850,"Steel"],["Stainless steel","SS 304L",7930,"Stainless steel"],["Stainless steel","SS 316L",8000,"Stainless steel"],["Stainless steel","Duplex 2205",7850,"Stainless steel"],["Aluminium","Aluminium 5052",2680,"Aluminium"],["Aluminium","Aluminium 5083",2660,"Aluminium"],["Aluminium","Aluminium 2014",2800,"Aluminium"],["Copper","Copper C10100",8890,"Copper"],["Copper alloy","Phosphor bronze",8800,"Bronze"],["Nickel alloy","Inconel 625",8440,"Nickel alloy"],["Nickel alloy","Monel 400",8800,"Nickel alloy"],["Magnesium","Magnesium AZ31B",1770,"Magnesium"],["Engineering plastic","Nylon 6 (PA6)",1140,"Plastic"],["Engineering plastic","Acetal / POM",1410,"Plastic"],["Engineering plastic","HDPE",950,"Plastic"],["Engineering plastic","UHMWPE",940,"Plastic"],["Engineering plastic","PTFE",2200,"Plastic"],["Engineering plastic","PVC rigid",1400,"Plastic"],["Engineering plastic","Polycarbonate",1200,"Plastic"],["Engineering plastic","ABS",1070,"Plastic"],["Engineering plastic","Acrylic / PMMA",1190,"Plastic"],["Engineering plastic","Polypropylene (PP)",900,"Plastic"],["Carbon steel","AISI 1018",7870,"Steel"],["Carbon steel","S355 / IS 2062 E350",7850,"Steel"],["Alloy steel","AISI 4130",7850,"Steel"],["Alloy steel","AISI 52100 / 100Cr6",7810,"Steel"],["Stainless steel","SS 201",7800,"Stainless steel"],["Stainless steel","SS 303",7900,"Stainless steel"],["Stainless steel","SS 430",7700,"Stainless steel"],["Stainless steel","17-4PH",7800,"Stainless steel"],["Aluminium","Aluminium 1100",2710,"Aluminium"],["Aluminium","Aluminium 3003",2730,"Aluminium"],["Aluminium","Aluminium 6061-T6",2700,"Aluminium"],["Aluminium","Aluminium 7075-T6",2810,"Aluminium"],["Copper alloy","Cupronickel 70/30",8960,"Copper alloy"],["Nickel alloy","Hastelloy C276",8410,"Nickel alloy"],["Engineering plastic","Polyetheretherketone (PEEK)",1300,"Plastic"],["Engineering plastic","Polyamide 66 (PA66)",1140,"Plastic"]
] as const;

export const MATERIAL_TYPE_GROUPS = [
  { label:"Ferrous metals", types:["Steel","Carbon steel","Mild steel","Structural steel","Alloy steel","Tool steel","Spring steel","Bearing steel","Stainless steel","Cast iron","Ductile iron"] },
  { label:"Non-ferrous metals", types:["Aluminium","Copper","Copper alloy","Brass","Bronze","Non-ferrous","Nickel alloy","Titanium","Magnesium","Zinc","Lead","Tin"] },
  { label:"Plastics and polymers", types:["Plastic","Engineering plastic","Nylon","Polycarbonate","Acetal / POM","PTFE","PEEK","Polyethylene","Polypropylene"] },
  { label:"Other engineering materials", types:["Ceramic","Composite","CFRP / GFRP","Rubber","Graphite","Wood"] },
  { label:"Manufacturing consumables", types:["Coating / finishing consumable","Paint / powder coating","Cutting fluid / coolant","Lubricant / oil","Adhesive / sealant","Chemical / treatment","Packaging material","Electrical / electronic","Other"] }
] as const;

export const TYPICAL_DENSITY_BY_MATERIAL_TYPE_KG_M3:Record<string,number>={
  "Steel":7850,"Carbon steel":7850,"Mild steel":7850,"Structural steel":7850,"Alloy steel":7850,
  "Tool steel":7800,"Spring steel":7850,"Bearing steel":7810,"Stainless steel":7930,
  "Cast iron":7200,"Ductile iron":7100,"Aluminium":2700,"Copper":8960,"Copper alloy":8800,
  "Brass":8500,"Bronze":8800,"Nickel alloy":8440,"Titanium":4510,"Magnesium":1770,
  "Zinc":7140,"Lead":11340,"Tin":7310,"Nylon":1140,"Engineering plastic":1200,
  "Polycarbonate":1200,"Acetal / POM":1410,"PTFE":2200,"PEEK":1300,
  "Polyethylene":950,"Polypropylene":900,"Graphite":1800,"Wood":600
};
const normaliseGrade=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"");
export function materialReferenceForGrade(grade:string){
  const key=normaliseGrade(String(grade||""));
  if(!key)return undefined;
  return STANDARD_MATERIAL_GRADES.find(([,known])=>normaliseGrade(known)===key)
    || STANDARD_MATERIAL_GRADES.find(([,known])=>{const candidate=normaliseGrade(known);return candidate.length>=4&&(candidate.includes(key)||key.includes(candidate));});
}
export function materialDensityReference(grade:string,materialType:string){
  return materialReferenceForGrade(grade)?.[2]??TYPICAL_DENSITY_BY_MATERIAL_TYPE_KG_M3[materialType];
}
