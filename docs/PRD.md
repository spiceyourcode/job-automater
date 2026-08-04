# Product Requirements Document (PRD)
## AI-Powered Job Application Automation Platform

---

## 1. Vision & Mission

**Vision:** Build an AI-powered job application platform that eliminates manual job hunting by automatically discovering, evaluating, and applying to relevant positions on behalf of users.

**Mission:** Reduce job search time from hours to minutes per day while increasing application quality and interview conversion rates through intelligent automation.

---

## 2. Problem Statement

Job seekers currently spend 15-20 hours/week on:
- Manually searching multiple job boards and company sites
- Tailoring resumes and cover letters for each application
- Tracking application status across platforms
- Following up on submissions

**Solution:** An autonomous agent system that continuously monitors sources, matches opportunities to user profiles, generates personalized application materials, and manages the end-to-end application lifecycle.

---

## 3. Target Users

| User Segment | Pain Points | Value Proposition |
|--------------|-------------|-------------------|
| **Active Job Seekers** (unemployed, career changers) | High volume, low response rate, burnout | 10x application volume with personalized materials |
| **Passive Candidates** (employed, open to opportunities) | No time to search, miss opportunities | Background monitoring, only notified for high-match roles |
| **Freelancers/Contractors** | Constant pipeline needed, diverse skills | Multi-source aggregation, rapid proposal generation |

---

## 4. Goals (MVP - Minimum Viable Product)

### Primary Goals
- [ ] **G1:** Import jobs from 5+ configured sources (job boards, Telegram, WhatsApp, Email, Company career pages)
- [ ] **G2:** Parse, normalize, and deduplicate job data with >95% accuracy
- [ ] **G3:** Upload and index CV into vector knowledge base for semantic search
- [ ] **G4:** Score jobs against user profile using multi-factor AI matching (>85% precision)
- [ ] **G5:** Generate tailored CV and cover letter for top 10 matches daily
- [ ] **G6:** Auto-submit applications where programmatic APIs exist (Greenhouse, Lever, Workday, etc.)
- [ ] **G7:** Monitor email for responses and update application status
- [ ] **G8:** Provide real-time dashboard with pipeline analytics

### Success Metrics (KPIs)
| Metric | Target (Month 3) | Target (Month 6) |
|--------|------------------|------------------|
| Jobs collected/day | 500+ | 2,000+ |
| Match precision@10 | >85% | >90% |
| Applications submitted/week | 50+ | 200+ |
| Interview conversion rate | >15% | >25% |
| Time saved per user/week | 10+ hrs | 15+ hrs |
| Duplicate detection rate | >95% | >98% |

---

## 5. High-Level Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Sources    │────▶│  Collector  │────▶│ Normalizer  │────▶│  Database   │
│ (Web, API,  │     │  (n8n/      │     │  (AI Agent) │     │ (PostgreSQL │
│  Email, IM) │     │  Playwright)│     │             │     │  + pgvector)│
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                    ┌─────────────┐     ┌─────────────┐     ┌───────▼──────┐
                    │ Application │◀───│   Tailored  │◀───│  AI Matcher  │
                    │    Agent    │     │  Documents  │     │  (Agents)    │
                    │(Playwright) │     │ (CV/CL Gen) │     │              │
                    └──────┬──────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────▼──────┐     ┌─────────────┐
                    │   Email     │────▶│  Dashboard  │
                    │  Monitor    │     │  (React)    │
                    │  (Gmail API)│     │             │
                    └─────────────┘     └─────────────┘
