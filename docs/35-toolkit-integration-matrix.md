# AXIMACH — 35-toolkit integration and module audit

## Decision

Use all 35 candidates as an evaluated toolkit, but do **not** install 35 packages into the AXIMACH runtime. Several are coding-agent skills, protocols, design references or incompatible component catalogs rather than application dependencies. AXIMACH remains the canonical app; existing module IDs, shared manufacturing records, route history and workflows must be preserved.

## Current repository baseline inspected

- Canonical catalogue: 20 unique module IDs in `src/App.tsx`; `src/AXIMACHOrb.tsx` exposes the same 20 IDs and the navigation-catalogue test enforces parity.
- Main dashboard and 3D command centre share `AXIMACHOrb`; the existing sphere uses a WebGL sphere shader plus interactive CSS 3D satellite placement, Motion rotation/drag and six live lower summary nodes (Companies, Purchase Orders, PO Component Lines, Components, Vendors and Open Operations).
- Manufacturing Universe and Route Flow are already separate workspaces backed by `useManufacturingData`; the route editor supports eleven relationship types and transport records/vehicle markers.
- A Mechanical Icon Inventory and Logo Studio already exist in `MechanicalOperationIcon.tsx` and `IconStudio.tsx`.
- Shared searchable controls already exist: `SearchablePicker` (single-select) and `SearchableMultiSelect` (multi-select, search, Select all, Clear and Done).
- The application uses React 19, Vite, custom CSS, `motion/react`, Lucide and Tabler icons. It does not currently use Tailwind. `exceljs` and `pptxgenjs` are already dependencies.
- Manufacturing data is local-first with an optional JSON-backed API. Cross-device sync requires a deployed persistent API and matching client configuration; the README explicitly says the repository is not production-ready or a live machine-telemetry platform.
- Current Stage 6 CI has passed server tests, the web build, Windows installer packaging and Android APK packaging. The browser smoke test currently fails at the global command-search click after opening Route Flow: the navigation rail intercepts the click.

## The 35 candidates and their intended AXIMACH role

| # | Candidate | Classification | AXIMACH use / decision |
|---:|---|---|---|
| 1 | Unslop | Coding-agent design skill | Run visual audits against AXIMACH pages; use as a development-time skill, not a browser dependency. |
| 2 | gstack – Garry Tan | Engineering-agent workflow | Use for planning, code review, QA and release checklists; keep it outside the app runtime. |
| 3 | Ruflo | Agent orchestration | Optional research/development orchestration for multi-step engineering tasks; do not make production UI dependent on it. |
| 4 | Unlumen UI | React component registry | Selectively adapt components after checking each component's source and licence; preserve AXIMACH CSS tokens. |
| 5 | Magic UI | React animated components | Reuse only small, useful components; Motion is already installed, so avoid duplicate animation runtimes. |
| 6 | SmoothUI | React/Tailwind component catalog | Evaluate examples, but do not adopt wholesale until Tailwind 4 compatibility and bundle impact are justified. |
| 7 | Generative UI | Design pattern, not one package | Implement constrained, data-backed contextual screens; generated UI must use allowlisted components, never arbitrary executable code. |
| 8 | Skiper UI | UI catalog / source needs confirmation | Verify the canonical upstream repository, exact licence and component dependencies before copying anything. |
| 9 | Animmaster Lib | Animated component catalog / paid tiers | Treat as reference-only unless the exact component licence and any paid entitlement are confirmed and approved. |
| 10 | ThreeUI | Ambiguous 3D UI project name | Verify exact upstream identity and licence; prefer the established React Three Fiber/Drei ecosystem for React integration. |
| 11 | Impeccable | Coding-agent design skill | Add design critique and hierarchy checks to the UI implementation workflow. |
| 12 | Taste Skill | Design/art-direction skill | Use for visual direction and page-level design review; keep brand decisions in the AXIMACH design system. |
| 13 | UI UX Pro Max | Design-system skill | Use as a design-reference generator for layouts, typography and interaction patterns; verify its exact repo/licence. |
| 14 | UI Skills | Agent skill collection | Reuse focused skills for front-end implementation and accessibility checks after source review. |
| 15 | Emil Kowalski Skills | Animation/design skill | Use for motion restraint, interaction timing and animation-quality review. |
| 16 | Hallmark | Design/anti-generic UI candidate | Verify the exact project, maintenance and licence before adoption; no runtime dependency planned. |
| 17 | React Bits | React components and effects | Candidate for selected visual effects and micro-interactions; adapt to existing Motion/CSS stack. |
| 18 | Cult UI | React component catalog | Candidate for isolated interaction patterns; do not introduce a second component system. |
| 19 | Origin UI | React/shadcn component catalog | Reference for forms, tables and controls; adapt individual components only where useful. |
| 20 | Aceternity UI | Animated React components | Use selectively for hero/overview surfaces, not dense operational tables. |
| 21 | Motion Primitives | Motion components | Reuse patterns where they improve feedback; avoid duplicate motion implementations. |
| 22 | CopilotKit | AI copilot UI/integration | Potential AI assistant surface for record-aware actions, with explicit user approval and traceable tool calls. |
| 23 | A2UI | Generative UI protocol | Preferred evaluation path for structured agent-generated interfaces rendered with native, approved AXIMACH components. |
| 24 | Vercel AI SDK | AI application/streaming SDK | Candidate for model streaming and tool calls if an approved model endpoint is connected; not evidence of a live AI service by itself. |
| 25 | GSAP | Animation engine | Use only for complex timeline sequences that Motion cannot handle cleanly; avoid running both engines on the same element. |
| 26 | Apache ECharts | Charting library | Strong candidate for OEE, production trends, vendor performance, quality Pareto, cost variance and dispatch analytics. |
| 27 | TanStack Table | Headless data-table library | Strong candidate for large sortable/filterable registers; first evaluate against existing tables to prevent a wholesale rewrite. |
| 28 | TanStack Virtual | List/table virtualisation | Add where measured record counts cause rendering or scrolling problems. |
| 29 | React Flow (xyflow) | Node/edge graph editor | Candidate for a future process-graph editor; current Route Flow already has persisted relationship types and custom SVG curves, so migrate only if a gap is proven. |
| 30 | React Three Fiber | React 3D renderer | Optional future 3D-scene foundation; current WebGL sphere and ProcessUniverse3D should be retained unless a measurable feature gap warrants migration. |
| 31 | Drei | React Three Fiber helpers | Use only alongside a justified React Three Fiber adoption. |
| 32 | React Hook Form | Form state/validation | Candidate for large, complex forms; first benchmark against current controlled forms. |
| 33 | Zod | TypeScript schema validation | Strong candidate for shared validation at import/API/form boundaries; can complement existing TypeScript record types. |
| 34 | React Grid Layout | Resizable dashboard layout | Candidate for configurable user dashboards; persist layout preferences per user/device only after identity is defined. |
| 35 | Mantine | Full React component system | Reference only for now; do not add alongside the custom design system and other component registries. |

