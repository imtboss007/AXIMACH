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
