# Technical Requirements Document (TRD)
## AI-Powered Job Application Automation Platform

---

## 1. System Overview

### 1.1 Purpose
This document defines the technical specifications, architecture decisions, and implementation requirements for the AI Job Automation Platform.

### 1.2 Scope
- **In Scope:** Job collection pipeline, AI matching agents, document generation, application automation, email monitoring, dashboard
- **Out of Scope:** Mobile app (Phase 6+), Interview prep agent (Post-MVP), Enterprise SSO (Phase 6)

### 1.3 System Context
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL SYSTEMS                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Job      │ │ Email    │ │ Messaging│ │ ATS      │ │ LLM      │          │
│  │ Boards   │ │ (Gmail)  │ │ (TG/WA)  │ │ APIs     │ │ Providers│          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
└───────┼─────────────┼────────────┼────────────┼────────────┼────────────────┘
        │             │            │            │            │
        ▼             ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PLATFORM BOUNDARY                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    n8n WORKFLOW ORCHESTRATOR                         │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │Collect  │ │Normalize│ │ Dedupe  │ │ Score   │ │ Generate│       │   │
│  │  │Workflow │ │Workflow │ │Workflow │ │Workflow │ │Workflow │       │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘       │   │
│  └───────┼───────────┼───────────┼───────────┼───────────┼─────────────┘   │
│          │           │           │           │           │                 │
│          ▼           ▼           ▼           ▼           ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      POSTGRESQL + PGVECTOR                           │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │  │
│  │  │ Users  │ │ Jobs   │ │ Scores │ │ Apps   │ │ Emails │ │ CVs    │  │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│          │           │           │           │           │                 │
│          ▼           ▼           ▼           ▼           ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                      BACKEND API (Hono/Fastify)                      │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │  │
│  │  │ Auth    │ │ Jobs    │ │ Apps    │ │ Profile │ │Analytics│       │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                 │                                          │
└─────────────────────────────────┼──────────────────────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │Dashboard│ │Jobs     │ │Applications│ │Profile  │ │Settings │               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Functional Requirements

### 2.1 Job Collection Pipeline (FR-JC)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-JC-01 | Support multiple source types | P0 | RSS, REST API, GraphQL, Playwright scraper, IMAP, Telegram Bot, WhatsApp Web |
| FR-JC-02 | Configurable scheduling per source | P0 | Cron expressions, timezone-aware, manual trigger |
| FR-JC-03 | Incremental collection | P0 | Only fetch new/updated since last run |
| FR-JC-04 | Rate limiting per source | P0 | Configurable requests/minute, backoff on 429 |
| FR-JC-05 | Error handling & retries | P0 | Exponential backoff (max 3), dead letter queue for persistent failures |
| FR-JC-06 | Source health monitoring | P1 | Success rate, latency, last run status, alerting on degradation |
| FR-JC-07 | Raw response archival | P1 | Store original HTML/JSON for debugging/reprocessing |

### 2.2 Normalization & Enrichment (FR-NE)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-NE-01 | LLM-based structured extraction | P0 | JSON schema validation, confidence scores |
| FR-NE-02 | Standard field mapping | P0 | title, company, location, salary, description, requirements, benefits, type, level |
| FR-NE-03 | Company enrichment | P1 | Size, industry, tech stack via Clearbit/Apollo |
| FR-NE-04 | Salary parsing & normalization | P1 | Handle ranges, currencies, periods → annual USD equivalent |
| FR-NE-05 | Location normalization | P1 | City/state/country, remote detection, timezone |
| FR-NE-06 | Skill/tech stack extraction | P1 | From description + requirements → standardized tags |
| FR-NE-07 | Data quality validation | P0 | Required fields, format checks, anomaly detection |

