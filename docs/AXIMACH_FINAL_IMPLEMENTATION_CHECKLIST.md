# AXIMACH — Final Implementation Checklist

**Repository:** imtboss007/AXIMACH  
**Working branch:** feature/maintenance-capacity-integration  
**Baseline commit:** c573a77da8fe27693ded3bb82622ccf5478e616b  
**Production/main branch:** protected from this work; no merge without explicit approval.

## Execution rules

- Preserve all existing records, stable IDs, data relationships, workflows and working screens.
- Do not rebuild the application from scratch.
- Do not seed demo/sample business records.
- Do not add unapproved menu functions or duplicate master data.
- Implement one gap at a time; verify the affected workflow and run the build before moving on.
- Keep changes on the feature branch. Do not merge or deploy without approval.
- Remove a menu entry only when approved; do not delete underlying code or data if another workflow depends on it.
- Where a requirement is not yet specified, mark it pending and ask before implementation.
- Keep desktop and mobile behaviour usable; verify both where a UI change affects layout.

## Approved menu structure and acceptance checklist

### 01 — Dashboard
- [x] Dedicated dashboard, separate from Command Centre and Production Planning.
- [x] Live summaries use active saved company, open PO line, component, operation, vendor, delivery, payment, quality and custody records.
- [x] KPIs are limited to saved fields; closed/cancelled orders and archived records are excluded from open delivery counts.
- [x] Recent operations and risk rows open the linked Process Map record.
- [x] No invented or seeded business figures; the flow graphic is explicitly illustrative.
- [x] KPI layout is set to the approved available source fields; further metrics require explicit data fields, not estimates.

### 02 — Command Centre
- [x] Dedicated command/control workspace, separate from the Dashboard and Process Map.
- [x] Exception queues use saved overdue operations, unpaid vendor operations, quality holds/inspections, delivery dates and in-transit custody records.
- [x] Dashboard command queries read saved AXIMACH data and return rule-based findings; they do not claim AI inference or execute business actions.
- [x] Source actions deep-link to Process Map, Quality and Dispatch workspaces.
- [x] No duplicate production route editor or fabricated exceptions; no write actions are performed from the Command Centre.

### 03 — Companies
Exactly the eight approved functions:
- [x] Add company.
- [x] Edit company.
- [x] Search companies.
- [x] Store registered company name.
- [x] Store GSTIN.
- [x] Store phone number.
- [x] Store email.
- [x] Add notes.
- [x] No Factories tab, factory menu, or factory management in this user-facing menu.
- [x] Preserve company IDs and existing company links.
- [x] Prevent duplicate registered company names and duplicate non-empty GSTINs in the active Company Master.

### 04 — Purchase Orders
- [x] Create, edit and search purchase orders.
- [x] Link PO directly to Company; no mandatory Factory relationship.
- [x] Select existing Component Master records; do not recreate or retype component master details.
- [x] Selecting a component loads its saved master details.
- [x] Store PO-specific line details (e.g. quantity, delivery date and customer rate) against the selected component line.
- [x] Prevent duplicate PO numbers within the same Company; the same number remains available for a different company.
- [x] Preserve PO IDs, PO-line IDs and downstream operation references.
- [ ] Exact PO fields/statuses beyond these approved points: **verify existing behaviour; ask before adding**.

### 05 — Components
- [x] Single Component Master; no duplicate component records across modules.
- [x] Add, edit and search component records.
- [x] Reuse component IDs in POs, Process Map and Costing & Payments.
- [ ] Component master field list and validation rules: **final approval pending**.
- [x] Do not remove existing component data or fields without checking dependencies.

### 06 — Vendors & Sub-vendors
- [x] Vendor records remain independent; no parent/sub-vendor hierarchy or parent-link relationship is required.
- [x] Each vendor is assigned exactly one active Process Directory process type.
- [x] Multiple vendors may be assigned to the same process type.
- [x] Do not assign components to vendors in this menu; assignment belongs in Process Map.
- [x] Vendor selection elsewhere must reuse the existing vendor ID.
- [x] Legacy/WhatsApp-imported contacts without a process assignment remain preserved and must be classified before use in a new operation or quotation.

