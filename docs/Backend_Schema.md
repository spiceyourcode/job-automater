# Backend Database Schema & API Specification
## AI-Powered Job Application Automation Platform

---

## 1. Database Schema (PostgreSQL 16 + pgvector)

### 1.1 Extensions Required
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### 1.2 Core Tables

#### Users & Authentication
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    name VARCHAR(255),
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    -- Auth
    password_hash VARCHAR(255),  -- bcrypt, nullable for OAuth-only users
    -- OAuth
    google_id VARCHAR(255) UNIQUE,
    github_id VARCHAR(255) UNIQUE,
    linkedin_id VARCHAR(255) UNIQUE,
    -- Security
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_github_id ON users(github_id);
```

#### User Sessions (JWT Refresh Tokens)
```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,  -- SHA256 of refresh token
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at) WHERE revoked_at IS NULL;
```

#### User Profiles (Extended)
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Professional Identity
    headline VARCHAR(500),
    summary TEXT,
    years_experience INT,
    current_role VARCHAR(255),
    current_company VARCHAR(255),
    
    -- Skills (JSONB for flexibility)
    technical_skills JSONB DEFAULT '[]'::jsonb,  -- [{"name": "Python", "level": "expert", "years": 5, "category": "backend"}]
    soft_skills JSONB DEFAULT '[]'::jsonb,
    certifications JSONB DEFAULT '[]'::jsonb,    -- [{"name": "AWS SA", "issuer": "Amazon", "date": "2023-01", "url": "..."}]
    
    -- Preferences
    preferred_roles JSONB DEFAULT '[]'::jsonb,           -- [{"title": "Senior Engineer", "weight": 1.0, "aliases": ["Staff", "Lead"]}]
    preferred_locations JSONB DEFAULT '[]'::jsonb,       -- [{"city": "San Francisco", "state": "CA", "country": "US", "remote_ok": true, "weight": 1.0, "timezone": "America/Los_Angeles"}]
    salary_min INT,
    salary_max INT,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    employment_types JSONB DEFAULT '["full-time"]'::jsonb,  -- full-time, contract, freelance, internship
    visa_status VARCHAR(50),                              -- citizen, green_card, h1b, opt, needs_sponsorship
    notice_period_weeks INT,
    willing_to_relocate BOOLEAN DEFAULT FALSE,
    
    -- CV Reference
    cv_file_id UUID,  -- references cv_documents.id
    cv_version INT DEFAULT 1,
    cv_last_indexed_at TIMESTAMPTZ,
    
    -- Settings
    auto_apply_enabled BOOLEAN DEFAULT FALSE,
    max_applications_per_day INT DEFAULT 10,
    min_match_score INT DEFAULT 70,
    preferred_cv_template VARCHAR(50) DEFAULT 'modern',
    preferred_cl_template VARCHAR(50) DEFAULT 'standard',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_user ON profiles(user_id);
```

#### CV Documents & Versions
```sql
CREATE TABLE cv_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    version INT NOT NULL,
    original_filename VARCHAR(255),
    file_url TEXT NOT NULL,           -- R2/S3 presigned URL
    file_hash VARCHAR(64) NOT NULL,   -- SHA256 for deduplication
    file_size INT,
    mime_type VARCHAR(100),
    
    -- Parsed Content
    parsed_text TEXT,
    parsed_sections JSONB,            -- {"experience": [...], "education": [...], "skills": [...], "projects": [...]}
    
    -- Vector Indexing
    chunk_count INT DEFAULT 0,
    last_chunked_at TIMESTAMPTZ,
    embedding_model VARCHAR(50) DEFAULT 'text-embedding-3-large',
    
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, version)
);

CREATE INDEX idx_cv_docs_user ON cv_documents(user_id, is_active);
CREATE INDEX idx_cv_docs_hash ON cv_documents(file_hash);
```

#### CV Chunks (Vector Embeddings)
```sql
CREATE TABLE cv_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cv_document_id UUID REFERENCES cv_documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    token_count INT,
    section_type VARCHAR(50),  -- experience, education, skills, projects, summary
    metadata JSONB DEFAULT '{}'::jsonb,  -- {"company": "Stripe", "role": "Senior Engineer", "dates": "2020-2023"}
    
    -- Vector Embedding (1536 — text-embedding-3-small / Gemini outputDimensionality=1536)
    embedding VECTOR(1536),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(cv_document_id, chunk_index)
);

-- HNSW Index for fast similarity search
CREATE INDEX idx_cv_chunks_embedding ON cv_chunks 
USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_cv_chunks_user ON cv_chunks(user_id);
CREATE INDEX idx_cv_chunks_doc ON cv_chunks(cv_document_id);
```

