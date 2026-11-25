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

export type EcosystemGraphPreferences<K extends string = string> = {
  version: 1 | 2 | 3;
  visibleKinds: K[];
  visibleLimits: Record<K, number>;
};
export function loadEcosystemGraphPreferences<K extends string>(
  serialized: string | null | undefined | unknown,
  validKinds: K[],
  defaultLimits?: Record<K, number>
): EcosystemGraphPreferences<K>;

export type EcosystemGraphPosition = { x:number; y:number };
export function loadEcosystemGraphLayout(serialized: string | null | undefined | unknown): Record<string,EcosystemGraphPosition>;
export function updateEcosystemGraphLayout(
  layout: Record<string,EcosystemGraphPosition>,
  nodeId: string,
  position: EcosystemGraphPosition
): Record<string,EcosystemGraphPosition>;
