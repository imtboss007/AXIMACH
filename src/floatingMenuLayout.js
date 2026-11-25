/**
 * Calculate a viewport-safe fixed position for an anchored picker menu.
 * Pure geometry: no DOM access, so phone/tablet edge cases stay unit-testable.
 */
export function getFloatingMenuPosition(anchor, viewport, options = {}) {
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const viewportWidth = Math.max(1, finite(viewport.width, 1));
  const viewportHeight = Math.max(1, finite(viewport.height, 1));
  const margin = Math.max(0, finite(options.margin, 8));
  const gap = Math.max(0, finite(options.gap, 6));
  const preferredHeight = Math.max(0, finite(options.maxHeight, 250));
  const minimumWidth = Math.max(0, finite(options.minWidth, 0));

  const availableWidth = Math.max(1, viewportWidth - margin * 2);
  const anchorWidth = Math.max(0, finite(anchor.width, 0));
  const width = Math.min(Math.max(anchorWidth, minimumWidth), availableWidth);
  const maxLeft = Math.max(margin, viewportWidth - margin - width);
  const left = Math.max(margin, Math.min(maxLeft, finite(anchor.left, margin)));

  const topEdge = finite(anchor.top, 0);
  const bottomEdge = finite(anchor.bottom, topEdge);
  const availableAbove = Math.max(0, topEdge - gap - margin);
  const availableBelow = Math.max(0, viewportHeight - bottomEdge - gap - margin);

  let placement = "bottom";
  if (availableBelow < preferredHeight && availableAbove > availableBelow) {
    placement = "top";
  }
  const availableHeight = placement === "top" ? availableAbove : availableBelow;
  const maxHeight = Math.min(preferredHeight, availableHeight);
  const rawTop = placement === "top"
    ? topEdge - gap - maxHeight
    : bottomEdge + gap;
  const maxTop = Math.max(margin, viewportHeight - margin - maxHeight);
  const top = Math.max(margin, Math.min(maxTop, rawTop));

  return { position: "fixed", top, left, width, maxHeight, placement };
}