#### Job Sources Configuration
```sql
CREATE TABLE source_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Source Definition
    source_type VARCHAR(50) NOT NULL,  -- rss, api, playwright, email, telegram, whatsapp, company_careers
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Configuration (JSONB - source-specific)
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    /*
     * RSS: {feed_url, keywords, poll_interval_minutes}
     * API: {base_url, auth: {type, credentials}, endpoints, pagination, field_mapping, rate_limit}
     * Playwright: {start_url, list_selector, detail_selectors, pagination, login_flow}
     * Email: {imap_server, port, username, password, folder, search_criteria, attachment_handling}
     * Telegram: {bot_token, chat_ids, message_filter}
     * Company Careers: {base_url, job_list_path, selectors, pagination}
     */
    
    -- Scheduling
    schedule_cron VARCHAR(100),  -- e.g., "0 6 * * *" for daily at 6 AM
    timezone VARCHAR(50) DEFAULT 'UTC',
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Rate Limiting
    rate_limit_per_minute INT DEFAULT 30,
    rate_limit_per_hour INT DEFAULT 500,
    concurrent_limit INT DEFAULT 3,
    
    -- Filters
    keyword_filters JSONB DEFAULT '[]'::jsonb,  -- include/exclude keywords
    location_filters JSONB DEFAULT '[]'::jsonb,
    company_filters JSONB DEFAULT '[]'::jsonb,
    salary_min INT,
    experience_levels JSONB DEFAULT '[]'::jsonb,
    
    -- Status Tracking
    last_run_at TIMESTAMPTZ,
    last_run_status VARCHAR(30),  -- success, partial, failed
    last_run_jobs_found INT,
    last_run_duration_ms INT,
    last_error TEXT,
    consecutive_failures INT DEFAULT 0,
    total_jobs_collected BIGINT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sources_user ON source_configs(user_id, is_active);
CREATE INDEX idx_sources_next_run ON source_configs(is_active, schedule_cron) WHERE is_active = TRUE;
```

#### Raw Job Collection (Staging)
```sql
CREATE TABLE jobs_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_config_id UUID REFERENCES source_configs(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Raw Data
    source_id VARCHAR(255),           -- External ID from source
    source_url TEXT,
    raw_data JSONB NOT NULL,          -- Full raw response/HTML
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Processing Status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    -- Deduplication
    dedup_hash VARCHAR(64),           -- Hash of normalized title+company+location
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of UUID REFERENCES jobs_raw(id)
);

CREATE INDEX idx_jobs_raw_source ON jobs_raw(source_config_id, processed);
CREATE INDEX idx_jobs_raw_user ON jobs_raw(user_id, collected_at DESC);
CREATE INDEX idx_jobs_raw_dedup ON jobs_raw(dedup_hash) WHERE is_duplicate = FALSE;
```

#### Normalized Jobs (Main Table)
```sql
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL for global/shared jobs
    
    -- Source Info
    source VARCHAR(50) NOT NULL,      -- linkedin, indeed, telegram, email, company_site, etc.
    source_id VARCHAR(255),           -- External ID
    source_url TEXT,
    source_config_id UUID REFERENCES source_configs(id) ON DELETE SET NULL,
    collected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Core Job Data
    company VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT FALSE,
    remote_type VARCHAR(30),          -- fully_remote, hybrid, onsite, remote_ok
    employment_type VARCHAR(50),      -- full-time, part-time, contract, internship, freelance
    experience_level VARCHAR(30),     -- entry, junior, mid, senior, lead, principal, executive
    
    -- Compensation
    salary_min INT,
    salary_max INT,
    salary_currency VARCHAR(3) DEFAULT 'USD',
    salary_period VARCHAR(20) DEFAULT 'yearly',  -- yearly, monthly, hourly
    equity_offered BOOLEAN DEFAULT FALSE,
    bonus_mentioned BOOLEAN DEFAULT FALSE,
    
    -- Description
    description TEXT,
    requirements TEXT,
    responsibilities TEXT,
    benefits TEXT,
    nice_to_have TEXT,
    
    -- Metadata
    posted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    application_deadline TIMESTAMPTZ,
    application_url TEXT,
    application_email VARCHAR(255),
    application_method VARCHAR(30),   -- portal, email, ats_api, linkedin_easy_apply, indeed_apply
    
    -- Tags & Keywords (extracted)
    tags JSONB DEFAULT '[]'::jsonb,                    -- ["python", "aws", "postgresql", "kubernetes"]
    tech_stack JSONB DEFAULT '[]'::jsonb,              -- [{"name": "Python", "category": "language", "required": true}]
    keywords JSONB DEFAULT '[]'::jsonb,                -- Extracted keywords for matching
    
    -- Company Enrichment
    company_size VARCHAR(30),           -- startup, smb, mid_market, enterprise
    company_industry VARCHAR(100),
    company_domain VARCHAR(255),
    company_logo_url TEXT,
    company_description TEXT,
    company_founded_year INT,
    company_employee_count INT,
    company_funding_stage VARCHAR(30),  -- seed, series_a, series_b, series_c, ipo, acquired
    company_tech_stack JSONB DEFAULT '[]'::jsonb,
    
    -- Quality & Status
    quality_score DECIMAL(3,1),         -- 0-100 based on completeness
    completeness_score DECIMAL(3,1),    -- % of fields populated
    status VARCHAR(30) DEFAULT 'new',   -- new, enriched, scored, applied, interviewing, rejected, offered, archived
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of UUID REFERENCES jobs(id),
    
    -- Vector for similarity search
    description_embedding VECTOR(1536),
    requirements_embedding VECTOR(1536),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_jobs_user_status ON jobs(user_id, status) WHERE user_id IS NOT NULL;
CREATE INDEX idx_jobs_source_collected ON jobs(source, collected_at DESC);
CREATE INDEX idx_jobs_title_company_gin ON jobs USING GIN (to_tsvector('english', title || ' ' || company));
CREATE INDEX idx_jobs_location_remote ON jobs(location, is_remote);
CREATE INDEX idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_salary ON jobs(salary_min, salary_max) WHERE salary_min IS NOT NULL;
CREATE INDEX idx_jobs_tags ON jobs USING GIN (tags);
CREATE INDEX idx_jobs_tech_stack ON jobs USING GIN (tech_stack);

-- Vector indexes (HNSW)
CREATE INDEX idx_jobs_desc_embedding ON jobs 
USING hnsw (description_embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64)
WHERE description_embedding IS NOT NULL;

CREATE INDEX idx_jobs_req_embedding ON jobs 
USING hnsw (requirements_embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64)
WHERE requirements_embedding IS NOT NULL;

-- Deduplication
CREATE UNIQUE INDEX idx_jobs_dedup ON jobs(source, source_id) WHERE is_duplicate = FALSE;
```

