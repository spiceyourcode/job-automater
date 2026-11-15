## Contract — Phase 7 Product Shell

**Phase:** 7  
**Services:** `api/`, `web/`

### GOAL
Auth matches `docs/Backend_Schema.md` §2.2 (reset, verify, OAuth). Profile/CV settings match AppFlow §2.6. Dashboard chrome matches UIUX §5.1–5.2 (sidebar, metrics, top matches, source health).

### CONSTRAINTS
- HG-1 no client secrets; HG-2 all routes auth-gated except login/register/oauth callback/reset
- OAuth tokens stored server-side only
- CV reindex is async (BullMQ → Celery); never log CV body (HG-8)
- shadcn `new-york` / `neutral` (UIUX §1.3)

### FORMAT
- `api/src/modules/auth/` — forgot/reset, verify, oauth, sessions, `/me`
- `api/src/modules/profile/` — activate/delete version, reindex, chunks list
- `web/app/settings/profile`, `web/app/settings/cv`
- Shared app shell (Sidebar + TopBar) on dashboard/jobs/applications/settings

### FAILURE
- Password reset token reusable after success
- OAuth access token in `NEXT_PUBLIC_*` or browser bundle
- User can activate another user's CV version (IDOR)
- Dashboard still a blank empty-state-only page when jobs exist
