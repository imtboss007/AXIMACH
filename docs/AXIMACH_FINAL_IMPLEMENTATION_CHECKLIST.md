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
- [ ] Dedicated dashboard, separate from Command Centre and Production Planning.
- [ ] Show truthful live summaries from existing AXIMACH records.
- [ ] Include relevant production, order, delivery, vendor, quality and risk visibility only where backed by stored data.
- [ ] Drill-downs must open the source record/workspace.
- [ ] Do not show invented or seeded figures.
- [ ] Final KPI set and layout: **pending user confirmation**.

### 02 — Command Centre
- [ ] Dedicated command/control workspace, not merely a generic record list.
- [ ] Show actionable exceptions from actual connected modules.
- [ ] AI Copilot/commands must use real application data and clearly distinguish suggestions from executed actions.
- [ ] Do not duplicate the Dashboard or Process Map.
- [ ] Exact command and control functions: **pending user confirmation**.

### 03 — Companies
Exactly the eight approved functions:
- [ ] Add company.
- [ ] Edit company.
- [ ] Search companies.
- [ ] Store registered company name.
- [ ] Store GSTIN.
- [ ] Store phone number.
- [ ] Store email.
- [ ] Add notes.
- [ ] No Factories tab, factory menu, or factory management in this user-facing menu.
- [ ] Preserve company IDs and existing company links.

### 04 — Purchase Orders
- [ ] Create, edit and search purchase orders.
- [ ] Link PO directly to Company; no mandatory Factory relationship.
- [ ] Select existing Component Master records; do not recreate or retype component master details.
- [ ] Selecting a component loads its saved master details.
- [ ] Store PO-specific line details (e.g. quantity, delivery date and customer rate) against the selected component line.
- [ ] Preserve PO IDs, PO-line IDs and downstream operation references.
- [ ] Exact PO fields/statuses beyond these approved points: **verify existing behaviour; ask before adding**.

### 05 — Components
- [ ] Single Component Master; no duplicate component records across modules.
- [ ] Add, edit and search component records.
- [ ] Reuse component IDs in POs, Process Map and Costing & Payments.
- [ ] Component master field list and validation rules: **final approval pending**.
- [ ] Do not remove existing component data or fields without checking dependencies.

### 06 — Vendors & Sub-vendors
- [ ] Maintain vendor and sub-vendor records and their relationship.
- [ ] Vendor master stores vendor/sub-vendor details.
- [ ] Do not assign components to vendors in this menu; assignment belongs in Process Map.
- [ ] Vendor selection elsewhere must reuse the existing vendor ID.
- [ ] Sub-vendor parent-link rules and exact vendor fields: **confirm before implementation**.

### 07 — Process Directory
- [ ] Dedicated hierarchical process catalogue: main process category → process type/sub-process.
- [ ] Include the user's specified categories and subcategories, including Milling, Turning, Grinding, Welding, Surface Treatment, Heat Treatment, Cutting, EDM, Drilling, Fabrication, Casting, Forging, Finishing and Assembly.
- [ ] Support many subcategories per main category; catalogue is extensible.
- [ ] One process type can be linked to multiple vendors; one vendor can perform multiple process types.
- [ ] Store vendor-specific quotations/rates, validity and rate history against the relevant process/vendor relationship.
- [ ] Vendor autocomplete searches Vendor Master; selecting a result reuses its ID.
- [ ] If a vendor does not exist, Add New Vendor creates it in Vendor Master, then returns to the current process workflow.
- [ ] Material supplier/material rate information already entered in Process Directory must remain the source of truth; do not duplicate it in Material & Inventory.
- [ ] Process Directory remains a catalogue/rate source. Actual vendor assignment to a component's operation occurs in Process Map.

### 08 — Production Planning + Process Map (combined user-facing menu)
- [ ] Combine the two user reference screens into one integrated workspace; do not redesign into an unrelated layout.
- [ ] No Factory filter or factory selector in the user-facing planning screen.
- [ ] Searchable multi-select filters with checkboxes: Company, PO Number, Component and optional Vendor.
- [ ] Vendor filter shows components/operations assigned to that vendor.
- [ ] Add/select Company, PO and existing PO component line in the workspace.
- [ ] Add process/operation to the selected component route.
- [ ] Each operation records process, assigned vendor, start/given date, due date, quantity and price/rate.
- [ ] Vendor is selected from Vendor Master; no duplicate vendor entry.
- [ ] Process type should be selected from Process Directory; do not create free-text duplicate process names when catalogue integration is implemented.
- [ ] Each component has its own connected process route with arrows/connectors and supported branching/crossover paths.
- [ ] Preserve the approved reference layout elements: operation table, process cards/graph, side detail panel, Gantt/Calendar Day/Week/Month, Upcoming Deliveries (Next 7 Days), Vendor Workload, Delays & Risks, and the agreed KPI/action areas.
- [ ] Show vendor payment status on the relevant operation/process card and detail panel: **Paid / Not Paid**.
- [ ] Payment status is entered/updated in Process Map and is the source of truth for the costing comparison.
- [ ] No demo business records.
- [ ] Verify real saved data and navigation across Company → PO → Component → Operation → Vendor → Costing.

### 09 — Work Orders & Execution
- [ ] Scope intentionally deferred by user.
- [ ] Do not implement or alter until the user reopens this menu.

