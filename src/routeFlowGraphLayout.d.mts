export type RouteFlowGraphPosition = Readonly<{ x: number; y: number }>;
export type RouteFlowGraphLayout = Record<string, RouteFlowGraphPosition>;

export function loadRouteFlowGraphLayout(
  serialized: string | Record<string, unknown> | null | undefined
): RouteFlowGraphLayout;

export function saveRouteFlowGraphPosition(
  serialized: string | Record<string, unknown> | null | undefined,
  nodeId: string,
  position: RouteFlowGraphPosition
): string;
