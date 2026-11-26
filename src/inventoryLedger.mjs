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
   row.companyId===po.companyId&&row.factoryId===po.factoryId&&row.poId===po.id&&row.poLineId===line.id
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


/**
 * Reconcile actual material use without deducting stock a second time.
 * Issue-to-production transactions have already reduced warehouse stock.
 * This helper allocates operation-specific issues first and then a shared
 * unassigned issue pool, so two operations cannot consume the same issue.
 */
export function buildMaterialConsumptionPlan({
 po,line,component,operation,bomLine,material,materialProcessLinks=[],
 inventoryTransactions=[],materialConsumptions=[]
}={}){
 if(!po?.id||!po.companyId||!po.factoryId||!line?.id||!component?.id||
    !operation?.id||!bomLine?.id||!material?.id||
    line.componentId!==component.id||bomLine.componentId!==component.id||
    bomLine.materialId!==material.id||operation.poId!==po.id||
    operation.poLineId!==line.id||operation.componentId!==component.id)return null;
 if(bomLine.revision&&bomLine.revision!==component.revision)return null;
 if(line.partId&&bomLine.partId&&line.partId!==bomLine.partId)return null;
 const links=asRows(materialProcessLinks).filter(row=>
  row&&!row.deletedAt&&row.companyId===po.companyId&&row.poId===po.id&&row.poLineId===line.id&&
  row.componentId===component.id&&row.bomLineId===bomLine.id&&row.materialId===material.id&&
  row.operationId===operation.id&&["Material input","Consumable"].includes(row.flowType)
 );
 const plannedQuantity=links.length
  ?links.reduce((sum,row)=>sum+finiteQuantity(row.quantityPerPart)*finiteQuantity(line.quantity),0)
  :finiteQuantity(bomLine.quantityPerPart)*(1+finiteQuantity(bomLine.scrapPercent)/100)*finiteQuantity(line.quantity);
 const scopeMatch=row=>row&&!row.deletedAt&&row.companyId===po.companyId&&row.factoryId===po.factoryId&&
  row.poId===po.id&&row.poLineId===line.id&&row.itemType==="material"&&row.itemId===material.id;
 const scopedTransactions=asRows(inventoryTransactions).filter(scopeMatch);
 const issues=scopedTransactions.filter(row=>row.transactionType==="Issue to production"&&row.direction==="out");
 const manualReturns=scopedTransactions.filter(row=>row.transactionType==="Return"&&row.direction==="in"&&!row.sourceConsumptionId);
 const directIssued=Math.max(0,
  issues.filter(row=>row.operationId===operation.id).reduce((sum,row)=>sum+finiteQuantity(row.quantity),0)-
  manualReturns.filter(row=>row.operationId===operation.id).reduce((sum,row)=>sum+finiteQuantity(row.quantity),0)
 );
 const unassignedIssued=Math.max(0,
  issues.filter(row=>!row.operationId).reduce((sum,row)=>sum+finiteQuantity(row.quantity),0)-
  manualReturns.filter(row=>!row.operationId).reduce((sum,row)=>sum+finiteQuantity(row.quantity),0)
 );
 const usageRows=asRows(materialConsumptions).filter(row=>
  row&&!row.deletedAt&&row.companyId===po.companyId&&row.factoryId===po.factoryId&&
  row.poId===po.id&&row.poLineId===line.id&&row.componentId===component.id&&row.materialId===material.id
 );
 const usedByOperation=new Map();
 for(const row of usageRows){
  const key=row.operationId||"";
  usedByOperation.set(key,(usedByOperation.get(key)||0)+finiteQuantity(row.consumedQuantity)+finiteQuantity(row.returnedQuantity));
 }
 const issuedByOperation=new Map();
 for(const row of issues){
  const key=row.operationId||"";
  if(key)issuedByOperation.set(key,(issuedByOperation.get(key)||0)+finiteQuantity(row.quantity));
 }
 let allocatedFromSharedPool=0;
 for(const [operationId,used] of usedByOperation){
  allocatedFromSharedPool+=Math.max(0,used-(issuedByOperation.get(operationId)||0));
 }
 const availableSharedPool=Math.max(0,unassignedIssued-allocatedFromSharedPool);
 const priorAllocatedForOperation=usedByOperation.get(operation.id)||0;
 const availableDirectForOperation=Math.max(0,directIssued-priorAllocatedForOperation);
 const availableToReconcile=availableDirectForOperation+availableSharedPool;
 const selectedUsage=usageRows.filter(row=>row.operationId===operation.id&&row.bomLineId===bomLine.id);
 const priorConsumed=selectedUsage.reduce((sum,row)=>sum+finiteQuantity(row.consumedQuantity),0);
 const priorScrap=selectedUsage.reduce((sum,row)=>sum+finiteQuantity(row.scrapQuantity),0);
 const priorReturned=selectedUsage.reduce((sum,row)=>sum+finiteQuantity(row.returnedQuantity),0);
 return {
  plannedQuantity,issuedQuantityAtRecord:availableToReconcile,availableToReconcile,
  directIssued,unassignedIssued,availableDirectForOperation,availableSharedPool,
  priorConsumed,priorScrap,priorReturned,
  variance:priorConsumed-plannedQuantity,
  materialProcessLinkIds:links.map(row=>row.id),
  unit:material.unit||bomLine.unit||"kg"
 };
}

export function validateMaterialConsumptionQuantities(plan,consumedValue,scrapValue,returnedValue){
 if(!plan||!Number.isFinite(Number(plan.availableToReconcile))||Number(plan.availableToReconcile)<0)
  return {ok:false,reason:"invalid-consumption-context"};
 const consumed=Number(consumedValue),scrap=Number(scrapValue),returned=Number(returnedValue);
 if(!Number.isFinite(consumed)||consumed<0||!Number.isFinite(scrap)||scrap<0||
    !Number.isFinite(returned)||returned<0)
  return {ok:false,reason:"invalid-quantities"};
 if(scrap>consumed+1e-9)return {ok:false,reason:"scrap-exceeds-consumption"};
 if(consumed+returned<=0)return {ok:false,reason:"empty-reconciliation"};
 if(consumed+returned>Number(plan.availableToReconcile)+1e-9)
  return {ok:false,reason:"exceeds-issued-available"};
 return {ok:true,reason:""};
}
