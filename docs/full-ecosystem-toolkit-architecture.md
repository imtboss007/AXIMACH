# AXIMACH — Unified Ecosystem Toolkit Architecture

**Status:** Architecture baseline for the existing AXIMACH feature branch. This document consolidates the complete tool/repository list supplied by the owner with the earlier AXIMACH toolkit evaluation.

## 1. Integration decision

AXIMACH will use the complete catalogue as one coordinated engineering and intelligence ecosystem. “Use all” means every candidate is assigned a defined job, connected through controlled adapters where appropriate, and available to the relevant AXIMACH workflow. It does **not** mean bundling every UI kit, agent framework, crawler, SaaS product and data source into the browser or running several competing systems for the same job.

AXIMACH remains the canonical Manufacturing OS and source of truth. Existing module IDs, stable manufacturing record IDs, route history, audit history, user-entered records and current working screens must be preserved. New capabilities must connect to those records rather than create parallel Company, Factory, Supplier, PO, Component, Operation, Contact, Invoice or Payment masters.

No merge to main, deployment, production connection, paid subscription, public release or destructive migration is authorised by this architecture document.

## 2. Existing repository baseline

Inspected on branch integrate/35-toolkit-ui-audit:

- React 19, Vite, TypeScript, custom AXIMACH CSS, Motion, Lucide and Tabler icons.
- Existing 20-module navigation catalogue and dashboard/3D command-centre surfaces.
- Existing Manufacturing Universe graph and Route Flow workspace.
- Existing local-first manufacturing data with an optional JSON-backed API.
- Existing ExcelJS and PptxGenJS export dependencies.
- Existing Node test-runner functional tests and Playwright browser smoke tests.
- Current package.json does not include TanStack Table, TanStack Virtual, ECharts, React Hook Form, Zod, React Flow, React Three Fiber, Drei, Mantine, Vitest, Nx, Turborepo, Supabase or Temporal. These remain candidate integrations, not silently assumed installed packages.
- Latest inspected GitHub Actions run for PR #31 completed successfully: web/type-check/build/browser smoke, Windows installer and Android debug APK jobs all passed. This is CI evidence for that commit, not proof of production readiness.

PR #31 remains a draft and unmerged. Continue from its existing branch and preserve its changes.

## 3. Target architecture

### Layer A — AXIMACH product core and canonical data

AXIMACH owns the business domain and canonical identifiers:

- Organisation, company, factory, users, roles and tenant scope.
- Customer, RFQ, enquiry, sales order and customer portal.
- Supplier, vendor capability, contacts and supplier portal.
- Purchase order, PO line, component, drawing, BOM and engineering revision.
- Material, inventory, receipt, issue, WIP, finished goods and stock ledger.
- Process master, operation, route, dependency, subcontracting and production.
- Machine, capacity, tooling, fixture, maintenance, workforce and skills.
- Inspection, quality disposition, nonconformance, rework and traceability.
- Transport, consignment, dispatch, handoff and proof of delivery.
- Cost sheet, quotation, invoice, payment, allocation, cash flow and reconciliation.
- Documents, imports, exports, audit events, approvals, AI policies and recovery.

Connectors must map external data into these canonical records with stable source IDs, source URLs, retrieval timestamps, evidence, confidence, licence/usage conditions and review state. External data must never silently overwrite verified AXIMACH master data.

### Layer B — Frontend, design system and interaction

Use the existing AXIMACH design tokens, custom CSS and Motion implementation as the host design system. The following UI/design candidates become a component and design-pattern library, not competing full application shells:

