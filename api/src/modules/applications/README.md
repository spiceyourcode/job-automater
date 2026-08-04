# Applications module

Owns `applications` table. Draft generation + document review (Phase 3).

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/v1/applications` | Create draft + enqueue GenerateDocs |
| GET | `/api/v1/applications/:id` | Owned only |
| POST | `/api/v1/applications/:id/regenerate` | Clear docs + re-enqueue |
| POST | `/api/v1/applications/:id/review` | Sets `documentsReviewedAt`; uploads MinIO |
| GET | `/api/v1/applications/:id/download/cv\|cl` | Presigned URL |

`canApply` is true only after review. Submit still requires P4 approve (HG-4).
