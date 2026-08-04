# Workers — Celery + collectors + agents

**Status:** P1.5 scaffold + P2.2 collectors + **P2.3 extract_normalize**.

## Contract

- `docs/contracts/phase-2-collection.md`
- `08-skills/job-agent-skill.md`
- `contracts/queue-payloads.schema.json` → `CollectSourceJob`, `NormalizeJobsJob`

## Structure

```
workers/
├── celery_app.py
├── config.py
├── db.py
├── collectors/           # rss, api, imap
├── agents/
│   └── extract_normalize/  # LangGraph: extract → validate (HG-9)
├── tasks/
│   ├── health.py
│   ├── collect_source.py
│   ├── collect_bridge.py
│   └── normalize_jobs.py
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

Via WSL + [rtk](https://github.com/rtk-ai/rtk) (Homebrew):

```bash
wsl -d Debian -- bash -lc 'export PATH=/home/linuxbrew/.linuxbrew/bin:$PATH; cd /mnt/c/.../workers && rtk proxy ./.venv/Scripts/python.exe -m pytest -q'
```

API `POST /sources/:id/run` → Redis list → `tasks.collect_source` → `tasks.normalize_jobs`.

On failure, `source_configs.last_run_status` / `jobs_raw.processing_error` is set (never silent).

## Tests

```bash
rtk proxy ./.venv/Scripts/python.exe -m pytest -q
```

Fixtures: `tests/fixtures/normalize_samples.json` (10 postings), golden RSS.