```

---

## 6. Core AI Agents (10 Specialized Agents)

| # | Agent | Responsibility | Input | Output |
|---|-------|----------------|-------|--------|
| 1 | **Job Discovery** | Crawl/scrape job sources | Source configs, keywords | Raw job listings |
| 2 | **Parsing & Normalization** | Extract structured data from HTML/text | Raw listings | Normalized Job objects |
| 3 | **Deduplication** | Identify duplicate postings across sources | Normalized jobs | Deduplicated job set |
| 4 | **CV Knowledge** | Chunk, embed, index CV into vector store | User CV (PDF/DOCX) | Searchable knowledge base |
| 5 | **Job Matching** | Semantic + keyword scoring against profile | Job + User profile | Match score (0-100), reasoning |
| 6 | **CV Tailoring** | Rewrite CV bullets for job requirements | Base CV + Job description | Tailored CV (LaTeX/PDF) |
| 7 | **Cover Letter** | Generate personalized cover letter | Tailored CV + Job + Profile | Cover letter (PDF) |
| 8 | **Application** | Fill and submit application forms | Tailored docs + Job URL | Submission confirmation |
| 9 | **Email Monitor** | Classify emails, extract status updates | Gmail/IMAP feed | Application status events |
| 10 | **Analytics** | Compute pipeline metrics, insights | All application data | Dashboard data, reports |

---

## 7. Core Workflows

### 7.1 Daily Automated Pipeline (Scheduled: 6:00 AM Local)
```
1. COLLECT: Trigger all source collectors in parallel
2. NORMALIZE: Parse → Validate → Enrich (company data, salary estimates)
3. DEDUP: Cross-source deduplication (fuzzy title+company+location)
4. SCORE: Run Job Matching Agent for all new jobs
5. RANK: Sort by composite score (match × recency × salary fit)
6. GENERATE: For top N (configurable, default 10):
   - CV Tailoring Agent → Tailored CV
   - Cover Letter Agent → Cover Letter
7. APPLY: For auto-apply eligible jobs (ATS APIs + configured portals)
8. MONITOR: Poll email for new responses, classify, update status
9. NOTIFY: Push high-priority items to user (Slack/Email/Telegram)
10. SYNC: Update dashboard metrics
```

### 7.2 On-Demand Workflows
- **Manual Job Import:** User pastes URL → Instant parse + score + generate docs
- **CV Update:** User uploads new CV → Re-index knowledge base → Re-score all saved jobs
- **Interview Prep:** User selects job → Agent generates Q&A prep guide

---

## 8. Data Model (Database Schema)

### 8.1 Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    password_hash VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Profiles (Extended)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- Professional Summary
    headline VARCHAR(500),
    summary TEXT,
    years_experience INT,
    -- Skills (JSONB for flexibility)
    technical_skills JSONB DEFAULT '[]',      -- [{"name": "Python", "level": "expert", "years": 5}]
    soft_skills JSONB DEFAULT '[]',
    certifications JSONB DEFAULT '[]',
    -- Preferences
    preferred_roles JSONB DEFAULT '[]',       -- [{"title": "Senior Engineer", "weight": 1.0}]
    preferred_locations JSONB DEFAULT '[]',   -- [{"city": "San Francisco", "remote_ok": true, "weight": 1.0}]
    salary_min INT,
    salary_max INT,
    currency VARCHAR(3) DEFAULT 'USD',
    employment_types JSONB DEFAULT '["full-time"]', -- full-time, contract, freelance
    visa_status VARCHAR(50),
    notice_period_weeks INT,
    -- CV Reference
    cv_file_id UUID,
    cv_version INT DEFAULT 1,
    cv_last_indexed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Listings
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Source Info
    source VARCHAR(50) NOT NULL,              -- linkedin, indeed, telegram, email, company_site
    source_id VARCHAR(255),                   -- External ID from source
    source_url TEXT,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    -- Job Details
    company VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT FALSE,
    employment_type VARCHAR(50),              -- full-time, contract, internship
    experience_level VARCHAR(50),             -- entry, mid, senior, lead, executive
    salary_min INT,
    salary_max INT,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    requirements TEXT,
    benefits TEXT,
    -- Metadata
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    tags JSONB DEFAULT '[]',                  -- ["python", "aws", "react"]
    -- AI Enrichment
    company_size VARCHAR(50),                 -- startup, smb, enterprise
    company_industry VARCHAR(100),
    tech_stack JSONB DEFAULT '[]',
    -- Status
    status VARCHAR(30) DEFAULT 'new',         -- new, scored, applied, interviewing, rejected, offered
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of UUID REFERENCES jobs(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Matching Scores
CREATE TABLE job_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    overall_score DECIMAL(5,2),               -- 0-100
    skill_match DECIMAL(5,2),
    experience_match DECIMAL(5,2),
    location_match DECIMAL(5,2),
    salary_match DECIMAL(5,2),
    culture_match DECIMAL(5,2),
    reasoning TEXT,                           -- LLM explanation
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, user_id)
);

-- Applications
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    -- Documents
    cv_version INT,
    tailored_cv_url TEXT,                     -- S3/R2 path
    cover_letter_url TEXT,
    tailored_cv_content TEXT,                 -- Stored for analytics
    cover_letter_content TEXT,
    -- Submission
    status VARCHAR(30) DEFAULT 'draft',       -- draft, submitted, acknowledged, interviewing, rejected, offered, withdrawn
    applied_at TIMESTAMPTZ,
    submitted_via VARCHAR(50),                -- auto, manual, email, portal, api
    external_application_id VARCHAR(255),     -- ATS tracking ID
    -- Tracking
    interview_stages JSONB DEFAULT '[]',      -- [{"stage": "phone", "date": "...", "status": "passed"}]
    last_contact_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Monitoring
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    message_id VARCHAR(255) UNIQUE,           -- Gmail message ID
    thread_id VARCHAR(255),
    sender_email VARCHAR(255),
    sender_name VARCHAR(255),
    recipient_email VARCHAR(255),
    subject VARCHAR(500),
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ,
    -- Classification
    category VARCHAR(50),                     -- application_confirmation, interview_invite, rejection, offer, follow_up, spam
    confidence DECIMAL(3,2),
    extracted_data JSONB,                     -- Structured data (date, time, link, etc.)
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Source Configurations
CREATE TABLE source_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,         -- rss, api, playwright, email, telegram, whatsapp
    name VARCHAR(255),
    config JSONB NOT NULL,                    -- Source-specific config
    is_active BOOLEAN DEFAULT TRUE,
    schedule_cron VARCHAR(100),               -- e.g., "0 6 * * *"
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(30),              -- success, partial, failed
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CV Documents & Versions
CREATE TABLE cv_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    version INT NOT NULL,
    original_filename VARCHAR(255),
    file_url TEXT,                            -- S3/R2 path
    file_hash VARCHAR(64),                    -- SHA256 for deduplication
    parsed_content TEXT,                      -- Extracted text
    chunks JSONB,                             -- Vector store chunk references
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, version)
);

-- User Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50),                         -- high_match_job, application_submitted, interview_scheduled, status_change
    title VARCHAR(255),
    message TEXT,
    data JSONB,                               -- Deep link data
    channels JSONB DEFAULT '["in_app"]',      -- in_app, email, slack, telegram
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 8.2 Indexes for Performance

```sql
-- Job search optimization
CREATE INDEX idx_jobs_user_status ON jobs(user_id, status) WHERE user_id IS NOT NULL;
CREATE INDEX idx_jobs_source_collected ON jobs(source, collected_at DESC);
CREATE INDEX idx_jobs_title_company_gin ON jobs USING GIN (to_tsvector('english', title || ' ' || company));
CREATE INDEX idx_jobs_location_remote ON jobs(location, is_remote);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);

