# AXIMACH — Architecture and Acceptance Baseline

**Status:** requirements baseline; implementation is not complete.
**Product name:** AXIMACH
**Product:** AXIMACH Manufacturing OS
**Repository:** `imtboss007/AXIMACH`

This document is the implementation contract for subsequent engineering work. The UI prototype is not evidence that the backend, security controls, integrations, or release gates have been implemented.

## 1. Product intent

Build a connected manufacturing operating system for precision machining and mixed manufacturing: CNC, VMC, turning, grinding, EDM, fabrication, heat treatment, coating, finishing, assembly, inspection, subcontracting, handling, and transport.

The system must connect customer requirements and drawings through material, routing, machine/vendor, inspection, delivery, costing, and finance while preserving an auditable chain of evidence.

## 2. Experience principles

- No permanent conventional left sidebar. Use a command deck, searchable module universe, command palette, compact quick-navigation rail, and contextual workspaces.
- Light industrial interface: white/silver surfaces, navy typography, electric-blue accent, restrained glass effects, real process imagery where it improves comprehension, and meaningful motion.
- Support keyboard, mouse, touch and accessible focus. Respect reduced-motion settings; no essential information may depend only on animation or colour.
- Desktop and Android must expose the same modules, permissions, records and core capabilities. Layout may adapt to screen size; features may not silently disappear.
- The process universe must support horizontal and vertical scrolling, zoom, search, fit-to-view, minimap/navigation aids, grouped routes, selectable operations, and detail panels. Routes must allow sequential operations, parallel branches, alternate vendors, split batches, merged branches, partial quantities, rework/recovery loops, inspection holds and transport handoffs.
- All dashboard metrics and route records in the design prototype are sample values and must remain explicitly labelled until connected to real data.

## 3. Planned module inventory

1. Command Centre & AI Copilot
2. Companies & Factories
3. Customers, RFQs & Sales Orders
4. Purchase Orders & Subcontract Orders
5. Components, BOMs & Drawings
6. Process Map / Process Graph
7. Process Master
8. Vendors & Sub-vendors
9. Vendor Capability Master
10. Material & Rate Book
11. Material & Inventory
12. Production & Capacity
13. Shop-floor Mobile & QR
14. Transport & Dispatch
15. Quality & Inspection
16. Tooling, Fixtures & Tool Crib
17. Maintenance & Spare Parts
18. Workforce & Skills
19. Costing & Profitability
20. Invoices, Payments & Cash Flow
21. Communication & Follow-up
22. Risk & Failure Prediction
23. Engineering Change & Configuration Control
24. Reports & Analytics
25. Export Centre
26. Import Data
27. Customer Portal
28. Supplier Portal
29. Integrations & API
30. AI Policy & Automation
31. Administration, Governance & Security
32. Business Continuity & Recovery

## 4. Suggested implementation architecture

Architecture decisions must be recorded before choosing production services. Avoid hard-coding a cloud vendor, database, or messaging provider into business logic.

- **Frontend:** React + TypeScript; responsive component system; graph renderer selected after a short performance/accessibility proof of concept.
- **Backend:** typed, versioned API; modular domain services; central authentication and authorization; schema validation at every external boundary.
- **Persistence:** relational database for business records and transactions; object storage for drawings, photos, certificates and generated files; durable queue for scheduled or long-running work.
- **Audit:** append-only actor/action/time/scope trail for sensitive mutations and external actions.
- **Background work:** server-side scheduler and durable workers for reminders, export jobs, integrations, offline reconciliation and retries. Closing a browser must not stop scheduled work when the service and integrations are healthy.
- **Mobile:** responsive web/PWA initially; evaluate a signed Android build after offline, camera/QR, storage and sync behavior are specified.
- **CI:** type-check, build, automated tests, dependency scanning and artifact generation. Release workflows must be separate from verification; no automatic production deployment.
- **Configuration:** environment variables and a documented secret manager. No credentials, access tokens, personal data or production exports committed to Git.

These are proposed directions, not claims of completed backend components. Any change to the architecture must include a rationale, migration impact and operational cost/availability implications.

## 5. Core data domains and invariants

### Identity, scope and audit
- Tenant/company/factory scoping is enforced server-side for every read and write.
- Roles are assigned only by authorised users. A user cannot promote themselves or increase their own permissions.
- Audit events identify actor, scope, record, operation, timestamp, result and relevant change context.
- Sensitive actions apply separation-of-duties and approval requirements.

### Product and process
- Stable IDs connect component, BOM, drawing revision, material lot, route version, operation, machine/vendor, inspection, shipment and financial records.
- Process Master definitions are reusable templates; changing a master must not silently rewrite existing job routes.
- A route version is separate from actual operation history.
- Revision impact analysis must identify open jobs, stock, outside processes, inspection requirements and customer commitments before the change is released.

### Quantity and custody
- Track planned, started, sent, received, accepted, rejected, rework, scrapped, returned, reserved and balance quantities with unit and source reference.
- Partial receipt and split-batch reconciliation must avoid duplicate counting.
- Dispatch does not mean arrival. Custody changes only on a confirmed handoff with actor, time, evidence and quantity.
- Offline events must be idempotent. Retries, duplicate scans and conflicts must not create extra quantities or false custody changes.

### Quality and finance
- Quality holds/releases are controlled by server-side role and approval checks.
- Material, setup/programming, cycle, tooling, external service, inspection, transport, rework, scrap, overhead, tax, invoice, credit, payment and actual cost remain distinct records or ledger entries.
- Compare cost per accepted piece as well as produced piece.
- Payment approval, bank-detail changes, quality release, safety-critical engineering changes and destructive operations require human approval and audit.

