type InventoryScope={companyId?:string;factoryId?:string};
type InventoryTransactionLike={
 id?:string;itemType:"material"|"component";itemId:string;transactionType:string;
 direction:"in"|"out";quantity:number;companyId?:string;factoryId?:string;
 poId?:string;poLineId?:string;deletedAt?:string;
};
import type {MaterialRecord} from "./manufacturingData";
type BomLike={id:string;componentId:string;materialId:string;revision?:string;partId?:string;quantityPerPart:number;scrapPercent:number;deletedAt?:string};
type PurchaseOrderLike={id:string;companyId:string;factoryId:string};
type PurchaseOrderLineLike={id:string;componentId:string;partId?:string;quantity:number};
type ComponentLike={id:string;revision?:string};
export function getInventoryStockBalance(transactions:InventoryTransactionLike[],itemType:"material"|"component",itemId:string,scope?:InventoryScope):number;
export function buildBomMaterialIssuePlan(input:{
 bomLines:BomLike[];materials:MaterialRecord[];transactions:InventoryTransactionLike[];
 po:PurchaseOrderLike;line:PurchaseOrderLineLike;component:ComponentLike;
}):Array<{material?:MaterialRecord;materialId:string;bomLineIds:string[];required:number;issued:number;pending:number;available:number;shortage:number}>;

type OperationLike={id:string;poId:string;poLineId:string;componentId:string};
type MaterialProcessLinkLike={
 id:string;companyId:string;poId:string;poLineId:string;componentId:string;bomLineId:string;
 materialId:string;operationId:string;quantityPerPart:number;flowType:"Material input"|"Consumable"|"WIP transfer"|"Output";deletedAt?:string;
};
type MaterialConsumptionLike={
 id:string;companyId:string;factoryId:string;poId:string;poLineId:string;componentId:string;
 bomLineId:string;materialId:string;operationId:string;consumedQuantity:number;
 scrapQuantity:number;returnedQuantity:number;deletedAt?:string;
};
export function buildMaterialConsumptionPlan(input:{
 po:PurchaseOrderLike;line:PurchaseOrderLineLike;component:ComponentLike;operation:OperationLike;
 bomLine:BomLike;material:MaterialRecord;materialProcessLinks?:MaterialProcessLinkLike[];
 inventoryTransactions?:InventoryTransactionLike[];materialConsumptions?:MaterialConsumptionLike[];
}):{
 plannedQuantity:number;issuedQuantityAtRecord:number;availableToReconcile:number;
 directIssued:number;unassignedIssued:number;availableDirectForOperation:number;availableSharedPool:number;
 priorConsumed:number;priorScrap:number;priorReturned:number;variance:number;materialProcessLinkIds:string[];unit:string;
}|null;
export function validateMaterialConsumptionQuantities(plan:ReturnType<typeof buildMaterialConsumptionPlan>,consumedValue:number|string,scrapValue:number|string,returnedValue:number|string):{ok:boolean;reason:string};
