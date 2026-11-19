export type TransportReconciliationLeg = {
  id: string;
  poId: string;
  poLineId: string;
  componentId: string;
  tripCount: number;
  completedTrips?: number;
  status?: string;
  dispatchTransactionId?: string;
  deliveryConfirmedAt?: string;
};
export type TransportReconciliationOrder = { id: string; companyId: string; factoryId: string };
export type DispatchLedgerTransaction = {
  id: string;
  itemType: string;
  itemId: string;
  transactionType: string;
  direction: string;
  poId: string;
  poLineId: string;
  companyId: string;
  factoryId: string;
  quantity: number;
  reference: string;
  occurredAt: string;
  reversalOfId?: string;
};
export function getEligibleDispatchTransactions(
  leg: TransportReconciliationLeg | undefined,
  purchaseOrder: TransportReconciliationOrder | undefined,
  inventoryTransactions: DispatchLedgerTransaction[],
  transportLegs: TransportReconciliationLeg[]
): DispatchLedgerTransaction[];
export function validateTransportCompletion(leg: TransportReconciliationLeg | undefined): string | null;
export function validateDeliveryConfirmation(args: {
  leg: TransportReconciliationLeg | undefined;
  purchaseOrder: TransportReconciliationOrder | undefined;
  dispatchTransaction: DispatchLedgerTransaction | undefined;
  inventoryTransactions: DispatchLedgerTransaction[];
  transportLegs: TransportReconciliationLeg[];
  proof: string;
}): string | null;
