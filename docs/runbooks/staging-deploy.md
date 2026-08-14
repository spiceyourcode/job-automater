# Runbook — Staging Deploy

## Purpose

Deploy API + client to a staging environment for closed beta / E2E.

## Prerequisites

| Item | Status (P12.3) |
|------|----------------|
| Cloud accounts (API, DB, Redis, object storage, FE) | **BLOCKED** — not provisioned in-repo |
| Secrets from staging template | **DONE (template)** — see `.env.staging.example` (placeholders only) |
| Migrations runnable against staging DB | **BLOCKED** — needs staging `DATABASE_URL` |

## Steps

1. Provision API service; set env vars from `.env.staging.example`.  
2. Run migrations + seed / admin setup (`cd api && npm run db:migrate`).  
3. Deploy frontend; set `NEXT_PUBLIC_API_URL` / `API_URL` to the staging API (public URL only — no secrets).  
4. Smoke: `/health` → `/health/flags` → login → critical path.  
5. Run API E2E: `cd api && npm test` (includes `e2e/happy-path.test.ts` — register → onboard → source → match → generate → **approve** → submit).  
6. Record URLs and any OPEN blockers in `.agent-settings/blockers.md`.

## Rollback

Redeploy previous image/commit; keep DB migrations forward-only unless a dedicated down plan exists.

## P12.3 drill result

| Step | Result |
|------|--------|
| Template + checklist reviewed | **DONE** |
| Live staging provision + smoke | **BLOCKED** — no staging host; blocker logged here and in beta-launch exit criteria |
