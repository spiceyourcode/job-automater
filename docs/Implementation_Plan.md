# Implementation Plan
## AI-Powered Job Application Automation Platform

---

## 1. Project Overview

### 1.1 Goals
Build a production-ready AI job automation platform that:
- Collects jobs from 5+ sources automatically
- Matches jobs to user profiles with >85% precision
- Generates tailored CVs and cover letters
- Submits applications via API and browser automation
- Monitors email for responses and updates pipeline

### 1.2 Success Metrics (MVP - 6 Months)
| Metric | Target |
|--------|--------|
| Daily job collection | 500+ |
| Match precision@10 | >85% |
| Weekly applications | 50+ |
| Interview conversion | >15% |
| Pipeline uptime | 99.9% |
| User onboarding completion | >80% |

### 1.3 Tech Stack Summary
```
Frontend:     React 18 + TypeScript + Vite + TanStack Query + Radix UI + Tailwind
Backend:      Node.js 20 (Hono/Fastify) + Python 3.11 (Agents) + Drizzle ORM
Database:     PostgreSQL 16 + pgvector
Orchestration: n8n (self-hosted)
AI:           OpenAI GPT-4o / Anthropic Claude 3.5 Sonnet
Browser:      Playwright (Python)
Storage:      Cloudflare R2
Auth:         JWT + OAuth 2.0 (Google, GitHub, LinkedIn)
Deploy:       Docker + Kubernetes (EKS/GKE) or Railway/Fly.io
Observability: Sentry + PostHog + Grafana + Prometheus
```

---

## 2. Phase Breakdown

### Phase 1: Foundation (Weeks 1-4) ✅ **Core Infrastructure**

#### Week 1: Project Setup & Dev Environment
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Initialize monorepo (Nx/Turborepo) | BE | Repo with shared configs | - |
| Configure TypeScript, ESLint, Prettier, Husky | BE | Linting/formatting on commit | Repo |
| Set up CI/CD (GitHub Actions) | BE | Build, test, deploy pipelines | Repo |
| PostgreSQL + pgvector local (Docker Compose) | BE | Running DB with migrations | - |
| n8n self-hosted local (Docker) | BE | n8n accessible at localhost:5678 | - |
| Redis local (Docker) | BE | Cache/queue backend | - |
| Cloudflare R2 bucket + credentials | BE | File storage ready | - |

#### Week 2: Authentication & User Management
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| User model + migrations | BE | `users`, `sessions` tables | DB ready |
| JWT access/refresh token system | BE | `/auth/login`, `/register`, `/refresh` | User model |
| Password hashing (bcrypt/argon2) | BE | Secure password storage | Auth |
| Email verification flow | BE | SendGrid/Resend integration | Auth |
| OAuth 2.0: Google, GitHub, LinkedIn | BE | `/auth/oauth/{provider}` | Auth |
| Password reset flow | BE | `/auth/forgot`, `/auth/reset` | Auth |
| Session management (revoke, list) | BE | `/auth/sessions` | Auth |
| Auth middleware (protect routes) | BE | `requireAuth`, `optionalAuth` | Auth |

#### Week 3: Profile & CV Management
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Profile CRUD API | BE | `/profile` GET/PATCH | Auth |
| Skills taxonomy (5000+ skills) | BE | Seed data + typeahead API | DB |
| CV upload (multipart) | BE | `/profile/cv` POST | Auth, R2 |
| PDF/DOCX parsing (pdf-parse, mammoth) | BE/AI | Extracted text + sections | CV upload |
| CV chunking + embedding (OpenAI) | AI | `cv_chunks` populated | CV parse |
| Vector search endpoint | AI | `/cv/search` semantic query | Embeddings |
| CV version management | BE | List, activate, delete, diff | CV upload |