### 07 — Process Directory
- [x] Dedicated hierarchical process catalogue: main process category → process type/sub-process.
- [x] Include the specified main process categories: Milling, Turning, Grinding, Welding, Surface Treatment, Heat Treatment, Cutting, EDM, Drilling, Fabrication, Casting, Forging, Finishing and Assembly.
- [x] Support many process types under each main category; catalogue is extensible.
- [x] Each vendor is linked to exactly one process type through its Vendor Master record; a process type can have multiple vendors.
- [x] Vendor quotations remain vendor-specific and retain their own validity, rate and history under that single assigned process type.
- [x] Store vendor-specific quotations/rates, validity and rate history against the relevant process/vendor relationship.
- [x] Vendor autocomplete searches Vendor Master; selecting a result reuses its ID.
- [x] If a vendor does not exist, Add New Vendor creates it in Vendor Master, then returns to the current process workflow.
- [x] Material grade, unit rate and preferred supplier remain in Material Master; Process Directory is the source of truth for process types and process-vendor quotations. Do not duplicate material pricing in Process Directory or process pricing in Material Master.
- [x] Process Directory remains a catalogue/rate source. Actual vendor assignment to a component's operation occurs in Process Map.

### 08 — Production Planning + Process Map (combined user-facing menu)
- [x] Combine the two user reference screens into one integrated workspace; do not redesign into an unrelated layout.
- [x] No Factory filter or factory selector in the user-facing planning screen.
- [x] Searchable multi-select filters with checkboxes: Company, PO Number, Component and optional Vendor.
- [x] Vendor filter shows components/operations assigned to that vendor.
- [x] Add/select Company, PO and existing PO component line in the workspace.
- [x] Add process/operation to the selected component route.
- [x] Each operation records process, assigned vendor, start/given date, due date, quantity and price/rate.
- [x] Vendor is selected from Vendor Master; no duplicate vendor entry.
- [x] New Process Map operations select a Process Directory type; legacy unlinked operations remain editable without losing their saved names.
- [x] Each component has its own connected process route with arrows/connectors and supported branching/crossover paths.
- [x] Preserve the approved reference layout elements: operation table, process cards/graph, side detail panel, Gantt/Calendar Day/Week/Month, Upcoming Deliveries (Next 7 Days), Vendor Workload, Delays & Risks, and the agreed KPI/action areas.
- [x] Show vendor payment status on the relevant operation/process card and detail panel: **Paid / Not Paid**.
- [x] Payment status is entered/updated in Process Map and is the source of truth for the costing comparison.
- [x] No demo business records are automatically seeded; standard process categories are catalogue configuration only, and the legacy cleanup removes only known demo signatures while preserving user-entered rows.
- [x] Static source audit confirms Company → PO → Component line → Operation → Vendor → Costing uses the same stable IDs and navigation handlers. A live-device smoke test using the user's actual records remains an environment validation, not something the source build can prove.

### 09 — Work Orders & Execution
- [x] Scope intentionally deferred by user; no new Work Orders module has been introduced.
- [x] Do not implement or alter this scope unless the user explicitly reopens it.

### 10 — Material & Inventory
- [x] Preserve existing inventory/stock functionality and data until dependency audit is complete.
- [x] Do not duplicate vendor, supplier, process or rate management already handled in Process Directory.
- [x] Retain the existing three work areas: Material Master, Component BOM and append-only Stock Ledger; no new inventory workflow was added.
- [x] Stock balances and issue validation are location-aware; legacy location metadata is resolved without rewriting old transactions.
- [x] Remove user-facing Factory selection; legacy PO factory locations remain internally selected when a historical PO line is linked.
- [x] WIP and customer dispatch stock movements can only be posted through Dispatch & Delivery, preventing duplicate manual movement entries.
- [x] Require a company/location and an actual reference for manual stock movements; negative-balance confirmation is evaluated at the selected location.
- [x] Material pricing and preferred supplier Vendor ID remain in Material Master; Process Directory contains process-type/vendor quotations, not a second raw-material price book.
- [x] BOM estimates use the linked material rate and quantity/scrap inputs.
- [x] Audit existing BOM, stock ledger, WIP and stock-location flows before any change.

