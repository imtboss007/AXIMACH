# AXIMACH contributor instructions

Before making any AXIMACH code change, read and follow [the AXIMACH Engineering Cycle skill](.agents/skills/aximach-engineering-cycle/SKILL.md).

Core rules:

- Preserve the existing application and its manufacturing workflows; do not rebuild modules or replace the architecture to accommodate a tool.
- Investigate the actual code path before editing. For bugs, prove the regression with a test where practical, then make one bounded fix.
- Use the existing stack and components first. Add external repositories, packages, or agent tools only after checking source, licence, maintenance, security, compatibility, and measurable benefit.
- Keep developer-agent tooling separate from AXIMACH's production dependencies.
- Keep `main` untouched. Work on the existing feature branch/PR unless an explicitly approved alternative is needed.
- Never merge, deploy, publish, or incur paid-service costs without explicit approval.
- Run the relevant tests and build gates; report exact evidence and clearly mark skipped or unverified checks.
