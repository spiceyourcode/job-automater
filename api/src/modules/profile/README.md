# Profile module

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/profile` | Bearer | Get or create own profile |
| PATCH | `/api/v1/profile` | Bearer | Update own profile fields |
| POST | `/api/v1/profile/cv` | Bearer | Upload PDF/DOCX (≤10MB) to MinIO |
| GET | `/api/v1/profile/cv/versions` | Bearer | List own CV versions |
| GET | `/api/v1/profile/export` | Bearer | GDPR JSON export of own PII |
| DELETE | `/api/v1/profile` | Bearer | GDPR erase — deletes `cv_chunks` then cascades user |

## Ownership (HG-2 / IDOR)

All routes use `auth.userId` from JWT. No `userId` is accepted from path or body.
A user can never read or write another user's profile or CV.

## CV upload

- Allowed: `.pdf`, `.docx` (legacy `.doc` rejected at parse time)
- Max size: 10 MB
- Text extracted on upload (`pdf-parse` / `mammoth`) into `parsed_text`, then Celery `reindex_cv` builds `cv_chunks`
- Reindex backfills `parsed_text` from MinIO when missing (older uploads)
- Stored at `cvs/{userId}/{uuid}/{filename}` in MinIO (UUID key avoids overwrite races)
- Version allocated under Postgres advisory lock per user
- DB stores object key; API responses return time-limited presigned GET URLs
- Metadata logged only (filename, size, mime) — never file body or parsed text (HG-8)
- Salary fields remain integer cents (HG-3); partial PATCH merges against stored min/max

## GDPR (P6.2)

- `GET /export` returns structured JSON (user, profile, CV metadata, applications, notifications) — never passwords or session secrets
- `DELETE /` explicitly deletes `cv_chunks` (pgvector) then hard-deletes the user so FKs cascade remaining owned rows
- Soft-delete alone is insufficient (contract FAILURE if chunks remain)

## Dependencies

- `profiles`, `cv_documents` tables
- MinIO via `lib/s3.ts` (`S3_*` env vars)
