# Team / workspace RBAC (P6.1)

Roles per AppFlow §7: `owner` | `member` | `viewer`.

| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/v1/team` | any member |
| GET | `/api/v1/team/members` | any member |
| POST | `/api/v1/team/members` | owner |
| PATCH | `/api/v1/team/members/:userId` | owner |
| DELETE | `/api/v1/team/members/:userId` | owner |

JWT carries `role` + `workspaceId`. Sources are workspace-scoped; applications stay user-owned (IDOR-safe).