#### Job Matching Scores
```sql
CREATE TABLE job_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Overall Score (0-100)
    overall_score DECIMAL(5,2) NOT NULL,
    
    -- Component Scores (0-100)
    skill_match DECIMAL(5,2),
    experience_match DECIMAL(5,2),
    location_match DECIMAL(5,2),
    salary_match DECIMAL(5,2),
    culture_match DECIMAL(5,2),
    keyword_match DECIMAL(5,2),
    seniority_match DECIMAL(5,2),
    
    -- Weights Used (for reproducibility)
    weights JSONB NOT NULL,  -- {"skills": 0.35, "experience": 0.25, "location": 0.15, "salary": 0.1, "culture": 0.1, "keywords": 0.05}
    
    -- Detailed Breakdown
    matched_skills JSONB DEFAULT '[]'::jsonb,        -- [{"skill": "Python", "required": true, "user_level": "expert", "match": 1.0}]
    missing_skills JSONB DEFAULT '[]'::jsonb,        -- [{"skill": "Kubernetes", "required": true, "importance": "high"}]
    nice_to_have_skills JSONB DEFAULT '[]'::jsonb,
    
    -- AI Reasoning
    reasoning TEXT,
    confidence DECIMAL(3,2),  -- 0.00-1.00
    
    -- Model Info
    model_used VARCHAR(50) DEFAULT 'gpt-4o',
    prompt_version VARCHAR(20),
    
    scored_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(job_id, user_id)
);

CREATE INDEX idx_scores_user_score ON job_scores(user_id, overall_score DESC);
CREATE INDEX idx_scores_job_user ON job_scores(job_id, user_id);
CREATE INDEX idx_scores_threshold ON job_scores(user_id, overall_score) WHERE overall_score >= 70;
```

#### Applications
```sql
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- Document Versions
    cv_version INT NOT NULL,
    cv_template VARCHAR(50),
    cl_template VARCHAR(50),
    
    -- Generated Documents
    tailored_cv_url TEXT,              -- R2/S3 URL
    tailored_cv_latex TEXT,            -- Source LaTeX
    tailored_cv_pdf_bytes BYTEA,       -- Optional: store PDF blob
    cover_letter_url TEXT,
    cover_letter_text TEXT,
    
    -- Document Metadata
    generation_prompt_version VARCHAR(20),
    generation_model VARCHAR(50),
    generation_duration_ms INT,
    generation_tokens_used INT,
    
    -- Submission
    status VARCHAR(30) DEFAULT 'draft',  -- draft, queued, submitting, submitted, acknowledged, screening, interviewing, rejected, offered, withdrawn, archived
    submitted_via VARCHAR(50),           -- auto_ats, auto_portal, auto_email, manual, referral
    external_application_id VARCHAR(255), -- ATS tracking ID
    submission_response JSONB,           -- Raw response from ATS/portal
    submitted_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    
    -- Tracking
    interview_stages JSONB DEFAULT '[]'::jsonb,
    /*
     * [
     *   {"stage": "phone_screen", "scheduled_at": "2024-01-20T14:00:00Z", "completed_at": "2024-01-20T14:30:00Z", "status": "passed", "interviewers": [{"name": "John", "role": "Engineering Manager"}], "meeting_link": "https://calendly.com/...", "notes": "..."}
     * ]
     */
    last_contact_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,
    followup_count INT DEFAULT 0,
    
    -- Notes & Feedback
    user_notes TEXT,
    recruiter_feedback TEXT,
    rejection_reason VARCHAR(100),
    
    -- Analytics
    view_count INT DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_apps_user_status ON applications(user_id, status);
CREATE INDEX idx_apps_job_user ON applications(job_id, user_id);
CREATE INDEX idx_apps_submitted ON applications(submitted_at DESC) WHERE status != 'draft';
CREATE INDEX idx_apps_followup ON applications(next_followup_at) WHERE next_followup_at IS NOT NULL;
CREATE INDEX idx_apps_interviewing ON applications(user_id) WHERE status = 'interviewing';
```

