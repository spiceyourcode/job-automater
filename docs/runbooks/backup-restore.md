# Runbook — Backup & Restore

## Purpose

Protect production/staging data and recover from loss.

## Backup

| Item | Status (P12.3) |
|------|----------------|
| Automated DB snapshots / logical dumps | **BLOCKED** — schedule when staging/prod DB exists (`pg_dump` or host snapshots) |
| Object-storage versioning or periodic sync | **BLOCKED** — enable on MinIO/S3 bucket policy in target env |
| Retention policy documented | **DONE (policy draft)** — retain daily dumps ≥ 14 days; weekly ≥ 8 weeks; test restore quarterly |

### Suggested dump command (when DB is available)

```bash
pg_dump "$DATABASE_URL" --format=custom --file="jobautomater-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Never log connection strings or dump contents (HG-8).

## Restore drill

1. Pick a backup point.  
2. Restore to an isolated environment.  
3. Verify app boot + sample queries (`/health`, login).  
4. Record time-to-restore.

## P12.3 drill result

| Step | Result |
|------|--------|
| Procedure documented | **DONE** |
| Live restore against isolated env | **BLOCKED** — no backup host / snapshot yet; do not skip silently — unblock after first staging DB |

## Notes

Never restore production backups over production without an incident lead and change window.
