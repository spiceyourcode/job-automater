# Emails + notifications module (P5.1)

Owns `emails` and `notifications` tables.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/emails/sync` | Enqueue MonitorEmailJob (HG-10 Redis) |
| GET | `/api/v1/emails` | Classified emails **without** body_text (HG-8) |
| GET | `/api/v1/emails/notifications` | In-app notifications |
| PATCH | `/api/v1/emails/notifications/:id/read` | Mark read |

Auto status updates only when classifier confidence **exceeds** AppFlow §2.5 thresholds.