### 11 — Quality & Inspection
- [x] Dedicated inspection workspace connected to the exact Company, PO, component line and process operation.
- [x] Preserve existing inspection records, measurements, NCR/corrective-action history and accepted/rejected quantities if present.
- [x] Quality results must not silently change production completion, costing or stock.
- [x] Audit the current implementation and routing before building anything; PR history describes inspection functionality that must not be duplicated.
- [ ] Final acceptance and any missing requirements: **verify with user**.

### 12 — Dispatch & Delivery
- [x] Dedicated dispatch/delivery workspace connected to Company, PO and component line.
- [x] Preserve existing shipment, WIP custody, partial receipt/delivery acknowledgement and stock transaction links if present.
- [x] Dispatch actions must not silently alter production quantities or unrelated finance records.
- [x] Audit current implementation and routing before building anything; PR history describes dispatch functionality that must not be duplicated.
- [ ] Final acceptance and any missing requirements: **verify with user**.

### 13 — Costing & Payments
- [x] Component-wise costing only; no separate invoice/payment-management workflow in this menu.
- [x] Read the component cost entered in Component Master.
- [x] Read process costs from the component's assigned operations/processes.
- [x] Total component cost = component cost + sum of its process costs.
- [x] Compare total cost against the component selling price and calculate profit or loss per component.
- [x] Compare all components in one view.
- [x] Process-wise cost comparison across components.
- [x] Vendor-wise rate comparison for the same process where multiple vendor rates/quotations exist.
- [x] Show lowest-cost vendor and rate differences; display quotation validity/context so comparisons are meaningful.
- [x] Rank component profitability and identify loss-making components.
- [x] Show Paid / Not Paid process status sourced from Process Map.
- [x] Do not create duplicate vendor payment records or a separate invoice/payment/reconciliation workflow here.
- [x] Verify calculation basis, units, quantity multipliers, taxes and rate validity before presenting totals; do not silently mix per-part, batch and total values.
- [x] Profitability requires positive material quantity and rate, selling rate and a positive planned rate for every operation; incomplete material overrides are not treated as complete coverage.
- [x] Cost per accepted part uses only accepted quantity explicitly recorded on a completed final operation; it is not inferred from PO quantity or estimated rejects.
- [x] New PO-operation quotations require a process-linked operation and a vendor whose single Vendor Master processTypeId matches that operation; stale mismatched historical quotes remain visible but cannot be applied.
- [x] Process Map requires a positive operation quantity; zero-quantity operations cannot be saved or counted as complete profitability inputs.

### 14 — Reports & Analytics
- [x] Dedicated reports workspace reads actual Company, PO, Component, Process Map, Vendor, Quality, Process Directory and Dispatch records.
- [x] Reporting period selector: 7 / 30 / 90 days or all saved history.
- [x] Every report section identifies its source and date basis; rows with blank relevant dates are excluded from period summaries.
- [x] Production status, overdue operation, PO delivery-date, inspection quantity/rejection, vendor Paid/Not Paid, process quotation and WIP/customer transit summaries are calculated from stored records.
- [x] No sample records, fabricated prices, predictive estimates or simulated metrics are shown.
- [x] Final KPI catalogue remains extensible; implemented report metrics are limited to the saved fields listed above.