-- Scoring
CREATE INDEX idx_job_scores_user_score ON job_scores(user_id, overall_score DESC);
CREATE INDEX idx_job_scores_job_user ON job_scores(job_id, user_id);

-- Applications
CREATE INDEX idx_applications_user_status ON applications(user_id, status);
CREATE INDEX idx_applications_job_user ON applications(job_id, user_id);
CREATE INDEX idx_applications_applied_at ON applications(applied_at DESC);

-- Emails
CREATE INDEX idx_emails_user_received ON emails(user_id, received_at DESC);
CREATE INDEX idx_emails_application ON emails(application_id);
CREATE INDEX idx_emails_thread ON emails(thread_id);

-- Vector similarity (pgvector)
CREATE INDEX idx_cv_chunks_embedding ON cv_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## 9. Integrations & External APIs

| Category | Services | Purpose |
|----------|----------|---------|
| **Workflow Orchestration** | n8n (self-hosted) | Schedule, retry, monitor all pipelines |
| **Database** | PostgreSQL 16 + pgvector | Primary storage, vector similarity search |
| **Vector Search** | pgvector / Pinecone (fallback) | CV semantic search, job matching |
| **LLM** | OpenAI GPT-4o / Anthropic Claude 3.5 | All AI agents (parsing, matching, generation) |
| **Browser Automation** | Playwright (Python/Node) | Scraping, form filling, application submission |
| **Email** | Gmail API / IMAP | Email monitoring, sending applications |
| **Messaging** | Telegram Bot API, WhatsApp Web (via Playwright) | Job source ingestion, notifications |
| **File Storage** | Cloudflare R2 / AWS S3 | CVs, generated documents, exports |
| **Job Board APIs** | Indeed, LinkedIn (partner), Glassdoor, ZipRecruiter | Structured job data where available |
| **ATS Integrations** | Greenhouse, Lever, Workday, BambooHR, Ashby | Programmatic application submission |
| **Company Enrichment** | Clearbit, Apollo, Hunter.io | Company size, industry, tech stack |
| **Monitoring** | Sentry, PostHog, Grafana | Error tracking, analytics, infrastructure |

