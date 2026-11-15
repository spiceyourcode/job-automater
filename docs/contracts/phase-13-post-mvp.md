## Contract — Phase 13 Post-MVP

**Phase:** 13  
**Status:** complete  
**Services:** `api/`, `web/`, `workers/`, `mobile/`  
**After:** Phase 12.5 AI infrastructure ✅  

### GOAL
Ship PRD §14 post-MVP: interview prep, salary benchmarks, CV A/B, recruiter CRM, WhatsApp source, Stripe billing, mobile companion, skill-gap courses / referrals / video CL scripts.

### CONSTRAINTS
- HG-1: no Stripe/LLM/WhatsApp secrets in `NEXT_PUBLIC_*` or client bundles.
- HG-2: all product routes authenticated except Stripe webhook (signature-verified).
- HG-3: salary always integer cents + currency.
- HG-4: mobile/web approve still requires `POST /applications/:id/approve`.
- HG-8: never log CV, STAR stories, chat bodies, or payment payloads.
- HG-9: interview STAR / video CL scripts grounded in `cv_chunks` (fallback heuristic).
- HG-10: BullMQ + Celery only.
- WhatsApp: no LinkedIn API; session/QR is user-initiated Playwright.

### FAILURE
- Hallucinated employers in STAR stories
- Float salaries
- Submit without approve from mobile
- WhatsApp/Stripe secrets in logs or client
- Cross-user (IDOR) prep, CRM, billing, or A/B stats