#### Week 4: Dashboard Shell & Core UI
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| React app init (Vite + TS + Tailwind) | FE | Running dev server | - |
| App shell: TopBar, Sidebar, Main | FE | Layout component | - |
| Authentication pages (Login, Register, OAuth) | FE | Auth flow UI | Auth API |
| Onboarding wizard (5 steps) | FE | `/onboarding` multi-step | Profile API |
| Profile editor (tabs: overview, skills, prefs, CV) | FE | `/settings/profile` | Profile API |
| CV manager (upload, versions, re-index) | FE | `/settings/cv` | CV API |
| Dark/light theme + persistence | FE | ThemeProvider | - |
| Responsive design (mobile-first) | FE | Works 320px-1920px | - |

**Phase 1 Exit Criteria:**
- [ ] User can sign up, verify email, log in via OAuth
- [ ] User completes onboarding, uploads CV, sees parsed skills
- [ ] Dashboard loads with empty state (no jobs yet)
- [ ] All tests passing (unit + integration)
- [ ] Deployed to staging environment

---

### Phase 2: Job Collection & Intelligence (Weeks 5-8) 🧠 **AI Matching & CV**

#### Week 5: Source Collection Framework
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Source config model + API | BE | `/sources` CRUD | Phase 1 |
| Generic collector base class | BE/AI | `BaseCollector` abstract | - |
| RSS/Atom collector | BE | `RssCollector` | Base |
| REST API collector (generic) | BE | `ApiCollector` with mapping | Base |
| Playwright collector framework | BE/AI | `PlaywrightCollector` base | Base |
| Email IMAP collector | BE | `EmailCollector` | Base |
| Collector registry + factory | BE | Auto-discovery | All collectors |
| n8n workflow: Daily Collection | BE | `daily-collection` workflow | n8n, collectors |

#### Week 6: Job Normalization & Deduplication
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| LLM extraction agent (structured output) | AI | `/agents/extract-job` | OpenAI API |
| JSON schema for normalized job | AI | Zod schema + OpenAPI | - |
| Validation pipeline (score, warnings) | AI | Quality gates | Extraction |
| Upsert jobs (PostgreSQL) | BE | `jobs` table + indexes | Schema |
| Fuzzy deduplication (title+company+location) | AI | `deduplicate-jobs` agent | Jobs table |
| Embedding-based deduplication (pgvector) | AI | Vector similarity >0.92 | pgvector |
| Company enrichment (Clearbit/Apollo) | BE | Company size, industry, tech stack | Jobs |

#### Week 7: Job Matching & Scoring
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Matching agent (multi-factor) | AI | `/agents/match-job` | Profile, CV chunks, Job |
| Scoring weights configuration | AI | Configurable per user | Matching |
| Skill matching (taxonomy-aware) | AI | Exact + fuzzy + related | Skills |
| Experience level matching | AI | Years + seniority mapping | Profile |
| Location matching (remote, timezone, commute) | AI | Geographic scoring | Profile |
| Salary matching (market data + preferences) | AI | Market-adjusted fit | Profile |
| Culture/values matching (LLM) | AI | Qualitative fit | Profile |
| Explainability (reasoning text) | AI | Human-readable why | Matching |
| Batch scoring endpoint | AI | `/agents/batch-match` | Matching |
| n8n workflow: Daily Scoring | BE | `daily-scoring` workflow | n8n, matching |

#### Week 8: Job UI & Dashboard Integration
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Jobs list page (filters, sort, pagination) | FE | `/jobs` | Jobs API |
| Job detail modal (score breakdown, reasoning) | FE | JobCard click → Modal | Jobs API |
| Top matches section on dashboard | FE | Dashboard widget | Scoring |
| Source health dashboard | FE | `/sources` status page | Source API |
| Manual job import (URL paste) | FE | `/jobs/import` | Import API |
| Job tags/skills visualization | FE | Skill badges, cloud | Jobs API |
| Save/unsave jobs | FE | Bookmark feature | Jobs API |

**Phase 2 Exit Criteria:**
- [ ] 3+ sources collecting jobs daily (RSS, API, Playwright)
- [ ] Jobs normalized, deduplicated (<5% dup rate)
- [ ] Matching scores generated with reasoning
- [ ] Dashboard shows top 10 matches with explanations
- [ ] User can manually import a job URL
- [ ] Source config UI allows adding new sources

