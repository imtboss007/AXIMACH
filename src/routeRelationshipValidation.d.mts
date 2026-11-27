export function routeRelationshipRequiresCriteria(relationshipType?: string, status?: string): boolean;
export function validateRouteRelationshipCriteria(input?: {
  relationshipType?: string;
  status?: string;
  condition?: string;
}): { ok: boolean; reason: "" | "condition-required" };
