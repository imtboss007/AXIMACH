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


## Transport vehicle identity expansion

Transport Directory and all Route Flow, Process Map and Manufacturing Universe surfaces use the shared `getVehicleVisual` resolver in `src/TransportVehicle.tsx`.

Canonical classes now include two-wheeler/bike, car, auto-rickshaw/three-wheeler, tempo goods carrier, heavy-duty tempo, mini truck, pickup, lorry, heavy lorry, heavy truck, container, trailer, bus, van, air, ship and rail. Auto-rickshaw, tempo, heavy-tempo, mini-truck, lorry and heavy-lorry receive purpose-drawn vector silhouettes; remaining classes use their dedicated Lucide vehicle icons.

Vehicle class resolution is shared across the directory, 2D route connectors, Process Map cards, Process Map route insertions, 3D scene markers and transport inspectors. Courier/delivery now resolves to a van identity rather than being misclassified as a bike. New class colour tokens are defined in `src/aximach-ui.css`.

Acceptance is covered in `tests/aximach-transport-route-demo.test.mjs`; source-level regressions in the route and Process Map suites now target the shared resolver rather than the removed duplicate vehicle mapping.


## Unified single-company / single-component acceptance model

The earlier demonstration embedded two unrelated examples: AST-1001 Motor mounting bracket in the relationship graph and AX-DEMO-HMB-01 Hydraulic manifold block in the route/transport lanes. That was not an acceptable end-to-end demonstration of one company and one component.

The canonical source is now `src/single-component-route-demo.json`. Both `SingleComponentRouteGraphDemo` and `TransportRoutingDemo` consume this same file. It identifies exactly one synthetic company, one PO, one PO line and one top-level component (AST-1001 Precision multi-process drive module assembly). BOM subassembly operations remain scoped to that one component and company.

The example consolidates the existing process catalogue categories into the same component route: Sawing, Turning, Wire EDM, Gear Cutting, Heat Treatment, Grinding, Metrology, Laser Cutting, Forming, Fabrication, Welding, Finishing, Quality, VMC Machining, Deburring, Assembly, Packaging and a qualified Punching alternative. It shows 28 priced operations across 18 categories, including Wire EDM and fixture-based fabrication, parallel BOM workstreams, a qualified alternate route, conditional rework, quality feedback, material flows, directional transport and downstream successors.

Every process operation carries a synthetic quantity, rate per piece and extended planned amount. The rate graph and cost table show each process line. Materials, process cost and transport cost remain separate; alternate and rework costs are excluded from the base scenario until selected. Transport legs and material feeds carry the same company, PO, PO-line and component identifiers.

This remains an isolated preview and does not create, seed or mutate live manufacturing records. Tests now verify the one-company / one-PO / one-component invariant, shared fixture usage, complete process-category coverage, operation-rate calculations, graph edge coverage and transport/material scope.