---

### Phase 3: Document Generation (Weeks 9-12) 📝 **Tailored CVs & Cover Letters**

#### Week 9: CV Tailoring Agent
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| LaTeX CV templates (modern, classic, minimal) | FE/AI | 3 templates in `/templates/cv` | - |
| CV tailoring agent (STAR method bullets) | AI | `/agents/tailor-cv` | Matching, CV chunks |
| Keyword injection (ATS optimization) | AI | Skills from job → CV | Tailoring |
| Section reordering (relevant first) | AI | Dynamic section priority | Tailoring |
| PDF generation (Typst or LaTeX → PDF) | AI | High-quality PDF output | Templates |
| Diff view (original vs tailored) | FE | Side-by-side comparison | Tailored CV |

#### Week 10: Cover Letter Generation
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Cover letter templates | FE/AI | 3 templates | - |
| Cover letter agent (narrative generation) | AI | `/agents/cover-letter` | Tailored CV, Job, Profile |
| Tone variations (professional, enthusiastic, concise) | AI | Tone parameter | Cover letter |
| Company-specific research injection | AI | Recent news, values, products | Cover letter |
| PDF generation matching CV style | AI | Consistent branding | CV templates |

#### Week 11: Document Review & Management UI
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Document generation queue (bullmq) | BE | Async generation, progress WS | BullMQ, Redis |
| Review screen (CV + CL side-by-side) | FE | `/jobs/{id}/documents` | Generation |
| Inline editing (accept/reject changes) | FE | Per-bullet approval | Diff view |
| Regenerate single section | FE | "Regenerate summary" button | Generation |
| Template selector + preview | FE | Switch templates live | Templates |
| Download ZIP (CV + CL + metadata) | FE | One-click export | Generation |
| Document version history | FE | `/applications/{id}/documents` | Applications |

#### Week 12: Bulk Generation & Optimization
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Bulk generate for top N matches | BE | `/jobs/bulk-generate` | Queue |
| Generation caching (same job+CV) | BE | Redis cache, 24h TTL | Generation |
| Cost tracking (tokens per generation) | BE | `/analytics/generation-costs` | OpenAI usage |
| Quality gates (min score, max length) | AI | Configurable thresholds | Generation |
| A/B template testing framework | AI | Random assignment, metrics | Templates |

**Phase 3 Exit Criteria:**
- [ ] Tailored CV generates in <30s with <5% hallucination rate
- [ ] Cover letter personalized with company research
- [ ] User can review, edit, approve documents
- [ ] Bulk generation works for 10+ jobs
- [ ] PDFs are ATS-friendly (text extractable)

---

### Phase 4: Application Automation (Weeks 13-18) 🤖 **Auto-Apply & Browser Automation**

#### Week 13: Application Framework
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Application model + API | BE | `applications` table, CRUD | Phase 1 |
| Submission modes: auto/assisted/manual | BE | Mode parameter | Application |
| ATS API integrations (Greenhouse, Lever, Workday, Ashby) | BE/AI | 4+ ATS submitters | APIs |
| OAuth for ATS (where supported) | BE | Token management | ATS APIs |
| Submission status tracking | BE | Webhook/polling for status | ATS APIs |

#### Week 14: Browser Automation (Playwright)
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Playwright pool manager | BE/AI | Reusable browser contexts | Playwright |
| Stealth configuration (fingerprint, headers) | AI | Undetected chromedriver patterns | Playwright |
| Form field detection (heuristic + LLM) | AI | `/agents/detect-fields` | LLM |
| Field mapping (profile data → form fields) | AI | Smart mapper | Detection |
| File upload handling (CV, CL, portfolio) | BE | Drag-drop, input[type=file] | Playwright |
| Multi-step form navigation | AI | Next/Continue/Submit logic | Playwright |
| CAPTCHA detection + human handoff | AI | Alert user, pause automation | Playwright |
| Screenshot/video recording | BE | Evidence of submission | Playwright |

