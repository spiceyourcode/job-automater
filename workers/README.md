# Workers — Celery + collectors + agents

Collectors, LangGraph agents, and Celery tasks that process jobs, documents, email, and apply flows. Queue payloads match `contracts/queue-payloads.schema.json`.

## Structure

```
workers/
├── collectors/          rss, api, imap, playwright, career_page, telegram
├── agents/              extract_normalize, match_score, generate_docs, …
├── lib/                 LLM + embeddings helpers
├── tasks/               Celery entrypoints
└── tests/
```

Match weights (see `docs/TRD.md`): skills 40%, experience 25%, location 15%, salary 10%, culture 10%.

Pipeline: collect → normalize → match_score. Scores are user-scoped.

## Run worker (local)

From the repo root, `cp .env.example .env` and start Docker (Postgres, Redis, MinIO). Then:

```bash
cd workers
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -e ".[dev]"
celery -A celery_app worker -l info
```

On **Windows**, the app defaults to `--pool=solo` (prefork crashes with `WinError 6`). You can also force it:

```bash
celery -A celery_app worker -l info --pool=solo
```

After installing the `playwright` extra, download Chromium once:

```bash
python -m playwright install chromium
```

Playwright sources need real CSS selectors for that site (`startUrl`, `jobCardSelector`, `titleSelector`). A bare careers URL with `.job-card` usually yields 0 jobs.

## Tests

```bash
python -m pytest -q
```
