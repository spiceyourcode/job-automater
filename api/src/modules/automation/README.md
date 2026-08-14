# Automation module

Emergency stop and submit rate-limit status (P10.3 / FR-AA-07).

## Endpoints

- `GET /api/v1/automation/status` — emergency-stop flag + limit defaults
- `POST /api/v1/automation/emergency-stop` — `{ active: true|false }` drains/pauses submit queue for the caller

## Dependencies

- Redis (`submit-limits.ts`)
- Auth + RBAC (owner/member for stop; viewer can read status)