| Candidate | Assigned AXIMACH role |
|---|---|
| Unslop | Visual anti-pattern and polish audits during development. |
| Impeccable | Page hierarchy, clarity, density and interface critique. |
| Taste Skill | Art direction and visual consistency reviews. |
| UI UX Pro Max | Layout, typography and design-system reference generation. |
| UI Skills | Focused implementation, accessibility and frontend workflow skills. |
| Emil Kowalski Skills | Motion timing, interaction and animation-quality guidance. |
| VoltAgent / awesome-design-md | Design reference discovery and design-context material. |
| Hallmark | Candidate design/quality reference; exact upstream project and licence must be confirmed. |
| Unlumen UI | Selective component source; verify exact source, dependencies and licence per component. |
| Magic UI | Selective animated components; reuse only where Motion/CSS does not already solve the need. |
| SmoothUI | Selective component/pattern reference; confirm Tailwind compatibility before adopting source. |
| Generative UI | Constrained, schema-driven, data-backed surfaces rendered from approved AXIMACH components. |
| Skiper UI | Component candidate; canonical repository, component licence and dependencies must be verified. |
| Animmaster Lib | Reference-only pending source, component licence and any paid-tier restrictions. |
| ThreeUI | Name is ambiguous; verify exact project before considering code reuse. |
| React Bits | Selective effects and micro-interactions adapted to AXIMACH tokens. |
| Cult UI | Selective component patterns, not a second global component framework. |
| Origin UI | Form/control patterns; adapt individual components where they improve existing workflows. |
| Aceternity UI | Selective high-impact overview/landing interactions, not dense factory data-entry screens. |
| Motion Primitives | Motion pattern source, using the existing Motion runtime where possible. |
| Mantine | Reference or isolated utility only; do not introduce a second global design system beside the current one. |
| GSAP | Specialist timeline animation only when Motion cannot reasonably meet the requirement. Do not animate the same element with both engines. |
| React Grid Layout | Candidate for user-configurable dashboard panels after user identity and persisted preferences are defined. |

Design skills and references run in the engineering workflow. Only selected, licence-cleared components enter the product bundle. Keep operational screens fast, accessible, keyboard-usable and visually consistent; do not apply decorative motion to high-density production, quality, inventory or financial workflows.

### Layer C — Data presentation, forms and 2D/3D visualisation

| Candidate | Assigned AXIMACH role | Adoption rule |
|---|---|---|
| Apache ECharts | OEE, production trend, capacity, quality Pareto, vendor score, cost variance, cash-flow and dispatch analytics. | Use for analytical charts; live metrics must come from saved, timestamped records. |
| TanStack Table | High-volume component, PO, vendor, inventory, operation, quality and finance registers. | Introduce per workspace when sorting/filtering/column control is a proven gap. |
| TanStack Virtual | Virtual scrolling for large registers and long lists. | Use only after record-volume/performance measurement. |
| React Flow / xyflow | Visual process planning, dependency editing, route modelling and future workflow graphs. | Current Route Flow and Manufacturing Universe must remain available; migrate only where graph editing, accessibility or layout capabilities justify it. |
| React Three Fiber | Advanced interactive 3D factory, machine, cell, layout and process visualisation. | Optional renderer for a measured 3D requirement; preserve current WebGL/3D surfaces meanwhile. |
| React Three Drei | Helpers for React Three Fiber scenes. | Adopt only with a justified React Three Fiber feature. |
| React Hook Form | Large engineering, supplier, invoice, quality, RFQ and configuration forms. | Evaluate per complex form; keep current forms where they are stable and simpler. |
| Zod | Runtime schema validation for API input, import files, forms, agent tool arguments and integration payloads. | Shared schemas should validate at trust boundaries; TypeScript types alone do not validate runtime data. |

### Layer D — AI assistant, agent orchestration and generated interfaces

Use one policy-controlled AXIMACH agent gateway. AI can read scoped data, assemble evidence, propose plans and execute permitted low-risk actions. It cannot bypass business permissions or independently approve financial, quality-release, safety-critical, user/role or destructive changes.

