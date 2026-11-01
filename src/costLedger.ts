
export type CostOperation = {
  name?: string; category?: string; processTypeName?: string; processCategoryName?: string;
  quantity?: number; ratePerPart?: number; actualRatePerPart?: number; transportCost?: number;
  vendorId?: string; transportVendorId?: string;
};
export type ComponentPlanFields = {
  materialCostPerPart?: number; directLabourCostPerPart?: number; overheadCostPerPart?: number;
  toolingCostPerPart?: number; qualityCostPerPart?: number; reworkScrapCostPerPart?: number;
  packagingCostPerPart?: number; otherCostPerPart?: number;
};
export type PlannedProcessCost = {
  quantityPerPart?: number; ratePerProcess?: number;
  /** Legacy field retained for compatibility; transport is now entered in Process Planning. */
  transportCostPerPart?: number;
};
const transportPattern = /\b(transport|transporter|dispatch|logistics?|freight|courier|shipment|shipping|handover|pickup|delivery|haulage|cartage|forwarding)\b/i;
const amount = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : 0;
};
export function isTransportOperation(operation: CostOperation): boolean {
  return transportPattern.test([operation.name,operation.category,operation.processTypeName,operation.processCategoryName].filter(Boolean).join(" "));
}
export function calculateRouteCostTotals(operations: readonly CostOperation[]) {
  let processPlanned=0,transportPlanned=0,processedActual=0,transportActual=0;
  const vendorIds:string[]=[];
  const addVendor=(id?:string)=>{if(id&&!vendorIds.includes(id))vendorIds.push(id);};
  for(const operation of operations){
    const quantity=amount(operation.quantity),plannedRate=amount(operation.ratePerPart),actualRate=amount(operation.actualRatePerPart);
    if(isTransportOperation(operation)){
      transportPlanned+=quantity*plannedRate;
      transportActual+=quantity*actualRate;
    }else{
      processPlanned+=quantity*plannedRate;
      processedActual+=quantity*actualRate;
    }
    transportPlanned+=amount(operation.transportCost);
    addVendor(operation.vendorId);addVendor(operation.transportVendorId);
  }
  return {processPlanned,transportPlanned,processedActual,transportActual,vendorIds};
}
export function componentBaselinePerPart(plan:ComponentPlanFields|null|undefined,processRows:readonly PlannedProcessCost[]=[]):number{
  const base=[plan?.materialCostPerPart,plan?.directLabourCostPerPart,plan?.overheadCostPerPart,plan?.toolingCostPerPart,plan?.qualityCostPerPart,plan?.reworkScrapCostPerPart,plan?.packagingCostPerPart,plan?.otherCostPerPart].reduce((sum,value)=>sum+amount(value),0);
  return base+processRows.reduce((sum,row)=>sum+amount(row.quantityPerPart)*amount(row.ratePerProcess),0);
}
