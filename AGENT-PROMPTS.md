# JobAutomater — Agent Prompt Playbook

> **Single prompt reference** from project start to launch.  
> Agents: read `CLAUDE.md` first, then copy the prompt for your current task from this file.

---

## How to use this file

1. Read **`CLAUDE.md`** (protocol + hard gates)
2. Open **`.agent-settings/phase-orchestrator.md`** — note your task ID (e.g. P1.3)
3. Copy the matching **prompt block** below into your agent session
4. Read the linked **contract** in `docs/contracts/`
5. Read matching **`08-skills/`** file if triggered
6. Before coding: append to **`.agent-settings/active-plan.md`**
7. After coding: run **verification prompt** for that task, update orchestrator

---

## Universal startup prompt (every task)

```
You are building JobAutomater — an AI job application platform.

READ FIRST (in order):
1. CLAUDE.md — hard gates HG-1 to HG-10
2. CONVENTIONS.md — where code goes
3. .agent-settings/phase-orchestrator.md — my task ID
4. docs/contracts/<phase>.md — success criteria
5. 08-skills/* if domain trigger matches (see Skills System below)
6. AGENT-PROMPTS.md — AUTO SKILLS block for this task ID

STACK (locked):
- api/ = Hono + Drizzle + BullMQ (TypeScript)
- web/ = Next.js 15 (TypeScript)
- workers/ = Celery + LangGraph + Playwright (Python)
- NO n8n, NO Turborepo, NO auto-submit without user approval

MY TASK: [paste task ID and description from phase-orchestrator.md]

SKILL AUTO-INVOKE (do not wait for user to attach):
- BEFORE coding: run prompt-contracts on this task's GOAL/CONSTRAINTS/FORMAT/FAILURE
- IF scope ambiguous: run reverse-prompting (5 questions) before planning
- DURING coding: invoke local 08-skills/* listed in AUTO SKILLS for this task
- AFTER coding: run subagent-verification-loops if task is marked VERIFY in Skills Matrix
- IF user corrects you: append rule via self-modifying-rules

Before writing code:
- Append a workstream entry to .agent-settings/active-plan.md
- State which hard gates apply to this task
- List which global + local skills you invoked

When done:
- Run the verification prompt (below) + subagent-verification-loops if VERIFY task
- Mark task complete in phase-orchestrator.md
- Log results in active-plan.md
```

---

## Skills system

Agents **auto-invoke** skills below — attach in Cursor with `@skill-name` or read the source file. Do not skip VERIFY skills on auth, PII, submit, or LLM-output tasks.

### Global skills (installed — `~/.cursor/skills/`)

| Skill | Cursor `@` name | Source in demo folder | When to auto-invoke |
|-------|-----------------|----------------------|---------------------|
| Prompt contracts | `prompt-contracts` | `../Prompt Contracts.md` | **Every task** — before coding |
| Reverse prompting | `reverse-prompting` | `../Reverse Prompting.md` | Scope unclear, new UX flow, phase kickoff |
| Subagent verification | `subagent-verification-loops` | `../Subagent Verification Loops.md` | **After** auth, PII, submit, LLM-gen tasks |
| Agent chatrooms | `agent-chatrooms` | `../Agent Chatrooms.md` | Architecture trade-offs (2+ valid approaches) |
| Stochastic consensus | `stochastic-multi-agent-consensus` | `../Stochastic Multi-Agent Consensus.md` | Need independent vote (stack, library pick) |
| Multi-agent MCP | `multi-agent-mcp-orchestration` | `../Multi-Agent MCP Orchestration.md` | Parallel api + web + workers same task |
| Multi-agent Chrome | `multi-agent-chrome` | `../multi-agent-chrome-skill/` | Playwright portal testing, parallel apply |
| Self-modifying rules | `self-modifying-rules` | `../GEMINI (Self Modifying).md` | User corrects agent; save preference |
| Model chat | `model-chat` | `../model-chat-skill/` | Scripted debate + saved synthesis file |
| Video to action | `video-to-action` | `../Video-to-Action via Gemini Passthrough.md` | Following a YouTube/tutorial for setup |

### Stack-relevant global skills (also in `~/.cursor/skills/`)

