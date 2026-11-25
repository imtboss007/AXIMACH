# Public API integration verification gate

This checklist is attached to the existing Integrations & API feature branch and runs through the repository's existing `.github/workflows/build.yml` on pushes to `integrate/**`.

- [x] Public API source register and provider readiness labels are included in the existing Integrations & API workspace.
- [x] Three fixed-origin read-only adapters are present: Frankfurter v2, Nager.Date Community v4, and the India EV charging directory.
- [x] Provider calls are made server-side; the public API routes are GET-only and administrator-only.
- [x] The shared server records audit events and the adapter layer validates inputs, bounds timeouts and caches successful results.
- [x] The browser uses the existing shared-server administrator connection helper; no new credential store is introduced.
- [x] Directory MIT attribution is separated from the independent provider terms, datasets and licences.
- [x] Adapter tests and workspace/security regression tests are included in `npm run test:functional`.
- [x] The responsive tools and candidate directory are part of the existing Integrations & API page, not a new app or repository.
- [ ] Latest-head functional suite, TypeScript/Vite build, browser smoke, Windows installer and Android APK jobs pass.
- [ ] Runtime provider smoke tests from a deployed AXIMACH server pass.
- [ ] Human review of provider terms and the candidate integrations is complete.

**Release gate:** do not merge or deploy this draft solely because source files are committed. Mark the remaining checks only after the corresponding CI or runtime evidence exists. No public deployment is performed by this change.