## Mapping to the requested AXIMACH scope

- **Dashboard and 3D Command Centre:** preserve the existing WebGL sphere and 20-module navigation parity; use Unslop, Impeccable, Taste Skill and the animation skills for visual review. ECharts is a candidate for analytical panels, not a replacement for the sphere.
- **Component Master, Purchase Orders, Vendor Directory, Transport Directory, Contact 360, Process Directory, Planned Cost, Vendor Network and Costing:** standardise the existing search, filter, multi-select, bulk-action and export patterns. TanStack Table/Virtual, React Hook Form and Zod are the main candidates after a measured compatibility review.
- **Production Plan and Process Map:** retain the persisted route model and existing eleven relationship types. Evaluate React Flow only for graph editing needs; keep transport legs as linked master records, not duplicated ad-hoc data.
- **Transport & Dispatch:** continue using the transport directory, route, vehicle and leg IDs as shared sources. Do not add a second transport model.
- **Manufacturing Universe:** keep its dedicated full-screen workspace tied to the common manufacturing data store. React Three Fiber/Drei are optional future enhancements, not prerequisites for live data.
- **Mechanical Logo Inventory:** retain the existing IconStudio and mechanical glyph inventory as a supporting workspace. It should not become a twenty-first business module.
- **AI Insights / Generative UI:** evaluate A2UI + CopilotKit + Vercel AI SDK as a separated AI presentation/integration layer. All operations must resolve against real record IDs, display evidence and require human approval for consequential changes.
- **Reports & Analytics:** ECharts is the highest-value charting candidate.
- **Data Exchange Centre:** keep ExcelJS/PPTXGenJS already present; add export formats only after a format-by-format acceptance test.

## Licence and compatibility gate

Before adapting third-party source, record the exact upstream URL, commit/tag, licence file, attribution requirements, transitive dependencies and whether the selected component is free or paid. Do not copy from a paid/pro catalog or an unclear licence. In particular, verify the terms for Unlumen, Skiper UI, Animmaster Lib, ThreeUI and Hallmark. Avoid AGPL/commercial dual-licensed ERP code as an unreviewed source for the proprietary AXIMACH application.

## Immediate changes in this branch

1. Put shared multi-select and single-select option menus into responsive columns, as required by the UX specification.
2. Raise the application command header above the fixed/immersive navigation rail while keeping modal overlays above the header; the first generic CSS attempt did not fix the specific selector conflict, so the branch now overrides the exact Route Flow / Manufacturing Universe selector.
3. Correct stale 18-module descriptions; the canonical module catalogue, sphere and regression test all define 20.
4. Add regression assertions for the column-wise dropdown menu style and scoped header stacking.
5. Add five separate rotating 3D dashboard data shells (Recent Operations, Records, Exceptions, Master Records and Production Status) using the shared saved-data store, linked module navigation and reduced-motion support.

## Work still requiring dedicated implementation and acceptance

This branch is a focused toolkit-foundation correction, not a claim that the full 20-module audit is complete. The following still require a systematic record-by-record browser audit and, where appropriate, schema/API work: exhaustive CRUD and dependency handling in every module; every individual/selected/all export variant; all Route Scope and Process Operations export formats; fully configurable Manufacturing Universe entity/edge visibility; comprehensive independent filter coverage on every register; formal AP/invoice and payment allocation records; signed POD attachment and split-delivery workflow; lot disposition/serialized QC; server-side identity, roles and tenant isolation; persistent production database, backups and restore drills; and physical machine/OPC-UA telemetry integration. These cannot be certified by a frontend build or static source inspection.

## Verification policy

- Run all current Node behavioural tests, the TypeScript/Vite build, browser route/navigation smoke tests, and platform packaging workflows after each integration stage.
- For live-data features, add integration tests using persisted, identifiable fixture records and verify create/edit/archive propagation across every linked view.
- Do not describe an action as tested unless the relevant test actually ran and passed.
- Keep all work on feature branches. Do not merge, deploy or publish without explicit approval.