### 2.3 Deduplication (FR-DD)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-DD-01 | Exact match dedup | P0 | Same source_id + source |
| FR-DD-02 | Fuzzy match dedup | P0 | Title + company + location (Levenshtein < 0.3) |
| FR-DD-03 | Embedding similarity dedup | P1 | Cosine similarity > 0.92 on description embeddings |
| FR-DD-04 | Cross-source merging | P1 | Merge fields, keep earliest posted_at, track all source URLs |
| FR-DD-05 | User-configurable thresholds | P2 | Per-user similarity sensitivity |

### 2.4 CV Knowledge Base (FR-CV)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-CV-01 | Multi-format parsing | P0 | PDF (pdf-parse), DOCX (mammoth), TXT |
| FR-CV-02 | Semantic chunking | P0 | Section-aware (experience, skills, education, projects), 512 tokens, 50 overlap |
| FR-CV-03 | Embedding generation | P0 | text-embedding-3-small (1536 dim, matches `cv_chunks.embedding`); Gemini 1536 fallback |
| FR-CV-04 | Vector storage & search | P0 | pgvector HNSW index, cosine similarity, metadata filtering |
| FR-CV-05 | Version management | P1 | Multiple CV versions, active version flag, diff view |
| FR-CV-06 | Incremental re-indexing | P1 | Only re-embed changed chunks on CV update |

### 2.5 Job Matching & Scoring (FR-JM)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-JM-01 | Multi-factor scoring | P0 | Skills (40%), Experience (25%), Location (15%), Salary (10%), Culture (10%) |
| FR-JM-02 | Skill matching algorithm | P0 | Exact + semantic (embedding) + ontology (related skills) |
| FR-JM-03 | Experience level matching | P0 | Years, seniority keywords, project complexity |
| FR-JM-04 | Location preference scoring | P0 | Exact > metro area > country > remote > relocation |
| FR-JM-05 | Salary fit scoring | P1 | Overlap between user range and job range |
| FR-JM-06 | Explainable scoring | P0 | LLM-generated natural language reasoning per factor |
| FR-JM-07 | Batch scoring | P0 | Process 1000+ jobs in < 5 minutes |
| FR-JM-08 | Score persistence & history | P1 | Track score changes over time, re-score on profile update |

### 2.6 Document Generation (FR-DG)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-DG-01 | Tailored CV generation | P0 | STAR method bullets, keyword injection, section reordering |
| FR-DG-02 | Cover letter generation | P0 | Narrative format, company research, role-specific motivation |
| FR-DG-03 | Multiple templates | P1 | Modern, Classic, Minimal, Creative (LaTeX → PDF) |
| FR-DG-04 | ATS optimization | P0 | Standard sections, keyword density, no columns/graphics |
| FR-DG-05 | Preview & diff | P1 | Side-by-side original vs tailored, accept/reject changes |
| FR-DG-06 | Batch generation | P0 | Queue top N jobs, parallel processing, progress tracking |
| FR-DG-07 | Document storage | P0 | Versioned in R2/S3, metadata in DB, signed URLs for access |

### 2.7 Application Automation (FR-AA)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-AA-01 | ATS API submissions | P0 | Greenhouse, Lever, Workday, Ashby, BambooHR (OAuth + API) |
| FR-AA-02 | Portal automation | P0 | LinkedIn Easy Apply, Indeed Apply, company career sites |
| FR-AA-03 | Form field detection | P0 | Heuristic (label, id, name, aria) + LLM fallback |
| FR-AA-04 | File upload handling | P0 | CV + CL + portfolio + custom questions |
| FR-AA-05 | Anti-detection measures | P1 | Stealth plugins, human-like delays, fingerprint rotation |
| FR-AA-06 | Submission verification | P0 | Confirmation page detection, screenshot, email confirmation |
| FR-AA-07 | Rate limiting & quotas | P0 | Per-site daily limits, configurable, backoff on errors |
| FR-AA-08 | Manual approval gate | P1 | User review before submit for high-value applications |

