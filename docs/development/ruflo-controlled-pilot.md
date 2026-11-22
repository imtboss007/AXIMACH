# AXIMACH — Ruflo controlled development pilot

**Status: evaluated; runtime installation deferred.**  
**Reviewed upstream:** [ruvnet/ruflo](https://github.com/ruvnet/ruflo)  
**Reviewed package version:** 3.80.0  
**Reviewed licence:** MIT

## Why evaluate it

Ruflo offers agent coordination, project memory, MCP tools, hooks, and a guidance control-plane package. Those capabilities could help AXIMACH work across complex modules, but the full CLI bootstrap is substantially broader than a small developer helper.

The root README describes `ruflo init` as adding agents, hooks, memory, an MCP server and project files. The package manifest includes a large dependency surface and optional native/vector components. This is not appropriate as an AXIMACH production dependency.

## Source findings that affect the decision

1. The root package manifest identifies version 3.80.0 and MIT licensing.
2. The default CLI setup has multiple integration surfaces (agents, hooks, memory and MCP), so running `npx ruflo@latest init` directly in the AXIMACH repository would create a wide, difficult-to-review change.
3. The guidance package documents four gates: destructive operations, tool allowlist, diff size, and secret detection.
4. **Important limitation:** in the inspected `gates.ts`, the default configuration has `toolAllowlist: false`. An allowlist is not protective unless explicitly enabled and populated. The upstream ADR also documents this as disabled by default.
5. The documented destructive-operation gate requires confirmation rather than always blocking. Its pattern-based check can flag safe and unsafe commands alike.
6. Ruflo's CLI contains a risky-settings check for project auto-approval settings and helper integrity. This is useful, but it does not replace independent review of the installed hooks, helper scripts, MCP server, and permissions.
7. The CLI offers anonymous telemetry opt-in prompts (default No according to its source). The pilot must explicitly record the telemetry choice and must not assume that skipping a prompt is equivalent to a tested network-disabled configuration.

## Decision for AXIMACH

- **Do not add Ruflo to `dependencies` or `devDependencies`.**
- **Do not run the full `ruflo init` in the AXIMACH working branch.**
- **Do not register an always-on Ruflo MCP server or enable background daemons/hooks yet.**
- Keep AXIMACH's existing `AGENTS.md` and `.agents/skills/aximach-engineering-cycle/SKILL.md` as the current default workflow.
- Evaluate Ruflo only in a disposable clone/worktree on a dedicated branch, with no production secrets, no access to deployment credentials, and no ability to merge or deploy.
- Pin the exact version for the evaluation; do not use `@latest`.
- Review every generated file and hook before enabling anything. Reject broad auto-approval settings. Start with a small, explicit tool allowlist; do not assume the upstream default enables it.
- Keep the first run read-only: ask the coordinator to map one AXIMACH module, identify its data dependencies and tests, and return evidence with file paths. It must not edit files, call external services, or write persistent memory.
- If the read-only run is accurate and useful, a second run may propose tests for one bounded defect. A human reviews the proposed patch before any write is allowed.
- Compare the pilot against the existing single-agent workflow: elapsed time, duplicate investigation, missed dependencies, factual accuracy, token/cost usage, test quality, and review burden.
- Keep Ruflo only if the measured improvement justifies its setup and ongoing maintenance.

## Pilot acceptance gates

| Gate | Required evidence | Current status |
|---|---|---|
| Version and licence pinned | Exact version and MIT licence checked in upstream package metadata | PASS |
| Installation isolated | Disposable clone/worktree; no AXIMACH root mutation | NOT RUN |
| Hooks and helpers reviewed | Complete generated diff and execution paths inspected | NOT RUN |
| Tool permissions constrained | Explicit allowlist enabled and tested; no wildcard grants | NOT RUN |
| Telemetry/network behavior understood | Explicit consent state and observed outbound behavior | NOT RUN |
| Read-only task evaluated | Source-backed module map; no edits or side effects | NOT RUN |
| Output compared to baseline | Accuracy, time, cost and review effort measured | NOT RUN |
| Write pilot approved | Human approval after read-only gates pass | NOT RUN |

## First candidate task

Use a single medium-sized AXIMACH module (not the whole repository) and ask Ruflo to produce:

- module entry points and route/component tree;
- data hooks, API/storage calls and record relationships;
- current tests and missing regression coverage;
- top five concrete risks with exact source paths;
- a test plan only, with no code edits.

The coordinator must reconcile agent disagreements and cite source paths for each claim. No agent may merge, deploy, publish, or change credentials.

## Source files reviewed

- `README.md`
- `package.json`
- `v3/@claude-flow/cli/package.json`
- `v3/@claude-flow/cli/src/commands/init.ts`
- `v3/@claude-flow/cli/src/init/risky-settings-gate.ts`
- `v3/@claude-flow/guidance/src/gates.ts`
- `v3/@claude-flow/guidance/src/types.ts`
- `v3/@claude-flow/guidance/docs/adrs/ADR-G004-four-enforcement-gates.md`

## Final status

Ruflo is a **candidate for an isolated engineering pilot**, not an approved AXIMACH dependency. No Ruflo package, hook, agent, MCP server, daemon, or external service has been installed or enabled in AXIMACH.
