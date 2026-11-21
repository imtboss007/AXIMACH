# Ruflo development pilot — opt-in, isolated

Status: **evaluated; not installed or connected**.

Purpose: determine whether Ruflo improves AXIMACH engineering throughput on one bounded task without adding it to the AXIMACH runtime, changing production behavior, or granting a standing agent permission.

## Why this is not a full Ruflo init

The upstream quick-start `npx ruflo@latest init` installs a broad project harness: agent definitions, hooks, memory/configuration, helper files and an MCP server. That is too much surface area for the first experiment.

Ruflo's CLI package is MIT-licensed. The inspected upstream package identifies itself as version 3.80.0. Pin the pilot to that version rather than `latest`; re-check the upstream release and security notes before any later upgrade.

## Security findings that shape the pilot

- Ruflo's MCP server supports stdio and network transports. Use **stdio only** for this experiment; do not expose an HTTP/WebSocket listener or bind to a network interface.
- Upstream MCP server configuration makes tool authorization optional unless `requireToolAuthorization` is enabled and an authorizer is supplied. Do not assume every tool call has a built-in human approval gate.
- Upstream changelog notes that a loopback MCP endpoint without a token can be called by other local processes. Do not use HTTP for this pilot.
- Ruflo's broader CLI can register orchestration, memory, agent and developer tools. Treat all returned tools as potentially consequential until their exact schema and behavior are reviewed.
- Do not provide API keys, production credentials, customer data, personal data, or access to unrelated directories.
- Do not run `init`, `init --full`, `doctor --fix`, install hooks, enable telemetry, configure remote providers, or use paid models during this pilot.
- Do not enable automatic file edits, shell commands, git push, deployment, or release. Any write must be a separate explicit human-approved action.

## Isolated pilot procedure

Run this only in a disposable local clone/worktree, not in the active working copy:

1. Create a temporary copy of AXIMACH at the same commit as the PR branch. Exclude `.env*`, credentials, user data, local databases, build outputs and any unrelated repositories.
2. Keep the copy disposable and prevent writes outside that directory. Do not give the agent access to the user's home directory or production credentials.
3. Start Ruflo through a local stdio MCP client using the pinned package:
   ```bash
   npx -y ruflo@3.80.0 mcp start
   ```
   Register this command only in the local developer's MCP client configuration for the disposable pilot. Do not commit a live MCP connection to the project.
4. Before any tool call, list the exact MCP tools exposed by the installed build and inspect their descriptions/schemas. Do not invoke unknown tools. If the client cannot restrict or approve tool calls, use the disposable copy as the only accessible workspace and do not grant secrets/network credentials.
5. Ask for a read-only audit of one bounded issue: identify a high-risk AXIMACH module path, trace its data flow, list evidence and propose a regression test. Explicitly prohibit edits, shell execution, network access, commits, pushes, installs and deployments.
6. Save the output as a review note outside the active repository. Independently verify each cited file/line and run the same focused tests manually in the normal AXIMACH workflow.
7. Compare against the AXIMACH Engineering Cycle: evidence quality, missed risks, test usefulness, time saved, irrelevant output, tool calls and any unsafe permission request.

## Acceptance gate

Ruflo is useful only if the pilot produces reproducible findings that are more complete or faster than the baseline workflow, without unsafe tool calls or unnecessary setup.

Record each outcome as PASS / FAIL / BLOCKED:

- [ ] Exact Ruflo version and package provenance verified.
- [ ] Tool inventory and schemas inspected.
- [ ] No secrets or production/customer data exposed.
- [ ] No writes outside the disposable copy.
- [ ] One AXIMACH issue traced with verifiable source evidence.
- [ ] Proposed regression test is relevant and reproducible.
- [ ] Independent review confirms findings.
- [ ] Time and tool-call overhead recorded.

**Decision rule:** do not install Ruflo into AXIMACH, add it to `package.json`, or enable it for routine development unless every safety gate passes and the pilot demonstrates a measurable benefit. If it fails, keep the AXIMACH Engineering Cycle skill and move on to the next candidate.

## Current execution boundary

The GitHub integration available to this session can inspect and change repository files and monitor GitHub Actions, but it cannot launch a local stdio MCP process or inspect the user's local MCP-client configuration. Therefore the repository pilot instructions can be prepared here, but the live Ruflo handshake and tool-inventory test remain **BLOCKED pending a local developer runtime**. Do not report Ruflo as connected or tested until those checks have actually run.

## Upstream references

- [Ruflo repository](https://github.com/ruvnet/ruflo)
- [Ruflo README and install paths](https://github.com/ruvnet/ruflo#quick-start)
- [Ruflo MCP server source](https://github.com/ruvnet/ruflo/tree/main/v3/@claude-flow/mcp/src)
- [Ruflo changelog](https://github.com/ruvnet/ruflo/blob/main/CHANGELOG.md)
