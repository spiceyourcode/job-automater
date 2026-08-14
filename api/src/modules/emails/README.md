# Emails + notifications module (P5.1 + P11.1)

Owns `emails`, `notifications`, and `gmail_connections` tables.

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/emails/sync` | Enqueue MonitorEmailJob (HG-10 Redis) |
| GET | `/api/v1/emails` | Classified emails **without** body_text (HG-8) |
| GET | `/api/v1/auth/gmail` | Start mailbox OAuth (refresh token never returned) |
| GET | `/api/v1/auth/gmail/callback` | Store tokens server-side, optional watch |
| GET | `/api/v1/emails/gmail` | Connection status (no tokens) |
| POST | `/api/v1/emails/gmail/sync` | History / 90-day backfill → classifier |
| POST | `/api/v1/emails/gmail/watch` | Renew `users.watch` |
| POST | `/api/v1/emails/gmail/push` | Pub/Sub push (optional `?token=`) |
| DELETE | `/api/v1/emails/gmail` | Disconnect |
| GET | `/api/v1/emails/notifications` | In-app notifications |
| PATCH | `/api/v1/emails/notifications/:id/read` | Mark read |

IMAP collectors remain as fallback. Auto status updates only when classifier confidence **exceeds** AppFlow §2.5 thresholds.