| Skill | When to auto-invoke |
|-------|---------------------|
| `software-architecture` | New module layout, service boundaries, Phase 1 scaffold |
| `zod-validation-expert` | API request/response schemas (P1.2+, all api modules) |
| `api-security-best-practices` | Auth, JWT, upload endpoints (P1.3, P1.6, P6.1) |
| `async-python-patterns` | Celery tasks, LangGraph agents (P1.5+, workers) |
| `webapp-testing` | E2E, onboarding, kanban (P1.7, P4.3, P6.2) |
| `web-security-testing` | Pre-launch security pass (P6.2) |
| `accessibility-compliance-accessibility-audit` | Auth pages, onboarding, dashboard UI |
| `review-security` | RBAC + GDPR hardening (P6.1, P6.2) |

### Local skills (`08-skills/` — project-specific)

| File | Auto-invoke when |
|------|------------------|
| `backend-module-skill.md` | Any `api/src/modules/*` work |
| `auth-rbac-skill.md` | Auth, JWT, roles, ownership checks |
| `safety-moderation-skill.md` | CV, email, PII, GDPR, logs (HG-8, HG-9) |
| `job-agent-skill.md` | Celery, collectors, LangGraph, Playwright apply |

### Phase skill matrix

| Phase | BEFORE (plan) | BUILD | AFTER (verify) |
|-------|---------------|-------|----------------|
| **1 Foundation** | prompt-contracts | backend-module, zod-validation, auth-rbac, job-agent | subagent-verification on P1.3, P1.6 |
| **2 Collection** | prompt-contracts, reverse-prompting on P2.1 | job-agent, multi-agent-mcp on P2.2 | subagent-verification on P2.3, P2.4 |
| **3 Documents** | prompt-contracts | safety-moderation, job-agent | subagent-verification on P3.1 (**HG-9**) |
| **4 Apply** | prompt-contracts | job-agent, multi-agent-chrome on P4.2 | subagent-verification on P4.1, P4.2 (**HG-4**) |
| **5 Monitoring** | prompt-contracts | safety-moderation | subagent-verification on P5.1 (**HG-8**) |
| **6 Launch** | agent-chatrooms if RBAC design open | auth-rbac, webapp-testing | review-security + subagent-verification on P6.1, P6.2 |
| **7 Product shell** | reverse-prompting on OAuth UX | auth-rbac, accessibility | subagent-verification on P7.1, P7.2 |
| **8 Collection+** | reverse-prompting on source types | job-agent, multi-agent-mcp | subagent-verification on P8.1 |
| **9 Documents+** | prompt-contracts | safety-moderation, job-agent | subagent-verification on P9.2, P9.3 (**HG-9**) |
| **10 Apply+** | prompt-contracts | job-agent, multi-agent-chrome | subagent-verification on P10.1, P10.2 (**HG-4**) |
| **11 Comms** | prompt-contracts | safety-moderation | subagent-verification on P11.1 (**HG-8**) |
| **12 Launch** | prompt-contracts | review-security, web-security-testing | subagent-verification on P12.1 |

### Decision tree (auto-pick skills)

```
Starting any task?
└─ prompt-contracts (always)

Scope unclear or new UX?
└─ reverse-prompting

Building api module?
└─ backend-module-skill + zod-validation-expert

Auth / JWT / RBAC?
└─ auth-rbac-skill + api-security-best-practices
└─ AFTER: subagent-verification-loops (required)

CV / email / PII / LLM docs?
└─ safety-moderation-skill
└─ AFTER: subagent-verification-loops (required)

Celery / LangGraph / collectors?
└─ job-agent-skill + async-python-patterns

api + web + workers in parallel?
└─ multi-agent-mcp-orchestration

Playwright apply / portal testing?
└─ multi-agent-chrome + job-agent-skill
└─ AFTER: subagent-verification-loops (required)

Architecture fork (2+ valid designs)?
└─ agent-chatrooms OR stochastic-multi-agent-consensus

User corrected you?
└─ self-modifying-rules

Task marked VERIFY in prompt below?
└─ subagent-verification-loops (required before marking done)
```

---

## Phase 0 — Workspace (complete)

No action needed. Infra only:

```bash
cp .env.example .env
docker compose up -d
```

---

