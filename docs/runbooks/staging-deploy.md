# Runbook — Staging Deploy

## Purpose

Deploy API + client to a staging environment for closed beta / E2E.

## Prerequisites

- [ ] Cloud accounts provisioned (API host, DB, Redis, object storage, FE host)  
- [ ] Secrets filled from `.env.staging.example` (create these in your app folders)  
- [ ] Migrations runnable against staging DB  

## Steps

1. Provision API service; set env vars from staging template.  
2. Run migrations + seed / admin setup.  
3. Deploy frontend; set public API base URL to the staging API.  
4. Smoke: `/health` → login → critical path.  
5. Record URLs and any OPEN blockers in `.agent-settings/blockers.md`.

## Rollback

Redeploy previous image/commit; keep DB migrations forward-only unless a dedicated down plan exists.
