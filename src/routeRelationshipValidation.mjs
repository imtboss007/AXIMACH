const CONDITION_REQUIRED_TYPES = new Set(["conditional","rework"]);

/** Whether this relationship must carry an explicit route condition. */
export function routeRelationshipRequiresCriteria(relationshipType, status) {
  return CONDITION_REQUIRED_TYPES.has(String(relationshipType || "").trim().toLowerCase())
    || String(status || "").trim() === "Conditional";
}

/** Reject conditional/rework links that have no human-readable acceptance rule. */
export function validateRouteRelationshipCriteria({ relationshipType, status, condition } = {}) {
  const requiresCriteria = routeRelationshipRequiresCriteria(relationshipType, status);
  const normalizedCondition = typeof condition === "string" ? condition.trim() : "";
  if (requiresCriteria && !normalizedCondition) {
    return { ok: false, reason: "condition-required" };
  }
  return { ok: true, reason: "" };
}
