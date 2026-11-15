## Contract — Phase 2 Collection + Intelligence

### GOAL
User adds 2+ job sources, runs collection, sees deduplicated scored jobs in dashboard ranked by match score.

### CONSTRAINTS
- Source types Phase 2: rss, api, imap
- BullMQ dispatches → Celery workers; no n8n
- Collectors implement BaseCollector in workers/collectors/
- Payloads match contracts/queue-payloads.schema.json

### FORMAT
- api/src/modules/sources/ — CRUD + test + run
- web/app/settings/sources/ — list, add, run now
- workers/collectors/{rss,api,imap}.py
- workers/agents/extract_normalize/, match_score/

### FAILURE
- User cannot add a new source from UI
- Collector failure not reflected in source_configs.last_run_status
- Jobs visible across users (IDOR)
- Match score without reasoning text
- n8n or visual workflow engine introduced
