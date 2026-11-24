const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function numberDate(value) {
  if (!value) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/**
 * Build deterministic XY positions for a saved PO-line manufacturing graph.
 * This helper only places existing nodes; it never invents route links.
 */
export function buildRouteFlowOperationPositions(operations, layout = "orthogonal", compact = false) {
  const rows = (operations || []).filter(row => row && row.id && row.relationType !== "subprocess" && !row.deletedAt);
  const branches = [...new Set(rows.map(row => row.branch || "Main route"))];
  const branchIndex = new Map(branches.map((branch, index) => [branch, index]));
  const grouped = new Map(branches.map(branch => [branch, []]));
  for (const row of rows) grouped.get(row.branch || "Main route").push(row);
  for (const bucket of grouped.values()) bucket.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  const stepX = compact ? 194 : 250;
  const stepY = compact ? 142 : 178;
  const positions = {};
  const total = Math.max(1, rows.length);
  const dateValues = rows.map(row => numberDate(row.plannedStart || row.actualStart)).filter(Number.isFinite);
  const minDate = dateValues.length ? Math.min(...dateValues) : 0;
  const maxDate = dateValues.length ? Math.max(...dateValues) : minDate;

  if (layout === "radial" || layout === "circular") {
    const radius = Math.max(compact ? 250 : 360, total * (compact ? 28 : 37));
    rows.forEach((row, index) => {
      const angle = layout === "radial"
        ? -Math.PI * 0.85 + (index / Math.max(1, total - 1)) * Math.PI * 1.7
        : -Math.PI / 2 + (index / total) * Math.PI * 2;
      const lane = branchIndex.get(row.branch || "Main route") || 0;
      const laneRadius = layout === "radial" ? radius + lane * (compact ? 100 : 145) : radius + lane * (compact ? 65 : 95);
      positions[row.id] = {
        x: (compact ? 540 : 720) + Math.cos(angle) * laneRadius,
        y: (compact ? 420 : 520) + Math.sin(angle) * laneRadius * (layout === "radial" ? .68 : .82)
      };
    });
    return positions;
  }

  rows.forEach(row => {
    const branch = row.branch || "Main route";
    const lane = branchIndex.get(branch) || 0;
    const bucket = grouped.get(branch) || [];
    const index = bucket.findIndex(candidate => candidate.id === row.id);
    const sequence = Math.max(0, index);
    const xStart = compact ? 74 : 130;
    const yStart = compact ? 120 : 145;
    let point;

    switch (layout) {
      case "vertical":
        point = { x: xStart + lane * stepX, y: yStart + sequence * stepY };
        break;
      case "swimlane":
        point = { x: xStart + sequence * stepX, y: yStart + lane * stepY };
        break;
      case "timeline": {
        const stamp = numberDate(row.plannedStart || row.actualStart);
        const ratio = Number.isFinite(stamp) && maxDate > minDate
          ? (stamp - minDate) / (maxDate - minDate)
          : sequence / Math.max(1, bucket.length - 1);
        point = { x: xStart + ratio * Math.max(stepX * 2, (bucket.length - 1) * stepX), y: yStart + lane * stepY };
        break;
      }
      case "s-curve": {
        const columns = compact ? 3 : 4;
        const rowIndex = Math.floor(sequence / columns);
        const slot = sequence % columns;
        const column = rowIndex % 2 ? columns - 1 - slot : slot;
        point = { x: xStart + column * stepX, y: yStart + lane * stepY + rowIndex * (compact ? 108 : 132) };
        break;
      }
      case "organic": {
        const angle = sequence * GOLDEN_ANGLE + lane * .72;
        const radius = (compact ? 72 : 94) + Math.sqrt(sequence + 1) * (compact ? 48 : 62) + lane * (compact ? 75 : 108);
        point = { x: (compact ? 380 : 520) + Math.cos(angle) * radius, y: (compact ? 300 : 400) + Math.sin(angle) * radius * .72 };
        break;
      }
      case "orthogonal":
      case "horizontal":
      default:
        point = { x: xStart + sequence * stepX, y: yStart + lane * stepY };
        break;
    }
    positions[row.id] = point;
  });

  // Rebase alternate/rework branches close to their saved parent operation.
  // The saved parentId is used only as an anchor; the stored relationship stays authoritative.
  for (const row of rows) {
    if (!row.parentId || (row.relationType !== "alternate" && row.relationType !== "rework")) continue;
    const parent = positions[row.parentId];
    if (!parent) continue;
    const branch = row.branch || "Main route";
    const lane = branchIndex.get(branch) || 0;
    const local = grouped.get(branch) || [];
    const index = Math.max(0, local.findIndex(candidate => candidate.id === row.id));
    const direction = index % 2 === 0 ? 1 : -1;
    if (layout === "vertical") {
      positions[row.id] = { x: parent.x + direction * (compact ? 105 : 135), y: parent.y + stepY };
    } else if (layout === "radial" || layout === "circular" || layout === "organic") {
      // Keep the branch's selected geometry rather than pulling it out of its layout.
    } else {
      positions[row.id] = { x: parent.x + (compact ? 172 : 215), y: parent.y + direction * (compact ? 112 : 145) + (lane > 0 ? direction * lane * 18 : 0) };
    }
  }
  return positions;
}
