# Skill: Job Agents & Collectors

## Usage Trigger

MUST read when task involves: LangGraph, Celery task, collector, scraper, RSS, IMAP, Playwright apply, job matching, CV generation, embedding, pgvector, `workers/`.

## Prerequisites

1. Read [`CLAUDE.md`](../CLAUDE.md) — HG-4 (approval gate), HG-9 (no hallucinated CV), HG-10 (no n8n)
2. Read [`contracts/queue-payloads.schema.json`](../contracts/queue-payloads.schema.json)
3. Read [`docs/AppFlow.md`](../docs/AppFlow.md) §2.2, §2.7

## Agent Services (4 graphs)

| Service | Path | Responsibility |
|---------|------|----------------|
| ExtractNormalize | `workers/agents/extract_normalize/` | Parse raw jobs → structured JSON |
| MatchScore | `workers/agents/match_score/` | pgvector + multi-factor scoring |
| GenerateDocs | `workers/agents/generate_docs/` | Tailored CV + cover letter from user CV chunks |
| SubmitVerify | `workers/agents/submit_verify/` | Playwright submit **after approval only** |

## Collector Plugins

Each source type = one file in `workers/collectors/` implementing `BaseCollector`:

```python
class BaseCollector(ABC):
    async def collect(self, config: dict) -> list[RawJob]: ...
```

Register in `workers/collectors/registry.py`. Types: `rss`, `api`, `imap`, `playwright`, `telegram`, `career_page`.

## Rules

- **Token budget:** Log token usage per task; cap daily per user in API before enqueue.
- **Structured output:** All LLM extraction uses JSON schema validation (Pydantic).
- **No submit without approval:** `SubmitApplicationJob` must include `approved_at` timestamp.
- **Idempotency:** Collect and normalize tasks keyed by `(source_id, source_external_id)`.
- **Errors:** Failed collector → update `source_configs.last_run_status`; never silent fail.

## Celery Task Naming

```
tasks.collect_source
tasks.normalize_jobs
tasks.match_score
tasks.generate_docs
tasks.submit_application  # requires approved_at
```

## Done Criteria

- [ ] Payload matches JSON schema
- [ ] pytest for happy path + schema validation failure
- [ ] No PII in worker logs (HG-8)
