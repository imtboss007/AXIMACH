/**
 * Pure rules for reconciling transport execution with an existing stock dispatch.
 * These functions deliberately never create or mutate inventory transactions.
 */
export function getEligibleDispatchTransactions(leg, purchaseOrder, inventoryTransactions, transportLegs) {
  if (!leg || !purchaseOrder || purchaseOrder.id !== leg.poId) return [];
  return (inventoryTransactions || []).filter((transaction) =>
    transaction.itemType === "component" &&
    Number.isFinite(Number(transaction.quantity)) && Number(transaction.quantity) > 0 &&
    transaction.itemId === leg.componentId &&
    transaction.transactionType === "Dispatch" &&
    transaction.direction === "out" &&
    transaction.poId === leg.poId &&
    transaction.poLineId === leg.poLineId &&
    transaction.companyId === purchaseOrder.companyId &&
    transaction.factoryId === purchaseOrder.factoryId &&
    !(inventoryTransactions || []).some((reversal) => reversal.reversalOfId === transaction.id) &&
    !(transportLegs || []).some((other) => other.id !== leg.id && other.dispatchTransactionId === transaction.id)
  );
}

export function validateTransportCompletion(leg) {
  if (!leg) return "Transport leg is missing.";
  const planned = Number(leg.tripCount);
  const completed = Number(leg.completedTrips || 0);
  if (!Number.isSafeInteger(planned) || planned < 1) return "Planned trip count must be a positive whole number.";
  if (!Number.isSafeInteger(completed) || completed !== planned) {
    return "Cannot complete this transport leg: record every planned trip as actually completed first.";
  }
  return null;
}

export function validateDeliveryConfirmation({
  leg,
  purchaseOrder,
  dispatchTransaction,
  inventoryTransactions,
  transportLegs,
  proof
}) {
  if (!leg || !purchaseOrder || purchaseOrder.id !== leg.poId || !dispatchTransaction || leg.deliveryConfirmedAt) {
    return "Link a valid Dispatch stock-ledger entry before confirming delivery.";
  }
  if (leg.status !== "Complete" || validateTransportCompletion(leg)) {
    return "Delivery cannot be confirmed until every planned transport trip is recorded complete.";
  }
  if (leg.dispatchTransactionId !== dispatchTransaction.id) {
    return "The linked Dispatch entry is missing, reversed, reused or does not match this transport leg. Reconcile the stock ledger first.";
  }
  const eligible = getEligibleDispatchTransactions(leg, purchaseOrder, inventoryTransactions, transportLegs);
  if (!eligible.includes(dispatchTransaction)) {
    return "The linked Dispatch entry is missing, reversed, reused or does not match this transport leg. Reconcile the stock ledger first.";
  }
  if (!(proof || "").trim()) {
    return "Enter the delivery challan, proof-of-delivery number or signed receiver reference.";
  }
  return null;
}
