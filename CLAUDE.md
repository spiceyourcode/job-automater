# JobAutomater — agent protocol

## Stack

| Layer | Path | Tech |
|-------|------|------|
| API | `api/` | Hono + Drizzle + BullMQ |
| Web | `web/` | Next.js 16 + shadcn/ui (`new-york` / `neutral`) |
| Workers | `workers/` | Celery + LangGraph + Playwright |

## Workflow

```
1. Task ID     → project-backlog.md (open row only)
2. Contract    → docs/contracts/phase-*.md for that phase
3. Plan        → .agent-settings/active-plan.md (HG-7) — one short bullet block per task
4. Code        → CONVENTIONS.md
5. Verify      → api: npm test · workers: pytest · contract checklist
6. Commit      → one commit per task ID in message (HG-11)
7. Sync        → mark backlog [x] only after that commit
```

Task template and skill triggers: [`docs/agent/README.md`](./docs/agent/README.md)

## Hard gates

| ID | Rule |
|----|------|
| HG-1 | NO client-side secrets |
| HG-2 | NO unprotected routes |
| HG-3 | NO float salary — integer cents + currency |
| HG-4 | NO submit without POST /applications/:id/approve |
| HG-5 | Read `docs/agent/skills/*` when the task touches that domain |
| HG-6 | NO cross-module DB queries |
| HG-7 | NO code without `active-plan.md` entry |
| HG-8 | NO PII in logs |
| HG-9 | NO hallucinated CV content |
| HG-10 | NO n8n — BullMQ + Celery only |
| HG-11 | NO backlog `[x]` without a commit for that task ID |

## Skills (local)

| Path | When |
|------|------|
| `docs/agent/skills/backend-module-skill.md` | `api/src/modules/*` |
| `docs/agent/skills/auth-rbac-skill.md` | Auth, JWT, ownership |
| `docs/agent/skills/safety-moderation-skill.md` | CV, email, GDPR, logs |
| `docs/agent/skills/job-agent-skill.md` | Workers, collectors, apply agents |

Use Cursor `@` skills (security, zod, async-python, etc.) when obvious from the task — no matrix to memorize.

## Project status

**Phases 0–14 (through P14.1 voice mock interview): complete.**

**Ops (when onboarding envs):** `cd api && npm run db:migrate` (through `0020_mock_interview_sessions`); restart API and Celery after schema changes; re-index CVs if embeddings empty.

**Blockers:** [`docs/runbooks/blockers.md`](./docs/runbooks/blockers.md)

## Doc map

| Need | Path |
|------|------|
| Backlog | `project-backlog.md` |
| PRD / TRD / flows | `docs/PRD.md`, `docs/TRD.md`, `docs/AppFlow.md` |
| Schema / UI | `docs/Backend_Schema.md`, `docs/UIUX_Design.md` |
| Phase contracts | `docs/contracts/phase-*.md` |
| Queue payloads | `contracts/queue-payloads.schema.json` |
| Runbooks | `docs/runbooks/` |