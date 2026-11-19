/**
 * Deterministic PO-line cost reconciliation.
 *
 * Cost estimates, entered actual rates, transport execution and cash payments
 * remain separate source categories. Payments are settlements, not additional
 * manufacturing expenses. Legacy transport fields are excluded when modern
 * transport legs exist for the same PO line to avoid an automatic double count.
 */
const rows = (value) => Array.isArray(value) ? value.filter((row) => row && !row.deletedAt) : [];
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};
const sum = (items, selector) => items.reduce((total, item) => total + number(selector(item)), 0);
const sameAllocation = (left, right) =>
  (left.partId || "") === (right.partId || "") &&
  (left.materialId || "") === (right.materialId || "") &&
  number(left.quantity) === number(right.quantity) &&
  number(left.materialCost) === number(right.materialCost) &&
  number(left.cuttingCost) === number(right.cuttingCost) &&
  number(left.transportCost) === number(right.transportCost);

export function reconcilePurchaseOrderCosts(data = {}) {
  const orders = rows(data.purchaseOrders);
  const components = rows(data.components);
  const companies = rows(data.companies);
  const factories = rows(data.factories);
  const operations = rows(data.operations);
  const materialEntries = rows(data.materialCostEntries);
  const plannedCosts = rows(data.plannedCosts);
  const transportLegs = rows(data.transportLegs);
  const paymentTransactions = rows(data.paymentTransactions);

  return orders.flatMap((po) => rows(po.lines).map((line) => {
    const lineOperations = operations.filter((op) =>
      op.poId === po.id && op.poLineId === line.id && op.componentId === line.componentId
    );
    const includedOperations = lineOperations.filter((op) => op.costIncluded !== false);
    const excludedOperations = lineOperations.filter((op) => op.costIncluded === false);
    const lineMaterialEntries = materialEntries.filter((entry) =>
      entry.poId === po.id && entry.poLineId === line.id && entry.componentId === line.componentId
    );
    const processMapEntries = lineMaterialEntries.filter((entry) => entry.scope === "process-map");
    const plannedMaterialEntries = lineMaterialEntries.filter((entry) => entry.scope === "planned-cost");
    const linePlannedCosts = plannedCosts.filter((entry) =>
      entry.poId === po.id && entry.poLineId === line.id && entry.componentId === line.componentId
    );
    const lineTransportLegs = transportLegs.filter((leg) =>
      leg.poId === po.id && leg.poLineId === line.id && leg.componentId === line.componentId
    );
    const linePayments = paymentTransactions.filter((tx) =>
      tx.poId === po.id && tx.poLineId === line.id && tx.componentId === line.componentId
    );

    const warnings = [];
    const processMapFingerprints = processMapEntries;
    const plannedFingerprints = plannedMaterialEntries;
    const crossScopeDuplicates = processMapFingerprints.filter((entry) =>
      plannedFingerprints.some((candidate) => sameAllocation(entry, candidate))
    );
    if (crossScopeDuplicates.length) {
      warnings.push("Matching Process Map and Component Planned Cost material allocations exist; values are kept in separate columns and are not combined.");
    }

    const unallocatedMaterialEntryCount = materialEntries.filter((entry) =>
      entry.poId === po.id && entry.componentId === line.componentId && !entry.poLineId
    ).length;
    const unallocatedPlannedCostCount = plannedCosts.filter((entry) =>
      entry.poId === po.id && entry.componentId === line.componentId && !entry.poLineId
    ).length;
    if (unallocatedMaterialEntryCount || unallocatedPlannedCostCount) {
      warnings.push("One or more material/planned-cost records for this PO and component have no PO-line reference; they are not assigned to this line.");
    }

    const hasModernTransport = lineTransportLegs.length > 0;
    const legacyTransportAmount = sum(includedOperations, (op) => op.transportCost);
    const legacyTransportCost = hasModernTransport ? 0 : legacyTransportAmount;
    if (hasModernTransport && legacyTransportAmount > 0) {
      warnings.push("Legacy operation transport amounts are excluded because modern transport legs exist on this PO line; reconcile the legacy amount manually.");
    }

    const plannedTrips = sum(lineTransportLegs, (leg) => leg.tripCount);
    let completedTripCost = 0;
    let plannedTripCost = 0;
    for (const leg of lineTransportLegs) {
      const planned = number(leg.tripCount);
      const completedRaw = Number(leg.completedTrips || 0);
      const validCompleted = Number.isSafeInteger(completedRaw) && completedRaw >= 0 && completedRaw <= planned;
      if (!validCompleted) {
        warnings.push("A transport leg has an invalid actual completed-trip count; its completed-trip cost is excluded.");
      }
      plannedTripCost += number(leg.fixedAmount) * planned;
      if (validCompleted) completedTripCost += number(leg.fixedAmount) * completedRaw;
    }

    const operationsWithLedger = new Set(paymentTransactions.map((tx) => tx.operationId));
    const legacyPaidAmount = sum(lineOperations.filter((op) =>
      !operationsWithLedger.has(op.id)
    ), (op) => op.paidAmount);
    const mismatchedOperationPayments = paymentTransactions.filter((tx) =>
      lineOperations.some((op) => op.id === tx.operationId) &&
      (tx.poId !== po.id || tx.poLineId !== line.id || tx.componentId !== line.componentId)
    );
    if (mismatchedOperationPayments.length) {
      warnings.push("A payment transaction references a line operation but carries a different PO, PO-line or component reference; it is excluded from this line's payment total.");
    }
    if (legacyPaidAmount > 0) {
      warnings.push("Legacy aggregate paid amounts are included separately; original payment dates and individual entries may not exist.");
    }

    const component = components.find((item) => item.id === line.componentId);
    const company = companies.find((item) => item.id === po.companyId);
    const factory = factories.find((item) => item.id === po.factoryId);

    return {
      recordType: "po-line-cost-reconciliation",
      companyId: po.companyId,
      companyName: company?.name || "",
      factoryId: po.factoryId,
      factoryName: factory?.name || "",
      poId: po.id,
      poNumber: po.number || "",
      poLineId: line.id,
      componentId: line.componentId,
      componentNumber: component?.partNumber || "",
      componentName: component?.name || "",
      orderedQuantity: number(line.quantity),
      operationCount: lineOperations.length,
      costIncludedOperationCount: includedOperations.length,
      excludedRouteOperationCount: excludedOperations.length,
      plannedProcessCost: sum(includedOperations, (op) => number(op.quantity) * number(op.ratePerPart)),
      enteredActualProcessCost: sum(includedOperations, (op) => number(op.quantity) * number(op.actualRatePerPart)),
      excludedRoutePlannedProcessCost: sum(excludedOperations, (op) => number(op.quantity) * number(op.ratePerPart)),
      processMapMaterialCost: sum(processMapEntries, (entry) => entry.materialCost),
      processMapCuttingCost: sum(processMapEntries, (entry) => entry.cuttingCost),
      processMapMaterialTransportCost: sum(processMapEntries, (entry) => entry.transportCost),
      plannedScopeMaterialCost: sum(plannedMaterialEntries, (entry) => entry.materialCost),
      plannedScopeCuttingCost: sum(plannedMaterialEntries, (entry) => entry.cuttingCost),
      plannedScopeMaterialTransportCost: sum(plannedMaterialEntries, (entry) => entry.transportCost),
      componentPlannedProcessBenchmarkCost: sum(linePlannedCosts, (entry) => number(entry.plannedQty) * number(entry.plannedRate)),
      componentPlannedProcessBenchmarkEntryCount: linePlannedCosts.length,
      transportLegCount: lineTransportLegs.length,
      transportRoutePlannedCost: plannedTripCost,
      transportRouteCompletedTripCost: completedTripCost,
      legacyTransportCost,
      legacyTransportExcludedAmount: hasModernTransport ? legacyTransportAmount : 0,
      paymentTransactionTotal: sum(linePayments, (tx) => tx.amount),
      paymentTransactionCount: linePayments.length,
      legacyPaidAmount,
      unallocatedMaterialEntryCount,
      unallocatedPlannedCostCount,
      crossScopeDuplicateCandidateCount: crossScopeDuplicates.length,
      warnings
    };
  }));
}
