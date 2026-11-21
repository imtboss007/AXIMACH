# AXIMACH 20-module audit — initial evidence and implementation plan

**Audit snapshot:** 2026-11-21  
**Repository:** `imtboss007/AXIMACH`  
**Branch:** `integrate/35-toolkit-ui-audit`  
**Evidence standard:** source inspection plus repository tests. This document does not claim a manual end-to-end acceptance test for every button, record, export and device.

## Current verified baseline

- The canonical navigation catalogue in `src/App.tsx`, the 3D navigation sphere in `src/AXIMACHOrb.tsx`, and the navigation regression test contain **20 unique module IDs**. The task text's “18 modules” in the dashboard specification is treated as a legacy count; AXIMACH's actual canonical catalogue remains 20.
- The browser smoke test attempts all 20 module routes, checks the Company/Factory tabs, Module Explorer, global command search and mobile navigation. Its current run is being checked against the latest header/rail stacking correction.
- The 5-part fixture suite contains 196 Node test cases. There is a separate 12-test transport-route suite. The feature branch CI has already passed the 196-case manufacturing functional suite and TypeScript/Vite build on the prior implementation commit; the refreshed CI must validate the latest CSS/count changes.
- The app uses a shared manufacturing data store with stable record IDs. It has an optional JSON-backed local/shared PC service; without configuring a persistent server, the app remains local-first. This is not proof of a deployed multi-tenant production database.
- Dashboard navigation uses a real WebGL shaded sphere and 3D Fibonacci module placement. The lower six record nodes rotate in a separate desktop 3D shell. On narrow mobile viewports, the lower shell is replaced with a 2D summary grid.
- Manufacturing Universe is a dedicated large-format 3D workspace backed by saved manufacturing records and a selected PO component-line route. It is not yet a truly global network view of all customers, suppliers, companies, machines, all components and every module record simultaneously.
- Mechanical Icon Inventory / Logo Studio already exist as supporting workspaces and are not a twenty-first canonical business module.
- The app already has shared searchable single/multi-select controls, stable-ID process references, selected/all component PDF/Excel exports, Process Directory PDF/Excel exports, ExcelJS and PowerPoint export dependencies, and route export implementations.

## 20-module evidence matrix

