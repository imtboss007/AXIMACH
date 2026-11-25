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
export function routeRelationshipHandles(type, sourcePoint, targetPoint) {
  if (sourcePoint && targetPoint
    && Number.isFinite(sourcePoint.x) && Number.isFinite(sourcePoint.y)
    && Number.isFinite(targetPoint.x) && Number.isFinite(targetPoint.y)) {
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    if (Math.abs(dx) + Math.abs(dy) > 0.001) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        return dx >= 0
          ? ["source-right", "target-left"]
          : ["source-left", "target-right"];
      }
      return dy >= 0
        ? ["source-bottom", "target-top"]
        : ["source-top", "target-bottom"];
    }
  }
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


const RELATIONSHIP_PATH_ORDER = [
  "main", "alternate", "rework", "dependency", "parallel", "merge",
  "split", "follow-on", "feedback", "conditional", "successor", "transport"
];

const RELATIONSHIP_CURVATURE = {
  main: 0.24,
  alternate: 0.38,
  rework: 0.54,
  dependency: 0.30,
  parallel: 0.68,
  merge: 0.44,
  split: 0.58,
  "follow-on": 0.34,
  feedback: 0.76,
  conditional: 0.62,
  successor: 0.20,
  transport: 0.48
};

/**
 * Resolve graph edge ports and path options from the actual node geometry.
 * Orthogonal/vertical/swimlane layouts use rounded step paths; all other
 * layouts use Bezier paths. Semantic edge types and parallel edges receive
 * distinct routing offsets/curvatures so links between the same nodes remain
 * independently visible.
 */
export function routeRelationshipEdgeGeometry(
  type,
  sourcePoint,
  targetPoint,
  layout = "orthogonal",
  parallelIndex = 0
) {
  let [sourceHandle, targetHandle] = routeRelationshipHandles(type, sourcePoint, targetPoint);
  if (type === "transport" && sourceHandle === "source-right" && targetHandle === "target-left") {
    sourceHandle = "source-right-transport";
    targetHandle = "target-left-transport";
  }
  const semanticIndex = Math.max(0, RELATIONSHIP_PATH_ORDER.indexOf(type));
  const extraLane = Math.max(0, Number(parallelIndex) || 0);
  const orthogonal = layout === "orthogonal" || layout === "vertical" || layout === "swimlane";

  if (orthogonal) {
    return {
      sourceHandle,
      targetHandle,
      edgeType: "manufacturing",
      pathOptions: {
        mode: "smoothstep",
        offset: 18 + semanticIndex * 2.5 + extraLane * 11,
        borderRadius: 12 + (semanticIndex % 3) * 4
      }
    };
  }

  const base = RELATIONSHIP_CURVATURE[type] || 0.26;
  return {
    sourceHandle,
    targetHandle,
    edgeType: "manufacturing",
    pathOptions: {
      mode: "bezier",
      curvature: Math.min(0.86, Math.max(0.16, base + extraLane * 0.095))
    }
  };
}
