const MAX_SAVED_POSITIONS = 5000;
const MAX_COORDINATE = 100000;

function parseLayout(serialized) {
  try {
    const parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizePosition(position) {
  if (!position || typeof position !== "object" || Array.isArray(position)) return null;
  const x = Number(position.x), y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, x)),
    y: Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, y))
  };
}

/** Load saved node positions for one Route Flow canvas from its scoped storage key. */
export function loadRouteFlowGraphLayout(serialized) {
  const parsed = parseLayout(serialized);
  const entries = [];
  for (const [id, value] of Object.entries(parsed)) {
    if (typeof id !== "string" || !id.trim() || id.length > 256) continue;
    const position = normalizePosition(value);
    if (position) entries.push([id, position]);
    if (entries.length >= MAX_SAVED_POSITIONS) break;
  }
  return Object.fromEntries(entries);
}

/** Update one node position while preserving valid positions for the same PO line. */
export function saveRouteFlowGraphPosition(serialized, nodeId, position) {
  if (typeof nodeId !== "string" || !nodeId.trim() || nodeId.length > 256) {
    return JSON.stringify(loadRouteFlowGraphLayout(serialized));
  }
  const normalized = normalizePosition(position);
  const current = loadRouteFlowGraphLayout(serialized);
  if (!normalized) return JSON.stringify(current);
  const entries = Object.entries(current)
    .filter(([id]) => id !== nodeId)
    .slice(-(MAX_SAVED_POSITIONS - 1));
  entries.push([nodeId, normalized]);
  return JSON.stringify(Object.fromEntries(entries));
}