| # | Canonical module | Existing implementation evidence | Still needs acceptance / correction |
|---:|---|---|---|
| 1 | Company Directory | Company and factory registers; cross-module company references; desktop smoke test switches both tabs. | Test complete create/edit/archive/restore, duplicate checks, search/filter/export and company/factory record propagation with persisted fixtures. |
| 2 | Component Directory | Component identity by stable ID; mechanical logo studio; component PDF/Excel selected/all export code; filters for company, part number, name, revision, drawing and unit. | Browser-test individual/selected/all export file contents, checkboxes, bulk delete confirmation/dependency guard, and refresh persistence. |
| 3 | Purchase Orders | PO and PO-line model; column-wise filters; component lines have stable IDs; guarded delete-all behavior and PO/line costing/route links. | Test per-record/selected/all PDF/Excel, individual and bulk actions, dependency checks and linked data updates after PO/line edit/archive. |
| 4 | Vendor Directory | Vendor process capabilities link to Process Directory definitions by stable IDs; capability constraints are validated during Process Plan operations. | Test vendor-name-only and process-category-only searches, process capability add/edit propagation, multi-vendor category and all filter/checkbox behaviours in browser. |
| 5 | Transport Directory | Saved transport routes are directory-owned; route vendor, vehicle type, direction and rate are reused by production/dispatch; multiple route legs supported. | Exercise character-by-character vendor filtering (S → SA), all dropdown states, route multi-select, edit/archive and refresh propagation in browser. |
| 6 | Contact 360 | Contact profiles link vendor and Process Directory capability IDs; category/type/subcategory identifiers are resolved with stable references; legacy labels are kept separate from directory capabilities. | Verify WhatsApp checkbox/consent state, Contact Category and vendor filters, dependent category → type → subcategory selection, materials/machine multi-select and two-way propagation. |
| 7 | Process Directory | Category-scoped process definitions, stable type/subcategory IDs, duplicate process-type guard, Add Process persistence test, edit/rename identity, archive descendants, linked vendors, process logo and PDF/Excel code. | Browser-test every Add/Edit/Delete and multi-select interaction, selected/all downloads, category/type/subcategory dependency behaviour and relationship updates across all dependent modules. |
| 8 | Component Planned Cost | Planned cost process rows use stable process definition IDs; category/subcategory filters exist; material calculator and separate planned-cost data scope exist. | Specifically confirm Process Category and Linked Vendor searchable selections in UI; test every field/filter and component logo consistency, exports and propagation. |
| 9 | Vendor Network | Capability filters use stable Process Directory IDs and separate legacy vendor text; assigned operations and vendor capabilities are joined by IDs. | Full browser audit of each independent column filter, select all/clear per column, clear all, multiple vendors per capability and Contact/Vendor/Production sync. |
| 10 | Material Directory | Materials, BOM lines, stock ledger, part allocations, material-to-process links, engineering material calculator and supplier-linked inbound transport are represented in shared data. | Test all material CRUD/search/import/export paths, stock reversals, inactive supplier behaviour, source reference integrity and refresh persistence. |
| 11 | Production Plan & Process Plan | Add Operation and Process Plan flows have targeted tests; stable process-definition IDs; route scope controls, simulation, process operations table, bulk updates, quality/date/vendor validation, operation and transport separation. | Exhaustively browser-test all filters, Process Plan/Add Operation/Simulate/Process Operations/Route Scope, operation edit/archive and PNG/CSV/SVG/PPTX/XLSX/PDF/diagram exports by scope. |
| 12 | Route Flow & Relationships | Dedicated workspace; 11 persisted relationship types; curved connections, branches, transport legs and vehicle markers; shared route data/export scopes. | Browser-test edge creation/edit/delete, arrow/line styles, direction, multi-transport detail popups, full-screen/mobile and every export format against saved route state. |
| 13 | Manufacturing Universe | Dedicated large 3D route scene; live selected-PO-line operations, material routes, transport legs, process definitions/vendors; configurable field visibility, expandable nodes, layouts and route simulation/export. | Major gap: elevate from selected PO-line route visualisation to a configurable full manufacturing ecosystem graph spanning companies, customers, suppliers, components, POs, processes, machines, materials, finance, quality, dispatch and statuses. Add entity/relationship visibility editor and cross-module event propagation tests. |
| 14 | Transport & Dispatch | Linked route and transport leg references, vehicle-specific identities, dispatch ledger references, status/proof reference export and receipt/quality gates exist. | Validate dispatch create/edit/cancel/complete, multiple legs/vehicles, proof attachments rather than text-only references, split shipments and no duplicate stock posting. |
| 15 | Quality Inspection | Measurements link exact operations; tolerance and accepted/rejected quantity guards; completed output and inspection gate required before receipt/dispatch. | Browser-test every inspection CRUD action, measurement selector, lot/serial identity, disposition/rework/release and linked dashboard/dispatch/costing updates. |
| 16 | Costing & Payment | Planned vs actual process/material/transport costs; payment transactions; vendor/PO-line identity and reconciliation exports; cost/quantity/link validation. | Major finance gap: structured invoice/AP records, bank/tax/payment-method metadata, allocation, approvals and robust reversal/reconciliation; test all filter and export modes. |
| 17 | Follow-up Centre | Contact follow-up assignments and linked records exist; optional WhatsApp-related integration workspace. | Validate reminders, due dates, assignments and history. Provider credentials, delivery webhooks, reply state and messaging consent are not guaranteed by the UI or by local source. |
| 18 | Reports & Analytics | Dashboard summaries/recent operations/exceptions/master records/production status are derived from saved data; existing export utilities are present. | Add richer analytic dashboards (ECharts is a candidate), audit report definitions, date/tenant filters, source drilldowns and file-content tests. |
| 19 | AI Insights | Module entry and evidence-based insight workspace exist in the catalogue. | A connected production AI model/tool endpoint is not established simply by the UI. Add constrained agent actions, evidence links, permissions, human approvals, audit events and fallback behaviour. A2UI/CopilotKit/AI SDK are candidates, not yet integrated. |
| 20 | Data Exchange Centre | Import/export workspace, synthetic isolated Demo Factory, Excel/PPTX dependencies and backup/data merge flows exist. | End-to-end test each file format, schema validation, dry-run, duplicate/error report, idempotency, rollback, backup restore and real cross-device server mode. |

## Cross-module and global requirements