---

## 10. API Specification (Internal REST API)

### 10.1 Jobs
```
GET    /api/v1/jobs                    # List jobs with filters, pagination
GET    /api/v1/jobs/:id                # Get job details + score
POST   /api/v1/jobs/import             # Manual URL import
POST   /api/v1/jobs/:id/score          # Trigger re-scoring
GET    /api/v1/jobs/:id/similar        # Find similar jobs
POST   /api/v1/jobs/bulk-score         # Bulk score jobs
```

### 10.2 Applications
```
GET    /api/v1/applications            # List user applications
GET    /api/v1/applications/:id        # Get application + documents
POST   /api/v1/applications            # Create application (manual)
POST   /api/v1/applications/:id/submit # Submit application
PATCH  /api/v1/applications/:id        # Update status, notes
POST   /api/v1/applications/:id/documents # Regenerate documents
GET    /api/v1/applications/:id/timeline # Interview timeline
```

### 10.3 Profile & CV
```
GET    /api/v1/profile                 # Get user profile
PATCH  /api/v1/profile                 # Update profile
POST   /api/v1/profile/cv              # Upload CV (multipart)
GET    /api/v1/profile/cv/versions     # List CV versions
POST   /api/v1/profile/cv/reindex      # Re-index knowledge base
```

### 10.4 Sources
```
GET    /api/v1/sources                 # List configured sources
POST   /api/v1/sources                 # Add source config
PATCH  /api/v1/sources/:id             # Update source
DELETE /api/v1/sources/:id             # Remove source
POST   /api/v1/sources/:id/test        # Test source connection
POST   /api/v1/sources/:id/run         # Manual trigger
```

### 10.5 Analytics
```
GET    /api/v1/analytics/dashboard     # Dashboard summary
GET    /api/v1/analytics/pipeline      # Funnel metrics
GET    /api/v1/analytics/matches       # Match quality over time
GET    /api/v1/analytics/sources       # Source performance
GET    /api/v1/analytics/export        # CSV/PDF export
```

