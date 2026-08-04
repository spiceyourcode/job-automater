# JobAutomater — Implementation Backlog

> **Updated:** 2026-08-04  
> **Stack:** Hono + Drizzle · Next.js 16 · Celery + LangGraph · PostgreSQL + pgvector  
> **Entry:** [`CLAUDE.md`](./CLAUDE.md) · **Prompts:** [`AGENT-PROMPTS.md`](./AGENT-PROMPTS.md) · **Orchestrator:** [`.agent-settings/phase-orchestrator.md`](./.agent-settings/phase-orchestrator.md)

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
| 4.2 | SubmitVerify agent (Playwright) | workers | [ ] |
| 4.3 | ATS API integrations (Greenhouse, Lever) | workers | [ ] |
| 4.4 | Kanban pipeline UI | web | [ ] |

---

## Phase 5 — Email + Analytics (Weeks 19–22)

| # | Task | Service | Status | Contract |
|---|------|---------|--------|----------|
| 5.1 | Email monitor + classifier | workers | [ ] | phase-5-monitoring |
| 5.2 | Analytics dashboard | web, api | [ ] | phase-5-monitoring |

---

## Phase 6 — Hardening (Weeks 23–26)

| # | Task | Service | Status | Contract |
|---|------|---------|--------|----------|
| 6.1 | Multi-user RBAC | api, web | [ ] | phase-6-launch |
| 6.2 | GDPR export/delete + E2E suite | api, web | [ ] | phase-6-launch |

All task prompts: [`AGENT-PROMPTS.md`](./AGENT-PROMPTS.md)
