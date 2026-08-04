# JobAutomater — Coding Conventions

> Three services, one repo, no Turborepo/Nx. Read before implementing in `api/`, `web/`, or `workers/`.

---

## Reading Order

`docs/PRD.md` → `docs/TRD.md` → `docs/Backend_Schema.md` → `docs/AppFlow.md` → `docs/Implementation_Plan.md` → phase contract in `docs/contracts/`.

---

## Domain Guardrails

- **Product:** AI job application automation — collect, match, generate docs, approval-gated apply, email monitor.
- **Roles (Phase 1):** `user` only. Phase 6 adds `member`, `viewer`, `owner`.
- **Salary:** Integer USD cents in DB; display formatted in UI.
- **Apply:** Status flow `draft → pending_approval → approved → submitted`. No blind auto-submit (HG-4).
- **PII:** CVs and emails are sensitive — encrypt at rest where noted in TRD; never log body content.

---

## Where Code Goes

| Building… | Put it in… |
|-----------|------------|
| REST API route | `api/src/modules/<module>/<module>.routes.ts` |
| Business logic | `api/src/modules/<module>/<module>.service.ts` |
| DB schema | `api/src/db/schema/` (Drizzle) |
| Queue producer | `api/src/queues/` |
| Dashboard page | `web/app/` (App Router) |
| Product UI composite | `web/components/` (e.g. `JobCard`) |
| shadcn primitive | `web/components/ui/` — **add via CLI/MCP only** |
| LangGraph agent | `workers/agents/<name>/` |
| Job collector | `workers/collectors/<type>.py` |
| Celery task | `workers/tasks/` |

---

## Web / UI (`web/`)

Canonical design: [`docs/UIUX_Design.md`](./docs/UIUX_Design.md) — **classic shadcn new-york + neutral (B&W)**.

| Rule | Detail |
|------|--------|
| Kit | shadcn/ui only; no parallel component libraries |
| Theme | `components.json`: style `new-york`, baseColor `neutral` — do not recolor primary to brand blue |
| MCP | `.cursor/mcp.json` → `shadcn`; search/add/audit before inventing UI |
| Icons | `lucide-react` SVG — never emoji icons |
| Forms | `react-hook-form` + Zod + shadcn `Form` |
| Toasts | `sonner` `<Toaster />` once in root layout |
| Secrets | `NEXT_PUBLIC_*` only for non-secrets (HG-1) |

```bash
cd web
npx shadcn@latest add button card dialog  # or MCP get_add_command_for_items
```

---

## Naming

| Artifact | Convention | Example |
|----------|------------|---------|
| TS files | kebab-case | `job-scores.service.ts` |
| Python files | snake_case | `match_score.py` |
| DB tables/columns | snake_case | `job_scores`, `created_at` |
| API routes | kebab-case | `/api/v1/job-scores` |
| Env vars | UPPER_SNAKE | `DATABASE_URL`, `OPENAI_API_KEY` |

---

## API Module Shape (`api/src/modules/<name>/`)

| File | Responsibility |
|------|----------------|
| `<name>.routes.ts` | Hono routes — thin handlers |
| `<name>.service.ts` | Business logic |
| `<name>.schema.ts` | Zod validation |
| `<name>.test.ts` | Tests |

---

## TS/Python Boundary

- API enqueues jobs to Redis with payloads matching `contracts/queue-payloads.schema.json`.
- Workers consume Celery tasks; write results via API internal callback or worker DB role.
- Do not duplicate business rules in both languages — source of truth for state transitions is `api/`.

---

## Testing

- **api:** Vitest + Hono test client
- **web:** Vitest + React Testing Library
- **workers:** pytest; golden-set JSON for extract/match agents

---

## Commit Convention

```
feat(api): add source CRUD endpoints (FR-JC-01)
feat(workers): RSS collector plugin
fix(web): approval gate before submit button
```

---

## Definition of Done

Meets phase contract FAILURE clauses; tests pass; HG gates satisfied; `active-plan.md` updated.
