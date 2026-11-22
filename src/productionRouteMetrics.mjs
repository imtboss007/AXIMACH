const branchName = (operation) => operation.branch || "Main route";

const routeGroupKey = (operation) => [
  operation.poId || "",
  operation.poLineId || "",
  operation.componentId || "",
  branchName(operation)
].join("::");

/**
 * Main-route operations are always required. An alternate/rework branch becomes
 * part of the active route when the user has included that branch for use/costing.
 * Branch activation is currently represented by costIncluded in the saved model;
 * keep this rule centralized so Process Plan and Inventory cannot disagree.
 */
export function getRequiredRouteOperations(operations = []) {
  const liveOperations = operations.filter(operation => operation && !operation.deletedAt);
  const activeBranchKeys = new Set(
    liveOperations
      .filter(operation => branchName(operation) !== "Main route" && operation.costIncluded !== false)
      .map(routeGroupKey)
  );

  return liveOperations.filter(operation =>
    branchName(operation) === "Main route" || activeBranchKeys.has(routeGroupKey(operation))
  );
}

/**
 * Select the final manufacturing output step, not a nested sub-process or a
 * trailing legacy logistics/handover record. Prefer the main route; use an
 * included branch only for legacy lines that have no top-level main operation.
 */
export function getFinalProductionOperation(operations = [], requiredOperations) {
  const liveOperations = operations.filter(operation => operation && !operation.deletedAt);
  const productionSteps = liveOperations.filter(operation =>
    operation.relationType !== "subprocess" &&
    String(operation.category || "").trim().toLowerCase() !== "logistics"
  );
  const mainSteps = productionSteps.filter(operation => branchName(operation) === "Main route");
  const eligible = mainSteps.length
    ? mainSteps
    : (requiredOperations || getRequiredRouteOperations(liveOperations))
        .filter(operation => operation.relationType !== "subprocess" &&
          String(operation.category || "").trim().toLowerCase() !== "logistics");
  return eligible.slice().sort((a, b) =>
    (Number(a.sequence) || 0) - (Number(b.sequence) || 0)
  ).at(-1);
}

/**
 * Per-operation counters describe each station's own batch balance. Summing
 * them double-counts pieces that are moving through sequential stations, so
 * this estimate uses the largest running-stage remainder. Exact parallel
 * split/merge WIP needs explicit lot/transfer quantities, which the current
 * operation record model does not store.
 */
export function getProductionRouteMetrics(operations = [], lineQuantity = 0) {
  const expectedQuantityValue = Number(lineQuantity);
  const expectedQuantity = Number.isFinite(expectedQuantityValue)
    ? Math.max(0, expectedQuantityValue)
    : 0;
  const requiredOperations = getRequiredRouteOperations(operations);
  const finalOperation = getFinalProductionOperation(operations, requiredOperations);
  const acceptedValue = Number(finalOperation?.accepted);
  const finalAcceptedQuantity = Math.min(
    expectedQuantity,
    Number.isFinite(acceptedValue) ? Math.max(0, acceptedValue) : 0
  );
  const remainingAfterAccepted = Math.max(0, expectedQuantity - finalAcceptedQuantity);
  const inProgressEstimate = Math.min(
    remainingAfterAccepted,
    Math.max(0, ...requiredOperations
      .filter(operation => operation.status === "Running")
      .map(operation => {
        const quantityValue = Number(operation.quantity);
        const completedValue = Number(operation.completed);
        const operationQuantity = Number.isFinite(quantityValue)
          ? Math.max(0, Math.min(expectedQuantity, quantityValue))
          : 0;
        const completed = Number.isFinite(completedValue) ? Math.max(0, completedValue) : 0;
        return Math.max(0, operationQuantity - completed);
      }))
  );

  return {
    expectedQuantity,
    requiredOperations,
    finalOperation,
    finalAcceptedQuantity,
    inProgressEstimate,
    pendingQuantity: Math.max(0, remainingAfterAccepted - inProgressEstimate),
    allRequiredOperationsComplete: requiredOperations.length > 0 &&
      requiredOperations.every(operation => operation.status === "Complete")
  };
}