#### Email Monitoring
```sql
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
    
    -- Gmail/IMAP Identifiers
    message_id VARCHAR(255) UNIQUE NOT NULL,     -- Gmail message ID
    thread_id VARCHAR(255),                       -- Gmail thread ID
    history_id VARCHAR(255),                      -- Gmail history ID for sync
    
    -- Email Headers
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_emails JSONB DEFAULT '[]'::jsonb,
    cc_emails JSONB DEFAULT '[]'::jsonb,
    subject VARCHAR(500),
    in_reply_to VARCHAR(255),
    references_header TEXT,
    
    -- Content
    body_text TEXT,
    body_html TEXT,
    snippet TEXT,  -- Gmail preview snippet
    
    -- Attachments
    attachments JSONB DEFAULT '[]'::jsonb,  -- [{"filename": "offer.pdf", "mime_type": "application/pdf", "size": 12345, "attachment_id": "..."}]
    
    -- Timestamps
    received_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    
    -- Classification (AI)
    category VARCHAR(50),  -- application_confirmation, interview_invitation, rejection, offer, follow_up, spam, newsletter, other
    confidence DECIMAL(3,2),
    classified_at TIMESTAMPTZ,
    classifier_version VARCHAR(20),
    
    -- Extracted Structured Data
    extracted_data JSONB DEFAULT '{}'::jsonb,
    /*
     * {
     *   "interview_date": "2024-01-25T14:00:00-08:00",
     *   "interview_type": "technical",
     *   "interviewers": [{"name": "Sarah", "role": "Senior Engineer"}],
     *   "meeting_link": "https://meet.google.com/...",
     *   "confirmation_deadline": "2024-01-20T17:00:00Z",
     *   "offer_details": {"salary": 180000, "equity": "0.1%", "start_date": "2024-03-01"},
     *   "rejection_reason": "position_filled"
     * }
     */
    
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_emails_user_received ON emails(user_id, received_at DESC);
CREATE INDEX idx_emails_thread ON emails(thread_id);
CREATE INDEX idx_emails_application ON emails(application_id);
CREATE INDEX idx_emails_category ON emails(user_id, category) WHERE category IS NOT NULL;
CREATE INDEX idx_emails_unprocessed ON emails(user_id, received_at) WHERE processed = FALSE;
```

#### Notifications
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL,  -- high_match, docs_ready, applied, interview_scheduled, status_change, offer, pipeline_stalled, cv_reindex_needed
    title VARCHAR(255) NOT NULL,
    message TEXT,
    
    -- Deep Link Data
    data JSONB DEFAULT '{}'::jsonb,  -- {"job_id": "...", "application_id": "...", "action": "view"}
    
    -- Channels
    channels JSONB DEFAULT '["in_app"]'::jsonb,  -- in_app, email, push, slack, telegram
    sent_channels JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    
    -- Scheduling
    send_at TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    
    -- Grouping (for digest)
    group_key VARCHAR(100),  -- e.g., "daily_digest_2024-01-15"
    is_digest BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_user_recent ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_pending ON notifications(send_at) WHERE sent_at IS NULL AND send_at <= NOW();