#### Week 15: Portal-Specific Automations
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| LinkedIn Easy Apply | AI | `LinkedInApplier` | Playwright |
| Indeed Apply | AI | `IndeedApplier` | Playwright |
| Company career portals (generic) | AI | Configurable portal handler | Playwright |
| Workday portal automation | AI | `WorkdayApplier` | Playwright |
| Greenhouse/Lever hosted portals | AI | Portal-specific logic | Playwright |
| Custom portal config (selectors, flows) | BE | JSON config per company | Framework |

#### Week 16: Application Orchestration
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Application queue (bullmq) | BE | Priority, retry, rate limits | Redis |
| Daily auto-apply workflow (n8n) | BE | `daily-apply` workflow | Queue |
| Rate limiting per domain | BE | Token bucket per site | Queue |
| Daily/application caps per user | BE | Configurable limits | Queue |
| Submission verification (confirmation detection) | AI | Email/API confirmation | Email, ATS |
| Failure handling + retry logic | BE | Exponential backoff, DLQ | Queue |
| Human-in-loop for assisted mode | FE | "Review before submit" step | UI |

#### Week 17: Pipeline Management UI
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Kanban board (Applied→Screening→Interviewing→Offer) | FE | `/applications` drag-drop | Applications API |
| Application detail timeline | FE | Events, docs, emails | Applications API |
| Interview scheduling helper | FE | Calendly/Cal.com integration | Calendar API |
| Follow-up reminders | FE | Snooze, schedule, templates | Notifications |
| Bulk actions (archive, withdraw, regenerate) | FE | Multi-select toolbar | Applications API |
| Export pipeline (CSV, PDF report) | FE | Download button | Analytics |

#### Week 18: Monitoring & Safety
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Application success/failure metrics | BE | `/analytics/applications` | Analytics |
| Screenshot evidence gallery | FE | Per-application proof | Automation |
| Anti-detection audit (fingerprint test) | AI | Bot detection score | Playwright |
| Emergency stop (kill all automation) | BE | `/automation/emergency-stop` | Queue |
| Compliance logging (audit trail) | BE | Immutable logs | All automation |

**Phase 4 Exit Criteria:**
- [ ] Auto-apply works for Greenhouse, Lever, LinkedIn Easy Apply
- [ ] Assisted mode works for 10+ company portals
- [ ] Rate limiting prevents bans (0 bans in testing)
- [ ] Submission confirmation captured >95%
- [ ] Kanban board shows full pipeline
- [ ] Emergency stop works instantly

---

### Phase 5: Email Monitoring & Analytics (Weeks 19-22) 📊 **Email & Insights**

#### Week 19: Gmail Integration
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Gmail API OAuth setup | BE | `/auth/gmail` scope | Auth |
| Push notifications (Pub/Sub) | BE | Real-time email webhook | Gmail API |
| Historical sync (last 90 days) | BE | Backfill endpoint | Gmail API |
| Email storage (deduplicated) | BE | `emails` table | Gmail API |
| Thread linking to applications | AI | Match by company/role/date | Applications |

#### Week 20: Email Classification
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Classification agent (6 categories) | AI | `/agents/classify-email` | Emails, Applications |
| Structured extraction (dates, links, names) | AI | Structured data from body | Classification |
| Auto-status update (confirmed, interview, reject, offer) | BE | Application status sync | Classification |
| Manual review queue (low confidence) | FE | `/emails/review` | Classification |
| Training data collection (user corrections) | AI | Feedback loop | Review queue |

#### Week 21: Analytics Dashboard
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Pipeline funnel visualization | FE | `/analytics` funnel chart | Analytics API |
| Source ROI analysis | FE | Table + charts | Analytics API |
| Match quality trends | FE | Score distribution over time | Analytics API |
| Time-to-interview, time-to-offer | FE | Metrics cards | Analytics API |
| Skill gap analysis | FE | Missing skills from rejections | Analytics API |
| Weekly digest email | BE | Scheduled send (SendGrid) | Analytics, Email |

