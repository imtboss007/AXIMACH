import type { ManufacturingData } from "./manufacturingData";
export function removeComponentDependents(data: ManufacturingData, componentIds: string[]): ManufacturingData;
export function removePurchaseOrderDependents(data: ManufacturingData, purchaseOrderIds: string[]): ManufacturingData;