## Phase 1 — Foundation (Weeks 1–4)

**Contract:** `docs/contracts/phase-1-foundation.md`

### P1.1 — API scaffold

```
Task P1.1: Scaffold api/ with Hono + Drizzle + GET /health.

GOAL: Running API on port 3001 with health check and DB connection.
CONSTRAINTS: Hono, Drizzle, TypeScript strict, no auth yet.
FORMAT: api/package.json, src/index.ts, src/modules/health/, src/db/
FAILURE: No health route, secrets in code, missing docker-compose postgres connection.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/backend-module-skill.md, @software-architecture
- AFTER: @subagent-verification-loops

Read: docs/Backend_Schema.md (users table for next task), CONVENTIONS.md.
Verify: curl http://localhost:3001/health returns 200
```

### P1.2 — Database schema (core tables)

```
Task P1.2: Drizzle schema for users, profiles, sessions per docs/Backend_Schema.md.

GOAL: Migrations run against docker postgres; tables match schema doc.
CONSTRAINTS: snake_case columns, UUID PKs, timestamps on all tables.
FAILURE: Missing indexes from schema doc, float for salary fields (use integer cents).

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/backend-module-skill.md, @zod-validation-expert
- AFTER: @subagent-verification-loops

Verify: npm run db:migrate succeeds; tables exist in psql
```

### P1.3 — Auth module

```
Task P1.3: JWT auth — register, login, refresh, logout, requireAuth middleware.

GOAL: User can register, login, get access+refresh tokens, call protected route.
CONSTRAINTS: bcrypt passwords, JWT from env, ownership on all user resources.
FAILURE: Unprotected routes, refresh token not rotatable, password in logs.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/auth-rbac-skill.md, @api-security-best-practices, @zod-validation-expert
- AFTER: @subagent-verification-loops (REQUIRED — auth)

Verify: integration tests for 401/403/200 paths
```

### P1.4 — Web scaffold

```
Task P1.4: Scaffold web/ Next.js 15 with login, register, dashboard empty state.

GOAL: User sees auth pages and empty dashboard after login.
CONSTRAINTS:
- NEXT_PUBLIC_API_URL from env, no secrets client-side (HG-1).
- UI: classic shadcn/ui — style new-york, baseColor neutral (B&W). See docs/UIUX_Design.md §1.3 + §2.
- Init via `npx shadcn@latest init`; add primitives via CLI or shadcn MCP (`.cursor/mcp.json`).
- Lucide icons only; Form = RHF + Zod; Toaster once in root layout.
FAILURE: Dashboard accessible without auth, API keys in browser bundle, custom colorful theme instead of neutral.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: @accessibility-compliance-accessibility-audit (auth forms); use shadcn MCP for components
- AFTER: @subagent-verification-loops

Verify: npm run dev, login flow works against api/; components.json has style new-york + baseColor neutral
```

### P1.5 — Workers scaffold

```
Task P1.5: Scaffold workers/ Celery app + health.ping task.

GOAL: celery worker starts, processes health.ping, returns pong.
CONSTRAINTS: Python 3.12, Redis broker from .env, pyproject.toml with dev deps.
FAILURE: Worker can't connect to Redis, no pytest for health task.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, @async-python-patterns
- AFTER: @subagent-verification-loops

Verify: celery -A celery_app worker starts; pytest passes
```

### P1.6 — Profile + CV upload

```
Task P1.6: Profile CRUD + CV multipart upload to MinIO.

GOAL: User uploads PDF/DOCX CV, file stored in MinIO, profile updated.
CONSTRAINTS: Max 10MB, auth required, user owns own profile only.
FAILURE: IDOR on profile routes, CV content logged (HG-8).

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/auth-rbac-skill.md, 08-skills/safety-moderation-skill.md, @api-security-best-practices
- AFTER: @subagent-verification-loops (REQUIRED — PII/CV)

Verify: upload returns file URL; only owner can read
```

### P1.7 — Onboarding wizard

