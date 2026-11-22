# AXIMACH — 111-entry technology and repository inventory

This is the AXIMACH working copy of the supplied **111-entry technology audit**.

## Source and coverage

The supplied workbook, `AXIMACH_104_Repository_Audit.xlsx`, contains:
- **104 repository/tool candidates** in `Repository Audit`;
- **7 service/product entries** in `Service Audit`;
- an AXIMACH-specific review/adoption snapshot for the 104 repository candidates in `AXIMACH Audit`;
- a separate AXIMACH integration plan, summary and CI snapshot.

The three CSV files preserve all **111 unique inventory entries** with the candidate name, category, canonical source, recorded licence/terms and AXIMACH review/selection/integration/test status plus next action.

| CSV | Entries |
|---|---:|
| `111-entry-inventory-part-01.csv` | 1–38 |
| `111-entry-inventory-part-02.csv` | 39–76 |
| `111-entry-inventory-part-03.csv` | 77–111 |
| **Total** | **111** |

The seven service/product rows were not included in the workbook's 104-row AXIMACH implementation audit. They are explicitly marked **Not separately reviewed / Not selected / Not integrated / Not tested** here; those are not converted into approvals.

## AXIMACH audit snapshot carried forward

The source workbook records, for the 104 repository/tool rows:
- 98 reviewed = Yes, 2 reviewed = Partial, 4 reviewed = No;
- 13 selected = Yes, 14 selected = Conditional, 77 selected = No;
- 5 integrated = Yes, 1 integrated = Partial, 98 integrated = No;
- 3 tested = Partial, 2 tested = Not tested, 99 tested = N/A.

These are the **source workbook's snapshot statuses**, not a fresh assertion that the present branch has the same status. The current source tree must be checked before each implementation decision. In particular, this branch now imports and uses `@xyflow/react` in the Process Map and Route Flow workspaces, so the workbook's older React Flow “not integrated” record is stale for the current branch.

## How AXIMACH must use the inventory

1. **Do not install all 111 entries.** The inventory intentionally contains component catalogs, development skills, protocols, datasets, commercial services and tools that are not runtime dependencies.
2. Reuse the current AXIMACH foundation first: React 19, TypeScript, Vite, Capacitor, Electron, Motion, custom AXIMACH CSS/tokens, Lucide/Tabler, the existing WebGL scene, React Flow, ECharts, Zod and Playwright where present in the current branch.
3. Choose the smallest item that closes a measured gap. Avoid parallel component systems, duplicate animation engines, duplicate 3D engines, duplicate graph engines or duplicate sync backends.
4. Before copying source, verify the exact upstream repository, commit/tag, path-level licence, notices, peer dependencies, security, maintenance and commercial/data terms. “MIT” metadata is not a substitute for reviewing the actual component or linked data.
5. Keep AGPL, Commons Clause, unclear-licence, ambiguous-name and commercial-service candidates blocked until the specific licence/data-rights review is passed.
6. For any UI change, require responsive browser acceptance at phone portrait, phone landscape, hybrid-touch tablet landscape and desktop. Inspect rendered bounding boxes and screenshots; a successful build alone does not establish visual correctness.
7. Preserve existing manufacturing record IDs, relationships, 3D renderer, route model and module catalogue. No merge, deployment or public release without explicit approval.

## Applied from this inventory to the current mobile-overlap defect

- **Playwright (#87):** retain the existing browser automation and expand its visual acceptance to a landscape hybrid-touch tablet, rather than adding another test framework.
- **Impeccable / UI Skills / Emil Kowalski Skills (#11, #14, #15):** apply as development-time hierarchy, responsive-interaction and motion-review inputs; do not ship them as runtime dependencies.
- **Magic UI (#5):** retain the existing source-level NumberTicker adaptation and Motion runtime; do not layer in a second UI or animation framework.
- **ECharts (#26) and Zod (#33):** retain the existing integrations; unrelated to this layout defect and not replaced.

The new hybrid-touch regression initially failed because `src/App.tsx` detected only the primary `(pointer: coarse)` device. The fix now detects `(any-pointer: coarse)` as well and activates the responsive CSS on any touch-capable pointer. The Playwright browser smoke test now checks compact navigation, hidden status ribbon, full viewport geometry and non-overlapping Route Flow / Manufacturing Universe headers and selectors at a landscape tablet viewport.

## Current implementation status

The hybrid-touch code change and browser acceptance are on the existing draft PR branch. CI is the acceptance gate; do not mark this work visually verified until the current workflow run is complete and the test result is inspected. Device-level verification on a physical Android handset/tablet remains a separate manual check.

## Provenance

Copied from the user-provided Library workbook `AXIMACH_104_Repository_Audit.xlsx` (Executive Summary, Repository Audit, Service Audit, AXIMACH Audit, Integration Plan, AXIMACH Summary and AXIMACH CI sheets). The source workbook remains the source of the detailed rationale; these CSVs are the repository working index.
