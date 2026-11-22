const CARD_BOUNDS = Object.freeze({
  operation: { width: 184, height: 124 },
  material: { width: 194, height: 174 },
  transport: { width: 48, height: 48 },
  transportLeg: { width: 48, height: 48 },
  catalogue: { width: 184, height: 124 },
  core: { width: 140, height: 56 }
});

const LABEL_GAP = 14;
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

function overlapScore(candidate, bounds, placed) {
  let score = 0;
  for (const other of placed) {
    const overlapX = Math.max(0, (bounds.width + other.bounds.width) / 2 + LABEL_GAP - Math.abs(candidate.x - other.screen.x));
    const overlapY = Math.max(0, (bounds.height + other.bounds.height) / 2 + LABEL_GAP - Math.abs(candidate.y - other.screen.y));
    score += overlapX * overlapY;
  }
  return score;
}

function findNearestFreeSlot(anchor, bounds, placed, width, height, step) {
  let winner = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const test = raw => {
    const candidate = clampCenter(raw.x, raw.y, bounds, width, height);
    if (!isFree(candidate, bounds, placed)) return;
    const dx = candidate.x - anchor.x;
    const dy = candidate.y - anchor.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      winner = candidate;
    }
  };

  test(anchor);
  const minX = Math.min(bounds.width / 2 + 7, width / 2);
  const maxX = Math.max(minX, width - bounds.width / 2 - 7);
  const minY = Math.min(bounds.height / 2 + 24, height / 2);
  const maxY = Math.max(minY, height - bounds.height / 2 - 42);

  // Scan the whole usable canvas, not only a clamped spiral around the anchor.
  // Clamping many spiral points to the same edge can hide free interior slots.
  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      test({ x, y });
    }
  }
  return winner;
}

function findLeastOverlapSlot(anchor, bounds, placed, width, height, step) {
  let winner = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestDistance = Number.POSITIVE_INFINITY;
  const minX = Math.min(bounds.width / 2 + 7, width / 2);
  const maxX = Math.max(minX, width - bounds.width / 2 - 7);
  const minY = Math.min(bounds.height / 2 + 24, height / 2);
  const maxY = Math.max(minY, height - bounds.height / 2 - 42);

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      const candidate = { x, y };
      const score = overlapScore(candidate, bounds, placed);
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      const distance = dx * dx + dy * dy;
      if (score < bestScore || (score === bestScore && distance < bestDistance)) {
        bestScore = score;
        bestDistance = distance;
        winner = candidate;
      }
    }
  }
  return winner ? { ...winner, collision: bestScore > 0 } : null;
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
    const baseBounds = CARD_BOUNDS[item.kind] || CARD_BOUNDS.operation;
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
        ...(findLeastOverlapSlot(item.screen, bounds, placed, viewportWidth, viewportHeight, step) ||
          clampCenter(item.screen.x, item.screen.y, bounds, viewportWidth, viewportHeight)),
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

  return output;
}