### 10 — Material & Inventory
- [ ] Preserve existing inventory/stock functionality and data until dependency audit is complete.
- [ ] Do not duplicate vendor, supplier, process or rate management already handled in Process Directory.
- [ ] Exact user-approved Material & Inventory scope: **pending clarification**.
- [ ] Audit existing BOM, stock ledger, WIP and stock-location flows before any change.

### 11 — Quality & Inspection
- [ ] Dedicated inspection workspace connected to the exact Company, PO, component line and process operation.
- [ ] Preserve existing inspection records, measurements, NCR/corrective-action history and accepted/rejected quantities if present.
- [ ] Quality results must not silently change production completion, costing or stock.
- [ ] Audit the current implementation and routing before building anything; PR history describes inspection functionality that must not be duplicated.
- [ ] Final acceptance and any missing requirements: **verify with user**.

### 12 — Dispatch & Delivery
- [ ] Dedicated dispatch/delivery workspace connected to Company, PO and component line.
- [ ] Preserve existing shipment, WIP custody, partial receipt/delivery acknowledgement and stock transaction links if present.
- [ ] Dispatch actions must not silently alter production quantities or unrelated finance records.
- [ ] Audit current implementation and routing before building anything; PR history describes dispatch functionality that must not be duplicated.
- [ ] Final acceptance and any missing requirements: **verify with user**.

### 13 — Costing & Payments
- [ ] Component-wise costing only; no separate invoice/payment-management workflow in this menu.
- [ ] Read the component cost entered in Component Master.
- [ ] Read process costs from the component's assigned operations/processes.
- [ ] Total component cost = component cost + sum of its process costs.
- [ ] Compare total cost against the component selling price and calculate profit or loss per component.
- [ ] Compare all components in one view.
- [ ] Process-wise cost comparison across components.
- [ ] Vendor-wise rate comparison for the same process where multiple vendor rates/quotations exist.
- [ ] Show lowest-cost vendor and rate differences; display quotation validity/context so comparisons are meaningful.
- [ ] Rank component profitability and identify loss-making components.
- [ ] Show Paid / Not Paid process status sourced from Process Map.
- [ ] Do not create duplicate vendor payment records or a separate invoice/payment/reconciliation workflow here.
- [ ] Verify calculation basis, units, quantity multipliers, taxes and rate validity before presenting totals; do not silently mix per-part, batch and total values.

### 14 — Reports & Analytics
- [ ] Replace generic KPI-definition placeholder with actual reports only after report list is approved.
- [ ] Reports must use real AXIMACH data and show source/period/filter context.
- [ ] No fabricated metrics.
- [ ] Report catalogue, comparisons and export requirements: **pending user definition**.

### 15 — AI Insights
- [ ] Dedicated insights workspace, separate from AI Policy/Automation controls.
- [ ] Insights must analyse actual saved AXIMACH data.
- [ ] Candidate areas identified in review: component profitability, vendor rate differences, production delays/bottlenecks, quality/rejection trends, material/delivery risks.
- [ ] Treat these as proposed areas, not approved features, until user confirms.
- [ ] No unsupported AI actions or automatic record changes without explicit approval.

### 16 — Export Centre
- [ ] Actual CSV/Excel/PDF generation from selected AXIMACH records.
- [ ] Select source module/data, filters and date range where applicable.
- [ ] Preview exported rows before generating.
- [ ] Respect access permissions and sensitive-field scope.
- [ ] Verify file contents and downloaded output.
- [ ] Exact format/module list: **confirm before implementation**.

### 17 — Import Data
- [ ] Actual CSV/Excel file upload and parsing.
- [ ] Map uploaded columns to the correct AXIMACH master/transaction fields.
- [ ] Validate required fields, data types and references.
- [ ] Detect duplicates using stable business keys and existing records.
- [ ] Preview creates/updates/rejections before commit.
- [ ] Explicit user confirmation before writing imported records.
- [ ] Report row-level validation errors and import results.
- [ ] Preserve existing records; no silent overwrites.
- [ ] Supported templates and importable modules: **confirm before implementation**.

### 18 — Users & Permissions
- [ ] Actual user account lifecycle and authentication integration.
- [ ] Role/permission assignment and enforcement in the UI and server/API.
- [ ] Add/edit/deactivate users and review access.
- [ ] Session/access review and audit history where supported.
- [ ] Do not treat a generic access-review record as functioning access control.
- [ ] User roles and permission matrix: **pending user definition**.

### 19 — Integrations
- [x] Removed from navigation and generic module profile by user instruction.
- [ ] Do not reintroduce this menu unless the user explicitly asks.

### 20 — Settings
- [ ] Not yet defined; do not invent settings or build a Settings menu until user confirms its scope.

## Cross-module integrity and preservation

- [ ] Stable IDs and references remain intact across all modules.
- [ ] Company → PO → Component line → Process Map operation → Vendor → Costing traceability works end to end.
- [ ] Process Directory is the source for process types and approved vendor-specific rates/quotations.
- [ ] Process Map is the source for operation vendor assignment, dates, quantities, process cost and Paid/Not Paid status.
- [ ] Component Master is the source for component identity and approved component cost/selling price fields.
- [ ] Costing reads these sources; it must not duplicate or independently override them.
- [ ] Inventory, Quality and Dispatch transactions retain their existing independent business effects and do not silently overwrite one another.
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
