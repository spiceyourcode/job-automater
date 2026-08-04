# Jobs module

Owns `jobs` + `job_scores` (list/detail for dashboard). All queries scoped by `auth.userId` (IDOR-safe).

## Endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/v1/jobs` | required | sort=`score`\|`date`, `minScore`, `q`, `remoteOnly` |
| GET | `/api/v1/jobs/:id` | required | 404 if not owned |

Salary fields are integer cents (HG-3).