### 2.8 Email Monitoring (FR-EM)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-EM-01 | Gmail API integration | P0 | OAuth2, push notifications (watch), history sync |
| FR-EM-02 | IMAP fallback | P1 | For non-Gmail providers |
| FR-EM-03 | Classification model | P0 | 7 categories: confirmation, interview_invite, rejection, offer, follow_up, spam, other |
| FR-EM-04 | Entity extraction | P0 | Dates, times, links, contact names, next steps |
| FR-EM-05 | Application linking | P0 | Match to application via thread_id, company, position |
| FR-EM-06 | Status auto-update | P0 | Update application status based on email classification |
| FR-EM-07 | Notification triggers | P1 | Real-time alerts for interviews, offers |

### 2.9 Dashboard & Analytics (FR-DA)

| ID | Requirement | Priority | Details |
|----|-------------|----------|---------|
| FR-DA-01 | Real-time job feed | P0 | Infinite scroll, filters, sort, score badges |
| FR-DA-02 | Application pipeline | P0 | Kanban board: Applied → Screening → Interview → Offer |
| FR-DA-03 | Metrics dashboard | P0 | Funnel, source performance, match quality trends |
| FR-DA-04 | Profile completeness | P1 | Guided setup, missing field indicators |
| FR-DA-05 | Export capabilities | P2 | CSV, PDF reports |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| API p95 latency | < 500ms | /api/v1/jobs, /api/v1/applications |
| Dashboard load | < 2s | First Contentful Paint |
| Job ingestion rate | 10,000/day | End-to-end pipeline |
| Batch scoring | 1,000 jobs < 5 min | Nightly job |
| Document generation | < 30s per job | CV + Cover Letter |
| Application submission | < 60s per application | Including verification |

### 3.2 Scalability

| Dimension | Target | Approach |
|-----------|--------|----------|
| Concurrent users | 1,000 | Horizontal API scaling, read replicas |
| Jobs in database | 1M+ | Partitioning by collected_at, pgvector HNSW |
| Daily applications | 5,000 | Queue-based (n8n + BullMQ), Playwright pool |
| Vector searches | 100 QPS | pgvector IVFFlat → HNSW, connection pooling |

### 3.3 Reliability

| Requirement | Specification |
|-------------|---------------|
| Uptime | 99.9% (pipeline), 99.5% (API) |
| Data durability | PostgreSQL WAL + daily R2 backups, 7-year retention |
| Failure recovery | n8n automatic retry (3x), manual replay, dead letter inspection |
| Disaster recovery | RPO < 1 hour, RTO < 4 hours, cross-region DB replica |

### 3.4 Security

| Control | Implementation |
|---------|----------------|
| Authentication | JWT (RS256), 15min access + 7d refresh, rotation |
| Authorization | Row-level security (PostgreSQL RLS), API scope-based |
| Secrets | HashiCorp Vault / AWS Secrets Manager, no plaintext in env |
| Encryption | TLS 1.3 in transit, AES-256 at rest (R2, DB) |
| PII Handling | Minimal collection, user-controlled deletion, GDPR Art. 20 export |
| Audit Logging | All mutating operations, immutable log (CloudWatch/Loki) |
| Rate Limiting | Per-user, per-endpoint, adaptive (Token Bucket) |
| Vulnerability Management | Dependabot, Trivy scans, monthly penetration test |

### 3.5 Observability

| Pillar | Tools | Coverage |
|--------|-------|----------|
| Metrics | Prometheus + Grafana | RED metrics (Rate, Errors, Duration) for all services |
| Logs | Loki + Grafana | Structured JSON, correlation IDs, 30-day retention |
| Traces | Jaeger | Distributed tracing across n8n → API → DB → LLM |
| Alerting | Alertmanager + PagerDuty | P1: < 5min, P2: < 30min, P3: < 4hr |
| Synthetic Monitoring | Checkly | Critical user journeys every 5min |

---

## 4. Data Architecture

### 4.1 Database Schema (PostgreSQL 16 + pgvector)

See PRD Section 8 for complete DDL. Key design decisions:

- **UUIDv7** for all primary keys (time-ordered, index-friendly)
- **JSONB** for flexible arrays (skills, preferences, tags) with GIN indexes
- **Partitioning** on `jobs` by `collected_at` (monthly)
- **Row Level Security** on all user-scoped tables
- **pgvector** HNSW index for embedding similarity (m=16, ef_construction=64)

### 4.2 Vector Store Strategy

| Use Case | Embedding Model | Dimensions | Index Type | Query Pattern |
|----------|----------------|------------|------------|---------------|
| CV Chunks | text-embedding-3-small (Gemini 1536 fallback) | **1536** (schema) | HNSW | Top-k cosine; ILIKE if no vectors |
| Job Descriptions | (not shipped — heuristic dedup) | 1536 reserved | HNSW | Deduplication, similar jobs |
| Skill Ontology | (not shipped) | 1536 | IVFFlat | Skill expansion, related terms |

### 4.3 Data Flow Patterns

```
COLLECTION:     Source → n8n → Raw Storage → Normalizer → Validated → DB
SCORING:        New Jobs → Batch Queue → Matching Agent → Scores → DB
GENERATION:     Top Jobs → Doc Queue → Tailor Agent → PDFs → R2 + DB
APPLICATION:    Approved → Apply Queue → Browser/API → Confirmation → DB
EMAIL:          Gmail Push → Classifier → Extractor → Events → DB
```

---

## 5. API Specification

### 5.1 Design Principles
- **RESTful** with consistent resource naming
- **OpenAPI 3.1** specification (auto-generated from code)
- **Cursor-based pagination** for lists
- **Optimistic locking** via `If-Match` ETag headers
- **Problem Details (RFC 7807)** for errors

### 5.2 Authentication
```
Authorization: Bearer <jwt_access_token>
```
- Short-lived access tokens (15 min)
- Refresh token rotation (7 days, single-use)
- Device fingerprinting for anomaly detection

### 5.3 Rate Limits
| Tier | Requests/min | Burst |
|------|-------------|-------|
| Free | 60 | 10 |
| Pro | 300 | 50 |
| Enterprise | 1000 | 200 |

### 5.4 Key Endpoints (Summary)
Full spec in PRD Section 10. All endpoints return:
```json
{
  "data": {},
  "meta": { "cursor": "", "total": 0 },
  "links": { "next": "", "prev": "" }
}
```

---

## 6. Infrastructure Architecture

### 6.1 Deployment Topology (Kubernetes)

```yaml
# High-level K8s resources
namespace: job-automation
---
# Stateful
Deployment: postgresql (1 primary + 1 replica, Patroni)
StatefulSet: pgvector (same)
Deployment: n8n (3 replicas, queue mode)
Deployment: redis (cluster mode, 3 shards)
Deployment: minio/r2-gateway (for local dev)
---
# Stateless (HPA: CPU>70%, custom queue depth)
Deployment: api-gateway (Hono, 3-20 replicas)
Deployment: worker-python (Playwright, 2-15 replicas)
Deployment: worker-node (n8n workers, 3-10 replicas)
Deployment: frontend (nginx + React, 3-10 replicas)
---
# Observability
Deployment: prometheus, grafana, loki, jaeger, alertmanager
```

### 6.2 Network Policies
- **Ingress:** Cloudflare Tunnel → API Gateway (WAF rules)
- **Internal:** Service mesh (Linkerd) for mTLS, traffic splitting
- **Egress:** NAT Gateway for external APIs, allowlists for LLM providers

### 6.3 Storage
| Data | Primary | Backup | Retention |
|------|---------|--------|-----------|
| PostgreSQL | AWS RDS / CloudSQL | Point-in-time + daily snapshot | 7 years |
| Vector Index | pgvector (same DB) | Included in DB backup | 7 years |
| Documents (PDF, CV) | Cloudflare R2 | Cross-region replication | 7 years |
| n8n Workflow DB | SQLite (embedded) | Daily dump to R2 | 1 year |
| Logs | Loki (S3 backend) | N/A | 30 days |
| Traces | Jaeger (Cassandra) | N/A | 7 days |