```
Task P1.7: 5-step onboarding per docs/AppFlow.md §2.1.

GOAL: New user completes welcome → identity → skills → preferences → CV → source quick-start.
CONSTRAINTS: Match AppFlow validation rules (min 5 skills, salary min < max).
FAILURE: Can skip required steps without validation, no redirect to dashboard on complete.

AUTO SKILLS:
- BEFORE: @reverse-prompting (if UX steps unclear), @prompt-contracts
- BUILD: @accessibility-compliance-accessibility-audit
- AFTER: @webapp-testing, @subagent-verification-loops

Verify: full onboarding flow E2E
```

### P1.8 — Dashboard empty state

```
Task P1.8: Dashboard empty state when user has no jobs yet.

GOAL: Post-login dashboard shows helpful empty state with CTA to add sources.
CONSTRAINTS: Auth-gated; matches docs/UIUX_Design.md empty states.
FAILURE: Blank page, broken layout, no CTA.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: @accessibility-compliance-accessibility-audit
- AFTER: @subagent-verification-loops

Verify: new user sees empty state after login
```

---

## Phase 2 — Collection + Intelligence (Weeks 5–8)

**Contract:** `docs/contracts/phase-2-collection.md`

### P2.1 — Source management

```
Task P2.1: Source CRUD API + Settings UI — user can add/edit/test/run sources.

GOAL: POST /api/v1/sources creates source_configs row; UI lists sources with Run Now.
CONSTRAINTS: User owns sources; types: rss, api, imap (phase 2 scope).
FAILURE: Cross-user source access, no test endpoint.

AUTO SKILLS:
- BEFORE: @reverse-prompting (source types/UX), @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, 08-skills/backend-module-skill.md, @multi-agent-mcp-orchestration (api+web parallel)
- AFTER: @subagent-verification-loops

Read: docs/AppFlow.md §2.7, docs/PRD.md §10.4
```

### P2.2 — Collectors

```
Task P2.2: Collector plugins — RSS, REST API, IMAP in workers/collectors/.

GOAL: Celery task collect_source fetches jobs from configured source into jobs table.
CONSTRAINTS: BaseCollector ABC, register in registry.py, payload matches contracts/queue-payloads.schema.json
FAILURE: Collector crashes silently, no last_run_status update on source_configs.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, @async-python-patterns, @multi-agent-mcp-orchestration (parallel collectors)
- AFTER: @subagent-verification-loops

Verify: golden-set fixture for RSS parse output
```

### P2.3 — ExtractNormalize agent

```
Task P2.3: LangGraph graph extract_normalize — raw HTML/JSON → structured job JSON.

GOAL: >95% schema-valid extractions on test fixture set.
CONSTRAINTS: Pydantic output schema, confidence score per field.
FAILURE: Unvalidated LLM output saved to DB (HG-9 pattern for structured data).

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, 08-skills/safety-moderation-skill.md
- AFTER: @subagent-verification-loops (REQUIRED — LLM output validation)

Verify: pytest with 10 sample job postings
```

### P2.4 — MatchScore agent

```
Task P2.4: pgvector CV search + multi-factor job scoring.

GOAL: job_scores row with overall_score 0-100 + LLM reasoning text.
CONSTRAINTS: Skills 40%, Experience 25%, Location 15%, Salary 10%, Culture 10% per TRD.
FAILURE: Score without reasoning, cross-user score leakage.

AUTO SKILLS:
- BEFORE: @agent-chatrooms (if weighting/trade-offs debated), @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, 08-skills/safety-moderation-skill.md
- AFTER: @subagent-verification-loops (REQUIRED — scoring + IDOR)

Verify: known job+profile pair scores >85 on test fixture
```

### P2.5 — Jobs UI

```
Task P2.5: Dashboard jobs list — filter, sort by score, job detail modal per AppFlow §2.3.

GOAL: User sees collected jobs ranked by match score with reasoning expandable.
FAILURE: Shows other users' jobs, no empty state when zero jobs.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: @accessibility-compliance-accessibility-audit
- AFTER: @webapp-testing, @subagent-verification-loops
```

---

## Phase 3 — Document Generation (Weeks 9–12)

**Contract:** `docs/contracts/phase-3-documents.md`

### P3.1 — GenerateDocs agent

