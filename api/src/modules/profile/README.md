# Profile module

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/profile` | Bearer | Get or create own profile |
| PATCH | `/api/v1/profile` | Bearer | Update own profile fields |
| POST | `/api/v1/profile/cv` | Bearer | Upload PDF/DOCX (≤10MB) to MinIO |
| GET | `/api/v1/profile/cv/versions` | Bearer | List own CV versions |

## Ownership (HG-2 / IDOR)

All routes use `auth.userId` from JWT. No `userId` is accepted from path or body.
A user can never read or write another user's profile or CV.

## CV upload

- Allowed: `.pdf`, `.docx`, `.doc`
- Max size: 10 MB
- Stored at `cvs/{userId}/v{n}/{filename}` in MinIO
- Metadata logged only (filename, size, mime) — never file body (HG-8)
- Salary fields remain integer cents (HG-3)

## Dependencies

- `profiles`, `cv_documents` tables
- MinIO via `lib/s3.ts` (`S3_*` env vars)