## 6. Machine resources, maintenance and capacity\n\n- Machine resources are first-class records linked to a factory by stable ID, with machine code, type, shift start, hours per day, working days and lifecycle state.\n- Maintenance and downtime events reference a machine resource ID and retain planned and actual start/end timestamps, type, priority, status, technician, work-order reference and notes. Process Map operations may reference the same stable machine resource ID so production schedules can be checked against maintenance windows.\n- Scheduled downtime blocks its planned interval; in-progress breakdowns block from actual start through the estimated repair end, but never less than the current time; completed events require and use actual timestamps; cancelled events do not reduce capacity.\n- Capacity is calculated by intersecting the union of downtime intervals with each machine's configured working-shift windows. Overlapping events cannot double-deduct hours, and downtime outside a configured shift does not reduce productive hours.\n- Restricted and retired machines contribute zero available hours. Gross capacity, downtime and net available hours are exposed to Production Capacity.\n- Capacity hours are a planning ceiling, not live telemetry or a guarantee of output. Operation machine-hour demand is calculated only from explicit setup-hour and cycle-seconds estimates; missing estimates are not fabricated.
- The shift-window scheduler allocates estimated operation hours across configured working shifts, splitting work across shifts where needed and excluding maintenance intervals. It queues operations per machine and searches up to 90 days from the selected start.
- Same-factory, same-category resources are eligible alternate candidates. The primary machine is preferred when it can meet the operation target date; an alternate is proposed when the primary cannot meet that target and the alternate offers an earlier completion. If no eligible resource can fit the work, the operation is reported as unallocated.
- Applying a proposed schedule is an explicit planner action. It records exact planned slot start/end timestamps, updates the operation date fields and machine assignment where an alternate is selected, and does not release or complete the operation. Re-run proposals after changing maintenance, quantity, estimates or calendars.
- The current scheduler is a deterministic planning aid, not a minute-by-minute ERP finite-capacity solver: it does not model tooling, operator/fixture constraints, setup-family changeovers, parallel machines, batch splitting, or approved delivery-date propagation. Those require separately validated rules and human approval.\n\n## 7. AI autonomy and safeguards

- AI may summarise, explain, detect patterns, forecast with confidence ranges, propose alternates and draft actions.
- Every recommendation must identify supporting records and disclose uncertainty.
- Use measured forecast accuracy and drift monitoring before AI output is used operationally.
- Low-risk automated actions require explicit policy, scope limits, idempotency, audit and a stop switch.
- Vendor selection, route changes, purchase orders and customer commitments need approval according to policy.
- Payments, bank changes, role changes, quality release, safety-critical engineering and destructive data actions remain human-authorised.
- AI must never release an unvalidated CNC program or invent validated cutting parameters.

## 8. Messaging and background schedules

Communication workflows must store schedule, recipient mapping, consent/source where applicable, attempt count, next attempt, delivery state, reply state, cancellation reason and audit events. They must distinguish sent, delivered, read and replied only when the provider reports those states.

WhatsApp integration choice must be made before implementation. Official WhatsApp Business Platform and QR-linked web-session approaches have different limitations, lifecycle risks and costs. Do not promise that a QR-linked session is permanent or risk-free. Retries must stop when a reply or cancellation condition is confirmed, where supported by the chosen channel.

## 9. Release acceptance gates

A release cannot be considered production-ready until evidence is attached for all applicable gates:

1. Cross-tenant data access tests prove isolation.
2. Unauthorized actions are rejected server-side, including direct API calls.
3. Roles cannot be self-escalated.
4. Split batches and partial receipts reconcile accepted, rejected, rework, scrap and balance quantities.
5. Custody changes require confirmed handoff and do not infer arrival from dispatch.
6. Estimates, commitments, invoices, credits, payments and actual costs remain distinct and reconcilable.
7. Revision impact is visible before affected work proceeds.
8. Offline retry/duplicate/conflict scenarios do not duplicate business events.
9. Import/export preserves authorised scope, linked IDs, row-level errors and audit history.
10. Backup restoration is demonstrated against defined recovery objectives.
11. Process graphs with 500+ operations and vendor datasets with 10,000+ records pass measured load tests on documented hardware and concurrency.
12. Forecasts are evaluated against actual outcomes; confidence and limitations are visible.
13. Keyboard navigation, focus visibility, contrast, touch operation and reduced-motion behavior are verified.
14. Production, procurement, quality, finance and administration workflows pass user acceptance.
15. Production integrations and deployment are separately approved by the repository owner.

Scale numbers are test targets, not present performance claims.

## 10. Delivery sequence

- **Stage 0 — Foundation:** product decisions, data model, threat model, permission matrix, migration policy, test strategy and CI.
- **Stage 1 — Core records:** authentication, tenancy, audit, vendors, components, process master/routes, purchase/subcontract orders and quantity/custody ledgers.
- **Stage 2 — Operations:** production planning, mobile/QR, transport, quality, supplier workflows, notifications and dashboard queries.
- **Stage 3 — Engineering/finance:** revision control, tooling/maintenance, costing, invoices, reconciliation and cash flow.
- **Stage 4 — Intelligence:** risk register, constrained scheduling, simulation, forecasts and evaluated AI assistance.
- **Stage 5 — Controlled automation:** approved low-risk automation, background schedules, validated integrations, monitoring and recovery drills.

## 11. Prototype exit rule

The current prototype is for navigation and design review. Do not use it to record production activity, promise delivery, release quality, issue purchase orders, approve payments or act as a system of record until the relevant backend, authorization, audit and validation gates are implemented.