```
Task P3.1: CV tailoring + cover letter generation from user CV chunks (RAG).

GOAL: tailored_cv and cover_letter saved to application draft; status=draft.
CONSTRAINTS: NO hallucinated experience (HG-9) — every bullet traces to cv_chunks.
FAILURE: Fabricated employers/skills, no draft status before user review.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/safety-moderation-skill.md, 08-skills/job-agent-skill.md
- AFTER: @subagent-verification-loops (REQUIRED — HG-9 hallucination check)

Verify: diff shows only rephrasing of existing CV content
```

### P3.2 — Document review UI

```
Task P3.2: Side-by-side review screen per AppFlow §2.3 — original vs tailored, Regenerate button.

GOAL: User reviews docs before any apply action; Apply button disabled until review.
FAILURE: Skip review path to submit, no download PDF option.

AUTO SKILLS:
- BEFORE: @reverse-prompting (review UX), @prompt-contracts
- BUILD: @accessibility-compliance-accessibility-audit
- AFTER: @subagent-verification-loops (REQUIRED — no skip-to-submit path)
```

---

## Phase 4 — Approval-Gated Apply (Weeks 13–18)

**Contract:** `docs/contracts/phase-4-apply.md`

### P4.1 — Approval flow

```
Task P4.1: POST /applications/:id/approve — state machine draft → pending_approval → approved.

GOAL: Playwright submit ONLY enqueued after approve; HG-4 enforced in API.
CONSTRAINTS: SubmitApplicationJob requires approved_at in payload.
FAILURE: Any code path to submit without approve endpoint call.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, 08-skills/auth-rbac-skill.md
- AFTER: @subagent-verification-loops (REQUIRED — HG-4 approval gate)
```

### P4.2 — SubmitVerify agent

```
Task P4.2: Playwright form fill + submit + screenshot confirmation.

GOAL: Application status=submitted with proof screenshot in MinIO.
CONSTRAINTS: ATS API first (Greenhouse/Lever) where available; browser second.
FAILURE: Submit without screenshot, no error handling for CAPTCHA (report [ERROR]).

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/job-agent-skill.md, @multi-agent-chrome (parallel portal testing)
- AFTER: @subagent-verification-loops (REQUIRED — submit path + HG-4)
```

### P4.3 — Kanban pipeline

```
Task P4.3: Application pipeline UI per AppFlow §2.4 — Applied, Screening, Interviewing, Offer, Archived.

GOAL: Drag-drop or menu to move stages; timeline per application.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: @accessibility-compliance-accessibility-audit
- AFTER: @webapp-testing, @subagent-verification-loops
```

---

## Phase 5 — Email + Analytics (Weeks 19–22)

**Contract:** `docs/contracts/phase-5-monitoring.md`

### P5.1 — Email monitor

```
Task P5.1: Gmail/IMAP sync + classifier agent — map emails to applications, update status.

GOAL: interview_invitation email → status=interviewing + user notification.
CONSTRAINTS: NO email body in logs (HG-8); PII skill required.
FAILURE: Misclassified email auto-updates without confidence threshold.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/safety-moderation-skill.md, 08-skills/job-agent-skill.md
- AFTER: @subagent-verification-loops (REQUIRED — PII/email)
```

### P5.2 — Analytics dashboard

```
Task P5.2: Pipeline funnel, source ROI, match quality charts per PRD §10.5.

GOAL: Dashboard analytics tab with date range filter.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/backend-module-skill.md (analytics API)
- AFTER: @subagent-verification-loops
```

---

## Phase 6 — Hardening (Weeks 23–26)

**Contract:** `docs/contracts/phase-6-launch.md`

### P6.1 — Multi-user RBAC

```
Task P6.1: Owner/Member/Viewer roles per AppFlow §7.

GOAL: Team can share sources; members CRUD own applications only.

AUTO SKILLS:
- BEFORE: @agent-chatrooms (RBAC model debate), @prompt-contracts
- BUILD: 08-skills/auth-rbac-skill.md, @api-security-best-practices
- AFTER: @review-security, @subagent-verification-loops (REQUIRED — RBAC)
```

### P6.2 — GDPR + E2E

```
Task P6.2: Export/delete user data; Playwright E2E for auth → onboard → match → approve → submit path.

GOAL: DELETE /api/v1/profile cascades PII; E2E green on staging.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/safety-moderation-skill.md, @webapp-testing, @web-security-testing
- AFTER: @review-security, @subagent-verification-loops (REQUIRED — GDPR + full path)
```

