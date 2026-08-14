# Open blockers (P12.3)

Logged so beta exit criteria are not left unchecked without a note.

| ID | Severity | Area | Blocker | Unblock when |
|----|----------|------|---------|--------------|
| B-12.3-1 | P2 | Staging | No cloud staging host / DB / Redis | Provision staging; run `staging-deploy.md` smoke |
| B-12.3-2 | P2 | Backup | No automated snapshot target | Enable dumps/snapshots; run restore drill |
| B-12.3-3 | P3 | Ops | Support / on-call not assigned | Name owner + channel in `beta-launch.md` |

See also: `docs/runbooks/beta-launch.md` exit criteria table.
