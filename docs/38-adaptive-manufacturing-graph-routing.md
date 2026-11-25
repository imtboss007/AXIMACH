# Adaptive Manufacturing Graph Routing

## Purpose

This change repairs connector geometry consistency across Route Flow, Process Map and Manufacturing Universe without replacing AXIMACH's persisted manufacturing relationship model or adding another graph dependency.

## Shared geometry

`src/manufacturingGraphLayout.mjs` now provides `routeRelationshipEdgeGeometry` and geometry-aware `routeRelationshipHandles`.

- Source and target ports are selected from the actual source-to-target node direction.
- Reversed links use the opposite ports; vertical links use top/bottom ports.
- Orthogonal, vertical and swimlane layouts use rounded smooth-step connectors.
- The other route layouts use Bezier connectors instead of forcing straight horizontal edges.
- Relationship types and additional parallel links receive different path offsets or curvatures.

## View integration

- Route Flow applies the shared helper per edge rather than selecting one global edge shape for the entire graph.
- Process Map uses the selected route layout to position its saved PO-line operation nodes and uses the same edge-geometry helper.
- Manufacturing Universe uses the same geometry-aware ports and curved edge routing on its grouped entity layout.
- Node IDs, stored route relationships, material allocations, explicit transport endpoints, vehicle records and source-module navigation remain the source of truth.

## Verification

The adaptive geometry tests cover directional ports, reverse and vertical edges, curved layouts, rounded orthogonal routing, all eleven route relationship types plus transport, and separate paths for parallel relationships. The functional suite runs these tests through `npm run test:functional`.

A passing build is not visual acceptance. Real populated multi-branch fixtures and desktop/Android screenshots must still be reviewed for clipping, overlapping edges, label legibility and route consistency before this work is accepted.