---

## Phase 7 — Product shell

**Contract:** `docs/contracts/phase-7-product-shell.md`

### P7.1 — Email verify + password reset

```
Task P7.1: Email verification + forgot/reset password per docs/Backend_Schema.md §2.2.

GOAL: POST /auth/forgot-password and /auth/reset-password; verify-email before full access.
CONSTRAINTS: Tokens single-use, hashed at rest; no email in logs (HG-8); HG-1.
FAILURE: Reset token reusable; userId accepted from body instead of token.

AUTO SKILLS:
- BEFORE: @prompt-contracts
- BUILD: 08-skills/auth-rbac-skill.md, @api-security-best-practices
- AFTER: @subagent-verification-loops (REQUIRED — auth)
```

### P7.2 — OAuth providers

```
Task P7.2: OAuth Google, GitHub, LinkedIn — /auth/oauth/{provider}.

GOAL: User can sign in via OAuth; tokens stored server-side; AppFlow §2.1 fallback to password.
CONSTRAINTS: HG-1 no client secrets; PKCE where required.
FAILURE: Provider secret in NEXT_PUBLIC_*; account takeover via email collision without link.

AUTO SKILLS:
- BEFORE: @prompt-contracts, @reverse-prompting (if provider UX unclear)
- BUILD: 08-skills/auth-rbac-skill.md, @api-security-best-practices
- AFTER: @subagent-verification-loops (REQUIRED — auth)
```

### P7.3 — Sessions + /auth/me

```
Task P7.3: List/revoke sessions; GET/PATCH /auth/me.

GOAL: User sees active sessions and can revoke; name/timezone/locale updatable.
FAILURE: Revoke does not invalidate refresh token; IDOR on another user's sessions.
```

### P7.4 — CV version lifecycle

```
Task P7.4: Activate, delete, diff, reindex CV versions; list chunks.

GOAL: Schema §2.3 endpoints; reindex enqueues Celery, does not block HTTP.
CONSTRAINTS: HG-8 no parsed text in logs; HG-9 chunks remain source of truth.
FAILURE: Activate another user's version; delete leaves orphan embeddings.
```

### P7.5 — Profile + CV settings UI

```
Task P7.5: /settings/profile tabs + /settings/cv manager per AppFlow §2.6.

GOAL: Skills/prefs editor and CV version list with activate/download/delete.
FAILURE: Settings reachable without auth; salary floats (HG-3).
```

### P7.6 — App chrome + dashboard widgets

```
Task P7.6: Sidebar + TopBar + theme; dashboard metrics, top matches, pipeline snapshot, source health (UIUX §5.2).

GOAL: Logged-in app uses shared shell; dashboard is not empty-state-only when data exists.
CONSTRAINTS: shadcn new-york/neutral; Lucide only.
FAILURE: Blank dashboard when jobs exist; no nav to jobs/applications/analytics/settings.
```

---

## Phase 8 — Collection completeness

**Contract:** `docs/contracts/phase-8-collection-complete.md`

### P8.1 — Playwright + career pages

```
Task P8.1: Playwright collector + career_page source type (AppFlow §2.7).

GOAL: User configures start URL + selectors, test-run returns sample jobs.
CONSTRAINTS: BaseCollector; HG-10 no n8n; credentials not logged.
FAILURE: Silent scrape crash; last_run_status not updated.
```

### P8.2 — Telegram collector

```
Task P8.2: Telegram channel source (bot token + channel id + filter regex).

GOAL: Messages matching filter become jobs_raw → extract_normalize.
FAILURE: Bot token in client bundle or info logs.
```

### P8.3 — Import / similar / save

```
Task P8.3: POST /jobs/import, GET /jobs/:id/similar, save/unsave.

GOAL: Paste URL → parse+score; similar jobs; bookmark (PRD §10.1).
FAILURE: Imported job visible to other users (IDOR).
```

### P8.4 — Daily cron + enrichment

```
Task P8.4: Timezone-aware daily collect via BullMQ; optional company enrichment.

GOAL: AppFlow §2.2 COLLECT on user TZ cron without n8n.
FAILURE: n8n introduced; cron in UTC only ignoring profile.timezone.
```

