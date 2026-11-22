import test from "node:test";
import assert from "node:assert/strict";
import { getFloatingMenuPosition } from "../src/floatingMenuLayout.js";

test("floating menu flips above an anchor near the bottom of a phone viewport", () => {
  const position = getFloatingMenuPosition(
    { left: 18, right: 358, top: 728, bottom: 766, width: 340 },
    { width: 390, height: 844 },
    { maxHeight: 250, minWidth: 210, margin: 8, gap: 6 }
  );

  assert.equal(position.placement, "top");
  assert.equal(position.top, 472);
  assert.equal(position.left, 18);
  assert.equal(position.width, 340);
  assert.equal(position.maxHeight, 250);
  assert.ok(position.top >= 8);
  assert.ok(position.top + position.maxHeight <= 844 - 8);
});

test("floating menu remains below an anchor when there is enough visible space", () => {
  const position = getFloatingMenuPosition(
    { left: 24, right: 344, top: 120, bottom: 158, width: 320 },
    { width: 390, height: 844 },
    { maxHeight: 250, minWidth: 210, margin: 8, gap: 6 }
  );

  assert.equal(position.placement, "bottom");
  assert.equal(position.top, 164);
  assert.equal(position.left, 24);
  assert.equal(position.width, 320);
  assert.equal(position.maxHeight, 250);
});

test("floating menu clamps its width and horizontal position on narrow viewports", () => {
  const position = getFloatingMenuPosition(
    { left: 270, right: 304, top: 100, bottom: 138, width: 34 },
    { width: 320, height: 640 },
    { maxHeight: 250, minWidth: 210, margin: 8, gap: 6 }
  );

  assert.equal(position.width, 304);
  assert.equal(position.left, 8);
  assert.ok(position.left >= 8);
  assert.ok(position.left + position.width <= 320 - 8);
});

test("floating menu uses the available landscape height without leaving the viewport", () => {
  const position = getFloatingMenuPosition(
    { left: 12, right: 246, top: 64, bottom: 102, width: 234 },
    { width: 844, height: 390 },
    { maxHeight: 310, minWidth: 210, margin: 8, gap: 6 }
  );

  assert.equal(position.placement, "bottom");
  assert.equal(position.maxHeight, 274);
  assert.ok(position.top >= 8);
  assert.ok(position.top + position.maxHeight <= 390 - 8);
});

test("floating menu flips above when more room exists above than below", () => {
  const position = getFloatingMenuPosition(
    { left: 80, right: 300, top: 620, bottom: 658, width: 220 },
    { width: 390, height: 700 },
    { maxHeight: 250, minWidth: 210, margin: 8, gap: 6 }
  );

  assert.equal(position.placement, "top");
  assert.ok(position.top >= 8);
  assert.ok(position.top + position.maxHeight <= 700 - 8);
});
