const PROCESS_PALETTE = [
  "#0e9ca6","#d28a22","#7958c8","#d35463","#2f7fca","#24936d",
  "#b86a35","#287aa0","#9a5b91","#6e9439","#bd684b","#4d70b5",
  "#a17b28","#278f89","#8a64b5","#cd7a28","#527d91","#b14d72",
  "#3f9567","#7b6a39","#386e9d","#a65f3b","#5a8bba","#9b5681"
];
const LEGACY_DEFAULTS = new Set(["#4b95eb","#6fa9e5"]);

export function processPaletteColor(category:string,processType:string):string{
  const key=(String(category||"")+"::"+String(processType||"")).trim().toLowerCase();
  let hash=2166136261;
  for(let index=0;index<key.length;index++){
    hash^=key.charCodeAt(index);
    hash=Math.imul(hash,16777619);
  }
  return PROCESS_PALETTE[(hash>>>0)%PROCESS_PALETTE.length];
}

/** Preserve user-picked colours; replace only the legacy shared blue defaults. */
export function resolveProcessColor(record:{category?:string;processType?:string;name?:string;displayColor?:string;processColor?:string}):string{
  const saved=(record.displayColor||record.processColor||"").trim().toLowerCase();
  if(saved&&!LEGACY_DEFAULTS.has(saved))return saved;
  return processPaletteColor(record.category||"",record.processType||record.name||"");
}
