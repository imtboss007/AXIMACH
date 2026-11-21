# AXIMACH Toolkit Fast-Track — Consolidated Adoption Decision

**Purpose:** stop evaluating overlapping repositories one at a time. Route each AXIMACH task to the strongest compatible tool from the existing candidate set, run grouped checks, and reuse source selectively.

## Operating decision

AXIMACH remains the product and source of truth. The existing custom CSS, React 19, TypeScript, Vite, Motion, Lucide/Tabler, Node APIs, local-first manufacturing records and module IDs remain intact.

Do not install every candidate. Most listed projects are design references, agent skills, protocols or overlapping component collections—not production dependencies. Use one best-fit choice per capability, reuse existing dependencies first, and make only bounded source-level adaptations.

## Selected stack

| Capability | Selected path | Why / limits |
|---|---|---|
| Engineering workflow | Existing `aximach-engineering-cycle` skill adapted from gstack | Already committed; plan, investigate, review, QA and verify without adding a runtime package. |
| Multi-agent analysis | Existing AXIMACH Ruflo wrapper only | `scripts/aximach-ruflo-mcp.mjs` pins Ruflo 3.80.0, isolates its HOME/cache and allowlists three read-only diff-risk tools. Never expose raw Ruflo or install its full hooks/daemon/swarm. |
| Animated UI components | Magic UI source-level adaptations + existing Motion | Magic UI is MIT and already uses `motion/react`. Copy/adapt selected source components, not its website/app stack or Tailwind dependency. First example: `src/visuals/NumberTicker.tsx`. |
| UI design review | Unslop + Impeccable + Taste Skill + UI UX Pro Max / UI Skills / Emil Kowalski Skills as development-time references | Use as a combined critique checklist for visual hierarchy, consistency, responsiveness, accessibility and motion. Never add these as app dependencies. |
| Charts and analytics | Existing ECharts + Zod | Already listed in package.json. Use ECharts for manufacturing analytics and Zod at import/API boundaries; do not add another charting or validation library without evidence. |
| Generative UI / AI copilot | Evaluate A2UI with CopilotKit as the preferred constrained presentation route; Vercel AI SDK only if an AI server integration is actually needed | UI must be rendered from an allowlisted AXIMACH component catalogue and real record data. No arbitrary executable agent-generated UI. Human approval remains mandatory for consequential writes. |
| Data grids | Existing tables first; TanStack Table + TanStack Virtual only for measured high-volume screens | Avoid a table rewrite. Add only where profiling proves current registers are too slow or limited. |
| Process graph editor | Keep AXIMACH's persisted route relationships and Route Flow. Evaluate React Flow only for a concrete graph-editing gap | Do not replace existing manufacturing relationship IDs or route records. |
| 3D | Keep AXIMACHWebGLSphere and Manufacturing Universe. React Three Fiber + Drei are optional for a specific new scene | No second 3D engine just to replace a working shell. |
| Animation timelines | Existing Motion | Do not add GSAP for effects already handled by Motion. Only revisit for complex timeline choreography Motion cannot do cleanly. |
| Forms | Existing controls + Zod; React Hook Form only for complex multi-step forms | No form-system replacement. |
| Component frameworks | No Mantine/second design system; no Tailwind migration | Keep AXIMACH's custom CSS and tokens. Adapt individual components to current styling. |

## Candidate dispositions

### Adopt now / reuse immediately
- **gstack:** workflow patterns are already adapted into the AXIMACH engineering-cycle skill.
- **Magic UI:** source-level, MIT-licensed components using Motion; adapt small pieces that fit manufacturing screens. The NumberTicker adaptation is the first implementation.
- **ECharts and Zod:** already installed; use them where the feature requires charts or runtime boundary validation.
- **Unslop, Impeccable, Taste Skill, UI UX Pro Max, UI Skills, Emil Kowalski Skills:** use as development-time visual/design review inputs, not product dependencies.

### Keep optional behind a specific use case
- **Ruflo:** developer-only, through the current AXIMACH allowlist wrapper.
- **CopilotKit + A2UI + Vercel AI SDK:** separated AI layer; add only with an authenticated backend/model route, schema validation, action receipts and human approvals.
- **TanStack Table/Virtual, React Flow, React Three Fiber/Drei, React Hook Form:** add only when measured gaps justify them.
- **Unlumen UI, SmoothUI, Skiper UI, ThreeUI, Hallmark, Cult UI, Origin UI, Aceternity UI, Motion Primitives, React Bits, Animmaster Lib:** component/reference candidates, not a reason to add multiple UI systems. Check exact component source, licence, Tailwind/Radix/shadcn assumptions, additional dependencies, reduced-motion behavior and bundle impact before reuse.
- **GSAP:** defer because Motion is already the animation runtime.
- **Generative UI:** a design pattern/protocol family, not permission to execute arbitrary generated code.

### Reject as default architecture changes
- Installing all repositories or all registry packages.
- Replacing the existing AXIMACH CSS/design system with Tailwind or Mantine merely to match a component library.
- Replacing the existing 3D shell or persisted Route Flow model without a demonstrated functional gap.
- Embedding Ruflo or developer-agent runtimes in the production app.
- Allowing an AI agent to directly commit, delete, transfer, approve payments or change manufacturing records without an explicit, previewed and authorized user action.

## Fast-track procedure for future work

1. Map the requested feature to one capability row above.
2. Compare only the best one or two candidates for that capability in parallel; do not review all repositories sequentially.
3. Prefer a compatible existing dependency or a small MIT/Apache source adaptation. Record upstream URL, pinned revision and licence in `THIRD_PARTY_NOTICES.md`.
4. Implement the smallest complete feature in the existing AXIMACH architecture.
5. Run focused tests, `npm run test:functional`, `npm run build`, then the applicable browser/platform CI gate.
6. Report PASS/FAIL/SKIPPED honestly. Keep the PR open; no merge, deployment or paid-service use without approval.

## Current implementation from this fast-track

- Added `src/visuals/NumberTicker.tsx`, adapted from Magic UI's NumberTicker at pinned revision `b0b2e4974b1b68cd5278277c6837a27736e20c3a`.
- Integrated it with the existing live record-count nodes in `src/AXIMACHOrb.tsx`.
- Uses the already installed Motion dependency, Indian number formatting, accessible final-value label and reduced-motion behavior.
- Added the upstream MIT attribution/license in `THIRD_PARTY_NOTICES.md`.
- No new runtime dependency was added.

## Scope note

The current AXIMACH branch has a 35-candidate integration matrix. The visible shortlist also includes the UI/agent projects named above. This document consolidates that recorded set; it does not claim an independent source/licence audit of repository names that are not present in the branch's candidate matrix or the working conversation context.