| Candidate | Assigned AXIMACH role |
|---|---|
| LangGraph | Primary candidate for stateful, multi-step, checkpointed agent workflows and human approval pauses. |
| Ruflo | Candidate orchestration toolkit for specialised agent teams; compare with LangGraph before assigning overlapping production duties. |
| VoltAgent | Agent-development/runtime candidate; use for a bounded service only if it fills a gap not already covered. |
| OpenHands | Development-time autonomous coding/engineering agent in an isolated workspace, not an unrestricted production business agent. |
| CopilotKit | AXIMACH in-app copilot surface for record-aware explanations, action proposals and controlled tool invocation. |
| AG-UI (ag-ui) | Agent-to-UI event/protocol integration between the copilot backend and frontend. |
| A2UI | Structured, declarative generated UI payloads rendered by an AXIMACH allowlist of components. |
| Vercel AI SDK | Model streaming, tool-call and AI application adapter where compatible with the selected backend/provider. |
| CompanyScope MCP | Candidate company-intelligence connector exposed through a narrow MCP tool contract; verify source and licence. |
| Agent Reach | Candidate discovery/research connector; verify exact project, data provenance and terms. |
| OpenGTM | Candidate GTM/company research connector; verify upstream identity and licence. |
| OpenProspector | Candidate lead discovery workflow; source and operating constraints require verification. |
| OpenEnrich | Candidate enrichment adapter; verify source, licence, provider terms and personal-data handling. |
| Open Hunter | Candidate prospecting tool; exact source, maintenance and data rights require verification. |
| Open Outreach | Candidate outreach workflow; enforce recipient consent, human review, unsubscribe and rate limits. |
| Open Prompt Gallery | Prompt discovery/reference library, not executable authority. |
| prompts.chat | Prompt catalogue/reference only; prompts must pass AXIMACH policy and evaluation before use. |
| PromptHero | Prompt discovery/reference only; verify reuse terms for any imported content. |
| YouMind | Optional knowledge/research workspace connector; do not make it a canonical AXIMACH database. |
| Medi Gen AI | Candidate domain-specific AI reference; exact source, intended scope, safety and licence must be verified before use. |
| Treg | Candidate name only; identify exact project and purpose before integration. |

All agent-generated UI must be bounded by typed schemas, approved AXIMACH components, tenant scope and the current user's permissions. Never execute arbitrary generated JavaScript/HTML or allow model output to define a new permission.

### Layer E — Backend, persistence, offline operation and durable workflows

| Candidate | Assigned AXIMACH role | Adoption rule |
|---|---|---|
| Supabase | Candidate managed/self-hostable Postgres, authentication, storage and realtime foundation. | Strong candidate for production relational persistence; design and test tenant RLS, migration and backup before cutover. |
| Dexie.js | IndexedDB/local browser database for offline-first local records and cache. | Candidate local persistence layer; avoid duplicating existing local storage without a migration plan. |
| PowerSync | Offline-first relational data sync candidate, especially with Postgres/Supabase. | Evaluate as an alternative/companion sync architecture; do not run a second competing sync engine. |
| Temporal | Durable long-running workflows: RFQ follow-up, purchase/production milestones, supplier approvals, dispatch, payment reminders and retries. | Introduce only when workflow durability/retry semantics exceed current scheduler capability. |
| LangGraph | Agent state and checkpoints; not a replacement for transactional manufacturing records. | Keep agent state separate from the business system of record. |
| Nx | Monorepo build graph, affected testing and reusable project boundaries if the repository grows into multiple apps/services/packages. | Candidate if multi-project complexity justifies migration. |
| Turborepo | Alternative monorepo task orchestration and caching. | Evaluate against Nx; choose one orchestration system, not both by default. |
| Microsoft Rushstack | Alternative monorepo/package governance and tooling. | Use only if package governance needs justify it; do not layer it automatically with Nx and Turborepo. |
| Backstage | Internal developer portal/service catalogue if AXIMACH grows into multiple independently operated services and teams. | Future engineering-operations layer, not a customer-facing manufacturing module. |
| AFFiNE | Optional collaborative knowledge/project workspace. | Knowledge workspace integration only; AXIMACH remains business data source of truth. |
| AppFlowy | Optional self-hostable collaborative knowledge/project workspace. | Alternative to AFFiNE for selected knowledge workflows; do not operate two overlapping workspaces without a reason. |
| AnythingLLM | Optional private document/RAG workspace for company manuals, SOPs and engineering documents. | Connect using scoped document permissions and source citations. |
| Khoj | Optional self-hosted personal/team knowledge assistant. | Evaluate as an alternative knowledge-retrieval service; no unrestricted access to tenant data. |
| SwarmVault | Candidate memory/agent knowledge component; exact repository, licence, security model and purpose require verification. | Do not use as an authoritative store for business transactions. |

