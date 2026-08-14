# JobAutomater — Implementation Backlog

> **Updated:** 2026-08-12  
> **Stack:** Hono + Drizzle · Next.js 16 · Celery + LangGraph · PostgreSQL + pgvector  
> **Entry:** [`CLAUDE.md`](./CLAUDE.md) · **Prompts:** [`AGENT-PROMPTS.md`](./AGENT-PROMPTS.md) · **Orchestrator:** [`.agent-settings/phase-orchestrator.md`](./.agent-settings/phase-orchestrator.md)

Phases **0–6** are the shipped MVP slice (contracts `phase-1` … `phase-6`). Phases **7–12** are documented product gaps from `docs/` that were never on this backlog. Phase **13** is PRD §14 post-MVP.

**Do not implement (locked):** n8n (HG-10 → BullMQ + Celery), Turborepo/Nx, submit without `POST /applications/:id/approve` (HG-4), client-side secrets (HG-1).

---

## Phase 0 — Agentic Workspace (complete)

| # | Task | Status |
|---|------|--------|
| 0.1 | Bootstrap CLAUDE.md, CONVENTIONS, agent settings | [x] |
| 0.2 | docker-compose.yml (postgres, redis, minio) | [x] |
| 0.3 | docs/ + contracts/ + queue payload schema | [x] |
| 0.4 | 08-skills/job-agent-skill.md | [x] |
| 0.5 | Phase 1 prompt contract | [x] |

---

## Phase 1 — Foundation (Weeks 1–4)

| # | Task | Service | Status | Contract |
|---|------|---------|--------|----------|
| 1.1 | Hono API scaffold + health | api | [x] | phase-1-foundation |
| 1.2 | Drizzle schema: users, profiles, sessions | api | [x] | phase-1-foundation |
| 1.3 | Auth: register, login, refresh, JWT | api | [x] | phase-1-foundation |
| 1.4 | Next.js shell + auth pages | web | [x] | phase-1-foundation |
| 1.5 | Celery scaffold + health task | workers | [x] | phase-1-foundation |
| 1.6 | Profile CRUD + CV upload → MinIO | api | [x] | — |
| 1.7 | Onboarding wizard (5 steps) | web | [x] | AppFlow §2.1 |
| 1.8 | Dashboard empty state | web | [x] | — |

---

## Phase 2 — Collection + Intelligence (Weeks 5–8)

| # | Task | Service | Status |
|---|------|---------|--------|
| 2.1 | Source CRUD API + UI | api, web | [x] |
| 2.2 | Collector plugins: RSS, API, IMAP | workers | [x] |
| 2.3 | ExtractNormalize agent | workers | [x] |
| 2.4 | Dedup + MatchScore agent | workers | [x] |
| 2.5 | Jobs list + score UI | web | [x] |

---

## Phase 3 — Document Generation (Weeks 9–12)

| # | Task | Service | Status |
|---|------|---------|--------|
| 3.1 | GenerateDocs agent | workers | [x] |
| 3.2 | Document review UI (side-by-side) | web | [x] |
| 3.3 | Application draft status | api | [x] |

---

## Phase 4 — Approval-Gated Apply (Weeks 13–18)

| # | Task | Service | Status |
|---|------|---------|--------|
| 4.1 | Approve endpoint + pending_approval state | api | [x] |
| 4.2 | SubmitVerify agent (Playwright) | workers | [x] |
| 4.3 | ATS API integrations (Greenhouse, Lever) | workers | [x] |
| 4.4 | Kanban pipeline UI | web | [x] |

---

## Phase 5 — Email + Analytics (Weeks 19–22)

| # | Task | Service | Status | Contract |
|---|------|---------|--------|----------|
| 5.1 | Email monitor + classifier | workers | [x] | phase-5-monitoring |
| 5.2 | Analytics dashboard | web, api | [x] | phase-5-monitoring |

---

## Phase 6 — Hardening (Weeks 23–26)

| # | Task | Service | Status | Contract |
|---|------|---------|--------|----------|
| 6.1 | Multi-user RBAC | api, web | [x] | phase-6-launch |
| 6.2 | GDPR export/delete + E2E suite | api, web | [x] | phase-6-launch |

---

## Phase 7 — Product shell (auth, profile, chrome)