### 15 — AI Insights
- [x] Dedicated read-only insights workspace, separately routed from AI Policy/Automation controls and exposed in the approved menu.
- [x] Analyses use saved AXIMACH operations, process quotations, inspection events, PO delivery dates, BOM quantities and stock ledger balances.
- [x] Current deterministic signals cover production delay / near-due operations, vendor rate spread, quality rejection share / holds, PO delivery exposure and gross material coverage gaps.
- [x] Component profitability remains in Costing & Payments; no unsupported AI profitability forecast is claimed here.
- [x] AI inference is not connected. The workspace clearly labels the signals as deterministic analysis, performs no automatic record changes and makes no predictive-accuracy claim.

### 16 — Export Centre
- [x] Export actual saved AXIMACH collections as CSV or structured JSON.
- [x] Select source collection, search filter and date range where supported; display preview before export.
- [x] Browser print / Save as PDF supported from the selected export preview.
- [x] Multi-user permission-aware exports remain blocked until real authentication and role-based access control are implemented; current UI explicitly warns that exports are workspace-owner use on a trusted device. No role enforcement is claimed.
- [x] Export source list is restricted to manufacturing collections already stored by AXIMACH; nested objects remain structured in JSON/CSV cells.

### 17 — Import Data
- [x] CSV and .xlsx/.xlsm upload/parsing with quoted commas, escaped quotes and multiline values; legacy binary .xls remains unsupported.
- [x] Exact downloadable templates and fixed field-to-master mappings for Companies, Components, Vendors, Materials, Process Categories and Process Types.
- [x] Required fields, non-negative numeric values and stable ID references are validated before import.
- [x] Business-key duplicate detection covers existing records and duplicate rows within the same file; duplicates are rejected.
- [x] Row-by-row preview labels records Ready or Rejected with reasons.
- [x] Explicit confirmation is required before appending valid rows.
- [x] Existing records are never silently updated or overwritten.
- [x] PO, operation, stock, Quality and Dispatch transactions are intentionally not CSV-importable until dedicated cross-reference and stock/custody reconciliation exists.

### 18 — Users & Permissions
- [ ] Actual user account lifecycle and authentication integration.
- [ ] Role/permission assignment and enforcement in the UI and server/API.
- [ ] Add/edit/deactivate users and review access.
- [ ] Session/access review and audit history where supported.
- [ ] Do not treat a generic access-review record as functioning access control.
- [ ] User roles and permission matrix: **pending user definition**.

### 19 — Integrations
- [x] Removed from navigation and generic module profile by user instruction.
- [x] Do not reintroduce this menu unless the user explicitly asks.

### 20 — Settings
- [ ] Not yet defined; do not invent settings or build a Settings menu until user confirms its scope.

## Cross-module integrity and preservation

- [x] Static code and CI audit confirms stable IDs and references are retained by module normalisation, merges, server collection allowlists and existing linked records.
- [x] Company → PO → Component line → Process Map operation → Vendor → Costing uses shared master/transaction IDs in the current code paths; a live-data smoke test remains an environment check.
- [x] Process Directory is the source for process types and reusable vendor-specific process quotations.
- [x] Process Map is the source for operation vendor assignment, dates, quantities, process cost and Paid/Not Paid status.
- [x] Component Master is the source for component identity and approved component cost/selling price fields.
- [x] Costing reads these sources; it does not create a duplicate vendor or payment master.
- [x] Inventory, Quality and Dispatch maintain separate transaction effects and linked stock/inspection/custody records.
- [ ] Cross-device sync must be tested against the configured server/backend; localStorage alone is not proof of PC/mobile synchronisation.
- [ ] Do not remove legacy/internal factory fields or migration support until all dependencies and existing records are traced. User-facing Factory functionality remains excluded from the approved menus.

## Controlled implementation sequence