**Persistence target:** move from the optional JSON-backed service to a properly governed relational data layer after the canonical schema, company/factory tenant boundaries, authentication, migration, backup/restore and reversal tests are ready. Supabase/Postgres is the leading candidate to evaluate; Dexie is for local/offline storage; PowerSync is an optional sync layer. These solve different layers but must be designed together. Do not cut over or connect production until the complete migration and recovery path is tested.

### Layer F — Testing, quality, contracts and software supply chain

| Candidate | Assigned AXIMACH role |
|---|---|
| Playwright / microsoft/playwright | Browser end-to-end and desktop/web workflow acceptance; keep the current suite and extend it for every module. |
| Vitest / vitest-dev/vitest | Component/unit test runner candidate for React/TypeScript modules; retain Node's built-in runner where it is already effective rather than rewriting all tests. |
| Promptfoo | Test prompts, agent tool selection, model outputs, policy adherence and regression scenarios. |
| Langfuse | LLM traces, prompt/model versions, latency, token/cost telemetry and evaluation observability. |
| Renovate | Automated dependency-update proposals with CI checks and controlled review. |
| Spectral | OpenAPI/API contract linting for AXIMACH services and external integration contracts. |
| Zod | Runtime contract validation at the application boundary; complement rather than replace API contract tests. |
| gstack | Engineering workflow templates for product review, implementation, code review, QA and release readiness. |
| OpenHands | Isolated coding task execution, with patch review and tests before accepting code. |
| Unslop / Impeccable / Taste Skill / UI Skills / Emil Kowalski Skills | Repeatable visual, interaction, accessibility and motion-quality review. |

Required acceptance gates: targeted tests, complete functional tests, TypeScript/Vite build, browser tests across all module routes, API and tenancy tests, migration/restore tests, platform packaging, accessibility checks, dependency/licence review and security checks. Record PASS, FAIL, SKIPPED or BLOCKED honestly. A successful build is not production acceptance.

### Layer G — Web research, crawling and search infrastructure

This layer is for lawful public business/market research and approved document discovery. Every crawler must identify itself where appropriate, respect robots.txt, site terms, rate limits, privacy law and source restrictions. No login circumvention, CAPTCHA bypass, paywall bypass or collection of private/non-public data.

| Candidate | Assigned AXIMACH role |
|---|---|
| SearXNG | Self-hosted metasearch gateway for public web discovery. |
| OpenSERP | Candidate search abstraction; compare exact source and maintenance with SearXNG. |
| Crawl4AI | Structured web content extraction for permitted public pages. |
| Scrapling | Adaptive scraping/extraction candidate for public pages where permitted. |
| ScrapeGraphAI | Schema-oriented extraction from permitted web content; all outputs require validation and provenance. |
| Crawlee | Browser/HTTP crawling framework for controlled extraction jobs. |
| Scrapy | Mature crawling framework for scheduled and structured public-source collection. |
| AnyCrawl | Candidate crawling/extraction service; verify exact upstream, licence and deployment model. |
| Browser Use | Browser-agent workflow for authorised websites and operator-supervised research; browser content is untrusted input. |
| Playwright | Deterministic browser automation and site testing; do not duplicate browser control stacks without clear separation. |
| Apify | Optional hosted actor/crawling connector; not assumed free, and subject to pricing, platform and source terms. |
| OpenSERP / SearXNG | Search discovery only; not the system of record and not a substitute for source verification. |

Use a source adapter contract: query → retrieve → preserve source URL/time → parse → validate → deduplicate → store evidence → human review → promote to AXIMACH master records.

### Layer H — Company, customer, supplier, contact and lead intelligence

