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

  // Space is based on rendered card width, not viewport width. The previous
  // 194px mobile step placed 192px nodes almost edge-to-edge and hid connectors.
  const stepX = compact ? 248 : 278;
  const stepY = compact ? 204 : 190;
  const positions = {};
  const total = Math.max(1, rows.length);
  const dateValues = rows.map(row => numberDate(row.plannedStart || row.actualStart)).filter(Number.isFinite);
  const minDate = dateValues.length ? Math.min(...dateValues) : 0;
  const maxDate = dateValues.length ? Math.max(...dateValues) : minDate;

  if (layout === "radial" || layout === "circular") {
    const ringCapacity = compact ? 8 : 10;
    const baseRadius = compact ? 360 : 460;
    rows.forEach((row, index) => {
      const ring = Math.floor(index / ringCapacity);
      const slot = index % ringCapacity;
      const ringCount = Math.min(ringCapacity, total - ring * ringCapacity);
      const angle = layout === "radial"
        ? -Math.PI * .82 + (slot / Math.max(1, ringCount - 1)) * Math.PI * 1.64
        : -Math.PI / 2 + (slot / Math.max(1, ringCount)) * Math.PI * 2;
      const lane = branchIndex.get(row.branch || "Main route") || 0;
      const laneRadius = baseRadius + ring * (compact ? 112 : 142) + lane * (compact ? 76 : 94);
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
    const xStart = compact ? 62 : 130;
    const yStart = compact ? 116 : 145;
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
      case "orthogonal": {
        const columns = compact ? 2 : 4;
        const rowIndex = Math.floor(sequence / columns);
        const slot = sequence % columns;
        const column = rowIndex % 2 ? columns - 1 - slot : slot;
        point = { x: xStart + column * stepX, y: yStart + lane * stepY * 2 + rowIndex * (compact ? 166 : 154) };
        break;
      }
      case "s-curve": {
        const amplitude = compact ? 64 : 82;
        point = { x: xStart + sequence * stepX, y: yStart + lane * stepY + Math.sin(sequence * .82) * amplitude };
        break;
      }
      case "organic": {
        const angle = sequence * GOLDEN_ANGLE + lane * .72;
        const radius = (compact ? 210 : 250) + Math.sqrt(sequence + 1) * (compact ? 62 : 78) + lane * (compact ? 110 : 140);
        point = { x: (compact ? 380 : 520) + Math.cos(angle) * radius, y: (compact ? 300 : 400) + Math.sin(angle) * radius * .72 };
        break;
      }
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
      positions[row.id] = { x: parent.x + direction * (compact ? 145 : 170), y: parent.y + stepY };
    } else if (layout === "radial" || layout === "circular" || layout === "organic") {
      // Keep the branch's selected geometry rather than pulling it out of its layout.
    } else {
      positions[row.id] = { x: parent.x + (compact ? 248 : 278), y: parent.y + direction * (compact ? 148 : 162) + (lane > 0 ? direction * lane * 22 : 0) };
    }
  }
  return positions;
}
