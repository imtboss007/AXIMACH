# AXIMACH linked-workflow acceptance — five example parts

This is an isolated synthetic test fixture. It is **not** seeded into the live AXIMACH workspace and must not overwrite customer records.

## Example parts

| Part | Component | Process families | Precision class |
|---|---|---|---|
| AX-1001 | Precision spindle sleeve | CNC turning, heat treatment, cylindrical/internal grinding, metrology | Ultra Precision |
| AX-1002 | Standard motor mounting bracket | Laser cutting, press-brake forming, MIG welding, coating, quality | Standard |
| AX-1003 | Ground transmission gear shaft | CNC turning, gear hobbing, carburising, grinding, metrology | Precision |
| AX-1004 | Hydraulic manifold block | VMC milling, deep-hole drilling, tapping, deburring, pressure inspection | Precision |
| AX-1005 | Standard fixture base plate | Sawing, face milling, drilling/tapping, surface grinding, quality | Standard |

The machine-readable process/category/sub-process fixture is in [tests/fixtures/aximach-five-part-process-catalog.json](../tests/fixtures/aximach-five-part-process-catalog.json).

## Acceptance sequence

1. Create one synthetic company and one PO containing the five component lines from the fixture. Keep this dataset isolated from live customer data.
2. Create Process Directory definitions for every category → process type → sub-process combination. Confirm multiple process types per category and multiple sub-processes per process type can be selected.
3. Assign at least two synthetic vendors to overlapping process capabilities; confirm Process Directory, Vendor Directory and Vendor Network resolve the same vendor/process IDs.
4. Create the operation chains per part in Process Plan. Confirm each operation stores the same company, PO, PO-line and component IDs, plus its process-definition ID and tolerance class.
5. From Vendor Network / Vendor Directory, open an assigned operation. Process Plan must open the exact PO, component line and operation; vendor-only navigation must resolve a saved operation for that vendor.
6. From Process Plan, open Quality Inspection. The inspection list and measurement selector must be restricted to the exact operation context. Save a synthetic measurement and confirm its history retains operation, PO-line and component IDs.
7. From Process Plan, open Costing. Confirm company, PO, component, operation and vendor context are retained; quote and payment records must remain attached to the same operation ID.
8. From Production Plan, open Process Plan for each PO line. When the incoming context contains an operation ID, reopen that exact operation. Confirm PO/component filters are applied and Clear filters restores the complete job list.
9. Add a transport leg before/after an operation for one part. Confirm the same PO-line and anchor operation appear in Process Map and Transport & Dispatch, with transport cost kept separate from process cost.
10. Repeat with exact numeric and partial searches (for example `AX-1001`, `1001`, `AX-100`, and a process code) and verify no unrelated record is returned.

## Pass criteria

- No navigation path silently substitutes a different PO line, component, vendor, or operation.
- No lookup relies only on mutable display names when a stable record ID exists.
- Ultra Precision, Precision and Standard classifications remain distinct from measured inspection results. A class label is not proof of a part passing inspection.
- Transport legs, operation costs, payment records, inspection history and PO job completion remain separate records with explicit links.
- No fixture row is inserted into production automatically.
- Test on the same configured shared-data server for PC and Android; CI builds alone do not prove physical-device round-trip sync.

## Command globe and logo export acceptance additions

- The main dashboard and 3D Command Centre share the same full WebGL sphere component. The 20-module shell and separate lower live-record shell auto-rotate by default; pointer/touch drag takes over immediately, and Pause auto-rotation stops idle movement. The sphere includes every official module, including Route Flow & Relationships and Manufacturing Universe. Each shell has an independent drag lock/unlock control, and each workspace surface retains its own saved interaction preferences.
- The 20 module controls use Fibonacci-sphere coordinates distributed across the full spherical surface. Rear-facing controls are hidden by back-face culling until the operator rotates them into view. The WebGL globe surface texture receives the same drag orientation as a shader uniform, so the spherical silhouette stays round instead of rotating as a flat canvas plane.
- The lower shell carries six live record categories: companies, purchase orders, PO component lines, components, vendors and open operations.
- Component Master and Purchase Order PDF/Excel exports include the component logo. A saved imported SVG/PNG logo is preferred when present; otherwise the deterministic name-based mechanical symbol is used.
- Every saved Component Master row opens Logo Studio with its own stable component ID preselected. The Component Master also exposes the 46-symbol mechanical inventory; Process Directory exposes the same inventory and per-process Logo Studio actions.
- Process Directory PDF/Excel exports include the saved process logo asset where available, with a process-name-based mechanical glyph fallback.
- Process Directory keeps a process-type colour and provides a stable-ID Logo Studio action for each process definition. Sub-process logo assignments use stable subcategory IDs. Process Plan operations and Component Planned Cost rows persist both the Process Directory definition ID and the selected stable subcategory ID; adding a sub-process inherits its parent definition before the user selects a permitted subcategory. Vendor Network and Contact 360 derive their Process Directory subcategory filter options from those stable IDs as well, while separate manually entered Contact 360 capability tags remain explicitly labelled as contact-level metadata.
- Example company/vendor/PO data remain an isolated acceptance fixture. The application must not seed Company XYZ or PO-1 into live records.