All candidates below feed a single AXIMACH Company/Contact/Prospect intelligence pipeline. They must not each create independent CRMs or duplicate contact databases.

| Candidate | Assigned AXIMACH role |
|---|---|
| Agent Reach | Prospect/company discovery candidate. |
| CompanyScope MCP | Company profile and research connector candidate. |
| OpenGTM | GTM/company discovery connector candidate. |
| OpenProspector | Prospect discovery candidate. |
| OpenEnrich | Company/contact enrichment candidate. |
| Open Hunter | Prospecting candidate. |
| Company Contact Scraper | Public business contact extraction candidate; privacy and source terms apply. |
| GeoLeadScraper | Geographic business discovery candidate. |
| DataForge | Candidate data processing/enrichment pipeline; verify exact project identity. |
| KeeLead | Candidate lead database/workflow; verify exact project identity and licensing. |
| Bricks | Ambiguous project/product name; confirm exact source and role. |
| OpenBower | Ambiguous project name; confirm exact source and role. |
| Leadgen | Generic candidate name; exact source and licence required. |
| Open Outreach | Consent-aware outreach workflow with suppression lists and audit receipts. |
| Radial Lead Scraper | Candidate lead extraction source; verify exact source and terms. |
| BlitzProspector | Candidate prospecting source; verify exact source and terms. |
| Scout — varun-io-eng/Scout | Explicitly named repository candidate; inspect the repository, licence, maintenance and data model before reuse. |
| Scout (unqualified) | Separate name in the supplied list; do not assume it is the same project as varun-io-eng/Scout until confirmed. |
| Reacher / check-if-email-exists | Email syntax/domain/deliverability verification candidate; never treat an email check as consent to contact. |
| Apollo | Optional commercial company/contact data provider; paid terms, rate limits, export rights and privacy obligations must be approved. |
| Apify | Optional provider/hosted actor source, subject to commercial terms and source permissions. |
| World Company Database | Company reference-data candidate; source, update frequency, coverage and licensing require verification. |
| Awesome GTM | Curated resource index, useful for discovering connectors rather than runtime dependency. |
| Awesome AI Lead Generation | Curated resource index, useful for candidate discovery rather than runtime dependency. |

**Canonical lead pipeline:** discover → capture evidence → normalise company identity → resolve duplicates → enrich permitted business facts → verify source and recency → score fit against AXIMACH manufacturing capabilities → human qualification → CRM/prospect record → consent-aware follow-up. Keep personal contacts minimal, segregated and access-controlled. Record suppression and opt-out state centrally.

### Layer I — Geospatial, factory location, logistics and territory intelligence

| Candidate | Assigned AXIMACH role |
|---|---|
| Pelias | Geocoding and place-search service candidate. |
| Photon | OpenStreetMap-based geocoding candidate; compare with Pelias for coverage and operations. |
| Overpass API | Query OpenStreetMap features such as industrial areas, roads and facilities. |
| OSMnx | Python spatial-network analysis for road-network and logistics analysis. |
| Locus | Candidate location/route product or library; exact source and scope must be verified. |
| GeoLeadScraper | Location-based business discovery, subject to source and privacy rules. |

Use one geospatial adapter interface so the product can swap geocoding providers without changing manufacturing records. Store coordinates with provenance, accuracy, geocoder and timestamp. OpenStreetMap-derived outputs must retain applicable attribution and comply with ODbL obligations where relevant.

### Layer J — Finance, markets, property and compliance intelligence

These are specialised optional domains attached to approved Company/Customer/Supplier/Property profiles; they are not accounting ledgers and cannot replace bank statements, audited accounts or legal records.