```

#### Pipeline Runs (Audit/Observability)
```sql
CREATE TABLE pipeline_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    trigger_type VARCHAR(30),  -- scheduled, manual, webhook, source_added
    
    -- Stage Metrics
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    
    -- Collection
    sources_run INT DEFAULT 0,
    sources_succeeded INT DEFAULT 0,
    sources_failed INT DEFAULT 0,
    raw_jobs_collected INT DEFAULT 0,
    
    -- Processing
    jobs_normalized INT DEFAULT 0,
    jobs_deduplicated INT DEFAULT 0,
    jobs_enriched INT DEFAULT 0,
    jobs_scored INT DEFAULT 0,
    
    -- Generation
    documents_generated INT DEFAULT 0,
    cvs_generated INT DEFAULT 0,
    cover_letters_generated INT DEFAULT 0,
    
    -- Applications
    applications_queued INT DEFAULT 0,
    applications_submitted INT DEFAULT 0,
    applications_failed INT DEFAULT 0,
    
    -- Email
    emails_synced INT DEFAULT 0,
    emails_classified INT DEFAULT 0,
    status_updates INT DEFAULT 0,
    
    -- Errors
    errors JSONB DEFAULT '[]'::jsonb,
    warnings JSONB DEFAULT '[]'::jsonb,
    
    status VARCHAR(20) DEFAULT 'running',  -- running, completed, failed, partial
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_runs_user ON pipeline_runs(user_id, started_at DESC);
```

---

## 2. API Specification (REST + WebSocket)

### 2.1 Base Configuration
```
Base URL: https://api.jobautomate.com/v1
Auth: Bearer <JWT Access Token>
Content-Type: application/json
Rate Limit: 100 req/min (authenticated), 20 req/min (anonymous)
```

### 2.2 Authentication Endpoints
```yaml
POST   /auth/register
  Body: {email, password, name}
  Response: {user, access_token, refresh_token}

POST   /auth/login
  Body: {email, password, remember_me?}
  Response: {user, access_token, refresh_token}

POST   /auth/oauth/{provider}  # google, github, linkedin
  Body: {code, redirect_uri}
  Response: {user, access_token, refresh_token}

POST   /auth/refresh
  Body: {refresh_token}
  Response: {access_token, refresh_token}

POST   /auth/logout
  Body: {refresh_token?}
  Response: {success: true}

POST   /auth/forgot-password
  Body: {email}
  Response: {success: true}

POST   /auth/reset-password
  Body: {token, password}
  Response: {success: true}

GET    /auth/me
  Response: {user, profile?, cv_document?}

PATCH  /auth/me
  Body: {name, avatar_url, timezone, locale}
  Response: {user}
```

### 2.3 Profile & CV Endpoints
```yaml
GET    /profile
  Response: {profile}

PATCH  /profile
  Body: {headline, summary, years_experience, current_role, current_company, 
         technical_skills?, soft_skills?, certifications?, 
         preferred_roles?, preferred_locations?, salary_min, salary_max, ...}
  Response: {profile}

POST   /profile/cv
  Content-Type: multipart/form-data
  Body: {file: <PDF/DOCX>}
  Response: {cv_document, task_id}  # Async processing

GET    /profile/cv/versions
  Response: {versions: [{id, version, filename, is_active, created_at, chunk_count}]}

POST   /profile/cv/{version}/activate
  Response: {cv_document}

POST   /profile/cv/reindex
  Body: {version?}
  Response: {task_id}  # Async re-links=0-parse=true

DELETE /profile/cv/{version}
  Response: {success: true}

GET    /profile/cv/{version}/chunks
  Query: {limit=50, offset=0}
  Response: {chunks: [{index, content, section_type, token_count}]}
```

### 2.4 Source Configuration Endpoints
```yaml
GET    /sources
  Response: {sources: [SourceConfig]}

POST   /sources
  Body: {source_type, name, config, schedule_cron?, timezone?, rate_limits?, filters?}
  Response: {source_config}

GET    /sources/{id}
  Response: {source_config}

PATCH  /sources/{id}
  Body: {name?, config?, schedule_cron?, is_active?, rate_limits?, filters?}
  Response: {source_config}

DELETE /sources/{id}
  Response: {success: true}

POST   /sources/{id}/test
  Response: {success: boolean, sample_jobs: [...], errors: [...]}

POST   /sources/{id}/run
  Response: {pipeline_run_id, status: "started"}

GET    /sources/{id}/runs
  Query: {limit=20, offset=0}
  Response: {runs: [PipelineRun]}

GET    /sources/templates
  Response: {templates: [{source_type, name, description, config_schema, example_config}]}
```

### 2.5 Jobs Endpoints
```yaml
GET    /jobs
  Query: {
    page=1, limit=20,
    status?,           # new, scored, applied, interviewing, etc.
    source?,           # linkedin, indeed, etc.
    min_score?,        # 0-100
    max_score?,
    location?,         # city, state, "remote"
    is_remote?,        # true/false
    employment_type?,  # full-time, contract, etc.
    experience_level?, # entry, junior, mid, senior, lead, executive
    salary_min?,       # USD
    salary_max?,
    company?,          # fuzzy match
    tags?,             # comma-separated
    search?,           # full-text search
    sort=score,        # score, posted_at, collected_at, company, title
    order=desc,        # asc, desc
    view=card          # card, list, compact
  }
  Response: {jobs: [JobWithScore], pagination: {page, limit, total, total_pages}}

GET    /jobs/{id}
  Response: {job, score?, application?}

POST   /jobs/import
  Body: {url, source_type?}
  Response: {job, task_id}  # Async if URL needs scraping

