# Agent workflow (minimal)

## Start a task

1. Open `project-backlog.md` — first row without `[x]`.
2. Open the linked `docs/contracts/phase-*.md` for that phase.
3. Add a short section to `.agent-settings/active-plan.md` (task ID + 3–5 bullets).
4. If the task touches auth, API modules, PII/CV, or workers — read the matching file under `docs/agent/skills/`.
5. Implement per `CONVENTIONS.md`.
6. Run verification from the phase contract; `cd api && npm test` when API changed; `pytest` under `workers/` when Python changed.
7. Commit with the task ID in the message; then mark `[x]` in the backlog (HG-11).

## When stuck

- **Scope unclear** — ask the user; check PRD/TRD once, not every file in `docs/`.
- **Architecture fork** — prefer the pattern already used in the nearest module.
- **Staging / launch** — `docs/runbooks/` (do not invent new runbook trees).

## Validators (optional)

```bash
scripts/validators/rbac-validator.sh
scripts/validators/drizzle-validator.sh
scripts/validators/feature-hardening-validator.sh
```

## Retired

Per-phase copy-paste prompts and `phase-orchestrator.md` were removed — backlog + contracts are the source of truth.