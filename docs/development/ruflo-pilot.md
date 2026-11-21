# Ruflo development pilot — completed, restricted adoption

Status: **MCP pilot passed; only a read-only development subset is approved for continued evaluation. Ruflo is not part of the AXIMACH runtime and is not automatically connected to a developer client.**

## Why the full Ruflo setup was rejected

The upstream CLI package is MIT-licensed and was pinned to version 3.80.0 for this pilot. The direct MCP server exposed 393 tools, including agent execution, terminal execution, browser control/cookie access, configuration writes, memory deletion, workflow execution and federation operations.

The raw 393-tool surface is too broad for AXIMACH's normal development workflow. Do not run the upstream server directly as a general-purpose project MCP connection.

## What was actually tested

GitHub Actions ran the pinned Ruflo MCP server in an ephemeral runner over stdio:

- MCP initialize and `tools/list`: **PASS**.
- Upstream tool inventory: **393 tools**.
- One read-only `analyze_diff` call against the AXIMACH feature branch: **PASS**.
- Ruflo analysis: **39 files changed (+3,894 / -71), heuristic risk score 29/100 (high)**, with 2 high-risk and 4 medium-risk file classifications. The classifier labelled the work as test/feature with critical impact. These are triage heuristics, not a security finding or a substitute for source review.
- Independent follow-up checked the flagged `server/auth.mjs` change: it adds the active-user ID list and maps `GET /api/audit-events` to `audit:read`; the existing role matrix grants wildcard permissions only to admins, not manager/operator/viewer roles. The `server/index.test.mjs` changes add audit-access regression coverage and test-only credentials. The generic "potential secrets" warning was not verified as a production secret.
- A second, restricted-wrapper test exposed exactly three tools and executed only `analyze_diff`: **PASS**.
- A request to `terminal_execute` was rejected by the wrapper allowlist: **PASS**.
- No API credentials, production data, customer data or user-home configuration were passed to the Ruflo process. No agent, workflow, shell or browser tools were executed.

## AXIMACH's restricted wrapper

Two developer-only scripts are now available:

- `scripts/aximach-ruflo-mcp.mjs` — starts Ruflo 3.80.0 over stdio with a temporary HOME/cache and a minimal environment. It exposes only:
  - `analyze_diff`
  - `analyze_diff-risk`
  - `analyze_file-risk`
- `scripts/ruflo-mcp-smoke.mjs` — verifies the MCP handshake, exact three-tool allowlist, a real read-only diff analysis, and rejection of `terminal_execute`.

The wrapper enforces the allowlist at the protocol boundary. It also forces `useRuVector: false` for `analyze_diff`. All other upstream tools and methods are blocked. Keep the wrapper and Ruflo out of `package.json` and the AXIMACH production bundle.

### Local developer use

From the AXIMACH repository root, configure the local MCP client to launch:

```bash
node scripts/aximach-ruflo-mcp.mjs
```

Use the repository root as the working directory. Do not configure `npx claude-flow mcp start` directly. The wrapper downloads the pinned package on first launch; review and deliberately approve that network/package execution in the developer environment. No project MCP configuration is committed or enabled automatically.

## Boundaries and limitations

- The three exposed tools provide diff/file risk triage only. They do not understand manufacturing business correctness, prove a security vulnerability, write tests, fix bugs, or run AXIMACH builds.
- Continue using the AXIMACH Engineering Cycle for source investigation, regression tests, implementation, independent review and verification.
- Do not add Ruflo agents, swarm orchestration, persistent memory, hooks, browser sessions, remote providers, telemetry, paid model access, shell execution, git writes, pushes, deployment or release without a separate review and explicit approval.
- Re-check the pinned upstream package, licence, dependencies and security notes before upgrading beyond 3.80.0.

## Decision

**Adopt only the three-tool read-only development wrapper for further evaluation. Do not install the full Ruflo harness.** Retain the engineering-cycle skill as the default method. Measure whether risk triage saves time on the next real AXIMACH defect; if it does not improve the workflow, remove the wrapper and move to the next candidate.

## Upstream references

- [Ruflo repository](https://github.com/ruvnet/ruflo)
- [Ruflo README and install paths](https://github.com/ruvnet/ruflo#quick-start)
- [Ruflo MCP server source](https://github.com/ruvnet/ruflo/tree/main/v3/@claude-flow/mcp/src)
- [Ruflo changelog](https://github.com/ruvnet/ruflo/blob/main/CHANGELOG.md)