**Why:** Schema §2.2–2.3, AppFlow §2.1/§2.6, UIUX §5.1–5.2, Implementation Plan Weeks 2–4. Shipped P1 only had register/login + onboarding, not reset/OAuth/settings chrome.

| # | Task | Service | Status | Source |
|---|------|---------|--------|--------|
| 7.1 | Email verification + forgot/reset password | api, web | [x] | Schema §2.2, Impl Plan W2 |
| 7.2 | OAuth: Google, GitHub, LinkedIn | api, web | [x] | Schema §2.2, AppFlow §2.1 |
| 7.3 | Sessions list/revoke + `GET/PATCH /auth/me` | api | [x] | Schema §2.2, Impl Plan W2 |
| 7.4 | CV activate / delete / diff / reindex / chunks | api, workers | [x] | Schema §2.3, TRD FR-CV-05/06 |
| 7.5 | Settings: profile tabs + CV manager UI | web | [x] | AppFlow §2.6, UIUX settings |
| 7.6 | App shell: Sidebar, TopBar, theme, dashboard widgets | web | [x] | UIUX §5.1–5.2 |

**Contract:** [`docs/contracts/phase-7-product-shell.md`](./docs/contracts/phase-7-product-shell.md)

---

## Phase 8 — Collection completeness

**Why:** PRD G1 (5+ sources), TRD FR-JC-01, AppFlow §2.7, Schema §2.4–2.5. P2 only shipped RSS/API/IMAP.

| # | Task | Service | Status | Source |
|---|------|---------|--------|--------|
| 8.1 | Playwright collector + `career_page` source type | workers, api, web | [x] | AppFlow §2.7, TRD FR-JC-01 |
| 8.2 | Telegram channel collector | workers, api, web | [x] | PRD G1, AppFlow §2.7 |
| 8.3 | Manual URL import, similar jobs, save/unsave | api, web | [x] | PRD §10.1, Schema §2.5 |
| 8.4 | Daily collect cron (BullMQ, user TZ) + company enrichment | api, workers | [x] | AppFlow §2.2, TRD FR-NE-03 |
| 8.5 | Source run history + templates; jobs filters/stats UI | api, web | [x] | Schema §2.4–2.5, UIUX jobs list |

**Contract:** [`docs/contracts/phase-8-collection-complete.md`](./docs/contracts/phase-8-collection-complete.md)

---

## Phase 9 — Document completeness

**Why:** PRD Phase 3 tasks 3.4–3.7, AppFlow §2.3, TRD FR-DG-03/05/06. P3 shipped generate + review, not templates/bulk/inline edit.

| # | Task | Service | Status | Source |
|---|------|---------|--------|--------|
| 9.1 | CV/CL templates (modern, classic, minimal) + selector | workers, web | [x] | PRD §11 P3.4, TRD FR-DG-03 |
| 9.2 | Per-bullet accept/reject + regenerate section | api, web | [x] | AppFlow §2.3, Impl Plan W11 |
| 9.3 | Bulk generate top N + progress (drafts only) | api, workers, web | [x] | PRD G5, TRD FR-DG-06 |
| 9.4 | ATS-friendly PDF + ZIP download | api, web | [x] | PRD §11 P3.5, Schema §2.6 |

**Contract:** [`docs/contracts/phase-9-documents-complete.md`](./docs/contracts/phase-9-documents-complete.md)

---

## Phase 10 — Apply completeness

**Why:** TRD FR-AA-01/02/07, AppFlow §2.4, PRD Phase 4 remaining ATS/portals. P4 shipped Greenhouse/Lever + generic Playwright + Kanban.

| # | Task | Service | Status | Source |
|---|------|---------|--------|--------|
| 10.1 | Workday + Ashby ATS submitters (still HG-4) | workers | [x] | TRD FR-AA-01, PRD §11 P4.2 |
| 10.2 | LinkedIn Easy Apply, Indeed, generic career portals | workers | [x] | TRD FR-AA-02, AppFlow §2.3 |
| 10.3 | Per-site rate limits, daily caps, emergency stop | api, workers | [x] | TRD FR-AA-07, Impl Plan W16/W18 |
| 10.4 | Interviews, follow-ups, notes, bulk archive/withdraw | api, web | [x] | AppFlow §2.4, Schema §2.6 |

**Contract:** [`docs/contracts/phase-10-apply-complete.md`](./docs/contracts/phase-10-apply-complete.md)

---