### 6.4 CI/CD Pipeline
```yaml
# GitHub Actions
stages:
  - lint: biome, tsc --noEmit, pytest --co
  - test: unit, integration (testcontainers), e2e (playwright)
  - build: docker multi-arch (amd64/arm64), sbom, sign
  - scan: trivy, grype, dependabot
  - deploy-staging: auto on main, k8s apply (kustomize)
  - deploy-prod: manual approval, blue/green, smoke tests
  - notify: slack, release notes
```

---

## 7. AI Agent Technical Specifications

### 7.1 Agent Framework
- **Language:** Python 3.11+ (for LLM ecosystem)
- **Orchestration:** n8n custom nodes + direct Python execution
- **LLM Interface:** Unified wrapper (`workers/lib/llm.py`) — OpenAI, xAI Grok (`QROK_API_KEY`), Google Gemini, Cerebras. **No Anthropic.**
- **Structured Output:** Pydantic models + Instructor for validation
- **Prompt Management:** Versioned in DB, A/B testable, fallback prompts

### 7.2 Agent Specifications

#### Job Discovery Agent
```python
# Input: SourceConfig
# Output: List[RawJobListing]
# Model: gpt-4o-mini (classification), Playwright (scraping)
# Tools: HTTP client, Playwright, RSS parser, selectors config
```

#### Normalization Agent
```python
# Input: RawJobListing (HTML/JSON/text)
# Output: NormalizedJob (validated against JSON Schema)
# Model: gpt-4o (structured output)
# Schema: 25+ fields, enums for type/level, confidence per field
```

#### Matching Agent
```python
# Input: Job + UserProfile + CVChunks (top-k)
# Output: MatchScore (overall + breakdown + reasoning)
# Model: claude-3-5-sonnet (reasoning)
# Algorithm: Hybrid (keyword + semantic + heuristic)
```

#### CV Tailoring Agent
```python
# Input: BaseCV (sections) + JobDescription + TargetKeywords
# Output: TailoredCV (LaTeX source + PDF bytes)
# Model: gpt-4o (creative writing)
# Constraints: Preserve truthfulness, ATS-safe, max 2 pages
```

### 7.3 Prompt Engineering Standards
- **System Prompts:** Role, constraints, output format, examples (few-shot)
- **Temperature:** 0.1 (extraction), 0.3 (matching), 0.7 (generation)
- **Token Budgets:** Defined per agent, enforced via middleware
- **Caching:** Semantic cache (GPTCache) for repeated queries
- **Evaluation:** Golden set (100 cases) per agent, regression testing

---

## 8. Integration Specifications

### 8.1 n8n Workflow Nodes (Custom)
| Node | Purpose | Key Parameters |
|------|---------|----------------|
| `jobCollector` | Generic source collector | sourceConfig, rateLimit, pagination |
| `llmExtractor` | Structured extraction | schema, model, temperature, examples |
| `vectorSearch` | pgvector similarity | query, table, topK, filter |
| `documentGenerator` | CV/CL generation | template, data, format |
| `browserAutomation` | Playwright wrapper | script, stealth, proxy |
| `emailClassifier` | Email categorization | categories, fewShotExamples |

### 8.2 External API Contracts

#### Greenhouse API
```
POST /harvest/applications
Headers: Authorization: Basic <base64(api_key:)>
Body: { first_name, last_name, email, phone, resume, cover_letter, ... }
Response: { id, status, created_at }
```

#### Gmail API
```
POST /users/me/watch
Body: { topicName: "projects/x/topics/gmail-push", labelIds: ["INBOX"] }
Push: { messageId, historyId } → Pub/Sub → n8n webhook
```

---

## 9. Testing Requirements

