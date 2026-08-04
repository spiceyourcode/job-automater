# Workers — Celery + collectors + agents

**Status:** P1.5 scaffold + **P2.2 collectors** (RSS / API / IMAP).

## Contract

- `docs/contracts/phase-2-collection.md`
- `08-skills/job-agent-skill.md`
- `contracts/queue-payloads.schema.json` → `CollectSourceJob`

## Structure

```
workers/
├── celery_app.py
├── config.py
├── db.py                 # Postgres helpers (jobs_raw + source_configs status)
├── collectors/
│   ├── base.py           # BaseCollector, RawJob
│   ├── registry.py
│   ├── rss.py
│   ├── api.py
│   └── imap.py
├── tasks/
│   ├── health.py
│   ├── collect_source.py # tasks.collect_source
│   └── collect_bridge.py # BRPOP jobautomater:collect_source → Celery
└── tests/
```

## Run

```bash
cd workers
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"
celery -A celery_app worker --loglevel=info
```

API `POST /api/v1/sources/:id/run` LPUSH-es to Redis key `jobautomater:collect_source`.
The bridge thread BRPOPs and enqueues `tasks.collect_source`.

On failure, `source_configs.last_run_status` is set to `failed` (never silent).

## Tests

```bash
pytest
```

Golden RSS fixture: `tests/fixtures/sample_rss.xml` + `golden_rss_parse.json`.