### 10.6 Notifications
```
GET    /api/v1/notifications           # List notifications
PATCH  /api/v1/notifications/:id/read  # Mark as read
GET    /api/v1/notifications/preferences # Notification settings
PATCH  /api/v1/notifications/preferences # Update settings
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-4) ✅ **Core Infrastructure**
| Task | Description | Deliverable |
|------|-------------|-------------|
| 1.1 | Project setup: Monorepo (Nx/Turborepo), TypeScript, ESLint, Prettier | Repo with CI/CD |
| 1.2 | PostgreSQL + pgvector setup, migrations, seed data | Running DB |
| 1.3 | n8n self-hosted deployment (Docker Compose/K8s) | Orchestration ready |
| 1.4 | User auth: JWT, refresh tokens, password reset | Auth API |
| 1.5 | Basic React dashboard (Vite + TanStack Query + Tailwind) | Dashboard shell |
| 1.6 | Job collector framework (base classes for each source type) | Extensible collectors |
| 1.7 | Implement 3 collectors: RSS/JSON API, Playwright generic, Email IMAP | Working ingestion |
| 1.8 | Normalizer agent (LLM-based extraction → structured JSON) | Clean job data |
| 1.9 | Deduplication agent (fuzzy matching + embedding similarity) | <5% duplicate rate |
| 1.10 | Jobs API + Dashboard: list, filter, search, detail view | Job browser |

### Phase 2: Intelligence (Weeks 5-8) 🧠 **AI Matching & CV**
| Task | Description | Deliverable |
|------|-------------|-------------|
| 2.1 | CV upload: PDF/DOCX parsing, chunking, embedding (text-embedding-3-large) | Indexed CV |
| 2.2 | CV Knowledge Agent: Semantic search over user experience | Queryable KB |
| 2.3 | Job Matching Agent: Multi-factor scoring (skills, exp, location, salary, culture) | Scored jobs |
| 2.4 | Scoring explainability: LLM-generated reasoning for each score | Transparent matches |
| 2.5 | Profile management UI: Skills, preferences, locations, salary | Profile editor |
| 2.6 | Job scoring dashboard: Sort, filter by score, view reasoning | Ranked job list |
| 2.7 | Source performance analytics: Success rate, latency, duplicates | Source dashboard |

### Phase 3: Generation (Weeks 9-12) 📝 **Tailored Documents**
| Task | Description | Deliverable |
|------|-------------|-------------|
| 3.1 | CV Tailoring Agent: Rewrite bullets using STAR method for job reqs | Tailored CV (LaTeX) |
| 3.2 | Cover Letter Agent: Personalized narrative connecting experience to role | Cover letter (PDF) |
| 3.3 | Document preview UI: Side-by-side original vs tailored | Review interface |
| 3.4 | Template system: Multiple CV/CL templates (modern, classic, minimal) | Template selector |
| 3.5 | ATS-friendly formatting: Keyword optimization, standard sections | Compliant output |
| 3.6 | Bulk generation: Queue top N jobs, parallel generation | Batch processor |
| 3.7 | Version control: Track CV versions, diff view, rollback | CV history |

### Phase 4: Application (Weeks 13-18) 🤖 **Auto-Apply & Browser Automation**
| Task | Description | Deliverable |
|------|-------------|-------------|
| 4.1 | Application Agent framework: Playwright-based form interaction | Agent skeleton |
| 4.2 | ATS API integrations: Greenhouse, Lever, Workday, Ashby (OAuth) | API submitters |
| 4.3 | Portal automation: LinkedIn Easy Apply, Indeed, company career sites | Portal submitters |
| 4.4 | Form field mapping: Heuristic + LLM-based field detection | Smart filler |
| 4.5 | Anti-detection: Human-like delays, mouse movements, fingerprint rotation | Stealth mode |
| 4.6 | Submission verification: Confirmation detection, screenshot capture | Proof of submission |
| 4.7 | Rate limiting & quotas: Per-site limits, daily caps, backoff | Safe automation |
| 4.8 | Application dashboard: Status tracking, timeline, documents | Application manager |

### Phase 5: Monitoring & Analytics (Weeks 19-22) 📊 **Email & Insights**
| Task | Description | Deliverable |
|------|-------------|-------------|
| 5.1 | Gmail API integration: OAuth, push notifications, history sync | Email sync |
| 5.2 | Email Classification Agent: LLM classifier for response types | Auto-categorization |
| 5.3 | Status extraction: Parse interview dates, links, next steps from emails | Structured events |
| 5.4 | Application status sync: Auto-update from email confirmations | Live status |
| 5.5 | Analytics dashboard: Funnel, source ROI, match quality trends | Business metrics |
| 5.6 | Notification system: In-app, email, Slack, Telegram for key events | Alerting |
| 5.7 | Weekly digest email: Top matches, applications sent, responses | Summary report |

### Phase 6: Polish & Scale (Weeks 23-26) 🚀 **Production Hardening**
| Task | Description | Deliverable |
|------|-------------|-------------|
| 6.1 | Multi-user support: Organizations, teams, shared sources | SaaS ready |
| 6.2 | Rate limit management: Distributed locks, quota enforcement | Scale safety |
| 6.3 | Comprehensive testing: E2E (Playwright), unit, integration, load | Test suite |
| 6.4 | Observability: Distributed tracing (Jaeger), metrics (Prometheus), logs | Full observability |
| 6.5 | Security audit: OWASP, secrets scanning, pen test | Security cert |
| 6.6 | Documentation: API docs, user guide, admin guide | Complete docs |
| 6.7 | Launch preparation: Landing page, pricing, onboarding flow | Go-to-market |

---

## 12. Technical Requirements Summary

### 12.1 Non-Functional Requirements

| Requirement | Specification |
|-------------|---------------|
| **Availability** | 99.9% uptime (daily pipeline), 99.5% API |
| **Latency** | API p95 < 500ms, Dashboard load < 2s |
| **Throughput** | 10,000 jobs/day ingestion, 1,000 applications/day |
| **Scalability** | Horizontal: n8n workers, API replicas, Playwright pool |
| **Data Retention** | Jobs: 2 years, Applications: 7 years, Emails: 1 year |
| **Privacy** | GDPR/CCPA compliant, user data export/deletion, encryption at rest |
| **Security** | SOC2 Type II ready, secrets in Vault, mTLS between services |
| **Observability** | 100% request tracing, <1min alerting on pipeline failures |

### 12.2 Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Language (Backend)** | TypeScript (Node.js) | 20.x LTS |
| **Language (AI Agents)** | Python | 3.11+ |
| **API Framework** | Hono / Fastify | Latest |
| **ORM** | Drizzle ORM | Latest |
| **Database** | PostgreSQL + pgvector | 16 / 0.7+ |
| **Vector Search** | pgvector (primary), Pinecone (fallback) | |
| **Workflow Engine** | n8n (self-hosted) | Latest |
| **Browser Automation** | Playwright (Python) | 1.40+ |
| **LLM Provider** | OpenAI API, Anthropic API | GPT-4o, Claude 3.5 |
| **Frontend** | React 18 + TypeScript + Vite | Latest |
| **State Management** | TanStack Query + Zustand | Latest |
| **UI Components** | Radix UI + Tailwind CSS | Latest |
| **Forms** | React Hook Form + Zod | Latest |
| **Charts** | Recharts / Tremor | Latest |
| **File Storage** | Cloudflare R2 (S3-compatible) | |
| **Auth** | JWT + bcrypt, OAuth 2.0 providers | |
| **Monitoring** | Sentry, PostHog, Grafana, Prometheus | |
| **Deployment** | Docker + Kubernetes (EKS/GKE) / Railway / Fly.io | |
| **CI/CD** | GitHub Actions | |

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Site changes break scrapers** | High | High | Modular collector framework, automated testing, monitoring alerts |
| **ATS anti-bot detection** | High | High | Playwright stealth, residential proxies, rate limiting, human-in-loop fallback |
| **LLM hallucination in parsing** | Medium | High | Structured output (JSON schema), validation rules, human review sampling |
| **Email API rate limits** | Medium | Medium | Batch processing, exponential backoff, multiple provider fallbacks |
| **Legal/compliance (scraping)** | Medium | High | Respect robots.txt, ToS review, official APIs where available, legal counsel |
| **Data quality (garbage in)** | Medium | High | Multi-stage validation, confidence scores, user feedback loop |
| **Cost explosion (LLM tokens)** | Medium | Medium | Token budgets per agent, caching, smaller models for classification |
| **User trust (auto-apply errors)** | Low | Critical | Confirmation screenshots, dry-run mode, manual approval gates |

---

## 14. Future Enhancements (Post-MVP)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Interview Preparation Agent** | Generate company-specific Q&A, STAR stories, salary negotiation scripts | High |
| **Salary Benchmarking** | Real-time market data for role/location/experience | High |
| **Resume A/B Testing** | Test multiple CV versions, track response rates | Medium |
| **Recruiter CRM** | Track conversations, follow-ups, relationship mapping | Medium |
| **Mobile App** | React Native companion for notifications, quick actions | Medium |
| **Referral Network** | Leverage LinkedIn connections for warm intros | Low |
| **Skill Gap Analysis** | Identify missing skills for target roles, suggest courses | Low |
| **Video Cover Letters** | AI-generated video introductions (HeyGen/Synthesia) | Low |
| **White-label/Enterprise** | Multi-tenant, SSO, custom workflows, SLA | Low |

---

## 15. Appendix

### 15.1 Glossary
- **ATS:** Applicant Tracking System (Greenhouse, Lever, Workday)
- **RAG:** Retrieval-Augmented Generation
- **STAR:** Situation, Task, Action, Result (interview framework)
- **pgvector:** PostgreSQL extension for vector similarity search
- **n8n:** Workflow automation tool (self-hostable, node-based)

### 15.2 Key Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2024-01 | PostgreSQL + pgvector over Pinecone | Cost, simplicity, ACID, single DB |
| 2024-01 | n8n over Temporal/airflow | Visual debugging, native LLM nodes, community |
| 2024-01 | Playwright over Selenium/Puppeteer | Better stealth, multi-browser, TypeScript/Python |
| 2024-01 | TypeScript monorepo | Shared types, single CI, easier refactoring |

---

*Document Version: 2.0 | Last Updated: 2024 | Author: AI Job Automation Team*