# JobAutomater — Agentic Development Protocol

> Read **`AGENT-PROMPTS.md`** for your task prompt. This file is the rules layer.

---

## Stack

| Layer | Path | Tech |
|-------|------|------|
| API | `api/` | Hono + Drizzle + BullMQ |
| Web | `web/` | Next.js 16 + shadcn/ui (`new-york` / `neutral`) |
| Workers | `workers/` | Celery + LangGraph + Playwright |

---

## Operating loop

```
1. READ  → AGENT-PROMPTS.md (your task) + docs/contracts/<phase>.md
2. SKILL → 08-skills/* if triggered (HG-5)
3. PLAN  → .agent-settings/active-plan.md (HG-7)
4. CODE  → CONVENTIONS.md
5. CHECK → Verification block in AGENT-PROMPTS.md
6. SYNC  → Update CLAUDE.md "Current phase" + project-backlog.md status when a task completes
```

---

## Hard gates

| ID | Rule |
|----|------|
| HG-1 | NO client-side secrets |
| HG-2 | NO unprotected routes |
| HG-3 | NO float salary — integer cents + currency |
| HG-4 | NO submit without POST /applications/:id/approve |
| HG-5 | NO skipping 08-skills when triggered |
| HG-6 | NO cross-module DB queries |
| HG-7 | NO code without active-plan.md entry |
| HG-8 | NO PII in logs |
| HG-9 | NO hallucinated CV content |
| HG-10 | NO n8n — BullMQ + Celery only |

---

## Skills (auto-invoke — see AGENT-PROMPTS.md Skills System)

| Trigger | Skill |
|---------|-------|
| **Every task** | `@prompt-contracts` |
| Scope unclear | `@reverse-prompting` |
| Auth / RBAC | `08-skills/auth-rbac-skill.md` + `@api-security-best-practices` |
| API modules | `08-skills/backend-module-skill.md` + `@zod-validation-expert` |
| PII, CV, email, GDPR | `08-skills/safety-moderation-skill.md` |
| Agents, collectors, apply | `08-skills/job-agent-skill.md` + `@async-python-patterns` |
| Parallel api+web+workers | `@multi-agent-mcp-orchestration` |
| Playwright portal testing | `@multi-agent-chrome` |
| After auth/PII/submit/LLM tasks | `@subagent-verification-loops` (**required**) |
| Architecture decision | `@agent-chatrooms` or `@stochastic-multi-agent-consensus` |
| User corrected you | `@self-modifying-rules` |
| Pre-launch security | `@review-security` + `@web-security-testing` |

Full matrix + per-task AUTO SKILLS: **`AGENT-PROMPTS.md`**

---

## Current phase

**Phase 1 — Foundation** ✅ complete (P1.1–P1.8)

**Phase 2 — Collection** (in progress)

| Done | Task |
|------|------|
| ✓ | P2.1 Source CRUD API + Settings UI |
| ✓ | P2.2 Collector plugins (RSS, API, IMAP) |
| ✓ | P2.3 ExtractNormalize agent |
| ✓ | P2.4 Dedup + MatchScore agent |
| ✓ | P2.5 Jobs list + score UI |

**Phase 2 — Collection** ✅ complete

**Phase 3 — Documents** ✅ complete (P3.1–P3.3)

**Phase 4 — Apply** ✅ complete (P4.1–P4.4 — one commit each)

**Phase 5 — Email + Analytics** ✅ complete (P5.1–P5.2 — one commit each)

**Phase 6 — Hardening** ✅ complete (P6.1–P6.2 — one commit each)

**Phase 7 — Product shell** ✅ complete (P7.1–P7.6 — one commit each)

**Phase 8 — Collection completeness** ✅ complete (P8.1–P8.5 — one commit each)

**Phase 9 — Document completeness** ✅ complete (P9.1–P9.4 — one commit each)

**Phase 10 — Apply completeness** (next)

| Done | Task |
|------|------|
| | P10.1 Workday + Ashby |
| | P10.2 Portal appliers |
| | P10.3 Rate limits + emergency stop |
| | P10.4 Interviews + bulk actions |

**Next:** **P10.1** — Workday and Ashby ATS submitters  
Prompt: `AGENT-PROMPTS.md` → Phase 10 → P10.1  
Contract: `docs/contracts/phase-10-apply-complete.md`

---

## Docs (canonical — docs/ only)

| Doc | Path |
|-----|------|
| PRD | `docs/PRD.md` |
| TRD | `docs/TRD.md` |
| AppFlow | `docs/AppFlow.md` |
| Schema | `docs/Backend_Schema.md` |
| UI | `docs/UIUX_Design.md` |
| Contracts | `docs/contracts/phase-*.md` |
| Backlog | `project-backlog.md` |