#### Week 22: Notifications & Alerts
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| In-app notification center | FE | Bell icon + dropdown | Notifications API |
| Email notifications (critical only) | BE | Interview, offer, rejection | Notifications |
| Push notifications (Web Push API) | FE | Service worker + VAPID | Notifications |
| Slack/Telegram webhook integration | BE | `/integrations/slack` | Notifications |
| Notification preferences | FE | `/settings/notifications` | Preferences API |

**Phase 5 Exit Criteria:**
- [ ] Gmail sync captures >99% relevant emails
- [ ] Classification accuracy >95% on test set
- [ ] Application status auto-updates from emails
- [ ] Dashboard shows actionable insights
- [ ] Critical notifications delivered <1 min

---

### Phase 6: Production Hardening (Weeks 23-26) 🚀 **Launch Ready**

#### Week 23: Multi-User & Organizations
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Organization model (teams, billing) | BE | `organizations`, `memberships` | Auth |
| Role-based access (owner, admin, member) | BE | RBAC middleware | Org |
| Invitation flow | BE/FE | Email invite + signup | Org |
| Shared sources (team job boards) | BE | Source visibility settings | Sources |
| Team analytics (aggregated) | FE | `/analytics/team` | Analytics |

#### Week 24: Security & Compliance
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Security audit (OWASP Top 10) | BE | Audit report + fixes | All |
| Penetration test (external) | Security | Report + remediation | Audit |
| GDPR/CCPA compliance (export, delete) | BE | `/privacy/export`, `/privacy/delete` | All |
| Secrets rotation (Vault/Sealed Secrets) | DevOps | Automated rotation | Infra |
| Rate limiting (API, auth, automation) | BE | Redis-backed limits | All |
| Audit logging (immutable) | BE | All sensitive actions | All |

#### Week 25: Observability & Reliability
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Distributed tracing (OpenTelemetry) | DevOps | Jaeger/Grafana Tempo | All services |
| Custom metrics (business + technical) | BE | Prometheus exporters | All |
| Alerting rules (PagerDuty/Opsgenie) | DevOps | Critical alerts <5 min | Metrics |
| Log aggregation (Loki/Elastic) | DevOps | Structured JSON logs | All |
| Chaos engineering (Litmus) | DevOps | Monthly game days | Infra |
| Runbook documentation | DevOps | Incident response guides | All |

#### Week 26: Launch Preparation
| Task | Owner | Deliverable | Dependencies |
|------|-------|-------------|--------------|
| Landing page + pricing | FE/Marketing | `/`, `/pricing` | - |
| Onboarding flow optimization | FE/PM | Funnel analysis + fixes | Analytics |
| Documentation (user + API) | FE/BE | `/docs`, OpenAPI spec | All APIs |
| Stripe billing integration | BE | Subscriptions, usage-based | Stripe |
| Beta user onboarding (20 users) | PM | Feedback + fixes | All |
| Load testing (k6, 1000 VU) | DevOps | Performance baseline | Staging |
| Production deploy + smoke tests | DevOps | Blue-green deploy | All |
| Launch! 🎉 | Team | Public availability | All |

---

## 3. Resource Allocation

### 3.1 Team Structure (Recommended)
| Role | Count | Phase Focus |
|------|-------|-------------|
| Backend Engineer (Node/TS) | 2 | Phases 1, 2, 4, 6 |
| AI/ML Engineer (Python) | 2 | Phases 2, 3, 4, 5 |
| Frontend Engineer (React) | 2 | Phases 1, 3, 4, 5, 6 |
| DevOps/Platform Engineer | 1 | Phases 1, 6 |
| Product Manager | 1 | All phases |
| QA/Automation Engineer | 1 | Phases 3, 4, 6 |

