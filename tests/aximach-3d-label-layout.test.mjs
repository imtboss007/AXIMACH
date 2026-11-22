import test from "node:test";
import assert from "node:assert/strict";
import { relaxProcessSceneLabels } from "../src/processSceneLabelLayout.js";

const boundsByKind = {
  operation: { width: 184, height: 124 },
  material: { width: 194, height: 174 },
  transport: { width: 48, height: 48 },
  transportLeg: { width: 48, height: 48 },
  catalogue: { width: 184, height: 124 },
  core: { width: 140, height: 56 }
};
const gap = 14;

function assertNoCollisions(items) {
  const boxes = items.map(item => {
    const base = boundsByKind[item.kind];
    const scale = item.screen.scale ?? 1;
    return { id: item.id, x: item.screen.x, y: item.screen.y, width: base.width * scale, height: base.height * scale };
  });
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i], b = boxes[j];
      const overlaps = Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
        Math.abs(a.y - b.y) < (a.height + b.height) / 2 + gap;
      assert.equal(overlaps, false, "labels overlap: " + a.id + " / " + b.id);
    }
  }
}

test("clusters mixed process, catalogue, material and transport labels without collisions", () => {
  const items = [
    { id: "core", kind: "core", screen: { x: 600, y: 350, z: 0 } },
    ...Array.from({ length: 14 }, (_, i) => ({
      id: "operation-" + i, kind: "operation",
      screen: { x: 600 + (i % 4) * 3, y: 350 + (i % 3) * 3, z: 0 }
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      id: "material-" + i, kind: "material",
      screen: { x: 604, y: 354, z: 0 }
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: "catalogue-" + i, kind: "catalogue",
      screen: { x: 598, y: 348, z: 0 }
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: "transport-" + i, kind: "transport",
      screen: { x: 600, y: 350, z: 0 }
    }))
  ];
  const result = relaxProcessSceneLabels(items, 1280, 800);
  assert.equal(result.length, items.length);
  assert.deepEqual(result.map(item => item.id), items.map(item => item.id));
  assertNoCollisions(result);
});

test("uses compact card scale before accepting an overlap in dense viewports", () => {
  const items = [
    ...Array.from({ length: 22 }, (_, i) => ({
      id: "dense-" + i, kind: i % 5 === 0 ? "material" : i % 4 === 0 ? "catalogue" : "operation",
      screen: { x: 490 + (i % 2), y: 300 + (i % 3), z: 0 }
    })),
    // Material and transport labels share a route ID in real Process Map data.
    { id: "dense-0", kind: "transport", screen: { x: 490, y: 300, z: 0 } }
  ];
  const result = relaxProcessSceneLabels(items, 1080, 700);
  assert.equal(result.length, items.length);
  assert.ok(result.every(item => item.screen.scale >= 0.78 && item.screen.scale <= 1));
  assertNoCollisions(result);
});

test("keeps edge labels clamped within the visible overlay and preserves original depth", () => {
  const result = relaxProcessSceneLabels([
    { id: "left", kind: "operation", screen: { x: -100, y: 90, z: .2 } },
    { id: "right", kind: "catalogue", screen: { x: 900, y: 90, z: .4 } },
    { id: "bottom", kind: "material", screen: { x: 400, y: 900, z: .6 } }
  ], 800, 520);
  assert.equal(result.length, 3);
  for (const item of result) {
    assert.ok(item.screen.x >= 0 && item.screen.x <= 800);
    assert.ok(item.screen.y >= 0 && item.screen.y <= 520);
  }
  assert.deepEqual(result.map(item => item.screen.z), [.2, .4, .6]);
});


test("keeps full label rectangles inside phone, short-landscape, hybrid-tablet and desktop scene bounds", () => {
  const items = [
    { id: "core", kind: "core", screen: { x: 190, y: 210, z: 0 } },
    ...Array.from({ length: 10 }, (_, i) => ({
      id: "phone-operation-" + i, kind: "operation",
      screen: { x: 190 + (i % 3) * 2, y: 210 + (i % 4) * 2, z: 0 }
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      id: "phone-material-" + i, kind: "material",
      screen: { x: 192, y: 212, z: 0 }
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: "phone-catalogue-" + i, kind: "catalogue",
      screen: { x: 188, y: 208, z: 0 }
    })),
    { id: "phone-transport", kind: "transport", screen: { x: 190, y: 210, z: 0 } },
    { id: "phone-transport-leg", kind: "transportLeg", screen: { x: 190, y: 210, z: 0 } }
  ];

  for (const viewport of [
    { width: 390, height: 844, name: "phone portrait" },
    { width: 844, height: 390, name: "short landscape" },
    { width: 1365, height: 620, name: "hybrid tablet landscape" },
    { width: 1280, height: 800, name: "desktop" }
  ]) {
    const result = relaxProcessSceneLabels(items, viewport.width, viewport.height);
    assert.equal(result.length, items.length, viewport.name + " must retain every label");
    for (const item of result) {
      const base = boundsByKind[item.kind];
      const scale = item.screen.scale ?? 1;
      const left = item.screen.x - base.width * scale / 2;
      const right = item.screen.x + base.width * scale / 2;
      const top = item.screen.y - base.height * scale / 2;
      const bottom = item.screen.y + base.height * scale / 2;
      assert.ok(left >= -0.5, viewport.name + " clips left edge of " + item.id + ": " + left);
      assert.ok(right <= viewport.width + 0.5, viewport.name + " clips right edge of " + item.id + ": " + right);
      assert.ok(top >= -0.5, viewport.name + " clips top edge of " + item.id + ": " + top);
      assert.ok(bottom <= viewport.height + 0.5, viewport.name + " clips bottom edge of " + item.id + ": " + bottom);
    }
  }
});
