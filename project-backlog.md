# JobAutomater — backlog

> **Entry:** [`AGENTS.md`](./AGENTS.md) → [`CLAUDE.md`](./CLAUDE.md)  
> **Stack:** Hono + Drizzle · Next.js 16 · Celery + LangGraph · Postgres + pgvector

**Locked:** no n8n (HG-10), no submit without approve (HG-4), no client secrets (HG-1).

---

## Status

| Milestone | State |
|-----------|--------|
| MVP phases 0–12 + 12.5 AI | Complete |
| Phase 13 post-MVP | Complete (P13.1–P13.9) |
| Phase 14 voice mock interview | Complete (P14.1) |

**Open product tasks:** none on this backlog.

**Ops:** migrate API through `0020_mock_interview_sessions`; restart Celery after worker/lib changes; re-index CVs if `cv_chunks.embedding` empty. Keys: `OPENAI_API_KEY`, `GOOGLE_API_KEY`, Groq/Cerebras as in TRD.

**Blockers:** [`docs/runbooks/blockers.md`](./docs/runbooks/blockers.md)

---

## Open / future

Add new rows here with task ID, service, contract path, and `[ ]`.

| ID | Task | Service | Status | Contract |
|----|------|---------|--------|----------|
| — | (none) | — | — | — |

---

## Completed (reference)

Detail lives in git history and `docs/contracts/phase-*.md`. Summary:

- **0** — agent workspace, docker-compose, queue schema  
- **1** — API/web/workers scaffold, auth, profile, onboarding  
- **2** — sources, collectors, normalize, match score  
- **3** — generate docs, review UI  
- **4** — approve-gated apply, Playwright, kanban  
- **5** — email classify, analytics  
- **6** — hardening, GDPR  
- **7–12** — product shell, collection/apply/comms completeness, launch  
- **12.5** — embeddings / LLM routing  
- **13** — interview prep, salary bench, A/B CV, CRM, WhatsApp, billing, mobile, courses, OCR `parse_cv`  
- **14.1** — voice mock interview (replaces video cover script)