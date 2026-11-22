import type { OperationRecord } from "./manufacturingData";

export function getRequiredRouteOperations(
  operations?: OperationRecord[]
): OperationRecord[];

export function getFinalProductionOperation(
  operations?: OperationRecord[],
  requiredOperations?: OperationRecord[]
): OperationRecord | undefined;

export type ProductionRouteMetrics = {
  expectedQuantity: number;
  requiredOperations: OperationRecord[];
  finalOperation: OperationRecord | undefined;
  finalAcceptedQuantity: number;
  inProgressEstimate: number;
  pendingQuantity: number;
  allRequiredOperationsComplete: boolean;
};

export function getProductionRouteMetrics(
  operations?: OperationRecord[],
  lineQuantity?: number
): ProductionRouteMetrics;