POST   /jobs/{id}/score
  Body: {force_refresh?}
  Response: {job_score}

POST   /jobs/bulk-score
  Body: {job_ids: [...], force_refresh?}
  Response: {task_id}

GET    /jobs/{id}/similar
  Query: {limit=10, threshold=0.7}
  Response: {jobs: [JobWithScore]}

GET    /jobs/stats
  Query: {period=30d}  # 7d, 30d, 90d, all
  Response: {
    total_collected, new_today, by_source, by_status, 
    score_distribution, top_companies, top_locations, top_tags
  }
```

### 2.6 Applications Endpoints
```yaml
GET    /applications
  Query: {page, limit, status?, job_id?, sort=submitted_at, order=desc}
  Response: {applications: [Application], pagination}

GET    /applications/pipeline
  Response: {stages: [{id, label, count, applications: [ApplicationSummary]}]}

GET    /applications/{id}
  Response: {application, job, documents: {cv_url, cl_url}, timeline: [Event]}

POST   /applications
  Body: {job_id, cv_version?, cv_template?, cl_template?, submission_mode: "auto|assisted|manual"}
  Response: {application, task_id?}  # task_id if auto/assisted

PATCH  /applications/{id}
  Body: {status?, user_notes?, next_followup_at?, interview_stages?}
  Response: {application}

POST   /applications/{id}/submit
  Body: {mode: "auto|assisted|manual", confirm?}
  Response: {application, task_id?}

POST   /applications/{id}/documents/regenerate
  Body: {cv_template?, cl_template?, cv_version?}
  Response: {application, task_id}

GET    /applications/{id}/documents
  Response: {cv_url, cv_latex, cl_url, cl_text, cv_pdf?, cl_pdf?}

POST   /applications/{id}/documents/download
  Body: {format: "pdf|latex|docx", document: "cv|cl|both"}
  Response: File download

POST   /applications/{id}/interviews
  Body: {stage, type, scheduled_at, interviewers: [{name, role, email?}], meeting_link?, notes?}
  Response: {interview_event}

PATCH  /applications/{id}/interviews/{event_id}
  Body: {status?, completed_at?, feedback?, notes?}
  Response: {interview_event}

DELETE /applications/{id}
  Body: {archive_only?}
  Response: {success: true}

POST   /applications/bulk-action
  Body: {application_ids: [...], action: "archive|withdraw|followup|regenerate_docs"}
  Response: {success_count, failed: [{id, error}]}
```

### 2.7 Analytics Endpoints
```yaml
GET    /analytics/dashboard
  Response: {
    pipeline: {applied, screening, interviewing, offered, rejected, archived},
    match_quality: {excellent, good, fair, poor, avg_score},
    applications: {this_week, this_month, total, success_rate},
    sources: [{source, collected, scored, applied, success_rate}],
    timeline: [{date, collected, scored, applied, interviewed, offered}],
    top_skills_matched, top_skills_missing
  }

GET    /analytics/pipeline
  Query: {period=30d, group_by=day|week}
  Response: {funnel: [{stage, count, conversion_rate, avg_days}], trends: [...]}

GET    /analytics/matches
  Query: {period=30d}
  Response: {score_distribution, score_trends, false_positive_rate, false_negative_rate}

GET    /analytics/sources
  Query: {period=30d}
  Response: [{source, jobs_collected, jobs_scored, applications, interviews, offers, cost_per_application, roi}]

GET    /analytics/skills
  Query: {period=90d}
  Response: {in_demand: [{skill, count, avg_salary}], my_skills_coverage: {...}, gaps: [...]}

GET    /analytics/export
  Query: {format=csv|pdf, period=30d, report_type=pipeline|matches|sources|applications}
  Response: File download
```

### 2.8 Email Monitoring Endpoints
```yaml
GET    /emails
  Query: {page, limit, category?, application_id?, unread_only?}
  Response: {emails: [Email], pagination}

GET    /emails/{id}
  Response: {email, application?, extracted_data?}

POST   /emails/sync
  Body: {full_sync?}
  Response: {task_id}

POST   /emails/{id}/classify
  Body: {correct_category?}
  Response: {email}

GET    /emails/stats
  Response: {total, by_category, unread, needs_review}
```

### 2.9 Notifications Endpoints
```yaml
GET    /notifications
  Query: {page, limit, unread_only?, type?}
  Response: {notifications: [Notification], unread_count}

PATCH  /notifications/{id}/read
  Response: {notification}

POST   /notifications/read-all
  Response: {count}

GET    /notifications/preferences
  Response: {preferences: {high_match: {in_app: true, email: true, push: false}, ...}}

PATCH  /notifications/preferences
  Body: {preferences: {...}}
  Response: {preferences}
```

### 2.10 WebSocket Events (Real-time)
```yaml
Connection: wss://api.jobautomate.com/v1/ws?token=<access_token>

