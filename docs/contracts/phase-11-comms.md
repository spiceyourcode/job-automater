## Contract — Phase 11 Comms & Realtime

**Phase:** 11  
**Services:** `api/`, `web/`, `workers/`

### GOAL
Gmail OAuth watch (TRD FR-EM-01), notification center + preferences (Schema §2.9, UIUX), email review queue (AppFlow §2.5), analytics export, WebSocket progress (Schema §2.10).

### CONSTRAINTS
- HG-8: no email body / PII in logs
- Low-confidence classifications stay in review queue (existing P5.1 gate)
- IMAP remains as fallback (do not remove)
- WebSocket auth via existing JWT; no anonymous channels

### FORMAT
- `/auth/gmail` OAuth + watch/history sync
- `GET/PATCH /notifications/preferences`; in-app bell UI
- `/emails/review` low-confidence queue
- `GET /analytics/export` CSV
- WS events: pipeline_progress, documents_ready, notification

### FAILURE
- Gmail refresh token in client bundle
- Low-confidence auto-updates status
- WS leaks another user's events