## Automated interaction-contract coverage and manual device acceptance

- Regression tests assert that the 10 Process Plan view buttons select the matching visual renderer, with 3D Sphere, Vortex and Combined 3D opening the corresponding 3D layout. Dashboard and Command Centre sphere tests also assert no idle auto-rotation timer, direct drag on the WebGL sphere core, independent lower-shell drag control, and clickable module navigation.
- Alternate and rework branch origin resolution walks the complete parent chain, so a selected-branch or selected-operation route scope still displays the original parent connection. Main-route connectors use process colour, alternate connectors use blue and rework connectors use orange. The same arrow connectors render directly in the 3D process orbit, including a parent-origin marker when the parent is outside the current scope.
- Route-scope regression checks cover the selected diagram data and all five export handlers. Physical end-to-end checks must still be completed on a configured PC and Android device.

## Manual device acceptance still required

Automated tests and CI verify source contracts, type-checking, web packaging, Windows installation/launch and Android APK generation. They do not certify touch hit-targets, visual depth sorting, real-device WebGL fallback, print-to-PDF rendering, Excel image rendering, or PC-to-Android round-trip sync. Those checks must be completed in the deployed browser/PC and Android app before release approval.


## Multi-route / multi-transport demonstration — isolated fixture

The fixture `tests/fixtures/aximach-transport-routing-demo.json` is a synthetic hydraulic-manifold example and is not loaded into the live workspace. One component line follows VMC machining, deep-hole subcontracting, heat treatment, grinding and inspection, with separate transport legs before/after the relevant operations. The alternate grinding supplier has its own anchored transport leg and remains excluded while that branch is inactive.

Acceptance checks:
- All legs retain the same component, PO and PO-line IDs while each route, vendor and anchor operation resolves independently.
- The route graph and Manufacturing Universe show a vehicle-specific icon at the leg's placement; selecting it opens the stored route, vendor, vehicle, direction, trip count, snapshot rate and amount.
- Vehicle categories retain distinct icon/colour identities in Transport Directory and the linked route views.
- Main-route transport cost is ₹3,850 in the fixture; alternate-branch transport is ₹480 and is included only when that branch is activated. Transport remains separate from process cost.
- Portrait layout exposes a vertically scrollable step rail on the left; route cards stack compactly. Full-screen attempts a landscape orientation lock where the browser permits it and otherwise requests manual rotation.
- No synthetic company, PO, component, vendor, operation or transport route is inserted into live local/shared data.

Automated coverage is in `tests/aximach-transport-route-demo.test.mjs`. Browser/device acceptance (portrait, landscape, fullscreen orientation support, touch hit targets and popup placement) remains a physical-device check.


## Multi-material / multi-process routing and connector acceptance

- Every production material flow is a separate materialProcessLinks record keyed by company, PO, PO line, component, BOM line, material and operation IDs.
- One component can link several BOM materials to different process operations. A process can receive more than one material. Material links do not reuse transport-leg IDs and do not post stock movements.
- Inventory provides a Material → process tab. It creates a persistent material feed mapping using the real PO line, component BOM material and process operation. The Process Map tab opens that exact PO-line scope.
- Process Map and Manufacturing Universe show a small material icon at the before/after position of its exact process operation. Clicking it opens the saved material/BOM/operation/PO quantity details.
- Transport markers are vehicle icons only. Clicking one opens the exact component transport leg and its associated Transport Directory master route, including master rate versus saved rate snapshot.
- The route legend distinguishes main (solid), alternate (dashed), rework (dotted), material feed (cyan dashed) and transport (vehicle-specific icon/colour) connections.
- The isolated hydraulic manifold fixture has three distinct materials mapped to three different process steps and six transport legs across the primary and alternate paths. Demo data remains test-only and must not be inserted into live records.

Automated coverage is in tests/aximach-material-process-links.test.mjs. Browser/device acceptance (portrait, landscape, full-screen orientation support, touch hit targets and popup placement) remains a physical-device check.
