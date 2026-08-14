# Runbook — Closed Beta / Launch

## Exit criteria

| Criterion | Status (P12.3) | Notes |
|-----------|----------------|-------|
| Staging E2E critical paths green | **BLOCKED** | No dedicated staging host provisioned in this repo yet. Local path: `cd api && npm test` (includes `e2e/happy-path.test.ts`). |
| No OPEN P0 blockers | **DONE (repo)** | No P0 tracked in `.agent-settings/blockers.md` as of P12.3. Re-check before real beta. |
| Hard gates enforced; validators in CI | **DONE** | HG-1–HG-10 in protocol; `.github/workflows/ci.yml` runs api/web/workers checks (P12.1). |
| Support / on-call contact known | **BLOCKED** | Org-specific — fill owner + channel before invite. |
| Feature flags for risky surfaces | **DONE** | `GET /health/flags` + `FEATURE_AUTO_APPLY` (default off, HG-4). |

## Launch checklist

1. Freeze scope; tag release.  
2. Deploy API then client (or coordinated).  
3. Verify health, auth, payments (if any), high-risk feature.  
4. Monitor errors / latency for first N hours (`SENTRY_DSN` optional).  
5. Communicate to beta users.

## Feature flags (risky surfaces)

| Flag | Env / source | Default | Risk |
|------|----------------|---------|------|
| `autoApplyWithoutApproval` | `FEATURE_AUTO_APPLY` | `false` | Would bypass human approve — keep off (HG-4). |
| `gmailOauth` | Google OAuth client configured | off if unset | Token storage — server only. |
| `notificationWebhooks` | always true when prefs set | on | Outbound webhooks — never log URLs. |
| `sentry` | `SENTRY_DSN` | off if unset | Ensure PII scrub stays on. |

Probe: `GET /health/flags` → JSON booleans only (no secrets).

## Incident basics

Severity definitions, rollback owner, and comms channel — fill for your org.

## P12.3 execution note

Marketing `/` landing ships without client-side API keys (HG-1). Staging deploy and restore drills remain blocked until cloud accounts exist — see `staging-deploy.md`, `backup-restore.md`, and [`blockers.md`](./blockers.md).