| Candidate | Assigned AXIMACH role |
|---|---|
| OpenBB | Market/financial research framework and data-provider adapter candidate. |
| OpenComps | Comparable-company/valuation research candidate; verify exact source and methodology. |
| Awesome Real Estate APIs | Curated property-data API directory, not a service by itself. |
| Global Property Price Data | Property-market data source candidate; validate coverage and licensing. |
| House Prices Global | Property-price dataset/source candidate; verify definition, geography and date. |
| OpenAVMKit | Automated valuation model/toolkit candidate; validate jurisdiction, data and methodology. |
| Indian Banking Dashboard | Banking-sector reference dashboard candidate; verify source, update date and methodology. |
| BankPulse – BFSI Analytics | Banking/BFSI analytics candidate; verify exact project and source. |
| OpenSanctions | Sanctions/watchlist screening candidate for compliance workflows, with human review and false-positive handling. |

Do not infer creditworthiness, sanctioned status, property value or financial health from incomplete data. Screenings and adverse findings must retain source and matching evidence, and must not trigger automatic rejection or other consequential action without reviewed policy and human decision.

### Layer K — Knowledge, document intelligence, prompt assets and model observability

AFFiNE, AppFlowy, AnythingLLM, Khoj and YouMind may support knowledge workflows; they are alternatives/adjacent workspaces, not competing AXIMACH transaction stores. Use document-level access control, citations, tenant separation and source-version tracking.

Open Prompt Gallery, prompts.chat and PromptHero are discovery/reference collections. Imported prompts must be reviewed, versioned and tested with Promptfoo. Langfuse records model traces and prompt versions. AnythingLLM/Khoj or other chosen retrieval components may index approved SOPs, drawings, manuals and process documents, but answers must cite the actual source document and revision. Never train or retrieve across customer/factory boundaries without permission.

## 4. Unified data and integration flow

All external services connect through adapter interfaces and an integration registry. They do not write directly to frontend state or bypass the AXIMACH API.

1. **Discover:** search/crawl/API/MCP connectors retrieve only permitted information.
2. **Capture provenance:** retain source name, source URL or API identifier, retrieval timestamp, terms/licence, raw evidence reference and connector version.
3. **Normalise:** map source fields to canonical AXIMACH schemas using Zod or equivalent runtime validation.
4. **Resolve identity:** deduplicate Companies, Factories, Contacts, Suppliers and Locations using stable identifiers and reviewable match evidence.
5. **Classify confidence:** distinguish unverified, machine-extracted, source-verified and human-verified facts.
6. **Review:** send uncertain, personal, financial, sanctions, supplier-qualification and consequential information to an authorised human.
7. **Persist:** write approved updates through the tenant-scoped AXIMACH API and transaction boundary.
8. **Act:** LangGraph/Temporal/agent workflows propose actions; policy gateway checks permissions, approval requirements, rate limits and exact record version.
9. **Present:** CopilotKit + AG-UI/A2UI present structured information and allowlisted actions. ECharts/TanStack/xyflow/R3F render data using canonical records.
10. **Audit:** every consequential action records actor/agent, source, scope, input record version, approval, result, timestamp and recoverability.

## 5. Agent authority and security rules

- Least privilege is enforced server-side. An agent cannot exceed the current user's permissions.
- Read access is the default. Write, export, send, delete, financial and administrative scopes are separate grants.
- Each action preview shows the exact record, recipient, amount, fields and operation to be executed. Any change after approval requires a new preview.
- Financial approval, bank-detail changes, supplier approval, inventory adjustments, quality release, engineering revision, role changes, sanctions decisions and destructive actions require authorised human approval.
- Standing grants are scoped, visible, revocable and expire by default. High-impact operations cannot be batch-approved.
- Untrusted web pages, documents and emails are data, not instructions. Suspected prompt injection is flagged and cannot modify system policy.
- Secrets are handed off through scoped credentials/secret managers; models and crawlers never receive raw secrets.
- Every action produces a receipt and appears in the audit history. Limits on request count, spend, rate and schedule are enforced outside the agent.
- Data is tenant-isolated. Cross-company search, retrieval, graph traversal, analytics and export must enforce server-side scope.

## 6. Adoption and execution sequence

