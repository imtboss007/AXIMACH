import test from "node:test";
import assert from "node:assert/strict";
import {
  PROCESS_MAP_GEOMETRY_MODES,
  cycleProcessMapGeometryMode,
  getProcessMapGeometryPoint
} from "../src/processMapGeometry.ts";

test("3D geometry arrows cycle through all modes and wrap at both ends", () => {
  assert.equal(cycleProcessMapGeometryMode("sphere", -1), "vortex");
  assert.equal(cycleProcessMapGeometryMode("vortex", 1), "sphere");
  assert.equal(cycleProcessMapGeometryMode("cube", 1), "pyramid");
  assert.equal(cycleProcessMapGeometryMode("pyramid", -1), "cube");
  assert.equal(PROCESS_MAP_GEOMETRY_MODES.length, 6);
});

test("every 3D mode places route stages at distinct finite positions inside the view volume", () => {
  for (const mode of PROCESS_MAP_GEOMETRY_MODES.map(item => item.id)) {
    const points = Array.from({ length: 9 }, (_, index) => getProcessMapGeometryPoint(mode, index, 9));
    const signatures = points.map(point => [point.x, point.y, point.z].map(value => value.toFixed(4)).join(":"));
    assert.equal(new Set(signatures).size, points.length, mode + " positions must not overlap exactly");
    for (const point of points) {
      for (const value of [point.x, point.y, point.z, point.rotateX, point.rotateY]) {
        assert.equal(Number.isFinite(value), true, mode + " must return finite coordinates");
      }
      assert.ok(Math.abs(point.x) <= 1.01, mode + " x is inside the view volume");
      assert.ok(Math.abs(point.y) <= 1.01, mode + " y is inside the view volume");
      assert.ok(Math.abs(point.z) <= 1.01, mode + " z is inside the view volume");
    }
  }
});

test("sphere mode distributes stages in three dimensions rather than a flat row", () => {
  const points = Array.from({ length: 12 }, (_, index) => getProcessMapGeometryPoint("sphere", index, 12));
  assert.ok(points.some(point => point.z > 0.4));
  assert.ok(points.some(point => point.z < -0.4));
  assert.ok(points.some(point => point.y > 0.5));
  assert.ok(points.some(point => point.y < -0.5));
});

test("cube mode uses six outward-facing cube sides", () => {
  const points = Array.from({ length: 6 }, (_, index) => getProcessMapGeometryPoint("cube", index, 6));
  assert.ok(points.some(point => point.z > 0.9));
  assert.ok(points.some(point => point.z < -0.9));
  assert.ok(points.some(point => point.x > 0.9));
  assert.ok(points.some(point => point.x < -0.9));
  assert.ok(points.some(point => point.y > 0.9));
  assert.ok(points.some(point => point.y < -0.9));
});

test("pyramid mode stacks route stages into progressively wider tiers", () => {
  const points = Array.from({ length: 10 }, (_, index) => getProcessMapGeometryPoint("pyramid", index, 10));
  const yTiers = new Set(points.map(point => point.y.toFixed(3)));
  assert.ok(yTiers.size >= 3);
  assert.ok(Math.min(...points.map(point => point.y)) < Math.max(...points.map(point => point.y)));
});

test("single-stage and empty routes have stable centered geometry", () => {
  const single = getProcessMapGeometryPoint("sphere", 0, 1);
  assert.equal(single.x, 0);
  assert.equal(single.y, 0);
  const empty = getProcessMapGeometryPoint("cube", 0, 0);
  assert.equal(empty.x, 0);
  assert.equal(empty.y, 0);
  assert.equal(empty.z, 0);
});
