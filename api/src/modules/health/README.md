# Health module

Exposes `GET /health` for liveness plus Postgres connectivity.

## Response

| Field | Meaning |
|-------|---------|
| `status` | `ok` if DB reachable, else `degraded` |
| `db` | `up` \| `down` |
| `timestamp` | ISO-8601 UTC |

Returns **200** when DB is up, **503** when down.

## Dependencies

- `src/db` — `checkDatabaseConnection()`
