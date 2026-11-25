const CATEGORY_COLOURS:Record<string,string> = {
  "sawing":"#0e9ca6",
  "turning":"#d28a22",
  "wire edm":"#7958c8",
  "gear cutting":"#d35463",
  "heat treatment":"#2f7fca",
  "grinding":"#24936d",
  "metrology":"#b86a35",
  "laser cutting":"#287aa0",
  "forming":"#9a5b91",
  "fabrication":"#6e9439",
  "welding":"#bd684b",
  "finishing":"#4d70b5",
  "vmc machining":"#a17b28",
  "deburring":"#278f89",
  "quality":"#8a64b5",
  "assembly":"#cd7a28",
  "packaging":"#527d91",
  "punching":"#b14d72"
};
const FALLBACK_PALETTE = [
  "#3f9567","#7b6a39","#386e9d","#a65f3b","#5a8bba","#9b5681",
  "#c45e7b","#297e72","#6d6ac3","#b17a27","#287ba5","#9b6a3c",
  "#467b60","#8b5b9d","#b65b4e","#3e8fae"
];
const LEGACY_DEFAULTS = new Set(["#4b95eb","#6fa9e5","#477fbd"]);

const normalise=(value:string)=>String(value||"").trim().toLowerCase().replace(/\s+/g," ");

export function processPaletteColor(category:string,processType:string):string{
  const categoryKey=normalise(category);
  if(CATEGORY_COLOURS[categoryKey])return CATEGORY_COLOURS[categoryKey];
  const processKey=normalise(processType);
  if(/\bwire\s*edm\b|wire.?cut/.test(processKey))return CATEGORY_COLOURS["wire edm"];
  if(/laser/.test(processKey))return CATEGORY_COLOURS["laser cutting"];
  if(/heat.?treat|hardening|tempering|carbur/.test(processKey))return CATEGORY_COLOURS["heat treatment"];
  if(/turning|lathe/.test(processKey))return CATEGORY_COLOURS["turning"];
  if(/grind/.test(processKey))return CATEGORY_COLOURS["grinding"];
  if(/weld/.test(processKey))return CATEGORY_COLOURS["welding"];
  if(/mill|vmc|hmc/.test(processKey))return CATEGORY_COLOURS["vmc machining"];
  let hash=2166136261;
  const key=categoryKey+"::"+processKey;
  for(let index=0;index<key.length;index++){
    hash^=key.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return FALLBACK_PALETTE[(hash>>>0)%FALLBACK_PALETTE.length];
}

/** Preserve user-picked colours; replace only the legacy shared blue defaults. */
export function resolveProcessColor(record:{category?:string;processType?:string;name?:string;displayColor?:string;processColor?:string}):string{
  const saved=(record.displayColor||record.processColor||"").trim().toLowerCase();
  if(saved&&!LEGACY_DEFAULTS.has(saved))return saved;
  return processPaletteColor(record.category||"",record.processType||record.name||"");
}
