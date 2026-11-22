---
name: aximach-visual-engineering
description: Use whenever changing AXIMACH graphics, visual design, motion, dashboards, 3D surfaces, component styling, responsive layouts, or UI polish. Applies an industrial manufacturing visual direction and evidence-based critique using selected principles from Unslop, Impeccable, Taste Skill, UI UX Pro Max and Emil Kowalski's design-engineering skills.
---

# AXIMACH Visual Engineering

## Mission

Make AXIMACH look and feel like a premium global manufacturing intelligence operating system—not a generic AI dashboard, landing-page template, or decorative sci-fi demo.

Preserve the user's existing workflows and manufacturing information. Improve clarity, hierarchy, speed, confidence and craft without turning every surface into an animation.

## Source references and licence notes

These projects were reviewed as design-engineering references. Their full repositories are not copied or installed into AXIMACH.

- [Unslop](https://github.com/heydamir/unslop) — CC BY 4.0. Attribution: Damir Sokolovsky, creator of Unslop. Its visual critique concepts are referenced; do not copy its skill text without preserving attribution and licence terms.
- [Impeccable](https://github.com/pbakaus/impeccable) — Apache-2.0. Reference for critique, polish, responsive/accessibility/performance audits and consistent design vocabulary.
- [Taste Skill](https://github.com/Leonxlnx/taste-skill) — MIT. Reference for product-specific visual direction and deliberate design decisions.
- [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — MIT. Reference for systematic UI patterns and platform-aware UX decisions. Do not install its CLI or Python dataset as a runtime dependency.
- [Emil Kowalski's design-engineering skills](https://github.com/attentiondotnet/emilkowalski_skills) — MIT. Reference for purposeful animation, interaction feedback and motion review.

No upstream command, plugin, agent, telemetry, or external service is required by this AXIMACH skill.

## AXIMACH visual principles

1. **Manufacturing identity first.** Visual metaphors should come from precision engineering, machining, materials, production flow, metrology, supply networks and industrial control—not generic AI gradients.
2. **One clear visual anchor per view.** The 3D AXIMACH sphere, a meaningful manufacturing visualization, or a key operational chart may lead. Keep surrounding navigation and controls quieter.
3. **Quiet, legible chrome.** Avoid decorative glows, gradient text, excessive uppercase tracking, emoji labels, unnecessary pill badges, nested cards, random icon tiles and pulsing status lights.
4. **Information density with hierarchy.** Show the most decision-relevant metric first; group supporting information; use consistent alignment, spacing, number formatting and units.
5. **Real data, real units.** Never invent values or use decorative fake telemetry. Label mock/demo data clearly. Preserve record IDs, relationships, filters and source semantics.
6. **Purposeful color.** Reserve high-salience colors for safety, quality, overdue, warning, error and selected states. Do not make every component compete for attention.
7. **Functional before ornamental.** Every graphic must improve understanding, comparison, orientation, feedback or task completion.
8. **Accessible by default.** Semantic controls, keyboard operation, visible focus, sufficient contrast, responsive touch targets, reduced-motion support and non-color status cues are required.
9. **Responsive at real breakpoints.** Validate desktop, tablet and narrow Android widths. Prevent clipped controls, unreadable labels, overflow and touch conflicts.
10. **Consistency across modules.** Reuse AXIMACH's CSS tokens, existing components, Motion, Lucide/Tabler and data hooks. Do not add a parallel design system.

## Motion decision framework

Before adding motion, answer:

- Does it explain a state change, hierarchy, spatial relationship or direct user action?
- Will users see it dozens or hundreds of times per day? If so, remove or minimize it.
- Can it be achieved with existing Motion or CSS rather than another library?
- Does it stop when offscreen or hidden?
- Does it honor OS reduced-motion preference and AXIMACH's own motion setting?
- Does it avoid blocking input, delaying navigation or consuming battery on Android?

Prefer short, direct feedback and ease-out for entrances. Animate only the properties needed. Avoid `transition: all`, continuous ambient animation on dense work screens, and animations that obscure manufacturing data.

## Required visual review

For each visual change:

1. Identify the exact screen, component, state and user task.
2. Inspect the existing code, CSS tokens and data source before changing it.
3. Capture or render the actual screen where a browser/screenshot environment is available. Do not claim visual verification if no screenshot was inspected.
4. Record the top three problems in priority order: hierarchy, readability, consistency, interaction, responsiveness, accessibility or performance.
5. Implement the smallest coherent improvement; do not redesign unrelated modules.
6. Compare before/after using a table:

| Before | After | Why |
|---|---|---|

7. Verify keyboard, pointer and touch behavior; empty/loading/error states; narrow viewport; reduced motion.
8. Run focused tests, functional suite and production build. Use browser/platform CI when affected.
9. Report visual checks separately from code/build checks.

## Graphics and 3D guardrails

- Keep the existing AXIMACH WebGL sphere and Visual Experience Studio unless a proven functional gap requires change.
- Use ECharts already installed for real operational analytics; do not add another chart library.
- Prefer SVG/CSS/Motion for small visual components. Use canvas/WebGL only when the visual complexity justifies its CPU/GPU cost.
- Avoid particle fields, shader effects, blur layers, large animated gradients and continuous rotations on dense manufacturing screens unless they provide a clear function and are disabled or reduced on low-power/mobile devices.
- Do not add a second 3D framework merely to reproduce an effect the current shell can already render.

## Final decision gate

A visual change is complete only when it improves a real user task, preserves AXIMACH data and module behavior, passes relevant tests, respects accessibility and reduced motion, and does not introduce an unjustified dependency.