# Client -> Server
{ "type": "subscribe", "channels": ["pipeline_run:123", "applications", "notifications"] }
{ "type": "ping" }

# Server -> Client
{ "type": "pipeline_progress", "run_id": "123", "stage": "scoring", "progress": 45, "message": "Scoring 23/50 jobs" }
{ "type": "pipeline_complete", "run_id": "123", "stats": {...} }
{ "type": "job_scored", "job_id": "456", "score": 92 }
{ "type": "application_updated", "application_id": "789", "status": "interviewing", "changes": {...} }
{ "type": "notification", "notification": {...} }
{ "type": "documents_ready", "application_id": "789", "cv_url": "...", "cl_url": "..." }
{ "type": "email_received", "email": {...} }
{ "type": "error", "code": "RATE_LIMIT", "message": "..." }
```

---

## 3. AI Agent Interfaces (Internal APIs)

### 3.1 Job Extraction Agent
```python
# POST /internal/agents/extract-job
Request:
{
    "raw_html": "...",
    "source_url": "https://...",
    "source_type": "playwright",
    "extraction_schema": "job_normalized_v1"
}

Response:
{
    "job": {
        "company": "Stripe",
        "title": "Senior Backend Engineer",
        "location": "San Francisco, CA",
        "is_remote": true,
        "employment_type": "full-time",
        "experience_level": "senior",
        "salary_min": 180000,
        "salary_max": 250000,
        "description": "...",
        "requirements": "...",
        "tags": ["python", "aws", "postgresql", "kubernetes"],
        "tech_stack": [{"name": "Python", "category": "language", "required": true}],
        "quality_score": 92.5,
        "completeness_score": 88.0
    },
    "confidence": 0.94,
    "warnings": ["salary not explicitly stated, estimated from market data"]
}
```

### 3.2 CV Parsing & Chunking Agent
```python
# POST /internal/agents/parse-cv
Request:
{
    "file_url": "https://r2.../cv.pdf",
    "file_hash": "sha256...",
    "user_id": "uuid"
}

Response:
{
    "parsed_text": "...",
    "sections": {
        "experience": [{"company": "...", "role": "...", "dates": "...", "bullets": [...]}],
        "education": [...],
        "skills": [...],
        "projects": [...]
    },
    "chunks": [
        {"index": 0, "content": "...", "section_type": "experience", "token_count": 156, "metadata": {"company": "Stripe"}},
        ...
    ],
    "total_chunks": 23,
    "embedding_model": "text-embedding-3-large"
}
```

### 3.3 Job Matching Agent
```python
# POST /internal/agents/match-job
Request:
{
    "job_id": "uuid",
    "user_id": "uuid",
    "job": {...},  # Full job object
    "profile": {...},  # Full profile
    "cv_chunks": [...],  # Top 20 relevant chunks
    "weights": {"skills": 0.35, "experience": 0.25, "location": 0.15, "salary": 0.1, "culture": 0.1, "keywords": 0.05}
}

Response:
{
    "overall_score": 92.5,
    "component_scores": {
        "skill_match": 95.0,
        "experience_match": 88.0,
        "location_match": 95.0,
        "salary_match": 90.0,
        "culture_match": 85.0,
        "keyword_match": 94.0
    },
    "matched_skills": [{"skill": "Python", "required": true, "user_level": "expert", "match": 1.0}],
    "missing_skills": [{"skill": "Kubernetes", "required": true, "importance": "high"}],
    "reasoning": "Strong match on core backend skills...",
    "confidence": 0.93,
    "model_used": "gpt-4o-2024-08-06",
    "tokens_used": 2847
}
```

### 3.4 CV Tailoring Agent
```python
# POST /internal/agents/tailor-cv
Request:
{
    "base_cv_latex": "...",
    "job": {...},
    "profile": {...},
    "relevant_chunks": [...],
    "template": "modern",
    "target_role": "Senior Backend Engineer"
}

Response:
{
    "tailored_latex": "...",
    "pdf_url": "https://r2.../cv_uuid.pdf",
    "changes": [
        {"section": "experience", "bullet_index": 2, "original": "...", "tailored": "...", "reason": "Emphasized Python async experience"},
        ...
    ],
    "keywords_injected": ["asyncio", "FastAPI", "postgresql", "kubernetes"],
    "ats_score_estimate": 94
}
```

### 3.5 Cover Letter Agent
```python
# POST /internal/agents/generate-cover-letter
Request:
{
    "tailored_cv_latex": "...",
    "job": {...},
    "profile": {...},
    "template": "standard",
    "tone": "professional"  # professional, enthusiastic, concise
}

