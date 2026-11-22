type EcosystemGraphNode = {
  id: string;
  label?: string;
  detail?: string;
  kind: string;
  moduleId?: string;
  context?: Record<string, string | undefined>;
};
export function searchEcosystemNodes<T extends EcosystemGraphNode>(
  nodes: T[],
  query: string
): T[];
export function getVisibleEcosystemNodes<T extends EcosystemGraphNode>(
  nodes: T[],
  visibleKinds: string[],
  visibleLimits?: Record<string, number>,
  selectedId?: string
): T[];
export function expandEcosystemGroupLimit(
  currentLimit: number,
  totalCount: number,
  increment?: number
): number;
