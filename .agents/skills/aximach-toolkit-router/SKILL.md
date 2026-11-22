---
name: aximach-toolkit-router
description: Use for AXIMACH feature work when multiple external UI, graphics, AI, data, agent or engineering repositories could help. Routes work to the consolidated fast-track stack instead of evaluating repositories sequentially or installing overlapping packages.
---

# AXIMACH Toolkit Router

Read `docs/36-toolkit-fast-track.md` before selecting any external tool for AXIMACH.

## Required behavior

- Route the task by capability, not by repository name.
- Use the selected stack in the fast-track document first. Do not restart a one-repository-at-a-time evaluation.
- For overlapping candidates, compare at most the best one or two in parallel and select one winner. Reuse current dependencies where possible.
- Prefer source-level component adaptations over adding a full component framework or framework migration.
- Check exact upstream component source, licence, commit/revision, styling/runtime assumptions, required dependencies, accessibility, reduced motion and bundle impact before copying.
- Add attribution and required licence text to `THIRD_PARTY_NOTICES.md` for any copied/adapted source.
- Never add tools used only by developers to AXIMACH production dependencies.
- Keep AI-generated interfaces constrained to a fixed allowlist of native AXIMACH components and validated data. Treat model/tool output as untrusted input.
- Require server-side authorization, user-visible action previews and explicit human approval before consequential data writes.
- Preserve AXIMACH's existing manufacturing data model, module IDs, navigation, custom CSS, Motion runtime, 3D shell and Route Flow relationships.
- Do not install or use paid/pro-only assets without the user's explicit approval.
- Do not merge, deploy or publish without explicit approval.

## Batch completion report

Report the selected candidate(s), why they fit AXIMACH, what was implemented, exact files/dependencies changed, licence attribution, test evidence and any work not yet run. Do not imply that a source review is a live integration test.
