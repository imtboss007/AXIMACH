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

- The main dashboard and 3D Command Centre share the same manually draggable globe component; the lower live-record shell is a separate rotator. Neither sphere should auto-rotate while idle.
- The 18 module controls use Fibonacci-sphere coordinates distributed across the full spherical surface. Rear-facing controls are hidden by back-face culling until the operator rotates them into view. The WebGL globe surface texture receives the same drag orientation as a shader uniform, so the spherical silhouette stays round instead of rotating as a flat canvas plane.
- The lower shell carries six live record categories: companies, purchase orders, PO component lines, components, vendors and open operations.
- Component Master and Purchase Order PDF/Excel exports include the component logo. A saved imported SVG/PNG logo is preferred when present; otherwise the deterministic name-based mechanical symbol is used.
- Every saved Component Master row opens Logo Studio with its own stable component ID preselected. The Component Master also exposes the 46-symbol mechanical inventory; Process Directory exposes the same inventory and per-process Logo Studio actions.
- Process Directory PDF/Excel exports include the saved process logo asset where available, with a process-name-based mechanical glyph fallback.
- Process Directory keeps a process-type colour and provides a stable-ID Logo Studio action for each process definition. Sub-process logo assignments use stable subcategory IDs.
- Example company/vendor/PO data remain an isolated acceptance fixture. The application must not seed Company XYZ or PO-1 into live records.

## Manual device acceptance still required

Automated tests and CI verify source contracts, type-checking, web packaging, Windows installation/launch and Android APK generation. They do not certify touch hit-targets, visual depth sorting, real-device WebGL fallback, print-to-PDF rendering, Excel image rendering, or PC-to-Android round-trip sync. Those checks must be completed in the deployed browser/PC and Android app before release approval.