### P8.5 — Source runs + jobs filters

```
Task P8.5: GET /sources/:id/runs + templates; jobs list filters/stats per UIUX jobs view.

GOAL: Run history visible; filter by score/location/salary/source.
FAILURE: Cross-user run leakage.
```

---

## Phase 9 — Document completeness

**Contract:** `docs/contracts/phase-9-documents-complete.md`

### P9.1 — Templates

```
Task P9.1: modern/classic/minimal CV+CL templates + selector on review screen.

GOAL: User switches template; PDF regenerates; HG-9 traces preserved.
FAILURE: Template injects fake experience.
```

### P9.2 — Bullet accept/reject

```
Task P9.2: Per-bullet accept/reject + regenerate single section (AppFlow §2.3).

GOAL: Edits persist on application; Apply still disabled until review.
FAILURE: Skip-review path; untraced bullets saved (HG-9).
```

### P9.3 — Bulk generate

```
Task P9.3: Bulk generate tailored docs for top N matches (drafts only).

GOAL: Queue N jobs; progress visible; status=draft; HG-4 no submit.
FAILURE: Bulk generate enqueues submit_application.
```

### P9.4 — PDF/ZIP download

```
Task P9.4: ATS-friendly PDF + ZIP of CV+CL+metadata.

GOAL: Text-extractable PDFs; signed MinIO URLs.
FAILURE: Unauthenticated download of another user's docs.
```

---

## Phase 10 — Apply completeness

**Contract:** `docs/contracts/phase-10-apply-complete.md`

### P10.1 — Workday + Ashby

```
Task P10.1: Workday and Ashby ATS submitters.

GOAL: ATS-first like Greenhouse/Lever; still requires approve + approved_at (HG-4).
FAILURE: Submit path without approve.
```

### P10.2 — Portal appliers

```
Task P10.2: LinkedIn Easy Apply, Indeed Apply, generic career portal.

GOAL: Playwright appliers after ATS; screenshot proof; CAPTCHA → user error.
FAILURE: Worker crash on CAPTCHA; no screenshot.
```

### P10.3 — Rate limits + emergency stop

```
Task P10.3: Per-site rate limits, daily caps, POST emergency-stop for user queue.

GOAL: TRD FR-AA-07; stop pauses submit jobs for that user.
FAILURE: Unbounded portal requests; stop does not halt in-flight enqueue.
```

### P10.4 — Interviews + bulk actions

```
Task P10.4: Interview events, follow-up reminders, notes, bulk archive/withdraw (AppFlow §2.4).

GOAL: Schema §2.6 interviews + bulk-action; Kanban card menu complete.
FAILURE: Member mutates another member's application.
```

---

## Phase 11 — Comms & realtime

**Contract:** `docs/contracts/phase-11-comms.md`

### P11.1 — Gmail OAuth

```
Task P11.1: Gmail OAuth watch + history sync; keep IMAP fallback.

GOAL: TRD FR-EM-01; classifier unchanged confidence gates.
FAILURE: Refresh token in browser; email body in logs (HG-8).
```

### P11.2 — Notification center

```
Task P11.2: Bell UI, preferences, optional Slack/Telegram webhooks.

GOAL: Schema §2.9; in-app + email for interview/offer.
FAILURE: Preferences stored without auth; PII in webhook payload logs.
```

### P11.3 — Email review queue

```
Task P11.3: /emails/review for low-confidence classifications (AppFlow §2.5).

GOAL: User corrects category; does not auto-update below threshold.
FAILURE: Low-confidence still auto-updates status.
```

### P11.4 — Analytics export

```
Task P11.4: GET /analytics/export CSV/PDF + skill-gap endpoint.

GOAL: Schema §2.7 remaining reports.
FAILURE: Export includes other users' rows.
```

### P11.5 — WebSocket events

```
Task P11.5: WS pipeline_progress, documents_ready, notification (Schema §2.10).

GOAL: JWT-auth WS; subscribe only to own channels.
FAILURE: User receives another user's events.
```

### P11.6 — Weekly digest

```
Task P11.6: Weekly digest email — top matches, applications, responses.

GOAL: PRD P5.7 / AppFlow morning digest (weekly first).
FAILURE: Digest contains raw email bodies or CV text.
```