Response:
{
    "cover_letter_text": "...",
    "pdf_url": "https://r2.../cl_uuid.pdf",
    "word_count": 287,
    "key_points_addressed": ["Python expertise", "Stripe's API platform", "Scale experience"]
}
```

### 3.6 Email Classification Agent
```python
# POST /internal/agents/classify-email
Request:
{
    "email": {
        "from": "recruiting@stripe.com",
        "subject": "Next steps for Senior Backend Engineer",
        "body_text": "...",
        "body_html": "..."
    },
    "user_context": {
        "applications": [{"company": "Stripe", "role": "Senior Backend Engineer", "status": "submitted"}]
    }
}

Response:
{
    "category": "interview_invitation",
    "confidence": 0.98,
    "extracted_data": {
        "interview_date": "2024-01-25T14:00:00-08:00",
        "interview_type": "technical",
        "interviewers": [{"name": "Sarah Chen", "role": "Senior Engineer"}],
        "meeting_link": "https://calendly.com/stripe/tech-screen/abc123",
        "confirmation_deadline": "2024-01-20T17:00:00Z"
    },
    "matched_application_id": "uuid"
}
```

---

## 4. n8n Workflow Definitions (Key Workflows)

### 4.1 Daily Collection Workflow
```json
{
  "name": "Daily Job Collection",
  "trigger": {"type": "cron", "expression": "0 6 * * *"},
  "nodes": [
    {"name": "GetActiveSources", "type": "postgres", "operation": "select", "query": "SELECT * FROM source_configs WHERE is_active = true"},
    {"name": "SplitSources", "type": "splitInBatches", "batchSize": 5},
    {"name": "CollectSource", "type": "httpRequest", "url": "http://agents:8000/collect", "method": "POST"},
    {"name": "MergeResults", "type": "merge"},
    {"name": "TriggerNormalize", "type": "n8nWorkflow", "workflowId": "normalize-jobs"}
  ]
}
```

### 4.2 Job Normalization Workflow
```json
{
  "name": "Normalize Jobs",
  "trigger": {"type": "workflow"},
  "nodes": [
    {"name": "FetchRawJobs", "type": "postgres", "query": "SELECT * FROM jobs_raw WHERE processed = false AND user_id = $1"},
    {"name": "BatchExtract", "type": "splitInBatches", "batchSize": 10},
    {"name": "LLMExtract", "type": "httpRequest", "url": "http://agents:8000/extract-job", "method": "POST"},
    {"name": "Validate", "type": "function", "code": "validateAgainstSchema(items)"},
    {"name": "UpsertJobs", "type": "postgres", "operation": "upsert", "table": "jobs", "conflictKeys": ["source", "source_id"]},
    {"name": "MarkProcessed", "type": "postgres", "query": "UPDATE jobs_raw SET processed = true WHERE id = ANY($1)"},
    {"name": "TriggerDedupe", "type": "n8nWorkflow", "workflowId": "deduplicate-jobs"}
  ]
}
```

---

## 5. Migration Scripts (Drizzle ORM)

### 5.1 Initial Migration
```typescript
// migrations/0001_initial_schema.ts
import { pgTable, uuid, varchar, text, timestamp, boolean, integer, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).unique().notNull(),
    emailVerified: boolean('email_verified').default(false),
    name: varchar('name', { length: 255 }),
    avatarUrl: text('avatar_url'),
    timezone: varchar('timezone', { length: 50 }).default('UTC'),
    locale: varchar('locale', { length: 10 }).default('en-US'),
    passwordHash: varchar('password_hash', { length: 255 }),
    googleId: varchar('google_id', { length: 255 }).unique(),
    githubId: varchar('github_id', { length: 255 }).unique(),
    linkedinId: varchar('linkedin_id', { length: 255 }).unique(),
    failedLoginAttempts: integer('failed_login_attempts').default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
    emailIdx: index('idx_users_email').on(table.email),
    googleIdIdx: index('idx_users_google_id').on(table.googleId),
    githubIdIdx: index('idx_users_github_id').on(table.githubId),
}));

// ... (all tables defined similarly with Drizzle)
```

---

## 6. Performance & Scaling Considerations

### 6.1 Query Optimization Guidelines
| Query Pattern | Optimization |
|---------------|--------------|
| User's jobs by status | Partial index `WHERE user_id IS NOT NULL` |
| Vector similarity | HNSW index with `m=16, ef_construction=64` |
| Full-text search | GIN index on `to_tsvector` |
| Time-series analytics | Partition `pipeline_runs` by month |
| Deduplication | Unique index on `(source, source_id)` |

### 6.2 Connection Pooling
```yaml
# PgBouncer config
pool_mode: transaction
max_client_conn: 1000
default_pool_size: 25
max_db_connections: 100
min_pool_size: 5
reserve_pool_size: 5
reserve_pool_timeout: 5
```

### 6.3 Read Replicas
- Primary: Writes + critical reads (auth, payments)
- Replica 1: Analytics, dashboard queries
- Replica 2: Job search, vector similarity
- Replica 3: Email processing, background jobs

---

*Document Version: 1.0 | Last Updated: 2024 | Owner: Backend Engineering*