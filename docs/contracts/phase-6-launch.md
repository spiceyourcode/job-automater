## Contract — Phase 6 Launch Hardening

### GOAL
Multi-user RBAC, GDPR export/delete, E2E test suite green, production-ready self-hosted deploy.

### CONSTRAINTS
- Roles: owner, member, viewer (AppFlow §7)
- GDPR export/delete endpoints
- E2E: register → onboard → source → match → generate → approve → submit
- Docker Compose production runbook in docs/runbooks/

### FORMAT
- E2E tests in web/e2e/ or api/e2e/
- docs/runbooks/staging-deploy.md updated for VPS

### FAILURE
- Member can access another member's applications
- Delete user leaves CV chunks in pgvector
- E2E flaky or missing approve gate step
