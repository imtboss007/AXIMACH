/** Deterministic, collision-free group grid for the Manufacturing Universe. */
export function layoutManufacturingUniverseNodes(nodes = [], groupOrder = [], options = {}) {
  const nodeWidth = Math.max(120, Number(options.nodeWidth) || 190);
  const nodeHeight = Math.max(64, Number(options.nodeHeight) || 92);
  const columns = Math.max(1, Math.floor(Number(options.columns) || 4));
  const innerColumns = Math.max(1, Math.floor(Number(options.innerColumns) || 2));
  const gapX = Math.max(8, Number(options.gapX) || 26);
  const gapY = Math.max(8, Number(options.gapY) || 28);
  const groupGapX = Math.max(16, Number(options.groupGapX) || 72);
  const groupGapY = Math.max(20, Number(options.groupGapY) || 72);
  const groups = new Map(groupOrder.map((kind) => [kind, []]));
  for (const node of nodes || []) {
    if (!node?.id) continue;
    const kind = node.kind || "other";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(node);
  }
  const orderedKinds = [...groupOrder.filter(kind => groups.has(kind)), ...[...groups.keys()].filter(kind => !groupOrder.includes(kind))];
  const tileWidth = innerColumns * nodeWidth + (innerColumns - 1) * gapX;
  const bandCount = Math.ceil(orderedKinds.length / columns);
  const bandHeights = [];
  for (let band = 0; band < bandCount; band += 1) {
    const bandKinds = orderedKinds.slice(band * columns, (band + 1) * columns);
    const maxRows = Math.max(1, ...bandKinds.map(kind => Math.ceil(groups.get(kind).length / innerColumns)));
    bandHeights.push(maxRows * nodeHeight + Math.max(0, maxRows - 1) * gapY + groupGapY);
  }
  const bandOffsets = [];
  let offsetY = 0;
  for (const height of bandHeights) {
    bandOffsets.push(offsetY);
    offsetY += height;
  }
  const positions = {};
  orderedKinds.forEach((kind, groupIndex) => {
    const band = Math.floor(groupIndex / columns);
    const column = groupIndex % columns;
    const items = groups.get(kind) || [];
    items.forEach((node, index) => {
      const localColumn = index % innerColumns;
      const localRow = Math.floor(index / innerColumns);
      positions[node.id] = {
        x: column * (tileWidth + groupGapX) + localColumn * (nodeWidth + gapX),
        y: bandOffsets[band] + localRow * (nodeHeight + gapY)
      };
    });
  });
  return positions;
}

/** Handles separate overlapping semantic relationships between the same node pair. */
export function routeRelationshipHandles(type) {
  const map = {
    main: ["source-right","target-left"],
    alternate: ["source-top","target-left"],
    rework: ["source-bottom","target-left"],
    dependency: ["source-top","target-top"],
    parallel: ["source-bottom","target-bottom"],
    merge: ["source-right","target-bottom"],
    split: ["source-top","target-right"],
    "follow-on": ["source-right","target-top"],
    feedback: ["source-left","target-left"],
    conditional: ["source-bottom","target-top"],
    successor: ["source-left","target-bottom"],
    transport: ["source-right-transport","target-left-transport"]
  };
  return map[type] || map.main;
}

/** Stable key includes relationship type so multiple link types are never collapsed. */
export function manufacturingGraphEdgeKey(source, target, type) {
  return [source, target, type].join("::");
}
