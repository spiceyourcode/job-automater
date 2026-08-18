# JobAutomater

JobAutomater is an AI-assisted job search product. It collects openings from the sources you configure, scores them against your CV, drafts tailored application documents, and **never submits until you approve**.

## What it does

1. **Collect** — RSS, REST APIs, IMAP (including LinkedIn job alerts), career pages, Playwright site scrapes, and Telegram.
2. **Normalize & match** — Deduplicate listings and score fit against your indexed CV (skills, experience, location, salary, culture).
3. **Generate** — Produce a tailored CV and cover letter grounded in your uploaded content.
4. **Approve & apply** — Review traces, approve, then submit (ATS APIs or Playwright). Auto-submit without approval is blocked.
5. **Follow-up** — Classify recruiter email, track pipeline stages, and show analytics.

## Stack

| Layer | Path | Tech |
|-------|------|------|
| API | `api/` | Hono, Drizzle ORM, BullMQ, PostgreSQL |
| Web | `web/` | Next.js 16, shadcn/ui (`new-york` / `neutral`) |
| Workers | `workers/` | Celery, LangGraph, Playwright |
| Infra | `docker-compose.yml` | Postgres (pgvector), Redis, MinIO |

Queue payloads between API and workers are defined in `contracts/queue-payloads.schema.json`.

## Run locally

**Prerequisites:** Node 20+, Python 3.12+, Docker.

```bash
cp .env.example .env
docker compose up -d
```

Postgres is `postgresql://jobautomater:jobautomater@127.0.0.1:5432/jobautomater`. Prefer `127.0.0.1` over `localhost` on Windows. If a local Postgres already owns port 5432, set `POSTGRES_PORT` in `.env` (used by `docker-compose.yml`) and point `DATABASE_URL` at the same host port. On Windows, Hyper-V often reserves 5433–5532 — use `15432` instead.

**API** (default `http://localhost:3001`):

```bash
cd api
npm install
npm run db:migrate
npm run dev
```

**Web** (default `http://localhost:3000`):

```bash
cd web
npm install
npm run dev
```

**Workers:**

```bash
cd workers
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e ".[dev]"
celery -A celery_app worker -l info
```

On Windows the worker uses `--pool=solo`. After adding Playwright sources, run `python -m playwright install chromium` once.

Confirm the API with `GET http://localhost:3001/health`.

## Configuration

Copy `.env.example` to `.env`. Required for local run: `DATABASE_URL`, `JWT_SECRET` (≥32 chars), Redis, and MinIO/S3 keys. Optional:

- OAuth: `OAUTH_GOOGLE_*`, `OAUTH_GITHUB_*`, `OAUTH_LINKEDIN_*`. For **Connect Gmail**, enable the Gmail API on that Google Cloud project and add `{API_PUBLIC_URL}/api/v1/auth/gmail/callback` as a redirect URI.
- LLM: `OPENAI_API_KEY`, `QROK_API_KEY`, `GOOGLE_API_KEY`, `CEREBRAS_API_KEY` (server-side only)
- Apply: `GREENHOUSE_JOB_BOARD_API_KEY`, `LEVER_API_KEY`; keep `SUBMIT_DRY_RUN=true` until you intend live submits
- `SENTRY_DSN` for API error reporting

Never put secrets in `NEXT_PUBLIC_*` variables.

## Repository layout

```
api/          HTTP API, auth, jobs, applications, analytics
web/          Dashboard, settings, document review, landing
workers/      Collectors, LangGraph agents, Celery tasks
contracts/    Shared queue JSON schemas
docs/         Product specs and runbooks
.github/      CI and issue templates
```

## Tests & CI

```bash
cd api && npm run typecheck && npm test
cd web && npm run typecheck
cd workers && python -m pytest -q
```

GitHub Actions runs those three jobs on `main` (see `.github/workflows/ci.yml`).

## Product docs

| Doc | Path |
|-----|------|
| Requirements | `docs/PRD.md` |
| Technical design | `docs/TRD.md` |
| App flow | `docs/AppFlow.md` |
| Database | `docs/Backend_Schema.md` |
| UI | `docs/UIUX_Design.md` |
| Ops | `docs/runbooks/` |