1. **Baseline and safety:** capture branch head, inspect PR state, map current routes/data types, identify dependencies, run baseline build.
2. **Navigation reconciliation:** map existing 32 modules to the approved menu structure; remove unapproved visible entries without deleting underlying workflows or data. Resolve Settings before exposing it.
3. **Master-data integrity:** Companies, Purchase Orders and Components; remove user-facing Factory dependency while preserving historical compatibility.
4. **Process Directory:** implement the approved hierarchical process catalogue and vendor-specific rate/quotation relationships.
5. **Process Map integration:** consume Process Directory, reuse Company/PO/Component/Vendor IDs, implement vendor Paid/Not Paid status and preserve the approved combined planning layout.
6. **Costing & Payments:** implement the approved component/process/vendor comparison calculations from source records.
7. **Quality & Inspection:** audit existing PR4 work and complete only verified gaps.
8. **Dispatch & Delivery:** audit existing PR4 work and complete only verified gaps.
9. **Material & Inventory:** wait for the user's exact scope; preserve existing stock/WIP functionality meanwhile.
10. **Reports & Analytics:** wait for the approved report catalogue.
11. **AI Insights:** wait for approval of insight scope; connect only to verified data.
12. **Export Centre:** implement actual export workflow.
13. **Import Data:** implement guarded import workflow with preview and confirmation.
14. **Users & Permissions:** implement actual auth/permission enforcement after role matrix approval.
15. **Final integration and regression:** desktop/mobile, persistence/sync, permissions, calculations, imports/exports, quality/dispatch, build and workflow checks.

## Per-change definition of done

- [ ] Requirement maps to an approved checklist item.
- [ ] Existing behaviour and affected dependencies inspected before editing.
- [ ] Small, focused change on the feature branch only.
- [ ] Existing records and stable IDs remain compatible.
- [ ] Relevant workflow manually/automatically tested.
- [ ] TypeScript/Vite build passes.
- [ ] Desktop/mobile impact checked where applicable.
- [ ] Commit SHA and changed files recorded.
- [ ] No merge/deployment unless explicitly authorised.

## Current status at checklist creation

- Current branch head verified as `c573a77da8fe27693ded3bb82622ccf5478e616b`.
- Integrations menu removal is committed on the feature branch.
- Open PR #5 remains separate; do not merge automatically.
- Existing code includes dedicated Company/PO/Component master workspace, Process Map, Production Planning, Vendor workspace, Costing, Inventory and Machine Capacity workspaces.
- Several other modules still route through the generic ModuleWorkspace; actual underlying subfeatures must be audited before any rebuild.
- This checklist is the execution baseline; items marked pending are not implementation authorisation.

## Gap 1 — Process Directory implementation note (2026-10-31)
- Added stable-ID process category, process type and reusable process-vendor quotation collections.
- Added the 14 specified standard main categories as master configuration data (not sample business records); additional categories and process types remain extensible.
- Added a dedicated Process Directory workspace with search, process type creation, vendor quotation/rate history and validity dates.
- Vendor selection reuses Vendor Master IDs. Add New Vendor writes to the same Vendor Master collection, applies the required company/contact and duplicate-phone checks, and returns the new ID to the current quotation form.
- Legacy process-master rows migrate without deleting the old storage key. Original process type IDs and the complete legacy row payload are retained; exact known demo defaults are excluded.
- Process Map now stores the optional processTypeId on catalogue-linked operations. Existing operations without it keep their legacy process name/category when edited.
- Existing PO-operation quotation rows remain separate and unchanged.
- TypeScript/Vite build and browser/Electron/Capacitor workflow regression checks remain pending execution in a runnable checkout. Gap 1 must not be accepted until those checks pass.
- Combined workspace is exposed through one Production Planning / Process Map navigation item with Planning and Process Map views. The old Process Map route is an internal alias, not a separate menu.
- Vendor payment status is stored as an optional operation field to preserve existing records. Vendor-assigned legacy operations display Not Paid until explicitly updated; Process Map is the edit/source of truth, and planning views only display the saved status.

- Component comparison is one row per active PO component line, with master-only components shown separately as incomplete because there is no order revenue quantity. Only fully entered material, selling and planned process rates receive a profitability rank.
- Process-wise totals use each saved operation's own quantity × planned rate + transport exactly once. Supplier comparisons group quotations by Process Directory process type (legacy operation name fallback) and compare landed per-part rate including transport allocation; quote validity, date and status are displayed.
- Recorded actual cost is explicitly labelled partial when one or more actual operation rates have not been entered; missing actual rates are not presented as confirmed zero-cost operations.

