const asRows=value=>Array.isArray(value)?value:[];
const finiteQuantity=value=>Number.isFinite(Number(value))?Number(value):0;

/** Calculate stock only within the requested company/factory when supplied. */
export function getInventoryStockBalance(transactions=[],itemType,itemId,scope={}){
 return asRows(transactions).reduce((balance,row)=>{
  if(!row||row.deletedAt||row.itemType!==itemType||row.itemId!==itemId)return balance;
  if(scope.companyId&&row.companyId!==scope.companyId)return balance;
  if(scope.factoryId&&row.factoryId!==scope.factoryId)return balance;
  const quantity=finiteQuantity(row.quantity);
  return balance+(row.direction==="in"?quantity:row.direction==="out"?-quantity:0);
 },0);
}

/**
 * Build a live, PO-line-specific material issue plan. Availability is always
 * rechecked against the PO's owning company and factory; stock from another
 * tenant or factory is never eligible to satisfy this requirement.
 */
export function buildBomMaterialIssuePlan({
 bomLines=[],materials=[],transactions=[],po,line,component
}={}){
 if(!po?.id||!po.companyId||!po.factoryId||!line?.id||!component?.id||line.componentId!==component.id)return [];
 const eligibleBom=asRows(bomLines).filter(row=>
  row&&!row.deletedAt&&row.componentId===component.id&&
  (!row.revision||row.revision===component.revision)&&
  (!line.partId||!row.partId||row.partId===line.partId)
 );
 const totals=new Map();
 for(const bom of eligibleBom){
  const previous=totals.get(bom.materialId)||{required:0,bomLineIds:[]};
  previous.required+=finiteQuantity(bom.quantityPerPart)*(1+finiteQuantity(bom.scrapPercent)/100)*finiteQuantity(line.quantity);
  previous.bomLineIds.push(bom.id);
  totals.set(bom.materialId,previous);
 }
 return [...totals.entries()].map(([materialId,total])=>{
  const material=asRows(materials).find(row=>row?.id===materialId&&!row.deletedAt);
  const issued=asRows(transactions).filter(row=>
   row&&!row.deletedAt&&row.itemType==="material"&&row.itemId===materialId&&
   row.poId===po.id&&row.poLineId===line.id
  ).reduce((sum,row)=>
   sum+(row.transactionType==="Issue to production"&&row.direction==="out"?finiteQuantity(row.quantity):
       row.transactionType==="Return"&&row.direction==="in"?-finiteQuantity(row.quantity):0),0);
  const available=getInventoryStockBalance(transactions,"material",materialId,{companyId:po.companyId,factoryId:po.factoryId});
  const pending=Math.max(0,total.required-Math.max(0,issued));
  return {
   material,materialId,bomLineIds:total.bomLineIds,required:total.required,
   issued:Math.max(0,issued),pending,available,
   shortage:Math.max(0,pending-Math.max(0,available))
  };
 });
}
