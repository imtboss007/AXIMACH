const CARD_BOUNDS = Object.freeze({
  operation: { width: 184, height: 72 },
  material: { width: 190, height: 118 },
  transport: { width: 34, height: 34 },
  transportLeg: { width: 34, height: 34 },
  catalogue: { width: 184, height: 72 },
  core: { width: 140, height: 56 }
});

// Use the actual responsive CSS footprints instead of desktop-sized estimates
// on narrow screens. Oversized estimates force premature collision fallback.
function boundsForKind(kind, viewportWidth) {
  if (viewportWidth <= 600) {
    const compact = {
      operation: { width: 148, height: 86 },
      material: { width: 140, height: 105 },
      transport: { width: 32, height: 32 },
      transportLeg: { width: 32, height: 32 },
      catalogue: { width: 148, height: 86 },
      core: { width: 100, height: 42 }
    };
    return compact[kind] || compact.operation;
  }
  if (viewportWidth <= 820) {
    const tablet = {
      operation: { width: 142, height: 84 },
      material: { width: 142, height: 96 },
      transport: { width: 34, height: 34 },
      transportLeg: { width: 34, height: 34 },
      catalogue: { width: 142, height: 84 },
      core: { width: 120, height: 48 }
    };
    return tablet[kind] || tablet.operation;
  }
  return CARD_BOUNDS[kind] || CARD_BOUNDS.operation;
}

const LABEL_GAP = 14;
const SHELF_GAP = 18;
const CARD_SCALES = [1, 0.92, 0.84, 0.78];

function clampCenter(x, y, bounds, width, height) {
  const minX = Math.min(bounds.width / 2 + 7, width / 2);
  const maxX = Math.max(minX, width - bounds.width / 2 - 7);
  const minY = Math.min(bounds.height / 2 + 24, height / 2);
  const maxY = Math.max(minY, height - bounds.height / 2 - 42);
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y))
  };
}

function isFree(candidate, bounds, placed) {
  return placed.every(other =>
    Math.abs(candidate.x - other.screen.x) >= (bounds.width + other.bounds.width) / 2 + LABEL_GAP ||
    Math.abs(candidate.y - other.screen.y) >= (bounds.height + other.bounds.height) / 2 + LABEL_GAP
  );
}


function* squareSpiral(step, maximumRing) {
  yield [0, 0];
  for (let ring = 1; ring <= maximumRing; ring += 1) {
    for (let column = -ring; column <= ring; column += 1) {
      yield [column * step, -ring * step];
      yield [column * step, ring * step];
    }
    for (let row = -ring + 1; row < ring; row += 1) {
      yield [-ring * step, row * step];
      yield [ring * step, row * step];
    }
  }
}

function findNearestFreeSlot(anchor, bounds, placed, width, height, step) {
  const origin = clampCenter(anchor.x, anchor.y, bounds, width, height);
  const minX = Math.min(bounds.width / 2 + 7, width / 2);
  const maxX = Math.max(minX, width - bounds.width / 2 - 7);
  const minY = Math.min(bounds.height / 2 + 24, height / 2);
  const maxY = Math.max(minY, height - bounds.height / 2 - 42);
  const maximumRing = Math.ceil(Math.max(width, height) / step) + 2;

  // Generate un-clamped candidate points so off-canvas spiral points cannot
  // collapse onto an edge and hide free positions elsewhere in the viewport.
  for (const [dx, dy] of squareSpiral(step, maximumRing)) {
    const candidate = { x: origin.x + dx, y: origin.y + dy };
    if (candidate.x < minX || candidate.x > maxX || candidate.y < minY || candidate.y > maxY) continue;
    if (isFree(candidate, bounds, placed)) return candidate;
  }
  return null;
}



