## Contract — Phase 8 Collection Completeness

**Phase:** 8  
**Services:** `api/`, `web/`, `workers/`

### GOAL
PRD G1: 5+ source types. User can add Playwright career-page + Telegram sources, paste a job URL, and run a timezone-aware daily collect via BullMQ (not n8n).

### CONSTRAINTS
- HG-10: BullMQ + Celery only — no n8n
- Phase 2 types (rss, api, imap) remain; add `playwright`, `telegram`, `career_page`
- Collectors implement `BaseCollector`; payloads match `contracts/queue-payloads.schema.json`
- Jobs remain user-scoped (IDOR)

### FORMAT
- `workers/collectors/{playwright,telegram,career_page}.py`
- `POST /api/v1/jobs/import`, `GET /jobs/:id/similar`, save/unsave
- Repeating BullMQ job for daily collection (user timezone)
- Source run history `GET /sources/:id/runs`

### FAILURE
- n8n or visual workflow engine introduced
- Playwright collector stores credentials in logs
- Imported URL job visible to another user
- Daily cron ignores user timezone