### Stage 1 — Establish safe integration foundations
- Preserve PR #31 and its successful current CI baseline.
- Add an integration registry and provenance/licence inventory for every connector.
- Add shared Zod schemas at API/import/agent boundaries where they close an evidenced validation gap.
- Expand module-level Playwright acceptance to create, edit, archive, filter, refresh, export and cross-module relationship propagation using persisted fixture records.
- Add Spectral once OpenAPI contracts are maintained; add Renovate proposals with CI validation.
- Keep current Node tests; add Vitest for React/component tests where needed.

### Stage 2 — Improve high-value manufacturing workspaces
- Add ECharts for data-backed manufacturing, quality, supplier, costing and dispatch dashboards.
- Benchmark TanStack Table/Virtual against high-volume registers and introduce only to the workspaces that need them.
- Evaluate React Hook Form for large forms and Zod schemas for form/API/import reuse.
- Complete accounts payable, invoice line items, payment allocation/reversal, file-backed POD, split-delivery reconciliation, lot/serial traceability and quality disposition.
- Preserve the existing Route Flow; prototype xyflow only against a concrete missing interaction.

### Stage 3 — Production data and offline architecture
- Design relational schema and migration from the JSON-backed service.
- Define tenant boundaries, auth, role grants, audit retention, backup/restore and disaster-recovery tests.
- Evaluate Supabase/Postgres as the canonical server store; Dexie as local/offline storage; PowerSync as a possible sync mechanism.
- Do not run multiple sync engines or cut over before reconciliation, idempotency and rollback tests pass.

### Stage 4 — Controlled AI and durable workflows
- Integrate Vercel AI SDK/provider adapter, CopilotKit UI and AG-UI event transport.
- Use LangGraph for stateful research/assistant workflows; evaluate Ruflo/VoltAgent only for distinct agent needs.
- Use Temporal for durable business workflows where retries, schedules and long-running state need durable orchestration.
- Add Promptfoo regression suites and Langfuse observability.
- Apply the permission/approval rules in Section 5 before enabling any write-capable agent.

### Stage 5 — Research, sourcing and intelligence
- Start with SearXNG plus one compliant crawler path (Scrapy or Crawlee/Playwright) behind a provider-neutral adapter.
- Integrate Pelias or Photon, then Overpass/OSMnx for location intelligence as required.
- Evaluate company, lead, market, property and compliance sources one at a time, including the exact candidates in Layers H and J.
- Use a single deduplicated intelligence pipeline and CRM; do not run every crawler/provider against the same source or buy data without approval.

### Stage 6 — Scale engineering operations
- Introduce Nx, Turborepo or Rushstack only after multiple apps/packages/services make monorepo orchestration necessary; choose one.
- Introduce Backstage only if AXIMACH becomes a multi-service engineering platform requiring service ownership/catalogue.
- Add React Three Fiber/Drei for a specific manufacturing 3D scene, not as a wholesale replacement for current visuals.
- Use AFFiNE/AppFlowy/AnythingLLM/Khoj/YouMind as optional knowledge surfaces based on a clear ownership and data-security decision.

## 7. Candidate verification and licence register

The following candidate names are ambiguous, generic, hosted, curated or otherwise not yet verified to a precise upstream source/version in this audit: Hallmark, Skiper UI, Animmaster Lib, ThreeUI, Locus, DataForge, KeeLead, Bricks, OpenBower, Leadgen, Treg, Medi Gen AI, unqualified Scout, Indian Banking Dashboard, BankPulse – BFSI Analytics, OpenComps, OpenAVMKit, Global Property Price Data, House Prices Global, World Company Database, Open Hunter, OpenGTM, OpenProspector, CompanyScope MCP, Agent Reach and AnyCrawl.

Before any code or dataset is reused, record:
- Exact canonical upstream repository/provider and maintainer.
- Release/tag/commit and retrieval date.
- SPDX licence and required attribution/notice obligations.
- Whether the feature is open source, source-available, free-tier, metered or paid.
- Runtime/dependency requirements and compatibility with React/Node/Python/AXIMACH architecture.
- Maintenance activity, security advisories, test/build evidence and data provenance.
- Privacy, terms-of-service, API quotas, permitted storage/redistribution and jurisdiction-specific requirements.

