# Runbook — Backup & Restore

## Purpose

Protect production/staging data and recover from loss.

## Backup

- [ ] Automated DB snapshots / logical dumps on a schedule  
- [ ] Object-storage versioning or periodic sync  
- [ ] Retention policy documented  

## Restore drill

1. Pick a backup point.  
2. Restore to an isolated environment.  
3. Verify app boot + sample queries.  
4. Record time-to-restore.

## Notes

Never restore production backups over production without an incident lead and change window.
