import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("material process link collection is normalized, merged and server-synced", () => {
  const client = readFileSync(new URL("../src/manufacturingData.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("../server/manufacturing-data.mjs", import.meta.url), "utf8");
  assert.ok(client.includes("materialProcessLinks: MaterialProcessLinkRecord[]"));
  assert.ok(client.includes("materialProcessLinks: mergeRows(local.materialProcessLinks, remote.materialProcessLinks)"));
  assert.ok(server.includes('"materialProcessLinks"'));
});

test("vehicle marker is icon-only and popup resolves the saved directory route plus leg snapshot", () => {
  const source = readFileSync(new URL("../src/TransportVehicle.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("routeRecord?: TransportRouteRecord"));
  assert.ok(source.includes("Transport Directory ID:"));
  assert.ok(source.includes("Saved component rate snapshot:"));
  assert.ok(!source.includes("<span>TRANSPORT</span>"));
  assert.ok(!source.includes("<small>{leg.vehicleType}</small>"));
});

test("material markers and connector legend distinguish material, main, alternate, rework and transport links", () => {
  const marker = readFileSync(new URL("../src/MaterialFlowMarker.tsx", import.meta.url), "utf8");
  const legend = readFileSync(new URL("../src/RouteConnectorLegend.tsx", import.meta.url), "utf8");
  for (const value of ["MATERIAL → PROCESS LINK","BOM line:","Process operation:","PO requirement:"]) assert.ok(marker.includes(value));
  for (const value of ["Main route","Alternate route","Rework route","Material → process","Transport leg · vehicle colour"]) assert.ok(legend.includes(value));
});
