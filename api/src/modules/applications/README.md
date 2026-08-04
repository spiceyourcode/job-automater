# Applications module

Owns `applications` table. Draft generation, review, and approval-gated submit (P3–P4).

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/applications` | Create draft + enqueue GenerateDocs |
| GET | `/api/v1/applications/:id` | Owned only |
| POST | `/api/v1/applications/:id/regenerate` | Clear docs + re-enqueue |
| POST | `/api/v1/applications/:id/review` | Sets `documentsReviewedAt`; uploads MinIO |
| POST | `/api/v1/applications/:id/approve` | HG-4: draft→pending_approval→approved; enqueue submit with `approved_at` |
| PATCH | `/api/v1/applications/:id/stage` | Kanban stage move (AppFlow §2.4) |
| GET | `/api/v1/applications/:id/download/cv\|cl` | Presigned URL |

`canApprove` / `canApply` are true only after review while status is `draft`. Submit is never enqueued without `approved_at`.
