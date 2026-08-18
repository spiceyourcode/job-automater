# Analytics module (P5.2)

Read-only aggregates for the authenticated user (funnel, matches, sources).

Cross-table SELECT is an explicit analytics exception to HG-6 — no writes to foreign tables.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/analytics/dashboard` | Summary KPIs + optional `from`/`to` |
| GET | `/api/v1/analytics/pipeline` | Funnel stage counts |
| GET | `/api/v1/analytics/matches` | Match quality time series |
| GET | `/api/v1/analytics/sources` | Source ROI (jobs collected) |
| GET | `/api/v1/analytics/skills` | Skill-gap vs in-demand keywords + catalog course links |
| GET | `/api/v1/analytics/export` | CSV/PDF download (`format`, `reportType`) — owner rows only |
