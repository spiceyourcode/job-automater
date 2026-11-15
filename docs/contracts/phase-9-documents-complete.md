## Contract — Phase 9 Document Completeness

**Phase:** 9  
**Services:** `api/`, `web/`, `workers/`

### GOAL
AppFlow §2.3 + PRD Phase 3 remaining: templates, per-bullet accept/reject, bulk generate top N, ATS-friendly PDF download.

### CONSTRAINTS
- HG-9: every generated bullet still traces to `cv_chunks`
- HG-4: bulk generate creates **drafts only** — never submits
- HG-8: no CV/CL body in logs
- Templates: modern, classic, minimal (UIUX / Implementation Plan Week 9)

### FORMAT
- Template files + selector on review screen
- Per-bullet accept/reject persisted on application
- `POST` bulk-generate for top N matches → queue
- ZIP/PDF download of CV + CL

### FAILURE
- Hallucinated bullets without chunk traces
- Bulk generate enqueues submit
- Apply enabled before review (existing P3.2 gate broken)
