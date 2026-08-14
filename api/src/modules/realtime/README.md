# Realtime (P11.5)

JWT-auth WebSocket. Events are published only on `jobautomater:ws:{userId}`.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/realtime/ticket` | 30s one-time ticket (auth) |
| WS | `/api/v1/ws?ticket=` or `?token=` | Subscribe to own channels only |

Events: `pipeline_progress`, `documents_ready`, `notification`.
