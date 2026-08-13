# Sources module

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/sources` | Bearer | List own sources |
| POST | `/api/v1/sources` | Bearer | Create (rss \| api \| imap \| playwright \| career_page \| telegram) |
| GET | `/api/v1/sources/:id` | Bearer | Get own source |
| PATCH | `/api/v1/sources/:id` | Bearer | Update own source |
| DELETE | `/api/v1/sources/:id` | Bearer | Delete own source |
| POST | `/api/v1/sources/:id/test` | Bearer | Connectivity / config dry-run |
| POST | `/api/v1/sources/:id/run` | Bearer | Enqueue CollectSourceJob |

## Ownership

All queries filter by `auth.userId`. Cross-user IDs return 404 (no IDOR leak).

## Secrets (HG-8)

IMAP `password` and API `auth.credentials` are redacted (`***`) in responses.
Never logged.

## Run

Pushes `{source_id, user_id, source_type}` to Redis list `jobautomater:collect_source`
(workers consume in P2.2). Sets `last_run_status = queued`.
