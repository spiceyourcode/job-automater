# Phase 8.6 — Curated job source catalog

## Goal

Non-technical users pick named job boards during onboarding and in Settings. Preset collector config (RSS URLs, API mappings, selectors) lives in repo; users never edit CSS selectors for catalog entries.

## Data

- **Canonical file:** `api/src/modules/sources/job-source-catalog.json`
- **Entry fields:** `id`, `name`, `description`, `region`, `tags`, `sourceType`, `status` (`stable`|`beta`), `config`, optional `userFields` (install deferred until user supplies values in Advanced flow)

Installed workspace sources store `config.catalogId` matching the catalog `id` for idempotent install and "Managed preset" UI.

## API

| Method | Path | Role | Response |
|--------|------|------|----------|
| GET | `/api/v1/sources/catalog` | owner, member | `{ version, entries[] }` (no secrets) |
| POST | `/api/v1/sources/install-catalog` | owner | `{ created, skipped, needsInput }` |

Duplicate `catalogId` per workspace is skipped. Entries with unresolved `userFields` appear in `needsInput` without creating a row.

## Web

- Onboarding step 5: `SourceCatalogPicker` (hides `userFields` entries); finish calls install-catalog then onboarding cookie.
- Settings → Sources: default **Browse catalog** tab; **Advanced** tab retains manual CRUD.

## Maintenance

1. Add entry to JSON with valid `config` for `sourceType` (run `npm test -- sources.catalog.test.ts` in `api/`).
2. Run `py -m pytest workers/tests/test_job_source_catalog.py`.
3. Manually `POST /sources/{id}/test` after deploy for new scrape/API entries.
4. Mark fragile feeds `beta`.

## Hard gates

HG-1 (no client secrets), HG-2 (auth on catalog routes), HG-8 (no PII in logs).
