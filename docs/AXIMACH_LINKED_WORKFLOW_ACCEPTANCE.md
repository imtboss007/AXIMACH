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