### 9.1 Test Pyramid
| Level | Target | Tools | Coverage |
|-------|--------|-------|----------|
| Unit | 80% | Vitest (TS), pytest (Py) | Pure functions, utilities |
| Integration | 60% | Testcontainers (PG, Redis), MSW | API routes, DB operations, n8n nodes |
| Contract | 100% | Pact / Schemathesis | OpenAPI compliance |
| E2E | Critical paths | Playwright (TS + Py) | User journeys: signup → job → apply |
| Load | Pre-release | k6 | 1000 VU, 10min soak |
| Chaos | Quarterly | LitmusChaos | Pod kill, network partition, DB failover |

### 9.2 AI-Specific Testing
- **Golden Sets:** 100 labeled examples per agent (input → expected output)
- **Regression:** Run golden set on every model/prompt change
- **A/B Testing:** Shadow mode for new prompts (10% traffic)
- **Hallucination Detection:** Consistency checks, fact verification
- **Bias Testing:** Demographic parity in matching scores

---

## 10. Configuration Management

### 10.1 Environment Variables (Secrets in Vault)
```bash
# Database
DATABASE_URL=postgresql://...
PGVECTOR_DSN=postgresql://...

# Auth
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
REFRESH_TOKEN_SECRET=...

# LLM (Phase 12.5 — no Anthropic). Router: workers/lib/llm.py
OPENAI_API_KEY=sk-...
QROK_API_KEY=xai-...
GOOGLE_API_KEY=...
CEREBRAS_API_KEY=...

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=job-automation-docs

# External APIs
GREENHOUSE_API_KEY=...
LEVER_API_KEY=...
CLEARBIT_API_KEY=...

# Orchestration is BullMQ + Celery (HG-10). Do not add n8n.
```

### 10.2 Feature Flags (LaunchDarkly / Unleash)
| Flag | Default | Purpose |
|------|---------|---------|
| `auto_apply_enabled` | false | Global kill switch |
| `new_matching_algorithm` | false | Gradual rollout |
| `cover_letter_v2` | false | Template experiment |
| `playwright_stealth_v2` | false | Anti-detection update |

---

## 11. Migration & Rollout Strategy

### 11.1 Database Migrations
- **Tool:** Drizzle Kit (TypeScript) + pgvector extensions
- **Policy:** Backward-compatible only, no destructive changes without 2-release deprecation
- **Process:** CI runs migration on staging, manual approval for prod

### 11.2 Model/Prompt Deployments
- **Versioning:** Semantic (prompt-v1.2.3) in DB with `is_active` flag
- **Rollout:** Canary (5% → 25% → 100%) with automated metric checks
- **Rollback:** Single-click revert to previous version

---

## 12. Compliance & Legal

| Requirement | Implementation |
|-------------|----------------|
| GDPR Art. 15 (Access) | `/api/v1/user/export` - JSON + PDF |
| GDPR Art. 17 (Deletion) | `/api/v1/user/delete` - Cascade soft delete, 30-day grace |
| GDPR Art. 20 (Portability) | Machine-readable export (JSON) |
| CCPA | Same as GDPR + "Do Not Sell" flag (N/A - no third-party sharing) |
| SOC 2 Type II | Audit trail, encryption, access controls, vendor management |
| ToS Compliance | robots.txt respect, rate limits, official APIs preferred |

---

## 13. Glossary

| Term | Definition |
|------|------------|
| **ATS** | Applicant Tracking System |
| **RAG** | Retrieval-Augmented Generation |
| **HNSW** | Hierarchical Navigable Small World (vector index) |
| **IVFFlat** | Inverted File Flat (vector index) |
| **STAR** | Situation, Task, Action, Result |
| **RLS** | Row Level Security (PostgreSQL) |
| **WAL** | Write-Ahead Log |
| **RPO/RTO** | Recovery Point/Time Objective |

---

*Document Version: 1.0 | Classification: Internal | Owner: Platform Engineering*