---
name: aximach-engineering-cycle
description: Use for every AXIMACH bug fix, module improvement, integration, refactor, performance change, or release-readiness task. Enforces diagnosis before edits, one bounded work item, regression tests, evidence-based verification, and an independent risk review.
---

# AXIMACH Engineering Cycle

This is the default development workflow for AXIMACH. It adapts the plan, investigate, review, QA, verify, and ship disciplines from [gstack](https://github.com/garrytan/gstack) (MIT) to AXIMACH's actual stack and release constraints. Do not install gstack, Ruflo, or any other orchestrator as an application dependency.

## 1. Establish the real baseline

Before changing code:

- Confirm the current branch, working-tree state, latest commit, and open PR. Keep `main` untouched. Do not merge, deploy, publish, or release without explicit approval.
- Read the relevant source files and trace the full path: screen/component → state/data hook → API/storage → validation/permissions → tests.
- Identify existing patterns and shared components before adding a new one. Do not duplicate an existing feature under a new name.
- Read relevant project docs and tests. Treat source code and executable tests as the final authority when documentation is stale.
- Record which failures are pre-existing and which are caused by the current change.

## 2. Define one bounded work item

For the current item, write down:

1. The user-visible problem or capability.
2. The root cause or missing behavior, supported by source evidence.
3. The smallest safe change that solves it.
4. The exact files/modules likely to change.
5. Acceptance criteria and regression cases.
6. Data, security, compatibility, and migration risks.

Do not expand into unrelated modules. Work one item at a time; move to the next only when the current item is verified or explicitly blocked.

## 3. Investigate before fixing

For defects, reproduce the problem or identify a deterministic failing path before editing. Follow the data from input to persistence and back to the UI. Check error handling, stale state, duplicate actions, race conditions, permissions, and related paths.

Do not guess at a fix from a symptom. Do not repeatedly apply speculative patches. If evidence is insufficient, state exactly what is missing and use the least invasive diagnostic.

## 4. Prove the regression

- For a bug, add or update a test that fails for the broken behavior before applying the fix, where the test architecture permits.
- For a feature, test the acceptance criteria, invalid inputs, permission boundaries, empty states, and failure states.
- Prefer existing Node test, browser-smoke, and test-fixture conventions. Avoid introducing a second test framework without a demonstrated need.
- Tests must assert observable behavior, not merely that a component or function exists.

## 5. Implement the smallest complete fix

- Preserve existing AXIMACH module IDs, shared records, manufacturing relationships, navigation, and supported desktop/mobile behavior.
- Preserve local-first behavior and the current optional server-sync architecture. Do not silently change the source of truth or data shape.
- Reuse existing components, hooks, CSS tokens, icons, and libraries before adding dependencies.
- Do not add a dependency until its canonical source, licence, maintenance, security posture, compatibility, bundle impact, and actual use case have been checked.
- Validate all untrusted input at system boundaries. Enforce authorization on the server, not only by hiding UI controls. Never expose secrets in logs or API responses.
- Keep UI changes accessible, responsive, touch-friendly, and respectful of reduced-motion settings.

## 6. Verify in layers

Run the narrowest relevant check first, then the broader gates that the change affects:

| Gate | AXIMACH command / evidence |
|---|---|
| Focused regression | The test file(s) for the changed behavior |
| Functional suite | `npm run test:functional` |
| Type-check and production web build | `npm run build` |
| Browser navigation and interaction smoke | `npm run test:browser` |
| Windows packaging | `npm run package:windows` when packaging or desktop integration is affected |
| Android packaging | Android CI build when Capacitor/mobile integration is affected |

Use the repository's current CI workflow as the authoritative platform gate. Do not run expensive platform builds for every small change when an affected-code test, functional suite, and web build are sufficient.

Report every gate as PASS, FAIL, SKIPPED, or BLOCKED. A CI job passing is evidence only for the checks it actually ran. Never claim an unrun physical-device test, production deployment, or external service health check.

## 7. Independent review before closing the item

Review the diff separately from the implementation pass:

- **Data integrity:** relationships, totals, soft deletion, duplicate submissions, stale reads, local/server parity, and backward compatibility.
- **Security:** authentication, role authorization, validation, tenant/company scoping, secret handling, and API exposure.
- **Reliability:** retries, partial failures, timeouts, offline behavior, and concurrency.
- **UI/UX:** navigation parity, keyboard and touch use, loading/empty/error states, responsive layouts, and reduced motion.
- **Performance:** unnecessary dependencies, large lists, repeated work, bundle growth, and lazy loading.
- **Completeness:** all relevant views, routes, exports, reports, and dependent modules handle the change.

Fix verified high-severity findings before calling the item complete. Keep speculative or unrelated improvements out of the current patch.

## 8. Close with evidence

Update relevant documentation only when behavior, commands, configuration, or architecture changed. Ensure the PR description matches the actual diff and latest CI state.

Report:
- What changed and why.
- Files/modules affected.
- Root cause and regression test, when applicable.
- Exact commands/jobs run and their outcomes.
- Remaining limitations or unverified behavior.
- Branch and PR link.

Do not merge or deploy. Stop at the approval boundary.

## AXIMACH-specific architecture guardrails

- Frontend: React 19, TypeScript, Vite, custom CSS, Motion, Lucide and Tabler icons. Tailwind is not the current styling foundation.
- Manufacturing data and workflows: inspect `src/manufacturingData` and existing record hooks before changing persistence or relationships.
- App/module routing and navigation: keep `src/App.tsx`, `src/AXIMACHOrb.tsx`, and Manufacturing Universe navigation consistent.
- Backend: Node server APIs must validate requests and enforce authorization independently of the client.
- Runtime dependencies are for AXIMACH users; agent skills and developer tools belong in the development workflow, not the production app bundle.
