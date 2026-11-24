export function searchEcosystemNodes(nodes = [], query = "") {
  const term = String(query || "").trim().toLocaleLowerCase();
  if (!term) return [];
  return nodes.filter(node => {
    const context = node?.context && typeof node.context === "object"
      ? Object.entries(node.context).flatMap(([key, value]) => [key, value])
      : [];
    const haystack = [
      node?.id,
      node?.label,
      node?.detail,
      node?.kind,
      node?.moduleId,
      ...context
    ].filter(value => value !== undefined && value !== null && value !== "")
      .join(" ")
      .toLocaleLowerCase();
    return haystack.includes(term);
  });
}

export function getVisibleEcosystemNodes(nodes = [], visibleKinds = [], visibleLimits = {}, selectedId = "") {
  const visible = [];
  const seen = new Set();
  for (const kind of visibleKinds) {
    const groupNodes = nodes.filter(node => node?.kind === kind);
    const numericLimit = Number(visibleLimits[kind]);
    const limit = Number.isFinite(numericLimit) ? Math.max(0, Math.floor(numericLimit)) : 6;
    for (const node of groupNodes.slice(0, limit)) {
      if (!seen.has(node.id)) {
        seen.add(node.id);
        visible.push(node);
      }
    }
    const selected = selectedId ? groupNodes.find(node => node.id === selectedId) : undefined;
    if (selected && !seen.has(selected.id)) {
      seen.add(selected.id);
      visible.push(selected);
    }
  }
  return visible;
}

export function expandEcosystemGroupLimit(currentLimit, totalCount, increment = 4) {
  const total = Math.max(0, Math.floor(Number(totalCount) || 0));
  const currentValue = Number(currentLimit);
  const current = Number.isFinite(currentValue) ? Math.max(0, Math.floor(currentValue)) : 0;
  const stepValue = Number(increment);
  const step = Number.isFinite(stepValue) ? Math.max(1, Math.floor(stepValue)) : 4;
  return Math.min(total, current + step);
}


export function loadEcosystemGraphPreferences(serialized, validKinds = [], defaultLimits = {}) {
  const kinds = [...new Set(validKinds)];
  const visibleLimits = Object.fromEntries(kinds.map(kind => {
    const value = Number(defaultLimits[kind]);
    return [kind, Number.isFinite(value) ? Math.max(0, Math.min(5000, Math.floor(value))) : 6];
  }));
  const defaults = { version: 2, visibleKinds: [...kinds], visibleLimits };
  let parsed;
  try {
    parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
  const savedKinds = Array.isArray(parsed.visibleKinds) ? [...new Set(parsed.visibleKinds.filter(kind => kinds.includes(kind)))] : [...kinds];
  // A new graph entity group should become visible once for existing users, without
  // re-enabling groups they intentionally hid after the preference schema was upgraded.
  const visibleKinds = parsed.version < 2
    ? [...new Set([...savedKinds, ...kinds.filter(kind => !savedKinds.includes(kind))])]
    : savedKinds;
  const savedLimits = parsed.visibleLimits && typeof parsed.visibleLimits === "object" && !Array.isArray(parsed.visibleLimits)
    ? parsed.visibleLimits
    : {};
  const normalizedLimits = Object.fromEntries(kinds.map(kind => {
    const saved = Number(savedLimits[kind]);
    const fallback = visibleLimits[kind];
    return [kind, Number.isFinite(saved) ? Math.max(0, Math.min(5000, Math.floor(saved))) : fallback];
  }));
  return { version: 2, visibleKinds, visibleLimits: normalizedLimits };
}


const MAX_SAVED_GRAPH_POSITIONS = 5000;
const MAX_GRAPH_COORDINATE = 100000;

function normalizeGraphPosition(position) {
  if (!position || typeof position !== "object" || Array.isArray(position)) return null;
  const x = Number(position.x), y = Number(position.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x: Math.max(-MAX_GRAPH_COORDINATE, Math.min(MAX_GRAPH_COORDINATE, x)),
    y: Math.max(-MAX_GRAPH_COORDINATE, Math.min(MAX_GRAPH_COORDINATE, y))
  };
}

export function loadEcosystemGraphLayout(serialized) {
  let parsed;
  try {
    parsed = typeof serialized === "string" ? JSON.parse(serialized) : serialized;
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const entries = [];
  for (const [id, value] of Object.entries(parsed)) {
    if (typeof id !== "string" || !id.trim() || id.length > 256) continue;
    const position = normalizeGraphPosition(value);
    if (position) entries.push([id, position]);
    if (entries.length >= MAX_SAVED_GRAPH_POSITIONS) break;
  }
  return Object.fromEntries(entries);
}

export function updateEcosystemGraphLayout(layout = {}, nodeId, position) {
  if (typeof nodeId !== "string" || !nodeId.trim() || nodeId.length > 256) return layout;
  const normalized = normalizeGraphPosition(position);
  if (!normalized) return layout;
  const current = layout && typeof layout === "object" && !Array.isArray(layout) ? layout : {};
  const entries = Object.entries(current).filter(([id]) => id !== nodeId && id.length <= 256)
    .slice(-(MAX_SAVED_GRAPH_POSITIONS - 1));
  entries.push([nodeId, normalized]);
  return Object.fromEntries(entries);
}
