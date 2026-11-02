export type ComponentPlanIdentity = {
  componentNumber?: string;
  componentName?: string;
  updatedAt?: string;
};

export type ComponentPlanLookup = {
  componentNumber?: string;
  componentName?: string;
};

export type FinishedJobCostOperation = {
  quantity: number;
  ratePerPart: number;
  actualRatePerPart?: number;
  transportCost?: number;
  name?: string;
  category?: string;
};

export type FinishedJobProcessCostSnapshot = {
  processCost: number;
  actualProcessCost: number;
  missingActualRates: number;
  operationCount: number;
};

export function normalizeComponentPlanKey(value?: string): string {
  return (value || "").trim().toLocaleUpperCase("en-IN").replace(/[^A-Z0-9]/g, "");
}

export function findComponentPlanFor<T extends ComponentPlanIdentity>(
  plans: readonly T[],
  component: ComponentPlanLookup
): T | undefined {
  const componentNumber = normalizeComponentPlanKey(component.componentNumber);
  const componentName = normalizeComponentPlanKey(component.componentName);
  const active = plans.filter(plan => {
    const planNumber = normalizeComponentPlanKey(plan.componentNumber);
    const planName = normalizeComponentPlanKey(plan.componentName);
    return (componentNumber && planNumber === componentNumber) ||
      (!componentNumber && componentName && planName === componentName) ||
      (componentNumber && !planNumber && componentName && planName === componentName);
  });
  if (!active.length) return undefined;
  const numberMatches = componentNumber
    ? active.filter(plan => normalizeComponentPlanKey(plan.componentNumber) === componentNumber)
    : [];
  const candidates = numberMatches.length ? numberMatches : active;
  return [...candidates].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))[0];
}

export function calculateFinishedJobProcessCost(
  operations: readonly FinishedJobCostOperation[]
): FinishedJobProcessCostSnapshot {
  return operations.reduce<FinishedJobProcessCostSnapshot>((total, operation) => {
    const quantity = Math.max(0, Number(operation.quantity) || 0);
    const plannedRate = Math.max(0, Number(operation.ratePerPart) || 0);
    const actualRate = Math.max(0, Number(operation.actualRatePerPart) || 0);
    const transportCost = Math.max(0, Number(operation.transportCost) || 0);
    const directTransport = /transport|dispatch|freight|courier|logistics/i.test((operation.name || "") + " " + (operation.category || ""));
    return {
      processCost: total.processCost + quantity * plannedRate + transportCost,
      actualProcessCost: total.actualProcessCost + quantity * actualRate + transportCost,
      missingActualRates: total.missingActualRates + (!directTransport && actualRate <= 0 ? 1 : 0),
      operationCount: total.operationCount + 1
    };
  }, { processCost: 0, actualProcessCost: 0, missingActualRates: 0, operationCount: 0 });
}
