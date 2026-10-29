# AXIMACH — Manufacturing OS

**Precision · Flow · Intelligence**

AXIMACH is being developed as an AI-native manufacturing operating system for precision machining and mixed manufacturing: CNC, VMC, turning, grinding, EDM, fabrication, treatment, assembly, inspection, subcontracting and transport.

## Current state

The current repository contains an **interactive frontend prototype**, not a production-ready ERP or connected factory system.

- Light, responsive command-deck interface; no permanent left sidebar.
- Searchable module universe covering all 32 planned product modules.
- Keyboard command search (Ctrl/⌘ K).
- Process route prototype with horizontal/vertical layouts, scroll, zoom controls, selectable operations and local demonstration status changes.
- Illustrative dashboard and AI response examples, clearly labelled as sample/demo data.
- GitHub Actions frontend build verification.

No live database, authentication, tenant isolation, production machine telemetry, WhatsApp connection, payments, or persistent work-order API is connected yet. Prototype interactions must not be treated as production records.

## Run locally

Requirements: Node.js 20.18 or newer and npm.

```bash
npm install
npm run dev
```

Build the frontend:

```bash
npm run build
npm run preview
```

## Planned module domains

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

## Engineering priorities

1. Inspect and approve this UI direction before broad implementation.
2. Define architecture, data model, tenant boundaries, permissions and audit events.
3. Implement server-side authentication and authorization before handling business data.
4. Implement process route versioning, quantity reconciliation, confirmed custody events and quality gates.
5. Build vendor, inventory, production, logistics and costing workflows on a shared model.
6. Add imports/exports, background jobs and integrations with failure handling and observability.
7. Validate mobile/offline behavior, realistic load, backup restore and permission boundaries.
8. Add bounded AI recommendations with evidence and approval gates; never let the AI bypass authorization.

## Non-negotiable safety and data rules

- Sample dashboard values are not live measurements.
- A dispatched consignment is not treated as received until handoff is confirmed.
- Planned quantities, shipped quantities, accepted quantities, rejects, rework, scrap and balances must reconcile.
- Route revisions and actual operation history are separate linked records.
- Payments, bank-detail changes, quality release, safety-critical engineering, role changes and destructive actions require server-side authorization and required human approvals.
- Credentials, tokens, customer records and production secrets must never be committed to the repository.
- Do not deploy or connect production systems without explicit owner approval.

## Release status

This repository is a work in progress. A successful frontend build is not evidence of production readiness, secure tenancy, or connected manufacturing functionality.