No licence means no permission to copy or redistribute source. Public visibility is not a licence. Hosted products such as Apollo and Apify are optional provider integrations, not presumed open source or free. Curated lists such as Awesome GTM and Awesome Real Estate APIs are discovery indexes, not runtime libraries. Do not copy paid/private code or bypass service restrictions.

## 8. Full supplied catalogue coverage

The architecture above accounts for the complete supplied list, with duplicate entries deliberately consolidated:

- Design and UI: Unslop, gstack, Ruflo, Unlumen UI, Magic UI, SmoothUI, Generative UI, Skiper UI, Animmaster Lib, ThreeUI, Impeccable, Taste Skill, UI UX Pro Max, UI Skills, Emil Kowalski Skills, Hallmark, React Bits, Cult UI, Origin UI, Aceternity UI, Motion Primitives, GSAP, Mantine, VoltAgent / awesome-design-md.
- AI agents and interfaces: CopilotKit, A2UI, Vercel AI SDK, LangGraph, OpenHands, AG-UI, CompanyScope MCP, Agent Reach, Ruflo, VoltAgent, Medi Gen AI, Treg, SwarmVault.
- Data, charts and forms: Apache ECharts, TanStack Table, TanStack Virtual, React Hook Form, Zod, React Grid Layout.
- Graphs and 3D: React Flow / xyflow, React Three Fiber, React Three Drei.
- Backend, sync, workflow and platform: Supabase, Dexie.js, PowerSync, Temporal, Nx, Turborepo, Rushstack, Backstage, AFFiNE, AppFlowy.
- Testing, contracts and quality: Playwright, Vitest, Renovate, Spectral, Promptfoo, Langfuse.
- Search, crawling and browser research: Crawl4AI, Scrapling, ScrapeGraphAI, Browser Use, SearXNG, OpenSERP, AnyCrawl, Crawlee, Scrapy, Playwright, Apify.
- Geospatial: Pelias, Photon, Overpass API, OSMnx, Locus, GeoLeadScraper.
- Company, contact and GTM intelligence: OpenGTM, OpenProspector, OpenEnrich, Open Hunter, Company Contact Scraper, DataForge, KeeLead, Bricks, OpenBower, Leadgen, Reacher / check-if-email-exists, World Company Database, Open Outreach, Radial Lead Scraper, BlitzProspector, Scout (varun-io-eng/Scout), Scout, Apollo, CompanyScope MCP, Agent Reach, Awesome GTM, Awesome AI Lead Generation.
- Finance, property and compliance: OpenBB, OpenSanctions, OpenComps, Awesome Real Estate APIs, Global Property Price Data, House Prices Global, OpenAVMKit, Indian Banking Dashboard, BankPulse – BFSI Analytics.
- Knowledge and prompt discovery: AnythingLLM, Khoj, YouMind, Open Prompt Gallery, prompts.chat, PromptHero.
- Explicit GitHub repositories: nrwl/nx, OpenHands/OpenHands, langchain-ai/langgraph, ag-ui-protocol/ag-ui, supabase/supabase, dexie/Dexie.js, powersync-ja/powersync, xyflow/xyflow, temporalio/temporal, microsoft/playwright, vitest-dev/vitest, renovatebot/renovate, stoplightio/spectral, backstage/backstage, turborepo/turborepo, microsoft/rushstack.

## 9. Definition of done

A candidate is not “integrated” merely because it appears in this document. Mark it as one of:

- **Evaluated:** exact source, licence, compatibility, scope and evidence reviewed.
- **Approved:** authorised for a defined AXIMACH use case.
- **Prototyped:** isolated proof-of-concept exists and is tested.
- **Integrated:** connected to canonical AXIMACH records through a reviewed adapter/API and passing acceptance tests.
- **Deferred:** useful but not currently justified.
- **Rejected:** licence, security, maintenance, data-rights or architecture concerns make it unsuitable.

Keep this status, upstream version, licence, owner and test evidence in the integration registry. Do not claim completion until the relevant tests pass.