### 3.2 External Dependencies
| Service | Purpose | Cost Estimate (Monthly) |
|---------|---------|-------------------------|
| OpenAI API (GPT-4o, embeddings) | All AI agents | $500-2000 |
| Anthropic API (Claude) | Backup/alternative | $200-1000 |
| PostgreSQL (Managed) | Primary DB | $100-500 |
| Redis (Managed) | Cache, queues | $50-200 |
| Cloudflare R2 | File storage | $10-50 |
| n8n Cloud or Self-hosted | Workflow orchestration | $0-200 |
| SendGrid/Resend | Transactional email | $20-100 |
| Sentry | Error tracking | $0-200 |
| PostHog | Product analytics | $0-200 |
| Stripe | Billing | 2.9% + 30¢ |
| **Total (MVP)** | | **~$1,000-4,500/mo** |

---

## 4. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Site scraping breaks frequently | High | High | Modular collectors, automated tests, monitoring alerts |
| ATS anti-bot blocks automation | High | High | Stealth Playwright, residential proxies, human fallback |
| LLM hallucination in CV generation | Medium | High | Structured output, validation, human review, low temp |
| Email classification errors | Medium | Medium | Confidence thresholds, user correction loop |
| Gmail API rate limits | Low | Medium | Batch processing, exponential backoff |
| User data privacy concerns | Low | Critical | GDPR compliance, minimal data, encryption |
| Cost overrun (LLM tokens) | Medium | Medium | Token budgets, caching, smaller models for classification |
| n8n workflow complexity | Medium | Medium | Visual debugging, version control, testing |
| Browser automation flakiness | High | Medium | Retry logic, screenshots, evidence collection |
| Legal risk (scraping ToS) | Medium | High | Respect robots.txt, use official APIs, legal review |

---

## 5. Definition of Done (Per Feature)

- [ ] Code complete + self-reviewed
- [ ] Unit tests ≥80% coverage
- [ ] Integration tests passing
- [ ] E2E test (Playwright) for critical path
- [ ] Documentation updated (API, user guide)
- [ ] Accessibility audit (WCAG AA)
- [ ] Performance budget met (<200ms API p95)
- [ ] Security review (no secrets, proper auth)
- [ ] Deployed to staging + smoke tested
- [ ] Product demo recorded
- [ ] Merged to main + released

---

## 6. Milestone Timeline

```
Month 1: ████████░░ Phase 1: Foundation
Month 2: ████████░░ Phase 2: Intelligence
Month 3: ████████░░ Phase 3: Documents
Month 4: ████████░░ Phase 4: Automation
Month 5: ████████░░ Phase 5: Email & Analytics
Month 6: ████████░░ Phase 6: Hardening + Launch
```

### Key Milestones
| Milestone | Target Date | Criteria |
|-----------|-------------|----------|
| **M1: Auth + Onboarding** | Week 4 | User signs up, uploads CV, sees dashboard |
| **M2: Jobs + Matching** | Week 8 | 100+ jobs/day, scored matches on dashboard |
| **M3: Document Generation** | Week 12 | Tailored CV+CL for top 10 jobs, review UI |
| **M4: Auto-Apply Working** | Week 18 | 5+ applications submitted automatically |
| **M5: Email + Analytics** | Week 22 | Status auto-updates, dashboard insights |
| **M6: Production Launch** | Week 26 | Public beta, billing, 20 active users |

---

## 7. Post-Launch Roadmap (Months 7-12)

| Quarter | Focus | Key Features |
|---------|-------|--------------|
| Q3 | **Growth** | Referral program, SEO landing pages, affiliate partnerships |
| Q3 | **Intelligence** | Interview prep agent, salary negotiation coach, skill gap courses |
| Q4 | **Enterprise** | Team plans, SSO/SAML, admin console, SLA, dedicated support |
| Q4 | **Platform** | Public API, webhook marketplace, plugin system |
| Q4 | **Mobile** | React Native app (notifications, quick actions, review) |

---

*Document Version: 1.0 | Last Updated: 2024 | Owner: Engineering Lead*