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

function overlapScore(candidate, bounds, placed) {
  let score = 0;
  for (const other of placed) {
    const overlapX = Math.max(0, (bounds.width + other.bounds.width) / 2 + LABEL_GAP - Math.abs(candidate.x - other.screen.x));
    const overlapY = Math.max(0, (bounds.height + other.bounds.height) / 2 + LABEL_GAP - Math.abs(candidate.y - other.screen.y));
    score += overlapX * overlapY;
  }
  return score;
}

function isFree(candidate, bounds, placed) {
  return placed.every(other =>
    Math.abs(candidate.x - other.screen.x) >= (bounds.width + other.bounds.width) / 2 + LABEL_GAP ||
    Math.abs(candidate.y - other.screen.y) >= (bounds.height + other.bounds.height) / 2 + LABEL_GAP
  );
}

/**
 * Position all DOM cards and transport markers in the same 2D overlay space.
 * Cards search outward from their projected 3D anchor until a collision-free
 * slot is found. Selected process and fixed core labels should be supplied
 * before secondary labels so they retain their visual priority.
 */
export function relaxProcessSceneLabels(items, width, height) {
  const viewportWidth = Math.max(1, Number(width) || 1);
  const viewportHeight = Math.max(1, Number(height) || 1);
  const step = Math.max(18, Math.min(28, Math.round(Math.min(viewportWidth, viewportHeight) / 24)));
  const maximumRing = Math.ceil(Math.max(viewportWidth, viewportHeight) / step) + 2;
  const placed = [];
  const output = [];

  for (const item of items) {
    const baseBounds = CARD_BOUNDS[item.kind] || CARD_BOUNDS.operation;
    const isCard = item.kind === "operation" || item.kind === "material" || item.kind === "catalogue";
    const scales = isCard ? CARD_SCALES : [1];
    let winner = null;

    for (const scale of scales) {
      const bounds = { width: baseBounds.width * scale, height: baseBounds.height * scale };
      const seen = new Set();

      for (const [dx, dy] of squareSpiral(step, maximumRing)) {
        const candidate = clampCenter(item.screen.x + dx, item.screen.y + dy, bounds, viewportWidth, viewportHeight);
        const key = Math.round(candidate.x) + ":" + Math.round(candidate.y);
        if (seen.has(key)) continue;
        seen.add(key);

        if (isFree(candidate, bounds, placed)) {
          winner = { ...candidate, bounds, scale, collision: false };
          break;
        }
      }
      if (winner) break;
    }

    if (!winner) {
      const scale = CARD_SCALES[CARD_SCALES.length - 1];
      const bounds = { width: baseBounds.width * scale, height: baseBounds.height * scale };
      let bestScore = Number.POSITIVE_INFINITY;
      let bestDistance = Number.POSITIVE_INFINITY;
      const seen = new Set();

      for (const [dx, dy] of squareSpiral(step, maximumRing)) {
        const candidate = clampCenter(item.screen.x + dx, item.screen.y + dy, bounds, viewportWidth, viewportHeight);
        const key = Math.round(candidate.x) + ":" + Math.round(candidate.y);
        if (seen.has(key)) continue;
        seen.add(key);
        const score = overlapScore(candidate, bounds, placed);
        const distance = dx * dx + dy * dy;
        if (score < bestScore || (score === bestScore && distance < bestDistance)) {
          bestScore = score;
          bestDistance = distance;
          winner = { ...candidate, bounds, scale, collision: score > 0 };
          if (score === 0) break;
        }
      }
    }

    const resolved = {
      ...item,
      screen: {
        ...item.screen,
        x: winner?.x ?? clampCenter(item.screen.x, item.screen.y, baseBounds, viewportWidth, viewportHeight).x,
        y: winner?.y ?? clampCenter(item.screen.x, item.screen.y, baseBounds, viewportWidth, viewportHeight).y,
        scale: winner?.scale ?? 1,
        collision: winner?.collision ?? true
      }
    };
    output.push(resolved);
    placed.push({
      id: item.id,
      kind: item.kind,
      screen: resolved.screen,
      bounds: winner?.bounds ?? baseBounds
    });
  }

  return output;
}
