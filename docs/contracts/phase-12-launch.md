## Contract — Phase 12 Production Launch

**Phase:** 12  
**Services:** `api/`, `web/`, CI, `docs/runbooks/`

### GOAL
PRD Phase 6 remaining + runbooks: CI, API rate limits, observability, OpenAPI, landing page, staging smoke, a11y. Beta exit criteria in `docs/runbooks/beta-launch.md`.

### CONSTRAINTS
- Self-hosted Docker Compose (existing runbooks) — no K8s required
- HG-1–HG-10 still enforced
- Feature flags for risky surfaces (beta-launch.md)

### FORMAT
- `.github/workflows/ci.yml` — api typecheck+test, web typecheck, workers pytest
- Redis-backed API rate limit (Schema §2.1)
- Sentry (or equivalent) + structured logs without PII
- OpenAPI from Hono routes; marketing `/` landing
- Execute staging-deploy + backup-restore drill notes

### FAILURE
- CI missing on main
- Secrets in GitHub Actions logs
- Landing page ships client-side API secrets
- Beta checklist items left unchecked with no blocker logged