### Implemented in part / existing evidence
- Shared records and stable IDs support Company → PO → PO line → Component → Operation → Vendor → Transport route/leg → Quality → Costing/Payment relationships.
- Process category/type/subcategory references are stable IDs in several dependent workflows, not just repeated labels.
- Transport records live in Transport Directory and are attached to PO line/process anchors as separate transport legs. Multiple legs and vehicle icons are supported.
- Deletion/archival tests preserve payment and inspection history for archived process nodes and use tombstones in the synchronisation merge.
- Common searchable picker controls already implement partial and exact filtering, numeric matching where values are searchable, select-all and clear; current feature branch adds desktop column layout and readable single-column mobile layout.

### Still required
- A reusable cross-module browser test harness with seeded identifiable data and create → read in linked module → edit → refresh → delete/archive → dependent record verification.
- Browser coverage for every action/filter, not just source-string assertions or a page rendering check.
- Per-module PDF/Excel/export file-content acceptance, and exact route-scope output acceptance for PNG, CSV, SVG, PPTX, Excel, PDF and diagrams.
- Server-side authentication, user roles, tenant/company/factory boundaries, durable database, audit history, backup/restore and production sync acceptance.
- Structured accounts payable/invoice/payment allocations and approval controls.
- File-backed POD and split-delivery workflow.
- Lot/serial traceability, formal quality disposition/release and machine-derived output reconciliation.
- Real machine connectivity through a controlled integration gateway (OPC UA is a possible adapter; it is not currently a live connection).

## 3D work remaining

1. Preserve the existing WebGL main globe and 20 clickable module nodes; do not replace it with a 2D illustration.
2. Build a common reusable 3D shell component using current WebGL/Motion code first. Consider React Three Fiber/Drei only when a missing interaction, scene complexity or performance requirement justifies the extra runtime.
3. Add the five separately rotating dashboard data visualisations: Recent Operations, Records, Exceptions, Master Records and Production Status. Keep the six existing lower summary record categories: Companies, Purchase Orders, PO Component Lines, Components, Vendors and Open Operations.
4. On mobile, evaluate a compact, touch-friendly 3D lower shell rather than silently replacing it with 2D cards; only keep the 2D fallback if GPU/performance or accessibility testing demonstrates the need and the user can still open a 3D view.
5. Extend Manufacturing Universe from a selected-PO-line scene to a full data-driven ecosystem graph with selectable entity classes and edge types, persistent visibility/layout settings, record detail panels and safe edit actions.

## Toolkit decisions (all 35 evaluated)

See [35-toolkit-integration-matrix.md](35-toolkit-integration-matrix.md) for individual classifications and intended uses.

- Design agent skills are development-time tools, not application packages.
- The current app already has Motion, a true WebGL sphere, custom CSS design tokens and searchable pickers. Avoid installing redundant animation and component frameworks.
- ECharts, TanStack Table/Virtual, Zod, React Hook Form, React Flow, React Three Fiber/Drei, GSAP, CopilotKit, A2UI and the Vercel AI SDK remain candidates for a gap-driven technical evaluation, not approved dependencies.
- Check upstream licence, paid/pro restrictions, transitive deps, React 19 compatibility, mobile bundle cost, keyboard/accessibility and reduced-motion behaviour before adapting source.
- SmoothUI and some shadcn-based component catalogs expect Tailwind. AXIMACH does not currently use Tailwind; do not perform a wholesale styling migration to consume them.
- Never copy code from unclear, paid-only, commercial-dual-license or copyleft sources without a legal/licence review.

## Implementation sequence

1. **UI and browser QA:** finish the shared picker column layout, fix header/navigation hit targets, correct stale 18-module labels, and make browser smoke tests pass.
2. **Dashboard 3D:** add the five 3D summary shells; retain live saved-data bindings; tune touch, reduced motion and low-end GPU fallback.
3. **Cross-module acceptance:** build a seeded test matrix for all 20 modules and test each CRUD, filter, dependency, export, refresh and archive workflow.
4. **Manufacturing Universe:** design the shared entity/edge graph and visibility editor; implement all entity groups incrementally from real saved data.
5. **Finance/quality/dispatch completeness:** add invoice/AP, payment allocations/approval, POD attachment/split delivery and lot disposition where missing.
6. **Production platform readiness:** implement server auth, roles/tenant isolation, durable storage, backups, audit history, observability and controlled machine integration.

**Completion rule:** the full audit is complete only when the relevant browser/API tests are written and actually pass against persisted identifiable records. A source grep, UI render, static test, frontend build or successful installer build alone is not completion evidence.