---

## Phase 12 — Production launch

**Contract:** `docs/contracts/phase-12-launch.md`

### P12.1 — CI + rate limits

```
Task P12.1: GitHub Actions CI for api/web/workers; Redis API rate limit.

GOAL: PR on main runs typecheck+tests; Schema §2.1 limits.
FAILURE: Secrets printed in CI logs; unauthenticated flood unbounded.
```

### P12.2 — Observability + OpenAPI

```
Task P12.2: Sentry (or equivalent), structured logs, OpenAPI from routes.

GOAL: PRD P6.4/P6.6; HG-8 no PII in error reports.
FAILURE: CV/email body in Sentry breadcrumbs.
```

### P12.3 — Landing + runbooks

```
Task P12.3: Marketing landing page; execute staging-deploy, backup-restore, beta-launch checklists.

GOAL: docs/runbooks/beta-launch.md exit criteria documented as done or blocked.
FAILURE: Landing embeds API keys; runbook steps skipped with no blocker.
```

### P12.4 — A11y polish

```
Task P12.4: WCAG AA audit, keyboard shortcuts, dark-mode refinement (UIUX §7, §11).

GOAL: Auth, onboarding, dashboard, kanban usable with keyboard + SR.
FAILURE: Unlabeled icon-only controls; focus traps.
```

---

## Phase 13 — Post-MVP

Do not start until Phase 12 is marked done. Tasks are listed in `project-backlog.md` (interview prep, salary bench, WhatsApp source, billing, mobile). Copy a new prompt when kicking off.

---

## Verification prompt (after every task)

```
Review the work just completed for task [TASK_ID].

AUTO-INVOKE: @subagent-verification-loops (required if task AUTO SKILLS lists REQUIRED)

Check against docs/contracts/[phase].md FAILURE clauses.
Check hard gates HG-1 through HG-10 that apply.
Run: typecheck, tests, bash 07-tools-mcp/drizzle-validator.sh (if api touched).

Output:
1. Contract status: PASS or list failures
2. Skills invoked (BEFORE / BUILD / AFTER)
3. Subagent verification VERDICT: PASS | ISSUES_FOUND | CRITICAL
4. Tests run and results
5. Files changed
6. Update phase-orchestrator.md — mark task [x] if PASS

If any FAILURE clause hit or VERDICT ≠ PASS: fix before marking done.
If user corrected you during task: @self-modifying-rules to save preference.
```

---

## Blocker prompt

```
I am blocked on task [TASK_ID].

AUTO-INVOKE: @reverse-prompting if blocker is ambiguous requirements

Append to .agent-settings/blockers.md:
- What is stuck
- What I tried
- What I need (human decision / env var / clarification)

Do NOT guess or skip the blocked requirement.
```

---

## Phase kickoff prompt (start a new phase)

```
Starting Phase [N] of JobAutomater.

AUTO-INVOKE:
1. @prompt-contracts — confirm phase contract in docs/contracts/phase-[N]-*.md
2. @reverse-prompting — only if phase scope or priorities unclear
3. @agent-chatrooms — only if major architecture fork within phase

Read phase-orchestrator.md for open tasks. Execute P[N].1 first unless told otherwise.
After each task: verification prompt + subagent-verification-loops where REQUIRED.
```

---

## Doc index (canonical paths only)

| Doc | Path |
|-----|------|
| PRD | `docs/PRD.md` |
| TRD | `docs/TRD.md` |
| App flows | `docs/AppFlow.md` |
| Schema | `docs/Backend_Schema.md` |
| UI | `docs/UIUX_Design.md` |
| Implementation timeline | `docs/Implementation_Plan.md` |
| Phase contracts | `docs/contracts/phase-*.md` |
| Queue payloads | `contracts/queue-payloads.schema.json` |
| Task backlog | `project-backlog.md` |
| Live tasks | `.agent-settings/phase-orchestrator.md` |
| Skills usage guide | `../SKILLS-USAGE-GUIDE.md` (parent folder) |
| Global skill sources | `../Reverse Prompting.md`, `../Subagent Verification Loops.md`, etc. |

**Do not read duplicate files at repo root — all product docs live in `docs/` only.**