function packDenseLabels(items, width, height) {
  const availableWidth = Math.max(1, width - 14);
  const availableHeight = Math.max(1, height - 66);
  const hasCore = items[0]?.kind === "core";
  const prefixCount = hasCore ? Math.min(2, items.length) : Math.min(1, items.length);
  const priority = items.slice(0, prefixCount);
  const remainder = items.slice(prefixCount).sort((a, b) => {
    const aBounds = boundsForKind(a.kind, width);
    const bBounds = boundsForKind(b.kind, width);
    return bBounds.width * bBounds.height - aBounds.width * aBounds.height ||
      a.screen.y - b.screen.y || a.screen.x - b.screen.x;
  });
  const ordered = [...priority, ...remainder];
  const portrait = height > width;
  const scales = portrait
    ? [0.84, 0.78, 0.72, 0.68, 0.64, 0.60, 0.56, 0.54, 0.52, 0.50, 0.48, 0.46, 0.44, 0.42, 0.40]
    : [0.84, 0.78, 0.72, 0.68, 0.64, 0.60];
  let bestOverflow = null;

  for (const scale of scales) {
    const rows = [];
    let row = { entries: [], width: 0, height: 0 };

    for (const item of ordered) {
      const base = boundsForKind(item.kind, width);
      const isCard = item.kind === "operation" || item.kind === "material" || item.kind === "catalogue";
      const itemScale = isCard ? scale : 1;
      const bounds = { width: base.width * itemScale, height: base.height * itemScale };

      if (bounds.width > availableWidth) {
        row = null;
        break;
      }
      const nextWidth = row.width + (row.entries.length ? SHELF_GAP : 0) + bounds.width;
      if (row.entries.length && nextWidth > availableWidth) {
        rows.push(row);
        row = { entries: [], width: 0, height: 0 };
      }
      row.entries.push({ item, bounds, scale: itemScale });
      row.width += (row.entries.length > 1 ? SHELF_GAP : 0) + bounds.width;
      row.height = Math.max(row.height, bounds.height);
    }

    if (!row) continue;
    if (row.entries.length) rows.push(row);
    const packedHeight = rows.reduce((total, current) => total + current.height, 0) +
      SHELF_GAP * Math.max(0, rows.length - 1);
    const fitsViewport = packedHeight <= availableHeight;
    const resolved = new Map();
    // Keep labels centred when they fit. A short landscape layout may grow
    // vertically; portrait must use a more compact scale to remain in-frame.
    let y = fitsViewport ? 24 + (availableHeight - packedHeight) / 2 : 24;
    for (const current of rows) {
      let x = (width - current.width) / 2;
      for (const entry of current.entries) {
        resolved.set(entry.item, {
          ...entry.item,
          screen: {
            ...entry.item.screen,
            x: x + entry.bounds.width / 2,
            y: y + current.height / 2,
            scale: entry.scale,
            collision: false
          }
        });
        x += entry.bounds.width + SHELF_GAP;
      }
      y += current.height + SHELF_GAP;
    }

    const result = items.map(item => resolved.get(item));
    const requiredHeight = fitsViewport ? height : Math.ceil(packedHeight + 66);
    Object.defineProperty(result, "layoutHeight", {
      value: Math.max(height, requiredHeight),
      enumerable: false
    });
    if (fitsViewport) return result;
    // Prefer the smallest expansion for landscape; keep trying smaller scales
    // in portrait until every label fits the existing viewport.
    if (!bestOverflow || requiredHeight < bestOverflow.layoutHeight) bestOverflow = result;
  }
  return bestOverflow;
}

/**
 * Position all DOM cards and transport markers in the same 2D overlay space.
 * Selected process and fixed core labels should be supplied first so they
 * retain visual priority. Cards move to the nearest available viewport slot.
 */
export function relaxProcessSceneLabels(items, width, height) {
  const viewportWidth = Math.max(1, Number(width) || 1);
  const viewportHeight = Math.max(1, Number(height) || 1);
  const step = Math.max(16, Math.min(24, Math.round(Math.min(viewportWidth, viewportHeight) / 28)));
  const placed = [];
  const output = [];

  for (const item of items) {
    const baseBounds = boundsForKind(item.kind, viewportWidth);
    const isCard = item.kind === "operation" || item.kind === "material" || item.kind === "catalogue";
    const scales = isCard ? CARD_SCALES : [1];
    let winner = null;

    for (const scale of scales) {
      const bounds = { width: baseBounds.width * scale, height: baseBounds.height * scale };
      winner = findNearestFreeSlot(item.screen, bounds, placed, viewportWidth, viewportHeight, step);
      if (winner) {
        winner = { ...winner, bounds, scale, collision: false };
        break;
      }
    }

    if (!winner) {
      const scale = CARD_SCALES[CARD_SCALES.length - 1];
      const bounds = { width: baseBounds.width * scale, height: baseBounds.height * scale };
      winner = {
        ...clampCenter(item.screen.x, item.screen.y, bounds, viewportWidth, viewportHeight),
        bounds,
        scale,
        collision: true
      };
    }

    const resolved = {
      ...item,
      screen: {
        ...item.screen,
        x: winner.x,
        y: winner.y,
        scale: winner.scale,
        collision: winner.collision
      }
    };
    output.push(resolved);
    placed.push({
      id: item.id,
      kind: item.kind,
      screen: resolved.screen,
      bounds: winner.bounds
    });
  }

  if (output.some(item => item.screen.collision)) {
    return packDenseLabels(items, viewportWidth, viewportHeight) || output;
  }
  return output;
}
