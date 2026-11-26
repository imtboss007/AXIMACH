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