- Quality inspection workspace ported from the reviewed PR #4 implementation onto the active feature branch without importing PR #4's separate Process Master/Vendor Capability architecture. Inspection records have their own stable-ID collection and are included in local normalization, merge and server persistence.
- Quality context selection is Company → PO → Component line → Operation; no user-facing Factory picker. Historical factoryId is still stored from the linked PO. Process Map opens Quality for the selected operation; inspection history returns to the exact saved operation.
- Numeric measurement Pass/Fail is calculated only when actual reading and at least one numeric limit are present. Quantity validations prevent accepted + rejected exceeding inspected. Inspection quantities do not update operation completion, costing or stock.

- WIP Transfers and Customer Dispatch are tabs inside one approved Dispatch & Delivery workspace; no separate WIP Transfers menu was introduced. The WIP handover shortcut in Process Map preselects the source operation.
- Stock movement records retain location type/ID and movement IDs. Existing stock rows without location metadata remain readable through their historical factory/vendor fields. Inventory ledger now displays the resolved stock location.
- WIP handover preparation does not move stock; confirmed dispatch creates source OUT + transit IN, and each partial receipt creates transit OUT + destination IN with an acknowledgement event. Customer dispatch preparation reserves PO-line quantity only; confirmed dispatch creates factory OUT + transit IN, and partial/full delivery acknowledgements clear only the confirmed transit quantity.
- Dispatch and WIP records preserve Company, PO, PO-line, component, operation, vendor, receipt/delivery acknowledgement and stock transaction IDs. They do not change operation completion, quality inspection or costing records.

- Inventory audit completed: the workspace retains Material Master, BOM and append-only Stock Ledger. Process Directory holds process types and process-vendor rates; it does not duplicate raw Material Master records. Material unit rate and preferred vendor remain on the material record and link to the existing Vendor Master ID. WIP/customer dispatch movements add location/movement IDs without overwriting prior stock transactions.
- Inventory controls hardened: manual stock movements require a company/location and movement reference; negative-balance warnings use the selected stock location, not an all-location aggregate. Factory selection is not exposed; legacy PO stock locations remain internally selected from the PO line. WIP and Dispatch transaction types are reserved for the paired Dispatch & Delivery workflows.

- Companies menu is now company-only; historical Factory records/IDs and PO factoryId fields remain in the data model for legacy compatibility. New POs can be created directly against Company with an empty internal factoryId.
- Component master rejects a duplicate part-number + revision pair and displays the saved Component Master details on each selected PO line. PO-specific quantity, due date and customer rate remain separate from master fields.

- New company-linked POs without an internal factory ID use a company-level stock location for WIP/customer dispatch custody. Legacy POs continue using their retained factory location ID; vendor-assigned operations continue using vendor locations.

- Vendor Master verified: company/contact, role, phone, WhatsApp, email, address, process/machine/material capability, notes and status are saved against one stable vendor ID. Search, edit, archive and phone/WhatsApp duplicate protection are active. Process Directory, Process Map, Costing and Dispatch reuse those vendor IDs; component assignment is not offered in Vendor Master.
- Vendor process mapping confirmed by user: one vendor is assigned to one process type, while one process type can have multiple vendors. No parent/sub-vendor hierarchy is implemented. Existing free-text process capability values and stable vendor IDs remain preserved for legacy compatibility; unclassified legacy/WhatsApp contacts must be assigned one active Process Directory type before new use.
- Approved menu/navigation reconciliation: Dashboard and Command Centre are separate workspaces; the rail and module explorer expose only the approved menu set. Other historic module profiles/routes remain in the codebase but are not listed in user-facing navigation. Reports, Export and Import use purpose-built data-backed workspaces rather than generic module record lists.
