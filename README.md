# AXIMACH — Manufacturing OS

**Precision · Flow · Intelligence**

AXIMACH is being developed as an AI-native manufacturing operating system for precision machining and mixed manufacturing: CNC, VMC, turning, grinding, EDM, fabrication, treatment, assembly, inspection, subcontracting and transport.

## Current state

The GitHub repository is the canonical source of truth for AXIMACH code, configuration, issue tracking, build workflows and release artifacts. Work should be committed here rather than maintained in a disconnected copy.

The repository now includes **linked manufacturing master workflows and an optional persistent JSON-backed server API**. It is still a work in progress—not a production-ready ERP, deployed multi-tenant system, or live factory telemetry platform.

- Searchable Companies → Factories → Purchase Orders → individual PO component lines → Component master records, linked by stable IDs.
- Process Map operations are created per selected PO line/component, with planned and actual rates, planned/actual dates, processed/accepted/rejected quantities, transport, inspection, alternate/rework route lanes, reordering and vendor assignment.
- Supplier quotations have separate persistent records linked to the exact component, PO line, operation and vendor; choosing a quote applies its planned rate without marking it as an actual invoice.
- Vendor master supports phone/WhatsApp numbers, contact details, process/machine/material capabilities, verification status and search; QR-bridge contacts are automatically added/updated without duplicating matching IDs/phone numbers and are marked unverified.
- Dashboard summaries use saved master data rather than fixed example company/PO/component metrics. A conservative migration removes known demo defaults without deliberately clearing user-entered records.
- The existing server/index.mjs API now includes GET/PUT /api/manufacturing-data, uses the configured persistent JSON file, merges rows by ID/update timestamp and supports an explicit CORS origin allowlist (AXIMACH_ALLOWED_ORIGINS).
- GitHub Actions builds the web app, Windows installer and Android debug APK.

**Important deployment limits:** master data syncs across devices only after the scheduler API is deployed on an always-on host with a persistent volume, its URL/API key are configured, and each client origin is allowed by CORS. Without that, browser-local records remain local to that device. The optional Baileys QR-linked WhatsApp bridge is unofficial, best-effort, may not expose every address-book contact, and must also remain online with persistent authentication storage for scheduled actions. Imported contacts are not approved vendors or proof of messaging consent. Server-side per-user/tenant authorization, a production database, deployment, delivery/reply webhooks, automatic shop-floor quantity reconciliation and live machine telemetry are still pending.

## Run locally

Requirements: Node.js 20.18 or newer and npm. Clone this repository and use its current main branch as the starting point.

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

1. Add server-side authentication, authorization and company/factory tenant boundaries before production business use.
2. Complete route revisions, explicit operation dependencies, quantity reconciliation, custody confirmations and quality gates.
3. Integrate BOM requirements with purchase receipts and production issue planning; complete paired WIP/finished-goods/dispatch reconciliation and tested reversal workflows for the stock ledger.
4. Connect dispatch, payments, document revisions and audit history with immutable transaction references.
5. Add backups, restore tests, import/export validation, retries and service health monitoring.
6. Test Windows, Android and browser data-sync behavior against a deployed persistent server.
7. Add delivery/reply webhooks and consent-aware WhatsApp workflow controls where the selected provider supports them.
8. Add bounded AI recommendations with evidence and human approval; never let AI bypass authorization.

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


## Scheduler service (optional, not yet deployed)

See [server/README.md](server/README.md) and [server/.env.example](server/.env.example). The service must be deployed to an always-on host with persistent storage before background schedules can run while the app is closed. Keep all API and Meta credentials in host secrets. Do not treat scheduler code being present in GitHub as proof that messages are being sent.

## GitHub build artifacts

The workflow at [.github/workflows/build.yml](.github/workflows/build.yml) builds the web frontend, Windows installer and Android debug APK on pushes to main and manual workflow dispatch. Open the repository's Actions tab, select the latest successful run, then download the matching artifact (aximach-web-dist, aximach-windows-installer, or aximach-android-debug-apk). Artifacts expire according to the workflow's retention settings. A debug APK is not a Play Store release, and an installer/APK must be tested on target devices before production use.