## Phase 11 — Comms & realtime

**Why:** TRD FR-EM-01, Schema §2.8–2.10, AppFlow §2.5, PRD §10.6 / Phase 5.6–5.7. P5 shipped IMAP classifier + analytics charts, not Gmail OAuth, prefs, digest, WS.

| # | Task | Service | Status | Source |
|---|------|---------|--------|--------|
| 11.1 | Gmail OAuth + watch/history sync (IMAP stays) | api, workers | [ ] | TRD FR-EM-01, Impl Plan W19 |
| 11.2 | Notification center, preferences, Slack/Telegram webhooks | api, web | [ ] | Schema §2.9, UIUX TopBar bell |
| 11.3 | Low-confidence email review queue | api, web | [ ] | AppFlow §2.5, Impl Plan W20 |
| 11.4 | Analytics CSV/PDF export + skill-gap | api, web | [ ] | Schema §2.7, PRD §10.5 |
| 11.5 | WebSocket: pipeline progress, docs ready, notifications | api, web | [ ] | Schema §2.10, AppFlow §2.3 |
| 11.6 | Weekly digest email | workers | [ ] | PRD §11 P5.7, AppFlow §1 |

**Contract:** [`docs/contracts/phase-11-comms.md`](./docs/contracts/phase-11-comms.md)

---

## Phase 12 — Production launch

**Why:** PRD §11 Phase 6 leftover (CI, observability, docs, landing), `docs/runbooks/*`, UIUX §7/§11 polish.

| # | Task | Service | Status | Source |
|---|------|---------|--------|--------|
| 12.1 | GitHub Actions CI (api/web/workers) + API rate limits | ci, api | [ ] | Impl Plan W1/W24, Schema §2.1 |
| 12.2 | Observability (Sentry, structured logs) + OpenAPI | api, workers | [ ] | PRD §11 P6.4/P6.6 |
| 12.3 | Landing page + execute staging/beta/backup runbooks | web, docs | [ ] | PRD §11 P6.7, runbooks/ |
| 12.4 | WCAG AA audit, keyboard shortcuts, dark-mode polish | web | [ ] | UIUX §7, §11 Phase 4 |

**Contract:** [`docs/contracts/phase-12-launch.md`](./docs/contracts/phase-12-launch.md)

---

## Phase 13 — Post-MVP (after launch)

From PRD §14 and Implementation Plan §7. Do not start until Phase 12 exit criteria pass.

| # | Task | Priority | Status | Source |
|---|------|----------|--------|--------|
| 13.1 | Interview preparation agent (Q&A, STAR, negotiation) | High | [ ] | PRD §14, AppFlow §2.4 prep guide |
| 13.2 | Salary benchmarking | High | [ ] | PRD §14 |
| 13.3 | Resume A/B testing | Medium | [ ] | PRD §14 |
| 13.4 | Recruiter CRM / conversation tracking | Medium | [ ] | PRD §14 |
| 13.5 | WhatsApp source (Playwright QR) | Medium | [ ] | AppFlow §2.7, TRD FR-JC-01 |
| 13.6 | Stripe billing + team analytics | Medium | [ ] | Impl Plan W23/W26 |
| 13.7 | Mobile companion app | Medium | [ ] | PRD §14 |
| 13.8 | Skill-gap courses, referral network, video CL | Low | [ ] | PRD §14 |

---

## Doc → backlog map (gaps that were missing)

| Doc | Missing from P0–P6 (now scheduled) |
|-----|-------------------------------------|
| PRD G1 / §11 P2 collectors | Playwright, Telegram, career pages → P8 |
| PRD §10.1–10.3 extra APIs | import, similar, reindex, OAuth, reset → P7–P8 |
| PRD §11 P3 templates/bulk | → P9 |
| PRD §11 P4 Workday/portals/limits | → P10 |
| PRD §11 P5 Gmail/digest/Slack | → P11 |
| PRD §11 P6 CI/obs/landing | → P12 |
| AppFlow §2.4 interviews/follow-ups | → P10.4 |
| AppFlow §2.6 profile/CV settings | → P7.4–7.5 |
| UIUX dashboard chrome | → P7.6 |
| Schema §2.10 WebSocket | → P11.5 |
| Runbooks beta/staging | → P12.3 |

All task prompts: [`AGENT-PROMPTS.md`](./AGENT-PROMPTS.md)
