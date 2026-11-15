## Contract — Phase 5 Email + Analytics

### GOAL
Application status syncs from email; user sees pipeline analytics and notifications.

### CONSTRAINTS
- Email classifier in workers; Gmail/IMAP integration
- Confidence thresholds before auto-status update (see AppFlow §2.5)
- No email body in application logs (HG-8)

### FORMAT
- workers/agents/email_classifier/ (or part of submit_verify module)
- api/src/modules/analytics/
- web/app/analytics/

### FAILURE
- Low-confidence classification auto-updates status
- PII from emails in logs or error reports
- n8n used for email webhooks
