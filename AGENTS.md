# AXIMACH contributor instructions

Before making any AXIMACH code change, read and follow [the AXIMACH Engineering Cycle skill](.agents/skills/aximach-engineering-cycle/SKILL.md).

For work involving external UI, graphics, AI, data or developer-tool repositories, also read [the AXIMACH Toolkit Router skill](.agents/skills/aximach-toolkit-router/SKILL.md) and follow [the consolidated fast-track adoption decision](docs/36-toolkit-fast-track.md). Batch overlapping candidates by capability; do not review or install every repository sequentially.

For any graphics, motion, visual design, dashboard styling or 3D UI task, also read [the AXIMACH Visual Engineering skill](.agents/skills/aximach-visual-engineering/SKILL.md).

Core rules:

- Preserve the existing application and its manufacturing workflows; do not rebuild modules or replace the architecture to accommodate a tool.
- Investigate the actual code path before editing. For bugs, prove the regression with a test where practical, then make one bounded fix.
- Use the existing stack and components first. Add external repositories, packages, or agent tools only after checking source, licence, maintenance, security, compatibility, and measurable benefit.
- Keep developer-agent tooling separate from AXIMACH's production dependencies.
- Keep `main` untouched. Work on the existing feature branch/PR unless an explicitly approved alternative is needed.
- Never merge, deploy, publish, or incur paid-service costs without explicit approval.
- Run the relevant tests and build gates; report exact evidence and clearly mark skipped or unverified checks.

- If using Ruflo during development, launch only through `node scripts/aximach-ruflo-mcp.mjs` from the repository root. Never connect the raw Ruflo MCP server; the wrapper exposes only three read-only diff-risk tools and blocks other tool calls.
- The Ruflo wrapper is optional developer tooling, pinned to 3.80.0. Do not add Ruflo to production dependencies or run its full project `init`/hook installation.
